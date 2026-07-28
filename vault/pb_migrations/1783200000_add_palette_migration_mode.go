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
			Name: "paletteMigrationMode",
			Values: []string{"keep", "silent", "prompt"},
		})
		return db.Save(col)
	}, func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return err
		}
		col.Fields.RemoveByName("paletteMigrationMode")
		return db.Save(col)
	})
}
