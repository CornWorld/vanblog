package caddyadmin

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Mock Caddy admin API for unit testing.
// We don't test against real Caddy because macOS Docker networking
// has compatibility issues with Go's net/http TCP behavior.
// Integration tests are in client_test.go (behind CADDY_TEST=1 flag).

func newMockCaddy(t *testing.T) (*httptest.Server, *mockState) {
	t.Helper()
	state := &mockState{}
	mux := http.NewServeMux()
	registerMockHandlers(mux, state)
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server, state
}

type mockState struct {
	config  map[string]any
	subjects []string
	listen  []string
	listenerWrappers []map[string]string

	// loadHandler, if non-nil, overrides the default /load handler.
	// It receives the request and a call counter (1-based); tests use this to
	// simulate transient failures (EOF / connection-reset / 5xx) on the first
	// N calls before succeeding. Returning true means "handled, response
	// already written"; returning false means "fall through to default
	// /load behavior".
	loadHandler   func(w http.ResponseWriter, r *http.Request, call int) bool
	loadCallCount int
}

func registerMockHandlers(mux *http.ServeMux, s *mockState) {
	// GET /config
	mux.HandleFunc("/config", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(s.config)
	})

	// POST /load (also matches /load?validate_only=true via prefix)
	mux.HandleFunc("/load", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		s.loadCallCount++
		if s.loadHandler != nil {
			if s.loadHandler(w, r, s.loadCallCount) {
				return
			}
		}
		body, _ := io.ReadAll(r.Body)
		var cfg map[string]any
		if err := json.Unmarshal(body, &cfg); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		// validate_only requests must NOT mutate stored config.
		if r.URL.Query().Get("validate_only") != "true" {
			s.config = cfg
			s.subjects = nil
			s.listen = []string{}
			s.listenerWrappers = nil
		}
		w.WriteHeader(http.StatusOK)
	})
}

func TestMockGetConfig(t *testing.T) {
	server, state := newMockCaddy(t)
	state.config = map[string]any{"admin": map[string]string{"listen": "0.0.0.0:2019"}}

	c := NewClient(server.URL)
	cfg, err := c.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig failed: %v", err)
	}
	if len(cfg) == 0 {
		t.Fatal("GetConfig returned empty")
	}
	t.Logf("config: %s", cfg)
}

func TestMockLoadConfig(t *testing.T) {
	server, state := newMockCaddy(t)
	c := NewClient(server.URL)

	config := json.RawMessage(`{"apps":{"http":{"servers":{"srv0":{"listen":[":8888"],"routes":[]}}}}}`)
	if err := c.LoadConfig(config); err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}

	if state.config == nil {
		t.Fatal("config not set after LoadConfig")
	}
	// Verify the config was stored
	cfg, _ := c.GetConfig()
	t.Logf("after load: %s", cfg)
}

func TestClientBaseURL(t *testing.T) {
	// Verify trailing slash is trimmed
	c := NewClient("http://localhost:2019/")
	if c.baseURL != "http://localhost:2019" {
		t.Fatalf("expected http://localhost:2019, got %s", c.baseURL)
	}
}

func TestRouteJSON(t *testing.T) {
	r := Route{
		ID: "my-route",
		Match: []MatchRule{{
			Path: []string{"/api/*"},
		}},
		Handle: []Handler{{
			Handler:   "reverse_proxy",
			Upstreams: []Upstream{{Dial: "127.0.0.1:3000"}},
		}},
	}

	data, err := json.Marshal(r)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	// Verify @id field
	var m map[string]any
	json.Unmarshal(data, &m)
	if m["@id"] != "my-route" {
		t.Fatalf("expected @id=my-route, got %v", m["@id"])
	}

	// Round-trip
	var r2 Route
	json.Unmarshal(data, &r2)
	if r2.ID != "my-route" {
		t.Fatalf("round-trip ID mismatch: %s", r2.ID)
	}
	if len(r2.Handle) != 1 || r2.Handle[0].Handler != "reverse_proxy" {
		t.Fatalf("round-trip handler mismatch: %+v", r2.Handle)
	}
}
