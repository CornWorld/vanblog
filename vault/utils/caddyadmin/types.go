package caddyadmin

import "encoding/json"

// Route represents a single Caddy route with optional @id for stable identification.
// See: https://caddyserver.com/docs/api#using-stable-ids
type Route struct {
	// ID is the stable identifier for the route, mapped to Caddy's "@id" field.
	// Used for AddRoute/RemoveRoute/GetRoutes by ID instead of array position.
	ID string `json:"@id,omitempty"`

	// Match defines the route matchers. A route matches if ANY matcher matches.
	Match []MatchRule `json:"match,omitempty"`

	// Handle defines the route handlers. Executed in order when the route matches.
	Handle []Handler `json:"handle,omitempty"`
}

// MatchRule defines a single Caddy matcher. We only use Path matching for now.
type MatchRule struct {
	// Path matches request paths using Caddy's fast path matcher.
	// Supports glob: ["/api/*", "/static/*"]
	Path []string `json:"path,omitempty"`

	// Host matches request hostnames. Wildcards supported: ["*.example.com"]
	Host []string `json:"host,omitempty"`

	// Header matches request headers.
	Header map[string][]string `json:"header,omitempty"`

	// Method matches HTTP methods: ["GET", "POST"]
	Method []string `json:"method,omitempty"`

	// NotIP matches when the client IP is NOT in the list.
	NotIP []string `json:"not_ip,omitempty"`

	// IP matches when the client IP IS in the list.
	IP []string `json:"ip,omitempty"`
}

// Handler defines a single Caddy handler. Different handler types use different fields.
type Handler struct {
	// Handler is the module name: "reverse_proxy", "static_response", "rewrite", "subroute", etc.
	// See: https://caddyserver.com/docs/json/apps/http/#servers/routes/handle/handler
	Handler string `json:"handler"`

	// --- reverse_proxy / static_response shared ---

	// Upstreams is the list of upstream backends.
	Upstreams []Upstream `json:"upstreams,omitempty"`

	// Headers is request/response header manipulation for reverse_proxy,
	// static_response, and the standalone `headers` handler.
	//
	// In-memory representation is always *HeaderPolicy, but the on-wire JSON
	// shape differs per handler (verified against Caddy 2.8 admin API):
	//   - reverse_proxy / standalone `headers` handler → nested HeaderPolicy
	//     shape ({request:{...}, response:{...}}). Required.
	//   - static_response → flat http.Header shape (map[string][]string).
	//     Caddy rejects the nested shape with HTTP 400. MarshalJSON on Handler
	//     flattens Response.Set for this handler kind only.
	Headers *HeaderPolicy `json:"headers,omitempty"`

	// --- static_response fields ---

	// StatusCode for static_response: 200, 301, 302, 403, 404, etc.
	StatusCode int `json:"status_code,omitempty"`

	// Body for static_response (inline content).
	Body string `json:"body,omitempty"`

	// --- rewrite fields ---

	// URI for rewrite: strips/sets the request URI.
	// See: https://caddyserver.com/docs/json/apps/http/#servers/routes/handle/uri
	URI string `json:"uri,omitempty"`

	// --- general fields ---

	// Routes for subroute handler (nested routes).
	Routes []Route `json:"routes,omitempty"`
}

// Upstream defines a single upstream backend for reverse_proxy.
type Upstream struct {
	// Dial is the upstream address: "host:port" or unix socket.
	Dial string `json:"dial"`
}

// HeaderPolicy defines request/response header manipulation for reverse_proxy.
// See: https://caddyserver.com/docs/json/apps/http/#servers/routes/handle/header
type HeaderPolicy struct {
	Request  *HeaderOps `json:"request,omitempty"`
	Response *HeaderOps `json:"response,omitempty"`
}

// HeaderOps defines header add/delete/set operations.
type HeaderOps struct {
	Add    map[string][]string `json:"add,omitempty"`
	Set    map[string][]string `json:"set,omitempty"`
	Delete []string            `json:"delete,omitempty"`
}

