package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("media")
		if err != nil {
			return err
		}

		// Update the "file" FileField with image-specific config
		field := &core.FileField{
			Name:       "file",
			MaxSelect:  1,
			MaxSize:    50 << 20, // 50MB per file (images can be large)
			MimeTypes: []string{
				"image/jpeg",
				"image/png",
				"image/gif",
				"image/webp",
				"image/svg+xml",
				"image/bmp",
				"image/tiff",
				"image/x-icon",
				// Non-image types (favicon/attachment use same field)
				"application/octet-stream",
			},
			Thumbs: []string{
				"300x0",  // thumbnail width=300 (height auto)
				"800x0",  // medium width=800
				"1200x0", // large width=1200
			},
			Required: false, // externalUrl images don't have local files
		}

		// Replace existing field by name
		existing := col.Fields.GetByName("file")
		if existing != nil {
			col.Fields.RemoveById(existing.GetId())
		}
		col.Fields.Add(field)

		return db.Save(col)
	}, func(db core.App) error {
		// Rollback: restore bare FileField
		col, err := db.FindCollectionByNameOrId("media")
		if err != nil {
			return nil
		}
		field := &core.FileField{Name: "file", MaxSelect: 1}
		existing := col.Fields.GetByName("file")
		if existing != nil {
			col.Fields.RemoveById(existing.GetId())
		}
		col.Fields.Add(field)
		return db.Save(col)
	})
}
