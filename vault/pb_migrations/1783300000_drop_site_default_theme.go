package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		// Drop the legacy `defaultTheme` (auto/light/dark) field. In the atomic
		// palette model (VSCode Color Theme style) light/dark is decided by the
		// active palette's `type`, so a site-level light/dark default is obsolete.
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return err
		}
		col.Fields.RemoveByName("defaultTheme")
		return db.Save(col)
	}, func(db core.App) error {
		// Rollback: restore the field with its original default.
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return err
		}
		col.Fields.Add(&core.SelectField{Name: "defaultTheme", Values: []string{"auto", "light", "dark"}})
		return db.Save(col)
	})
}
