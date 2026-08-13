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

		// 1. Backfill existing waline/giscus records to "disabled" BEFORE
		//    shrinking the enum, otherwise SelectField validation would reject
		//    the stale value on the next save. Comment content itself lives in
		//    the external provider, so this only resets the render switch.
		unsafeApp := db.UnsafeWithoutHooks()
		records, err := unsafeApp.FindRecordsByFilter("site", "1=1", "", 0, 0)
		if err != nil {
			return err
		}
		for _, rec := range records {
			switch rec.GetString("commentsProvider") {
			case "waline", "giscus":
				rec.Set("commentsProvider", "disabled")
				rec.Set("commentsConfig", json.RawMessage(`{}`))
				if err := unsafeApp.Save(rec); err != nil {
					return err
				}
			}
		}

		// 2. Shrink the enum. giscus/waline users can switch to the "external"
		//    provider with a custom script if they still need those services.
		for _, f := range col.Fields {
			if sf, ok := f.(*core.SelectField); ok && sf.Name == "commentsProvider" {
				sf.Values = []string{"disabled", "artalk", "external"}
			}
		}
		return db.Save(col)
	}, func(db core.App) error {
		// Rollback: restore the previous enum. Backfilled record values are
		// intentionally not restored (mirrors the palette migration).
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return err
		}
		for _, f := range col.Fields {
			if sf, ok := f.(*core.SelectField); ok && sf.Name == "commentsProvider" {
				sf.Values = []string{"disabled", "waline", "giscus", "artalk", "external"}
			}
		}
		return db.Save(col)
	})
}
