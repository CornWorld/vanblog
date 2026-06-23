package caddyadmin

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

	// Terminate, if true, stops route processing after this route matches.
	// Default false, meaning Caddy continues to evaluate subsequent routes.
	Terminate bool `json:"terminate,omitempty"`
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

	// --- reverse_proxy fields ---

	// Upstreams is the list of upstream backends.
	Upstreams []Upstream `json:"upstreams,omitempty"`

	// Headers is request/response header manipulation for reverse_proxy.
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

// TLSPolicy defines TLS automation policy.
type TLSPolicy struct {
	Subjects []string `json:"subjects,omitempty"`
}
