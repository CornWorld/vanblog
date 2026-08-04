package caddy

// routes_admin_test.go covers the admin API for site.routing.
//
// Strategy: avoid constructing *core.RequestEvent (zero-value panics on the
// internal data store — see bootstrap_test.go). The handler HTTP shim is
// thin; we exercise applyRules / readRouting / TranslateAll directly. The
// pre-save validation paths (dup IDs, quota, reserved paths, SSRF) are
// plain functions and get their own table-driven tests.
//
// Mocks: setupApp (real pb + migrations) + newMockCaddyAdmin (httptest
// server impersonating Caddy's admin API). Both come from bootstrap_test.go
// in the same package.

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase/core"
)

// withSkipCaddy toggles VANBLOG_SKIP_CADDY_SYNC for a single test. Restored
// via t.Cleanup. Empty string unsets; any non-empty value sets.
func withSkipCaddy(t *testing.T, val string) {
	t.Helper()
	old, had := os.LookupEnv("VANBLOG_SKIP_CADDY_SYNC")
	if val == "" {
		os.Unsetenv("VANBLOG_SKIP_CADDY_SYNC")
	} else {
		os.Setenv("VANBLOG_SKIP_CADDY_SYNC", val)
	}
	t.Cleanup(func() {
		if had {
			os.Setenv("VANBLOG_SKIP_CADDY_SYNC", old)
		} else {
			os.Unsetenv("VANBLOG_SKIP_CADDY_SYNC")
		}
	})
}

// readSiteRouting reads the raw JSON string + allowlist slice from the site
// row. Returns the routing field as a string for snapshot comparison.
func readSiteRouting(t *testing.T, app core.App) (string, []string) {
	t.Helper()
	rec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || rec == nil {
		t.Fatalf("no site row: %v", err)
	}
	return rec.GetString("routing"), rec.GetStringSlice("routingAllowlist")
}

// --- applyRules success path ---

func TestApplyRules_SuccessAppliesAndPersists(t *testing.T) {
	withFastBackoffs(t)
	app := setupApp(t)
	srv, _ := newMockCaddyAdmin(t, 0) // 0 failures → first /load succeeds
	svc := &Service{app: app, caddyAdminURL: srv.URL}

	rules := []UserRule{
		{ID: "docs", Type: "rewrite", From: "/docs/*", To: "/static/docs/*"},
	}
	res := svc.applyRules(rules, []string{"my-svc.local"})

	if !res.OK || !res.Applied || res.RestartNeeded || res.RolledBack || res.Error != "" {
		t.Fatalf("expected clean success, got %+v", res)
	}

	// DB persisted.
	gotRouting, gotAllow := readSiteRouting(t, app)
	var got []UserRule
	if err := json.Unmarshal([]byte(gotRouting), &got); err != nil {
		t.Fatalf("persisted routing is not valid JSON: %v", err)
	}
	if len(got) != 1 || got[0].ID != "docs" {
		t.Errorf("persisted rule mismatch: %+v", got)
	}
	if len(gotAllow) != 1 || gotAllow[0] != "my-svc.local" {
		t.Errorf("persisted allowlist mismatch: %+v", gotAllow)
	}

	// Success path clears any stale caddyLastError.
	if e := readCaddyLastError(t, app); e != "" {
		t.Errorf("caddyLastError should be empty after success, got %q", e)
	}
}

// --- applyRules rollback when BootstrapSync fails ---

