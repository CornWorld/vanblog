package pack

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
)

// TestStageMigrationsEndToEnd builds the resolved builtin Packs, stages their
// migrations/*.js via StageMigrations, and then runs them through a real jsvm
// registration + bootstrap + RunAppMigrations on a fresh database. It verifies
// that the Pack-owned collections are created by the JS migrations (no Go
// pack migrations are involved, since this package does not import the
// vanblog pb_migrations package).
func TestStageMigrationsEndToEnd(t *testing.T) {
	builtins, err := Builtins(os.DirFS("../../../packs"))
	if err != nil {
		t.Fatal(err)
	}
	loadable, _, err := RuntimeLoadableV0(builtins)
	if err != nil {
		t.Fatal(err)
	}

	root := t.TempDir()
	migrationsDir := filepath.Join(root, "pb_migrations")
	if err := StageMigrations("", loadable, migrationsDir); err != nil {
		t.Fatal(err)
	}

	app := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDataDir: filepath.Join(root, "pb_data"),
	})

	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      filepath.Join(root, "pb_hooks"),
	})

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("RunAppMigrations: %v", err)
	}

	usersCol, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("users collection: %v", err)
	}

	// moments
	moments, err := app.FindCollectionByNameOrId("moments")
	if err != nil {
		t.Fatalf("moments collection missing: %v", err)
	}
	assertField(t, moments, "content", core.FieldTypeText)
	assertField(t, moments, "visible", core.FieldTypeBool)
	author := assertField(t, moments, "author", core.FieldTypeRelation)
	if rel, ok := author.(*core.RelationField); !ok || rel.CollectionId != usersCol.Id || !rel.Required || rel.MaxSelect != 1 {
		t.Fatalf("moments.author relation misconfigured: %#v", author)
	}
	if moments.ListRule == nil || *moments.ListRule != `visible = true || @request.auth.id = author || @request.auth.role = "admin"` {
		t.Fatalf("moments.listRule = %v", moments.ListRule)
	}

	// bookmarks
	bookmarks, err := app.FindCollectionByNameOrId("bookmarks")
	if err != nil {
		t.Fatalf("bookmarks collection missing: %v", err)
	}
	assertField(t, bookmarks, "title", core.FieldTypeText)
	assertField(t, bookmarks, "url", core.FieldTypeURL)
	assertField(t, bookmarks, "description", core.FieldTypeText)
	owner := assertField(t, bookmarks, "owner", core.FieldTypeRelation)
	if rel, ok := owner.(*core.RelationField); !ok || rel.CollectionId != usersCol.Id || !rel.Required {
		t.Fatalf("bookmarks.owner relation misconfigured: %#v", owner)
	}

	// live2d_config
	live2d, err := app.FindCollectionByNameOrId("live2d_config")
	if err != nil {
		t.Fatalf("live2d_config collection missing: %v", err)
	}
	assertField(t, live2d, "widgetPath", core.FieldTypeURL)
	assertField(t, live2d, "cdnPath", core.FieldTypeURL)
	assertField(t, live2d, "modelId", core.FieldTypeNumber)
	assertField(t, live2d, "tools", core.FieldTypeJSON)

	// visit_sessions (online pack — per-session rows, heartbeat-driven)
	sessions, err := app.FindCollectionByNameOrId("visit_sessions")
	if err != nil {
		t.Fatalf("visit_sessions collection missing: %v", err)
	}
	assertField(t, sessions, "session", core.FieldTypeText)
	assertField(t, sessions, "lastSeenAt", core.FieldTypeDate)

	// The legacy site_visits collection must not exist on a fresh install.
	if _, err := app.FindCollectionByNameOrId("site_visits"); err == nil {
		t.Fatal("legacy site_visits should not exist on fresh install")
	}
}

func assertField(t *testing.T, col *core.Collection, name, wantType string) core.Field {
	t.Helper()
	f := col.Fields.GetByName(name)
	if f == nil {
		t.Fatalf("collection %q missing field %q", col.Name, name)
	}
	if got := f.Type(); got != wantType {
		t.Fatalf("collection %q field %q type = %q, want %q", col.Name, name, got, wantType)
	}
	return f
}
