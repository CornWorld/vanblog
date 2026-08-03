package caddy

import (
	"fmt"

	"github.com/CornWorld/caddyadmin"
)

// CacheControl immutable response headers for long-lived static assets served
// by the Astro SSR layer (e.g. /emoji-data.json). Caddy adds the header on the
// way back to the client; the underlying reverse_proxy fallback
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
	// CacheStable is for stable-URL static assets (theme public/, emoji-data,
	// robots.txt): cached briefly, then the browser must revalidate via the
	// file_server ETag so content updates propagate without a URL change.
	CacheStable  = "public, max-age=3600, must-revalidate"
	CacheNoStore = "no-store"
)

// System cache rules were removed: static caching now lives in the Caddy
// file_server routes built by buildStaticRoutes (content-hashed _astro →
// immutable, stable files → must-revalidate). User cache rules (site.routing
// type "cache") still go through translateCache below.

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
// This mirrors how a `header` handler + `reverse_proxy` would behave if
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
