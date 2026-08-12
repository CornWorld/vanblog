package caddy

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/CornWorld/caddyadmin"
)

// mkThemeClient creates a theme dir with a dist/client so buildStaticRoutes
// emits its file_server routes.
func mkThemeClient(t *testing.T, root, name string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Join(root, name, "dist", "client"), 0o755); err != nil {
		t.Fatal(err)
	}
}

// mkMergedFixture builds a temp tree that exercises every branch of
// buildStaticRoutes:
//
//	admin/client/_astro                       (admin SSR client dir exists)
//	builtin/base/dist/client/                 (builtin-only theme)
//	builtin/dup/dist/client/                  (builtin shadowed by a user copy)
//	user/dup/dist/client/                     (user dup → must win)
//	user/custom/dist/client/                  (user-only theme)
//
// It returns the merged theme names in build order (base, custom, dup).
func mkMergedFixture(t *testing.T) (opts BuildOpts, themeNames []string) {
	t.Helper()
	builtin := t.TempDir()
	user := t.TempDir()
	admin := filepath.Join(t.TempDir(), "admin")
	if err := os.MkdirAll(filepath.Join(admin, "client", "_astro"), 0o755); err != nil {
		t.Fatal(err)
	}
	mkThemeClient(t, builtin, "base")
	mkThemeClient(t, builtin, "dup")
	mkThemeClient(t, user, "dup")
	mkThemeClient(t, user, "custom")
	return BuildOpts{
			AdminDistDir:     admin,
			ThemesDir:        user,
			BuiltinThemesDir: builtin,
		},
		[]string{"base", "custom", "dup"}
}

// TestBuildStaticRoutes_MergeUserWins verifies the builtin+user merge: a user
// theme whose name collides with a builtin shadows it, and no duplicate @id
// routes are emitted (Caddy rejects duplicate @id values on load).
func TestBuildStaticRoutes_MergeUserWins(t *testing.T) {
	builtin := t.TempDir()
	user := t.TempDir()
	mkThemeClient(t, builtin, "base")
	mkThemeClient(t, builtin, "dup") // builtin dup
	mkThemeClient(t, user, "dup")    // user dup → must shadow builtin
	mkThemeClient(t, user, "custom")

	routes := buildStaticRoutes(BuildOpts{
		AdminDistDir:     filepath.Join(t.TempDir(), "no-admin"),
		ThemesDir:        user,
		BuiltinThemesDir: builtin,
	})

	// Collect theme-route client roots by @id.
	clientByID := map[string]string{}
	for _, r := range routes {
		if !strings.HasPrefix(r.ID, "vanblog-static-theme-") {
			continue
		}
		clientByID[r.ID] = r.Handle[len(r.Handle)-1].Root
	}

	// "dup" must appear exactly once as a route pair (astro + stable), not
	// doubled by the builtin copy.
	dupCount := 0
	for id := range clientByID {
		if strings.Contains(id, "theme-dup") {
			dupCount++
		}
	}
	if dupCount != 2 {
		t.Fatalf("want exactly 2 dup routes (astro + stable), got %d: %v", dupCount, clientByID)
	}
	for id, root := range clientByID {
		if !strings.Contains(id, "theme-dup") {
			continue
		}
		if !strings.HasPrefix(root, user) {
			t.Errorf("dup route %s serves the builtin dir (%s), want the user dir", id, root)
		}
	}
}

