package caddy

// config_builder.go assembles caddyadmin.Config structs for the bootstrap
// (maintenance mode) and full runtime configurations.
//
// See .snow/plan/caddy-single-source.md for the design rationale.

import (
	"strings"

	"github.com/cornworld/vanblog/utils/caddyadmin"
)

// BuildOpts controls how a Caddy config is generated. It is an internal
// parameter object — fields are never JSON-marshaled directly (tagged with
// `json:"-"`). dev vs. prod is selected via Variant.
type BuildOpts struct {
	// Variant selects between "prod" and "dev" semantics. Empty defaults to
	// "prod" (see Defaults).
	Variant string `json:"-"`

	// AstroTarget is the dial address of the Astro SSR (prod) or Astro dev
	// server (dev). Default "127.0.0.1:4321". Overridable via env so operators
	// can repoint the fallback without rebuilding.
	AstroTarget string `json:"-"`

	// Email is used for Let's Encrypt registration. Required for on-demand TLS
	// to actually issue certificates; an empty Email leaves the ACME issuer
	// without an email (Caddy will still run but LE has no account contact).
	Email string `json:"-"`

	// LogLevel sets Caddy's default logger level: debug / info / warn / error.
	// Defaults to "warn" in prod, "info" in dev.
	LogLevel string `json:"-"`

	// AllowedDomains is the site's TLS allowlist (site.allowedDomains). It
	// becomes the Subjects of the on-demand TLS automation policy. An empty
	// slice means "fully on-demand" — any domain the ask endpoint approves
	// gets a certificate. This matches vanblog's setup-window behavior.
	AllowedDomains []string `json:"-"`

	// HTTPOnly, when true, produces a TLS-less config: a single server
	// listening on :80 hosts the same route table (system API → cache →
	// user rules → Astro fallback) and there is no apps.tls subtree, no
	// HTTP→HTTPS redirect, no on-demand TLS. Intended for operators who
	// terminate TLS at an external reverse proxy.
	HTTPOnly bool `json:"-"`
}

// Defaults fills zero-value fields with sensible defaults.
func (o *BuildOpts) Defaults() {
	if o.Variant == "" {
		o.Variant = "prod"
	}
	if o.AstroTarget == "" {
		o.AstroTarget = "127.0.0.1:4321"
	}
	if o.LogLevel == "" {
		if o.Variant == "dev" {
			o.LogLevel = "INFO"
		} else {
			o.LogLevel = "WARN"
		}
	}
	// Caddy uses zapcore levels which MUST be uppercase
	// (DEBUG / INFO / WARN / ERROR / PANIC). A user may have set a lowercase
	// value via env or an older site record — normalize to uppercase so the
	// emitted config is always accepted by Caddy.
	o.LogLevel = strings.ToUpper(o.LogLevel)
}

// maintenanceHTML is the 503 page body served while the full config is loading.
// Do not change the copy without coordinating — operators rely on the Chinese
// wording matching release notes.
const maintenanceHTML = `<!doctype html><html><head><meta charset="utf-8"><title>VanBlog 启动中</title></head><body><h1>VanBlog 正在启动,请稍候…</h1><p>页面将在几秒后自动刷新。</p></body></html>`

