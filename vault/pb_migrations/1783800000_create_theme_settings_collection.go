package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// theme_settings: one row per theme holding its user-configured settings
// values (the schema is declared by the theme itself in theme.json `settings`
// and validated by vault/internal/theme/settings.go).
//
// Read model: PUBLIC list/view — SSR layouts consume the merged values on
// every public page render (same posture as `site`). The values are
// appearance parameters only; secrets must never land here (site_secrets is
// the only credential store — docs/security-invariants.md).
// Write model: admin role via the REST rules, plus the custom admin-only
// route pair (GET/PUT /api/vanblog/theme-settings/<name>) used by the SDK.
func init() {
	m.Register(func(db core.App) error {
		col := core.NewCollection(core.CollectionTypeBase, "theme_settings")
		col.Fields.Add(&core.TextField{Name: "theme", Required: true})
		col.Fields.Add(&core.JSONField{Name: "values"})
		col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
		col.Fields.Add(&core.AutodateField{Name: "updated", OnUpdate: true})
		// Empty rule string = public access; theme settings are render inputs.
		col.ListRule = new("")
		col.ViewRule = new("")
		col.CreateRule = new(`@request.auth.role = "admin"`)
		col.UpdateRule = new(`@request.auth.role = "admin"`)
		col.DeleteRule = new(`@request.auth.role = "admin"`)
		if col.GetIndex("idx_theme_settings_theme_unique") == "" {
			col.AddIndex("idx_theme_settings_theme_unique", true, "`theme`", "")
		}
		return db.Save(col)
	}, func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("theme_settings")
		if err != nil {
			return nil // nothing to drop
		}
		return db.Delete(col)
	})
}
