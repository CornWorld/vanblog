package feed

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
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
	r.Set("pathname", "/"+strings.ToLower(title))
	if err := app.Save(r); err != nil {
		t.Fatal(err)
	}
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

func setFeedLimit(t *testing.T, app core.App, v int) {
	t.Helper()
	siteRec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil {
		t.Fatalf("site get: %v", err)
	}
	var opts map[string]any
	if raw := siteRec.GetString("displayOptions"); raw != "" {
		_ = json.Unmarshal([]byte(raw), &opts)
	}
	if opts == nil {
		opts = map[string]any{}
	}
	opts["feedLimit"] = v
	b, _ := json.Marshal(opts)
	siteRec.Set("displayOptions", string(b))
	if err := app.Save(siteRec); err != nil {
		t.Fatalf("site save: %v", err)
	}
}

// TestFeedLimitFromSiteConfig 钉住:RSS 路由按 displayOptions.feedLimit
// 出条目(缺省 20;越界回缺省;上界 100)。
func TestFeedLimitFromSiteConfig(t *testing.T) {
	app := setupApp(t)
	for i := 0; i < 5; i++ {
		createPost(t, app, fmt.Sprintf("Post%d", i))
	}
	s := New(app)

	serveRSSBody := func() string {
		rec := httptest.NewRecorder()
		ev := &core.RequestEvent{
			App:      app,
			Request:  httptest.NewRequest("GET", "/api/feed.xml", nil),
			Response: rec,
		}
		if err := s.serveRSS(ev); err != nil {
			t.Fatalf("serveRSS: %v", err)
		}
		return rec.Body.String()
	}
	count := func(body string) int { return strings.Count(body, "<item>") }

	// 缺省 20 → 5 篇全出。
	if got := count(serveRSSBody()); got != 5 {
		t.Fatalf("default feed items = %d, want 5", got)
	}

	// feedLimit=3 → 恰 3 条。
	setFeedLimit(t, app, 3)
	if got := count(serveRSSBody()); got != 3 {
		t.Fatalf("feed items with feedLimit=3 = %d, want 3", got)
	}

	// 越界(500 > 100)→ 回缺省 20 → 5 篇全出。
	setFeedLimit(t, app, 500)
	if got := count(serveRSSBody()); got != 5 {
		t.Fatalf("feed items with out-of-range feedLimit = %d, want 5", got)
	}

	// Atom 同规则。
	setFeedLimit(t, app, 2)
	rec := httptest.NewRecorder()
	ev := &core.RequestEvent{
		App:      app,
		Request:  httptest.NewRequest("GET", "/api/atom.xml", nil),
		Response: rec,
	}
	if err := s.serveAtom(ev); err != nil {
		t.Fatalf("serveAtom: %v", err)
	}
	if got := strings.Count(rec.Body.String(), "<entry>"); got != 2 {
		t.Fatalf("atom entries with feedLimit=2 = %d, want 2", got)
	}
}
