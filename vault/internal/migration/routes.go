package migration

import (
	"io"
	"net/http"

	"github.com/pocketbase/pocketbase/core"
)

// RegisterRoutes wires POST /api/vanblog/migrate/import onto pb's OnServe.
// Kept separate from Importer so import logic stays testable without HTTP.
func RegisterRoutes(app core.App) {
	imp := New(app)
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/vanblog/migrate/import", func(e *core.RequestEvent) error {
			body, err := io.ReadAll(io.LimitReader(e.Request.Body, 100*1024*1024))
			if err != nil {
				return e.BadRequestError("Failed to read body", "")
			}
			result, err := imp.Import(body)
			if err != nil {
				return e.BadRequestError("Migration failed", err.Error())
			}
			return e.JSON(http.StatusOK, result)
		})
		return se.Next()
	})
}
