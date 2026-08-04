package caddy

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// withFastDebounce shrinks ThemeWatchDebounce so tests don't wait 2s per resync.
func withFastDebounce(t *testing.T) {
	t.Helper()
	saved := ThemeWatchDebounce
	ThemeWatchDebounce = 50 * time.Millisecond
	t.Cleanup(func() { ThemeWatchDebounce = saved })
}

// withThemesDir points VANBLOG_THEMES_DIR at a fresh temp dir for the test.
func withThemesDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	old, had := os.LookupEnv("VANBLOG_THEMES_DIR")
	os.Setenv("VANBLOG_THEMES_DIR", dir)
	t.Cleanup(func() {
		if had {
			os.Setenv("VANBLOG_THEMES_DIR", old)
		} else {
			os.Unsetenv("VANBLOG_THEMES_DIR")
		}
	})
	return dir
}

// waitFor polls cond until it returns true or the timeout elapses.
func waitFor(t *testing.T, timeout time.Duration, cond func() bool) bool {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return true
		}
		time.Sleep(20 * time.Millisecond)
	}
	return false
}

// configContainsRoute reports whether the most recent /load body pushed to the
// mock Caddy contains a route with the given ID (e.g. "vanblog-static-theme-x").
func configContainsRoute(m *mockAdmin, routeID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.lastConfig) == 0 {
		return false
	}
	var cfg map[string]any
	if err := json.Unmarshal(m.lastConfig, &cfg); err != nil {
		return false
	}
	apps, _ := cfg["apps"].(map[string]any)
	httpApp, _ := apps["http"].(map[string]any)
	servers, _ := httpApp["servers"].(map[string]any)
	for _, srv := range servers {
		srvMap, _ := srv.(map[string]any)
		routes, _ := srvMap["routes"].([]any)
		for _, r := range routes {
			route, _ := r.(map[string]any)
			// caddyadmin marshals the stable route ID as "@id" (Caddy's key).
			if route["@id"] == routeID {
				return true
			}
		}
	}
	return false
}

// writeThemeDir creates a theme folder with a built dist/client (the shape
// buildStaticRoutes keys on).
func writeThemeDir(root, name string) {
	_ = os.MkdirAll(filepath.Join(root, name, "dist", "client"), 0o755)
}

// newWatchTest wires a Service with a running actor worker + theme watcher on a
// temp themes dir. Cleanup via t.Cleanup.
func newWatchTest(t *testing.T) (*Service, *mockAdmin, string) {
	withFastBackoffs(t)
	withFastDebounce(t)
	themesDir := withThemesDir(t)
	app := setupApp(t)
	srv, m := newMockCaddyAdmin(t, 0)
	svc := &Service{
		app:           app,
		caddyAdminURL: srv.URL,
		syncCh:        make(chan syncRequest),
		done:          make(chan struct{}),
	}
	go svc.runSyncWorker()
	t.Cleanup(svc.Close)
	tw := startThemeWatcher(svc)
	if tw == nil {
		t.Fatal("theme watcher should start with a valid themes dir")
	}
	t.Cleanup(tw.Close)
	return svc, m, themesDir
}

func TestThemeWatcher_AddThemeTriggersResync(t *testing.T) {
	_, m, themesDir := newWatchTest(t)

	// Baseline: add alpha → watcher auto-resyncs and its route appears.
	writeThemeDir(themesDir, "alpha")
	if !waitFor(t, 5*time.Second, func() bool {
		return configContainsRoute(m, "vanblog-static-theme-alpha")
	}) {
		t.Fatal("new theme alpha route not resynced into Caddy config")
	}

	// Add beta → its route appears without any manual reload.
	writeThemeDir(themesDir, "beta")
	if !waitFor(t, 5*time.Second, func() bool {
		return configContainsRoute(m, "vanblog-static-theme-beta")
	}) {
		t.Fatal("new theme beta route not resynced into Caddy config")
	}
}

func TestThemeWatcher_RemoveThemeTriggersResync(t *testing.T) {
	_, m, themesDir := newWatchTest(t)

	writeThemeDir(themesDir, "alpha")
	if !waitFor(t, 5*time.Second, func() bool {
		return configContainsRoute(m, "vanblog-static-theme-alpha")
	}) {
		t.Fatal("baseline alpha route missing")
	}

	// Remove it → the route is dropped from the pushed config.
	if err := os.RemoveAll(filepath.Join(themesDir, "alpha")); err != nil {
		t.Fatalf("remove theme: %v", err)
	}
	if !waitFor(t, 5*time.Second, func() bool {
		return !configContainsRoute(m, "vanblog-static-theme-alpha")
	}) {
		t.Fatal("removed theme alpha route still present after resync")
	}
}

