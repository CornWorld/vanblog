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

		// Add image/avif to the FileField accepted MimeTypes so that
		// preserve-mode users (see site.mediaConfig) can upload AVIF
		// directly. pb's thumbnail generator does NOT support AVIF
		// (apis/file.go imageContentTypes is png/jpg/jpeg/gif/webp), so
		// ?thumb= requests will silently fall back to the original —
		// same contract as BMP/TIFF/SVG. The client surfaces this via
		// the inline status bar in ByteMdEditor.
		//
		// Existing records are untouched; this only widens the gate for
		// future uploads.
		field := &core.FileField{
			Name:      "file",
			MaxSelect: 1,
			MaxSize:   50 << 20,
			MimeTypes: []string{
				"image/jpeg",
				"image/png",
				"image/gif",
				"image/webp",
				"image/svg+xml",
				"image/bmp",
				"image/tiff",
				"image/x-icon",
				"image/avif", // new
				"application/octet-stream",
			},
			Thumbs: []string{
				"300x0",
				"800x0",
				"1200x0",
			},
			Required: false,
		}

		if existing := col.Fields.GetByName("file"); existing != nil {
			col.Fields.RemoveById(existing.GetId())
		}
		col.Fields.Add(field)

		return db.Save(col)
	}, func(db core.App) error {
		// Rollback: drop image/avif by re-applying the previous MIME list.
		col, err := db.FindCollectionByNameOrId("media")
		if err != nil {
			return nil
		}
		field := &core.FileField{
			Name:      "file",
			MaxSelect: 1,
			MaxSize:   50 << 20,
			MimeTypes: []string{
				"image/jpeg",
				"image/png",
				"image/gif",
				"image/webp",
				"image/svg+xml",
				"image/bmp",
				"image/tiff",
				"image/x-icon",
				"application/octet-stream",
			},
			Thumbs:      []string{"300x0", "800x0", "1200x0"},
			Required:    false,
		}
		if existing := col.Fields.GetByName("file"); existing != nil {
			col.Fields.RemoveById(existing.GetId())
		}
		col.Fields.Add(field)
		return db.Save(col)
	})
}
