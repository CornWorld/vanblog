package caddy

import (
	"fmt"
	"time"

	"github.com/cornworld/vanblog/utils/caddyadmin"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// TLSStatus represents the current TLS configuration and certificate state.
// Returned by /api/vanblog/tls/status for the admin UI to display.
type TLSStatus struct {
	// CaddyReachable indicates whether the Caddy admin API is responding.
	CaddyReachable bool `json:"caddyReachable"`

	// AllowedDomains is the current site.allowedDomains whitelist.
	// Empty means "allow all" during setup, "deny all" post-setup.
	AllowedDomains []string `json:"allowedDomains"`

	// AllowAll is true when the ask endpoint will allow any domain.
	// This is true only during the setup window (no superuser yet).
	// Post-setup with empty AllowedDomains, AllowAll is false (deny all).
	AllowAll bool `json:"allowAll"`

	// SetupComplete is true when at least one superuser exists.
	// When false, the system is in setup mode and allows all domains.
	SetupComplete bool `json:"setupComplete"`

	// Certificates lists domains for which Caddy has obtained TLS certificates.
	// Each entry has the domain and whether it's in the allowedDomains whitelist.
	Certificates []CertInfo `json:"certificates"`

	// HttpsRedirect is true when HTTP→HTTPS redirect is active.
	HttpsRedirect bool `json:"httpsRedirect"`

	// OnDemandTLS is always true in our setup (we use on-demand TLS exclusively).
	OnDemandTLS bool `json:"onDemandTLS"`

	// ManagementPort is the HTTP fallback port (always 8080 in our config).
	ManagementPort int `json:"managementPort"`

	// BootstrapMode is true when Caddy is still running the minimal bootstrap
	// config (maintenance 503 page) instead of the full vanblog routing.
	// This happens during startup or when BootstrapSync has failed. The UI
	// should display a warning banner so operators know the site is degraded.
	BootstrapMode bool `json:"bootstrapMode"`

	// BootstrapError is the last bootstrap error message from site.caddyLastError,
	// if any. Empty when bootstrap succeeded or hasn't run yet. Only meaningful
	// when BootstrapMode is true (though it may be non-empty briefly after a
	// successful recovery, until the next refresh).
	BootstrapError string `json:"bootstrapError,omitempty"`
}

// CertInfo describes a single TLS certificate known to Caddy.
type CertInfo struct {
	Domain  string `json:"domain"`
	Allowed bool   `json:"allowed"`
}

// GetTLSStatus queries Caddy admin API + site config to produce a TLS status snapshot.
func GetTLSStatus(app core.App, caddyAdminURL string) (*TLSStatus, error) {
	status := &TLSStatus{
		OnDemandTLS:    true,
		HttpsRedirect:  true, // fixed in Caddyfile
		ManagementPort: 8080,
	}

	// 1. Read site config
	site, err := app.FindFirstRecordByFilter("site", "")
	if err == nil && site != nil {
		status.AllowedDomains = site.GetStringSlice("allowedDomains")
		status.HttpsRedirect = site.GetBool("httpsRedirect")
		// Surface the last bootstrap failure (if any) so the UI can show
		// *why* the site is on the maintenance page. Cleared by
		// BootstrapSync on success.
		status.BootstrapError = site.GetString("caddyLastError")
	}

	// 2. Check setup state — AllowAll is only true during setup window
	// (no real superuser yet). PocketBase's pbinstall auto-creates a
	// `__pbinstaller@example.com` placeholder superuser that's auto-deleted
	// once a real superuser registers, so we must exclude it from the count.
	// On query error, fail closed (assume setup is complete) for security.
	hasAdmin, err := app.FindRecordsByFilter(
		"_superusers",
		"email != {:installer}",
		"", 1, 0,
		dbx.Params{"installer": core.DefaultInstallerEmail},
	)
	if err != nil {
		status.SetupComplete = true
	} else {
		status.SetupComplete = len(hasAdmin) > 0
	}
	status.AllowAll = !status.SetupComplete

	// 2. Query Caddy admin API
	client := caddyadmin.NewClient(caddyAdminURL)

	// Check if Caddy is reachable
	_, err = client.GetConfig()
	if err != nil {
		// Caddy not reachable — return partial status
		status.CaddyReachable = false
		return status, nil
	}
	status.CaddyReachable = true

	// Detect "still in bootstrap/maintenance mode": look for the
	// vanblog-bootstrap-maintenance route (the 503 page) on the HTTPS
	// server. Both docker/bootstrap.json (static) and BuildBootstrapConfig
	// (Go-generated) emit this exact @id, so the detection works regardless
	// of which path produced the running config. We check the HTTPS server
	// name used by both emitters (srv_https); querying a missing server
	// returns an error which we simply ignore.
	if routes, rErr := client.GetRoutes("srv_https"); rErr == nil {
		for _, r := range routes {
			if r.ID == "vanblog-bootstrap-maintenance" {
				status.BootstrapMode = true
				break
			}
		}
	}

	// 3. Get automated certificate domains
	// These are domains Caddy has successfully obtained certificates for.
	automated, err := client.GetAutocertDomains()
	if err != nil {
		// Non-fatal: return what we have
		return status, nil
	}

	// 4. Build cert info with allowed status
	allowedSet := make(map[string]bool, len(status.AllowedDomains))
	for _, d := range status.AllowedDomains {
		allowedSet[d] = true
	}

	for _, domain := range automated {
		status.Certificates = append(status.Certificates, CertInfo{
			Domain:  domain,
			Allowed: status.AllowAll || allowedSet[domain],
		})
	}

	return status, nil
}

// CheckCaddyHealth does a simple liveness check on the Caddy admin API.
// Returns nil if Caddy is healthy, error otherwise.
func CheckCaddyHealth(caddyAdminURL string) error {
	client := caddyadmin.NewClient(caddyAdminURL)
	_, err := client.GetConfig()
	return err
}

// WaitForCaddy polls the Caddy admin API until it responds or timeout.
// Used during bootstrap to avoid race conditions.
func WaitForCaddy(caddyAdminURL string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	client := caddyadmin.NewClient(caddyAdminURL)

	for time.Now().Before(deadline) {
		if _, err := client.GetConfig(); err == nil {
			return nil
		}
		time.Sleep(500 * time.Millisecond)
	}

	return fmt.Errorf("caddy admin API not reachable after %v", timeout)
}
