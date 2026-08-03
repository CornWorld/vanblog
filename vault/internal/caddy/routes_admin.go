package caddy

// routes_admin.go implements the admin API for editing site.routing.
//
// Design: replace is atomic — writing the new rule set to the DB is followed
// immediately by BootstrapSync to push the translated config into running
// Caddy. If the push fails (SSRF slips past TranslateAll, Caddy unreachable,
// config rejected by /load), the DB row is rolled back to its pre-replace
// value so the persisted state never lies about what Caddy is actually
// running. The standalone /apply endpoint remains as an operator-initiated
// retry / resync entry point.
//
// All routes are admin-only. SSRF, reserved-path, and quota validation run
// on every write, so a bad or oversized rule set never lands in the DB.

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/cornworld/vanblog/internal/site"
	"github.com/pocketbase/pocketbase/core"
)

// MaxUserRules bounds the size of site.routing. Each user rule expands to a
// Caddy route, and unbounded growth linearly slows every request through
// Caddy's route matcher. 50 is generous for a personal blog; raising it
// requires a code change, which forces a deliberate review instead of a
// quiet config bump that lets an operator accidentally push Caddy into
// O(n²) territory.
const MaxUserRules = 50

func (s *Service) registerAdminRoutes(se *core.ServeEvent) {
	se.Router.GET("/api/vanblog/routing/rules", s.handleListRules)
	se.Router.GET("/api/vanblog/routing/status", s.handleRoutingStatus)
	se.Router.GET("/api/vanblog/routing/audits", s.handleRoutingAudits)
	se.Router.GET("/api/vanblog/routing/render", s.handleRenderConfig)
	se.Router.PUT("/api/vanblog/routing/rules", s.handleReplaceRules)
	se.Router.POST("/api/vanblog/routing/validate", s.handleValidateRule)
	se.Router.POST("/api/vanblog/routing/apply", s.handleApply)
	se.Router.POST("/api/vanblog/themes/reload", s.handleThemeReload)
}

// requireAdmin mirrors internal/admin.requireAdmin — duplicated here to
// avoid an import cycle (internal/admin already imports nothing from
// caddy; pulling it in would tie the packages together needlessly).
func requireAdmin(auth *core.Record) bool {
	return auth != nil && auth.GetString("role") == "admin"
}

func (s *Service) handleListRules(e *core.RequestEvent) error {
	if !requireAdmin(e.Auth) {
		return e.ForbiddenError("admin role required", "")
	}
	rec, err := site.Get(s.app)
	if err != nil {
		return e.JSON(http.StatusInternalServerError, err.Error())
	}
	rules, allowlist, err := readRouting(rec)
	if err != nil {
		return e.JSON(http.StatusInternalServerError, err.Error())
	}
	return e.JSON(http.StatusOK, map[string]any{
		"rules":     rules,
		"allowlist": allowlist,
	})
}

type replaceRulesReq struct {
	Rules     []UserRule `json:"rules"`
	Allowlist []string   `json:"allowlist"`
}

// replaceResult is the structured outcome of applyRules. Handlers marshal it
// straight to JSON; tests assert on the fields directly without building a
// fake *http.Request / RequestEvent.
type replaceResult struct {
	OK            bool   `json:"ok"`
	Applied       bool   `json:"applied"`
	RestartNeeded bool   `json:"restart_needed"` // true only in SKIP_CADDY_SYNC mode
	RolledBack    bool   `json:"rolled_back,omitempty"`
	Error         string `json:"error,omitempty"`
}

