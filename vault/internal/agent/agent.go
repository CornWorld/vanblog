package agent

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

const (
	sessionCollection = "agent_sessions"
	piBinary          = "pi"
	piWorkingDir      = "/workspace"
	sessionIdleTTL    = 30 * time.Minute
	sessionFileTTL    = 7 * 24 * time.Hour
)

// Manager exposes pi's native JSONL RPC through the authenticated PocketBase API.
// PocketBase owns durable session metadata; runtimes only contain local child processes.
type Manager struct {
	app core.App

	mu       sync.Mutex
	runtimes map[string]*runtimeSession
}

type runtimeSession struct {
	id     string
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	reader *bufio.Reader
	active bool
	last   time.Time
}

func New(app core.App) *Manager {
	m := &Manager{app: app, runtimes: make(map[string]*runtimeSession)}
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/vanblog/agent/chat", m.handleChat)
		return se.Next()
	})
	go m.cleanupLoop()
	return m
}

type chatRequest struct {
	SessionID string `json:"sessionId"`
	Message   string `json:"message"`
}

func (m *Manager) handleChat(e *core.RequestEvent) error {
	if !isAdmin(e) {
		return e.ForbiddenError("admin required", "")
	}

	var req chatRequest
	if err := json.NewDecoder(e.Request.Body).Decode(&req); err != nil {
		return e.BadRequestError("invalid JSON body", "")
	}
	if strings.TrimSpace(req.Message) == "" {
		return e.BadRequestError("message is required", "")
	}

	session, err := m.getOrCreateSession(e.Auth.Id, req.SessionID)
	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]string{"message": err.Error()})
	}

	runtime, err := m.acquireRuntime(session)
	if err != nil {
		if errors.Is(err, errSessionBusy) {
			return writeJSONError(e.Response, http.StatusConflict, "session is busy")
		}
		return e.JSON(http.StatusInternalServerError, map[string]string{"message": err.Error()})
	}
	defer m.releaseRuntime(runtime)

	w := e.Response
	w.Header().Set("X-Agent-Session-ID", session.Id)
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flush := func() { _ = http.NewResponseController(w).Flush() }

	if err := runtime.sendPrompt(req.Message); err != nil {
		_ = writeSSE(w, map[string]any{"type": "error", "message": err.Error()})
		flush()
		return nil
	}

	for {
		line, readErr := runtime.reader.ReadBytes('\n')
		if len(line) > 0 {
			var event map[string]any
			if json.Unmarshal(bytesTrimSpace(line), &event) == nil {
				if err := writeSSE(w, event); err != nil {
					return nil
				}
				flush()
				if event["type"] == "agent_settled" {
					break
				}
				if event["type"] == "response" && event["command"] == "prompt" && event["success"] == false {
					break
				}
			}
		}
		if readErr != nil {
			if !errors.Is(readErr, io.EOF) {
				_ = writeSSE(w, map[string]any{"type": "error", "message": "pi RPC exited: " + readErr.Error()})
				flush()
			}
			m.dropRuntime(runtime.id)
			break
		}
	}
	return nil
}

func (m *Manager) getOrCreateSession(ownerID, id string) (*core.Record, error) {
	col, err := m.app.FindCollectionByNameOrId(sessionCollection)
	if err != nil {
		return nil, fmt.Errorf("find agent session collection: %w", err)
	}
	if id != "" {
		record, err := m.app.FindRecordById(col.Id, id)
		if err != nil {
			return nil, fmt.Errorf("session not found: %w", err)
		}
		if record.GetString("owner") != ownerID {
			return nil, errors.New("session does not belong to current admin")
		}
		return record, nil
	}

	record := core.NewRecord(col)
	sessionDir := filepath.Join(m.app.DataDir(), "agent-sessions", record.Id)
	if err := os.MkdirAll(sessionDir, 0o700); err != nil {
		return nil, fmt.Errorf("create session directory: %w", err)
	}
	now := time.Now()
	record.Set("owner", ownerID)
	record.Set("status", "idle")
	record.Set("sessionDir", sessionDir)
	record.Set("lastActivityAt", now)
	record.Set("expiresAt", now.Add(sessionFileTTL))
	if err := m.app.Save(record); err != nil {
		return nil, fmt.Errorf("save agent session: %w", err)
	}
	return record, nil
}

