package caddy

import (
	"fmt"
	"strings"
)

// TemplateOpts holds parameters for Caddyfile rendering.
type TemplateOpts struct {
	// Email is used for Let's Encrypt registration (required for on-demand TLS).
	Email string

	// LogLevel controls Caddy's log verbosity. Default "warn".
	// Options: debug, info, warn, error.
	LogLevel string

	// AskEndpoint is the URL Caddy calls to validate domain for on-demand TLS.
	// Typically "http://127.0.0.1:8090/api/hooks/caddy/ask".
	AskEndpoint string

	// AdminBind is the address for Caddy admin API. Default "127.0.0.1:2019".
	// Must be localhost-only to prevent external access.
	AdminBind string
}

// RenderProdCaddyfile renders the Caddyfile for prod mode (SSG, file_server).
// The frontend is served as static files from /app/dist.
func RenderProdCaddyfile(opts TemplateOpts) string {
	if opts.LogLevel == "" {
		opts.LogLevel = "warn"
	}
	if opts.AdminBind == "" {
		opts.AdminBind = "127.0.0.1:2019"
	}
	if opts.AskEndpoint == "" {
		opts.AskEndpoint = "http://127.0.0.1:8090/api/hooks/caddy/ask"
	}

	return fmt.Sprintf(`{
	admin %s
	email %s
	on_demand_tls {
		ask %s
	}
	log {
		output file /var/log/caddy.log
		level %s
	}
}

https:// {
	tls {
		on_demand
	}
	encode zstd gzip

	# vanblog API
	handle /api/* {
		reverse_proxy 127.0.0.1:8090
	}

	# static files (images, uploads)
	handle_path /static/* {
		reverse_proxy 127.0.0.1:8090
	}

	# admin UI (static SPA)
	handle /admin/* {
		root * /app/dist/admin
		try_files {path} /admin/index.html
		file_server
	}

	# user-defined routes (managed via admin API)
	# @id-tagged routes are appended here by caddyadmin.Client

	# fallback: serve Astro SSG output
	root * /app/dist
	try_files {path} /index.html
	file_server
}

http:// {
	redir https://{host}{uri} permanent
}
`, opts.AdminBind, opts.Email, opts.AskEndpoint, opts.LogLevel)
}

// RenderDevCaddyfile renders the Caddyfile for dev mode (Astro dev server).
// The frontend is proxied to Astro's dev server on port 4321.
func RenderDevCaddyfile(opts TemplateOpts) string {
	if opts.LogLevel == "" {
		opts.LogLevel = "info"
	}
	if opts.AdminBind == "" {
		opts.AdminBind = "127.0.0.1:2019"
	}
	if opts.AskEndpoint == "" {
		opts.AskEndpoint = "http://127.0.0.1:8090/api/hooks/caddy/ask"
	}

	return fmt.Sprintf(`{
	admin %s
	email %s
	on_demand_tls {
		ask %s
	}
	log {
		output file /var/log/caddy.log
		level %s
	}
}

https:// {
	tls {
		on_demand
	}
	encode zstd gzip

	# vanblog API
	handle /api/* {
		reverse_proxy 127.0.0.1:8090
	}

	# static files (images, uploads)
	handle_path /static/* {
		reverse_proxy 127.0.0.1:8090
	}

	# admin UI (proxied to Astro dev server)
	handle /admin/* {
		reverse_proxy 127.0.0.1:4321
	}

	# user-defined routes (managed via admin API)
	# @id-tagged routes are appended here by caddyadmin.Client

	# fallback: Astro dev server
	reverse_proxy 127.0.0.1:4321
}

http:// {
	redir https://{host}{uri} permanent
}
`, opts.AdminBind, opts.Email, opts.AskEndpoint, opts.LogLevel)
}

// RenderJSONConfig renders a minimal Caddy JSON config for bootstrap.
// This is used to start Caddy before the full Caddyfile is rendered.
func RenderJSONConfig(adminBind string, origins []string) string {
	if adminBind == "" {
		adminBind = "0.0.0.0:2019"
	}
	if len(origins) == 0 {
		origins = []string{"*"}
	}

	var originsJSON []string
	for _, o := range origins {
		originsJSON = append(originsJSON, fmt.Sprintf("%q", o))
	}

	return fmt.Sprintf(`{
	"admin": {
		"listen": %q,
		"origins": [%s]
	}
}`, adminBind, strings.Join(originsJSON, ","))
}