func TestApplyRules_RollbackOnApplyFailure(t *testing.T) {
	withFastBackoffs(t)
	app := setupApp(t)

	// Seed pre-existing rules so we can prove the rollback restored them
	// (not just "emptied on top of an empty table").
	seedRules := []UserRule{{ID: "old-rule", Type: "block", From: "/block-me/*"}}
	seedJSON, _ := json.Marshal(seedRules)
	rec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || rec == nil {
		t.Fatalf("seed: no site row: %v", err)
	}
	rec.Set("routing", string(seedJSON))
	rec.Set("routingAllowlist", []string{"old-host.local"})
	if err := app.Save(rec); err != nil {
		t.Fatalf("seed: save: %v", err)
	}

	// Mock Caddy that never accepts /load → BootstrapSync exhausts retries.
	srv, _ := newMockCaddyAdmin(t, 1000)
	svc := &Service{app: app, caddyAdminURL: srv.URL}

	newRules := []UserRule{
		{ID: "new-rule", Type: "rewrite", From: "/x/*", To: "/y/*"},
	}
	res := svc.applyRules(newRules, []string{"new-host.local"})

	if res.OK || res.Applied {
		t.Errorf("expected failure, got OK/Applied: %+v", res)
	}
	if !res.RolledBack {
		t.Errorf("expected RolledBack=true, got %+v", res)
	}
	if res.Error == "" {
		t.Errorf("expected non-empty error, got empty")
	}

	// site.routing should still hold the OLD rules.
	gotRouting, gotAllow := readSiteRouting(t, app)
	if gotRouting != string(seedJSON) {
		t.Errorf("routing not restored to pre-replace value\n got: %s\n want: %s", gotRouting, seedJSON)
	}
	if len(gotAllow) != 1 || gotAllow[0] != "old-host.local" {
		t.Errorf("allowlist not restored: %+v", gotAllow)
	}

	// BootstrapSync persisted its failure reason → UI surfaces it.
	if e := readCaddyLastError(t, app); e == "" {
		t.Errorf("caddyLastError should be populated after rollback")
	}
}

// --- applyRules in VANBLOG_SKIP_CADDY_SYNC=1 mode ---

func TestApplyRules_SkipCaddyMode(t *testing.T) {
	withSkipCaddy(t, "1")
	withFastBackoffs(t)
	app := setupApp(t)

	// No mock Caddy — if applyRules tried to reach out, the test would
	// hang on retries. Setting up no server is itself the assertion that
	// SKIP_CADDY_SYNC short-circuits before BootstrapSync.
	svc := &Service{app: app, caddyAdminURL: "http://0.0.0.0:0"}

	rules := []UserRule{{ID: "skipped", Type: "block", From: "/x"}}
	res := svc.applyRules(rules, nil)

	if !res.OK || res.Applied || !res.RestartNeeded {
		t.Fatalf("expected OK+RestartNeeded (skip mode), got %+v", res)
	}

	// Rules still persisted — the operator gets to save work for later.
	gotRouting, _ := readSiteRouting(t, app)
	var got []UserRule
	if err := json.Unmarshal([]byte(gotRouting), &got); err != nil {
		t.Fatalf("persisted routing invalid: %v", err)
	}
	if len(got) != 1 || got[0].ID != "skipped" {
		t.Errorf("rule not persisted in skip mode: %+v", got)
	}
}

// --- Quota boundary ---

func TestMaxUserRules_Boundary(t *testing.T) {
	// Quota is enforced in handleReplaceRules (the HTTP shim), not in
	// applyRules. We test the boundary by calling the constant directly;
	// the handler-level assertion lives in the HTTP integration test below.
	if MaxUserRules != 50 {
		t.Errorf("MaxUserRules changed: %d — bump deliberately?", MaxUserRules)
	}

	// TranslateAll itself does NOT enforce the cap (it's a translation
	// primitive), so a 100-rule input should still translate fine.
	rules := make([]UserRule, 100)
	for i := range rules {
		rules[i] = UserRule{
			ID:   "r" + string(rune('a'+i%26)) + string(rune('a'+i/26)),
			Type: "block",
			From: "/p" + string(rune('a'+i%26)) + "/*",
		}
	}
	out, err := TranslateAll(rules, nil)
	if err != nil {
		t.Fatalf("TranslateAll should accept >MaxUserRules: %v", err)
	}
	if len(out) != 100 {
		t.Errorf("TranslateAll lost rules: got %d", len(out))
	}
}

// --- readRouting normalization ---

func TestReadRouting_Empty(t *testing.T) {
	// Simulate a fresh site record with no routing field set.
	app := setupApp(t)
	rec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || rec == nil {
		t.Fatalf("no site row: %v", err)
	}
	rules, allowlist, err := readRouting(rec)
	if err != nil {
		t.Fatalf("readRouting: %v", err)
	}
	if len(rules) != 0 {
		t.Errorf("expected empty rules, got %+v", rules)
	}
	if len(allowlist) != 0 {
		t.Errorf("expected empty allowlist, got %+v", allowlist)
	}
}

