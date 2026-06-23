package caddyadmin

import (
	"encoding/json"
	"os"
	"testing"
	"time"
)

// Integration tests against a real Caddy admin API.
// Start a test Caddy with: docker run --rm -d -p 2019:2019 caddy:2-alpine
//
// Run with: CADDY_TEST=1 go test -v ./utils/caddyadmin/

func testClient(t *testing.T) *Client {
	t.Helper()
	if os.Getenv("CADDY_TEST") == "" {
		t.Skip("set CADDY_TEST=1 to run integration tests")
	}
	return NewClient("http://127.0.0.1:2019")
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

func TestAddAndRemoveRoute(t *testing.T) {
	c := testClient(t)
	resetConfig(t, c)

	route := Route{
		ID: "test-proxy",
		Match: []MatchRule{{
			Path: []string{"/api/internal/*"},
		}},
		Handle: []Handler{{
			Handler:   "reverse_proxy",
			Upstreams: []Upstream{{Dial: "127.0.0.1:3000"}},
		}},
	}

	// Add route
	if err := c.AddRoute("srv0", route); err != nil {
		t.Fatalf("AddRoute failed: %v", err)
	}

	// Verify route exists by ID
	got, err := c.GetRoute("test-proxy")
	if err != nil {
		t.Fatalf("GetRoute failed: %v", err)
	}
	if got == nil {
		t.Fatal("GetRoute returned nil after AddRoute")
	}
	if len(got.Match) == 0 || len(got.Match[0].Path) == 0 || got.Match[0].Path[0] != "/api/internal/*" {
		t.Fatalf("route mismatch: %+v", got)
	}

	// List routes
	routes, err := c.GetRoutes("srv0")
	if err != nil {
		t.Fatalf("GetRoutes failed: %v", err)
	}
	if len(routes) != 1 {
		t.Fatalf("expected 1 route, got %d", len(routes))
	}

	// Remove route by ID
	if err := c.RemoveRoute("test-proxy"); err != nil {
		t.Fatalf("RemoveRoute failed: %v", err)
	}

	// Verify removed (404 is expected)
	got, err = c.GetRoute("test-proxy")
	if err == nil && got != nil {
		t.Fatal("route still exists after RemoveRoute")
	}
	// err is expected (404 APIError), that's correct behavior
}

func TestPatchConfigPath(t *testing.T) {
	c := testClient(t)
	resetConfig(t, c)

	// Patch the listen address
	if err := c.PatchConfigPath("apps/http/servers/srv0/listen", []string{":9999"}); err != nil {
		t.Fatalf("PatchConfigPath failed: %v", err)
	}

	// Verify
	raw, err := c.GetConfigPath("apps/http/servers/srv0/listen")
	if err != nil {
		t.Fatalf("GetConfigPath after patch failed: %v", err)
	}
	var listen []string
	if err := json.Unmarshal(raw, &listen); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	if len(listen) == 0 || listen[0] != ":9999" {
		t.Fatalf("expected [\":9999\"], got %v", listen)
	}
}

func TestSetHTTPRedirect(t *testing.T) {
	c := testClient(t)
	resetConfig(t, c)

	// Enable redirect
	if err := c.SetHTTPRedirect("srv0", true); err != nil {
		t.Fatalf("SetHTTPRedirect(true) failed: %v", err)
	}

	// Verify listener_wrappers exists
	raw, err := c.GetConfigPath("apps/http/servers/srv0/listener_wrappers")
	if err != nil {
		t.Fatalf("GetConfigPath(listener_wrappers) failed: %v", err)
	}
	t.Logf("listener_wrappers after enable: %s", raw)

	// Disable redirect
	if err := c.SetHTTPRedirect("srv0", false); err != nil {
		t.Fatalf("SetHTTPRedirect(false) failed: %v", err)
	}

	// Verify listener_wrappers removed (should error or return null)
	raw, err = c.GetConfigPath("apps/http/servers/srv0/listener_wrappers")
	if err != nil {
		// 404 is expected when the path doesn't exist
		t.Logf("expected error after disable: %v", err)
	} else {
		t.Logf("listener_wrappers after disable: %s (should be null/empty)", raw)
	}
}

func TestTLSSubjects(t *testing.T) {
	c := testClient(t)
	resetConfig(t, c)

	// Load a config with TLS automation (preserve admin block)
	tlsConfig := json.RawMessage(`{
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
			},
			"tls": {
				"automation": {
					"policies": [
						{"subjects": []}
					]
				}
			}
		}
	}`)
	if err := c.LoadConfig(tlsConfig); err != nil {
		t.Fatalf("LoadConfig with TLS failed: %v", err)
	}

	// Update subjects
	domains := []string{"example.com", "blog.example.com"}
	if err := c.UpdateTLSSubjects(domains); err != nil {
		t.Fatalf("UpdateTLSSubjects failed: %v", err)
	}

	// Verify
	got, err := c.GetTLSSubjects()
	if err != nil {
		t.Fatalf("GetTLSSubjects failed: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 subjects, got %d: %v", len(got), got)
	}
}
