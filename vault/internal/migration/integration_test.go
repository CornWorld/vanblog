package migration

// integration_test.go exercises the real HTTP layer for the export → import
// closed loop. These are genuine integration tests: real pb app + migrations,
// all routes registered via OnServe, real admin login (auth-with-password),
// and real HTTP requests through the router mux.
//
// This is the gap that unit tests don't cover:
//   - HTTP handler layer (handleExport*, import route)
//   - auth gating (requireAdmin 403)
//   - the cross-package contract "a zip exported by admin/export.go is
//     consumable by migration.ImportZip"

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/cornworld/vanblog/internal/admin"
	"github.com/cornworld/vanblog/internal/bootstrap"
	"github.com/cornworld/vanblog/internal/media"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// testPNG is a tiny real 1x1 transparent PNG that passes media FileField MIME check.
var testPNG = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xcf\xc0\x00\x00\x00\x03\x00\x01\x5d\xcc\xdb\xda\x00\x00\x00\x00IEND\xaeB`\x82")

// buildRouter registers every vanblog route (admin export + migration import +
// media) and returns an http.Handler that serves real requests through pb's
// router (which also handles auth parsing for the Authorization header).
func buildRouter(t *testing.T, app core.App) http.Handler {
	t.Helper()
	admin.New(app)
	media.New(app)
	RegisterRoutes(app)

	baseRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatalf("apis.NewRouter: %v", err)
	}

	serveEvent := &core.ServeEvent{App: app, Router: baseRouter}
	if err := app.OnServe().Trigger(serveEvent, func(e *core.ServeEvent) error {
		return e.Next()
	}); err != nil {
		t.Fatalf("OnServe trigger: %v", err)
	}

	mux, err := baseRouter.BuildMux()
	if err != nil {
		t.Fatalf("BuildMux: %v", err)
	}
	return mux
}

// createAdminAndLogin creates the first admin and returns a real auth token
// obtained via pb's native auth-with-password endpoint.
func createAdminAndLogin(t *testing.T, app core.App, mux http.Handler, email string) string {
	t.Helper()
	const password = "password123"

	if err := bootstrap.CreateFirstAdmin(app, bootstrap.SetupReq{
		Username:        "admin",
		Email:           email,
		Password:        password,
		PasswordConfirm: password,
	}); err != nil {
		t.Fatalf("CreateFirstAdmin: %v", err)
	}

	loginBody := `{"identity":"` + email + `","password":"` + password + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/collections/users/auth-with-password",
		strings.NewReader(loginBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("login failed: %d %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse login response: %v", err)
	}
	if resp.Token == "" {
		t.Fatal("empty auth token from login")
	}
	return resp.Token
}

// TestImportEndpoint_RequiresAuth verifies the import endpoint rejects
// unauthenticated requests. Regression guard for the earlier bug where the
// endpoint had no auth at all.
func TestImportEndpoint_RequiresAuth(t *testing.T) {
	app := setupApp(t)
	mux := buildRouter(t, app)

	// No Authorization header → must be 403.
	req := httptest.NewRequest(http.MethodPost, "/api/vanblog/migrate/import",
		strings.NewReader("PK\x03\x04 not-a-real-zip"))
	req.Header.Set("Content-Type", "application/zip")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("unauthenticated import: got %d, want 403", rec.Code)
	}
}

