package media

import (
	"fmt"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

// StoreLocalFile creates a NEW media record carrying the given file bytes via
// pb's FileField, and saves it. Returns the saved record.
//
// IMPORTANT: callers must build file URLs with record.GetString("file"), NOT
// the original filename — pb renames stored files with a random prefix on
// save, so the original name is not the on-disk name. This wrapper exists so
// that rule lives in exactly one place (migration/zip_import.go and
// media/ingest.go both used to re-implement it, and one of them got it wrong).
func StoreLocalFile(
	app core.App,
	data []byte,
	filename string,
	externalURL string,
	staticType string,
) (*core.Record, error) {
	mediaCol, err := app.FindCollectionByNameOrId("media")
	if err != nil {
		return nil, fmt.Errorf("media: collection not found: %w", err)
	}
	record := core.NewRecord(mediaCol)
	record.Set("staticType", staticType)
	record.Set("storageType", "local")
	if externalURL != "" {
		record.Set("externalUrl", externalURL)
	}
	if err := AttachFile(app, record, data, filename); err != nil {
		return nil, err
	}
	return record, nil
}

// AttachFile sets the file on an existing media record and saves it. Used by
// ingest to attach a downloaded file to a tracking record that the scan hook
// created earlier for the same externalUrl.
func AttachFile(app core.App, record *core.Record, data []byte, filename string) error {
	file, err := filesystem.NewFileFromBytes(data, filename)
	if err != nil {
		return fmt.Errorf("media: create file: %w", err)
	}
	record.Set("file", file)
	if err := app.Save(record); err != nil {
		return fmt.Errorf("media: save record: %w", err)
	}
	return nil
}
