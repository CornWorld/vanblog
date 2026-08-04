package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		// site.activeTheme should point at the flagship "vanblog" theme.
		// 1783100000 added the field without a default, so existing site
		// records were left empty. The theme host falls back to "vanblog"
		// at runtime, but backfill the single site row so the value is
		// explicit and the recommendedPalette chain (site.palette →
		// activeTheme.recommendedPalette) works out of the box.
		rec, err := db.FindFirstRecordByFilter("site", "id!=''")
		if err != nil {
			return nil // no site record yet (fresh install before setup)
		}
		if rec.GetString("activeTheme") == "" {
			rec.Set("activeTheme", "vanblog")
			return db.Save(rec)
		}
		return nil
	}, func(db core.App) error {
		// Nothing to revert — we only set a runtime value, no schema change.
		return nil
	})
}
