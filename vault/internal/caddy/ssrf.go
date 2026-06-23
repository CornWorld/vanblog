package caddy

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

// DefaultAllowlist is the set of IPs/ranges that are always allowed
// as proxy targets. These cover loopback, private networks, and
// link-local addresses commonly used in container/Docker setups.
var DefaultAllowlist = []string{
	"127.0.0.0/8",   // IPv4 loopback
	"10.0.0.0/8",    // Private network Class A
	"172.16.0.0/12", // Private network Class B (Docker bridge)
	"192.168.0.0/16", // Private network Class C
	"::1/128",       // IPv6 loopback
	"fc00::/7",      // IPv6 unique local
	"fe80::/10",     // IPv6 link-local
}

// blockedIPs are specific IPs that must NEVER be allowed as proxy targets,
// regardless of the allowlist. These are cloud metadata endpoints and
// other SSRF targets.
var blockedIPs = []string{
	"169.254.169.254", // AWS/GCP/Azure metadata
	"metadata.google.internal", // GCP metadata (DNS)
	"metadata", // Azure metadata (short name)
	"fd00:ec2::254", // AWS IPv6 metadata
}

// ValidateTarget checks if a URL is safe to use as a Caddy reverse_proxy target.
//
// Rules:
//  1. Must be a valid URL with http/https scheme
//  2. Host must not be a blocked IP (cloud metadata)
//  3. If host is an IP, must be in the allowlist (private range)
//  4. If host is a hostname, must be in the extraAllowlist or a known suffix
//
// This prevents SSRF attacks where a user configures a proxy target
// pointing to cloud metadata endpoints or internal services.
func ValidateTarget(rawURL string, extraAllowlist []string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("caddy: invalid URL %q: %w", rawURL, err)
	}

	scheme := strings.ToLower(u.Scheme)
	if scheme != "http" && scheme != "https" {
		return fmt.Errorf("caddy: scheme must be http or https, got %q", scheme)
	}

	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("caddy: empty hostname in URL %q", rawURL)
	}

	hostLower := strings.ToLower(host)

	// Check blocked IPs/metadata endpoints
	for _, blocked := range blockedIPs {
		if hostLower == strings.ToLower(blocked) {
			return fmt.Errorf("caddy: target %q is blocked (cloud metadata or SSRF risk)", host)
		}
	}

	// Check if host is an IP address
	ip := net.ParseIP(host)
	if ip != nil {
		// It's an IP — must be in allowlist
		if !ipInAllowlist(ip, DefaultAllowlist) {
			return fmt.Errorf("caddy: IP %q is not in the private network allowlist", ip)
		}
		return nil
	}

	// It's a hostname — check extraAllowlist
	// Allow common local hostnames
	if hostLower == "localhost" {
		return nil
	}

	// Check Docker service names (*.docker, *.svc.cluster.local, etc.)
	if strings.HasSuffix(hostLower, ".docker") ||
		strings.HasSuffix(hostLower, ".svc.cluster.local") ||
		strings.HasSuffix(hostLower, ".orb.local") {
		return nil
	}

	// Check user-provided allowlist
	for _, allowed := range extraAllowlist {
		if matchHost(hostLower, strings.ToLower(allowed)) {
			return nil
		}
	}

	return fmt.Errorf("caddy: hostname %q is not in the allowlist (add to site.routing.allowlist if trusted)", host)
}

// ipInAllowlist checks if an IP falls within any CIDR in the allowlist.
func ipInAllowlist(ip net.IP, allowlist []string) bool {
	for _, cidr := range allowlist {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			continue
		}
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

// matchHost checks if a hostname matches an allowlist entry.
// Supports exact match and wildcard suffix (*.example.com).
func matchHost(host, pattern string) bool {
	if host == pattern {
		return true
	}
	if strings.HasPrefix(pattern, "*.") {
		suffix := pattern[1:] // ".example.com"
		return strings.HasSuffix(host, suffix)
	}
	return false
}