// handleReplaceRules is the HTTP shim around applyRules. Pre-save validation
// failures (bad JSON, dup IDs, quota, TranslateAll) return BadRequestError so
// the SDK raises and the frontend's catch branch runs. Post-save failures
// (BootstrapSync couldn't push) return 200 with ok=false so the frontend can
// show the inline rolled-back message without an exception swallowing it —
// same convention as handleApply.
func (s *Service) handleReplaceRules(e *core.RequestEvent) error {
	if !requireAdmin(e.Auth) {
		return e.ForbiddenError("admin role required", "")
	}
	var req replaceRulesReq
	if err := json.NewDecoder(e.Request.Body).Decode(&req); err != nil {
		return e.BadRequestError("invalid JSON body", "")
	}

	// Dedup IDs defensively — Caddy uses @id as a stable key, and duplicates
	// would silently override each other in the translated config.
	seen := make(map[string]bool, len(req.Rules))
	for _, r := range req.Rules {
		if r.ID == "" {
			return e.BadRequestError("rule missing id", "")
		}
		if seen[r.ID] {
			return e.BadRequestError("duplicate rule id: "+r.ID, "")
		}
		seen[r.ID] = true
	}

	// Quota: bound the route table before TranslateAll spends cycles on it.
	if n := len(req.Rules); n > MaxUserRules {
		return e.BadRequestError(fmt.Sprintf(
			"too many rules: %d > limit %d", n, MaxUserRules), "")
	}

	// Full validation pass: TranslateAll runs SSRF + reserved-path + type
	// checks. nil allowlist falls back to DefaultAllowlist (private ranges).
	if _, err := TranslateAll(req.Rules, req.Allowlist); err != nil {
		return e.BadRequestError(err.Error(), "")
	}

	res := s.submit(syncRequest{apply: &applyPayload{
		rules:     req.Rules,
		allowlist: req.Allowlist,
	}})
	return e.JSON(http.StatusOK, res)
}

