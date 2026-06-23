package article

import (
	"os"
	"testing"
	"time"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func setupApp(t *testing.T) core.App {
	t.Helper()
	tmpDir, _ := os.MkdirTemp("", "pb-article-test")
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

func createPost(t *testing.T, app core.App, title, content, status, pathname string) *core.Record {
	t.Helper()
	col, _ := app.FindCollectionByNameOrId("posts")
	r := core.NewRecord(col)
	r.Set("title", title)
	r.Set("content", content)
	r.Set("status", status)
	r.Set("pathname", pathname)
	if err := app.Save(r); err != nil {
		t.Fatalf("create post: %v", err)
	}
	return r
}

func createCategory(t *testing.T, app core.App, name string) *core.Record {
	t.Helper()
	col, _ := app.FindCollectionByNameOrId("categories")
	r := core.NewRecord(col)
	r.Set("name", name)
	if err := app.Save(r); err != nil {
		t.Fatalf("create category: %v", err)
	}
	return r
}

func TestGetTimeline(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	createPost(t, app, "Post 1", "content1", "published", "/post-1")
	time.Sleep(10 * time.Millisecond)
	createPost(t, app, "Post 2", "content2", "published", "/post-2")
	createPost(t, app, "Draft", "draft content", "draft", "/draft")

	timeline, err := mgr.GetTimeline()
	if err != nil {
		t.Fatalf("GetTimeline: %v", err)
	}

	if len(timeline) == 0 {
		t.Fatal("expected at least 1 year entry")
	}

	// Should have current year
	now := time.Now()
	if timeline[0].Year != now.Year() {
		t.Errorf("year = %d, want %d", timeline[0].Year, now.Year())
	}

	// Should only count published (2, not 3)
	if timeline[0].Count != 2 {
		t.Errorf("year count = %d, want 2 (draft excluded)", timeline[0].Count)
	}
}

func TestSearch(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	createPost(t, app, "Learning Go Programming", "Go is a great language", "published", "/go")
	createPost(t, app, "Rust vs Go", "Comparison article", "published", "/rust-vs-go")
	createPost(t, app, "Cooking Tips", "How to cook pasta", "published", "/cooking")

	// Search for "Go"
	results, err := mgr.Search("Go", 10)
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(results) != 2 {
		t.Errorf("search 'Go' = %d results, want 2", len(results))
	}

	// Search for "pasta" (content match)
	results2, _ := mgr.Search("pasta", 10)
	if len(results2) != 1 {
		t.Errorf("search 'pasta' = %d results, want 1", len(results2))
	}

	// Search with no matches
	results3, _ := mgr.Search("nonexistent", 10)
	if len(results3) != 0 {
		t.Errorf("search 'nonexistent' = %d results, want 0", len(results3))
	}
}

func TestPublish(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	post := createPost(t, app, "Draft", "content", "draft", "/draft")

	// Publish
	if err := mgr.Publish(post.Id); err != nil {
		t.Fatalf("Publish: %v", err)
	}

	updated, _ := app.FindRecordById("posts", post.Id)
	if updated.GetString("status") != "published" {
		t.Errorf("status = %q, want %q", updated.GetString("status"), "published")
	}

	// Publish again (no-op)
	if err := mgr.Publish(post.Id); err != nil {
		t.Fatalf("Publish again: %v", err)
	}

	// Unpublish
	if err := mgr.Unpublish(post.Id); err != nil {
		t.Fatalf("Unpublish: %v", err)
	}

	updated2, _ := app.FindRecordById("posts", post.Id)
	if updated2.GetString("status") != "draft" {
		t.Errorf("after unpublish, status = %q, want %q", updated2.GetString("status"), "draft")
	}
}

func TestGetByPathname(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	createPost(t, app, "Published", "content", "published", "/my-post")
	createPost(t, app, "Draft", "content", "draft", "/draft-post")

	// Find published post by path
	post, err := mgr.GetByPathname("/my-post")
	if err != nil {
		t.Fatalf("GetByPathname: %v", err)
	}
	if post.GetString("title") != "Published" {
		t.Errorf("title = %q, want %q", post.GetString("title"), "Published")
	}

	// Draft should not be found
	_, err = mgr.GetByPathname("/draft-post")
	if err == nil {
		t.Error("draft post should not be found via GetByPathname")
	}
}

func TestGetRecent(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	createPost(t, app, "Post 1", "c1", "published", "/p1")
	time.Sleep(10 * time.Millisecond)
	createPost(t, app, "Post 2", "c2", "published", "/p2")
	time.Sleep(10 * time.Millisecond)
	createPost(t, app, "Post 3", "c3", "published", "/p3")

	recent, err := mgr.GetRecent(2)
	if err != nil {
		t.Fatalf("GetRecent: %v", err)
	}
	if len(recent) != 2 {
		t.Fatalf("expected 2 recent posts, got %d", len(recent))
	}
	// Should be ordered newest first
	if recent[0].GetString("title") != "Post 3" {
		t.Errorf("newest = %q, want %q", recent[0].GetString("title"), "Post 3")
	}
}

func TestGetByCategory(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	cat := createCategory(t, app, "Tech")

	col, _ := app.FindCollectionByNameOrId("posts")
	p1 := core.NewRecord(col)
	p1.Set("title", "In Tech")
	p1.Set("status", "published")
	p1.Set("category", cat.Id)
	app.Save(p1)

	p2 := core.NewRecord(col)
	p2.Set("title", "Also Tech")
	p2.Set("status", "published")
	p2.Set("category", cat.Id)
	app.Save(p2)

	p3 := core.NewRecord(col)
	p3.Set("title", "Not in Tech")
	p3.Set("status", "published")
	app.Save(p3)

	results, err := mgr.GetByCategory(cat.Id, 10, 0)
	if err != nil {
		t.Fatalf("GetByCategory: %v", err)
	}
	if len(results) != 2 {
		t.Errorf("category posts = %d, want 2", len(results))
	}
}