// Default constants for the generated configs. Centralized here so that
// security-relevant values (admin origins, ask endpoint, storage root) are
// not sprinkled across functions.
const (
	// adminListen is loopback-only by design. Exposing the admin API to the
	// network is a remote-takeover vector.
	adminListen = "127.0.0.1:2019"
	// adminOrigins is the zero-trust allowlist. MUST NOT contain "*".
	// Caddy matches request Host/Origin *literally* (including port) —
	// "127.0.0.1" without a port does NOT match a request whose Host is
	// "127.0.0.1:2019", so the admin endpoint would return 403 to clients
	// inside the container (wget, pb's own http.Client). Include both forms.
	adminOrigins  = "127.0.0.1:2019"
	storageModule = "file_system"
	storageRoot   = "/data/caddy"

	// Log writer — Caddy's canonical JSON models this as an object, not a
	// single "file <path>" string. Match docker/bootstrap.json exactly so a
	// generated bootstrap config is byte-equivalent to the static one.
	logWriterOutput = "file"
	logFilename     = "/var/log/caddy.log"

	askEndpoint = "http://127.0.0.1:8090/api/hooks/caddy/ask"

	// Internal endpoints (trusted; bypass SSRF validation by design).
	pbAPIHost = "127.0.0.1:8090"

	// Server names — stable so tests and operators can reference them.
	// IMPORTANT: docker/bootstrap.json uses srv_https / srv_http / srv_mgmt.
	// Keeping the same names here lets GetTLSStatus probe the live config by
	// the same server key regardless of whether Caddy is running the static
	// bootstrap JSON or a Go-generated full config.
	srvHTTPS = "srv_https" // :443
	srvHTTP  = "srv_http"  // :80 redirect
	srvMgmt  = "srv_mgmt"
	// srvPlain is the single :80 server used in HTTPOnly mode, replacing
	// both srv_https and srv_http. Same name in docker/bootstrap-http-only.json
	// so status detection works uniformly.
	srvPlain = "srv_plain" // :80 (HTTPOnly mode)

	// Stable @id values for system-managed routes. Users can override via
	// site.routing using the same IDs (Caddy @id semantics).
	systemAPIRouteID   = "vanblog-system-api"
	systemAdminRouteID = "vanblog-system-pb-admin"
	systemFallbackID   = "vanblog-system-fallback"

	// Bootstrap-stage @id values. Prefixed `vanblog-bootstrap-*` to match
	// docker/bootstrap.json (the static self-bootstrapping config) so that
	// GetTLSStatus can detect "still in maintenance mode" by looking for
	// vanblog-bootstrap-maintenance in the live Caddy config regardless of
	// whether the maintenance route came from the static JSON or from
	// BuildBootstrapConfig.
	maintenanceRouteID  = "vanblog-bootstrap-maintenance"
	httpRedirectRouteID = "vanblog-bootstrap-redirect"
)

// BuildBootstrapConfig generates the maintenance-mode config Caddy boots with.
//
// Semantics (see .snow/plan/caddy-single-source.md §2.2):
//   - admin.listen = "127.0.0.1:2019", origins = ["127.0.0.1"] (zero-trust)
//   - storage.file_system.root = "/data/caddy"
//   - tls.automation: on-demand with ask endpoint + single ACME issuer
//   - logging: file /var/log/caddy.log at opts.LogLevel
//   - :443 returns 503 + Retry-After: 30 + maintenance HTML
//   - :80 redirects to HTTPS (301, via static_response + Location header)
//   - :8080 reverse-proxies /api/* and /_/* to pb, everything else to Astro
//
// The management :8080 listener is critical: it keeps the admin UI reachable
// even if LoadConfig (Phase 3) fails and the site is stuck on the bootstrap
// config. Without it, operators would be locked out.
//
// No listener_wrappers / http_redirect on the :443 server — Caddy's automatic
// HTTPS handles redirects itself when :80 is not declared; declaring :80
// explicitly via srv1 takes precedence and is what we want.
func BuildBootstrapConfig(opts BuildOpts) caddyadmin.Config {
	opts.Defaults()

	if opts.HTTPOnly {
		return buildBootstrapHTTPOnly(opts)
	}

	return caddyadmin.Config{
		Admin: &caddyadmin.AdminConfig{
			Listen:  adminListen,
			Origins: []string{adminOrigins},
		},
		Logs: &caddyadmin.LogsConfig{
			Logs: map[string]caddyadmin.LogEntry{
				"default": {
					Writer: &caddyadmin.LogWriter{
						Output:   logWriterOutput,
						Filename: logFilename,
					},
					Level: opts.LogLevel,
				},
			},
		},
		Storage: &caddyadmin.Storage{
			Module: storageModule,
			Root:   storageRoot,
		},
		Apps: &caddyadmin.Apps{
			HTTP: &caddyadmin.HTTPApp{
				Servers: map[string]*caddyadmin.Server{
					srvHTTPS: {
						Listen: []string{":443"},
						Routes: []caddyadmin.Route{
							{
								ID: maintenanceRouteID,
								Match: []caddyadmin.MatchRule{{
									Path: []string{"/*"},
								}},
								Handle: []caddyadmin.Handler{{
									Handler:    "static_response",
									StatusCode: 503,
									Headers: &caddyadmin.HeaderPolicy{
										Response: &caddyadmin.HeaderOps{
											Set: map[string][]string{
												"Retry-After":  {"30"},
												"Content-Type": {"text/html; charset=utf-8"},
											},
										},
									},
									Body: maintenanceHTML,
								}},
							},
						},
					},
					srvHTTP: {
						Listen: []string{":80"},
						Routes: []caddyadmin.Route{
							{
								ID: httpRedirectRouteID,
								Match: []caddyadmin.MatchRule{{
									Path: []string{"/*"},
								}},
								Handle: []caddyadmin.Handler{{
									Handler:    "static_response",
									StatusCode: 301,
									Headers: &caddyadmin.HeaderPolicy{
										Response: &caddyadmin.HeaderOps{
											Set: map[string][]string{
												"Location": {"https://{host}{uri}"},
											},
										},
									},
								}},
							},
						},
					},
					srvMgmt: buildManagementServerRoutes(opts.AstroTarget),
				},
			},
			TLS: buildTLSApp(opts.Email, opts.AllowedDomains),
		},
	}
}