// applyRules persists the rule set to site.routing + site.routingAllowlist,
// then immediately pushes the new config to running Caddy. On push failure
// (or unreachable Caddy), the previous site.routing value is restored so
// the DB never describes a state Caddy isn't actually serving.
//
// Caller: the syncWorker actor (runSyncWorker). External HTTP handlers go
// through submit(). Running this on the actor goroutine is what guarantees
// the single-writer invariant — every DB write + Caddy push pair happens
// strictly in arrival order, no interleaving.
//
// VANBLOG_SKIP_CADDY_SYNC=1 short-circuits the push: we write the DB and
// return RestartNeeded=true. This is the dev/smoke escape hatch — there's
// no Caddy to push to, and pretending otherwise would fail every save.
func (s *Service) applyRules(rules []UserRule, allowlist []string) replaceResult {
	rec, err := site.Get(s.app)
	if err != nil {
		return replaceResult{Error: err.Error()}
	}

	// Snapshot for rollback. GetString/Slice return "" / nil when the field
	// is unset, which is exactly what we want to restore on the fresh-install
	// path.
	oldRouting := rec.GetString("routing")
	oldAllowlist := rec.GetStringSlice("routingAllowlist")

	rulesJSON, err := json.Marshal(rules)
	if err != nil {
		return replaceResult{Error: err.Error()}
	}
	// Pre-compute audit summary for the "before" side. We need this regardless
	// of outcome (success, rollback, skip-caddy), so compute once here.
	var beforeIDs []string
	if oldRouting != "" && oldRouting != "[]" {
		var oldRules []UserRule
		if json.Unmarshal([]byte(oldRouting), &oldRules) == nil {
			beforeIDs = ruleIDs(oldRules)
		}
	}
	afterIDs := ruleIDs(rules)

	rec.Set("routing", string(rulesJSON))
	rec.Set("routingAllowlist", normalizeAllowlist(allowlist))
	if err := s.app.Save(rec); err != nil {
		return replaceResult{Error: err.Error()}
	}

	// SKIP_CADDY_SYNC: write-only mode. Don't touch Caddy; surface the
	// restart-needed hint so the operator knows the persisted rules won't
	// take effect until Caddy is back in the loop.
	if strings.EqualFold(os.Getenv("VANBLOG_SKIP_CADDY_SYNC"), "1") {
		recordRoutingAudit(s.app, "routing.replace", "success", routingAuditDetail{
			Before:    beforeIDs,
			After:     afterIDs,
			Allowlist: len(normalizeAllowlist(allowlist)),
		})
		return replaceResult{OK: true, RestartNeeded: true}
	}

	// Build opts from the freshly-saved record so Email/LogLevel/allowedDomains
	// match what BootstrapSyncFromDB would have read. We deliberately pass
	// the rules we just persisted (NOT a re-read) so a concurrent caller
	// editing site.routing between our Save and this BootstrapSync can't
	// poison the push. The actor guarantees no other vanblog code path is
	// writing at the same time, but defends against future writers
	// (pb_hooks, future managers) too.
	opts, _ := loadBootstrapInputs(s.app)
	if err := BootstrapSync(s.app, s.caddyAdminURL, opts, rules); err != nil {
		// Push failed. Roll the DB back so site.routing reflects what
		// Caddy is actually running (the pre-replace config, which the
		// operator presumably was happy with).
		//
		// BootstrapSync has already written its own failure reason to
		// site.caddyLastError, but we also need to undo the routing
		// mutation itself. Re-read the record in case pb's record cache
		// returned the same pointer we just mutated — Set + Save on the
		// stale in-memory copy would silently no-op some fields.
		rec2, rerr := site.Get(s.app)
		if rerr == nil {
			rec2.Set("routing", oldRouting)
			rec2.Set("routingAllowlist", oldAllowlist)
			if serr := s.app.Save(rec2); serr != nil {
				// Rollback itself failed — extremely rare (disk full,
				// locked SQLite). Surface both errors so the operator
				// sees the DB is now inconsistent and can manually fix.
				recordRoutingAudit(s.app, "routing.replace", "failure", routingAuditDetail{
					Before: beforeIDs, After: afterIDs, Rollback: false,
					CaddyError: fmt.Sprintf("%v (rollback failed: %v — DB inconsistent)", err, serr),
				})
				return replaceResult{
					Error:      fmt.Sprintf("%v (rollback also failed: %v — DB may be inconsistent)", err, serr),
					RolledBack: false,
				}
			}
		}
		recordRoutingAudit(s.app, "routing.replace", "failure", routingAuditDetail{
			Before: beforeIDs, After: beforeIDs, // after = before because we rolled back
			Rollback:   rerr == nil,
			CaddyError: err.Error(),
		})
		return replaceResult{
			Error:      err.Error(),
			RolledBack: rerr == nil,
		}
	}

	recordRoutingAudit(s.app, "routing.replace", "success", routingAuditDetail{
		Before:    beforeIDs,
		After:     afterIDs,
		Allowlist: len(normalizeAllowlist(allowlist)),
	})
	return replaceResult{OK: true, Applied: true}
}

type validateReq struct {
	Rule      UserRule `json:"rule"`
	Allowlist []string `json:"allowlist"`
}

// handleValidateRule dry-runs a single rule without writing anything.
// Used by the UI's "test" button before the user commits to a save.
func (s *Service) handleValidateRule(e *core.RequestEvent) error {
	if !requireAdmin(e.Auth) {
		return e.ForbiddenError("admin role required", "")
	}
	var req validateReq
	if err := json.NewDecoder(e.Request.Body).Decode(&req); err != nil {
		return e.BadRequestError("invalid JSON body", "")
	}

	if _, err := TranslateAll([]UserRule{req.Rule}, req.Allowlist); err != nil {
		return e.JSON(http.StatusOK, map[string]any{
			"ok":    false,
			"error": err.Error(),
		})
	}
	return e.JSON(http.StatusOK, map[string]any{"ok": true})
}

