package pack

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
)

func TestHasPendingAppMigrations(t *testing.T) {
	app := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDataDir: filepath.Join(t.TempDir(), "pb_data"),
	})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}

	migrationsDir := filepath.Join(t.TempDir(), "pb_migrations")
	if err := os.MkdirAll(migrationsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(migrationsDir, "0001_backup_test.js"),
		[]byte(`migrate((app) => {
  const collection = new Collection({ type: "base", name: "backup_probe", fields: [{ name: "flag", type: "bool" }] });
  return app.save(collection);
}, (app) => {});`),
		0o644,
	); err != nil {
		t.Fatal(err)
	}

	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      filepath.Join(t.TempDir(), "pb_hooks"),
	})

	pending, err := hasPendingAppMigrations(app)
	if err != nil {
		t.Fatalf("hasPendingAppMigrations (before): %v", err)
	}
	if !pending {
		t.Fatal("expected pending migrations before RunAppMigrations")
	}

	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("RunAppMigrations: %v", err)
	}

	pending, err = hasPendingAppMigrations(app)
	if err != nil {
		t.Fatalf("hasPendingAppMigrations (after): %v", err)
	}
	if pending {
		t.Fatal("expected no pending migrations after RunAppMigrations")
	}
}
