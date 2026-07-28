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
		records, err := db.FindRecordsByFilter("site", "1=1", "", 0, 0)
		if err != nil {
			// FindRecordsByFilter may fail if the collection is empty or
			// the filter syntax isn't supported; skip backfill in that case.
			return nil
		}
		for _, record := range records {
			val := record.GetString("paletteMigrationMode")
			if val == "" {
				record.Set("paletteMigrationMode", "keep")
				if err := db.Save(record); err != nil {
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
