package site

import (
	"os"
	"testing"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func setupApp(t *testing.T) core.App {
	t.Helper()
	tmpDir, _ := os.MkdirTemp("", "pb-site-test")
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

func TestGet(t *testing.T) {
	app := setupApp(t)

	record, err := Get(app)
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if record == nil {
		t.Fatal("expected non-nil site record")
	}
	if record.GetString("theme") != "default" {
		t.Errorf("theme = %q, want 'default'", record.GetString("theme"))
	}
}

func TestGetInfo(t *testing.T) {
	app := setupApp(t)

	// Update site with test values
	siteRec, _ := Get(app)
	siteRec.Set("siteName", "My Blog")
	siteRec.Set("baseUrl", "https://blog.example.com")
	siteRec.Set("author", "Test Author")
	siteRec.Set("siteDesc", "A test blog")
	siteRec.Set("commentsProvider", "giscus")
	siteRec.Set("allowedDomains", []string{"blog.example.com", "www.example.com"})
	app.Save(siteRec)

	info, err := GetInfo(app)
	if err != nil {
		t.Fatalf("GetInfo failed: %v", err)
	}

	if info.SiteName != "My Blog" {
		t.Errorf("SiteName = %q, want 'My Blog'", info.SiteName)
	}
	if info.BaseURL != "https://blog.example.com" {
		t.Errorf("BaseURL = %q", info.BaseURL)
	}
	if info.Author != "Test Author" {
		t.Errorf("Author = %q", info.Author)
	}
	if info.Description != "A test blog" {
		t.Errorf("Description = %q, want 'A test blog' (from siteDesc)", info.Description)
	}
	if info.CommentsProvider != "giscus" {
		t.Errorf("CommentsProvider = %q", info.CommentsProvider)
	}
	if len(info.AllowedDomains) != 2 {
		t.Errorf("AllowedDomains len = %d, want 2", len(info.AllowedDomains))
	}
}

func TestGetInfo_Defaults(t *testing.T) {
	app := setupApp(t)

	// site record exists but has empty fields (default migration)
	info, err := GetInfo(app)
	if err != nil {
		t.Fatalf("GetInfo failed: %v", err)
	}

	// Empty siteName should default to "Vanblog"
	if info.SiteName != "Vanblog" {
		t.Errorf("SiteName = %q, want 'Vanblog' (default)", info.SiteName)
	}

	// Empty siteDesc should fall back to SiteName ("Vanblog")
	if info.Description != "Vanblog" && info.Description != "" {
		t.Errorf("Description = %q, want 'Vanblog' or empty", info.Description)
	}
}
