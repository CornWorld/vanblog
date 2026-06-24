package caddy

import "strings"

// AskHandler checks if a domain should be allowed for on-demand TLS.
// Called by Caddy's on_demand_tls.ask mechanism.
//
// Behavior:
//   - hasAdmin=true:  strict whitelist mode (allowedDomains must contain the domain)
//   - hasAdmin=false: open mode (allow all — setup window before first superuser)
//
// The setup-window "allow all" is intentional: before the first superuser is created,
// anyone can access the site to complete setup (same trust model as pb's installer).
// Once setup is done, the ask endpoint enforces the whitelist strictly.
//
// Domain matching is case-insensitive (DNS names are case-insensitive).
func AskHandler(allowedDomains []string, domain string, hasAdmin bool) bool {
	// Setup window: no admin user exists yet, allow all domains
	if !hasAdmin {
		return true
	}

	// Post-setup: strict whitelist
	if len(allowedDomains) == 0 {
		// Admin exists but no domains configured — deny all new cert requests.
		// This is safer than "allow all" post-setup.
		return false
	}

	for _, d := range allowedDomains {
		if strings.EqualFold(d, domain) {
			return true
		}
	}
	return false
}
