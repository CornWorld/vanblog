package visits

import (
	"os"
	"testing"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func setupApp(t *testing.T) core.App {
	t.Helper()
	tmpDir, _ := os.MkdirTemp("", "pb-visits-test")
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

func createTestPost(t *testing.T, app core.App, title string) *core.Record {
	t.Helper()
	col, _ := app.FindCollectionByNameOrId("posts")
	r := core.NewRecord(col)
	r.Set("title", title)
	r.Set("status", "published")
	if err := app.Save(r); err != nil {
		t.Fatalf("create post: %v", err)
	}
	return r
}

func TestIncrement_NewPath(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	if err := mgr.Increment("/hello-world", ""); err != nil {
		t.Fatalf("Increment: %v", err)
	}

	// Verify visit record created
	records, _ := app.FindRecordsByFilter("visits", "", "", 0, 0)
	if len(records) != 1 {
		t.Fatalf("expected 1 visit record, got %d", len(records))
	}
	if records[0].GetInt("views") != 1 {
		t.Errorf("views = %d, want 1", records[0].GetInt("views"))
	}
}

func TestIncrement_ExistingPath(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	// First view
	mgr.Increment("/page", "")
	// Second view
	mgr.Increment("/page", "")
	// Third view
	mgr.Increment("/page", "")

	records, _ := app.FindRecordsByFilter("visits", "path='/page'", "", 0, 0)
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	if records[0].GetInt("views") != 3 {
		t.Errorf("views = %d, want 3", records[0].GetInt("views"))
	}
}

func TestIncrement_WithPost(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	post := createTestPost(t, app, "Test Post")

	// Visit with post association
	mgr.Increment("/test-post", post.Id)
	mgr.Increment("/test-post", post.Id)

	// Check post viewCount was incremented
	updatedPost, _ := app.FindRecordById("posts", post.Id)
	if updatedPost.GetInt("viewCount") != 2 {
		t.Errorf("post viewCount = %d, want 2", updatedPost.GetInt("viewCount"))
	}
}

func TestIncrement_MultiplePaths(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	mgr.Increment("/page-a", "")
	mgr.Increment("/page-a", "")
	mgr.Increment("/page-b", "")

	records, _ := app.FindRecordsByFilter("visits", "", "", 0, 0)
	if len(records) != 2 {
		t.Errorf("expected 2 visit records (2 unique paths), got %d", len(records))
	}
}

func TestGetTopPosts(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	p1 := createTestPost(t, app, "Popular")
	p2 := createTestPost(t, app, "Medium")
	p3 := createTestPost(t, app, "Less Popular")

	// Give them different view counts
	p1.Set("viewCount", 100)
	app.Save(p1)
	p2.Set("viewCount", 50)
	app.Save(p2)
	p3.Set("viewCount", 10)
	app.Save(p3)

	top, err := mgr.GetTopPosts(2)
	if err != nil {
		t.Fatalf("GetTopPosts: %v", err)
	}
	if len(top) != 2 {
		t.Fatalf("expected 2 top posts, got %d", len(top))
	}
	if top[0].GetString("title") != "Popular" {
		t.Errorf("top post = %q, want %q", top[0].GetString("title"), "Popular")
	}
	if top[1].GetString("title") != "Medium" {
		t.Errorf("2nd post = %q, want %q", top[1].GetString("title"), "Medium")
	}
}

func TestAggregateDaily(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	// Create some per-path visits for today
	mgr.Increment("/page-a", "")
	mgr.Increment("/page-a", "")
	mgr.Increment("/page-b", "")

	// Aggregate
	if err := mgr.AggregateDaily(""); err != nil {
		t.Fatalf("AggregateDaily: %v", err)
	}

	// Check summary
	views, uniques, err := mgr.GetDailySummary("")
	if err != nil {
		t.Fatalf("GetDailySummary: %v", err)
	}
	if views < 3 {
		t.Errorf("daily views = %d, want >= 3", views)
	}
	t.Logf("daily summary: views=%d, uniques=%d", views, uniques)
}
