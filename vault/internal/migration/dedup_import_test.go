package migration

// dedup_import_test.go pins the migration × media-dedup contract: importing an
// image whose bytes already exist in the destination must rewrite content to
// the EXISTING media record, not create a record the dedup hook immediately
// deletes (which left content URLs pointing at dead records — live incident
// 2026-10-14, real-backup e2e).

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/cornworld/vanblog/internal/media"
	"github.com/cornworld/vanblog/internal/migrationschema"
)

func TestImport_ReusesExistingDuplicateMedia(t *testing.T) {
	app := setupApp(t)
	mux := buildRouter(t, app)
	token := createAdminAndLogin(t, app, mux, "admin@example.com")

	// Destination already stores the very same bytes.
	existing, err := media.StoreLocalFile(app, testPNG, "existing.png", "", "img")
	if err != nil {
		t.Fatalf("seed existing media: %v", err)
	}
	existingURL := "/api/files/" + existing.BaseFilesPath() + "/" + existing.GetString("file")

	posts := []migrationschema.Post{{
		ID:       "x",
		Title:    "Dup image post",
		Content:  `<p>dup</p><img src="` + existingURL + `">`,
		Status:   "published",
		Pathname: "dup-image",
		Category: "Tech",
	}}
	zipBytes := buildImportZipWithImages(t, posts, map[string][]byte{
		existing.BaseFilesPath() + "/" + existing.GetString("file"): testPNG,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/vanblog/migrate/import", bytes.NewReader(zipBytes))
	req.Header.Set("Content-Type", "application/zip")
	req.Header.Set("Authorization", token)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("import: got %d %s", rec.Code, rec.Body.String())
	}

	mediaRecords, _ := app.FindRecordsByFilter("media", "1=1", "created", 0, 0)
	if len(mediaRecords) != 1 {
		t.Fatalf("media count = %d, want 1 (duplicate must be reused, not re-created)", len(mediaRecords))
	}

	postsCol, err := app.FindRecordsByFilter("posts", "pathname='dup-image'", "", 0, 0)
	if err != nil || len(postsCol) != 1 {
		t.Fatalf("find imported post: %v (%d)", err, len(postsCol))
	}
	content := postsCol[0].GetString("content")
	if !strings.Contains(content, existing.Id) {
		t.Errorf("content does not reference the surviving record %s: %s", existing.Id, content)
	}
	for _, m := range mediaRecords {
		if !strings.Contains(content, m.Id) {
			t.Errorf("content references non-existent record %s: %s", m.Id, content)
		}
	}
}

// buildImportZipWithImages builds an import zip with posts.json plus images/
// entries keyed by their /api/files/<path> relative path.
func buildImportZipWithImages(t *testing.T, posts any, images map[string][]byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, err := zw.Create("posts.json")
	if err != nil {
		t.Fatalf("zip create posts.json: %v", err)
	}
	if err := json.NewEncoder(w).Encode(posts); err != nil {
		t.Fatalf("zip encode posts.json: %v", err)
	}
	for name, data := range images {
		f, err := zw.Create("images/" + name)
		if err != nil {
			t.Fatalf("zip create %s: %v", name, err)
		}
		if _, err := f.Write(data); err != nil {
			t.Fatalf("zip write %s: %v", name, err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("zip close: %v", err)
	}
	return buf.Bytes()
}
