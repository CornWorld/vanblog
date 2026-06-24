// Package hooks contains integration tests that verify the hooks layer
// correctly wires vanblog's business packages (article, revisions, visits,
// feed, caddy, migration, site) into PocketBase.
//
// Testing strategy:
//   - Event hooks (OnRecordUpdateRequest, OnRecordCreateRequest) are thin
//     closures that delegate to Manager methods. We verify the delegation
//     target (the Manager method) behaves correctly, which is the actual
//     business logic the hook protects. The hook glue itself is verified
//     by the TestHooksRegisterSmoke test (Register must not panic and must
//     attach the expected number of bindings).
//   - HTTP routes (OnServe.BindFunc → se.Router.{GET,POST}) are also thin
//     delegates. We test the underlying business function directly.
//   - We avoid manually constructing *core.RequestEvent because its
//     embedded router.Event has an unexported `data` store that panics
//     on Set() when zero-initialized. Testing business functions directly
//     is both simpler and more meaningful.
package hooks

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/cornworld/vanblog/internal/article"
	"github.com/cornworld/vanblog/internal/caddy"
	"github.com/cornworld/vanblog/internal/feed"
	"github.com/cornworld/vanblog/internal/migration"
	"github.com/cornworld/vanblog/internal/revisions"
	"github.com/cornworld/vanblog/internal/site"
	"github.com/cornworld/vanblog/internal/visits"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// setupApp bootstraps an in-process PocketBase with all vanblog migrations
// applied. The temp data dir is cleaned up via t.Cleanup.
func setupApp(t *testing.T) core.App {
	t.Helper()
	tmpDir, err := os.MkdirTemp("", "pb-hooks-test")
	if err != nil {
		t.Fatalf("MkdirTemp: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("RunAppMigrations: %v", err)
	}
	return app
}

// createPost inserts a post record. status controls visibility; deleted is
// always set explicitly because the posts.deleted BoolField has no default
// and timeline/search filters require deleted=false.
func createPost(t *testing.T, app core.App, title, content, status, pathname string) *core.Record {
	t.Helper()
	col, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Fatalf("find posts collection: %v", err)
	}
	r := core.NewRecord(col)
	r.Set("title", title)
	r.Set("content", content)
	r.Set("status", status)
	r.Set("pathname", pathname)
	r.Set("deleted", false)
	if err := app.Save(r); err != nil {
		t.Fatalf("create post: %v", err)
	}
	return r
}

// =============================================================================
// Phase 1: Event Hook Business Logic
// =============================================================================
//
// The OnRecordUpdateRequest("posts") hook in hooks.go does:
//   1. Find old record by ID
//   2. revMgr.CaptureBeforeUpdate(oldRecord, ReasonAutoSave, "")
// The OnRecordCreateRequest("visits") hook does:
//   1. After next: read e.Record.GetString("post")
//   2. visitMgr.IncrementPostView(postID)
// We exercise the exact Manager calls the hooks make.

// TestRevisionsHookLogic simulates what the OnRecordUpdateRequest("posts")
// hook does: capture a snapshot of the old record before applying an update.
// Verifies that one revision exists containing the pre-update title.
func TestRevisionsHookLogic(t *testing.T) {
	app := setupApp(t)
	revMgr := revisions.New(app)

	post := createPost(t, app, "Original Title", "Hello world", "published", "/orig")

	// Simulate the hook: find old record, capture, then apply update.
	oldRecord, err := app.FindRecordById("posts", post.Id)
	if err != nil {
		t.Fatalf("FindRecordById: %v", err)
	}
	if err := revMgr.CaptureBeforeUpdate(oldRecord, revisions.ReasonAutoSave, ""); err != nil {
		t.Fatalf("CaptureBeforeUpdate: %v", err)
	}

	// Apply the update (what the HTTP request would have done).
	post.Set("title", "Updated Title")
	post.Set("content", "New content")
	if err := app.Save(post); err != nil {
		t.Fatalf("save updated post: %v", err)
	}

	revs, err := revMgr.List(post.Id, 10)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(revs) != 1 {
		t.Fatalf("expected 1 revision, got %d", len(revs))
	}

	snap, err := revisions.ExtractSnapshot(revs[0])
	if err != nil {
		t.Fatalf("ExtractSnapshot: %v", err)
	}
	if snap.Title != "Original Title" {
		t.Errorf("snapshot title = %q, want %q", snap.Title, "Original Title")
	}
	if snap.Content != "Hello world" {
		t.Errorf("snapshot content = %q, want %q", snap.Content, "Hello world")
	}
}

