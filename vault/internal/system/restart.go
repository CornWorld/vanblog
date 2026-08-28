package system

// restart.go implements the admin-only POST /api/vanblog/system/restart
// endpoint. It sends SIGUSR1 to the entrypoint supervisor (PID 1), which
// traps the signal and performs a supervised PocketBase restart — killing
// the old PB process and starting a fresh one so newly-added Pack hooks are
// loaded. The HTTP response returns immediately with {accepted: true} before
// the restart takes effect; the caller is expected to poll /api/health
// until PB comes back up (~5-15s).
//
// Why signal instead of app.Restart(): PocketBase's Restart() replaces the
// process in-place (execve), which would bypass the entrypoint's
// supervised_restart_pb() logic and its RESTARTING flag. The entrypoint
// needs to control the restart lifecycle so monitor_children doesn't kill
// the container when PB briefly exits.
//
// Non-container safety: PID 1 outside Docker may be launchd/systemd/init.
// SIGUSR1's default action is terminate — sending it to an unprotected PID 1
// is dangerous. We guard with VANBLOG_ENTRYPOINT env check: the entrypoint
// sets this env so the Go binary can detect it's running under the
// supervised entrypoint. If the env is absent, the endpoint returns an error.

import (
	"log/slog"
	"net/http"
	"os"
	"sync"
	"syscall"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

const restartCooldown = 30 * time.Second

// Manager wires system management routes (restart + metrics) onto the PB
// serve mux. It owns the metrics collector goroutine.
type Manager struct {
	app core.App

	mu          sync.Mutex
	lastRestart time.Time

	collector *metricsCollector
}

// New registers the system management routes and starts the metrics collector.
func New(app core.App) *Manager {
	m := &Manager{app: app}
	m.collector = newMetricsCollector(app)

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/vanblog/system/restart", m.handleRestart)
		se.Router.GET("/api/vanblog/system/metrics", m.handleMetrics)
		return se.Next()
	})

	// Start the background metrics collector goroutine.
	m.collector.start()

	return m
}

// handleRestart sends SIGUSR1 to PID 1 (the entrypoint supervisor) to trigger
// a supervised PocketBase restart. Admin-only.
func (m *Manager) handleRestart(e *core.RequestEvent) error {
	if !isAdmin(e) {
		return e.ForbiddenError("admin required", "")
	}

	// Non-container safety: refuse to send SIGUSR1 to PID 1 unless the
	// supervised entrypoint set VANBLOG_ENTRYPOINT=1. Outside Docker, PID 1
	// is launchd/systemd and SIGUSR1 terminates it by default.
	if os.Getenv("VANBLOG_ENTRYPOINT") == "" {
		return e.JSON(http.StatusServiceUnavailable, map[string]string{
			"message": "restart endpoint only available under the supervised entrypoint",
		})
	}

	// Rate limit: prevent rapid restart calls from causing cascading restarts.
	// The entrypoint also has a cooldown (sleep after flag removal), but this
	// in-process check provides immediate feedback to the caller.
	m.mu.Lock()
	if time.Since(m.lastRestart) < restartCooldown {
		remaining := restartCooldown - time.Since(m.lastRestart)
		m.mu.Unlock()
		return e.JSON(http.StatusTooManyRequests, map[string]any{
			"accepted":  false,
			"message":   "restart cooldown active",
			"retry_in":  int(remaining.Seconds()),
		})
	}
	m.lastRestart = time.Now()
	m.mu.Unlock()

	// Find PID 1 (the entrypoint supervisor).
	supervisor, err := os.FindProcess(1)
	if err != nil {
		slog.Error("[system] cannot find PID 1", "err", err)
		return e.JSON(http.StatusInternalServerError, map[string]string{
			"message": "cannot locate supervisor process",
		})
	}

	if err := supervisor.Signal(syscall.SIGUSR1); err != nil {
		slog.Error("[system] failed to send SIGUSR1 to supervisor", "err", err)
		return e.JSON(http.StatusInternalServerError, map[string]string{
			"message": "failed to send restart signal: " + err.Error(),
		})
	}

	adminID := ""
	if e.Auth != nil {
		adminID = e.Auth.Id
	}
	slog.Info("[system] restart signal sent to entrypoint supervisor",
		"admin", adminID,
		"pid", 1,
	)

	// Return immediately — the PB process will be killed and restarted by
	// the entrypoint within seconds. The client should poll /api/health.
	return e.JSON(http.StatusOK, map[string]any{
		"accepted": true,
		"message":  "restart signal sent to supervisor; poll /api/health for recovery",
	})
}

// isAdmin mirrors the admin check in internal/agent and internal/mcp.
func isAdmin(e *core.RequestEvent) bool {
	return e.Auth != nil && e.Auth.GetString("role") == "admin"
}
