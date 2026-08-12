package packcli

import (
	"os"
	"path/filepath"
	"testing"
)

// writeThemeTree creates a minimal built theme tree at dir/name.
func writeThemeTree(t *testing.T, dir, name, version string) {
	t.Helper()
	root := filepath.Join(dir, name)
	for _, sub := range []string{"dist/server", "dist/client"} {
		if err := os.MkdirAll(filepath.Join(root, sub), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	meta := []byte(`{"name":"` + name + `","version":"` + version + `"}` + "\n")
	if err := os.WriteFile(filepath.Join(root, "theme.json"), meta, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "dist", "server", "entry.mjs"), []byte("export const handler = async () => {}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "dist", "client", "a.js"), []byte("var a=1;\n"), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestListThemes_MergeUserWins(t *testing.T) {
	builtin := t.TempDir()
	user := t.TempDir()
	writeThemeTree(t, builtin, "base", "0.1.0")
	writeThemeTree(t, builtin, "dup", "1.0.0") // builtin dup
	writeThemeTree(t, user, "dup", "9.9.9")    // user dup → should win
	writeThemeTree(t, user, "custom", "0.0.1")

	lines := listThemes(user, builtin)
	if len(lines) != 3 {
		t.Fatalf("want 3 merged themes, got %d: %+v", len(lines), lines)
	}
	got := map[string]string{}
	for _, l := range lines {
		got[l.name] = l.source
	}
	if got["base"] != "builtin" {
		t.Errorf("base source: want builtin, got %s", got["base"])
	}
	if got["dup"] != "user" {
		t.Errorf("dup source: want user (wins), got %s", got["dup"])
	}
	if got["custom"] != "user" {
		t.Errorf("custom source: want user, got %s", got["custom"])
	}
}

func TestValidateThemeDir(t *testing.T) {
	dir := t.TempDir()
	writeThemeTree(t, dir, "ok", "1.0.0")
	if name, err := validateThemeDir(filepath.Join(dir, "ok")); err != nil || name != "ok" {
		t.Fatalf("valid theme rejected: name=%q err=%v", name, err)
	}

	// missing dist/server/entry.mjs → rejected
	bad := filepath.Join(t.TempDir(), "bad")
	if err := os.MkdirAll(filepath.Join(bad, "dist", "client"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(bad, "theme.json"), []byte(`{"name":"bad"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := validateThemeDir(bad); err == nil {
		t.Fatal("expected error for missing dist/server/entry.mjs")
	}

	// invalid name → rejected
	badName := filepath.Join(t.TempDir(), "badName")
	for _, sub := range []string{"dist/server", "dist/client"} {
		if err := os.MkdirAll(filepath.Join(badName, sub), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(badName, "dist", "server", "entry.mjs"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(badName, "dist", "client", "a.js"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(badName, "theme.json"), []byte(`{"name":"Bad Name"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := validateThemeDir(badName); err == nil {
		t.Fatal("expected error for invalid theme name")
	}
}

func TestInstallTheme_AtomicAndCollision(t *testing.T) {
	dest := t.TempDir()
	src := t.TempDir()
	writeThemeTree(t, src, "mine", "1.0.0")

	name, err := installTheme(filepath.Join(src, "mine"), dest)
	if err != nil || name != "mine" {
		t.Fatalf("install failed: name=%q err=%v", name, err)
	}
	if _, err := os.Stat(filepath.Join(dest, "mine", "dist", "server", "entry.mjs")); err != nil {
		t.Fatalf("installed entry.mjs missing: %v", err)
	}

	// No leftover stage dirs (atomic promotion must clean up).
	entries, _ := os.ReadDir(dest)
	for _, e := range entries {
		if len(e.Name()) > 0 && e.Name()[0] == '.' {
			t.Fatalf("leftover stage dir %s", e.Name())
		}
	}

	// Collision with an existing user theme is refused.
	if _, err := installTheme(filepath.Join(src, "mine"), dest); err == nil {
		t.Fatal("expected collision error on re-install")
	}
}

func TestRemoveTheme(t *testing.T) {
	user := t.TempDir()
	builtin := t.TempDir()
	writeThemeTree(t, builtin, "builtin-only", "1.0.0")
	writeThemeTree(t, user, "mine", "1.0.0")

	// Builtin-only theme → refuse.
	if err := removeTheme("builtin-only", user, builtin); err == nil {
		t.Fatal("expected builtin refusal")
	}
	// Not installed anywhere → error.
	if err := removeTheme("nope", user, builtin); err == nil {
		t.Fatal("expected not-installed error")
	}
	// User theme → removed. PB is unreachable in tests so the active-theme
	// guard is a no-op (ok=false → proceed).
	if err := removeTheme("mine", user, builtin); err != nil {
		t.Fatalf("remove user theme: %v", err)
	}
	if _, err := os.Stat(filepath.Join(user, "mine")); !os.IsNotExist(err) {
		t.Fatal("user theme dir still exists after remove")
	}
}
