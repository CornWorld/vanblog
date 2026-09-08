package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		// Enforce the site_secrets.key singleton contract at the DB level.
		//
		// The request hook (internal/site MoveSecretsFromRecord) is
		// find-then-create: two concurrent first-time site writes can both
		// miss the row and each insert a "main" row, after which every read
		// picks an arbitrary one (FindFirstRecordByFilter). Deduplicate any
		// existing repeats (keep the oldest row per key), then add a UNIQUE
		// index so a race surfaces as a constraint error instead of silent
		// duplication.
		//
		// Data surgery runs hooks-disabled: migration-time record deletes
		// must not fire JSVM/audit hooks registered after this migration
		// (the init migration documents the Goja module-resolution failure
		// mode; same reasoning applies here).
		unsafe := db.UnsafeWithoutHooks()
		rows, err := unsafe.FindAllRecords("site_secrets")
		if err != nil {
			return err
		}
		oldest := map[string]*core.Record{}
		for _, r := range rows {
			k := r.GetString("key")
			if prev, ok := oldest[k]; !ok || r.Id < prev.Id {
				oldest[k] = r
			}
		}
		if len(oldest) != len(rows) {
			for _, r := range rows {
				if oldest[r.GetString("key")].Id != r.Id {
					if err := unsafe.Delete(r); err != nil {
						return err
					}
				}
			}
		}

		col, err := db.FindCollectionByNameOrId("site_secrets")
		if err != nil {
			return err
		}
		if col.GetIndex("idx_site_secrets_key_unique") == "" {
			col.AddIndex("idx_site_secrets_key_unique", true, "`key`", "")
			return db.Save(col)
		}
		return nil
	}, func(db core.App) error {
		// Forward-only. To revert, write a new migration restoring prior rules.
		return nil
	})
}
