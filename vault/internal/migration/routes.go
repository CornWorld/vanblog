package migration

import (
	"io"
	"net/http"

	"github.com/pocketbase/pocketbase/core"
)

// RegisterRoutes wires POST /api/vanblog/migrate/import onto pb's OnServe.
//
// The endpoint accepts a ZIP archive produced by the export API
// (GET /api/vanblog/export/*). See ImportZip for the zip layout.
//
// Import is admin-only: it creates arbitrary posts/media, so exposing it
// without auth would let any anonymous visitor write to the site.
func RegisterRoutes(app core.App) {
	imp := New(app)
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/vanblog/migrate/import", func(e *core.RequestEvent) error {
			if e.Auth == nil || e.Auth.GetString("role") != "admin" {
				return e.ForbiddenError("admin role required", "")
			}

			body, err := io.ReadAll(io.LimitReader(e.Request.Body, 100*1024*1024))
			if err != nil {
				return e.BadRequestError("Failed to read body", "")
			}
			result, err := imp.ImportZip(body)
			if err != nil {
				return e.BadRequestError("Migration failed", err.Error())
			}
			return e.JSON(http.StatusOK, result)
		})

		return se.Next()
	})
}
