package caddy

// bootstrap.go contains the startup wiring that pushes the full Caddy config
// (built from site.routing + system rules) into a running Caddy via its admin
// API.
//
// Flow (Phase 4; see .snow/plan/caddy-single-source.md §4):
//  1. Read site.routing + site.allowedDomains + site.caddyLogLevel from the DB.
//  2. Build a BuildOpts + merged rule list.
//  3. BuildFullConfig → translate + SSRF-validate all rules. Abort on error.
//  4. WaitForCaddy (up to 30s) — entrypoint starts Caddy in parallel.
//  5. ValidateConfig (dry-run) — catch config errors without applying.
//  6. LoadConfig (Phase 1 already adds retry for admin-endpoint restart).
//
// If any step fails we retry the WHOLE pipeline up to 5 times with exponential
// backoff (1s/2s/4s/8s/16s). Rationale: site.routing may be edited by an
// operator *while* pb is booting, and a subsequent attempt can pick up the
// fixed rules and succeed. On total failure we persist the last error to
// site.caddyLastError so the admin UI can surface a clear "why is my site on
// the maintenance page" message, and we return the error to the caller
// (hooks.go) which logs it but does NOT crash pb — the management port
// (:8080) remains reachable so operators can recover.

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/cornworld/vanblog/utils/caddyadmin"
	"github.com/pocketbase/pocketbase/core"
)

// bootstrapBackoffs is the wait before each retry of BootstrapSync. The first
// attempt is immediate (no sleep); on failure we sleep backoffs[0] (1s) before
// attempt #2, backoffs[1] (2s) before attempt #3, etc. The total worst-case
// wall time before giving up is sum(backoffs) = 31s.
var bootstrapBackoffs = []time.Duration{
	1 * time.Second,
	2 * time.Second,
	4 * time.Second,
	8 * time.Second,
	16 * time.Second,
}

// BootstrapSync reads site.routing from the database, translates it to a full
// Caddy config, and atomically loads it via the admin API.
//
// On failure, returns an error describing the last failure. The caller
// (hooks.OnBootstrap) logs it but does not crash pb — the bootstrap/maintenance
// config stays active and the management port (:8080) remains reachable. The
// last error is also persisted to site.caddyLastError so the admin UI can show
// it; the field is cleared on success.
//
// Best-effort fields (Email, LogLevel) are read from env so a fresh install
// with no site record still produces a valid config.
func BootstrapSync(app core.App, caddyAdminURL string) error {
	var lastErr error

	for attempt := 0; attempt <= len(bootstrapBackoffs); attempt++ {
		if attempt > 0 {
			log.Printf("[vanblog] caddy bootstrap: retry %d/%d after %v",
				attempt, len(bootstrapBackoffs), bootstrapBackoffs[attempt-1])
			time.Sleep(bootstrapBackoffs[attempt-1])
		}

		// Re-read site data each attempt: an operator may have edited
		// site.routing during the backoff window and the next attempt
		// should pick up the fix.
		opts, userRules := loadBootstrapInputs(app)
		opts.Defaults()

		cfg, err := BuildFullConfig(opts, userRules)
		if err != nil {
			lastErr = fmt.Errorf("build config: %w", err)
			continue
		}

		configJSON, err := cfg.JSON()
		if err != nil {
			lastErr = fmt.Errorf("marshal config: %w", err)
			continue
		}

		client := caddyadmin.NewClient(caddyAdminURL)

		if err := WaitForCaddy(caddyAdminURL, 30*time.Second); err != nil {
			lastErr = fmt.Errorf("admin API not reachable: %w", err)
			continue
		}

		if err := client.ValidateConfig(configJSON); err != nil {
			lastErr = fmt.Errorf("config validation failed: %w", err)
			// A validation error is usually a semantic config problem
			// (bad user rule) — retrying immediately won't help, but a
			// human edit during the backoff window might. So we still
			// loop instead of hard-failing.
			continue
		}

		if err := client.LoadConfig(configJSON); err != nil {
			lastErr = fmt.Errorf("LoadConfig failed: %w", err)
			continue
		}

		// Success: clear any stale error and log route count.
		totalRoutes := 0
		if cfg.Apps != nil && cfg.Apps.HTTP != nil && cfg.Apps.HTTP.Servers != nil {
			for _, srv := range cfg.Apps.HTTP.Servers {
				totalRoutes += len(srv.Routes)
			}
		}
		log.Printf("[vanblog] caddy bootstrap: full config loaded (%d routes across all servers, attempt %d)",
			totalRoutes, attempt+1)

		if err := setCaddyLastError(app, ""); err != nil {
			// Non-fatal: the config was applied; failing to clear the
			// status field only means the UI may briefly show a stale
			// error.
			log.Printf("[vanblog] caddy bootstrap: warning: failed to clear caddyLastError: %v", err)
		}
		return nil
	}

	// All retries exhausted. Persist the failure reason so the admin UI
	// can display it.
	persistedErr := fmt.Errorf("caddy bootstrap failed after %d retries: %w",
		len(bootstrapBackoffs), lastErr)
	if err := setCaddyLastError(app, lastErr.Error()); err != nil {
		log.Printf("[vanblog] caddy bootstrap: warning: failed to persist caddyLastError: %v", err)
	}
	log.Printf("[vanblog] caddy bootstrap FAILED: %v", persistedErr)
	return persistedErr
}

