package migration

import (
	"encoding/json"
	"os"
	"testing"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func setupApp(t *testing.T) core.App {
	t.Helper()
	tmpDir, _ := os.MkdirTemp("", "pb-mig-tool-test")
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

func sampleBackup() []byte {
	backup := LegacyBackup{
		Articles: []LegacyArticle{
			{
				ID:       1,
				Title:    "Hello World",
				Content:  "# Hello\n\nThis is my first post.",
				Tags:     []string{"Go", "Docker"},
				Category: "Tech",
				Hidden:   false,
				Pathname: "/hello-world",
				Viewer:   42,
				Visited:  38,
			},
			{
				ID:      2,
				Title:   "Hidden Post",
				Content: "Secret content",
				Hidden:  true,
				Tags:    []string{"Go"},
			},
		},
		Drafts: []LegacyDraft{
			{
				ID:      1,
				Title:   "Work in Progress",
				Content: "TODO: write more",
				Tags:    []string{"Rust"},
			},
		},
		Categories: []LegacyCategory{
			{Name: "Tech", Type: "category"},
			{Name: "Life", Type: "category"},
		},
		Tags: []string{"Go", "Docker", "Rust"},
		Static: []LegacyStatic{
			{
				StaticType:  "img",
				StorageType: "local",
				FileType:    "png",
				RealPath:    "/static/img/photo.png",
				Name:        "photo.png",
				Sign:        "abc123",
			},
			{
				StaticType:  "img",
				StorageType: "picgo",
				FileType:    "jpg",
				RealPath:    "https://oss.example.com/bucket/photo.jpg",
				Name:        "oss-photo.jpg",
				Sign:        "def456",
			},
		},
		// Incompatible data that should be archived
		Meta:    json.RawMessage(`{"siteName":"Old Blog"}`),
		User:    json.RawMessage(`{"name":"admin","password":"hashed"}`),
		Setting: json.RawMessage(`{"static":{"picgoConfig":"sensitive"}}`),
	}

	data, _ := json.Marshal(backup)
	return data
}

func TestImport_BasicFlow(t *testing.T) {
	app := setupApp(t)
	imp := New(app)

	result, err := imp.Import(sampleBackup())
	if err != nil {
		t.Fatalf("Import failed: %v", err)
	}

	if result.Posts != 3 { // 2 articles + 1 draft
		t.Errorf("posts = %d, want 3", result.Posts)
	}
	if result.Categories != 2 {
		t.Errorf("categories = %d, want 2", result.Categories)
	}
	if result.Tags != 3 {
		t.Errorf("tags = %d, want 3", result.Tags)
	}
	if result.Media != 2 {
		t.Errorf("media = %d, want 2", result.Media)
	}
	if !result.Archive {
		t.Error("archive should be created")
	}
}

func TestImport_PostsMerged(t *testing.T) {
	app := setupApp(t)
	imp := New(app)

	imp.Import(sampleBackup())

	// Check published posts
	pub, _ := app.FindRecordsByFilter("posts", "status='published'", "", 0, 0)
	if len(pub) != 1 {
		t.Errorf("published posts = %d, want 1", len(pub))
	}

	// Check hidden posts (1 original + 1 migration archive)
	hidden, _ := app.FindRecordsByFilter("posts", "status='hidden'", "", 0, 0)
	if len(hidden) != 2 {
		t.Errorf("hidden posts = %d, want 2 (1 original + 1 archive)", len(hidden))
	}

	// Check drafts
	drafts, _ := app.FindRecordsByFilter("posts", "status='draft'", "", 0, 0)
	if len(drafts) != 1 {
		t.Errorf("drafts = %d, want 1", len(drafts))
	}
}

func TestImport_TagsRelation(t *testing.T) {
	app := setupApp(t)
	imp := New(app)

	imp.Import(sampleBackup())

	// Find the "Hello World" post and check tags
	post, err := app.FindFirstRecordByFilter("posts", "title='Hello World'", )
	if err != nil {
		t.Fatalf("post not found: %v", err)
	}

	tagIDs := post.GetStringSlice("tags")
	if len(tagIDs) != 2 {
		t.Errorf("post tags = %d, want 2", len(tagIDs))
	}

	// Verify tags resolve to names
	for _, tagID := range tagIDs {
		tag, err := app.FindRecordById("tags", tagID)
		if err != nil {
			t.Errorf("tag %s not found: %v", tagID, err)
		}
		name := tag.GetString("name")
		if name != "Go" && name != "Docker" {
			t.Errorf("unexpected tag name: %s", name)
		}
	}
}

func TestImport_CategoryRelation(t *testing.T) {
	app := setupApp(t)
	imp := New(app)

	imp.Import(sampleBackup())

	post, _ := app.FindFirstRecordByFilter("posts", "title='Hello World'")
	catID := post.GetString("category")
	if catID == "" {
		t.Fatal("category should be set")
	}

	cat, err := app.FindRecordById("categories", catID)
	if err != nil {
		t.Fatalf("category not found: %v", err)
	}
	if cat.GetString("name") != "Tech" {
		t.Errorf("category name = %q, want %q", cat.GetString("name"), "Tech")
	}
}

func TestImport_PicgoToS3(t *testing.T) {
	app := setupApp(t)
	imp := New(app)

	imp.Import(sampleBackup())

	// Find the picgo media record
	media, _ := app.FindRecordsByFilter("media", "sign='def456'", "", 0, 0)
	if len(media) != 1 {
		t.Fatalf("expected 1 picgo media, got %d", len(media))
	}
	if media[0].GetString("storageType") != "s3" {
		t.Errorf("storageType = %q, want %q (picgo→s3)", media[0].GetString("storageType"), "s3")
	}
	if media[0].GetString("externalUrl") != "https://oss.example.com/bucket/photo.jpg" {
		t.Errorf("externalUrl not preserved")
	}
}

func TestImport_ArchiveCreated(t *testing.T) {
	app := setupApp(t)
	imp := New(app)

	imp.Import(sampleBackup())

	// Find the archive post
	archive, err := app.FindFirstRecordByFilter("posts", "title~'迁移档案'")
	if err != nil {
		t.Fatalf("archive post not found: %v", err)
	}
	if archive.GetString("status") != "hidden" {
		t.Errorf("archive status = %q, want hidden", archive.GetString("status"))
	}
	content := archive.GetString("content")
	if content == "" {
		t.Error("archive content should not be empty")
	}
}

func TestImport_TransactionRollback(t *testing.T) {
	app := setupApp(t)
	imp := New(app)

	// Create invalid JSON
	_, err := imp.Import([]byte(`{"articles": [invalid}`))
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}

	// Verify no data was written
	posts, _ := app.FindRecordsByFilter("posts", "", "", 0, 0)
	if len(posts) != 0 {
		t.Errorf("posts after failed import = %d, want 0 (rollback)", len(posts))
	}
}
