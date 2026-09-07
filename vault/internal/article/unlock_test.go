package article

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/cornworld/vanblog/internal/feed"
	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// buildRouter registers the article routes and returns an http.Handler that
// serves real requests through pb's router (record CRUD + enrich pipeline).
func buildRouter(t *testing.T, app core.App) http.Handler {
	t.Helper()
	New(app)

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

// createLockedPost creates a published, non-private post with a password —
// the shape the theme's unlock flow targets.
func createLockedPost(t *testing.T, app core.App, pathname, password string) *core.Record {
	t.Helper()
	col, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Fatalf("find posts: %v", err)
	}
	r := core.NewRecord(col)
	r.Set("title", "Locked")
	r.Set("content", "SECRETBODY 锁定正文")
	r.Set("status", "published")
	r.Set("pathname", pathname)
	r.Set("password", password)
	if err := app.Save(r); err != nil {
		t.Fatalf("create locked post: %v", err)
	}
	return r
}

func createAdminToken(t *testing.T, app core.App) string {
	t.Helper()
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("find users: %v", err)
	}
	rec := core.NewRecord(users)
	rec.SetEmail("admin@test.dev")
	rec.Set("username", "admin")
	rec.Set("role", "admin")
	rec.Set("permissions", []string{"all"})
	rec.Set("password", "password12345")
	rec.Set("passwordConfirm", "password12345")
	if err := app.Save(rec); err != nil {
		t.Fatalf("create admin: %v", err)
	}
	token, err := rec.NewAuthToken()
	if err != nil {
		t.Fatalf("auth token: %v", err)
	}
	return token
}

func getJSON(t *testing.T, mux http.Handler, path, token string) (int, map[string]any) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	return rec.Code, body
}

func TestMasking_AnonymousCannotReadLockedRow(t *testing.T) {
	app := setupApp(t)
	mux := buildRouter(t, app)
	post := createLockedPost(t, app, "/locked", "pw123")

	code, body := getJSON(t, mux, "/api/collections/posts/records/"+post.Id, "")
	if code != http.StatusOK {
		t.Fatalf("anon GET locked post = %d, want 200 (ViewRule allows the row)", code)
	}
	if got, _ := body["content"].(string); got != "" {
		t.Errorf("anon content leaked: %q", got)
	}
	if got, _ := body["password"].(string); got != "" {
		t.Errorf("anon password leaked: %q", got)
	}
	if got, _ := body["hasPassword"].(bool); !got {
		t.Errorf("hasPassword should stay visible for the lock UI, got %v", body["hasPassword"])
	}
	if got, _ := body["title"].(string); got != "Locked" {
		t.Errorf("non-sensitive fields must survive masking, title=%q", got)
	}
}

func TestMasking_AuthenticatedSeesFullRow(t *testing.T) {
	app := setupApp(t)
	mux := buildRouter(t, app)
	post := createLockedPost(t, app, "/locked", "pw123")
	token := createAdminToken(t, app)

	code, body := getJSON(t, mux, "/api/collections/posts/records/"+post.Id, token)
	if code != http.StatusOK {
		t.Fatalf("auth GET = %d", code)
	}
	if got, _ := body["content"].(string); got != "SECRETBODY 锁定正文" {
		t.Errorf("authenticated content masked, got %q", got)
	}
	if got, _ := body["password"].(string); got != "pw123" {
		t.Errorf("authenticated password masked, got %q", got)
	}
}

func TestHasPassword_MaintainedOnWrite(t *testing.T) {
	app := setupApp(t)
	buildRouter(t, app)
	post := createLockedPost(t, app, "/locked", "pw123")

	reloaded, err := app.FindRecordById("posts", post.Id)
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	if !reloaded.GetBool("hasPassword") {
		t.Error("hasPassword not set for password post")
	}

	// Removing the password clears the flag.
	reloaded.Set("password", "")
	if err := app.Save(reloaded); err != nil {
		t.Fatalf("save: %v", err)
	}
	reloaded, _ = app.FindRecordById("posts", post.Id)
	if reloaded.GetBool("hasPassword") {
		t.Error("hasPassword not cleared after password removal")
	}
}

