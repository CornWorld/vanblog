// Package media provides image/file deduplication and article image scanning.
package media

import (
	"crypto/md5"
	"database/sql"
	"errors"
	"fmt"
	"log"

	"github.com/pocketbase/pocketbase/core"
)

// Manager handles media operations.
type Manager struct {
	app core.App
}

// New creates a media Manager and registers its pb hook subscriptions.
//
// Hooks:
//   - OnServe: push site.s3Config into pb settings so a fresh deploy with a
//     pre-populated config (backup restore, image upgrade) routes uploads to
//     S3 without requiring an admin to re-save the site record.
//   - OnRecordAfterCreateSuccess("media"): compute MD5 sign, dedup against
//     existing records, delete the newer copy if a duplicate is found.
//   - OnRecordAfterUpdateSuccess("site"): re-apply S3 backend so config edits
//     take effect on the next upload without a restart.
//   - OnRecordAfterCreateSuccess("posts") + OnRecordAfterUpdateSuccess("posts"):
//     scan post HTML for <img src> referencing media files and link them.
func New(app core.App) *Manager {
	m := &Manager{app: app}
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		if err := ApplyS3BackendToSettings(app); err != nil {
			log.Printf("[media] startup S3 sync failed: %v", err)
		}
		return se.Next()
	})
	app.OnRecordAfterCreateSuccess("media").BindFunc(m.dedupeOnUpload)
	app.OnRecordAfterUpdateSuccess("site").BindFunc(func(e *core.RecordEvent) error {
		go m.reapplyS3Backend()
		return e.Next()
	})
	app.OnRecordAfterCreateSuccess("posts").BindFunc(m.scanPostImages)
	app.OnRecordAfterUpdateSuccess("posts").BindFunc(m.scanPostImages)
	return m
}

// dedupeOnUpload runs after a media record is created. Computes MD5 sign of
// the uploaded file, persists it, then queries for an older record with the
// same sign. If found, the newer record (the one just uploaded) is deleted.
//
// Failures are logged but non-fatal — a missing dedup pass is preferable to
// blocking an upload.
func (m *Manager) dedupeOnUpload(e *core.RecordEvent) error {
	record := e.Record
	if record.GetString("file") == "" {
		return nil // skip external URL records
	}
	content, err := m.ReadFileContent(record)
	if err != nil {
		log.Printf("[media] dedup: failed to read file: %v", err)
		return nil
	}
	sign := ComputeSign(content)
	record.Set("sign", sign)
	if err := m.app.Save(record); err != nil {
		log.Printf("[media] dedup: failed to save sign: %v", err)
		return nil
	}

	existing, err := m.CheckDuplicate(content)
	if err != nil {
		log.Printf("[media] dedup: query failed: %v", err)
		return nil
	}
	if existing == nil || existing.Id == record.Id {
		return nil
	}

	// Deterministic winner: keep the older record (smaller created time).
	// pb Ids are random — adjacent uploads have ~50% chance of inverted Id
	// order, which caused the duplicate to survive half the time. `created`
	// is set by AutodateField and is monotonic per-write, so it's a reliable
	// tiebreaker. On a tie (sub-millisecond writes), fall back to
	// lexicographic Id so both contenders agree on the winner.
	existingCreated := existing.GetDateTime("created").Time()
	recordCreated := record.GetDateTime("created").Time()
	keepExisting := existingCreated.Before(recordCreated) ||
		(existingCreated.Equal(recordCreated) && existing.Id < record.Id)
	if keepExisting {
		log.Printf("[media] dedup: duplicate of %s, deleting %s", existing.Id, record.Id)
		m.app.Delete(record)
	}
	return nil
}

// scanPostImages links <img src> in post HTML to media records.
// Async so the post save response isn't blocked on the scan.
func (m *Manager) scanPostImages(e *core.RecordEvent) error {
	go func() {
		if err := m.ScanArticleImages(e.Record.Id); err != nil {
			log.Printf("[media] scan: failed for post %s: %v", e.Record.Id, err)
		}
	}()
	return nil
}

// reapplyS3Backend pushes site.s3Config into pb settings on site update,
// so config changes take effect on the next upload without a restart.
func (m *Manager) reapplyS3Backend() {
	if err := ApplyS3BackendToSettings(m.app); err != nil {
		log.Printf("[media] reapply S3 backend failed: %v", err)
	}
}

// CheckDuplicate looks up an existing media record by MD5 hash of file content.
// Returns the existing record if found, nil otherwise.
//
// This replaces the original static.provider.ts getOneBySign() behavior.
func (m *Manager) CheckDuplicate(fileContent []byte) (*core.Record, error) {
	sign := ComputeSign(fileContent)

	record, err := m.app.FindFirstRecordByFilter(
		"media",
		"sign={:sign}",
		map[string]any{"sign": sign},
	)
	if err != nil {
		// Distinguish "no matching record" from real DB errors (e.g. db locked)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // not found = not duplicate
		}
		return nil, fmt.Errorf("media: query failed: %w", err)
	}
	return record, nil
}

// ComputeSign returns the MD5 hash hex string of the given content.
// This is used as the deduplication signature.
func ComputeSign(content []byte) string {
	h := md5.Sum(content)
	return fmt.Sprintf("%x", h)
}

// CreateRecord creates a new media record with the given parameters.
// Used after CheckDuplicate returns nil (no existing copy).
func (m *Manager) CreateRecord(
	sign string,
	staticType string,
	storageType string,
	fileType string,
	externalUrl string,
	meta []byte,
) (*core.Record, error) {
	col, err := m.app.FindCollectionByNameOrId("media")
	if err != nil {
		return nil, fmt.Errorf("media: collection not found: %w", err)
	}

	record := core.NewRecord(col)
	record.Set("sign", sign)
	record.Set("staticType", staticType)
	record.Set("storageType", storageType)
	record.Set("fileType", fileType)
	if externalUrl != "" {
		record.Set("externalUrl", externalUrl)
	}
	if meta != nil {
		record.Set("meta", meta)
	}

	if err := m.app.Save(record); err != nil {
		return nil, fmt.Errorf("media: save failed: %w", err)
	}
	return record, nil
}

// UploadOrDedup checks for duplicates first, then creates if new.
// Returns (record, isNew).
func (m *Manager) UploadOrDedup(
	fileContent []byte,
	staticType string,
	storageType string,
	fileType string,
	externalUrl string,
) (*core.Record, bool, error) {
	// Check for existing
	existing, err := m.CheckDuplicate(fileContent)
	if err != nil {
		return nil, false, err
	}
	if existing != nil {
		return existing, false, nil // duplicate, return existing
	}

	// Create new
	sign := ComputeSign(fileContent)
	record, err := m.CreateRecord(sign, staticType, storageType, fileType, externalUrl, nil)
	if err != nil {
		return nil, false, err
	}
	return record, true, nil
}
