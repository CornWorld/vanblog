// Package admin hosts HTTP routes for admin-only destructive operations
// that don't belong to any single domain package:
//   - DELETE /api/vanblog/categories/{id}
//   - DELETE /api/vanblog/tags/{id}
//   - DELETE /api/vanblog/users/{id}
//
// Why a dedicated package (rather than scattering routes into article/
// site/etc): these collections have no domain logic of their own — the
// routes are pure permission gates around pb's DeleteRecord. Centralizing
// them keeps the "admin destructive op" surface auditable in one place
// and lets us apply uniform auth rules (admin only, with a few permission
// exceptions noted per handler).
//
// All handlers run defense-in-depth: pb's collection DeleteRule already
// gates these (1782200000), but the Go route is the stable contract —
// admin UI callers should never need to know about Rule changes.
package admin

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
)

// Manager wires admin-destructive HTTP routes onto the app's serve mux.
type Manager struct {
	app core.App
}

// New registers admin routes. Admin-only by default; per-route comments
// note any permission variations.
func New(app core.App) *Manager {
	m := &Manager{app: app}
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.DELETE("/api/vanblog/categories/{id}", m.handleDeleteCategory)
		se.Router.DELETE("/api/vanblog/tags/{id}", m.handleDeleteTag)
		se.Router.DELETE("/api/vanblog/users/{id}", m.handleDeleteUser)

		se.Router.GET("/api/vanblog/backups", m.handleListBackups)
		se.Router.POST("/api/vanblog/backups", m.handleCreateBackup)
		se.Router.GET("/api/vanblog/backups/{key}/download", m.handleDownloadBackup)
		se.Router.DELETE("/api/vanblog/backups/{key}", m.handleDeleteBackup)
		se.Router.POST("/api/vanblog/backups/{key}/restore", m.handleRestoreBackup)
		return se.Next()
	})
	return m
}

// requireAdmin is the strict gate for destructive admin ops. Unlike
// article.canManagePosts / media.canManageMedia (which allow article:*
// permission holders), these routes are reserved for the admin role:
// deleting taxonomies or users affects the whole site, not just content.
func requireAdmin(auth *core.Record) bool {
	return auth != nil && auth.GetString("role") == "admin"
}

func (m *Manager) handleDeleteCategory(e *core.RequestEvent) error {
	return m.deleteRecord(e, "categories")
}

func (m *Manager) handleDeleteTag(e *core.RequestEvent) error {
	return m.deleteRecord(e, "tags")
}

func (m *Manager) handleDeleteUser(e *core.RequestEvent) error {
	// Extra guard: don't let admin delete themselves and lock out the only
	// admin account. pb's DeleteRule doesn't enforce this.
	if e.Auth != nil && e.Auth.Id == e.Request.PathValue("id") {
		return e.BadRequestError("cannot delete your own account", "")
	}
	return m.deleteRecord(e, "users")
}

func (m *Manager) deleteRecord(e *core.RequestEvent, collection string) error {
	if !requireAdmin(e.Auth) {
		return e.ForbiddenError("admin role required", "")
	}
	id := e.Request.PathValue("id")
	if id == "" {
		return e.BadRequestError("missing path parameter {id}", "")
	}
	rec, err := m.app.FindRecordById(collection, id)
	if err != nil {
		return e.NotFoundError(collection+" record not found", "")
	}
	if err := m.app.Delete(rec); err != nil {
		return e.JSON(http.StatusInternalServerError, err.Error())
	}
	return e.JSON(http.StatusOK, map[string]bool{"ok": true})
}