// ============================================================
// Full Caddy config root structs (Phase 1 of caddy-single-source plan)
// ============================================================
//
// These structs allow expressing the *entire* Caddy config JSON (the document
// POSTed to POST /load) as Go values, eliminating all string-interpolated JSON.
// Reference: https://caddyserver.com/docs/api#post-/load
//
// Design notes:
//   - All fields use pointer + `omitempty` where it makes sense so the
//     marshaled JSON is clean (no empty objects/arrays leaking in).
//   - Existing Route / MatchRule / Handler / Upstream / HeaderPolicy /
//     HeaderOps structs above are reused by Server.Routes.

// Config is the root of a Caddy config JSON document.
type Config struct {
	Admin   *AdminConfig `json:"admin,omitempty"`
	Logs    *LogsConfig  `json:"logging,omitempty"`
	Storage *Storage     `json:"storage,omitempty"`
	Apps    *Apps        `json:"apps,omitempty"`
}

// JSON returns the canonical Caddy-compatible JSON encoding of the config.
// It is exactly json.Marshal; provided as a convenience so callers don't
// have to import encoding/json just to serialize a Config.
func (c *Config) JSON() ([]byte, error) {
	return json.Marshal(c)
}

// AdminConfig corresponds to the top-level `admin` block.
//
// Security: Origins MUST be an explicit allowlist (e.g. ["127.0.0.1"]).
// Setting Origins to ["*"] exposes the admin API to the network and is a
// remote takeover vector. Tests assert "*" never appears in the output.
type AdminConfig struct {
	Listen  string   `json:"listen"`           // e.g. "127.0.0.1:2019"
	Origins []string `json:"origins,omitempty"` // MUST be explicit; NEVER ["*"]
	Persist *bool    `json:"persist,omitempty"` // nil = Caddy default
}

// LogsConfig corresponds to the top-level `logging` block.
type LogsConfig struct {
	Logs map[string]LogEntry `json:"logs,omitempty"`
}

// LogEntry is one named logger (key is the logger name; the default logger
// uses the special key "default").
//
// Caddy's canonical logging JSON uses an object form for `writer`, e.g.:
//
//	"default": {
//	  "writer": {"output": "file", "filename": "/var/log/caddy.log"},
//	  "level":  "WARN"
//	}
//
// Level must be an uppercase zap level: DEBUG / INFO / WARN / ERROR / PANIC.
type LogEntry struct {
	Writer *LogWriter `json:"writer,omitempty"`
	Level  string     `json:"level,omitempty"`
}

// LogWriter is the writer configuration for a log entry.
// See: https://caddyserver.com/docs/json/logging/#logs
type LogWriter struct {
	Output   string `json:"output"`            // "file" / "stderr" / "stdout" / "net"
	Filename string `json:"filename,omitempty"` // for output="file"
}

// Storage corresponds to the top-level `storage` block. vanblog uses the
// file_system module exclusively.
type Storage struct {
	Module string `json:"module"` // "file_system"
	Root   string `json:"root"`   // e.g. "/data/caddy"
}

// Apps corresponds to the top-level `apps` block. We only model http + tls
// (the only apps vanblog configures explicitly).
type Apps struct {
	HTTP *HTTPApp `json:"http,omitempty"`
	TLS  *TLSApp  `json:"tls,omitempty"`
}

// HTTPApp corresponds to apps.http.
type HTTPApp struct {
	Servers map[string]*Server `json:"servers,omitempty"` // "srv0" -> ...
}

// Server corresponds to apps.http.servers.{name}. It is a named HTTP listener
// (e.g. "srv0" for :443, "srv1" for :80 redirect, "srv_mgmt" for :8080).
type Server struct {
	Listen           []string         `json:"listen,omitempty"` // [":443"], [":80"], [":8080"]
	Routes           []Route          `json:"routes,omitempty"`
	ListenerWrappers []ListenerWrapper `json:"listener_wrappers,omitempty"` // e.g. http_redirect
	Logs             *ServerLogs      `json:"logs,omitempty"`
	// TLS connection policies are intentionally NOT modeled here: under
	// automatic HTTPS, Caddy generates them itself. Declaring them manually
	// fights Caddy's automation and is a known foot-gun.
}

// ListenerWrapper is one entry under server.listener_wrappers. The only
// wrapper vanblog uses is "http_redirect" (HTTP→HTTPS redirect on the :80
// server).
type ListenerWrapper struct {
	Wrapper string `json:"wrapper"` // "http_redirect"
}

// ServerLogs corresponds to server.logs (per-server logger config).
type ServerLogs struct {
	DefaultLoggerName string `json:"default_logger_name,omitempty"`
}

