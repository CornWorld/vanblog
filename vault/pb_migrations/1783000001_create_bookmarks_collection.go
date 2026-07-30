package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Creates the `bookmarks` collection for the bookmarks plugin (网址收藏).
// Replaces the former legacy Bookmarks plugin runtime collection creation.
//
// CRUD is exposed via PocketBase's auto-generated /api/collections/bookmarks/records
// endpoint; the plugin no longer ships hand-written list/create/delete routes.
//
// Visibility decision (2026-07-07): the previous plugin allowed anonymous
// `listRule: "id != ”"` (public web view of all bookmarks). To preserve that
// behavior, listRule stays empty (""). Authenticated users can always list.
// Flip to `@request.auth.id != ""` if you want login-required listing.
func init() {
	m.Register(func(db core.App) error {
		if existing, err := db.FindCollectionByNameOrId("bookmarks"); err == nil && existing != nil {
			return nil
		}

		usersCol, err := db.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		col := core.NewCollection(core.CollectionTypeBase, "bookmarks")
		col.Fields.Add(&core.TextField{Name: "title", Required: true})
		col.Fields.Add(&core.URLField{Name: "url", Required: true})
		col.Fields.Add(&core.TextField{Name: "description"})
		col.Fields.Add(&core.RelationField{Name: "owner", CollectionId: usersCol.Id, MaxSelect: 1, Required: true})
		col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
		col.Fields.Add(&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true})

		// Public list (previous behavior). Set to `@request.auth.id != ""` to require auth.
		col.ListRule = new("")
		col.ViewRule = new("")
		col.CreateRule = new(`@request.auth.id != ""`)
		col.UpdateRule = new(`@request.auth.id != "" && (@request.auth.id = owner || @request.auth.role = "admin")`)
		col.DeleteRule = new(`@request.auth.id != "" && (@request.auth.id = owner || @request.auth.role = "admin")`)

		return db.Save(col)
	}, func(db core.App) error {
		if col, err := db.FindCollectionByNameOrId("bookmarks"); err == nil && col != nil {
			return db.Delete(col)
		}
		return nil
	})
}