func TestMasking_CategoryPasswordHiddenFromAnonymous(t *testing.T) {
	app := setupApp(t)
	mux := buildRouter(t, app)
	col, err := app.FindCollectionByNameOrId("categories")
	if err != nil {
		t.Fatalf("find categories: %v", err)
	}
	cat := core.NewRecord(col)
	cat.Set("name", "Private")
	cat.Set("password", "catpw")
	if err := app.Save(cat); err != nil {
		t.Fatalf("save category: %v", err)
	}

	_, body := getJSON(t, mux, "/api/collections/categories/records/"+cat.Id, "")
	if got, _ := body["password"].(string); got != "" {
		t.Errorf("anon category password leaked: %q", got)
	}
}

func postUnlock(t *testing.T, mux http.Handler, id, body, cookie string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/vanblog/posts/"+id+"/unlock", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func TestUnlockEndpoint(t *testing.T) {
	app := setupApp(t)
	mux := buildRouter(t, app)
	post := createLockedPost(t, app, "/locked", "rightpw")

	// Wrong password → 401.
	rec := postUnlock(t, mux, post.Id, `{"password":"wrongpw"}`, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong password = %d, want 401", rec.Code)
	}

	// Right password → 200 + content + Set-Cookie unlock token.
	rec = postUnlock(t, mux, post.Id, `{"password":"rightpw","basePath":""}`, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("right password = %d %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Content string `json:"content"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil || resp.Content != "SECRETBODY 锁定正文" {
		t.Fatalf("unlock content = %q err=%v", resp.Content, err)
	}
	var unlock *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == "vb-unlock-"+post.Id {
			unlock = c
		}
	}
	if unlock == nil || unlock.Value == "true" || unlock.Value == "" {
		t.Fatalf("unlock cookie missing/unsigned: %+v", rec.Result().Cookies())
	}

	// Cookie replay without password → 200 (signed token accepted).
	rec = postUnlock(t, mux, post.Id, "{}", unlock.Name+"="+unlock.Value)
	if rec.Code != http.StatusOK {
		t.Fatalf("cookie replay = %d %s", rec.Code, rec.Body.String())
	}

	// Forged literal cookie (the old scheme) → rejected.
	rec = postUnlock(t, mux, post.Id, "{}", unlock.Name+"=true")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("forged cookie = %d, want 401", rec.Code)
	}
}

func TestUnlockEndpoint_ThrottlesBruteForce(t *testing.T) {
	app := setupApp(t)
	mux := buildRouter(t, app)
	post := createLockedPost(t, app, "/locked", "rightpw")

	var last int
	for i := range unlockMaxAttempts + 2 {
		guess := "guess" + string(rune('a'+i))
		last = postUnlock(t, mux, post.Id, `{"password":"`+guess+`"}`, "").Code
	}
	if last != http.StatusTooManyRequests {
		t.Fatalf("after %d guesses = %d, want 429", unlockMaxAttempts+2, last)
	}
}

func TestUnlockEndpoint_NoOracleForMissingPosts(t *testing.T) {
	app := setupApp(t)
	mux := buildRouter(t, app)
	// No-password published post must look identical to a missing one.
	createPost(t, app, "Open", "plain", "published", "/open")

	for _, id := range []string{"nonexistent000"} {
		rec := postUnlock(t, mux, id, "{}", "")
		if rec.Code != http.StatusNotFound {
			t.Fatalf("unlock %q = %d, want 404", id, rec.Code)
		}
	}
}

func TestFeedAndSearchExcludeLockedPosts(t *testing.T) {
	app := setupApp(t)
	buildRouter(t, app)
	createLockedPost(t, app, "/locked", "pw")
	createPost(t, app, "Open", "open body", "published", "/open")

	rss, err := feed.GenerateRSS(app, 20)
	if err != nil {
		t.Fatalf("rss: %v", err)
	}
	if strings.Contains(string(rss), "SECRETBODY") {
		t.Error("RSS leaks locked post content")
	}

	mgr := &Manager{app: app}
	results, err := mgr.Search("SECRETBODY", 10)
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("search hits locked post content: %+v", results)
	}
}