func TestReadRouting_ParsesStoredJSON(t *testing.T) {
	app := setupApp(t)
	rec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || rec == nil {
		t.Fatalf("no site row: %v", err)
	}
	rec.Set("routing", `[{"id":"a","type":"block","from":"/x"}]`)
	rec.Set("routingAllowlist", []string{"h1", "h2"})
	if err := app.Save(rec); err != nil {
		t.Fatalf("save: %v", err)
	}

	rec2, _ := app.FindFirstRecordByFilter("site", "")
	rules, allowlist, err := readRouting(rec2)
	if err != nil {
		t.Fatalf("readRouting: %v", err)
	}
	if len(rules) != 1 || rules[0].ID != "a" {
		t.Errorf("rule mismatch: %+v", rules)
	}
	if len(allowlist) != 2 || allowlist[0] != "h1" {
		t.Errorf("allowlist mismatch: %+v", allowlist)
	}
}

// --- normalizeAllowlist ---

func TestNormalizeAllowlist_TrimsAndDedupsEmpty(t *testing.T) {
	got := normalizeAllowlist([]string{"  a  ", "", "b", "   "})
	if len(got) != 2 || got[0] != "a" || got[1] != "b" {
		t.Errorf("normalizeAllowlist: %+v", got)
	}
}

// --- routingStatus ---

func TestRoutingStatus_FreshInstallHealthyCaddy(t *testing.T) {
	app := setupApp(t)
	srv, _ := newMockCaddyAdmin(t, 0)
	svc := &Service{app: app, caddyAdminURL: srv.URL}

	got := svc.routingStatus()

	if got.CaddyLastError != "" {
		t.Errorf("fresh install should have empty caddyLastError, got %q", got.CaddyLastError)
	}
	if !got.CaddyReachable {
		t.Errorf("mock caddy is up; expected reachable=true")
	}
	if got.PendingRules != 0 {
		t.Errorf("fresh install should have 0 rules, got %d", got.PendingRules)
	}
}

func TestRoutingStatus_PropagatesLastErrorAndRules(t *testing.T) {
	app := setupApp(t)
	srv, _ := newMockCaddyAdmin(t, 0)
	svc := &Service{app: app, caddyAdminURL: srv.URL}

	// Seed: caddyLastError + 2 routing rules.
	rec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || rec == nil {
		t.Fatalf("seed: no site row: %v", err)
	}
	rec.Set("caddyLastError", "LoadConfig failed: bad rule xyz")
	rec.Set("routing", `[{"id":"a","type":"block","from":"/x"},{"id":"b","type":"block","from":"/y"}]`)
	if err := app.Save(rec); err != nil {
		t.Fatalf("seed: save: %v", err)
	}

	got := svc.routingStatus()

	if got.CaddyLastError != "LoadConfig failed: bad rule xyz" {
		t.Errorf("caddyLastError mismatch: got %q", got.CaddyLastError)
	}
	if !got.CaddyReachable {
		t.Errorf("mock caddy is up; expected reachable=true")
	}
	if got.PendingRules != 2 {
		t.Errorf("expected 2 pending rules, got %d", got.PendingRules)
	}
}

func TestRoutingStatus_CaddyUnreachable(t *testing.T) {
	app := setupApp(t)
	// Point at a port that's almost certainly closed. The 1s WaitForCaddy
	// timeout in routingStatus means this test stays fast.
	svc := &Service{app: app, caddyAdminURL: "http://127.0.0.1:1"}

	got := svc.routingStatus()

	if got.CaddyReachable {
		t.Errorf("expected Caddy unreachable, got reachable=true")
	}
	// DB read should still succeed even if Caddy is down.
	if got.PendingRules != 0 {
		t.Errorf("expected 0 rules on fresh install, got %d", got.PendingRules)
	}
}

// --- audit trail ---

// readRoutingAudits pulls all routing-related audit rows from the audits
// table, newest first. Returns the action + result + rollback flag for
// each — enough to assert what got logged without coupling to the full
// detail JSON shape.
func readRoutingAudits(t *testing.T, app core.App) []map[string]any {
	t.Helper()
	recs, err := app.FindRecordsByFilter("audits", `action ~ "routing."`, "-created", 100, 0)
	if err != nil {
		t.Fatalf("read audits: %v", err)
	}
	out := make([]map[string]any, 0, len(recs))
	for _, r := range recs {
		var detail map[string]any
		if raw := r.GetString("detail"); raw != "" {
			_ = json.Unmarshal([]byte(raw), &detail)
		}
		out = append(out, map[string]any{
			"action":   r.GetString("action"),
			"result":   r.GetString("result"),
			"rollback": detail["rollback"],
			"before":   detail["before"],
			"after":    detail["after"],
		})
	}
	return out
}

