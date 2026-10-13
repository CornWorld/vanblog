package migration

// date_preserve_test.go pins the migration date-fidelity contract: an
// import ZIP whose posts.json carries created/updated must land those
// dates on the imported post. Regression guard for the original
// mereithhh→vanblog path, where losing publish dates silently reorders
// timeline/archive.

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/cornworld/vanblog/internal/migrationschema"
)

// buildImportZip returns a minimal ZIP with a single posts.json entry.
// Stdlib archive/zip keeps this in lockstep with what admin/export.go ships.
func buildImportZip(t *testing.T, posts any) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, err := zw.Create("posts.json")
	if err != nil {
		t.Fatalf("zip create: %v", err)
	}
	if err := json.NewEncoder(w).Encode(posts); err != nil {
		t.Fatalf("zip encode: %v", err)
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("zip close: %v", err)
	}
	return buf.Bytes()
}

func TestImport_PreservesPostDates(t *testing.T) {
	app := setupApp(t)
	mux := buildRouter(t, app)
	token := createAdminAndLogin(t, app, mux, "admin@example.com")

	const created = "2023-05-01T08:30:00.000Z"
	const updated = "2024-11-15T21:00:00.000Z"
	zipBytes := buildImportZip(t, []migrationschema.Post{{
		ID:       "whatever",
		Title:    "Dated post",
		Content:  "<p>body</p>",
		Status:   "published",
		Pathname: "dated-post",
		Category: "Tech",
		Tags:     []string{"a"},
		Created:  created,
		Updated:  updated,
	}})

	req := httptest.NewRequest(http.MethodPost, "/api/vanblog/migrate/import", bytes.NewReader(zipBytes))
	req.Header.Set("Content-Type", "application/zip")
	req.Header.Set("Authorization", token)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("import: got %d %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), `"errors":[{`) {
		t.Fatalf("import reported errors: %s", rec.Body.String())
	}

	posts, err := app.FindRecordsByFilter("posts", "pathname='dated-post'", "", 0, 0)
	if err != nil || len(posts) != 1 {
		t.Fatalf("find imported post: %v (%d)", err, len(posts))
	}
	if got := posts[0].GetDateTime("created").String(); !strings.HasPrefix(got, "2023-05-01 08:30:00") {
		t.Errorf("created = %q, want 2023-05-01 08:30:00…(original publish date lost)", got)
	}
	if got := posts[0].GetDateTime("updated").String(); !strings.HasPrefix(got, "2024-11-15 21:00:00") {
		t.Errorf("updated = %q, want 2024-11-15 21:00:00…", got)
	}
}
