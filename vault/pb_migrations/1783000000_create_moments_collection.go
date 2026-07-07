package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Creates the `moments` collection for the moments plugin (说说/动态).
// Replaces the previous runtime onBootstrap creation in plugins/moments/moments.pb.js,
// which was brittle (OnBootstrap timing issues on pb 0.39.5).
//
// CRUD is exposed via PocketBase's auto-generated /api/collections/moments/records
// endpoint; the plugin no longer ships hand-written list/create/delete routes.
func init() {
	m.Register(func(db core.App) error {
		// Idempotent: skip if the plugin was previously installed.
		if existing, err := db.FindCollectionByNameOrId("moments"); err == nil && existing != nil {
			return nil
		}

		usersCol, err := db.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		col := core.NewCollection(core.CollectionTypeBase, "moments")
		col.Fields.Add(&core.TextField{Name: "content", Required: true, Max: 500})
		col.Fields.Add(&core.RelationField{Name: "author", CollectionId: usersCol.Id, MaxSelect: 1, Required: true})
		col.Fields.Add(&core.BoolField{Name: "visible"})
		col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
		col.Fields.Add(&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true})

		// Public visitors see only visible moments; authenticated users see all
		// (so the admin "my moments" view can list drafts/hidden). Tighter per-row
		// visibility for non-owner authed users is enforced at the handler level
		// if needed in the future.
		col.ListRule = strPtr(`visible = true || @request.auth.id != ""`)
		col.ViewRule = strPtr(`visible = true || @request.auth.id != ""`)
		col.CreateRule = strPtr(`@request.auth.id != ""`)
		col.UpdateRule = strPtr(`@request.auth.id != "" && (@request.auth.id = author || @request.auth.role = "admin")`)
		col.DeleteRule = strPtr(`@request.auth.id != "" && (@request.auth.id = author || @request.auth.role = "admin")`)

		return db.Save(col)
	}, func(db core.App) error {
		// Down: remove the collection. Data is lost — only run on explicit
		// plugin uninstall.
		if col, err := db.FindCollectionByNameOrId("moments"); err == nil && col != nil {
			return db.Delete(col)
		}
		return nil
	})
}