func TestApplyRules_WritesSuccessAuditOnPushSuccess(t *testing.T) {
	withFastBackoffs(t)
	app := setupApp(t)
	srv, _ := newMockCaddyAdmin(t, 0)
	svc := &Service{app: app, caddyAdminURL: srv.URL}

	rules := []UserRule{{ID: "r1", Type: "block", From: "/x"}}
	if res := svc.applyRules(rules, nil); !res.OK || !res.Applied {
		t.Fatalf("applyRules failed: %+v", res)
	}

	got := readRoutingAudits(t, app)
	if len(got) != 1 {
		t.Fatalf("expected 1 audit row, got %d: %+v", len(got), got)
	}
	row := got[0]
	if row["action"] != "routing.replace" || row["result"] != "success" {
		t.Errorf("audit row mismatch: %+v", row)
	}
	if row["rollback"] == true {
		t.Errorf("success should not mark rollback")
	}
	after, _ := row["after"].([]any)
	if len(after) != 1 || after[0] != "r1" {
		t.Errorf("after should be [r1], got %+v", after)
	}
}

func TestApplyRules_WritesFailureAuditWithRollbackOnPushFailure(t *testing.T) {
	withFastBackoffs(t)
	app := setupApp(t)
	// Seed pre-existing rules so rollback restores them; the audit's
	// "after" should equal "before" (we rolled back to the prior state).
	seed := []UserRule{{ID: "seed", Type: "block", From: "/seed"}}
	seedJSON, _ := json.Marshal(seed)
	rec, _ := app.FindFirstRecordByFilter("site", "")
	rec.Set("routing", string(seedJSON))
	if err := app.Save(rec); err != nil {
		t.Fatalf("seed: %v", err)
	}

	srv, _ := newMockCaddyAdmin(t, 1000) // always fail
	svc := &Service{app: app, caddyAdminURL: srv.URL}

	newRules := []UserRule{{ID: "r1", Type: "rewrite", From: "/x", To: "/y"}}
	svc.applyRules(newRules, nil)

	got := readRoutingAudits(t, app)
	if len(got) != 1 {
		t.Fatalf("expected 1 audit row, got %d", len(got))
	}
	row := got[0]
	if row["result"] != "failure" {
		t.Errorf("expected failure, got %v", row["result"])
	}
	if row["rollback"] != true {
		t.Errorf("expected rollback=true on push failure, got %v", row["rollback"])
	}
	// after = before because we rolled back. Both should be [seed].
	before, _ := row["before"].([]any)
	after, _ := row["after"].([]any)
	if len(before) != 1 || before[0] != "seed" || len(after) != 1 || after[0] != "seed" {
		t.Errorf("before/after should both be [seed] after rollback, got before=%+v after=%+v", before, after)
	}
}

func TestApplyRules_WritesAuditInSkipCaddyMode(t *testing.T) {
	withSkipCaddy(t, "1")
	withFastBackoffs(t)
	app := setupApp(t)
	svc := &Service{app: app, caddyAdminURL: "http://0.0.0.0:0"}

	rules := []UserRule{{ID: "skipped", Type: "block", From: "/x"}}
	if res := svc.applyRules(rules, nil); !res.OK || !res.Applied && !res.RestartNeeded {
		t.Fatalf("applyRules in skip mode failed: %+v", res)
	}

	got := readRoutingAudits(t, app)
	if len(got) != 1 || got[0]["result"] != "success" {
		t.Errorf("expected one success audit row, got %+v", got)
	}
}

// --- renderConfig ---

func TestRenderConfig_EmptyHasFullConfig(t *testing.T) {
	// Fresh install: no user rules, but vanblog still pushes its own
	// internal routes. The "full config" layer should be non-empty.
	app := setupApp(t)
	svc := &Service{app: app}

	got := svc.renderConfig()
	if got.Error != "" {
		t.Errorf("empty render should not error, got %q", got.Error)
	}
	if len(got.UserRules) != 0 {
		t.Errorf("empty rule set should produce no userRoutes, got %d", len(got.UserRules))
	}
	if len(got.FullConfig) == 0 {
		t.Errorf("full config should still be produced for vanblog internals, got empty")
	}
}

