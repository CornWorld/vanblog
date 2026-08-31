package agent

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
	"github.com/pocketbase/pocketbase/core"
)

// terminal.go — the WebSocket PTY bridge: renders the engine's native TUI
// (pi / omp per agent-config/engine.json) inside the admin UI. This is the
// single interactive agent surface; the browser terminal and `docker exec`
// share the same session files under SessionsDir.
//
// Wire protocol (one WS connection = one engine TUI process):
//   client → server: binary frames = stdin bytes;
//                   text frames   = {"type":"resize","cols":N,"rows":N}
//   server → client: binary frames = PTY stdout bytes (rendered by xterm.js)

var upgrader = websocket.Upgrader{
	// Same-origin only: the admin UI is served by the same Caddy/PB origin.
	CheckOrigin: func(r *http.Request) bool {
		return true // Caddy/PB enforce origin + auth in front; see handleTerminal
	},
	ReadBufferSize:  32 * 1024,
	WriteBufferSize: 32 * 1024,
}

type resizeMsg struct {
	Type string `json:"type"`
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

// handleTerminal upgrades to WebSocket and bridges the engine TUI.
func (m *Manager) handleTerminal(e *core.RequestEvent) error {
	if !isAdmin(e) {
		// WS handshake cannot carry an Authorization header; the admin page
		// passes its token via query string. Cookie auth is not relied on
		// (custom routes do not populate e.Auth from cookies).
		if token := e.Request.URL.Query().Get("token"); token != "" {
			if rec, err := m.app.FindAuthRecordByToken(token, core.TokenTypeAuth); err == nil && rec.GetString("role") == "admin" {
				e.Auth = rec
			}
		}
	}
	if !isAdmin(e) {
		return e.ForbiddenError("admin required", "")
	}

	conn, err := upgrader.Upgrade(e.Response, e.Request, nil)
	if err != nil {
		// Upgrade already wrote the HTTP error response.
		return err
	}
	defer conn.Close()

	cfg := loadEngineConfig()
	sessions := SessionsDir(m.app)
	if err := os.MkdirAll(sessions, 0o700); err != nil {
		_ = writeTermError(conn, "create session dir: "+err.Error())
		return nil
	}

	// Interactive TUI run of the engine: no --mode rpc, no auto-approve —
	// the TUI owns streaming, tool visibility and approvals natively.
	// Bridges (engine.json "bin") are rpc-mode constructs; a PTY always
	// attaches an interactive engine (tuiBin, default pi).
	tuiBin := cfg.TuiBin
	if tuiBin == "" {
		tuiBin = piBinary
	}
	cmd := exec.Command(tuiBin, "--session-dir", sessions)
	cmd.Dir = piWorkDir()
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: 24, Cols: 80})
	if err != nil {
		_ = writeTermError(conn, "start engine "+cfg.Bin+": "+err.Error())
		return nil
	}
	defer func() {
		_ = ptmx.Close()
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
	}()

	// PTY → client pump.
	var writeMu sync.Mutex
	done := make(chan struct{})
	go func() {
		defer close(done)
		buf := make([]byte, 32*1024)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				writeMu.Lock()
				werr := conn.WriteMessage(websocket.BinaryMessage, buf[:n])
				writeMu.Unlock()
				if werr != nil {
					return
				}
			}
			if err != nil {
				return
			}
		}
	}()

	// Client → PTY pump (stdin bytes + resize control frames).
	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			break
		}
		switch msgType {
		case websocket.BinaryMessage:
			if _, err := ptmx.Write(data); err != nil {
				_ = conn.Close()
			}
		case websocket.TextMessage:
			var r resizeMsg
			if json.Unmarshal(data, &r) == nil && r.Type == "resize" {
				_ = pty.Setsize(ptmx, &pty.Winsize{Rows: r.Rows, Cols: r.Cols})
			}
		}
	}
	<-done
	return nil
}

func writeTermError(conn *websocket.Conn, message string) error {
	payload, _ := json.Marshal(map[string]string{"type": "error", "message": message})
	return conn.WriteMessage(websocket.TextMessage, payload)
}
