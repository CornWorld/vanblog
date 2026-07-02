package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		// Add site.routingAllowlist: hosts the user has explicitly trusted
		// for proxy rules. Used by the caddy admin route PUT
		// /api/vanblog/routing/rules when validating rule.To targets —
		// anything outside DefaultAllowlist (private ranges) must be listed
		// here or the rule is rejected as SSRF.
		//
		// Stored as JSON array of host strings (supports exact host and
		// "*.suffix" wildcard). Empty by default — sites without custom
		// routing keep the strict private-only behavior.
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return err
		}
		col.Fields.Add(&core.JSONField{Name: "routingAllowlist"})
		return db.Save(col)
	}, func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return err
		}
		col.Fields.RemoveByName("routingAllowlist")
		return db.Save(col)
	})
}
