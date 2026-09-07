package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		// posts.hasPassword mirrors password presence so the enrich hook
		// (internal/article/enrich.go) can mask content+password for
		// anonymous readers while the theme still sees "this post is
		// locked". Maintained on every write by the same hook; this
		// migration adds the field and backfills existing rows.
		col, err := db.FindCollectionByNameOrId("posts")
		if err != nil {
			return err
		}
		if col.Fields.GetByName("hasPassword") == nil {
			col.Fields.Add(&core.BoolField{Name: "hasPassword"})
			if err := db.Save(col); err != nil {
				return err
			}
		}
		// Backfill without firing hooks (raw derived value, no events).
		_, err = db.DB().NewQuery("UPDATE posts SET hasPassword = (password != '')").Execute()
		return err
	}, func(db core.App) error {
		// Forward-only. To revert, write a new migration dropping the field.
		return nil
	})
}
