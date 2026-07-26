package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		// Add theme + palette selector fields to the `site` collection.
		//
		// `palette` is an open TextField (not SelectField) because palettes
		// are user-supplied via hooks/palettes/<name>/ — the server can't
		// enumerate them at schema time. Empty value means "use the default
		// palette baked into the active theme's tokens.css".
		//
		// `activeTheme` is also a TextField, defaulting to "default". The
		// Dockerfile build-arg VANBLOG_ACTIVE_THEME selects which theme is
		// compiled into the image, and entrypoint.prod.sh verifies that
		// site.activeTheme matches the compiled-in theme on startup. When
		// they disagree, the compiled theme wins and the admin UI surfaces
		// a "rebuild required" warning.
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return err
		}
		col.Fields.Add(&core.TextField{Name: "palette"})
		col.Fields.Add(&core.TextField{Name: "activeTheme"})
		return db.Save(col)
	}, func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return err
		}
		col.Fields.RemoveByName("palette")
		col.Fields.RemoveByName("activeTheme")
		return db.Save(col)
	})
}
