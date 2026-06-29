package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		// 1. Clean historical NULL `deleted` values so the partial indexes below
		//    cover every live row. PocketBase BoolField stores as a 0/1 BOOLEAN
		//    column; rows written before the column-type default existed (or via
		//    raw SQL) may carry NULL, which the `WHERE deleted = 0` predicate would
		//    silently exclude.
		if _, err := db.DB().NewQuery(
			"UPDATE posts SET deleted = 0 WHERE deleted IS NULL",
		).Execute(); err != nil {
			return err
		}

		// 2. (No schema mutation required.)
		//
		//    The task spec asked to set `Default: false` on the posts.deleted
		//    BoolField, but core.BoolField in pocketbase@v0.39 has no `Default`
		//    field — defaults are expressed entirely through the SQL column type.
		//    BoolField.ColumnType() already returns
		//    `BOOLEAN DEFAULT FALSE NOT NULL`, so every future INSERT already
		//    writes 0 instead of NULL. Normalizing historical NULLs in step 1 is
		//    therefore sufficient; touching the collection schema here would only
		//    risk a redundant no-op Save.

		// 3. Partial indexes covering the article.go hot read paths.
		//    SQLite 3.8+ supports partial indexes natively and PocketBase ships a
		//    modern SQLite, so `WHERE deleted = 0` keeps the index small and skips
		//    soft-deleted rows at the planner level.
		//      - idx_posts_status_created_active: GetRecent / GetTimeline / Search / feed
		//      - idx_posts_category_active:      GetByCategory
		//      - idx_posts_pathname_active:      GetByPathname
		ddls := []string{
			"CREATE INDEX IF NOT EXISTS idx_posts_status_created_active ON posts (status, created) WHERE deleted = 0",
			"CREATE INDEX IF NOT EXISTS idx_posts_category_active ON posts (category) WHERE deleted = 0",
			"CREATE INDEX IF NOT EXISTS idx_posts_pathname_active ON posts (pathname) WHERE deleted = 0",
		}
		for _, ddl := range ddls {
			if _, err := db.DB().NewQuery(ddl).Execute(); err != nil {
				return err
			}
		}
		return nil
	}, func(db core.App) error {
		// Not rolled back. Schema/data changes are forward-only —
		// add a new migration on top, never rewrite history.
		return nil
	})
}