// BuildFullConfig generates the complete runtime Caddy config.
//
// Route order on the HTTPS server (:443) is **order-sensitive** and is
// documented here as the contract operators and tests rely on:
//  1. System API routes (vanblog-system-api, vanblog-system-pb-admin):
//     `/api/*` and `/_/*` reverse-proxied to pb. These win first because
//     they are the most specific reserved paths.
//  2. System cache rules (SystemCacheRules translated): cache headers on
//     long-lived static assets. They come before user rules so a user rule
//     with the same @id replaces them via Caddy's stable-ID semantics.
//  3. User rules: translated via TranslateAll (which also runs SSRF +
//     reserved-path validation). Any failure aborts the whole build.
//  4. Fallback (vanblog-system-fallback): reverse_proxy to opts.AstroTarget.
//     Catches everything not matched above.
//
// The HTTP (:80) and management (:8080) servers mirror BuildBootstrapConfig.
//
// SSRF safety: the system routes' dials (127.0.0.1:8090, opts.AstroTarget)
// are trusted internal endpoints and do NOT go through ValidateTarget — this
// is by design. User-supplied targets DO go through TranslateAll →
// ValidateTarget. TestBuildFullConfigSSRFSafety asserts that the marshaled
// output only contains dials inside DefaultAllowlist.
func BuildFullConfig(opts BuildOpts, userRules []UserRule) (caddyadmin.Config, error) {
	opts.Defaults()

	if opts.HTTPOnly {
		return buildFullHTTPOnly(opts, userRules)
	}

	// Translate system cache rules + user rules together. TranslateAll
	// enforces reserved-path and SSRF validation on every rule; a failure
	// means the user config is unsafe and we refuse to produce a config at
	// all (rather than silently dropping the bad rule).
	combined := append(SystemCacheRules(), userRules...)
	rules, err := TranslateAll(combined, nil)
	if err != nil {
		return caddyadmin.Config{}, err
	}

	// HTTPS route order (see function doc):
	//   1. system API + admin (hardcoded reserved paths)
	//   2. translated cache+user rules (already in the right relative order:
	//      cache rules first because SystemCacheRules is prepended above)
	//   3. Astro fallback (terminal, catches everything else)
	httpsRoutes := make([]caddyadmin.Route, 0, 2+len(rules)+1)
	httpsRoutes = append(httpsRoutes,
		caddyadmin.Route{
			ID: systemAPIRouteID,
			Match: []caddyadmin.MatchRule{{
				Path: []string{"/api/*"},
			}},
			Handle: []caddyadmin.Handler{{
				Handler:   "reverse_proxy",
				Upstreams: []caddyadmin.Upstream{{Dial: pbAPIHost}},
			}},
		},
		caddyadmin.Route{
			ID: systemAdminRouteID,
			Match: []caddyadmin.MatchRule{{
				Path: []string{"/_/*"},
			}},
			Handle: []caddyadmin.Handler{{
				Handler:   "reverse_proxy",
				Upstreams: []caddyadmin.Upstream{{Dial: pbAPIHost}},
			}},
		},
	)
	httpsRoutes = append(httpsRoutes, rules...)
	httpsRoutes = append(httpsRoutes, caddyadmin.Route{
		ID: systemFallbackID,
		// No Match → catch-all (terminal).
		Handle: []caddyadmin.Handler{{
			Handler:   "reverse_proxy",
			Upstreams: []caddyadmin.Upstream{{Dial: opts.AstroTarget}},
		}},
	})

	return caddyadmin.Config{
		Admin: &caddyadmin.AdminConfig{
			Listen:  adminListen,
			Origins: []string{adminOrigins},
		},
		Logs: &caddyadmin.LogsConfig{
			Logs: map[string]caddyadmin.LogEntry{
				"default": {
					Writer: &caddyadmin.LogWriter{
						Output:   logWriterOutput,
						Filename: logFilename,
					},
					Level: opts.LogLevel,
				},
			},
		},
		Storage: &caddyadmin.Storage{
			Module: storageModule,
			Root:   storageRoot,
		},
		Apps: &caddyadmin.Apps{
			HTTP: &caddyadmin.HTTPApp{
				Servers: map[string]*caddyadmin.Server{
					srvHTTPS: {
						Listen: []string{":443"},
						Routes: httpsRoutes,
					},
					srvHTTP: {
						Listen: []string{":80"},
						Routes: []caddyadmin.Route{
							{
								ID: httpRedirectRouteID,
								Match: []caddyadmin.MatchRule{{
									Path: []string{"/*"},
								}},
								Handle: []caddyadmin.Handler{{
									Handler:    "static_response",
									StatusCode: 301,
									Headers: &caddyadmin.HeaderPolicy{
										Response: &caddyadmin.HeaderOps{
											Set: map[string][]string{
												"Location": {"https://{host}{uri}"},
											},
										},
									},
								}},
							},
						},
					},
					srvMgmt: buildManagementServerRoutes(opts.AstroTarget),
				},
			},
			TLS: buildTLSApp(opts.Email, opts.AllowedDomains),
		},
	}, nil
}