// handleApply re-runs BootstrapSync to push the current site.routing into the
// running Caddy. Used by the UI's "apply now" button so config changes take
// effect without a process restart.
//
// BootstrapSync is the same code path used at startup: it reads the DB,
// translates, validates via Caddy's /load, and applies. Errors are already
// persisted to site.caddyLastError (see BootstrapSync), so the response
// surfaces the same string for inline display.
//
// Synchronous: a healthy Caddy completes in <100ms. When Caddy is unreachable
// BootstrapSync's retry policy kicks in (worst case ~30s), but that's the
// right behavior here — the operator clicked "apply" and wants to know if it
// worked, not a fake-202 that hides failure.
func (s *Service) handleApply(e *core.RequestEvent) error {
	if !requireAdmin(e.Auth) {
		return e.ForbiddenError("admin role required", "")
	}
	// Skip-caddy mode is a dev/smoke escape hatch; applying makes no sense
	// because there's no Caddy to push to.
	if strings.EqualFold(os.Getenv("VANBLOG_SKIP_CADDY_SYNC"), "1") {
		return e.JSON(http.StatusOK, map[string]any{
			"applied":        false,
			"restart_needed": false,
			"error":          "VANBLOG_SKIP_CADDY_SYNC=1：当前未连接 Caddy，跳过应用",
		})
	}

	if err := func() error {
		res := s.submit(syncRequest{resync: true})
		if res.Error != "" {
			return fmt.Errorf("%s", res.Error)
		}
		return nil
	}(); err != nil {
		return e.JSON(http.StatusOK, map[string]any{
			"applied":        false,
			"restart_needed": true,
			"error":          err.Error(),
		})
	}
	return e.JSON(http.StatusOK, map[string]any{
		"applied":        true,
		"restart_needed": false,
	})
}

// handleThemeReload is the admin-only trigger for re-syncing Caddy after the
// themes directory changed at runtime (e.g. an operator dropped a new theme
// folder into VANBLOG_THEMES_DIR). buildStaticRoutes enumerates the themes
// dir at config-build time, so the file_server routes for a newly-added
// theme only exist after a resync — this endpoint runs exactly that push.
//
// Response shape matches /api/vanblog/routing/apply: applied / restart_needed
// / error, so the frontend can surface the outcome inline.
func (s *Service) handleThemeReload(e *core.RequestEvent) error {
	if !requireAdmin(e.Auth) {
		return e.ForbiddenError("admin role required", "")
	}
	applied, restartNeeded, errMsg := s.reloadThemes()
	return e.JSON(http.StatusOK, map[string]any{
		"applied":        applied,
		"restart_needed": restartNeeded,
		"error":          errMsg,
	})
}

// reloadThemes is the testable core of the reload endpoint: re-run
// BootstrapSyncFromDB so Caddy re-enumerates the themes directory and emits
// file_server routes for any newly-added theme. In skip-caddy mode it reports
// restart_needed=true without touching Caddy (same escape hatch as handleApply).
func (s *Service) reloadThemes() (applied, restartNeeded bool, errMsg string) {
	if strings.EqualFold(os.Getenv("VANBLOG_SKIP_CADDY_SYNC"), "1") {
		return false, true, "VANBLOG_SKIP_CADDY_SYNC=1：当前未连接 Caddy，跳过应用"
	}
	res := s.submit(syncRequest{resync: true})
	if res.Error != "" {
		return false, true, res.Error
	}
	return true, false, ""
}

// readRouting parses site.routing + site.routingAllowlist. Empty/missing
// values normalize to empty slices, never nil-through-error.
func readRouting(rec *core.Record) ([]UserRule, []string, error) {
	var rules []UserRule
	if raw := rec.GetString("routing"); raw != "" && raw != "[]" {
		if err := json.Unmarshal([]byte(raw), &rules); err != nil {
			return nil, nil, err
		}
	}
	allowlist := rec.GetStringSlice("routingAllowlist")
	return rules, allowlist, nil
}