func TestThemeWatcher_BurstSettlesWithAllThemes(t *testing.T) {
	_, m, themesDir := newWatchTest(t)

	// A rapid burst of theme installs must all end up in the pushed config
	// (debounced, not one resync per file event).
	for i := 0; i < 5; i++ {
		writeThemeDir(themesDir, fmt.Sprintf("t%d", i))
	}
	ok := waitFor(t, 5*time.Second, func() bool {
		for i := 0; i < 5; i++ {
			if !configContainsRoute(m, fmt.Sprintf("vanblog-static-theme-t%d", i)) {
				return false
			}
		}
		return true
	})
	if !ok {
		t.Fatal("not all burst themes made it into the Caddy config")
	}
}

func TestThemeWatcher_DisabledWhenThemesDirMissing(t *testing.T) {
	app := setupApp(t)
	svc := &Service{app: app}
	// Point the env at a nonexistent dir; startThemeWatcher must return nil
	// rather than crash.
	t.Setenv("VANBLOG_THEMES_DIR", filepath.Join(t.TempDir(), "does-not-exist"))
	if tw := startThemeWatcher(svc); tw != nil {
		tw.Close()
		t.Fatal("expected nil watcher for a missing themes dir")
	}
}

func TestThemeWatcher_CloseStopsResyncs(t *testing.T) {
	withFastBackoffs(t)
	withFastDebounce(t)
	themesDir := withThemesDir(t)
	app := setupApp(t)
	srv, m := newMockCaddyAdmin(t, 0)
	svc := &Service{
		app:           app,
		caddyAdminURL: srv.URL,
		syncCh:        make(chan syncRequest),
		done:          make(chan struct{}),
	}
	go svc.runSyncWorker()
	t.Cleanup(svc.Close)

	tw := startThemeWatcher(svc)
	if tw == nil {
		t.Fatal("watcher should start")
	}

	writeThemeDir(themesDir, "alpha")
	if !waitFor(t, 5*time.Second, func() bool {
		return configContainsRoute(m, "vanblog-static-theme-alpha")
	}) {
		t.Fatal("baseline alpha route missing")
	}

	// Closing the watcher stops auto-resyncs.
	tw.Close()
	time.Sleep(150 * time.Millisecond) // drain any in-flight debounce

	// A later theme change must NOT be pushed (Close is idempotent).
	writeThemeDir(themesDir, "beta")
	time.Sleep(300 * time.Millisecond)
	if configContainsRoute(m, "vanblog-static-theme-beta") {
		t.Fatal("watcher kept resyncing after Close")
	}
}

func TestThemeWatcher_StagedInstallSettlesWithRoute(t *testing.T) {
	_, m, themesDir := newWatchTest(t)

	// Stage 1: theme dir exists but has no dist/client yet (mid-install).
	_ = os.MkdirAll(filepath.Join(themesDir, "staged"), 0o755)
	if !waitFor(t, 5*time.Second, func() bool {
		m.mu.Lock()
		calls := m.loadCalls
		m.mu.Unlock()
		return calls > 0 // a resync happened, so "no route" below is meaningful
	}) {
		t.Fatal("no resync after creating a bare theme dir")
	}
	if configContainsRoute(m, "vanblog-static-theme-staged") {
		t.Fatal("route emitted before dist/client existed")
	}

	// Stage 2: dist/client appears → the watcher (reconcile + resync) picks it
	// up and the route appears. This is the realistic staged-install path.
	_ = os.MkdirAll(filepath.Join(themesDir, "staged", "dist", "client"), 0o755)
	if !waitFor(t, 5*time.Second, func() bool {
		return configContainsRoute(m, "vanblog-static-theme-staged")
	}) {
		t.Fatal("route not emitted after dist/client appeared in a later stage")
	}
}

func TestThemeWatcher_NonThemeDirIgnored(t *testing.T) {
	_, m, themesDir := newWatchTest(t)

	// A stray subdir without dist/ is not a theme — must never emit a route.
	_ = os.MkdirAll(filepath.Join(themesDir, "notes"), 0o755)
	if !waitFor(t, 5*time.Second, func() bool {
		m.mu.Lock()
		calls := m.loadCalls
		m.mu.Unlock()
		return calls > 0
	}) {
		t.Fatal("no resync after creating a stray dir")
	}
	if configContainsRoute(m, "vanblog-static-theme-notes") {
		t.Fatal("non-theme directory emitted a static route")
	}
}
