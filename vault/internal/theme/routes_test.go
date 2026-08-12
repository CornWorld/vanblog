package theme

import (
	"os"
	"path/filepath"
	"testing"
)

// writeThemeMeta creates a runnable theme dir (theme.json + dist/server/
// entry.mjs) so ResolveDir can resolve it.
func writeThemeMeta(t *testing.T, dir, name string) {
	t.Helper()
	root := filepath.Join(dir, name)
	if err := os.MkdirAll(filepath.Join(root, "dist", "server"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "theme.json"), []byte(`{"name":"`+name+`"}`+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "dist", "server", "entry.mjs"), []byte("export const handler = async () => {}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
}

// writePartialThemeMeta creates a dir with theme.json but NO built dist —
// simulating an interrupted/broken install. It must not shadow a runnable
// builtin for palette resolution.
func writePartialThemeMeta(t *testing.T, dir, name string) {
	t.Helper()
	root := filepath.Join(dir, name)
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "theme.json"), []byte(`{"name":"`+name+`"}`+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
}

// TestResolveDir_UserWinsOnCollision locks the merge precedence: a user theme
// whose name collides with a builtin resolves to the USER dir (the same
// contract as serveThemes, theme-host core.mjs and Caddy buildStaticRoutes),
// while builtin-only themes still resolve to the builtin dir.
func TestResolveDir_UserWinsOnCollision(t *testing.T) {
	builtin := t.TempDir()
	user := t.TempDir()
	writeThemeMeta(t, builtin, "dup")
	writeThemeMeta(t, builtin, "base")
	writeThemeMeta(t, user, "dup") // user dup shadows builtin dup
	writeThemeMeta(t, user, "custom")

	t.Setenv("VANBLOG_THEMES_DIR", user)
	t.Setenv("VANBLOG_THEMES_BUILTIN_DIR", builtin)

	if got := ResolveDir("dup"); got != filepath.Join(user, "dup") {
		t.Errorf("dup: want user dir %s, got %s", filepath.Join(user, "dup"), got)
	}
	if got := ResolveDir("base"); got != filepath.Join(builtin, "base") {
		t.Errorf("base: want builtin dir %s, got %s", filepath.Join(builtin, "base"), got)
	}
	if got := ResolveDir("custom"); got != filepath.Join(user, "custom") {
		t.Errorf("custom: want user dir %s, got %s", filepath.Join(user, "custom"), got)
	}
	if got := ResolveDir("nope"); got != "" {
		t.Errorf("nope: want empty, got %s", got)
	}
}

// TestResolveDir_RejectsInvalidNames is the path-traversal guard: names that
// are not valid theme identifiers (empty, parent/absolute paths, or anything
// that cannot come from the pack CLI's installer) never probe the filesystem.
func TestResolveDir_RejectsInvalidNames(t *testing.T) {
	t.Setenv("VANBLOG_THEMES_DIR", t.TempDir())
	t.Setenv("VANBLOG_THEMES_BUILTIN_DIR", t.TempDir())
	for _, name := range []string{"", "..", "../etc", "a/../b", "/abs/path", "Bad Name", "UPPER", "a b"} {
		if got := ResolveDir(name); got != "" {
			t.Errorf("ResolveDir(%q): want empty, got %s", name, got)
		}
	}
}

// TestResolveDir_PartialUserDoesNotShadowBuiltin locks the eligibility
// criterion: a user dir with only theme.json (no built dist/server/entry.mjs)
// must NOT shadow a runnable builtin for palette resolution — ResolveDir and
// serveThemes/theme-host share the same "runnable" test.
func TestResolveDir_PartialUserDoesNotShadowBuiltin(t *testing.T) {
	builtin := t.TempDir()
	user := t.TempDir()
	writeThemeMeta(t, builtin, "dup")        // runnable builtin
	writePartialThemeMeta(t, user, "dup")    // broken user copy (theme.json only)
	writePartialThemeMeta(t, user, "custom") // broken user-only theme

	t.Setenv("VANBLOG_THEMES_DIR", user)
	t.Setenv("VANBLOG_THEMES_BUILTIN_DIR", builtin)

	if got := ResolveDir("dup"); got != filepath.Join(builtin, "dup") {
		t.Errorf("dup: broken user copy must not shadow builtin; want %s, got %s", filepath.Join(builtin, "dup"), got)
	}
	if got := ResolveDir("custom"); got != "" {
		t.Errorf("custom: partial user-only theme must not resolve; want empty, got %s", got)
	}
}