// TestRevisionsMultipleCaptures verifies that three sequential captures
// produce three revisions, ordered newest-first.
func TestRevisionsMultipleCaptures(t *testing.T) {
	app := setupApp(t)
	revMgr := revisions.New(app)

	post := createPost(t, app, "v1", "c1", "published", "/v1")

	versions := []struct{ title, content string }{
		{"v2", "c2"},
		{"v3", "c3"},
		{"v4", "c4"},
	}
	for _, v := range versions {
		old, err := app.FindRecordById("posts", post.Id)
		if err != nil {
			t.Fatalf("FindRecordById: %v", err)
		}
		if err := revMgr.CaptureBeforeUpdate(old, revisions.ReasonAutoSave, ""); err != nil {
			t.Fatalf("CaptureBeforeUpdate: %v", err)
		}
		post.Set("title", v.title)
		post.Set("content", v.content)
		if err := app.Save(post); err != nil {
			t.Fatalf("save: %v", err)
		}
		// pb created field has second precision on some drivers; sleep to
		// guarantee stable ordering across captures.
		time.Sleep(10 * time.Millisecond)
	}

	revs, err := revMgr.List(post.Id, 10)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(revs) != 3 {
		t.Fatalf("expected 3 revisions, got %d", len(revs))
	}

	// Newest first: v3 was the last state captured (before update to v4).
	snap0, _ := revisions.ExtractSnapshot(revs[0])
	if snap0.Title != "v3" {
		t.Errorf("newest snapshot title = %q, want %q", snap0.Title, "v3")
	}
	snap2, _ := revisions.ExtractSnapshot(revs[2])
	if snap2.Title != "v1" {
		t.Errorf("oldest snapshot title = %q, want %q", snap2.Title, "v1")
	}
}

// TestVisitsHookLogic simulates what the OnRecordCreateRequest("visits")
// hook does after a visit is created: increment the related post's viewCount.
func TestVisitsHookLogic(t *testing.T) {
	app := setupApp(t)
	visitMgr := visits.New(app)

	post := createPost(t, app, "Visited Post", "content", "published", "/visited")
	if got := post.GetInt("viewCount"); got != 0 {
		t.Fatalf("initial viewCount = %d, want 0", got)
	}

	// Simulate the hook body: visitMgr.IncrementPostView(postID).
	visitMgr.IncrementPostView(post.Id)
	visitMgr.IncrementPostView(post.Id)
	visitMgr.IncrementPostView(post.Id)

	after, err := app.FindRecordById("posts", post.Id)
	if err != nil {
		t.Fatalf("FindRecordById: %v", err)
	}
	if got := after.GetInt("viewCount"); got != 3 {
		t.Errorf("viewCount after 3 increments = %d, want 3", got)
	}
}

// TestVisitsHookIgnoresMissingPost verifies IncrementPostView does not panic
// when the post does not exist (the hook must not break visit creation if
// the relation is dangling).
func TestVisitsHookIgnoresMissingPost(t *testing.T) {
	app := setupApp(t)
	visitMgr := visits.New(app)

	// Non-existent post ID — must be a no-op, not a panic.
	visitMgr.IncrementPostView("nonexistent-record-id")

	// Also safe with empty string (the hook guards postID != "" before
	// calling, but the manager should tolerate it anyway).
	visitMgr.IncrementPostView("")
}

// =============================================================================
// Phase 2: HTTP Route Business Logic
// =============================================================================
//
// Each route handler in hooks.go delegates to a business function.
// We test those functions directly.

