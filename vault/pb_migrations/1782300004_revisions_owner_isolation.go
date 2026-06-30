package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		// Revisions owner isolation: the 1782300003 leg `target.deleted = false`
		// still lets any authenticated user read the full snapshot
		// (title/content/status JSON) of every non-deleted post — including
		// other users' private drafts.
		//
		// New rule:
		//   admin                                     → full visibility (cross-user, incl. deleted)
		//   authenticated non-admin                   → only revisions whose target.author is themselves
		//   anonymous                                 → denied (no auth.id leg)
		//
		// Decisions (confirmed with user):
		//   - Authors keep read access to revisions of their own deleted posts.
		//     /admin/trash offers a restore entry, and viewing the history of
		//     own content before restore is a legitimate workflow. We do NOT
		//     carry the `target.deleted = false` predicate forward.
		//   - Cross-user visibility (collaborator reading another collaborator's
		//     draft history) is blocked.
		//
		// Compatibility: app/src/pages/admin/revisions/[postId].astro calls
		// pb.collection('revisions').getFullList({filter:'target = "..."'});
		// ListRule is applied as an additional filter, so the rule silently
		// narrows what non-admins see without breaking the admin path.
		revCol, err := db.FindCollectionByNameOrId("revisions")
		if err != nil {
			return err
		}
		revRule := `@request.auth.role = "admin" || @request.auth.id = target.author`
		revCol.ListRule = strPtr(revRule)
		revCol.ViewRule = strPtr(revRule)
		return db.Save(revCol)
	}, func(db core.App) error {
		// Forward-only. To revert, write a new migration restoring prior rules.
		return nil
	})
}
