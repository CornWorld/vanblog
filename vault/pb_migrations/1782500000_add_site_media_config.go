package migrations

import (
	"encoding/json"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return err
		}

		// mediaConfig controls client-side image normalization before upload.
		// Read by Astro's ByteMdEditor (via /api/collections/site/records),
		// consumed by app/src/lib/media/normalizeImage.ts.
		//
		// Shape: {"enabled":bool, "targetFormat":"webp"|"avif"|"preserve",
		//         "quality":int (1-100)}
		//
		// Why a separate JSON blob instead of reusing the legacy
		// `enableWebp` bool: it has outgrown a single flag — target format
		// and quality are first-class knobs. Packing them into one JSON
		// field keeps the site table tidy and matches the s3Config pattern.
		//
		// - enabled=false: all uploads pass through unchanged (BMP/TIFF/
		//   SVG/AVIF fall back to original on pb's thumb path, see
		//   apis/file.go:174 imageContentTypes gate).
		// - targetFormat=preserve: same as enabled=false, but explicit.
		// - targetFormat=webp/avif: rasterize via createImageBitmap,
		//   re-encode via @jsquash/{webp,avif}. ~80KB / ~8MB wasm loaded
		//   on first conversion. SVG bypasses regardless (vector resize
		//   is meaningless).
		col.Fields.Add(&core.JSONField{Name: "mediaConfig"})

		if err := db.Save(col); err != nil {
			return err
		}

		// Backfill the default value on the existing single site record so
		// the editor sees a well-formed blob on first run after upgrade.
		// New installs get the default from insertDefaultSite.
		if rec, err := db.FindFirstRecordByFilter("site", ""); err == nil && rec != nil {
			if rec.GetString("mediaConfig") == "" {
				rec.Set("mediaConfig", json.RawMessage(`{"enabled":true,"targetFormat":"webp","quality":84}`))
				if err := db.Save(rec); err != nil {
					return err
				}
			}
		}
		return nil
	}, func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return nil
		}
		if f := col.Fields.GetByName("mediaConfig"); f != nil {
			col.Fields.RemoveById(f.GetId())
		}
		return db.Save(col)
	})
}
