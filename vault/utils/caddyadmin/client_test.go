package caddyadmin

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"
)

// Integration tests against a real Caddy admin API (in Docker).
//
// Setup:
//
//	docker run --rm -d --name caddy-dev \
//	  -v /tmp/caddy-dev/caddy.json:/tmp/caddy.json \
//	  caddy:2-alpine caddy run --config /tmp/caddy.json --resume=false
//
// Run with: CADDY_TEST=1 go test -v ./utils/caddyadmin/
//
// Note: We use the container IP directly (not localhost port mapping or
// orb.local) because OrbStack has bugs with both:
//   - Port mapping: connection reset on keepalive (orbstack/orbstack#1493)
//   - orb.local: fake-IP NAT doesn't forward non-standard ports like 2019
//
// The test auto-detects the container IP via CADDY_HOST env or falls back
// to querying Docker.

func testClient(t *testing.T) *Client {
	t.Helper()
	if os.Getenv("CADDY_TEST") == "" {
		t.Skip("set CADDY_TEST=1 to run integration tests")
	}

	// Allow override via env, otherwise auto-detect container IP
	host := os.Getenv("CADDY_HOST")
	if host == "" {
		host = detectCaddyContainerIP(t)
	}
	return NewClient("http://" + host + ":2019")
}

// detectCaddyContainerIP queries Docker for the caddy-dev container's IP.
func detectCaddyContainerIP(t *testing.T) string {
	t.Helper()
	// Try docker inspect
	cmd := exec.Command("docker", "inspect", "caddy-dev",
		"--format", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}")
	output, err := cmd.Output()
	if err != nil {
		t.Fatalf("CADDY_HOST not set and failed to detect container IP: %v", err)
	}
	ip := strings.TrimSpace(string(output))
	if ip == "" {
		t.Fatal("CADDY_HOST not set and container IP is empty")
	}
	t.Logf("detected caddy-dev container IP: %s", ip)
	return ip
}

// resetConfig replaces the Caddy config with a minimal empty config.
// This ensures each test starts from a known state.
func resetConfig(t *testing.T, c *Client) {
	t.Helper()
	// We can't use LoadConfig because replacing the entire config
	// causes Caddy to restart the admin endpoint, which drops the
	// connection. Instead, we use incremental PATCH operations
	// to set up the test state without touching the admin block.

	// First, load minimal config via /load but tolerate the connection drop.
	// Caddy restarts admin but recovers within ~100ms.
	minimal := json.RawMessage(`{
		"admin": {
			"listen": "0.0.0.0:2019",
			"origins": ["*"]
		},
		"apps": {
			"http": {
				"servers": {
					"srv0": {
						"listen": [":8888"],
						"routes": []
					}
				}
			}
		}
	}`)
	// LoadConfig may return EOF/connection-reset because Caddy restarts
	// the admin endpoint during config reload. This is expected behavior.
	// We retry with a delay.
	for i := 0; i < 3; i++ {
		err := c.LoadConfig(minimal)
		if err == nil {
			return
		}
		t.Logf("resetConfig: LoadConfig attempt %d failed (may be expected): %v", i+1, err)
		time.Sleep(500 * time.Millisecond)
	}
	t.Fatalf("resetConfig: LoadConfig failed after 3 retries")
}

func TestGetConfig(t *testing.T) {
	c := testClient(t)
	resetConfig(t, c)

	cfg, err := c.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig failed: %v", err)
	}
	if len(cfg) == 0 || string(cfg) == "null" {
		t.Fatalf("GetConfig returned empty config")
	}
	t.Logf("config: %s", cfg)
}

func TestLoadAndGetConfigPath(t *testing.T) {
	c := testClient(t)
	resetConfig(t, c)

	// Verify the server exists
	raw, err := c.GetConfigPath("apps/http/servers/srv0/listen")
	if err != nil {
		t.Fatalf("GetConfigPath failed: %v", err)
	}
	var listen []string
	if err := json.Unmarshal(raw, &listen); err != nil {
		t.Fatalf("failed to decode listen: %v", err)
	}
	if len(listen) == 0 || listen[0] != ":8888" {
		t.Fatalf("expected [\":8888\"], got %v", listen)
	}
}