// TestSearchRouteLogic mirrors GET /api/vanblog/search?q=... which calls
// articleMgr.Search(q, 20).
func TestSearchRouteLogic(t *testing.T) {
	app := setupApp(t)
	articleMgr := article.New(app)

	createPost(t, app, "Learning Golang", "Golang is great", "published", "/golang")
	createPost(t, app, "Cooking Pasta", "Boil water first", "published", "/pasta")
	// Drafts should NOT appear in search results even if they match.
	createPost(t, app, "Golang Draft", "draft about golang", "draft", "/golang-draft")

	// Search "golang": 1 published match.
	results, err := articleMgr.Search("golang", 20)
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("search 'golang' = %d results, want 1", len(results))
	}
	if results[0].Title != "Learning Golang" {
		t.Errorf("result title = %q, want %q", results[0].Title, "Learning Golang")
	}

	// Search with no matches.
	empty, err := articleMgr.Search("nonexistent-term", 20)
	if err != nil {
		t.Fatalf("Search empty: %v", err)
	}
	if len(empty) != 0 {
		t.Errorf("search 'nonexistent-term' = %d, want 0", len(empty))
	}
}

// TestTimelineRouteLogic mirrors GET /api/vanblog/timeline which calls
// articleMgr.GetTimeline(). Drafts are excluded by the filter.
func TestTimelineRouteLogic(t *testing.T) {
	app := setupApp(t)
	articleMgr := article.New(app)

	// 3 published + 1 draft (draft should be excluded).
	createPost(t, app, "Pub 1", "c1", "published", "/p1")
	time.Sleep(10 * time.Millisecond)
	createPost(t, app, "Pub 2", "c2", "published", "/p2")
	time.Sleep(10 * time.Millisecond)
	createPost(t, app, "Pub 3", "c3", "published", "/p3")
	createPost(t, app, "Draft", "cd", "draft", "/draft")

	timeline, err := articleMgr.GetTimeline()
	if err != nil {
		t.Fatalf("GetTimeline: %v", err)
	}
	if len(timeline) == 0 {
		t.Fatal("expected at least 1 year entry, got 0")
	}

	// All entries should be in the current year (posts were just created).
	now := time.Now()
	yearTotal := 0
	for _, entry := range timeline {
		if entry.Year != now.Year() {
			continue
		}
		yearTotal += entry.Count
	}
	if yearTotal != 3 {
		t.Errorf("current year post count = %d, want 3 (draft excluded)", yearTotal)
	}
}

// TestFeedRouteLogic mirrors the three feed routes:
//   - GET /api/feed.xml    → feed.GenerateRSS(app, 20)
//   - GET /api/atom.xml    → feed.GenerateAtom(app, 20)
//   - GET /api/sitemap.xml → feed.GenerateSitemap(app)
func TestFeedRouteLogic(t *testing.T) {
	app := setupApp(t)

	// Configure site.baseURL so feed links are well-formed.
	siteRec, err := site.Get(app)
	if err != nil {
		t.Fatalf("site.Get: %v", err)
	}
	siteRec.Set("baseUrl", "https://blog.example.com")
	siteRec.Set("siteName", "Test Blog")
	if err := app.Save(siteRec); err != nil {
		t.Fatalf("save site: %v", err)
	}

	createPost(t, app, "Feed Post", "Body of the post", "published", "/feed-post")

	// RSS
	rssBytes, err := feed.GenerateRSS(app, 20)
	if err != nil {
		t.Fatalf("GenerateRSS: %v", err)
	}
	rssStr := string(rssBytes)
	if !strings.Contains(rssStr, "<rss") {
		t.Errorf("RSS output missing <rss element")
	}
	if !strings.Contains(rssStr, "<title>") {
		t.Errorf("RSS output missing <title> element")
	}
	if !strings.Contains(rssStr, "Feed Post") {
		t.Errorf("RSS output does not include post title")
	}

	// Atom
	atomBytes, err := feed.GenerateAtom(app, 20)
	if err != nil {
		t.Fatalf("GenerateAtom: %v", err)
	}
	atomStr := string(atomBytes)
	if !strings.Contains(atomStr, "<feed") {
		t.Errorf("Atom output missing <feed element")
	}
	if !strings.Contains(atomStr, "Feed Post") {
		t.Errorf("Atom output does not include post title")
	}

	// Sitemap
	sitemapBytes, err := feed.GenerateSitemap(app)
	if err != nil {
		t.Fatalf("GenerateSitemap: %v", err)
	}
	sitemapStr := string(sitemapBytes)
	if !strings.Contains(sitemapStr, "<urlset") {
		t.Errorf("Sitemap output missing <urlset element")
	}
	if !strings.Contains(sitemapStr, "/feed-post") {
		t.Errorf("Sitemap output does not include post path")
	}
}

