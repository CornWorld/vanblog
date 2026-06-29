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

		// Tighten ListRule / ViewRule so that soft-deleted posts are invisible via
		// the standard pb REST API for everyone except admins (who need to see
		// them in /admin/trash). Previously the rule was:
		//   status = "published" && private = false || @request.auth.id != ""
		// which leaked deleted records to any authenticated caller.
		//
		// New rule:
		//   - admin sees everything (including deleted) — needed so /admin/trash
		//     can fetch deleted=true records via the pb SDK
		//   - authenticated non-admins (collaborators) see all non-deleted posts,
		//     including drafts/hidden — they need this to edit in /admin
		//   - anonymous sees only published + non-private + non-deleted
		//
		// The admin leg intentionally has no deleted filter: /admin/trash uses
		// pb.collection('posts').getFullList({filter:'deleted=true'}) and relies
		// on the admin role to bypass the deleted=false check. /admin/index adds
		// its own filter:'deleted=false' client-side so admins don't see
		// soft-deleted posts in the main list.
		//
		// NOTE: this is an API-layer safety net. Application code in article.go /
		// feed.go / visits.go already filters explicitly, so this is defense in
		// depth against bypassed front-end filters.
		newRule := `deleted = false && status = "published" && private = false || @request.auth.id != "" && deleted = false || @request.auth.role = "admin"`
		col.ListRule = strPtr(newRule)
		col.ViewRule = strPtr(newRule)
		if err := db.Save(col); err != nil {
			return err
		}

		// Partial unique index on pathname for active posts only.
		// Allows a soft-deleted post's pathname to be reused by a new post,
		// while preventing two active posts from sharing the same pathname.
		// Empty pathnames (drafts without custom path) are excluded.
		if _, err := db.DB().NewQuery(
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_pathname_active_unique
			 ON posts (pathname) WHERE deleted = 0 AND pathname != ''`,
		).Execute(); err != nil {
			return err
		}

		return nil
	}, func(db core.App) error {
		// Forward-only. To revert, write a new migration restoring the old rules.
		return nil
	})
}