var errSessionBusy = errors.New("session busy")

func (m *Manager) acquireRuntime(record *core.Record) (*runtimeSession, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if runtime := m.runtimes[record.Id]; runtime != nil {
		if runtime.active {
			return nil, errSessionBusy
		}
		runtime.active = true
		runtime.last = time.Now()
		return runtime, nil
	}

	dir := record.GetString("sessionDir")
	if dir == "" {
		return nil, errors.New("agent session has no session directory")
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("create session directory: %w", err)
	}

	cmd := exec.Command(piBinary, "--mode", "rpc", "--approve", "--session-dir", dir)
	cmd.Dir = piWorkingDir
	cmd.Stderr = os.Stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("create pi stdout pipe: %w", err)
	}
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("create pi stdin pipe: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start pi RPC: %w", err)
	}

	runtime := &runtimeSession{
		id:     record.Id,
		cmd:    cmd,
		stdin:  stdin,
		reader: bufio.NewReader(stdout),
		active: true,
		last:   time.Now(),
	}
	m.runtimes[record.Id] = runtime
	go func() { _ = cmd.Wait() }()
	record.Set("processId", cmd.Process.Pid)
	record.Set("status", "active")
	record.Set("lastActivityAt", runtime.last)
	if err := m.app.Save(record); err != nil {
		_ = cmd.Process.Kill()
		delete(m.runtimes, record.Id)
		return nil, fmt.Errorf("update agent session: %w", err)
	}
	return runtime, nil
}

func (r *runtimeSession) sendPrompt(message string) error {
	payload, err := json.Marshal(map[string]any{
		"type":    "prompt",
		"id":      strconv.FormatInt(time.Now().UnixNano(), 10),
		"message": message,
	})
	if err != nil {
		return err
	}
	if _, err := r.stdin.Write(append(payload, '\n')); err != nil {
		return fmt.Errorf("write pi RPC prompt: %w", err)
	}
	r.last = time.Now()
	return nil
}

func (m *Manager) releaseRuntime(runtime *runtimeSession) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if current := m.runtimes[runtime.id]; current == runtime {
		current.active = false
		current.last = time.Now()
		if record, err := m.app.FindRecordById(sessionCollection, runtime.id); err == nil {
			record.Set("status", "idle")
			record.Set("lastActivityAt", current.last)
			_ = m.app.Save(record)
		}
	}
}

func (m *Manager) dropRuntime(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.dropRuntimeLocked(id)
}

func (m *Manager) dropRuntimeLocked(id string) {
	if runtime := m.runtimes[id]; runtime != nil {
		_ = runtime.stdin.Close()
		_ = runtime.cmd.Process.Kill()
		delete(m.runtimes, id)
	}
}

func (m *Manager) cleanupLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		m.cleanup()
	}
}

func (m *Manager) cleanup() {
	now := time.Now()
	m.mu.Lock()
	for id, runtime := range m.runtimes {
		if !runtime.active && now.Sub(runtime.last) > sessionIdleTTL {
			m.dropRuntimeLocked(id)
		}
	}
	m.mu.Unlock()

	filter := "expiresAt < \"" + now.UTC().Format(time.RFC3339) + "\""
	records, err := m.app.FindRecordsByFilter(sessionCollection, filter, "", 0, 0)
	if err != nil {
		return
	}
	for _, record := range records {
		m.dropRuntime(record.Id)
		if dir := record.GetString("sessionDir"); dir != "" {
			_ = os.RemoveAll(dir)
		}
		_ = m.app.Delete(record)
	}
}

func writeSSE(w io.Writer, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(w, "data: %s\n\n", data)
	return err
}

func writeJSONError(w http.ResponseWriter, status int, message string) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, err := fmt.Fprintf(w, "%s\n", mustJSON(map[string]string{"message": message}))
	return err
}

func bytesTrimSpace(value []byte) []byte { return []byte(strings.TrimSpace(string(value))) }

func isAdmin(e *core.RequestEvent) bool {
	return e.Auth != nil && e.Auth.GetString("role") == "admin"
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
