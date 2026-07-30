package caddy

// bootstrap.go contains the startup wiring that pushes the full Caddy config
// (built from site.routing + system rules) into a running Caddy via its admin
// API. The 6-step pipeline and retry policy are documented in
// docs/architecture-layering.md §4.4 (Caddy Manager).

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/CornWorld/caddyadmin"
	"github.com/pocketbase/pocketbase/core"
)

// bootstrapBackoffs is the wait before each retry of BootstrapSync. The first
// attempt is immediate (no sleep); on failure we sleep backoffs[0] (500ms)
// before attempt #2, backoffs[1] (1s) before attempt #3. Caddy starts in
// milliseconds, so a long retry window is unnecessary — total worst-case wall
// time is ~sum(backoffs) + 3×WaitForCaddy timeout ≈ 16.5s.
var bootstrapBackoffs = []time.Duration{
	500 * time.Millisecond,
	1 * time.Second,
}

// BootstrapSync pushes a specific rule set into running Caddy via the admin
// API. The caller supplies the rules + opts snapshot — this function does
// NOT re-read the database during retries. That's deliberate: the actor
// (syncWorker) passes the exact rules it just persisted, so a concurrent
// routing edit during the retry backoff window can't poison the push with
// a half-mixed rule set.
//
// On failure, returns an error describing the last failure. The caller
// logs it but pb stays up — the bootstrap/maintenance config stays active
// and the management port (:8080) remains reachable. The last error is
// also persisted to site.caddyLastError so the admin UI can show it; the
// field is cleared on success.
func BootstrapSync(app core.App, caddyAdminURL string, opts BuildOpts, userRules []UserRule) error {
	var lastErr error

	for attempt := 0; attempt <= len(bootstrapBackoffs); attempt++ {
		if attempt > 0 {
			log.Printf("[caddy] bootstrap: retry %d/%d after %v",
				attempt, len(bootstrapBackoffs), bootstrapBackoffs[attempt-1])
			time.Sleep(bootstrapBackoffs[attempt-1])
		}

		// Apply defaults fresh on every retry — opts fields like Email /
		// LogLevel may be empty on first call, and Defaults normalizes
		// them. opts itself is value-typed, so re-Defaulting is safe.
		o := opts
		o.Defaults()

		cfg, err := BuildFullConfig(o, userRules)
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

		if err := WaitForCaddy(caddyAdminURL, 5*time.Second); err != nil {
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
		log.Printf("[caddy] bootstrap: full config loaded (%d routes across all servers, attempt %d)",
			totalRoutes, attempt+1)

		if err := setCaddyLastError(app, ""); err != nil {
			// Non-fatal: the config was applied; failing to clear the
			// status field only means the UI may briefly show a stale
			// error.
			log.Printf("[caddy] bootstrap: warning: failed to clear caddyLastError: %v", err)
		}
		return nil
	}

	// All retries exhausted. Persist the failure reason so the admin UI
	// can display it.
	persistedErr := fmt.Errorf("caddy bootstrap failed after %d retries: %w",
		len(bootstrapBackoffs), lastErr)
	if err := setCaddyLastError(app, lastErr.Error()); err != nil {
		log.Printf("[caddy] bootstrap: warning: failed to persist caddyLastError: %v", err)
	}
	log.Printf("[caddy] bootstrap FAILED: %v", persistedErr)
	return persistedErr
}

// BootstrapSyncFromDB reads site.routing + site.allowedDomains from the
// database, then calls BootstrapSync. Used by the startup path where there's
// no actor yet and the caller genuinely wants "the current DB state applied
// to Caddy". Runtime admin paths (applyRules / handleApply) must NOT use
// this — they go through the syncWorker actor with a rules snapshot.
func BootstrapSyncFromDB(app core.App, caddyAdminURL string) error {
	opts, userRules := loadBootstrapInputs(app)
	return BootstrapSync(app, caddyAdminURL, opts, userRules)
}

// loadBootstrapInputs reads site.routing + site.allowedDomains and assembles
// the BuildOpts + user rules. Any DB error is treated as "fresh install"
// and yields empty values — a valid config can still be built from system
// defaults.
func loadBootstrapInputs(app core.App) (BuildOpts, []UserRule) {
	opts := BuildOpts{}
	var userRules []UserRule

	// VANBLOG_BUILD_VERSION is injected at Docker build time (git commit +
	// timestamp). It becomes a weak ETag on system cache rules, so re-deploying
	// a new image invalidates browser caches for URLs whose content hash is
	// the same as the previous build.
	if v := os.Getenv("VANBLOG_BUILD_VERSION"); v != "" {
		opts.Version = v
	} else if data, err := os.ReadFile("/etc/vanblog/build-version"); err == nil {
		opts.Version = string(data)
	}

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
			log.Printf("[caddy] site.routing parse failed (continuing with system routes only): %v", err)
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

