package agent

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// Agent is the manager for the AI agent chat endpoint.
// It bridges the admin UI to the pi RPC server running in the dev container.
//
// Product rationale (see refs/agent-platform-selection.md):
//   - Official agent = dev container + pi + vanblog skill pack.
//   - The admin UI (/admin/agent) talks to PB, which proxies to pi RPC
//     (127.0.0.1:4329) as SSE. pi RPC is loopback-only — never exposed to
//     the public internet; PB is the authentication boundary.
type Manager struct {
	app core.App
	// piRPCURL is the loopback address of the pi RPC server.
	// Overridable for tests.
	piRPCURL string
}

// New wires the agent routes onto the serve mux.
func New(app core.App) *Manager {
	m := &Manager{app: app, piRPCURL: "http://127.0.0.1:4329"}
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/vanblog/agent/chat", m.handleChat)
		return se.Next()
	})
	return m
}

// chatRequest is the JSON body the admin UI posts.
type chatRequest struct {
	Message string `json:"message"`
}

// handleChat proxies a chat message to pi RPC and streams the SSE response
// back to the browser. Admin-only — non-admins get 403.
func (m *Manager) handleChat(e *core.RequestEvent) error {
	if !isAdmin(e) {
		return e.ForbiddenError("admin required", "")
	}

	// Read + validate body
	var req chatRequest
	if err := json.NewDecoder(e.Request.Body).Decode(&req); err != nil {
		return e.BadRequestError("invalid JSON body", "")
	}
	if req.Message == "" {
		return e.BadRequestError("message is required", "")
	}

	// Set up SSE response headers BEFORE writing anything.
	w := e.Response
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // disable proxy buffering
	w.WriteHeader(http.StatusOK)
flusher := func() {
		_ = http.NewResponseController(w).Flush()
	}

	// Forward to pi RPC
	outbound, err := m.forward(req.Message)
	if err != nil {
		fmt.Fprintf(w, "data: %s\n\n", mustJSON(map[string]any{"type": "error", "message": err.Error()}))
		flusher()
		return nil
	}
	defer outbound.Close()

	// Stream pi's SSE lines back verbatim.
	reader := bufio.NewReader(outbound)
	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			// Flush as-is (pi RPC emits `data: {...}\n\n` chunks).
			if _, werr := w.Write(line); werr != nil {
				break // client disconnected
			}
			flusher()
		}
		if err != nil {
			break // EOF or connection closed
		}
	}
	return nil
}

// forward POSTs a message to pi RPC and returns the response body (SSE stream).
func (m *Manager) forward(message string) (io.ReadCloser, error) {
	payload, _ := json.Marshal(map[string]string{"message": message})
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, m.piRPCURL+"/pi/rpc", strings.NewReader(string(payload)))
	if err != nil {
		return nil, fmt.Errorf("build pi rpc request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pi rpc unreachable: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("pi rpc returned %d", resp.StatusCode)
	}
	return resp.Body, nil
}

func isAdmin(e *core.RequestEvent) bool {
	if e.Auth == nil {
		return false
	}
	return e.Auth.GetString("role") == "admin"
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