// buildManagementServerRoutes returns the :8080 server definition shared by
// both bootstrap and full configs. It proxies /api/* and /_/* to pb (so the
// admin UI / API work even during maintenance mode) and everything else to
// Astro.
func buildManagementServerRoutes(astroTarget string) *caddyadmin.Server {
	return &caddyadmin.Server{
		Listen: []string{":8080"},
		Routes: []caddyadmin.Route{
			{
				Match: []caddyadmin.MatchRule{{Path: []string{"/api/*"}}},
				Handle: []caddyadmin.Handler{{
					Handler:   "reverse_proxy",
					Upstreams: []caddyadmin.Upstream{{Dial: pbAPIHost}},
				}},
			},
			{
				Match: []caddyadmin.MatchRule{{Path: []string{"/_/*"}}},
				Handle: []caddyadmin.Handler{{
					Handler:   "reverse_proxy",
					Upstreams: []caddyadmin.Upstream{{Dial: pbAPIHost}},
				}},
			},
			{
				// Catch-all fallback to Astro.
				Handle: []caddyadmin.Handler{{
					Handler:   "reverse_proxy",
					Upstreams: []caddyadmin.Upstream{{Dial: astroTarget}},
				}},
			},
		},
	}
}

// buildTLSApp returns the apps.tls subtree shared by both configs:
//   - One automation policy with on_demand=true and a single ACME issuer
//     using opts.Email. When AllowedDomains is non-empty, it becomes the
//     subjects allowlist; empty means fully on-demand (the ask endpoint is
//     the only gate).
//   - The on_demand.ask endpoint points at vanblog's own /api/hooks/caddy/ask,
//     which returns 2xx for allowed domains. This is the core of vanblog's
//     on-demand TLS allowlist.
func buildTLSApp(email string, allowedDomains []string) *caddyadmin.TLSApp {
	policy := caddyadmin.AutomationPolicy{
		OnDemand: true,
		Issuers: []caddyadmin.Issuer{{
			Module: "acme",
			Email:  email,
		}},
	}
	if len(allowedDomains) > 0 {
		policy.Subjects = allowedDomains
	}
	return &caddyadmin.TLSApp{
		Automation: &caddyadmin.Automation{
			Policies: []caddyadmin.AutomationPolicy{policy},
			OnDemand: &caddyadmin.OnDemandTLS{
				Ask: askEndpoint,
			},
		},
	}
}

// --- HTTPOnly-mode builders -----------------------------------------------

// buildPlainServers constructs the server map for HTTPOnly mode:
//   - srvPlain: single :80 server hosting all routes (no TLS)
//   - srvMgmt:  the usual :8080 management fallback (still useful for
//               operators who expose it via an extra published port)
//
// No srv_https, no srv_http redirect — those exist only for the HTTPS
// terminating path.
func buildPlainServers(opts BuildOpts, plainRoutes []caddyadmin.Route) map[string]*caddyadmin.Server {
	return map[string]*caddyadmin.Server{
		srvPlain: {
			Listen: []string{":80"},
			Routes: plainRoutes,
		},
		srvMgmt: buildManagementServerRoutes(opts.AstroTarget),
	}
}

