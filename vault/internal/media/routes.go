package media

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
)

// canManageMedia mirrors article.canManagePosts: admin or article:* holder.
// Kept package-local so media can later split into a dedicated media:*
// permission without touching article.
func canManageMedia(auth *core.Record) bool {
	if auth == nil {
		return false
	}
	if auth.GetString("role") == "admin" {
		return true
	}
	for _, p := range auth.GetStringSlice("permissions") {
		if p == "article:delete" || p == "all" {
			return true
		}
	}
	return false
}

// handleDelete permanently removes a media record (no soft-delete model).
// Purge is gated by canManageMedia; pb's media DeleteRule (1782300003) is
// the API-layer net, this is the stable server-side contract.
//
// Known side effect (not handled here): posts whose HTML body references the
// deleted file via <img src> will keep stale links. Frontend only shows a
// generic "irreversible" confirm; reference cleanup is a P3 concern.
func (m *Manager) handleDelete(e *core.RequestEvent) error {
	if !canManageMedia(e.Auth) {
		return e.ForbiddenError("admin or article:delete required", "")
	}
	id := e.Request.PathValue("id")
	if id == "" {
		return e.BadRequestError("missing path parameter {id}", "")
	}
	rec, err := m.app.FindRecordById("media", id)
	if err != nil {
		return e.NotFoundError("media record not found", "")
	}
	if err := m.app.Delete(rec); err != nil {
		return e.JSON(http.StatusInternalServerError, err.Error())
	}
	return e.JSON(http.StatusOK, map[string]bool{"ok": true})
}
