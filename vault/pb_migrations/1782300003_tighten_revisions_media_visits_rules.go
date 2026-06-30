package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		// --- revisions ---
		// Before: @request.auth.id != ""  — any authenticated user could read
		// the full snapshot (title/content/status) of every post, including
		// other users' private drafts, via the generic pb REST API.
		// After: also require target.deleted = false so the rule at least
		// matches the tightened posts ListRule. This is the minimum bar; a
		// stricter "target.author = @request.auth.id" rule is deferred until
		// we audit whether the admin UI needs cross-user history browsing.
		revCol, err := db.FindCollectionByNameOrId("revisions")
		if err != nil {
			return err
		}
		revRule := `@request.auth.id != "" && target.deleted = false`
		revCol.ListRule = strPtr(revRule)
		revCol.ViewRule = strPtr(revRule)
		if err := db.Save(revCol); err != nil {
			return err
		}

		// --- media ---
		// Read rule unchanged (img is public, everything else needs login).
		// Write rules tightened from "@request.auth.id != ''" (any logged-in
		// user could mutate anyone's media) to the same model as posts:
		// admin OR article:* permission holder.
		mediaCol, err := db.FindCollectionByNameOrId("media")
		if err != nil {
			return err
		}
		mediaWrite := `@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.permissions ?~ "article:")`
		mediaCol.CreateRule = strPtr(mediaWrite)
		mediaCol.UpdateRule = strPtr(mediaWrite)
		mediaCol.DeleteRule = strPtr(mediaWrite)
		if err := db.Save(mediaCol); err != nil {
			return err
		}

		// --- visits ---
		// visits is system-maintained (pb hooks increment counters). Read
		// rule unchanged (login-gated). UpdateRule dropped to admin-only —
		// there is no legitimate user-facing update path, and the previous
		// "any logged-in user can overwrite stats" was an oversight.
		visitsCol, err := db.FindCollectionByNameOrId("visits")
		if err != nil {
			return err
		}
		visitsCol.UpdateRule = strPtr(`@request.auth.role = "admin"`)
		return db.Save(visitsCol)
	}, func(db core.App) error {
		// Forward-only. To revert, write a new migration restoring prior rules.
		return nil
	})
}
