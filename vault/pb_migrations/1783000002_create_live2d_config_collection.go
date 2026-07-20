package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Creates the `live2d_config` collection for the live2d-companion Pack.
// Stores a single global config record consumed by the Pack's SSR layer.
//
// The Pack reads the first record via getFirstListItem("1=1"); only admins
// may write. Non-admin visitors see DEFAULT_CONFIG in the browser and never
// touch this collection.
func init() {
	m.Register(func(db core.App) error {
		if existing, err := db.FindCollectionByNameOrId("live2d_config"); err == nil && existing != nil {
			return nil
		}

		col := core.NewCollection(core.CollectionTypeBase, "live2d_config")
		col.Fields.Add(&core.URLField{Name: "widgetPath", Required: true})
		col.Fields.Add(&core.URLField{Name: "cdnPath", Required: true})
		col.Fields.Add(&core.NumberField{Name: "modelId", Required: true})
		col.Fields.Add(&core.NumberField{Name: "modelTexturesId", Required: true})
		col.Fields.Add(&core.JSONField{Name: "tools"})
		col.Fields.Add(&core.NumberField{Name: "minWidth", Required: true})
		col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
		col.Fields.Add(&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true})

		// Only admins can read or write the global config record.
		col.ListRule = strPtr(`@request.auth.role = "admin"`)
		col.ViewRule = strPtr(`@request.auth.role = "admin"`)
		col.CreateRule = strPtr(`@request.auth.role = "admin"`)
		col.UpdateRule = strPtr(`@request.auth.role = "admin"`)
		col.DeleteRule = strPtr(`@request.auth.role = "admin"`)

		return db.Save(col)
	}, func(db core.App) error {
		if col, err := db.FindCollectionByNameOrId("live2d_config"); err == nil && col != nil {
			return db.Delete(col)
		}
		return nil
	})
}
