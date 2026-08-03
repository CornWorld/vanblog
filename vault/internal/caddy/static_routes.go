package caddy

import (
	"os"
	"path/filepath"

	"github.com/CornWorld/caddyadmin"
)

// buildStaticRoutes returns the system-owned Caddy file_server routes that serve
// built static assets directly from disk, taking the dispatcher out of the
// static path entirely.
//
// Two cache tiers (the only two that make sense for Astro outputs):
//   - `_astro/*` (content-hashed filenames): URL changes whenever content
//     changes → `Cache-Control: public, max-age=31536000, immutable`.
//   - every other stable URL (theme public/ files, /emoji-data.json,
//     /robots.txt): content can change without a URL change → must-revalidate
//     so the browser revalidates via file_server's own ETag (size+mtime).
//
// Routes are only emitted when the corresponding dist/client dir exists, so
// environments without a build (e.g. dev, where the Astro dev server owns its
// assets) fall through to the Astro proxy unchanged.
func buildStaticRoutes(opts BuildOpts) []caddyadmin.Route {
	routes := []caddyadmin.Route{}

	// --- Platform (admin SSR app) static at root paths (base "/") ---
	if client := filepath.Join(opts.AdminDistDir, "client"); dirExists(client) {
		routes = append(routes,
			staticFileRoute("vanblog-static-admin-astro", "/_astro/*", client, "", CacheImmutable),
			staticFileRoute("vanblog-static-admin-emoji", "/emoji-data.json", client, "", CacheStable),
			staticFileRoute("vanblog-static-admin-robots", "/robots.txt", client, "", CacheStable),
		)
	}

	// --- Per-theme static under /themes/<name>/ ---
	entries, err := os.ReadDir(opts.ThemesDir)
	if err != nil {
		return routes
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		client := filepath.Join(opts.ThemesDir, name, "dist", "client")
		if !dirExists(client) {
			continue
		}
		prefix := "/themes/" + name
		// Content-hashed route first — Caddy evaluates routes in order, so the
		// specific /_astro/* route wins over the broad stable-file route below.
		routes = append(routes,
			staticFileRoute("vanblog-static-theme-"+name+"-astro", prefix+"/_astro/*", client, prefix, CacheImmutable),
			staticFileRoute("vanblog-static-theme-"+name, prefix+"/*", client, prefix, CacheStable),
		)
	}
	return routes
}

// staticFileRoute builds one route whose handle applies a Cache-Control header
// via a non-terminal `headers` handler, then serves the file via the terminal
// `file_server` handler. stripPrefix is empty when the URL maps 1:1 onto the
// client dir (admin app, base "/") and "/themes/<name>" for themes.
func staticFileRoute(id, matchPath, clientDir, stripPrefix, cacheControl string) caddyadmin.Route {
	return caddyadmin.Route{
		ID:    id,
		Match: []caddyadmin.MatchRule{{Path: []string{matchPath}}},
		Handle: []caddyadmin.Handler{
			{
				Handler: "headers",
				Headers: &caddyadmin.HeaderPolicy{
					Response: &caddyadmin.HeaderOps{
						Set: map[string][]string{"Cache-Control": {cacheControl}},
					},
				},
			},
			{
				Handler:         "file_server",
				Root:            clientDir,
				StripPathPrefix: stripPrefix,
			},
		},
	}
}

func dirExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}
