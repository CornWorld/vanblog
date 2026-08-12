package caddy

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// mkThemeClient creates a theme dir with a dist/client so buildStaticRoutes
// emits its file_server routes.
func mkThemeClient(t *testing.T, root, name string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Join(root, name, "dist", "client"), 0o755); err != nil {
		t.Fatal(err)
	}
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
		AdminDistDir:    filepath.Join(t.TempDir(), "no-admin"),
		ThemesDir:       user,
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