// TestLoadConfigRetry verifies that LoadConfig retries past transient
// connection-level failures (EOF / connection-reset) that Caddy produces when
// it restarts its admin endpoint as part of applying a new config.
//
// This is a mock-based test (no real Caddy needed). It mirrors the behavior
// documented in client_test.go:89-99's resetConfig helper.
func TestLoadConfigRetry(t *testing.T) {
	server, state := newMockCaddy(t)
	c := NewClient(server.URL)

	// First two /load calls: simulate Caddy tearing down the connection
	// (http.ErrAbortHandler causes the server to drop the connection without
	// writing a response, which surfaces to the client as EOF/connection-reset).
	// Third call: succeed.
	state.loadHandler = func(w http.ResponseWriter, r *http.Request, call int) bool {
		if call <= 2 {
			// Draining the body isn't necessary; just abort to simulate a
			// connection drop. The client sees this as an EOF-style error
			// (the exact text contains "EOF" on most platforms).
			panic(http.ErrAbortHandler)
		}
		return false // fall through to default success handler
	}

	config := json.RawMessage(`{"apps":{"http":{"servers":{"srv0":{"listen":[":443"]}}}}}`)
	if err := c.LoadConfig(config); err != nil {
		t.Fatalf("LoadConfig should have succeeded after retries, got: %v", err)
	}
	if state.loadCallCount != 3 {
		t.Fatalf("expected 3 /load calls (2 transient + 1 success), got %d", state.loadCallCount)
	}
}

// TestLoadConfigNonRetryable verifies that LoadConfig does NOT retry on
// non-transient errors like 400 Bad Request (which indicate the config itself
// is invalid). Such errors must surface immediately.
func TestLoadConfigNonRetryable(t *testing.T) {
	server, state := newMockCaddy(t)
	c := NewClient(server.URL)

	state.loadHandler = func(w http.ResponseWriter, r *http.Request, call int) bool {
		// Always 400 — simulates a malformed config being rejected by Caddy.
		http.Error(w, "invalid config", http.StatusBadRequest)
		return true
	}

	config := json.RawMessage(`{"not valid caddy config"}`)
	err := c.LoadConfig(config)
	if err == nil {
		t.Fatal("LoadConfig should have failed for 400, got nil")
	}
	// Must surface as *APIError with the original 400 status, NOT wrapped in
	// the retry-exhausted error.
	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected *APIError (non-retryable, immediate), got %T: %v", err, err)
	}
	if apiErr.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", apiErr.StatusCode)
	}
	if state.loadCallCount != 1 {
		t.Fatalf("expected exactly 1 /load call (no retries for 4xx), got %d", state.loadCallCount)
	}
}

// TestLoadConfigRetryExhausted verifies that LoadConfig gives up after 3
// attempts and returns the last error wrapped in the retry-exhausted message.
func TestLoadConfigRetryExhausted(t *testing.T) {
	server, state := newMockCaddy(t)
	c := NewClient(server.URL)

	// Every call returns 503 (retryable 5xx).
	state.loadHandler = func(w http.ResponseWriter, r *http.Request, call int) bool {
		http.Error(w, "admin restarting", http.StatusServiceUnavailable)
		return true
	}

	err := c.LoadConfig(json.RawMessage(`{}`))
	if err == nil {
		t.Fatal("LoadConfig should have failed after 3 retries")
	}
	if state.loadCallCount != 3 {
		t.Fatalf("expected exactly 3 /load calls, got %d", state.loadCallCount)
	}
	if !strings.Contains(err.Error(), "failed after 3 retries") {
		t.Fatalf("expected retry-exhausted message, got: %v", err)
	}
}

// TestValidateConfig verifies the dry-run validate path hits
// /load?validate_only=true and does not mutate stored config.
func TestValidateConfig(t *testing.T) {
	server, state := newMockCaddy(t)
	c := NewClient(server.URL)

	// Seed an existing config so we can assert validate didn't overwrite it.
	state.config = map[string]any{"existing": true}

	config := json.RawMessage(`{"apps":{"http":{"servers":{"srv0":{"listen":[":443"]}}}}}`)
	if err := c.ValidateConfig(config); err != nil {
		t.Fatalf("ValidateConfig failed: %v", err)
	}

	if state.loadCallCount != 1 {
		t.Fatalf("expected 1 /load call, got %d", state.loadCallCount)
	}
	// validate_only must NOT replace stored config.
	if existing, ok := state.config["existing"]; !ok || existing != true {
		t.Fatalf("ValidateConfig mutated stored config: %+v", state.config)
	}
}
