package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return err
		}
		col.Fields.Add(&core.SelectField{
			Name:   "paletteMigrationMode",
			Values: []string{"keep", "silent", "prompt"},
		})
		if err := db.Save(col); err != nil {
			return err
		}

		// Backfill existing site records: SelectField validation rejects
		// empty/missing values, so any pre-migration record would fail
		// validation on the next PATCH. Set "keep" (the SDK default) for
		// all existing records that don't have a valid value yet.
		//
		// Use UnsafeWithoutHooks to avoid triggering JSVM hooks during
		// migration — the Goja VM may report "Invalid module" for require()
		// calls inside afterFunc callbacks during the migration transaction.
		// This is a known PB 0.39 JSVM issue, not a vanblog bug.
		unsafeApp := db.UnsafeWithoutHooks()
		records, err := unsafeApp.FindRecordsByFilter("site", "1=1", "", 0, 0)
		if err != nil {
			return nil
		}
		for _, record := range records {
			val := record.GetString("paletteMigrationMode")
			if val == "" {
				record.Set("paletteMigrationMode", "keep")
				if err := unsafeApp.Save(record); err != nil {
					return err
				}
			}
		}

		return nil
	}, func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return err
		}
		col.Fields.RemoveByName("paletteMigrationMode")
		return db.Save(col)
	})
}
