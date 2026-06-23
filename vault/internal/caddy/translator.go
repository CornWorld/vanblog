package caddy

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/cornworld/vanblog/utils/caddyadmin"
)

// UserRule is the user-facing routing DSL stored in site.routing JSON field.
// It's a simplified, safe subset of Caddy's route configuration.
type UserRule struct {
	// ID is the unique identifier for the rule. Used as Caddy @id for
	// stable route management (add/remove without array position).
	ID string `json:"id"`

	// Type is the route type: proxy, redirect, rewrite, block.
	Type string `json:"type"`

	// From is the URL path pattern to match. Supports glob: /api/*, /static/*
	// Does NOT support regex (intentional, to reduce injection risk).
	From string `json:"from"`

	// To is the target URL (for proxy/redirect) or path (for rewrite).
	// For proxy: must be a full URL like "http://localhost:3000"
	// For redirect: must be a full URL or absolute path
	// For rewrite: must be an absolute path
	To string `json:"to"`

	// Code is the HTTP status code for redirect (default 301).
	Code int `json:"code,omitempty"`

	// Headers are custom HTTP headers to set on the proxy request.
	Headers map[string]string `json:"headers,omitempty"`
}

// ReservedPaths are vanblog's own routes that user rules cannot override.
// User rules matching these paths will be rejected.
var ReservedPaths = []string{
	"/api/*",
	"/static/*",
	"/admin/*",
	"/favicon*",
	"/feed.json",
	"/feed.xml",
	"/sitemap.xml",
	"/atom.xml",
	"/rss/*",
}

// Translate converts a single UserRule to a Caddy route.
func Translate(rule UserRule) (caddyadmin.Route, error) {
	switch strings.ToLower(rule.Type) {
	case "proxy":
		return translateProxy(rule)
	case "redirect":
		return translateRedirect(rule)
	case "rewrite":
		return translateRewrite(rule)
	case "block":
		return translateBlock(rule)
	default:
		return caddyadmin.Route{}, fmt.Errorf("caddy: unknown route type %q (must be proxy/redirect/rewrite/block)", rule.Type)
	}
}

// TranslateAll translates a batch of rules and validates against reserved paths.
func TranslateAll(rules []UserRule, allowlist []string) ([]caddyadmin.Route, error) {
	result := make([]caddyadmin.Route, 0, len(rules))

	for _, rule := range rules {
		// Validate against reserved paths
		if conflictsReserved(rule.From) {
			return nil, fmt.Errorf("caddy: rule %q conflicts with reserved path (vanblog internal routes)", rule.ID)
		}

		// Validate proxy target (SSRF check)
		if strings.ToLower(rule.Type) == "proxy" {
			if err := ValidateTarget(rule.To, allowlist); err != nil {
				return nil, fmt.Errorf("caddy: rule %q: %w", rule.ID, err)
			}
		}

		route, err := Translate(rule)
		if err != nil {
			return nil, fmt.Errorf("caddy: rule %q: %w", rule.ID, err)
		}
		result = append(result, route)
	}

	return result, nil
}

func translateProxy(rule UserRule) (caddyadmin.Route, error) {
	u, err := url.Parse(rule.To)
	if err != nil {
		return caddyadmin.Route{}, fmt.Errorf("invalid proxy target: %w", err)
	}
	dial := u.Host
	if u.Port() == "" {
		if u.Scheme == "https" {
			dial += ":443"
		} else {
			dial += ":80"
		}
	}

	handler := caddyadmin.Handler{
		Handler:   "reverse_proxy",
		Upstreams: []caddyadmin.Upstream{{Dial: dial}},
	}

	// Add custom headers if specified
	if len(rule.Headers) > 0 {
		reqHeaders := &caddyadmin.HeaderOps{Set: make(map[string][]string)}
		for k, v := range rule.Headers {
			reqHeaders.Set[k] = []string{v}
		}
		handler.Headers = &caddyadmin.HeaderPolicy{Request: reqHeaders}
	}

	return caddyadmin.Route{
		ID:    rule.ID,
		Match: []caddyadmin.MatchRule{{Path: []string{rule.From}}},
		Handle: []caddyadmin.Handler{handler},
	}, nil
}

func translateRedirect(rule UserRule) (caddyadmin.Route, error) {
	code := rule.Code
	if code == 0 {
		code = 301
	}
	return caddyadmin.Route{
		ID:    rule.ID,
		Match: []caddyadmin.MatchRule{{Path: []string{rule.From}}},
		Handle: []caddyadmin.Handler{{
			Handler:    "static_response",
			StatusCode: code,
			Headers: &caddyadmin.HeaderPolicy{
				Response: &caddyadmin.HeaderOps{
					Set: map[string][]string{"Location": {rule.To}},
				},
			},
		}},
	}, nil
}

func translateRewrite(rule UserRule) (caddyadmin.Route, error) {
	return caddyadmin.Route{
		ID:    rule.ID,
		Match: []caddyadmin.MatchRule{{Path: []string{rule.From}}},
		Handle: []caddyadmin.Handler{{
			Handler: "rewrite",
			URI:     rule.To,
		}},
	}, nil
}

func translateBlock(rule UserRule) (caddyadmin.Route, error) {
	return caddyadmin.Route{
		ID:    rule.ID,
		Match: []caddyadmin.MatchRule{{Path: []string{rule.From}}},
		Handle: []caddyadmin.Handler{{
			Handler:    "static_response",
			StatusCode: 403,
		}},
	}, nil
}

// conflictsReserved checks if a user path pattern overlaps with reserved paths.
func conflictsReserved(path string) bool {
	for _, reserved := range ReservedPaths {
		if pathMatches(path, reserved) || pathMatches(reserved, path) {
			return true
		}
	}
	return false
}

// pathMatches does a simple glob check: pattern "/api/*" matches path "/api/*".
// Both arguments are glob patterns. We check if one is a prefix of the other.
func pathMatches(pattern, target string) bool {
	// Exact match
	if pattern == target {
		return true
	}
	// Strip wildcard for prefix comparison
	patternPrefix := strings.TrimSuffix(pattern, "/*")
	targetPrefix := strings.TrimSuffix(target, "/*")

	// If pattern is /api/* and target starts with /api/
	if strings.HasSuffix(pattern, "/*") {
		if strings.HasPrefix(target, patternPrefix+"/") || target == patternPrefix {
			return true
		}
	}
	// Exact prefix match (no wildcard)
	if pattern == targetPrefix {
		return true
	}

	return false
}