// TestExportImport_HTTPClosedLoop drives the full real-HTTP cycle:
//
//	app A: create post referencing a stored image → GET /export/all → zip
//	app B: POST /migrate/import with that zip → verify post + image migrated
//
// This validates the export→import wire contract end to end, including image
// bundling on export and image upload + URL rewrite on import.
func TestExportImport_HTTPClosedLoop(t *testing.T) {
	// ── App A: source ──
	appA := setupApp(t)
	muxA := buildRouter(t, appA)
	tokenA := createAdminAndLogin(t, appA, muxA, "src@example.com")

	// Create a media record with a real stored file.
	mediaRec, err := media.StoreLocalFile(appA, testPNG, "photo.png", "", "img")
	if err != nil {
		t.Fatalf("StoreLocalFile (source): %v", err)
	}
	fileURL := "/api/files/" + mediaRec.BaseFilesPath() + "/" + mediaRec.GetString("file")

	// Create a post whose content references that file URL.
	postCol, err := appA.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Fatalf("posts collection: %v", err)
	}
	post := core.NewRecord(postCol)
	post.Set("title", "Source Post")
	post.Set("content", `<p>Hello</p><img src="`+fileURL+`">`)
	post.Set("status", "published")
	post.Set("pathname", "source-post")
	if err := appA.Save(post); err != nil {
		t.Fatalf("save source post: %v", err)
	}

	// GET /api/vanblog/export/all with admin token → zip body.
	exportReq := httptest.NewRequest(http.MethodGet, "/api/vanblog/export/all", nil)
	exportReq.Header.Set("Authorization", tokenA)
	exportRec := httptest.NewRecorder()
	muxA.ServeHTTP(exportRec, exportReq)
	if exportRec.Code != http.StatusOK {
		t.Fatalf("export: got %d %s", exportRec.Code, exportRec.Body.String())
	}
	zipBytes := exportRec.Body.Bytes()
	if len(zipBytes) < 4 || !bytes.HasPrefix(zipBytes, []byte{0x50, 0x4B, 0x03, 0x04}) {
		t.Fatalf("export body is not a zip: %d bytes", len(zipBytes))
	}

	// ── App B: destination ──
	appB := setupApp(t)
	muxB := buildRouter(t, appB)
	tokenB := createAdminAndLogin(t, appB, muxB, "dst@example.com")

	importReq := httptest.NewRequest(http.MethodPost, "/api/vanblog/migrate/import",
		bytes.NewReader(zipBytes))
	importReq.Header.Set("Content-Type", "application/zip")
	importReq.Header.Set("Authorization", tokenB)
	importRec := httptest.NewRecorder()
	muxB.ServeHTTP(importRec, importReq)
	if importRec.Code != http.StatusOK {
		t.Fatalf("import: got %d %s", importRec.Code, importRec.Body.String())
	}

	var result struct {
		Posts  int      `json:"posts"`
		Errors []string `json:"errors"`
	}
	if err := json.Unmarshal(importRec.Body.Bytes(), &result); err != nil {
		t.Fatalf("parse import result: %v", err)
	}
	if result.Posts != 1 {
		t.Errorf("imported posts = %d, want 1", result.Posts)
	}
	if len(result.Errors) != 0 {
		t.Fatalf("import errors: %v", result.Errors)
	}

	// Verify the post landed with pathname preserved.
	posts, _ := appB.FindRecordsByFilter("posts", "pathname='source-post'", "", 0, 0)
	if len(posts) != 1 {
		t.Fatalf("imported post by pathname: got %d, want 1", len(posts))
	}

	// Verify the image URL was rewritten to app B's media (not the old path).
	newContent := posts[0].GetString("content")
	if strings.Contains(newContent, mediaRec.Id) {
		t.Errorf("content still references source media record id: %s", newContent)
	}
	if !strings.Contains(newContent, "/api/files/") {
		t.Errorf("content missing local file URL after import: %s", newContent)
	}

	// Verify app B has exactly one media record, and its stored file is readable.
	mediaRecords, _ := appB.FindRecordsByFilter("media", "1=1", "created", 0, 0)
	if len(mediaRecords) != 1 {
		t.Fatalf("imported media count = %d, want 1", len(mediaRecords))
	}
	storedFile := mediaRecords[0].GetString("file")
	if storedFile == "" {
		t.Fatal("imported media record has no file")
	}
	if !strings.Contains(newContent, storedFile) {
		t.Errorf("content URL does not reference imported stored file %q: %s", storedFile, newContent)
	}

	// The imported file must actually be readable from app B's filesystem.
	fsys, err := appB.NewFilesystem()
	if err != nil {
		t.Fatalf("NewFilesystem (dst): %v", err)
	}
	defer fsys.Close()
	r, err := fsys.GetReader(mediaRecords[0].BaseFilesPath() + "/" + storedFile)
	if err != nil {
		t.Errorf("imported file not readable: %v", err)
	} else {
		r.Close()
	}
}

// TestExportPost_RequiresAuth verifies export is admin-gated too.
func TestExportPost_RequiresAuth(t *testing.T) {
	app := setupApp(t)
	mux := buildRouter(t, app)

	req := httptest.NewRequest(http.MethodGet, "/api/vanblog/export/all", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("unauthenticated export: got %d, want 403", rec.Code)
	}
}
