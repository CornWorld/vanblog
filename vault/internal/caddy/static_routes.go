package caddy

import (
	"os"
	"path/filepath"
	"slices"

	"github.com/CornWorld/caddyadmin"
)

// buildStaticRoutes returns the system-owned Caddy file_server routes that serve
// built static assets directly from disk, taking the theme host out of the
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
	// Merge the builtin (image, read-only) + user (volume) roots: a user theme
	// whose name collides with a builtin shadows it. Only themes whose
	// dist/client dir exists emit file_server routes. Names are sorted so the
	// generated config is deterministic across restarts.
	clientByTheme := map[string]string{}
	for _, root := range []string{opts.BuiltinThemesDir, opts.ThemesDir} {
		if root == "" {
			continue
		}
		entries, err := os.ReadDir(root)
		if err != nil {
			continue // missing/unreadable root (e.g. no builtin in some dev setups)
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			client := filepath.Join(root, e.Name(), "dist", "client")
			if !dirExists(client) {
				continue
			}
			// User dir is iterated after builtin, so a colliding user theme
			// overwrites the builtin entry → user wins.
			clientByTheme[e.Name()] = client
		}
	}
	names := make([]string, 0, len(clientByTheme))
	for name := range clientByTheme {
		names = append(names, name)
	}
	slices.Sort(names)
	for _, name := range names {
		client := clientByTheme[name]
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
// via a non-terminal `headers` handler, strips the theme prefix via a
// non-terminal `rewrite` handler (only when stripPrefix is non-empty), then
// serves the file via the terminal `file_server` handler.
//
// strip_path_prefix is a Caddy `rewrite` modifier — file_server has no such
// field (the caddyadmin schema rejects it there). stripPrefix is empty when
// the URL maps 1:1 onto the client dir (admin app, base "/") and
// "/themes/<name>" for themes.
func staticFileRoute(id, matchPath, clientDir, stripPrefix, cacheControl string) caddyadmin.Route {
	handle := []caddyadmin.Handler{
		{
			Handler: "headers",
			Headers: &caddyadmin.HeaderPolicy{
				Response: &caddyadmin.HeaderOps{
					Set: map[string][]string{"Cache-Control": {cacheControl}},
				},
			},
		},
	}
	if stripPrefix != "" {
		handle = append(handle, caddyadmin.Handler{
			Handler:         "rewrite",
			StripPathPrefix: stripPrefix,
		})
	}
	handle = append(handle, caddyadmin.Handler{
		Handler: "file_server",
		Root:    clientDir,
	})
	return caddyadmin.Route{
		ID:     id,
		Match:  []caddyadmin.MatchRule{{Path: []string{matchPath}}},
		Handle: handle,
	}
}

func dirExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}
