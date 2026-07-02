package caddy

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	"github.com/cornworld/vanblog/internal/site"
)

// Admin routes for editing site.routing. The runtime config push to Caddy is
// intentionally NOT triggered here — that's a heavy operation with retries
// and caddyLastError bookkeeping (see BootstrapSync). For now, edits take
// effect on the next bootstrap (process restart or explicit admin action).
// We surface this clearly in the API response so the UI can show a "restart
// to apply" hint.
//
// All routes are admin-only. SSRF and reserved-path validation run on every
// write, so a bad rule never lands in the DB.

func (s *Service) registerAdminRoutes(se *core.ServeEvent) {
	se.Router.GET("/api/vanblog/routing/rules", s.handleListRules)
	se.Router.PUT("/api/vanblog/routing/rules", s.handleReplaceRules)
	se.Router.POST("/api/vanblog/routing/validate", s.handleValidateRule)
	se.Router.POST("/api/vanblog/routing/apply", s.handleApply)
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

// handleReplaceRules validates the full rule set atomically, then writes it.
// If any single rule fails SSRF or reserved-path checks, the whole batch is
// rejected and the DB row stays unchanged — no partial updates.
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

	// Full validation pass: TranslateAll runs SSRF + reserved-path + type
	// checks. Uses nil allowlist so SSRF falls back to DefaultAllowlist
	// (private network ranges only).
	if _, err := TranslateAll(req.Rules, req.Allowlist); err != nil {
		return e.BadRequestError(err.Error(), "")
	}

	rec, err := site.Get(s.app)
	if err != nil {
		return e.JSON(http.StatusInternalServerError, err.Error())
	}

	rulesJSON, err := json.Marshal(req.Rules)
	if err != nil {
		return e.JSON(http.StatusInternalServerError, err.Error())
	}
	rec.Set("routing", string(rulesJSON))
	rec.Set("routingAllowlist", normalizeAllowlist(req.Allowlist))
	if err := s.app.Save(rec); err != nil {
		return e.JSON(http.StatusInternalServerError, err.Error())
	}

	return e.JSON(http.StatusOK, map[string]any{
		"ok":              true,
		"applied":         false, // requires restart / re-bootstrap
		"restart_needed":  true,
	})
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
			"applied":         false,
			"restart_needed":  false,
			"error":           "VANBLOG_SKIP_CADDY_SYNC=1：当前未连接 Caddy，跳过应用",
		})
	}

	if err := BootstrapSync(s.app, s.caddyAdminURL); err != nil {
		return e.JSON(http.StatusOK, map[string]any{
			"applied":         false,
			"restart_needed":  true,
			"error":           err.Error(),
		})
	}
	return e.JSON(http.StatusOK, map[string]any{
		"applied":         true,
		"restart_needed":  false,
	})
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