// loadBootstrapInputs reads site.routing + site.allowedDomains and assembles
// the BuildOpts + user rules for BootstrapSync. Any DB error is treated as
// "fresh install" and yields empty values — a valid config can still be built
// from system defaults.
func loadBootstrapInputs(app core.App) (BuildOpts, []UserRule) {
	opts := BuildOpts{}
	var userRules []UserRule

	// VANBLOG_EMAIL is the Let's Encrypt registration email. It's the same
	// env used by docker/entrypoint.{prod,dev}.sh, so both sides stay in
	// sync without a DB field. Defaults() leaves it empty if unset, and
	// BuildFullConfig tolerates empty email (Caddy falls back to its own
	// default at TLS issuance time, with a startup warning).
	opts.Email = os.Getenv("VANBLOG_EMAIL")

	// VANBLOG_HTTP_ONLY=1 disables the embedded TLS stack: Caddy keeps
	// running as the routing layer but listens only on :80, with no
	// apps.tls subtree. Operators are expected to terminate TLS at an
	// external reverse proxy (Traefik / NPM / Cloudflare Tunnel / etc.)
	// and forward plain HTTP to this container.
	opts.HTTPOnly = os.Getenv("VANBLOG_HTTP_ONLY") == "1" ||
		os.Getenv("VANBLOG_HTTP_ONLY") == "true"

	site, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || site == nil {
		// Fresh install: no site record yet. System rules still apply.
		return opts, nil
	}

	opts.AllowedDomains = site.GetStringSlice("allowedDomains")

	// site.caddyLogLevel is optional. Defaults() will fill in WARN/INFO
	// when this is empty. We DO NOT uppercase here — Defaults() does that.
	if ll := site.GetString("caddyLogLevel"); ll != "" {
		opts.LogLevel = ll
	}

	if routingStr := site.GetString("routing"); routingStr != "" && routingStr != "[]" {
		if err := json.Unmarshal([]byte(routingStr), &userRules); err != nil {
			// Keep going with empty user rules — the system + fallback
			// routes still produce a working site, just without the user's
			// custom routes. Log so the operator notices.
			log.Printf("[vanblog] site.routing parse failed (continuing with system routes only): %v", err)
			userRules = nil
		}
	}

	return opts, userRules
}

// setCaddyLastError writes (or clears, if msg=="") the last bootstrap error
// onto the single site row. Silently ignores "no site record yet" — fresh
// installs have nowhere to persist and that's fine.
func setCaddyLastError(app core.App, msg string) error {
	site, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || site == nil {
		return nil
	}
	site.Set("caddyLastError", msg)
	return app.Save(site)
}

