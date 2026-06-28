// Package revisions provides article version history using a git-like model.
//
// Design philosophy (inspired by git):
//   - Every save creates an immutable snapshot of the old state (like a git object)
//   - Restore creates a NEW revision with reason="restore" (like git revert creates a new commit)
//   - Revisions are never mutated; the current state lives in the posts table
//   - Diff is optional metadata for faster frontend rendering
package revisions

import (
	"encoding/json"
	"fmt"
	"log"
	"sort"

	"github.com/pocketbase/dbx"

	"github.com/pocketbase/pocketbase/core"
)

// RevisionReason describes why a revision was created.
type RevisionReason string

const (
	ReasonAutoSave RevisionReason = "auto-save"  // periodic autosave
	ReasonManual   RevisionReason = "manual"     // user clicked "save version"
	ReasonPublish  RevisionReason = "publish"    // status changed to published
	ReasonRestore  RevisionReason = "restore"    // restored from a previous version
	ReasonImport   RevisionReason = "import"     // data migration
)

// Snapshot captures the complete state of a post at a point in time.
// This is like a git blob — immutable once written.
type Snapshot struct {
	Title   string `json:"title"`
	Content string `json:"content"`
	Status  string `json:"status"`
}

// Manager handles revision operations against a PocketBase app.
type Manager struct {
	app core.App
}

// New creates a revision Manager and registers its pb hook subscriptions.
//
// Hook: OnRecordUpdateRequest("posts") — fires before any post update HTTP
// request. We snapshot the *current* (pre-update) state so it's preserved
// as an immutable revision before the new state overwrites it.
func New(app core.App) *Manager {
	m := &Manager{app: app}
	app.OnRecordUpdateRequest("posts").BindFunc(m.snapshotBeforePostUpdate)
	return m
}

// snapshotBeforePostUpdate captures the current post state as a revision
// before an HTTP update applies the new state. Failures are logged but
// non-fatal — a missing revision is better than a blocked post save.
func (m *Manager) snapshotBeforePostUpdate(e *core.RecordRequestEvent) error {
	oldRecord, err := m.app.FindRecordById("posts", e.Record.Id)
	if err == nil && oldRecord != nil {
		if err := m.CaptureBeforeUpdate(oldRecord, ReasonAutoSave, ""); err != nil {
			log.Printf("[revisions] capture failed for %s: %v", e.Record.Id, err)
		}
	}
	return e.Next()
}

// CaptureBeforeUpdate takes a snapshot of the current (pre-update) post state
// and writes it as a revision. Call this BEFORE applying the update.
//
// This is the core of the git-like model:
//   1. Read current post from DB (old state)
//   2. Serialize to Snapshot
//   3. Write as immutable revision record
//   4. The caller then proceeds with the update (new state overwrites posts)
//
// If the post has no meaningful changes (e.g. just viewCount update),
// the caller should skip this call via ShouldSnapshot().
func (m *Manager) CaptureBeforeUpdate(post *core.Record, reason RevisionReason, actorID string) error {
	snap := Snapshot{
		Title:   post.GetString("title"),
		Content: post.GetString("content"),
		Status:  post.GetString("status"),
	}

	snapJSON, err := json.Marshal(snap)
	if err != nil {
		return fmt.Errorf("revisions: failed to marshal snapshot: %w", err)
	}

	col, err := m.app.FindCollectionByNameOrId("revisions")
	if err != nil {
		return fmt.Errorf("revisions: collection not found: %w", err)
	}

	record := core.NewRecord(col)
	record.Set("target", post.Id)
	record.Set("snapshot", json.RawMessage(snapJSON))
	record.Set("reason", string(reason))
	if actorID != "" {
		record.Set("authoredBy", actorID)
	}

	if err := m.app.Save(record); err != nil {
		return fmt.Errorf("revisions: failed to save revision: %w", err)
	}

	return nil
}

// ShouldSnapshot determines if a field change warrants creating a revision.
// Trivial changes (viewCount, lastVisitedAt) should NOT create revisions,
// just like git doesn't commit on every file stat update.
func ShouldSnapshot(oldPost, newPost *core.Record) bool {
	// Only snapshot when content-meaningful fields change
	fields := []string{"title", "content", "status"}
	for _, f := range fields {
		if oldPost.GetString(f) != newPost.GetString(f) {
			return true
		}
	}
	return false
}

