// Package schema exposes PocketBase collection definitions as JSON
// for downstream tooling (type generation, introspection).
//
// GET /api/vanblog/schema returns all non-internal collections with
// their fields, types, and options. Internal collections (those whose
// name starts with "_") are filtered out.
//
// This endpoint is intentionally public — collection schema is
// considered non-sensitive metadata. Rules and system fields are
// included as well; consumers are expected to filter as needed.
package schema

import (
	"net/http"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// Manager wires the schema endpoint onto the app's serve mux.
type Manager struct {
	app core.App
}

// New registers the schema route and returns the Manager.
func New(app core.App) *Manager {
	m := &Manager{app: app}
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/vanblog/schema", m.handleSchema)
		return se.Next()
	})
	return m
}

// handleSchema responds with all non-internal collection definitions
// as a JSON array.
func (m *Manager) handleSchema(e *core.RequestEvent) error {
	collections, err := m.app.FindAllCollections()
	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]any{
			"ok":    false,
			"error": err.Error(),
		})
	}

	// Filter out internal collections (names starting with "_")
	filtered := make([]*core.Collection, 0, len(collections))
	for _, col := range collections {
		if !strings.HasPrefix(col.Name, "_") {
			filtered = append(filtered, col)
		}
	}

	return e.JSON(http.StatusOK, filtered)
}
