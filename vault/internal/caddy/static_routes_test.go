package caddy

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/CornWorld/caddyadmin"
)

// mkStaticFixture builds a temp tree:
//
//	tmp/admin/client/_astro            (admin client dir exists)
//	tmp/themes/base/dist/client/
//	tmp/themes/vanblog/dist/client/
func mkStaticFixture(t *testing.T) (opts BuildOpts) {
	t.Helper()
	admin := filepath.Join(t.TempDir(), "admin")
	themes := filepath.Join(t.TempDir(), "themes")
	dirs := []string{
		filepath.Join(admin, "client", "_astro"),
		filepath.Join(themes, "base", "dist", "client"),
		filepath.Join(themes, "vanblog", "dist", "client"),
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	return BuildOpts{AdminDistDir: admin, ThemesDir: themes}
}

func TestBuildStaticRoutes_Full(t *testing.T) {
	opts := mkStaticFixture(t)
	routes := buildStaticRoutes(opts)

	// Admin 3 + theme 2×2 = 7 routes.
	if len(routes) != 7 {
		t.Fatalf("expected 7 static routes, got %d: %+v", len(routes), routes)
	}

	byID := map[string]caddyadmin.Route{}
	for _, r := range routes {
		byID[r.ID] = r
	}

	// --- Admin (platform) static at root paths ---
	for _, tc := range []struct {
		id, path, cache string
	}{
		{"vanblog-static-admin-astro", "/_astro/*", CacheImmutable},
		{"vanblog-static-admin-emoji", "/emoji-data.json", CacheStable},
		{"vanblog-static-admin-robots", "/robots.txt", CacheStable},
	} {
		r := byID[tc.id]
		if len(r.Match) != 1 || len(r.Match[0].Path) != 1 || r.Match[0].Path[0] != tc.path {
			t.Errorf("%s: expected match %s, got %+v", tc.id, tc.path, r.Match)
		}
		// Admin URLs map 1:1 onto the client dir → no rewrite handler.
		assertStaticHandle(t, r, filepath.Join(opts.AdminDistDir, "client"), "", tc.cache)
	}

	// --- Theme static: _astro route MUST come before the broad route ---
	for _, name := range []string{"base", "vanblog"} {
		astroID := "vanblog-static-theme-" + name + "-astro"
		broadID := "vanblog-static-theme-" + name
		astroPos, broadPos := -1, -1
		for i, r := range routes {
			switch r.ID {
			case astroID:
				astroPos = i
			case broadID:
				broadPos = i
			}
		}
		if astroPos == -1 || broadPos == -1 {
			t.Fatalf("theme %s routes missing: astro=%d broad=%d", name, astroPos, broadPos)
		}
		if astroPos >= broadPos {
			t.Errorf("theme %s: _astro route (%d) must precede broad route (%d)", name, astroPos, broadPos)
		}

		client := filepath.Join(opts.ThemesDir, name, "dist", "client")
		prefix := "/themes/" + name
		// Theme URLs carry the /themes/<name> prefix → a rewrite strips it.
		assertStaticHandle(t, byID[astroID], client, prefix, CacheImmutable)
		assertStaticHandle(t, byID[broadID], client, prefix, CacheStable)

		// The broad route must match the whole theme prefix so theme public/
		// files (e.g. /themes/base/favicon.ico) are served.
		if got := byID[broadID].Match[0].Path[0]; got != prefix+"/*" {
			t.Errorf("theme %s broad route: expected %s/*, got %s", name, prefix, got)
		}
	}
}

func TestBuildStaticRoutes_MissingDirs(t *testing.T) {
	// No admin, no themes → no routes (fall through to Astro proxy).
	opts := BuildOpts{
		AdminDistDir: filepath.Join(t.TempDir(), "nope"),
		ThemesDir:    filepath.Join(t.TempDir(), "nope"),
	}
	if routes := buildStaticRoutes(opts); len(routes) != 0 {
		t.Fatalf("expected no static routes when dirs are missing, got %d", len(routes))
	}
}

func TestBuildStaticRoutes_AdminOnly(t *testing.T) {
	admin := filepath.Join(t.TempDir(), "admin")
	if err := os.MkdirAll(filepath.Join(admin, "client"), 0o755); err != nil {
		t.Fatal(err)
	}
	opts := BuildOpts{AdminDistDir: admin, ThemesDir: filepath.Join(t.TempDir(), "no-themes")}
	routes := buildStaticRoutes(opts)
	if len(routes) != 3 {
		t.Fatalf("expected 3 admin routes, got %d", len(routes))
	}
}

// TestManagementServerIncludesStaticRoutes guards the :8080 recovery port: it
// must serve the same static file_server routes as the main site, otherwise
// the Astro admin's /_astro/* assets 404 in recovery mode (the dispatcher no
// longer serves static).
func TestManagementServerIncludesStaticRoutes(t *testing.T) {
	opts := mkStaticFixture(t)
	srv := buildManagementServerRoutes(opts)
	if srv == nil || len(srv.Listen) != 1 || srv.Listen[0] != ":8080" {
		t.Fatalf("unexpected mgmt server: %+v", srv)
	}
	// api + _/ + 7 static (admin 3 + theme 2×2) + fallback = 10.
	if len(srv.Routes) != 10 {
		t.Fatalf("expected 10 routes (2 pb + 7 static + fallback), got %d", len(srv.Routes))
	}
	// A static route is present and the fallback stays last.
	found := false
	for i, r := range srv.Routes {
		if r.ID == "vanblog-static-admin-astro" {
			found = true
		}
		if i == len(srv.Routes)-1 && (len(r.Handle) == 0 || r.Handle[0].Handler != "reverse_proxy") {
			t.Errorf("last mgmt route should be the Astro fallback, got %+v", r)
		}
	}
	if !found {
		t.Error("srv_mgmt is missing the admin static (file_server) route")
	}
}

// TestStaticRouteJSON pins the exact Caddy admin-API JSON a static route must
// produce: a non-terminal `headers` handler setting Cache-Control, a non-terminal
// `rewrite` handler stripping the theme prefix, then the terminal `file_server`
// handler with root.
func TestStaticRouteJSON(t *testing.T) {
	r := staticFileRoute("r1", "/themes/base/_astro/*", "/var/lib/vanblog/themes/base/dist/client", "/themes/base", CacheImmutable)
	b, err := json.Marshal(r)
	if err != nil {
		t.Fatal(err)
	}
	want := `{"@id":"r1","match":[{"path":["/themes/base/_astro/*"]}],"handle":[{"handler":"headers","response":{"set":{"Cache-Control":["public, max-age=31536000, immutable"]}}},{"handler":"rewrite","strip_path_prefix":"/themes/base"},{"handler":"file_server","root":"/var/lib/vanblog/themes/base/dist/client"}]}`
	if string(b) != want {
		t.Fatalf("mismatch:\ngot:  %s\nwant: %s", b, want)
	}
}

// --- helpers -------------------------------------------------------------

func assertStaticHandle(t *testing.T, r caddyadmin.Route, root, strip, cache string) {
	t.Helper()
	// headers (+ rewrite when strip is set) + file_server.
	want := 2
	if strip != "" {
		want = 3
	}
	if len(r.Handle) != want {
		t.Fatalf("route %s: expected %d handlers, got %d", r.ID, want, len(r.Handle))
	}
	h0 := r.Handle[0]
	if h0.Handler != "headers" {
		t.Errorf("route %s: handler[0] should be headers, got %s", r.ID, h0.Handler)
	}
	if h0.Headers == nil || h0.Headers.Response == nil {
		t.Fatalf("route %s: headers handler missing response policy", r.ID)
	}
	if got := h0.Headers.Response.Set["Cache-Control"]; len(got) != 1 || got[0] != cache {
		t.Errorf("route %s: expected Cache-Control=%q, got %v", r.ID, cache, got)
	}
	if strip != "" {
		mid := r.Handle[1]
		if mid.Handler != "rewrite" {
			t.Errorf("route %s: handler[1] should be rewrite, got %s", r.ID, mid.Handler)
		}
		if mid.StripPathPrefix != strip {
			t.Errorf("route %s: rewrite strip_path_prefix expected %q, got %q", r.ID, strip, mid.StripPathPrefix)
		}
	}
	last := r.Handle[len(r.Handle)-1]
	if last.Handler != "file_server" {
		t.Errorf("route %s: last handler should be file_server, got %s", r.ID, last.Handler)
	}
	if last.Root != root {
		t.Errorf("route %s: expected root %q, got %q", r.ID, root, last.Root)
	}
	if last.StripPathPrefix != "" {
		t.Errorf("route %s: file_server must not carry strip_path_prefix (it lives on rewrite now)", r.ID)
	}
}
