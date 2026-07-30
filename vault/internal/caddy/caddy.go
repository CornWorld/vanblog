// Package caddy wires vanblog's routing rules into the embedded Caddy server
// via its admin API, and exposes the HTTP endpoints Caddy calls back into
// (on-demand TLS ask, TLS status for the admin UI).
package caddy

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"github.com/cornworld/vanblog/internal/site"
)

// DefaultCaddyAdminURL is the in-process Caddy admin API address. Caddy
// listens here by default; vanblog's entrypoint starts Caddy in parallel
// with pb so the admin API is reachable by the time pb's OnServe fires.
const DefaultCaddyAdminURL = "http://127.0.0.1:2019"

// Service owns the caddy-related pb hook subscriptions: the on-demand TLS
// ask endpoint, the TLS status endpoint, the startup config push, and the
// syncWorker actor that serializes all runtime routing mutations.
type Service struct {
	app           core.App
	caddyAdminURL string

	// syncCh serializes every runtime site.routing mutation (applyRules,
	// handleApply). The syncWorker goroutine reads one request at a time,
	// so concurrent admin requests can't race on the DB-or-Caddy state.
	// Unbuffered: senders block until the worker is ready, guaranteeing
	// no request piles up silently.
	syncCh chan syncRequest

	// done closes the worker goroutine. nil for tests that construct a
	// Service without calling NewWithURL (and thus never spawn a worker).
	done chan struct{}
}

// syncRequest is the envelope the actor accepts. Exactly one of apply/resync
// is set; reply carries the outcome back to the caller's goroutine.
type syncRequest struct {
	apply     *applyPayload // non-nil for "replace + push" semantics
	resync    bool          // true for "push whatever is in DB now"
	replyChan chan replaceResult
}

type applyPayload struct {
	rules     []UserRule
	allowlist []string
}

// New creates a caddy Service and registers its pb hook subscriptions.
//
// OnServe wires:
//   - Two HTTP routes (caddy ask + TLS status for the admin UI).
//   - pushConfigToAdminAPI: translate site.routing → full Caddy config,
//     load via admin API. Skipped in dev/smoke mode
//     (VANBLOG_SKIP_CADDY_SYNC=1) where no Caddy runs.
func New(app core.App) *Service {
	return NewWithURL(app, DefaultCaddyAdminURL)
}

// NewWithURL is the testable variant — tests inject a mock admin URL.
func NewWithURL(app core.App, caddyAdminURL string) *Service {
	s := &Service{
		app:           app,
		caddyAdminURL: caddyAdminURL,
		syncCh:        make(chan syncRequest),
		done:          make(chan struct{}),
	}
	go s.runSyncWorker()

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/hooks/caddy/ask", s.handleAskEndpoint)
		se.Router.GET("/api/vanblog/tls/status", s.handleTLSStatusEndpoint)
		s.registerAdminRoutes(se)

		if os.Getenv("VANBLOG_SKIP_CADDY_SYNC") == "1" {
			slog.Info("[caddy] VANBLOG_SKIP_CADDY_SYNC=1: skipping config push (dev/smoke mode)")
		} else {
			// Push config async — don't block OnServe while Caddy may be
			// starting up. Retries with backoff in the background goroutine.
			go func() {
				if err := s.pushConfigToAdminAPI(); err != nil {
					slog.Error("[caddy] config push failed, staying in maintenance mode", "err", err)
				}
			}()
		}
		return se.Next()
	})
	return s
}

// Close terminates the syncWorker goroutine. pb's lifecycle doesn't need
// this (process exit kills the goroutine), but tests must call it to avoid
// leaking one goroutine per test case.
func (s *Service) Close() {
	if s.done != nil {
		close(s.done)
	}
}

