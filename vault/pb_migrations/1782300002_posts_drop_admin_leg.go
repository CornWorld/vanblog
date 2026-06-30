package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("posts")
		if err != nil {
			return err
		}

		// Drop the admin leg from the posts ListRule/ViewRule that 1782300001
		// added. That leg (`@request.auth.role = "admin"` with no deleted
		// filter) existed only so /admin/trash could fetch deleted=true rows
		// via the pb SDK. /admin/trash now uses GET /api/vanblog/posts/trash
		// (Go-side canManagePosts gate), so the admin leg is dead weight and
		// a soft spot: it lets any admin-role caller see deleted rows through
		// the generic pb REST API, bypassing the dedicated trash endpoint.
		//
		// After this migration, the rule is:
		//   - anonymous: published + non-private + non-deleted
		//   - authenticated (incl. admin): non-deleted (drafts/hidden visible
		//     to logged-in users, as before)
		// Deleted rows are reachable only via /api/vanblog/posts/trash (and
		// the restore route), both of which Go gates with canManagePosts.
		//
		// Front-end list pages (index/archive/tags/categories) already pass
		// `deleted = false` explicitly; admin/index deliberately drops deleted
		// rows from the main management list. The ListRule is now defense in
		// depth, not a load-bearing path.
		newRule := `deleted = false && status = "published" && private = false || @request.auth.id != "" && deleted = false`
		col.ListRule = strPtr(newRule)
		col.ViewRule = strPtr(newRule)
		return db.Save(col)
	}, func(db core.App) error {
		// Forward-only. To revert, write a new migration restoring the admin leg.
		return nil
	})
}