// TestFeedRouteEmptyDB verifies the feed functions succeed on an empty
// database (the routes must return valid empty feeds, not 500s).
func TestFeedRouteEmptyDB(t *testing.T) {
	app := setupApp(t)

	if _, err := feed.GenerateRSS(app, 20); err != nil {
		t.Errorf("GenerateRSS on empty DB: %v", err)
	}
	if _, err := feed.GenerateAtom(app, 20); err != nil {
		t.Errorf("GenerateAtom on empty DB: %v", err)
	}
	if _, err := feed.GenerateSitemap(app); err != nil {
		t.Errorf("GenerateSitemap on empty DB: %v", err)
	}
}

// TestCaddyAskRouteLogic mirrors GET /api/hooks/caddy/ask?domain=... which
// calls caddy.AskHandler(info.AllowedDomains, domain).
// AskHandler: empty allow-list means "allow all"; otherwise exact
// case-insensitive match.
func TestCaddyAskRouteLogic(t *testing.T) {
	allowed := []string{"example.com", "blog.example.com"}

	cases := []struct {
		name   string
		domain string
		want   bool
	}{
		{"exact match", "example.com", true},
		{"subdomain match", "blog.example.com", true},
		{"case-insensitive match", "EXAMPLE.COM", true},
		{"non-matching domain", "evil.com", false},
		{"empty domain", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := caddy.AskHandler(allowed, tc.domain, true) // post-setup: hasAdmin=true
			if got != tc.want {
				t.Errorf("AskHandler(%q) post-setup = %v, want %v", tc.domain, got, tc.want)
			}
		})
	}

	// Setup window (no admin) → allow all
	if !caddy.AskHandler(nil, "anything.example", false) {
		t.Error("AskHandler setup window (no admin) should allow all")
	}

	// Post-setup with empty allowlist → deny all (safety)
	if caddy.AskHandler(nil, "anything.example", true) {
		t.Error("AskHandler post-setup with empty allowlist should deny")
	}
}

// =============================================================================
// Phase 3: Migration End-to-End
// =============================================================================
//
// Mirrors POST /api/vanblog/migrate/import which calls imp.Import(body).

