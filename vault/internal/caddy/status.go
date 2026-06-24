package caddy

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/cornworld/vanblog/utils/caddyadmin"
	"github.com/pocketbase/pocketbase/core"
)

// TLSStatus represents the current TLS configuration and certificate state.
// Returned by /api/vanblog/tls/status for the admin UI to display.
type TLSStatus struct {
	// CaddyReachable indicates whether the Caddy admin API is responding.
	CaddyReachable bool `json:"caddyReachable"`

	// AllowedDomains is the current site.allowedDomains whitelist.
	// Empty means "allow all" (on-demand TLS will issue for any domain).
	AllowedDomains []string `json:"allowedDomains"`

	// AllowAll is true when AllowedDomains is empty (the default behavior).
	AllowAll bool `json:"allowAll"`

	// Certificates lists domains for which Caddy has obtained TLS certificates.
	// Each entry has the domain and whether it's in the allowedDomains whitelist.
	Certificates []CertInfo `json:"certificates"`

	// HttpsRedirect is true when HTTP→HTTPS redirect is active.
	HttpsRedirect bool `json:"httpsRedirect"`

	// OnDemandTLS is always true in our setup (we use on-demand TLS exclusively).
	OnDemandTLS bool `json:"onDemandTLS"`

	// ManagementPort is the HTTP fallback port (always 8080 in our config).
	ManagementPort int `json:"managementPort"`
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
		status.AllowAll = len(status.AllowedDomains) == 0
		status.HttpsRedirect = site.GetBool("httpsRedirect")
	}

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

// formatJSON is a helper for pretty-printing status in debug logs.
func formatJSON(v interface{}) string {
	b, _ := json.MarshalIndent(v, "", "  ")
	return string(b)
}

// QueryCaddyCertificates is a lower-level helper that returns raw certificate
// data from Caddy. Exposed for potential debugging endpoints.
func QueryCaddyCertificates(caddyAdminURL string) ([]string, error) {
	client := caddyadmin.NewClient(caddyAdminURL)
	return client.GetAutocertDomains()
}

// ReachableHosts returns the list of domains that Caddy is actively serving.
// This queries the Caddy admin API for configured server addresses + TLS subjects.
func ReachableHosts(caddyAdminURL string) ([]string, error) {
	client := caddyadmin.NewClient(caddyAdminURL)
	return client.GetTLSSubjects()
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

// Ensure unused vars don't trigger lint errors in minimal builds
var (
	_ = http.StatusOK
	_ = formatJSON
)