func normalizeAllowlist(in []string) []string {
	out := make([]string, 0, len(in))
	for _, h := range in {
		h = strings.TrimSpace(h)
		if h != "" {
			out = append(out, h)
		}
	}
	return out
}

// routingStatusResult is the structured shape of GET /routing/status. The
// frontend uses it to render a top-of-page health banner:
//   - caddyLastError non-empty → red banner "上次应用失败：<error>"
//   - caddy_reachable=false   → yellow banner "Caddy 不可达"
//
// Both can be true at once (Caddy is down AND the last push failed).
type routingStatusResult struct {
	CaddyLastError string `json:"caddyLastError,omitempty"`
	CaddyReachable bool   `json:"caddy_reachable"`
	PendingRules   int    `json:"pending_rules"` // rules in DB; Caddy may not yet reflect them
}

// handleRoutingStatus surfaces the routing sub-system's health so the admin
// UI can show a banner without polling multiple endpoints. Cheap to call:
// one DB read + one short HTTP ping to Caddy.
//
// reachability uses a 1s deadline — generous enough for a healthy local
// Caddy, tight enough that a hung admin API doesn't stall the page. The
// endpoint stays admin-only because caddyLastError can leak operational
// details (paths, partial URLs).
func (s *Service) handleRoutingStatus(e *core.RequestEvent) error {
	if !requireAdmin(e.Auth) {
		return e.ForbiddenError("admin role required", "")
	}
	return e.JSON(http.StatusOK, s.routingStatus())
}

// routingStatus is the testable core: read site row + ping Caddy. Handler
// is thin HTTP glue. Exercised directly in routes_admin_test.go.
func (s *Service) routingStatus() routingStatusResult {
	var lastErr string
	pending := 0
	if rec, err := site.Get(s.app); err == nil {
		lastErr = rec.GetString("caddyLastError")
		if rules, _, rerr := readRouting(rec); rerr == nil {
			pending = len(rules)
		}
	}

	// 1s deadline. WaitForCaddy internally polls every 500ms, so this
	// gives it ~2 attempts — enough signal without stalling the UI.
	reachable := true
	if err := WaitForCaddy(s.caddyAdminURL, 1*time.Second); err != nil {
		reachable = false
	}

	return routingStatusResult{
		CaddyLastError: lastErr,
		CaddyReachable: reachable,
		PendingRules:   pending,
	}
}

// routingAuditEntry is one row in the recent-changes feed shown at the top
// of /admin/routing. We project only what the UI needs — the operator gets
// a quick "what happened lately" view, not a full audit dump. Full audit
// history lives in the audits collection via pb's standard admin API.
type routingAuditEntry struct {
	Created   string         `json:"created"`
	Action    string         `json:"action"`
	Result    string         `json:"result"`
	Detail    map[string]any `json:"detail"`
	ActorName string         `json:"actorName,omitempty"` // resolved display name; empty = system
}

// handleRoutingAudits returns the most recent routing-related audit rows
// for the operator "what changed lately" panel. Capped at 10 — anything
// older belongs in the full audits admin view.
//
// actorName is best-effort: if the actor relation resolves to a user we
// include username, otherwise empty (system / agent triggered).
func (s *Service) handleRoutingAudits(e *core.RequestEvent) error {
	if !requireAdmin(e.Auth) {
		return e.ForbiddenError("admin role required", "")
	}
	recs, err := s.app.FindRecordsByFilter(
		"audits",
		`action ~ "routing."`,
		"-created",
		10,
		0,
	)
	if err != nil {
		return e.JSON(http.StatusInternalServerError, err.Error())
	}

	usersCol, _ := s.app.FindCollectionByNameOrId("users")
	out := make([]routingAuditEntry, 0, len(recs))
	for _, r := range recs {
		entry := routingAuditEntry{
			Created: r.GetDateTime("created").String(),
			Action:  r.GetString("action"),
			Result:  r.GetString("result"),
		}
		if raw := r.GetString("detail"); raw != "" {
			var d map[string]any
			if json.Unmarshal([]byte(raw), &d) == nil {
				entry.Detail = d
			}
		}
		// Resolve actor display name. Skip silently on any error — the row
		// is still useful without attribution.
		if actorID := r.GetString("actor"); actorID != "" && usersCol != nil {
			if u, _ := s.app.FindRecordById(usersCol, actorID); u != nil {
				entry.ActorName = u.GetString("username")
			}
		}
		out = append(out, entry)
	}
	return e.JSON(http.StatusOK, map[string]any{"items": out})
}