// TestMigrationImportE2E verifies a full legacy backup imports correctly,
// including tag deduplication and category creation.
func TestMigrationImportE2E(t *testing.T) {
	app := setupApp(t)
	imp := migration.New(app)

	// Build a legacy backup. Tags list has a duplicate "go" which should be
	// deduplicated by importTags.
	backup := migration.LegacyBackup{
		Articles: []migration.LegacyArticle{
			{
				ID:       1,
				Title:    "Art 1",
				Content:  "Hello",
				Tags:     []string{"go", "web"},
				Category: "Tech",
				Pathname: "/art-1",
			},
		},
		Drafts: []migration.LegacyDraft{
			{
				ID:       2,
				Title:    "Draft 1",
				Content:  "WIP",
				Tags:     []string{"go"},
				Category: "Tech",
			},
		},
		Categories: []migration.LegacyCategory{
			{ID: 1, Name: "Tech", Type: "category"},
		},
		// Duplicate "go" must be deduplicated by importTags.
		Tags: []string{"go", "web", "go"},
		// Required-but-unused fields: provide empty RawMessage so JSON
		// unmarshalling does not fail on missing keys.
		Meta:    json.RawMessage(`{}`),
		User:    json.RawMessage(`{}`),
		Viewer:  json.RawMessage(`[]`),
		Visit:   json.RawMessage(`[]`),
		Setting: json.RawMessage(`{}`),
	}
	data, err := json.Marshal(backup)
	if err != nil {
		t.Fatalf("marshal backup: %v", err)
	}

	result, err := imp.Import(data)
	if err != nil {
		t.Fatalf("Import: %v", err)
	}

	// 1 article + 1 draft = 2 posts. (The migration archive is a separate
	// hidden post but is NOT counted in result.Posts.)
	if result.Posts != 2 {
		t.Errorf("result.Posts = %d, want 2", result.Posts)
	}
	// Tags deduplicated: {go, web} = 2.
	if result.Tags != 2 {
		t.Errorf("result.Tags = %d, want 2 (deduplicated)", result.Tags)
	}
	if result.Categories != 1 {
		t.Errorf("result.Categories = %d, want 1", result.Categories)
	}
	if !result.Archive {
		t.Error("result.Archive = false, want true")
	}

	// Verify posts actually persisted.
	posts, _ := app.FindRecordsByFilter("posts", "status='published'", "", 0, 0)
	if len(posts) != 1 {
		t.Errorf("published posts in DB = %d, want 1", len(posts))
	}
	drafts, _ := app.FindRecordsByFilter("posts", "status='draft'", "", 0, 0)
	if len(drafts) != 1 {
		t.Errorf("draft posts in DB = %d, want 1", len(drafts))
	}

	// Verify tags actually persisted and unique.
	tags, _ := app.FindRecordsByFilter("tags", "", "", 0, 0)
	if len(tags) != 2 {
		t.Errorf("tags in DB = %d, want 2", len(tags))
	}
}

// TestMigrationImportInvalidJSON verifies that malformed JSON returns an
// error and leaves the database untouched (transaction rollback).
func TestMigrationImportInvalidJSON(t *testing.T) {
	app := setupApp(t)
	imp := migration.New(app)

	_, err := imp.Import([]byte(`{"articles": [invalid JSON}`))
	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}

	// Database must be empty — no partial writes.
	posts, _ := app.FindRecordsByFilter("posts", "", "", 0, 0)
	if len(posts) != 0 {
		t.Errorf("posts after failed import = %d, want 0 (rollback)", len(posts))
	}
	tags, _ := app.FindRecordsByFilter("tags", "", "", 0, 0)
	if len(tags) != 0 {
		t.Errorf("tags after failed import = %d, want 0 (rollback)", len(tags))
	}
}

// =============================================================================
// Smoke Test
// =============================================================================

// TestHooksRegisterSmoke verifies that hooks.Register completes without
// panicking and attaches at least the expected number of hook bindings.
// This guards against regressions where a new route or event hook is
// accidentally omitted from Register.
func TestHooksRegisterSmoke(t *testing.T) {
	app := setupApp(t)

	// Snapshot hook handler counts before Register so we can assert growth.
	// OnRecordUpdateRequest("posts") and OnRecordCreateRequest("visits") are
	// the two event hooks registered; OnServe adds the route-bind closure.
	// Each adds one handler via BindFunc.
	//
	// PocketBase's hook.Hook exposes Length() (not Bindings()) to count
	// registered handlers.
	beforeUpdate := app.OnRecordUpdateRequest("posts").Length()
	beforeCreate := app.OnRecordCreateRequest("visits").Length()
	beforeServe := app.OnServe().Length()

	// Register must not panic.
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("Register panicked: %v", r)
		}
	}()
	Register(app)

	// After Register, each hook should have at least one more handler.
	afterUpdate := app.OnRecordUpdateRequest("posts").Length()
	if afterUpdate <= beforeUpdate {
		t.Errorf("OnRecordUpdateRequest(posts).Length() = %d, want > %d", afterUpdate, beforeUpdate)
	}

	afterCreate := app.OnRecordCreateRequest("visits").Length()
	if afterCreate <= beforeCreate {
		t.Errorf("OnRecordCreateRequest(visits).Length() = %d, want > %d", afterCreate, beforeCreate)
	}

	afterServe := app.OnServe().Length()
	if afterServe <= beforeServe {
		t.Errorf("OnServe().Length() = %d, want > %d", afterServe, beforeServe)
	}
}
