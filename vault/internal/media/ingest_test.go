package media

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func TestIngestExternalImages(t *testing.T) {
	pngBytes := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xcf\xc0\x00\x00\x00\x03\x00\x01\x5d\xcc\xdb\xda\x00\x00\x00\x00IEND\xaeB`\x82")
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		if _, err := w.Write(pngBytes); err != nil {
			t.Errorf("write png: %v", err)
		}
	}))
	defer ts.Close()

	tmpDir, _ := os.MkdirTemp("", "pb-ingest-test")
	defer os.RemoveAll(tmpDir)
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migrations: %v", err)
	}
	mgr := New(app)

	postCol, _ := app.FindCollectionByNameOrId("posts")
	post := core.NewRecord(postCol)
	post.Set("title", "WithExternalImg")
	imgURL := ts.URL + "/image.png"
	post.Set("content", `<p>x</p><img src="`+imgURL+`">`)
	post.Set("status", "published")
	if err := app.Save(post); err != nil {
		t.Fatalf("save post: %v", err)
	}

	ingested, failed, err := mgr.IngestExternalImages(post.Id)
	if err != nil {
		t.Fatalf("IngestExternalImages: %v", err)
	}
	if ingested != 1 {
		t.Errorf("ingested = %d, want 1", ingested)
	}
	if failed != 0 {
		t.Errorf("failed = %d, want 0", failed)
	}

	reloaded, _ := app.FindRecordById("posts", post.Id)
	newContent := reloaded.GetString("content")
	if strings.Contains(newContent, imgURL) {
		t.Errorf("content still references external URL: %s", newContent)
	}
	if !strings.Contains(newContent, "/api/files/") {
		t.Errorf("content missing local file URL: %s", newContent)
	}

	mediaRecords, _ := app.FindRecordsByFilter("media", "1=1", "created", 0, 0)
	if len(mediaRecords) != 1 {
		t.Fatalf("media records = %d, want 1", len(mediaRecords))
	}
	if mediaRecords[0].GetString("externalUrl") != imgURL {
		t.Errorf("externalUrl = %q, want %q", mediaRecords[0].GetString("externalUrl"), imgURL)
	}

	ingested2, _, err := mgr.IngestExternalImages(post.Id)
	if err != nil {
		t.Fatalf("second ingest: %v", err)
	}
	if ingested2 != 0 {
		t.Errorf("second ingest ingested = %d, want 0 (already localized)", ingested2)
	}
	mediaRecords2, _ := app.FindRecordsByFilter("media", "1=1", "created", 0, 0)
	if len(mediaRecords2) != 1 {
		t.Errorf("media records after 2nd ingest = %d, want 1 (idempotent)", len(mediaRecords2))
	}
}
