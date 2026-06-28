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

		// caddyLastError holds the last error message produced by
		// caddy.BootstrapSync (the full-config push that happens on pb
		// startup). It is cleared on successful bootstrap and surfaced to
		// the admin UI via TLSStatus.BootstrapError so operators can see
		// *why* their site is stuck on the maintenance 503 page without
		// having to read container logs.
		//
		// Text (not JSON): this is a single human-readable string, not
		// structured data, so a column is cheaper and queryable.
		col.Fields.Add(&core.TextField{Name: "caddyLastError"})

		return db.Save(col)
	}, func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return nil
		}
		if f := col.Fields.GetByName("caddyLastError"); f != nil {
			col.Fields.RemoveById(f.GetId())
		}
		return db.Save(col)
	})
}
