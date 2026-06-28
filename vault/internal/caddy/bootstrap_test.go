package caddy

// bootstrap_test.go covers Phase 4 additions:
//   - LogEntry marshals to Caddy's canonical object form (writer is an
//     object, not a string) — TestLogEntryMarshal / TestBootstrapConfigWriterIsObject.
//   - BootstrapSync retries the whole pipeline on transient failure and
//     eventually succeeds — TestBootstrapSyncRetries.
//   - BootstrapSync returns an error mentioning "N retries" when every
//     attempt fails, AND persists the error to site.caddyLastError —
//     TestBootstrapSyncAllFail.
//   - BootstrapSync clears site.caddyLastError on success —
//     TestBootstrapSyncClearsLastError.
//
// We swap bootstrapBackoffs for tiny values during tests so the full retry
// loop runs in milliseconds. We run BootstrapSync against an in-process mock
// of the Caddy admin API (no real Caddy required) and a real PocketBase
// (via pocketbase.NewWithConfig + migrations, same pattern as hooks_test.go).

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/cornworld/vanblog/utils/caddyadmin"
	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// --- LogEntry marshaling (Phase 4 P1 fix) ---

func TestLogEntryMarshal(t *testing.T) {
	e := caddyadmin.LogEntry{
		Writer: &caddyadmin.LogWriter{
			Output:   "file",
			Filename: "/var/log/caddy.log",
		},
		Level: "WARN",
	}

	data, err := json.Marshal(&e)
	if err != nil {
		t.Fatalf("marshal LogEntry: %v", err)
	}
	got := string(data)
	t.Logf("marshaled LogEntry: %s", got)

	// Caddy's canonical form: writer is an object, level is uppercase.
	for _, want := range []string{
		`"writer":{"output":"file","filename":"/var/log/caddy.log"}`,
		`"level":"WARN"`,
	} {
		if !strings.Contains(got, want) {
			t.Errorf("LogEntry JSON missing %q", want)
		}
	}

	// Regressions that would make Caddy reject the config.
	for _, bad := range []string{
		`"writer":"file`,          // string-form writer (pre-Phase-4)
		`"output":"file /var/log`, // bare top-level output (pre-Phase-4)
		`"level":"warn"`,          // lowercase level
	} {
		if strings.Contains(got, bad) {
			t.Errorf("LogEntry JSON: regression — found forbidden substring %q", bad)
		}
	}

	// Round-trip: writer decodes back as an object.
	var back caddyadmin.LogEntry
	if err := json.Unmarshal(data, &back); err != nil {
		t.Fatalf("round-trip unmarshal: %v", err)
	}
	if back.Writer == nil || back.Writer.Output != "file" || back.Writer.Filename != "/var/log/caddy.log" {
		t.Errorf("round-trip writer mismatch: %+v", back.Writer)
	}
	if back.Level != "WARN" {
		t.Errorf("round-trip level mismatch: %q", back.Level)
	}
}

// --- BootstrapSync retry tests ---