// renderConfigResult is the body of GET /routing/render — a developer-facing
// diagnostic dump of what vanblog would push to Caddy right now.
//
// Two layers are exposed so the operator can debug at the right altitude:
//   - userRoutes: TranslateAll output of just the user's rules. Small,
//     focused — "did my rule translate correctly?"
//   - fullConfig: the complete caddyadmin.Config (vanblog internals +
//     user rules + TLS) that BootstrapSync would push. Big — "what is
//     Caddy actually getting?"
//
// Both layers are computed from current DB state, NOT from any in-flight
// edits the operator may have in the form. The frontend calls this on
// demand (after save or as a one-off inspection) — there is no live edit
// preview, which would require replicating TranslateAll in JS.
type renderConfigResult struct {
	UserRules  []map[string]any `json:"userRoutes"`
	FullConfig map[string]any   `json:"fullConfig,omitempty"` // omitted if build fails (e.g. SSRF)
	Error      string           `json:"error,omitempty"`      // populated if translation fails
}

// handleRenderConfig is the developer "show me the actual Caddy config" view.
// Reads the current site.routing + allowlist from DB, runs them through the
// same TranslateAll / BuildFullConfig pipeline BootstrapSync uses, and
// returns the structured result. Read-only — never touches Caddy.
//
// Validation errors (SSRF, reserved-path) are surfaced as Error so the
// operator can see exactly which rule is poisoning the build. The full
// config is omitted in that case because BuildFullConfig would also reject.
func (s *Service) handleRenderConfig(e *core.RequestEvent) error {
	if !requireAdmin(e.Auth) {
		return e.ForbiddenError("admin role required", "")
	}
	return e.JSON(http.StatusOK, s.renderConfig())
}

// renderConfig is the testable core: read current routing from DB and run
// through TranslateAll + BuildFullConfig. Handler is thin HTTP glue.
// Exercised directly in routes_admin_test.go.
func (s *Service) renderConfig() renderConfigResult {
	rec, err := site.Get(s.app)
	if err != nil {
		return renderConfigResult{Error: err.Error()}
	}
	rules, allowlist, err := readRouting(rec)
	if err != nil {
		return renderConfigResult{Error: err.Error()}
	}

	out := renderConfigResult{}

	// Layer 1: user routes only. SSRF/reserved-path errors short-circuit
	// here so we still have a useful Error field in the response.
	translated, terr := TranslateAll(rules, allowlist)
	if terr != nil {
		out.Error = terr.Error()
		// TranslateAll returns nil on error today, so userRoutes stays empty.
		return out
	}

	out.UserRules = make([]map[string]any, len(translated))
	for i, r := range translated {
		raw, _ := json.Marshal(r)
		var m map[string]any
		_ = json.Unmarshal(raw, &m)
		out.UserRules[i] = m
	}

	// Layer 2: full config. Build is best-effort — if it fails (rare since
	// TranslateAll already passed), we still return layer 1 + an error.
	opts, _ := loadBootstrapInputs(s.app)
	full, ferr := BuildFullConfig(opts, rules)
	if ferr != nil {
		out.Error = ferr.Error()
		return out
	}
	raw, _ := json.Marshal(full)
	_ = json.Unmarshal(raw, &out.FullConfig)

	return out
}
