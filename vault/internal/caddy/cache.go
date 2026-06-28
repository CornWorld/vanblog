package caddy

import (
	"fmt"

	"github.com/cornworld/vanblog/utils/caddyadmin"
)

// CacheControl immutable response headers for long-lived static assets served
// by the Astro SSR layer (e.g. /emoji-data.json). Caddy adds the header on the
// way back to the client; the underlying reverse_proxy fallback in Caddyfile
// still serves the bytes.
//
// `headers` handler in Caddy is non-terminal: after setting the response
// header, route evaluation continues to the next route (the file_server /
// reverse_proxy fallback). This lets us layer cache semantics on top of
// existing routes without rewriting them.
const (
	CacheImmutable = "public, max-age=31536000, immutable"
	CacheDay       = "public, max-age=86400"
	CacheHour      = "public, max-age=3600"
	CacheNoStore   = "no-store"
)

// SystemCacheRules are vanblog's built-in cache rules, applied at bootstrap so
// users get sensible caching out of the box. Users can override these via
// site.routing using the same DSL (the user-provided rules are pushed after
// these, so they take precedence via Caddy's first-match-wins semantics if
// paths overlap — but more importantly, user rules with the same ID replace
// the system ones via @id semantics).
func SystemCacheRules() []UserRule {
	return []UserRule{
		{
			ID:      "vanblog-emoji-cache",
			Type:    "cache",
			From:    "/emoji-data.json",
			Headers: map[string]string{"Cache-Control": CacheImmutable},
		},
	}
}

// translateCache produces a reverse_proxy route to the Astro SSR server with
// response header overrides applied at proxy time (header_down semantics).
//
// Why reverse_proxy and not a non-terminal `headers` handler:
// Caddy's `headers` handler sets response headers BEFORE reverse_proxy runs,
// but reverse_proxy then copies upstream headers (including Astro's default
// `Cache-Control: public, max-age=0`) on top, overwriting our setting.
// Using reverse_proxy with our own HeaderPolicy.Response lets us apply the
// cache header at proxy response time, which correctly replaces Astro's.
//
// This mirrors how Caddyfile `header` + `reverse_proxy` would behave if
// we wrapped them in a single `handle` block.
func translateCache(rule UserRule) (caddyadmin.Route, error) {
	if len(rule.Headers) == 0 {
		return caddyadmin.Route{}, fmt.Errorf("caddy: cache rule %q must set at least one header (e.g. Cache-Control)", rule.ID)
	}

	respSet := make(map[string][]string, len(rule.Headers))
	for k, v := range rule.Headers {
		respSet[k] = []string{v}
	}

	return caddyadmin.Route{
		ID:    rule.ID,
		Match: []caddyadmin.MatchRule{{Path: []string{rule.From}}},
		Handle: []caddyadmin.Handler{{
			Handler:   "reverse_proxy",
			Upstreams: []caddyadmin.Upstream{{Dial: "127.0.0.1:4321"}},
			Headers: &caddyadmin.HeaderPolicy{
				Response: &caddyadmin.HeaderOps{Set: respSet},
			},
		}},
	}, nil
}
