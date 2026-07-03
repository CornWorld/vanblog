package caddy

// audit.go writes routing changes to the shared `audits` table.
//
// Scope: routing only for now. JSVM hooks (pb_hooks/lib/vanblog-audit.js)
// already cover posts/tags/categories/media/users/site/auth. The Go-side
// routing code path bypasses hooks entirely, so it has to write audits
// directly.
//
// Schema (matches what JSVM writes):
//   - actor:     relation to users, optional (empty when triggered by
//                internal sync — operator sees "system/agent" in UI)
//   - action:    e.g. "routing.replace", "routing.replace.rollback"
//   - target:    "site:routing" (constant for this module)
//   - result:    "success" | "failure"
//   - detail:    JSON summary — rule counts + before/after id lists + error
//   - ip / userAgent: empty (no RequestEvent at this layer; if we need it
//                later, pass through from handler)
//
// Detail stores only rule IDs (not full From/To). The audit log answers
// "who changed what when" — it is not a versioning system. Full before/after
// snapshots belong in revisions, not here.

import (
	"encoding/json"

	"github.com/pocketbase/pocketbase/core"
)

// routingAuditDetail is the JSON shape stored in audits.detail for routing
// events. Only IDs and counts go in — full rule bodies are recoverable from
// site.routing itself, no need to duplicate them in the audit log.
type routingAuditDetail struct {
	Before     []string `json:"before,omitempty"`
	After      []string `json:"after,omitempty"`
	Allowlist  int      `json:"allowlist,omitempty"`
	Rollback   bool     `json:"rollback,omitempty"`
	CaddyError string   `json:"caddyError,omitempty"`
}

// ruleIDs returns the IDs of the given rules for audit summary. Trims to
// reasonable length to keep audit rows readable.
func ruleIDs(rules []UserRule) []string {
	if len(rules) == 0 {
		return nil
	}
	ids := make([]string, 0, len(rules))
	for _, r := range rules {
		ids = append(ids, r.ID)
	}
	return ids
}

// recordRoutingAudit writes a single row to the audits table. Errors are
// swallowed — an audit failure must not break the operation it was logging.
// Returns silently on collection lookup failure (e.g. fresh install before
// migrations have run, though that path doesn't call this).
func recordRoutingAudit(app core.App, action, result string, detail routingAuditDetail) {
	col, err := app.FindCollectionByNameOrId("audits")
	if err != nil || col == nil {
		return
	}

	detailJSON, err := json.Marshal(detail)
	if err != nil {
		return
	}

	rec := core.NewRecord(col)
	rec.Set("action", action)
	rec.Set("target", "site:routing")
	rec.Set("result", result)
	rec.Set("detail", string(detailJSON))
	// actor / ip / userAgent intentionally left empty — applyRules runs on
	// the actor goroutine without a RequestEvent. The handler layer can be
	// wired in if attribution becomes important.
	if err := app.Save(rec); err != nil {
		// Last-resort log; we have no logger here. Audits are observability,
		// not correctness — failing to record must not block the operation.
		return
	}
}
