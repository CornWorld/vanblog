// Package media provides image/file deduplication and article image scanning.
package media

import (
	"crypto/md5"
	"fmt"

	"github.com/pocketbase/pocketbase/core"
)

// Manager handles media operations.
type Manager struct {
	app core.App
}

// New creates a media Manager.
func New(app core.App) *Manager {
	return &Manager{app: app}
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
		return nil, nil // not found = not duplicate
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