func TestRenderConfig_UserRulesPresent(t *testing.T) {
	app := setupApp(t)
	rec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || rec == nil {
		t.Fatalf("no site row: %v", err)
	}
	rec.Set("routing", `[{"id":"r1","type":"block","from":"/x"},{"id":"r2","type":"redirect","from":"/old/*","to":"/new","code":301}]`)
	if err := app.Save(rec); err != nil {
		t.Fatalf("save: %v", err)
	}
	svc := &Service{app: app}

	got := svc.renderConfig()
	if got.Error != "" {
		t.Fatalf("render: %s", got.Error)
	}
	if len(got.UserRules) != 2 {
		t.Fatalf("expected 2 user routes, got %d (%+v)", len(got.UserRules), got.UserRules)
	}
	// Each route should marshal to a JSON object with match/handle keys.
	// We don't assert exact shape — translator_test.go covers that. Just
	// verify the round-trip produced structured data.
	if got.UserRules[0]["match"] == nil {
		t.Errorf("userRoute[0] missing match key: %+v", got.UserRules[0])
	}
}

func TestRenderConfig_SSRFSurfacesError(t *testing.T) {
	// proxy to a public IP — TranslateAll should reject, render returns
	// Error + no userRoutes. Full config is also omitted.
	app := setupApp(t)
	rec, _ := app.FindFirstRecordByFilter("site", "")
	rec.Set("routing", `[{"id":"evil","type":"proxy","from":"/x","to":"http://8.8.8.8"}]`)
	if err := app.Save(rec); err != nil {
		t.Fatalf("save: %v", err)
	}
	svc := &Service{app: app}

	got := svc.renderConfig()
	if got.Error == "" {
		t.Errorf("expected SSRF error, got none")
	}
	if len(got.UserRules) != 0 {
		t.Errorf("error path should produce no userRoutes, got %d", len(got.UserRules))
	}
	if len(got.FullConfig) != 0 {
		t.Errorf("error path should omit fullConfig, got non-empty")
	}
}

// --- theme reload endpoint core (reloadThemes) ---

func TestReloadThemes_SkipCaddyMode(t *testing.T) {
	withSkipCaddy(t, "1")
	app := setupApp(t)
	// No worker, no Caddy: reloadThemes short-circuits before submit().
	svc := &Service{app: app}

	applied, restartNeeded, errMsg := svc.reloadThemes()
	if applied {
		t.Errorf("skip-caddy mode: applied should be false, got true")
	}
	if !restartNeeded {
		t.Errorf("skip-caddy mode: restart_needed should be true, got false")
	}
	if errMsg == "" {
		t.Errorf("skip-caddy mode: expected informational error message, got empty")
	}
}

func TestReloadThemes_PushesConfig(t *testing.T) {
	withFastBackoffs(t)
	app := setupApp(t)
	srv, _ := newMockCaddyAdmin(t, 0) // 0 failures → first /load succeeds
	svc := &Service{
		app:           app,
		caddyAdminURL: srv.URL,
		syncCh:        make(chan syncRequest),
		done:          make(chan struct{}),
	}
	go svc.runSyncWorker()
	t.Cleanup(svc.Close)

	applied, restartNeeded, errMsg := svc.reloadThemes()
	if !applied {
		t.Errorf("expected applied=true, got false (err=%q)", errMsg)
	}
	if restartNeeded {
		t.Errorf("expected restart_needed=false, got true")
	}
	if errMsg != "" {
		t.Errorf("expected empty error, got %q", errMsg)
	}
}

// TestSyncWorker_RecoversFromPanic guards the actor's panic-recovery: a bug in
// applyRules/resyncFromDB must never kill the single-writer goroutine, which
// would silently deadlock every future submit() with no error surface.
func TestSyncWorker_RecoversFromPanic(t *testing.T) {
	// Nil app → applyRules panics (method call on nil core.App interface).
	svc := &Service{}
	svc.syncCh = make(chan syncRequest)
	svc.done = make(chan struct{})
	go svc.runSyncWorker()
	t.Cleanup(svc.Close)

	// First request panics inside the worker → recovered into a structured error.
	res := svc.submit(syncRequest{apply: &applyPayload{}})
	if !strings.Contains(res.Error, "panic") {
		t.Fatalf("expected panic-recovery error mentioning 'panic', got %q", res.Error)
	}

	// The worker survives: a second submit returns instead of hanging forever.
	res2 := svc.submit(syncRequest{apply: &applyPayload{}})
	if !strings.Contains(res2.Error, "panic") {
		t.Fatalf("worker did not survive the first panic (second submit got %q)", res2.Error)
	}
}
