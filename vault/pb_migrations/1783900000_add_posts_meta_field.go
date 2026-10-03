package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// posts.meta: per-post custom fields (flat JSON object), the Typecho-style
// "自定义字段" surface. Themes/packs read it for per-post variants (cover
// image, subtitle, layout switches...); the canonical key convention lives
// in docs/theme-implementer-guide.md (cover/image/ogImage → og:image).
//
// Free-form content, not credentials: locked posts mask it together with
// content (internal/article/enrich.go). MaxSize keeps rows bounded.
func init() {
	m.Register(func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("posts")
		if err != nil {
			return err
		}
		if col.Fields.GetByName("meta") == nil {
			col.Fields.Add(&core.JSONField{Name: "meta", MaxSize: 64 << 10})
		}
		return db.Save(col)
	}, func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("posts")
		if err != nil {
			return nil // posts gone → nothing to revert
		}
		col.Fields.RemoveByName("meta")
		return db.Save(col)
	})
}