// buildBootstrapHTTPOnly mirrors BuildBootstrapConfig but for HTTPOnly mode:
// maintenance 503 page on :80, no TLS app, no HTTP→HTTPS redirect.
func buildBootstrapHTTPOnly(opts BuildOpts) caddyadmin.Config {
	maintenanceRoute := caddyadmin.Route{
		ID: maintenanceRouteID,
		Match: []caddyadmin.MatchRule{{
			Path: []string{"/*"},
		}},
		Handle: []caddyadmin.Handler{{
			Handler:    "static_response",
			StatusCode: 503,
			Headers: &caddyadmin.HeaderPolicy{
				Response: &caddyadmin.HeaderOps{
					Set: map[string][]string{
						"Retry-After":  {"30"},
						"Content-Type": {"text/html; charset=utf-8"},
					},
				},
			},
			Body: maintenanceHTML,
		}},
	}

	return caddyadmin.Config{
		Admin: &caddyadmin.AdminConfig{
			Listen:  adminListen,
			Origins: []string{adminOrigins},
		},
		Logs: &caddyadmin.LogsConfig{
			Logs: map[string]caddyadmin.LogEntry{
				"default": {
					Writer: &caddyadmin.LogWriter{
						Output:   logWriterOutput,
						Filename: logFilename,
					},
					Level: opts.LogLevel,
				},
			},
		},
		Storage: &caddyadmin.Storage{
			Module: storageModule,
			Root:   storageRoot,
		},
		Apps: &caddyadmin.Apps{
			HTTP: &caddyadmin.HTTPApp{
				Servers: buildPlainServers(opts, []caddyadmin.Route{maintenanceRoute}),
			},
			// TLS intentionally omitted — external proxy terminates HTTPS.
		},
	}
}

// buildFullHTTPOnly mirrors BuildFullConfig but for HTTPOnly mode: full
// route table on :80, no TLS app. Route order on srvPlain is identical to
// the HTTPS path's srv_https ordering so user-facing behavior is unchanged.
func buildFullHTTPOnly(opts BuildOpts, userRules []UserRule) (caddyadmin.Config, error) {
	combined := append(SystemCacheRules(), userRules...)
	rules, err := TranslateAll(combined, nil)
	if err != nil {
		return caddyadmin.Config{}, err
	}

	httpsRoutes := make([]caddyadmin.Route, 0, 2+len(rules)+1)
	httpsRoutes = append(httpsRoutes,
		caddyadmin.Route{
			ID: systemAPIRouteID,
			Match: []caddyadmin.MatchRule{{
				Path: []string{"/api/*"},
			}},
			Handle: []caddyadmin.Handler{{
				Handler:   "reverse_proxy",
				Upstreams: []caddyadmin.Upstream{{Dial: pbAPIHost}},
			}},
		},
		caddyadmin.Route{
			ID: systemAdminRouteID,
			Match: []caddyadmin.MatchRule{{
				Path: []string{"/_/*"},
			}},
			Handle: []caddyadmin.Handler{{
				Handler:   "reverse_proxy",
				Upstreams: []caddyadmin.Upstream{{Dial: pbAPIHost}},
			}},
		},
	)
	httpsRoutes = append(httpsRoutes, rules...)
	httpsRoutes = append(httpsRoutes, caddyadmin.Route{
		ID: systemFallbackID,
		Handle: []caddyadmin.Handler{{
			Handler:   "reverse_proxy",
			Upstreams: []caddyadmin.Upstream{{Dial: opts.AstroTarget}},
		}},
	})

	return caddyadmin.Config{
		Admin: &caddyadmin.AdminConfig{
			Listen:  adminListen,
			Origins: []string{adminOrigins},
		},
		Logs: &caddyadmin.LogsConfig{
			Logs: map[string]caddyadmin.LogEntry{
				"default": {
					Writer: &caddyadmin.LogWriter{
						Output:   logWriterOutput,
						Filename: logFilename,
					},
					Level: opts.LogLevel,
				},
			},
		},
		Storage: &caddyadmin.Storage{
			Module: storageModule,
			Root:   storageRoot,
		},
		Apps: &caddyadmin.Apps{
			HTTP: &caddyadmin.HTTPApp{
				Servers: buildPlainServers(opts, httpsRoutes),
			},
		},
	}, nil
}
