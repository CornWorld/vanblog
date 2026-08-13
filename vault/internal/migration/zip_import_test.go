package migration

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/cornworld/vanblog/internal/migrationschema"
	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func setupApp(t *testing.T) core.App {
	t.Helper()
	tmpDir, _ := os.MkdirTemp("", "pb-migration-test")
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

func buildZip(t *testing.T, entries map[string][]byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, content := range entries {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatalf("zip create %s: %v", name, err)
		}
		if _, err := w.Write(content); err != nil {
			t.Fatalf("zip write %s: %v", name, err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("zip close: %v", err)
	}
	return buf.Bytes()
}

func TestImportZip_Basic(t *testing.T) {
	app := setupApp(t)
	imp := New(app)

	posts := []migrationschema.Post{
		{
			Title:     "Hello",
			Content:   "# Hello\n\nworld",
			Status:    "published",
			Pathname:  "hello",
			Category:  "dev",
			Tags:      []string{"go", "web"},
			Copyright: "cc",
		},
		{
			Title:    "Draft",
			Content:  "not ready",
			Status:   "draft",
			Pathname: "draft-post",
		},
	}
	postsJSON, _ := json.Marshal(posts)
	zipData := buildZip(t, map[string][]byte{"posts.json": postsJSON})

	result, err := imp.ImportZip(zipData)
	if err != nil {
		t.Fatalf("ImportZip: %v", err)
	}
	if result.Posts != 2 {
		t.Errorf("Posts = %d, want 2", result.Posts)
	}
	if len(result.Errors) != 0 {
		t.Errorf("unexpected errors: %v", result.Errors)
	}

	records, _ := app.FindRecordsByFilter("posts", "1=1", "created", 0, 0)
	if len(records) != 2 {
		t.Fatalf("posts count = %d, want 2", len(records))
	}
	var hello *core.Record
	for _, r := range records {
		if r.GetString("pathname") == "hello" {
			hello = r
		}
	}
	if hello == nil {
		t.Fatal("hello post not found by pathname")
	}
	if hello.GetString("status") != "published" {
		t.Errorf("hello status = %q, want published", hello.GetString("status"))
	}
	catID := hello.GetString("category")
	if catID == "" {
		t.Error("category not set")
	} else if cat, err := app.FindRecordById("categories", catID); err != nil || cat.GetString("name") != "dev" {
		t.Errorf("category lookup failed: %v", err)
	}
	tags := hello.GetStringSlice("tags")
	if len(tags) != 2 {
		t.Errorf("tags = %v, want 2", tags)
	}
}

func TestImportZip_MissingPostsJSON(t *testing.T) {
	app := setupApp(t)
	imp := New(app)

	zipData := buildZip(t, map[string][]byte{"random.txt": []byte("nope")})
	if _, err := imp.ImportZip(zipData); err == nil {
		t.Fatal("expected error for zip without posts.json/post.json")
	}
}

func TestImportZip_SinglePostExport(t *testing.T) {
	app := setupApp(t)
	imp := New(app)

	post := migrationschema.Post{Title: "Solo", Content: "content", Status: "published"}
	postJSON, _ := json.Marshal(post)
	zipData := buildZip(t, map[string][]byte{"post.json": postJSON})

	result, err := imp.ImportZip(zipData)
	if err != nil {
		t.Fatalf("ImportZip: %v", err)
	}
	if result.Posts != 1 {
		t.Errorf("Posts = %d, want 1", result.Posts)
	}
}

func TestImportZip_ImageUploadAndURLRewrite(t *testing.T) {
	app := setupApp(t)
	imp := New(app)

	pngBytes := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xcf\xc0\x00\x00\x00\x03\x00\x01\x5d\xcc\xdb\xda\x00\x00\x00\x00IEND\xaeB`\x82")

	content := `<p>Hello</p><img src="/api/files/oldcollection/oldrecord/img.png">`
	posts := []migrationschema.Post{
		{Title: "Img", Content: content, Status: "published"},
	}
	postsJSON, _ := json.Marshal(posts)

	zipData := buildZip(t, map[string][]byte{
		"posts.json":                             postsJSON,
		"images/oldcollection/oldrecord/img.png": pngBytes,
	})

	result, err := imp.ImportZip(zipData)
	if err != nil {
		t.Fatalf("ImportZip: %v", err)
	}
	if len(result.Errors) != 0 {
		t.Fatalf("unexpected errors: %v", result.Errors)
	}

	records, _ := app.FindRecordsByFilter("posts", "1=1", "created", 0, 0)
	if len(records) != 1 {
		t.Fatalf("posts = %d, want 1", len(records))
	}
	newContent := records[0].GetString("content")
	if strings.Contains(newContent, "oldcollection") {
		t.Errorf("content still references old collection: %s", newContent)
	}
	if !strings.Contains(newContent, "/api/files/") {
		t.Errorf("content missing new file URL: %s", newContent)
	}

	mediaRecords, _ := app.FindRecordsByFilter("media", "1=1", "created", 0, 0)
	if len(mediaRecords) != 1 {
		t.Fatalf("media records = %d, want 1", len(mediaRecords))
	}
	storedFile := mediaRecords[0].GetString("file")
	if storedFile == "" {
		t.Fatal("media record has no file")
	}
	if !strings.Contains(newContent, storedFile) {
		t.Errorf("content URL does not reference stored filename %q: %s", storedFile, newContent)
	}
}

func TestImportZip_MissingImageLeavesURL(t *testing.T) {
	app := setupApp(t)
	imp := New(app)

	content := `<img src="/api/files/oldcoll/oldrec/missing.png">`
	posts := []migrationschema.Post{
		{Title: "NoImg", Content: content, Status: "published"},
	}
	postsJSON, _ := json.Marshal(posts)

	zipData := buildZip(t, map[string][]byte{"posts.json": postsJSON})

	result, err := imp.ImportZip(zipData)
	if err != nil {
		t.Fatalf("ImportZip: %v", err)
	}
	if len(result.Errors) != 0 {
		t.Fatalf("unexpected errors: %v", result.Errors)
	}
	records, _ := app.FindRecordsByFilter("posts", "1=1", "created", 0, 0)
	if len(records) != 1 {
		t.Fatalf("posts = %d, want 1", len(records))
	}
	if !strings.Contains(records[0].GetString("content"), "oldcoll") {
		t.Errorf("missing image URL should be preserved as-is")
	}
}