package agent

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/pocketbase/pocketbase/core"

	"github.com/cornworld/vanblog/internal/validation"
)

// Package agent hosts the platform agent surface. Since the 2026-08
// redesign all interactive capability lives in the engine's own TUI,
// served to browsers over a WebSocket PTY bridge (terminal.go). The old
// SSE chat API and the PB-side session bookkeeping were removed:
//
//   - sessions are engine-native files under <pb_data>/agent-sessions,
//     shared verbatim by the web terminal and `docker exec pi` (same file,
//     no sync), persisted with the data volume;
//   - the engine binary is selected by agent-config/engine.json
//     (loadEngineConfig below), shared by the terminal bridge;
//   - prod images register none of these routes (dev-only, see Enabled).

const piBinary = "pi"

// Enabled reports whether agent capability should register in this process.
// Agent (TUI bridge, validation tool) is a dev-container feature: prod must
// not run engines or expose agent endpoints. Default-closed — only an
// explicit VANBLOG_MODE=dev enables it.
func Enabled() bool {
	return os.Getenv("VANBLOG_MODE") == "dev"
}

// engineConfig selects the coding-agent binary. Resolution order:
// env (VANBLOG_AGENT_BIN) > agent-config/engine.json > built-in default.
type engineConfig struct {
	Bin       string   `json:"bin"`
	ExtraArgs []string `json:"extraArgs"`
	// TuiBin selects the engine for interactive TUI runs (web terminal /
	// docker exec). Defaults to pi: bridge wrappers (engine.json "bin")
	// are rpc-mode constructs and make no sense attached to a PTY.
	TuiBin string `json:"tuiBin"`
}

func loadEngineConfig() engineConfig {
	cfg := engineConfig{Bin: piBinary, ExtraArgs: []string{}}
	if data, err := os.ReadFile(filepath.Join(piWorkDir(), "agent-config", "engine.json")); err == nil {
		var file engineConfig
		if json.Unmarshal(data, &file) == nil && file.Bin != "" {
			cfg = file
			if cfg.ExtraArgs == nil {
				cfg.ExtraArgs = []string{}
			}
		}
	}
	if b := os.Getenv("VANBLOG_AGENT_BIN"); b != "" {
		cfg.Bin = b
	}
	if s := os.Getenv("VANBLOG_AGENT_EXTRA_ARGS"); s != "" {
		cfg.ExtraArgs = strings.Fields(s)
	}
	return cfg
}

// piWorkDir is the directory the engine runs in. The dev container exports
// VANBLOG_WORKSPACE (the live bind-mounted tree at /app); other
// environments fall back to the current working directory.
func piWorkDir() string {
	if dir := os.Getenv("VANBLOG_WORKSPACE"); dir != "" {
		return dir
	}
	if dir, err := os.Getwd(); err == nil {
		return dir
	}
	return "/"
}

// SessionsDir returns the shared engine session directory inside the PB
// data dir. Both the web terminal and interactive `pi` runs point here so
// a conversation started in the browser continues in a terminal (and vice
// versa) — one file, no synchronization.
func SessionsDir(app core.App) string {
	return filepath.Join(app.DataDir(), "agent-sessions")
}

// Manager registers the admin-only agent endpoints (schema preflight
// validation; the terminal bridge registers from terminal.go).
type Manager struct {
	app core.App
}

func New(app core.App) *Manager {
	m := &Manager{app: app}
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		if Enabled() {
			se.Router.POST("/api/vanblog/agent/validate", m.handleValidate)
			se.Router.GET("/api/vanblog/agent/terminal", m.handleTerminal)
		}
		return se.Next()
	})
	return m
}

type validateRequest struct {
	SchemaName string `json:"schemaName"`
	Payload    any    `json:"payload"`
}

// handleValidate is the schema preflight endpoint used by tooling before
// writing schema-shaped payloads to PB (see .agents/skills/vanblog).
func (m *Manager) handleValidate(e *core.RequestEvent) error {
	if !isAdmin(e) {
		return e.ForbiddenError("admin required", "")
	}

	var req validateRequest
	if err := json.NewDecoder(e.Request.Body).Decode(&req); err != nil {
		return e.BadRequestError("invalid JSON body", "")
	}
	if req.SchemaName == "" {
		return e.BadRequestError("schemaName is required", "")
	}

	prog := validation.CoreProgram()
	if prog == nil {
		return e.JSON(http.StatusServiceUnavailable, map[string]any{
			"valid":  false,
			"issues": []string{"schema registry not initialized (core models not yet loaded)"},
		})
	}

	issues, err := validation.ValidateSchema(prog, req.SchemaName, req.Payload)
	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]any{
			"valid":  false,
			"issues": []string{err.Error()},
		})
	}

	return e.JSON(http.StatusOK, map[string]any{
		"valid":  len(issues) == 0,
		"issues": issues,
	})
}

func isAdmin(e *core.RequestEvent) bool {
	return e.Auth != nil && e.Auth.GetString("role") == "admin"
}
