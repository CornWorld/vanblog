package admin

import (
	"reflect"
	"testing"

	"github.com/cornworld/vanblog/internal/migrationschema"
	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func TestBuildExportPost(t *testing.T) {
	tmpDir := t.TempDir()
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migrations: %v", err)
	}

	catCol, _ := app.FindCollectionByNameOrId("categories")
	cat := core.NewRecord(catCol)
	cat.Set("name", "dev")
	if err := app.Save(cat); err != nil {
		t.Fatalf("save category: %v", err)
	}

	tagCol, _ := app.FindCollectionByNameOrId("tags")
	tagGo := core.NewRecord(tagCol)
	tagGo.Set("name", "go")
	if err := app.Save(tagGo); err != nil {
		t.Fatalf("save tag go: %v", err)
	}
	tagWeb := core.NewRecord(tagCol)
	tagWeb.Set("name", "web")
	if err := app.Save(tagWeb); err != nil {
		t.Fatalf("save tag web: %v", err)
	}

	postCol, _ := app.FindCollectionByNameOrId("posts")
	post := core.NewRecord(postCol)
	post.Set("title", "Test")
	post.Set("content", "hello")
	post.Set("status", "published")
	post.Set("pathname", "test")
	post.Set("private", true)
	post.Set("password", "secret")
	post.Set("top", 1)
	post.Set("category", cat.Id)
	post.Set("tags", []string{tagGo.Id, tagWeb.Id})
	if err := app.Save(post); err != nil {
		t.Fatalf("save post: %v", err)
	}

	ep := buildExportPost(app, post)

	if ep.Title != "Test" || ep.Status != "published" || ep.Pathname != "test" {
		t.Errorf("unexpected ep: %+v", ep)
	}
	if !ep.Private || ep.Password != "secret" {
		t.Errorf("private/password not preserved: %+v", ep)
	}
	if ep.Category != "dev" {
		t.Errorf("Category = %q, want dev", ep.Category)
	}
	if !reflect.DeepEqual(ep.Tags, []string{"go", "web"}) {
		t.Errorf("Tags = %v, want [go web]", ep.Tags)
	}

	// Verify buildExportPost returns migrationschema.Post
	var _ migrationschema.Post = ep
}