// TLSApp corresponds to apps.tls.
type TLSApp struct {
	Automation *Automation `json:"automation,omitempty"`
	// certificates / get_certificate / session_tickets etc. are managed by
	// Caddy internally under automatic HTTPS and are intentionally not modeled.
}

// Automation corresponds to apps.tls.automation.
type Automation struct {
	Policies []AutomationPolicy `json:"policies,omitempty"`
	OnDemand *OnDemandTLS       `json:"on_demand,omitempty"`
}

// AutomationPolicy is one entry under tls.automation.policies.
//
// For vanblog's on-demand TLS model, there is typically a single policy with
// Subjects = the allowlisted domains and OnDemand = true. Caddy then calls
// the OnDemandTLS.Ask endpoint before issuing each certificate.
type AutomationPolicy struct {
	Subjects []string `json:"subjects,omitempty"`
	OnDemand bool     `json:"on_demand,omitempty"`
	Issuers  []Issuer `json:"issuers,omitempty"`
}

// OnDemandTLS corresponds to tls.automation.on_demand. The Ask endpoint is
// vanblog's own /api/hooks/caddy/ask, which returns 2xx for allowlisted
// domains and non-2xx otherwise — this is the core of vanblog's on-demand
// TLS allowlist.
type OnDemandTLS struct {
	Ask string `json:"ask,omitempty"`
}

// Issuer is one certificate issuer under an AutomationPolicy. vanblog lets
// Caddy use its default ACME issuer (Let's Encrypt) and only optionally sets
// the email; other ACME-specific fields are left to Caddy's defaults.
type Issuer struct {
	Module string `json:"module"` // "acme" / "zerossl" / "internal"
	Email  string `json:"email,omitempty"`
}

// ============================================================
// Custom marshaling
// ============================================================

// handlerRaw is the default marshal output of Handler with the Headers field
// omitted. MarshalJSON fills Headers separately depending on Handler kind.
type handlerRaw struct {
	Handler    string    `json:"handler"`
	Upstreams  []Upstream `json:"upstreams,omitempty"`
	StatusCode int       `json:"status_code,omitempty"`
	Body       string    `json:"body,omitempty"`
	URI        string    `json:"uri,omitempty"`
	Routes     []Route   `json:"routes,omitempty"`
}

// MarshalJSON serializes Handler. For static_response it emits Headers as a
// flat map[string][]string (http.Header shape); for every other handler kind
// it emits Headers as the nested HeaderPolicy shape. This matches Caddy 2.x's
// per-handler schema — see https://caddyserver.com/docs/json/apps/http/servers/routes/handle/
// (the two handler modules use different shapes for the same JSON key).
func (h Handler) MarshalJSON() ([]byte, error) {
	raw := handlerRaw{
		Handler:    h.Handler,
		Upstreams:  h.Upstreams,
		StatusCode: h.StatusCode,
		Body:       h.Body,
		URI:        h.URI,
		Routes:     h.Routes,
	}

	if h.Headers == nil {
		return json.Marshal(raw)
	}

	if h.Handler == "static_response" {
		// Flatten HeaderPolicy.Response.Set to the flat map Caddy expects.
		flat := map[string][]string{}
		if h.Headers.Response != nil {
			for k, v := range h.Headers.Response.Set {
				flat[k] = v
			}
		}
		return marshalHandlerWithHeaders(raw, flat)
	}
	return marshalHandlerWithHeaders(raw, h.Headers)
}

// marshalHandlerWithHeaders builds the JSON by marshaling raw first, then
// injecting `headers` with the given value (which must be either a *HeaderPolicy
// for nested shape or a map[string][]string for flat shape).
func marshalHandlerWithHeaders(raw handlerRaw, headers any) ([]byte, error) {
	b, err := json.Marshal(raw)
	if err != nil {
		return nil, err
	}
	hb, err := json.Marshal(headers)
	if err != nil {
		return nil, err
	}
	// Inject before the closing brace. b always ends with '}' since raw is a struct.
	out := make([]byte, 0, len(b)+len(hb)+12)
	out = append(out, b[:len(b)-1]...)  // strip '}'
	out = append(out, `,"headers":`...)
	out = append(out, hb...)
	out = append(out, '}')
	return out, nil
}
