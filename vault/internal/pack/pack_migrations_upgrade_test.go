package pack

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
)

// TestStageMigrationsSkipsExistingCollections simulates an "old database" that
// already contains the Pack-owned collections (previously created by the now
// removed Go migrations). The Pack JS migrations must skip those collections
// (via their try/catch existence guard), not error, and not recreate them.
func TestStageMigrationsSkipsExistingCollections(t *testing.T) {
	app := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDataDir: filepath.Join(t.TempDir(), "pb_data"),
	})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}

	// Simulate the existing DB: pre-create each Pack collection with a marker
	// field so we can prove the JS migration does NOT recreate/overwrite it.
	names := []string{"moments", "bookmarks", "live2d_config", "site_visits"}
	for _, name := range names {
		col := core.NewCollection(core.CollectionTypeBase, name)
		col.Fields.Add(&core.TextField{Name: "old_marker"})
		if err := app.Save(col); err != nil {
			t.Fatalf("pre-create %q: %v", name, err)
		}
	}

	builtins, err := Builtins(os.DirFS("../../../packs"))
	if err != nil {
		t.Fatal(err)
	}
	loadable, _, err := RuntimeLoadableV0(builtins)
	if err != nil {
		t.Fatal(err)
	}
	migrationsDir := filepath.Join(t.TempDir(), "pb_migrations")
	if err := StageMigrations("", loadable, migrationsDir); err != nil {
		t.Fatal(err)
	}

	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      filepath.Join(t.TempDir(), "pb_hooks"),
	})

	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("RunAppMigrations: %v", err)
	}

	// The collections must still exist and still carry the old_marker field
	// (i.e. the JS migrations skipped them instead of recreating them).
	for _, name := range names {
		col, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			t.Fatalf("collection %q missing after upgrade: %v", name, err)
		}
		if col.Fields.GetByName("old_marker") == nil {
			t.Fatalf("collection %q was recreated (old_marker lost)", name)
		}
	}
}
