package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Drop the legacy `site.theme` SelectField (values default/minimal/magazine/
// custom — a stale enum from before the theme-host era). The live switch is
// `site.activeTheme`; `site.GetInfo` no longer reads `theme` and no Go/SDK/
// admin consumer does either (verified 2026-10-03), so the column is dead
// weight that only invites confusion with activeTheme.
func init() {
	m.Register(func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return err
		}
		if col.Fields.GetByName("theme") != nil {
			col.Fields.RemoveByName("theme")
		}
		return db.Save(col)
	}, func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return nil // site gone → nothing to restore
		}
		if col.Fields.GetByName("theme") == nil {
			col.Fields.Add(&core.SelectField{
				Name:   "theme",
				Values: []string{"default", "minimal", "magazine", "custom"},
			})
		}
		return db.Save(col)
	})
}