// runSyncWorker is the single writer. Every site.routing mutation flows
// through here, so even if two admin requests arrive concurrently — say,
// the user hits "save" while a previous save's BootstrapSync is still
// retrying — they execute strictly in arrival order. No locks needed
// because there's only one writer.
func (s *Service) runSyncWorker() {
	for {
		select {
		case <-s.done:
			return
		case req := <-s.syncCh:
			var res replaceResult
			switch {
			case req.apply != nil:
				res = s.applyRules(req.apply.rules, req.apply.allowlist)
			case req.resync:
				res = s.resyncFromDB()
			default:
				// Defensive — shouldn't happen; callers must set one.
				res = replaceResult{Error: "internal: empty sync request"}
			}
			// replyChan is buffered(1) so a slow / panicked caller can't
			// block the worker. Send is non-blocking; we already know the
			// buffer fits.
			select {
			case req.replyChan <- res:
			default:
				slog.Warn("[caddy] syncWorker: reply dropped (caller gone?)")
			}
		}
	}
}

// submit sends a request to the worker and waits for the result. Used by
// HTTP handlers; they're synchronous from the user's perspective (the UI
// wants to know "did it work?" not "we queued it").
func (s *Service) submit(req syncRequest) replaceResult {
	req.replyChan = make(chan replaceResult, 1)
	s.syncCh <- req
	return <-req.replyChan
}

// resyncFromDB pushes the current site.routing to Caddy. Used by the
// /apply endpoint. Unlike applyRules, it never writes the DB — it's the
// "make Caddy match what's in the DB right now" primitive.
func (s *Service) resyncFromDB() replaceResult {
	if err := BootstrapSyncFromDB(s.app, s.caddyAdminURL); err != nil {
		return replaceResult{Error: err.Error()}
	}
	return replaceResult{OK: true, Applied: true}
}

// pushConfigToAdminAPI is the startup wiring: read site.routing from DB,
// translate to Caddy JSON, validate, then load atomically via admin API.
// Retries with exponential backoff to tolerate brief Caddy restarts.
//
// Failure does NOT crash pb — the bootstrap maintenance config stays active
// and the management port (:8080) remains reachable so operators can recover.
// The last error is persisted to site.caddyLastError for the admin UI.
func (s *Service) pushConfigToAdminAPI() error {
	return BootstrapSyncFromDB(s.app, s.caddyAdminURL)
}

// handleAskEndpoint answers Caddy's on-demand TLS question: "may I issue
// a certificate for <domain>?". Decision logic:
//   - Can't read site config + no superuser yet → allow all (setup window)
//   - Can't read site config + superuser exists  → deny (fail closed)
//   - Otherwise → strict allowlist from site.allowedDomains
func (s *Service) handleAskEndpoint(e *core.RequestEvent) error {
	domain := e.Request.URL.Query().Get("domain")
	info, err := site.GetInfo(s.app)
	if err != nil {
		hasAdmin, qErr := hasSuperuser(s.app)
		if qErr != nil {
			return e.JSON(http.StatusForbidden, map[string]bool{"allowed": false})
		}
		if !hasAdmin {
			return e.JSON(http.StatusOK, map[string]bool{"allowed": true})
		}
		return e.JSON(http.StatusForbidden, map[string]bool{"allowed": false})
	}
	hasAdmin, _ := hasSuperuser(s.app)
	return e.JSON(http.StatusOK, map[string]bool{"allowed": AskHandler(info.AllowedDomains, domain, hasAdmin)})
}

func (s *Service) handleTLSStatusEndpoint(e *core.RequestEvent) error {
	status, err := GetTLSStatus(s.app, s.caddyAdminURL)
	if err != nil {
		return e.JSON(http.StatusInternalServerError, err.Error())
	}
	return e.JSON(http.StatusOK, status)
}

// hasSuperuser reports whether at least one real superuser/admin exists.
// PocketBase's pbinstall auto-creates a `__pbinstaller@example.com`
// placeholder that's deleted once a real superuser registers, so we
// exclude it. Used by the TLS ask endpoint to distinguish setup window
// (no admin yet → allow all domains) from post-setup (strict allowlist).
func hasSuperuser(app core.App) (bool, error) {
	records, err := app.FindRecordsByFilter(
		"_superusers",
		"email != {:installer}",
		"", 1, 0,
		dbx.Params{"installer": core.DefaultInstallerEmail},
	)
	if err != nil {
		return false, err
	}
	return len(records) > 0, nil
}
