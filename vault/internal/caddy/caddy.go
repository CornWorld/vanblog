// Package caddy wires vanblog's routing rules into the embedded Caddy server
// via its admin API, and exposes the HTTP endpoints Caddy calls back into
// (on-demand TLS ask, TLS status for the admin UI).
package caddy

import (
	"log"
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
// ask endpoint, the TLS status endpoint, and the startup config push.
type Service struct {
	app           core.App
	caddyAdminURL string
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
	s := &Service{app: app, caddyAdminURL: caddyAdminURL}
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/hooks/caddy/ask", s.handleAskEndpoint)
		se.Router.GET("/api/vanblog/tls/status", s.handleTLSStatusEndpoint)

		if os.Getenv("VANBLOG_SKIP_CADDY_SYNC") == "1" {
			log.Printf("[caddy] VANBLOG_SKIP_CADDY_SYNC=1: skipping config push (dev/smoke mode)")
		} else if err := s.pushConfigToAdminAPI(); err != nil {
			log.Printf("[caddy] config push failed, staying in maintenance mode: %v", err)
		}
		return se.Next()
	})
	return s
}

// pushConfigToAdminAPI is the startup wiring: read site.routing from DB,
// translate to Caddy JSON, validate, then load atomically via admin API.
// Retries with exponential backoff to tolerate brief Caddy restarts.
//
// Failure does NOT crash pb — the bootstrap maintenance config stays active
// and the management port (:8080) remains reachable so operators can recover.
// The last error is persisted to site.caddyLastError for the admin UI.
func (s *Service) pushConfigToAdminAPI() error {
	return BootstrapSync(s.app, s.caddyAdminURL)
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