// List returns revisions for a post, most recent first.
func (m *Manager) List(postID string, limit int) ([]*core.Record, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	records, err := m.app.FindRecordsByFilter(
		"revisions", "target='"+postID+"'", "", limit, 0,
	)
	if err != nil {
		return nil, fmt.Errorf("revisions: query failed: %w", err)
	}
	// Sort newest first: by created time, with id as tiebreaker for same-millisecond entries
	sort.SliceStable(records, func(i, j int) bool {
		ti := records[i].GetDateTime("created").Time()
		tj := records[j].GetDateTime("created").Time()
		if !ti.Equal(tj) {
			return ti.After(tj)
		}
		return records[i].Id > records[j].Id
	})
	return records, nil
}

// Get retrieves a specific revision by ID.
func (m *Manager) Get(revisionID string) (*core.Record, error) {
	record, err := m.app.FindRecordById("revisions", revisionID)
	if err != nil {
		return nil, fmt.Errorf("revisions: not found: %w", err)
	}
	return record, nil
}

// Restore applies a revision's snapshot back to the post.
//
// Git-like semantics:
//   - This does NOT delete or revert any revision
//   - It creates a NEW revision capturing the current state (reason="restore")
//   - Then applies the old snapshot to the post
//   - The history is a linear, append-only log — you can always see what happened
//
// The caller (HTTP hook) should call this within OnRecordUpdateRequest,
// so the restore itself triggers CaptureBeforeUpdate for the current state.
func (m *Manager) Restore(revisionID string, actorID string) error {
	revision, err := m.Get(revisionID)
	if err != nil {
		return err
	}

	postID := revision.GetString("target")
	post, err := m.app.FindRecordById("posts", postID)
	if err != nil {
		return fmt.Errorf("revisions: target post not found: %w", err)
	}

	// 1. Capture current state BEFORE restoring (git revert creates a new commit)
	if err := m.CaptureBeforeUpdate(post, ReasonRestore, actorID); err != nil {
		return fmt.Errorf("revisions: failed to capture pre-restore state: %w", err)
	}

	// 2. Parse the snapshot
	snapJSON := revision.GetString("snapshot")
	var snap Snapshot
	if err := json.Unmarshal([]byte(snapJSON), &snap); err != nil {
		return fmt.Errorf("revisions: failed to parse snapshot: %w", err)
	}

	// 3. Apply snapshot to post
	post.Set("title", snap.Title)
	post.Set("content", snap.Content)
	post.Set("status", snap.Status)

	if err := m.app.Save(post); err != nil {
		return fmt.Errorf("revisions: failed to restore post: %w", err)
	}

	return nil
}

// Cleanup enforces the retention policy by deleting old revisions.
// Called periodically (e.g. daily cron) or after each capture.
func (m *Manager) Cleanup(postID string, maxKeep int) error {
	if maxKeep <= 0 {
		return nil // unlimited retention
	}

	records, err := m.app.FindRecordsByFilter(
		"revisions",
		"target={:pid}",
		"",
		0,
		0,
		dbx.Params{"pid": postID},
	)
	if err != nil {
		return fmt.Errorf("revisions: cleanup query failed: %w", err)
	}

	// Sort newest first, then delete everything after maxKeep
	// Sort newest first: by created time, with id as tiebreaker for same-millisecond entries
	sort.SliceStable(records, func(i, j int) bool {
		ti := records[i].GetDateTime("created").Time()
		tj := records[j].GetDateTime("created").Time()
		if !ti.Equal(tj) {
			return ti.After(tj)
		}
		return records[i].Id > records[j].Id
	})

	if len(records) <= maxKeep {
		return nil // within limit
	}

	// Delete oldest records beyond maxKeep
	for i := maxKeep; i < len(records); i++ {
		if err := m.app.Delete(records[i]); err != nil {
			// Log but continue — partial cleanup is better than none
			continue
		}
	}

	return nil
}

// ExtractSnapshot parses the snapshot JSON from a revision record.
func ExtractSnapshot(record *core.Record) (*Snapshot, error) {
	snapJSON := record.GetString("snapshot")
	var snap Snapshot
	if err := json.Unmarshal([]byte(snapJSON), &snap); err != nil {
		return nil, fmt.Errorf("revisions: invalid snapshot JSON: %w", err)
	}
	return &snap, nil
}