// setupApp bootstraps an in-process PocketBase with all vanblog migrations
// applied (same pattern as hooks_test.go). The temp data dir is cleaned up
// via t.Cleanup.
func setupApp(t *testing.T) core.App {
	t.Helper()
	tmpDir, err := os.MkdirTemp("", "pb-caddy-bootstrap-test")
	if err != nil {
		t.Fatalf("MkdirTemp: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("RunAppMigrations: %v", err)
	}
	return app
}

// withFastBackoffs swaps bootstrapBackoffs for tiny values so tests don't
// wait seconds-per-retry. Restored via t.Cleanup.
func withFastBackoffs(t *testing.T) {
	t.Helper()
	saved := bootstrapBackoffs
	bootstrapBackoffs = []time.Duration{
		1 * time.Millisecond,
		2 * time.Millisecond,
		4 * time.Millisecond,
		8 * time.Millisecond,
		16 * time.Millisecond,
	}
	t.Cleanup(func() { bootstrapBackoffs = saved })
}

// mockAdmin is a minimal Caddy admin API for BootstrapSync tests.
type mockAdmin struct {
	mu                   sync.Mutex
	loadFailuresRemaining int // number of /load (non-validate) calls left to fail
	loadCalls            int // counts non-validate /load calls
}

func newMockCaddyAdmin(t *testing.T, failLoad int) (*httptest.Server, *mockAdmin) {
	t.Helper()
	m := &mockAdmin{loadFailuresRemaining: failLoad}
	mux := http.NewServeMux()

	mux.HandleFunc("/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"admin":{"listen":"127.0.0.1:2019"}}`)
	})

	mux.HandleFunc("/load", func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		if r.URL.Query().Get("validate_only") == "true" {
			w.WriteHeader(http.StatusOK)
			return
		}
		m.mu.Lock()
		m.loadCalls++
		fail := m.loadFailuresRemaining > 0
		if fail {
			m.loadFailuresRemaining--
		}
		m.mu.Unlock()

		if fail {
			// 503 is retryable per caddyadmin.isRetryableLoadError, so the
			// *inner* client.LoadConfig also retries. Combined with the
			// outer BootstrapSync loop this tests both layers.
			http.Error(w, "admin restarting", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, m
}

// readCaddyLastError reads site.caddyLastError from the single site row.
// Returns empty string if no site row exists.
func readCaddyLastError(t *testing.T, app core.App) string {
	t.Helper()
	site, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || site == nil {
		return ""
	}
	return site.GetString("caddyLastError")
}

func TestBootstrapSyncRetries(t *testing.T) {
	withFastBackoffs(t)
	app := setupApp(t)

	// 5 transient /load failures: the inner client.LoadConfig retries 3×
	// per outer attempt, and the outer BootstrapSync loop runs up to
	// 6 attempts (1 + 5 retries). After 5 /load failures the 6th /load
	// call succeeds, so BootstrapSync should return nil.
	srv, m := newMockCaddyAdmin(t, 5)

	err := BootstrapSync(app, srv.URL)
	if err != nil {
		t.Fatalf("BootstrapSync should have succeeded after retries, got: %v", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.loadCalls < 6 {
		t.Errorf("expected at least 6 /load calls (5 failed + 1 success), got %d", m.loadCalls)
	}

	// Success path must clear caddyLastError.
	if got := readCaddyLastError(t, app); got != "" {
		t.Errorf("caddyLastError should be cleared on success, got %q", got)
	}
}

func TestBootstrapSyncAllFail(t *testing.T) {
	withFastBackoffs(t)
	app := setupApp(t)

	// More failures than the inner (3) × outer (6) retries can consume.
	srv, m := newMockCaddyAdmin(t, 1000)

	err := BootstrapSync(app, srv.URL)
	if err == nil {
		t.Fatal("BootstrapSync should have failed after exhausting retries")
	}
	if !strings.Contains(err.Error(), "failed after 5 retries") {
		t.Errorf("expected 'failed after 5 retries' in error, got: %v", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.loadCalls == 0 {
		t.Errorf("expected at least one /load call, got 0")
	}

	// On total failure the last error must be persisted to site.caddyLastError
	// so the admin UI can surface it. The persisted value is the inner error
	// (without the "failed after N retries" wrapper).
	got := readCaddyLastError(t, app)
	if got == "" {
		t.Errorf("caddyLastError should be populated after total failure, got empty")
	}
	if !strings.Contains(got, "LoadConfig failed") && !strings.Contains(got, "failed") {
		t.Errorf("caddyLastError should describe the failure, got %q", got)
	}
}

func TestBootstrapSyncClearsLastError(t *testing.T) {
	// Seed a stale error, then run a successful BootstrapSync and verify
	// the field is cleared.
	withFastBackoffs(t)
	app := setupApp(t)

	site, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || site == nil {
		t.Fatalf("no site row: %v", err)
	}
	site.Set("caddyLastError", "stale error from a previous failed boot")
	if err := app.Save(site); err != nil {
		t.Fatalf("seed caddyLastError: %v", err)
	}
	if got := readCaddyLastError(t, app); got == "" {
		t.Fatalf("seed failed: caddyLastError still empty")
	}

	// 0 failures → first /load succeeds.
	srv, _ := newMockCaddyAdmin(t, 0)
	if err := BootstrapSync(app, srv.URL); err != nil {
		t.Fatalf("BootstrapSync: %v", err)
	}

	if got := readCaddyLastError(t, app); got != "" {
		t.Errorf("caddyLastError should be cleared on successful bootstrap, got %q", got)
	}
}
