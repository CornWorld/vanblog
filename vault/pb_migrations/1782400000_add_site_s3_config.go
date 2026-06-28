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

		// s3Config holds the user-supplied S3 backend configuration that
		// vanblog syncs into PocketBase's app settings on startup (and on
		// site update). PocketBase's BaseApp.NewFilesystem() automatically
		// routes FileField uploads to S3 when settings.S3.Enabled is true,
		// so this is the single source of truth for "where do media
		// uploads go".
		//
		// Shape: {"enabled":bool, "bucket":str, "region":str,
		// "endpoint":str, "accessKey":str, "secret":str,
		// "forcePathStyle":bool}
		//
		// JSON (not a relation or scalar columns) because the whole blob
		// is consumed atomically by ApplyS3BackendToSettings — partial edits are
		// not meaningful. Secret is stored plaintext in SQLite; operators
		// who need at-rest encryption should encrypt the pb_data volume.
		col.Fields.Add(&core.JSONField{Name: "s3Config"})

		if err := db.Save(col); err != nil {
			return err
		}

		// Backfill the default value on the existing single site record so
		// ApplyS3BackendToSettings sees a well-formed blob on the first run after
		// upgrade. New installs get the default from insertDefaultSite.
		//
		// Why we check both "" and "null": pb's JSONField returns the
		// literal string "null" from GetString when the column is SQL NULL
		// (JSON null serialized as text). Either means "not yet set".
		if rec, err := db.FindFirstRecordByFilter("site", ""); err == nil && rec != nil {
			cur := rec.GetString("s3Config")
			if cur == "" || cur == "null" {
				rec.Set("s3Config", json.RawMessage(`{"enabled":false}`))
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
		if f := col.Fields.GetByName("s3Config"); f != nil {
			col.Fields.RemoveById(f.GetId())
		}
		return db.Save(col)
	})
}