// TestBuildStaticRoutes_Full exercises the complete route table against a
// merged builtin+user fixture: the three platform admin routes plus two routes
// per merged theme, with the content-hashed _astro route preceding the broad
// stable-file route, the rewrite stripping the theme prefix, and the cache
// tiers applied.
func TestBuildStaticRoutes_Full(t *testing.T) {
	opts, themeNames := mkMergedFixture(t)
	routes := buildStaticRoutes(opts)

	if want := 3 + len(themeNames)*2; len(routes) != want {
		t.Fatalf("expected %d static routes, got %d: %+v", want, len(routes), routes)
	}

	byID := map[string]caddyadmin.Route{}
	pos := map[string]int{}
	for i, r := range routes {
		byID[r.ID] = r
		pos[r.ID] = i
	}

	// --- Admin (platform) static at root paths ---
	adminClient := filepath.Join(opts.AdminDistDir, "client")
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
		assertStaticHandle(t, r, adminClient, "", tc.cache)
	}

	// --- Theme static: merged view, _astro before broad, user shadows builtin ---
	for _, name := range themeNames {
		astroID := "vanblog-static-theme-" + name + "-astro"
		broadID := "vanblog-static-theme-" + name
		if pos[astroID] == 0 || pos[broadID] == 0 {
			t.Fatalf("theme %s routes missing: astro=%d broad=%d", name, pos[astroID], pos[broadID])
		}
		if pos[astroID] >= pos[broadID] {
			t.Errorf("theme %s: _astro route (%d) must precede broad route (%d)", name, pos[astroID], pos[broadID])
		}

		prefix := "/themes/" + name
		client := filepath.Join(opts.ThemesDir, name, "dist", "client")
		if name == "base" {
			// base exists only in the builtin root.
			client = filepath.Join(opts.BuiltinThemesDir, name, "dist", "client")
		}
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

// TestBuildStaticRoutes_SkipsNonConformingNames verifies a directory whose name
// falls outside the theme-name pattern (e.g. with Caddy path-matcher
// characters) never emits file_server routes — matching the contract the pack
// CLI, ResolveDir and the theme host enforce.
func TestBuildStaticRoutes_SkipsNonConformingNames(t *testing.T) {
	user := t.TempDir()
	mkThemeClient(t, user, "ok-theme")
	mkThemeClient(t, user, "Bad*Name") // non-conforming → must be skipped

	routes := buildStaticRoutes(BuildOpts{
		AdminDistDir:     filepath.Join(t.TempDir(), "no-admin"),
		ThemesDir:        user,
		BuiltinThemesDir: filepath.Join(t.TempDir(), "no-builtin"),
	})

	if len(routes) != 2 {
		t.Fatalf("want exactly 2 routes (ok-theme only), got %d: %+v", len(routes), routes)
	}
	for _, r := range routes {
		if strings.Contains(r.ID, "Bad") {
			t.Errorf("non-conforming theme emitted route: %s", r.ID)
		}
	}
}

func TestBuildStaticRoutes_MissingDirs(t *testing.T) {
	// No admin, no themes → no routes (fall through to Astro proxy).
	opts := BuildOpts{
		AdminDistDir:     filepath.Join(t.TempDir(), "nope"),
		ThemesDir:        filepath.Join(t.TempDir(), "nope"),
		BuiltinThemesDir: filepath.Join(t.TempDir(), "nope"),
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
	opts := BuildOpts{
		AdminDistDir:     admin,
		ThemesDir:        filepath.Join(t.TempDir(), "no-themes"),
		BuiltinThemesDir: filepath.Join(t.TempDir(), "no-builtin"),
	}
	routes := buildStaticRoutes(opts)
	if len(routes) != 3 {
		t.Fatalf("expected 3 admin routes, got %d", len(routes))
	}
}

// TestManagementServerIncludesStaticRoutes guards the :8080 recovery port: it
// must serve the same static file_server routes as the main site, otherwise
// the Astro admin's /_astro/* assets 404 in recovery mode (the theme host no
// longer serves static).
func TestManagementServerIncludesStaticRoutes(t *testing.T) {
	opts, themeNames := mkMergedFixture(t)
	srv := buildManagementServerRoutes(opts)
	if srv == nil || len(srv.Listen) != 1 || srv.Listen[0] != ":8080" {
		t.Fatalf("unexpected mgmt server: %+v", srv)
	}
	// api + _/ + 3 admin + len(themeNames)×2 static + fallback.
	want := 2 + 3 + len(themeNames)*2 + 1
	if len(srv.Routes) != want {
		t.Fatalf("expected %d routes (2 pb + static + fallback), got %d", want, len(srv.Routes))
	}
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
