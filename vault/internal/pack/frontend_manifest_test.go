package pack

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writePack(t *testing.T, root, name, packJSON string, files map[string]string) {
	t.Helper()
	dir := filepath.Join(root, name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "pack.json"), []byte(packJSON), 0o644); err != nil {
		t.Fatal(err)
	}
	for rel, content := range files {
		full := filepath.Join(dir, rel)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func TestBuildFrontendManifest_MergesAndNormalizes(t *testing.T) {
	builtin := t.TempDir()
	local := t.TempDir()

	writePack(t, builtin, "alpha", `{"name":"alpha","version":"1.0.0","title":"甲","nav":{"label":"甲页","href":"https://evil.example"},"frontend":{"scope":"public","styles":["style.css"],"scripts":["main.js"]}}`, map[string]string{
		"frontend/style.css": "a{}",
		"frontend/main.js":   "1",
	})
	// Builtin shadowed by a user pack of the same name (user wins).
	writePack(t, builtin, "shadow", `{"name":"shadow","version":"1.0.0"}`, nil)
	writePack(t, local, "shadow", `{"name":"shadow","version":"9.9.9","nav":{"label":"用户版"}}`, nil)
	// Broken pack.json: skipped, must not poison the manifest.
	writePack(t, local, "broken", `{"name":"broken","version":"1.0.0","nope":1}`, nil)
	// Contribution referencing a missing file: URL dropped.
	writePack(t, local, "ghostfile", `{"name":"ghostfile","version":"1.0.0","frontend":{"scope":"public","styles":["missing.css"]}}`, nil)
	// Directory name must match pack.json name.
	writePack(t, local, "mismatch", `{"name":"other","version":"1.0.0"}`, nil)

	m := BuildFrontendManifest(builtin, local)

	var names []string
	for _, p := range m.Packs {
		names = append(names, p.Name)
	}
	if len(names) != 3 {
		t.Fatalf("packs = %v, want 3 entries (alpha, ghostfile, shadow)", names)
	}

	var byName = map[string]FrontendPack{}
	for _, p := range m.Packs {
		byName[p.Name] = p
	}
	if got := byName["shadow"].Version; got != "9.9.9" {
		t.Errorf("user override lost: shadow version = %q", got)
	}
	if got := byName["alpha"].Nav.Href; got != "/p/alpha" {
		t.Errorf("nav href not normalized to /p/<name>: %q", got)
	}
	if got := byName["shadow"].Nav.Label; got != "用户版" {
		t.Errorf("nav label = %q", got)
	}
	if got := byName["ghostfile"].Nav; got != nil {
		t.Errorf("ghostfile should have no nav, got %+v", got)
	}

	if len(m.Contributions) != 1 || m.Contributions[0].Name != "alpha" {
		t.Fatalf("contributions = %+v", m.Contributions)
	}
	c := m.Contributions[0]
	if len(c.Styles) != 1 || c.Styles[0] != "/pack-static/alpha/style.css" {
		t.Errorf("styles = %v", c.Styles)
	}
	if len(c.Scripts) != 1 || c.Scripts[0] != "/pack-static/alpha/main.js" {
		t.Errorf("scripts = %v", c.Scripts)
	}
}

func TestBuildFrontendManifest_TraversalRejected(t *testing.T) {
	root := t.TempDir()
	writePack(t, root, "evil", `{"name":"evil","version":"1.0.0","frontend":{"scope":"public","styles":["../../secrets.css","/abs.css","a/../ok.css"],"scripts":["b\\c.js"]}}`, map[string]string{
		"frontend/ok.css": "x",
	})
	m := BuildFrontendManifest(root, "")
	if len(m.Contributions) != 1 {
		t.Fatalf("contribution dropped entirely: %+v", m.Contributions)
	}
	if len(m.Contributions[0].Styles) != 1 || m.Contributions[0].Styles[0] != "/pack-static/evil/ok.css" {
		t.Errorf("styles = %v, want only ok.css", m.Contributions[0].Styles)
	}
	if len(m.Contributions[0].Scripts) != 0 {
		t.Errorf("scripts = %v, want none (backslash rejected)", m.Contributions[0].Scripts)
	}
}

func TestOpenPackStaticFile_UserWinsAndGuards(t *testing.T) {
	builtin := t.TempDir()
	local := t.TempDir()
	writePack(t, builtin, "p", `{"name":"p","version":"1.0.0"}`, map[string]string{"frontend/w.js": "builtin"})
	writePack(t, local, "p", `{"name":"p","version":"1.0.0"}`, map[string]string{"frontend/w.js": "user"})
	// Symlink in user pack must be skipped, not followed.
	if err := os.Symlink(filepath.Join(builtin, "p", "frontend", "w.js"), filepath.Join(local, "p", "frontend", "link.js")); err != nil {
		t.Skip("symlinks unavailable")
	}

	f, _, err := openPackStaticFile(builtin, local, "/pack-static/p/w.js")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	buf := make([]byte, 16)
	n, _ := f.Read(buf)
	if string(buf[:n]) != "user" {
		t.Errorf("user-wins not honored, served %q", buf[:n])
	}

	if _, _, err := openPackStaticFile(builtin, local, "/pack-static/p/link.js"); err == nil {
		t.Error("symlink must be rejected")
	}
	for _, bad := range []string{
		"/pack-static/p/../p/frontend/w.js",
		"/pack-static/../etc/passwd",
		"/pack-static/p/frontend/../../w.js",
		"/pack-static/p",
	} {
		if _, _, err := openPackStaticFile(builtin, local, bad); err == nil {
			t.Errorf("traversal %q must fail", bad)
		}
	}
	if _, _, err := openPackStaticFile(builtin, local, "/pack-static/missing/x.js"); err == nil {
		t.Error("missing pack must 404")
	}
}

func TestServePackStaticETagRevalidation(t *testing.T) {
	builtin := t.TempDir()
	writePack(t, builtin, "p", `{"name":"p","version":"1.0.0"}`, map[string]string{"frontend/s.css": "body{}"})

	get := func(header string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/pack-static/p/s.css", nil)
		if header != "" {
			req.Header.Set("If-None-Match", header)
		}
		rec := httptest.NewRecorder()
		if err := ServePackStatic(rec, req, builtin, ""); err != nil {
			t.Fatalf("serve: %v", err)
		}
		return rec
	}

	first := get("")
	if first.Code != 200 || first.Header().Get("Content-Type") != "text/css; charset=utf-8" {
		t.Fatalf("first GET = %d ct=%q", first.Code, first.Header().Get("Content-Type"))
	}
	if cc := first.Header().Get("Cache-Control"); !strings.Contains(cc, "must-revalidate") {
		t.Errorf("cache-control = %q", cc)
	}
	etag := first.Header().Get("Etag")
	if etag == "" {
		t.Fatal("no etag on first response")
	}
	if second := get(etag); second.Code != http.StatusNotModified {
		t.Errorf("conditional GET = %d, want 304", second.Code)
	}

	// Misses surface as errFileNotFound for the route closure to 404.
	req := httptest.NewRequest(http.MethodGet, "/pack-static/p/nope.css", nil)
	if err := ServePackStatic(httptest.NewRecorder(), req, builtin, ""); err != errFileNotFound {
		t.Errorf("missing asset err = %v, want errFileNotFound", err)
	}
}
func TestWriteCustomCodePack(t *testing.T) {
	local := t.TempDir()

	if err := WriteCustomCodePack(local, CustomCode{CSS: "b{color:red}"}); err != nil {
		t.Fatal(err)
	}
	m := BuildFrontendManifest("", local)
	if len(m.Packs) != 1 || m.Packs[0].Name != CustomCodePackName {
		t.Fatalf("packs = %+v", m.Packs)
	}
	if len(m.Contributions) != 1 || len(m.Contributions[0].Styles) != 1 || len(m.Contributions[0].Scripts) != 0 {
		t.Fatalf("contributions = %+v", m.Contributions)
	}

	// Update: add JS, keep CSS.
	if err := WriteCustomCodePack(local, CustomCode{CSS: "b{}", JS: "console.log(1)"}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(local, CustomCodePackName, "frontend", "script.js")); err != nil {
		t.Fatal(err)
	}

	// Boot-time discovery accepts the managed pack (strict pack.json decode).
	if _, err := LoadLocal(filepath.Join(local, CustomCodePackName)); err != nil {
		t.Fatalf("managed pack fails LoadLocal: %v", err)
	}

	// Both empty → uninstall.
	if err := WriteCustomCodePack(local, CustomCode{}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(local, CustomCodePackName)); !os.IsNotExist(err) {
		t.Fatalf("pack dir should be gone, stat err = %v", err)
	}
	m = BuildFrontendManifest("", local)
	if len(m.Packs) != 0 {
		t.Fatalf("packs after uninstall = %+v", m.Packs)
	}
}

func TestWriteCustomCodePack_RefusesForeignPack(t *testing.T) {
	local := t.TempDir()
	writePack(t, local, CustomCodePackName, `{"name":"site-custom","version":"1.0.0"}`, nil)
	if err := WriteCustomCodePack(local, CustomCode{CSS: "x"}); err == nil {
		t.Fatal("must refuse to clobber a non-managed pack owning the name")
	}
}

func TestWriteCustomCodePack_RequiresLocalDir(t *testing.T) {
	if err := WriteCustomCodePack("", CustomCode{CSS: "x"}); err == nil {
		t.Fatal("empty local dir must fail loudly")
	}
}
