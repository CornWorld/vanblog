package caddy

import (
	"encoding/json"
	"log"

	"github.com/cornworld/vanblog/utils/caddyadmin"
	"github.com/pocketbase/pocketbase/core"
)

// BootstrapSync reads site.routing from the database, translates to Caddy routes,
// and applies them via the Caddy admin API. Should be called on startup.
//
// This is best-effort: if Caddy is not running or unreachable, it logs
// a warning and continues (the blog still works, just without custom routes).
func BootstrapSync(app core.App, caddyServerName string, caddyAdminURL string) {
	site, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || site == nil {
		return
	}

	routingStr := site.GetString("routing")
	if routingStr == "" || routingStr == "[]" {
		return
	}

	var rules []UserRule
	if err := json.Unmarshal([]byte(routingStr), &rules); err != nil {
		log.Printf("[vanblog] failed to parse site.routing: %v", err)
		return
	}
	if len(rules) == 0 {
		return
	}

	// Get allowlist for SSRF check
	allowDomains := site.GetStringSlice("allowedDomains")

	// Translate + validate
	routes, err := TranslateAll(rules, allowDomains)
	if err != nil {
		log.Printf("[vanblog] routing translation failed: %v", err)
		return
	}

	// Apply to Caddy
	client := caddyadmin.NewClient(caddyAdminURL)
	applied := 0
	for _, route := range routes {
		if err := client.AddRoute(caddyServerName, route); err != nil {
			log.Printf("[vanblog] caddy route %s failed: %v", route.ID, err)
		} else {
			applied++
		}
	}
	log.Printf("[vanblog] caddy bootstrap: %d/%d routes applied", applied, len(routes))
}
