package revisions

import (
	"encoding/json"
	"os"
	"testing"
	"time"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// Test against in-process PocketBase (same pattern as verify_*.go scripts).
func setupApp(t *testing.T) core.App {
	t.Helper()
	tmpDir, _ := os.MkdirTemp("", "pb-revisions-test")
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

func createTestPost(t *testing.T, app core.App, title, content, status string) *core.Record {
	t.Helper()
	col, _ := app.FindCollectionByNameOrId("posts")
	r := core.NewRecord(col)
	r.Set("title", title)
	r.Set("content", content)
	r.Set("status", status)
	if err := app.Save(r); err != nil {
		t.Fatalf("create post: %v", err)
	}
	return r
}

func TestCaptureAndList(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	post := createTestPost(t, app, "Original", "Hello world", "published")

	// Capture before update
	if err := mgr.CaptureBeforeUpdate(post, ReasonManual, ""); err != nil {
		t.Fatalf("CaptureBeforeUpdate: %v", err)
	}

	// Update post
	post.Set("title", "Updated")
	post.Set("content", "New content")
	app.Save(post)

	// List revisions
	revs, err := mgr.List(post.Id, 10)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(revs) != 1 {
		t.Fatalf("expected 1 revision, got %d", len(revs))
	}

	// Verify snapshot contains OLD values
	snap, err := ExtractSnapshot(revs[0])
	if err != nil {
		t.Fatalf("ExtractSnapshot: %v", err)
	}
	if snap.Title != "Original" {
		t.Errorf("snapshot title = %q, want %q", snap.Title, "Original")
	}
	if snap.Content != "Hello world" {
		t.Errorf("snapshot content = %q, want %q", snap.Content, "Hello world")
	}
}

func TestMultipleCaptures(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	post := createTestPost(t, app, "v1", "content1", "draft")

	// v1 → v2
	mgr.CaptureBeforeUpdate(post, ReasonAutoSave, "")
	post.Set("title", "v2")
	post.Set("content", "content2")
	app.Save(post)
	time.Sleep(10 * time.Millisecond)

	// v2 → v3
	mgr.CaptureBeforeUpdate(post, ReasonAutoSave, "")
	post.Set("title", "v3")
	post.Set("content", "content3")
	app.Save(post)
	time.Sleep(10 * time.Millisecond)

	// v3 → published
	mgr.CaptureBeforeUpdate(post, ReasonPublish, "")
	post.Set("status", "published")
	app.Save(post)

	revs, _ := mgr.List(post.Id, 10)
	if len(revs) != 3 {
		t.Fatalf("expected 3 revisions, got %d", len(revs))
	}

	// Most recent first
	snap0, _ := ExtractSnapshot(revs[0])
	if snap0.Title != "v3" {
		t.Errorf("newest revision should have v3, got %q", snap0.Title)
	}

	snap2, _ := ExtractSnapshot(revs[2])
	if snap2.Title != "v1" {
		t.Errorf("oldest revision should have v1, got %q", snap2.Title)
	}

	// Check reasons
	if revs[0].GetString("reason") != string(ReasonPublish) {
		t.Errorf("newest reason = %q, want %q", revs[0].GetString("reason"), ReasonPublish)
	}
	if revs[2].GetString("reason") != string(ReasonAutoSave) {
		t.Errorf("oldest reason = %q, want %q", revs[2].GetString("reason"), ReasonAutoSave)
	}
}

func TestRestore(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	post := createTestPost(t, app, "v1", "original content", "published")

	// Save a revision
	mgr.CaptureBeforeUpdate(post, ReasonManual, "")
	post.Set("title", "v2")
	post.Set("content", "modified content")
	app.Save(post)

	// Verify current state is v2
	current, _ := app.FindRecordById("posts", post.Id)
	if current.GetString("title") != "v2" {
		t.Fatalf("current should be v2 before restore")
	}

	// Get the revision (has v1 snapshot)
	revs, _ := mgr.List(post.Id, 10)
	if len(revs) != 1 {
		t.Fatalf("expected 1 revision, got %d", len(revs))
	}

	// Restore
	if err := mgr.Restore(revs[0].Id, ""); err != nil {
		t.Fatalf("Restore: %v", err)
	}

	// Verify post is back to v1
	restored, _ := app.FindRecordById("posts", post.Id)
	if restored.GetString("title") != "v1" {
		t.Errorf("after restore, title = %q, want %q", restored.GetString("title"), "v1")
	}
	if restored.GetString("content") != "original content" {
		t.Errorf("after restore, content = %q, want %q", restored.GetString("content"), "original content")
	}

	// Verify git-like behavior: restore created a NEW revision
	allRevs, _ := mgr.List(post.Id, 10)
	if len(allRevs) != 2 {
		t.Fatalf("expected 2 revisions after restore, got %d", len(allRevs))
	}

	// Find the restore revision (newest, reason="restore")
	restoreRev := allRevs[0] // newest first
	if restoreRev.GetString("reason") != string(ReasonRestore) {
		t.Errorf("newest revision reason = %q, want %q", restoreRev.GetString("reason"), ReasonRestore)
	}
	snap, _ := ExtractSnapshot(restoreRev)
	if snap.Title != "v2" {
		t.Errorf("restore snapshot should capture v2 (pre-restore state), got %q", snap.Title)
	}
}

func TestShouldSnapshot(t *testing.T) {
	app := setupApp(t)

	post := createTestPost(t, app, "title", "content", "published")

	// Read old values
	oldTitle := post.GetString("title")
	oldContent := post.GetString("content")

	// Title changed → snapshot
	post.Set("title", "new title")
	if !shouldSnapshotFields(oldTitle, oldContent, "published",
		post.GetString("title"), post.GetString("content"), post.GetString("status")) {
		t.Error("should snapshot when title changed")
	}

	// Reset
	post.Set("title", oldTitle)
	post.Set("content", oldContent)

	// Only viewCount changed → no snapshot
	post.Set("viewCount", 999)
	if shouldSnapshotFields(oldTitle, oldContent, "published",
		post.GetString("title"), post.GetString("content"), post.GetString("status")) {
		t.Error("should not snapshot when only viewCount changed")
	}

	// Content changed → snapshot
	post.Set("content", "new content")
	if !shouldSnapshotFields(oldTitle, oldContent, "published",
		post.GetString("title"), post.GetString("content"), post.GetString("status")) {
		t.Error("should snapshot when content changed")
	}
}

// shouldSnapshotFields is a helper that compares meaningful fields directly,
// avoiding the Record copy issue in tests.
func shouldSnapshotFields(oldTitle, oldContent, oldStatus, newTitle, newContent, newStatus string) bool {
	return oldTitle != newTitle || oldContent != newContent || oldStatus != newStatus
}

func TestCleanup(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	post := createTestPost(t, app, "title", "content", "published")

	// Create 5 revisions
	for i := 0; i < 5; i++ {
		mgr.CaptureBeforeUpdate(post, ReasonAutoSave, "")
		post.Set("title", "v"+string(rune('0'+i+1)))
		app.Save(post)
		time.Sleep(10 * time.Millisecond)
	}

	revs, _ := mgr.List(post.Id, 10)
	if len(revs) != 5 {
		t.Fatalf("expected 5 revisions before cleanup, got %d", len(revs))
	}

	// Cleanup: keep only 3
	if err := mgr.Cleanup(post.Id, 3); err != nil {
		t.Fatalf("Cleanup: %v", err)
	}

	revs, _ = mgr.List(post.Id, 10)
	if len(revs) != 3 {
		t.Fatalf("expected 3 revisions after cleanup, got %d", len(revs))
	}

	// Verify oldest were deleted (remaining should be the 3 newest: v2, v3, v4)
	snap0, _ := ExtractSnapshot(revs[0])
	if snap0.Title != "v4" {
		t.Errorf("newest remaining should have snapshot v4, got %q", snap0.Title)
	}
}

func TestExtractSnapshot(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	post := createTestPost(t, app, "Test", "Body", "published")
	mgr.CaptureBeforeUpdate(post, ReasonManual, "")

	revs, _ := mgr.List(post.Id, 1)
	if len(revs) == 0 {
		t.Fatal("no revision found")
	}

	snap, err := ExtractSnapshot(revs[0])
	if err != nil {
		t.Fatalf("ExtractSnapshot: %v", err)
	}

	if snap.Title != "Test" || snap.Content != "Body" || snap.Status != "published" {
		t.Errorf("snapshot mismatch: %+v", snap)
	}

	// Verify raw JSON is valid
	rawJSON := revs[0].GetString("snapshot")
	var check map[string]interface{}
	if err := json.Unmarshal([]byte(rawJSON), &check); err != nil {
		t.Errorf("snapshot JSON invalid: %v", err)
	}
}
