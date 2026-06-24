package caddy

// AskHandler checks if a domain should be allowed for on-demand TLS.
// Called by Caddy's on_demand_tls.ask mechanism.
//
// Returns true if the domain is allowed, false otherwise.
// An empty allowedDomains list means "allow all" (original Vanblog behavior).
func AskHandler(allowedDomains []string, domain string) bool {
	if len(allowedDomains) == 0 {
		return true
	}
	for _, d := range allowedDomains {
		if d == domain {
			return true
		}
	}
	return false
}
