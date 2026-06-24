package feed

import (
	"os"
	"strings"
	"testing"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func setupApp(t *testing.T) core.App {
	t.Helper()
	tmpDir, _ := os.MkdirTemp("", "pb-feed-test")
	t.Cleanup(func() { os.RemoveAll(tmpDir) })
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migration: %v", err)
	}
	return app
}

func createPost(t *testing.T, app core.App, title string) {
	t.Helper()
	col, _ := app.FindCollectionByNameOrId("posts")
	r := core.NewRecord(col)
	r.Set("title", title)
	r.Set("content", "body")
	r.Set("status", "published")
	r.Set("pathname", "/" + strings.ToLower(title))
	app.Save(r)
}

func TestGenerateRSS(t *testing.T) {
	app := setupApp(t)
	createPost(t, app, "Hello")
	createPost(t, app, "World")

	data, err := GenerateRSS(app, 10)
	if err != nil {
		t.Fatalf("GenerateRSS: %v", err)
	}
	xmlStr := string(data)
	if !strings.Contains(xmlStr, "<rss") {
		t.Error("expected RSS XML")
	}
	if !strings.Contains(xmlStr, "Hello") {
		t.Error("RSS should contain post 'Hello'")
	}
	if !strings.Contains(xmlStr, "World") {
		t.Error("RSS should contain post 'World'")
	}
}

func TestGenerateRSS_Empty(t *testing.T) {
	app := setupApp(t)

	data, err := GenerateRSS(app, 10)
	if err != nil {
		t.Fatalf("GenerateRSS empty: %v", err)
	}
	if !strings.Contains(string(data), "<rss") {
		t.Error("empty RSS should still be valid XML")
	}
}

func TestGenerateSitemap(t *testing.T) {
	app := setupApp(t)
	createPost(t, app, "PostA")
	createPost(t, app, "PostB")

	data, err := GenerateSitemap(app)
	if err != nil {
		t.Fatalf("GenerateSitemap: %v", err)
	}
	xmlStr := string(data)
	if !strings.Contains(xmlStr, "<urlset") {
		t.Error("expected sitemap XML")
	}
	if !strings.Contains(xmlStr, "posta") {
		t.Error("sitemap should contain post-a URL")
	}
}

func TestGenerateAtom(t *testing.T) {
	app := setupApp(t)
	createPost(t, app, "Atom Test")

	data, err := GenerateAtom(app, 10)
	if err != nil {
		t.Fatalf("GenerateAtom: %v", err)
	}
	if !strings.Contains(string(data), "<feed") {
		t.Error("expected Atom XML")
	}
	if !strings.Contains(string(data), "Atom Test") {
		t.Error("Atom should contain post title")
	}
}
