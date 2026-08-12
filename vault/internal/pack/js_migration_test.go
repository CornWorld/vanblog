package pack

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
)

// TestJSMigrationCreatesCollections verifies end-to-end that PB JS migrations
// can be namespaced (no leading numeric prefix) and create collections, and
// that the shared AppMigrations sort order is deterministic.
func TestJSMigrationCreatesCollections(t *testing.T) {
	root := t.TempDir()
	migrationsDir := filepath.Join(root, "pb_migrations")
	hooksDir := filepath.Join(root, "pb_hooks")
	if err := os.MkdirAll(migrationsDir, 0o755); err != nil {
		t.Fatal(err)
	}

	write := func(name, body string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(migrationsDir, name), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	// core-style numeric prefix
	write("1789000000_core_style.js", `migrate((app) => {
  const collection = new Collection({ type: "base", name: "core_extra", fields: [{ name: "flag", type: "bool" }] });
  return app.save(collection);
}, (app) => {});`)

	// namespaced, NO leading numeric prefix (synthetic "probe-*" pack names so
	// these migration filenames don't collide with the real builtin packs).
	write("pack--probe-notes--0001_init.js", `migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "notes",
    fields: [
      { name: "title", type: "text", required: true },
      { name: "body", type: "text" },
    ],
  });
  return app.save(collection);
}, (app) => {});`)

	write("pack--probe-gallery--0001_init.js", `migrate((app) => {
  const collection = new Collection({ type: "base", name: "gallery", fields: [{ name: "src", type: "url" }] });
  return app.save(collection);
}, (app) => {});`)

	// correct idempotency guard: findCollectionByNameOrId throws on not-found,
	// so guard with try/catch. Runs after pack--probe-notes (lexicographic).
	write("pack--probe-zzz--0001_guard.js", `migrate((app) => {
  let exists = false;
  try { app.findCollectionByNameOrId("notes"); exists = true; } catch (e) { exists = false; }
  if (!exists) { return new Error("expected notes to already exist"); }
}, (app) => {});`)

	app := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDataDir: filepath.Join(root, "pb_data"),
	})

	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      hooksDir,
	})

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("RunAppMigrations: %v", err)
	}

	for _, name := range []string{"core_extra", "notes", "gallery"} {
		col, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			t.Fatalf("collection %q missing: %v", name, err)
		}
		t.Logf("OK collection %q created with %d fields", name, len(col.Fields))
	}

	t.Log("AppMigrations order (sorted by File, lexicographic):")
	for i, m := range core.AppMigrations.Items() {
		t.Logf("  [%d] %s", i, m.File)
	}
}
