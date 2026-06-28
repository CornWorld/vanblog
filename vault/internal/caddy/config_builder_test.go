package caddy

// Tests for config_builder.go (BuildOpts / BuildBootstrapConfig / BuildFullConfig).
//
// These replaced the old TestRender* tests that asserted on Caddyfile text.
// The new assertions verify the JSON structure produced by BuildBootstrapConfig
// and BuildFullConfig, including the zero-trust security invariant that
// admin.origins must never contain "*".

import (
	"encoding/json"
	"net"
	"strings"
	"testing"

	"github.com/cornworld/vanblog/utils/caddyadmin"
)

func TestBuildOptsDefaults(t *testing.T) {
	// Empty opts → prod defaults.
	o := BuildOpts{}
	o.Defaults()
	if o.Variant != "prod" {
		t.Errorf("default Variant: want prod, got %q", o.Variant)
	}
	if o.AstroTarget != "127.0.0.1:4321" {
		t.Errorf("default AstroTarget: want 127.0.0.1:4321, got %q", o.AstroTarget)
	}
	// Caddy uses uppercase zapcore levels (WARN / INFO / DEBUG / ERROR / PANIC).
	if o.LogLevel != "WARN" {
		t.Errorf("default prod LogLevel: want WARN, got %q", o.LogLevel)
	}

	// Dev variant flips LogLevel.
	o = BuildOpts{Variant: "dev"}
	o.Defaults()
	if o.LogLevel != "INFO" {
		t.Errorf("default dev LogLevel: want INFO, got %q", o.LogLevel)
	}

	// Explicit values are preserved (and normalized to uppercase so Caddy
	// accepts them).
	o = BuildOpts{Variant: "dev", AstroTarget: "10.0.0.5:4321", LogLevel: "error"}
	o.Defaults()
	if o.AstroTarget != "10.0.0.5:4321" {
		t.Errorf("explicit AstroTarget clobbered: got %q", o.AstroTarget)
	}
	if o.LogLevel != "ERROR" {
		t.Errorf("explicit LogLevel not uppercased: want ERROR, got %q", o.LogLevel)
	}

	// Lowercase input must be normalized to uppercase (backward compat for
	// env vars / older site records).
	o = BuildOpts{LogLevel: "debug"}
	o.Defaults()
	if o.LogLevel != "DEBUG" {
		t.Errorf("lowercase LogLevel not uppercased: want DEBUG, got %q", o.LogLevel)
	}
}

func TestBuildBootstrapConfig(t *testing.T) {
	cfg := BuildBootstrapConfig(BuildOpts{
		Email:    "test@example.com",
		LogLevel: "debug",
	})

	data, err := json.Marshal(&cfg)
	if err != nil {
		t.Fatalf("marshal bootstrap config: %v", err)
	}
	jsonStr := string(data)
	t.Logf("bootstrap config:\n%s", jsonStr)

	mustContain := []string{
		// json.Marshal produces compact output (no spaces after : or ,).
		// These substrings are robust to any future re-formatting.
		`"listen":"127.0.0.1:2019"`,
		`"origins":["127.0.0.1:2019"]`,
		`"root":"/data/caddy"`,
		`"ask":"http://127.0.0.1:8090/api/hooks/caddy/ask"`,
		`"status_code":503`,
		`"Retry-After"`,
		`"module":"acme"`,
		`"email":"test@example.com"`,
		// LogEntry: writer MUST be an object (Caddy canonical form), and the
		// level must be uppercase (zapcore). A string writer like
		// "writer":"file ..." would be rejected by Caddy.
		`"writer":{"output":"file","filename":"/var/log/caddy.log"}`,
		`"level":"DEBUG"`,
	}
	for _, s := range mustContain {
		if !strings.Contains(jsonStr, s) {
			t.Errorf("bootstrap config missing %q", s)
		}
	}

	// Negative assertion: ensure we didn't regress to the old pre-Phase-4
	// string-form writer ("writer":"file /var/log/caddy.log" as a single
	// string). The new object form has "writer":{"output":"file",...} which
	// does NOT contain the literal "writer\":\"file " (with a space, as the
	// old string form produced).
	if strings.Contains(jsonStr, `"writer":"file `) {
		t.Errorf("bootstrap config: regression — writer is a string, expected object")
	}
	// Old LogEntry had a bare top-level "output" key (sibling of "writer");
	// the new struct does not marshal one. Assert it's gone.
	if strings.Contains(jsonStr, `"output":"file /var/log/caddy.log"`) {
		t.Errorf("bootstrap config: regression — bare top-level output key present")
	}

	// SECURITY: zero-trust admin API. The wildcard origin would expose the
	// admin endpoint to the network — a remote takeover vector.
	if strings.Contains(jsonStr, `"origins":["*"]`) || strings.Contains(jsonStr, `"origins": ["*"]`) {
		t.Fatal("SECURITY: bootstrap config contains admin.origins [\"*\"] — admin API would be exposed to the network")
	}

	// Round-trip: verify the 503 route is present on srv_https (:443).
	var back caddyadmin.Config
	if err := json.Unmarshal(data, &back); err != nil {
		t.Fatalf("round-trip unmarshal: %v", err)
	}
	srvHTTPS := back.Apps.HTTP.Servers["srv_https"]
	if srvHTTPS == nil || len(srvHTTPS.Listen) != 1 || srvHTTPS.Listen[0] != ":443" {
		t.Fatalf("srv_https (:443) missing or wrong: %+v", srvHTTPS)
	}
	if len(srvHTTPS.Routes) != 1 {
		t.Fatalf("bootstrap srv_https should have exactly 1 route (503 maintenance), got %d", len(srvHTTPS.Routes))
	}
	r := srvHTTPS.Routes[0]
	if r.ID != maintenanceRouteID {
		t.Errorf("maintenance route ID: want %q, got %q", maintenanceRouteID, r.ID)
	}
	if len(r.Handle) != 1 || r.Handle[0].StatusCode != 503 {
		t.Errorf("maintenance route should return 503, got %+v", r.Handle)
	}
}

func TestBuildBootstrapConfigServers(t *testing.T) {
	cfg := BuildBootstrapConfig(BuildOpts{Email: "x@y.z"})

	servers := cfg.Apps.HTTP.Servers
	// All three named servers must be present. Server names match
	// docker/bootstrap.json (srv_https / srv_http / srv_mgmt) so that
	// GetTLSStatus can probe the live config by the same key regardless of
	// whether Caddy is running the static bootstrap JSON or a Go-generated
	// config.
	for _, name := range []string{"srv_https", "srv_http", "srv_mgmt"} {
		if servers[name] == nil {
			t.Errorf("bootstrap config missing server %q", name)
		}
	}
	if servers["srv_https"].Listen[0] != ":443" {
		t.Errorf("srv_https listen: want :443, got %v", servers["srv_https"].Listen)
	}
	if servers["srv_http"].Listen[0] != ":80" {
		t.Errorf("srv_http listen: want :80, got %v", servers["srv_http"].Listen)
	}
	if servers["srv_mgmt"].Listen[0] != ":8080" {
		t.Errorf("srv_mgmt listen: want :8080, got %v", servers["srv_mgmt"].Listen)
	}

	// srv_http (:80) must redirect to HTTPS (301 + Location).
	httpRoutes := servers["srv_http"].Routes
	if len(httpRoutes) != 1 || httpRoutes[0].Handle[0].StatusCode != 301 {
		t.Fatalf("srv_http should have a single 301 redirect route, got %+v", httpRoutes)
	}
	loc := httpRoutes[0].Handle[0].Headers.Response.Set["Location"]
	if len(loc) != 1 || !strings.Contains(loc[0], "https://{host}{uri}") {
		t.Errorf("srv_http redirect Location mismatch: %v", loc)
	}

	// srv_mgmt (:8080) proxies /api/* and /_/* to pb, fallback to Astro.
	mgmt := servers["srv_mgmt"].Routes
	if len(mgmt) != 3 {
		t.Fatalf("srv_mgmt should have 3 routes, got %d", len(mgmt))
	}
	if mgmt[0].Handle[0].Upstreams[0].Dial != "127.0.0.1:8090" {
		t.Errorf("srv_mgmt[0] should dial pb, got %s", mgmt[0].Handle[0].Upstreams[0].Dial)
	}
	if mgmt[2].Handle[0].Upstreams[0].Dial != "127.0.0.1:4321" {
		t.Errorf("srv_mgmt fallback should dial Astro, got %s", mgmt[2].Handle[0].Upstreams[0].Dial)
	}
}

func TestBuildFullConfig(t *testing.T) {
	userRules := []UserRule{{
		ID:   "test-proxy",
		Type: "proxy",
		From: "/my/*",
		To:   "http://127.0.0.1:3000",
	}}

	cfg, err := BuildFullConfig(BuildOpts{Email: "x@y.z"}, userRules)
	if err != nil {
		t.Fatalf("BuildFullConfig: %v", err)
	}

	srvHTTPS := cfg.Apps.HTTP.Servers["srv_https"].Routes
	t.Logf("srv_https routes (%d):", len(srvHTTPS))
	for i, r := range srvHTTPS {
		t.Logf("  [%d] id=%s match=%v handler=%s", i, r.ID, matchPaths(r), handlerName(r))
	}

	// Expected order:
	//   [0] vanblog-system-api      /api/*       → pb (8090)
	//   [1] vanblog-system-pb-admin /_/*         → pb (8090)
	//   [2] vanblog-emoji-cache     /emoji-data  → Astro (4321, cache rule)
	//   [3] test-proxy              /my/*        → user upstream (3000)
	//   [4] vanblog-system-fallback (catch-all)  → Astro (4321)
	if len(srvHTTPS) != 5 {
		t.Fatalf("expected 5 routes on srv_https, got %d", len(srvHTTPS))
	}

	// 1. System API.
	if srvHTTPS[0].ID != systemAPIRouteID || srvHTTPS[0].Handle[0].Upstreams[0].Dial != "127.0.0.1:8090" {
		t.Errorf("[0] system api mismatch: %+v", srvHTTPS[0])
	}
	if matchPaths(srvHTTPS[0])[0] != "/api/*" {
		t.Errorf("[0] path mismatch: %v", matchPaths(srvHTTPS[0]))
	}

	// 2. System pb admin.
	if srvHTTPS[1].ID != systemAdminRouteID || srvHTTPS[1].Handle[0].Upstreams[0].Dial != "127.0.0.1:8090" {
		t.Errorf("[1] system pb-admin mismatch: %+v", srvHTTPS[1])
	}
	if matchPaths(srvHTTPS[1])[0] != "/_/*" {
		t.Errorf("[1] path mismatch: %v", matchPaths(srvHTTPS[1]))
	}

	// 3. System cache rules (emoji-data).
	if srvHTTPS[2].ID != "vanblog-emoji-cache" {
		t.Errorf("[2] expected emoji-cache, got %q", srvHTTPS[2].ID)
	}
	if srvHTTPS[2].Handle[0].Handler != "reverse_proxy" {
		t.Errorf("[2] cache should be reverse_proxy, got %s", srvHTTPS[2].Handle[0].Handler)
	}

	// 4. User rule.
	if srvHTTPS[3].ID != "test-proxy" {
		t.Errorf("[3] expected user rule test-proxy, got %q", srvHTTPS[3].ID)
	}
	if matchPaths(srvHTTPS[3])[0] != "/my/*" {
		t.Errorf("[3] path mismatch: %v", matchPaths(srvHTTPS[3]))
	}
	if srvHTTPS[3].Handle[0].Upstreams[0].Dial != "127.0.0.1:3000" {
		t.Errorf("[3] user dial mismatch: %s", srvHTTPS[3].Handle[0].Upstreams[0].Dial)
	}

	// 5. Fallback (no match → catch-all).
	if srvHTTPS[4].ID != systemFallbackID {
		t.Errorf("[4] expected fallback id %q, got %q", systemFallbackID, srvHTTPS[4].ID)
	}
	if len(srvHTTPS[4].Match) != 0 {
		t.Errorf("[4] fallback should have no match (catch-all), got %+v", srvHTTPS[4].Match)
	}
	if srvHTTPS[4].Handle[0].Upstreams[0].Dial != "127.0.0.1:4321" {
		t.Errorf("[4] fallback dial mismatch: %s", srvHTTPS[4].Handle[0].Upstreams[0].Dial)
	}
}

// TestBuildFullConfigSSRFSafety asserts that every dial in the generated
// config is inside DefaultAllowlist. This catches accidental injection of an
// external dial into a system route (e.g. via a future refactor that lets
// opts.AstroTarget come from an untrusted source).
func TestBuildFullConfigSSRFSafety(t *testing.T) {
	userRules := []UserRule{{
		ID:   "safe-proxy",
		Type: "proxy",
		From: "/ext/*",
		To:   "http://10.0.0.5:9000", // private network — allowed by default
	}}

	cfg, err := BuildFullConfig(BuildOpts{Email: "x@y.z"}, userRules)
	if err != nil {
		t.Fatalf("BuildFullConfig: %v", err)
	}

	for serverName, srv := range cfg.Apps.HTTP.Servers {
		for i, r := range srv.Routes {
			for j, h := range r.Handle {
				for k, up := range h.Upstreams {
					if !isDialInDefaultAllowlist(up.Dial) {
						t.Errorf("SSRF violation: server %s route[%d].handle[%d].upstreams[%d].dial = %q is NOT in DefaultAllowlist",
							serverName, i, j, k, up.Dial)
					}
				}
			}
		}
	}
}

// TestBuildFullConfigRejectsBadUserRule asserts that a user rule pointing at
// a cloud-metadata endpoint is rejected by TranslateAll → ValidateTarget,
// causing BuildFullConfig to return an error rather than emit an unsafe config.
func TestBuildFullConfigRejectsBadUserRule(t *testing.T) {
	bad := []UserRule{{
		ID:   "metadata-steal",
		Type: "proxy",
		From: "/leak/*",
		To:   "http://169.254.169.254/latest/meta-data/",
	}}
	if _, err := BuildFullConfig(BuildOpts{Email: "x@y.z"}, bad); err == nil {
		t.Fatal("expected BuildFullConfig to reject SSRF user rule, got nil error")
	}
}

// isDialInDefaultAllowlist checks whether the host:port in a Caddy upstream
// dial is inside DefaultAllowlist. Used by TestBuildFullConfigSSRFSafety.
// This mirrors ValidateTarget's IP check but operates on the dial format
// (host:port) that appears in the marshaled JSON, not a full URL.
func isDialInDefaultAllowlist(dial string) bool {
	// Strip port. Caddy dials are host:port (or host:port with IPv6 brackets).
	host := dial
	if idx := strings.LastIndex(dial, ":"); idx > 0 {
		host = dial[:idx]
	}
	host = strings.Trim(host, "[]")
	for _, allowed := range DefaultAllowlist {
		if matchHostOrCIDR(host, allowed) {
			return true
		}
	}
	return false
}

// matchHostOrCIDR checks whether host falls in a CIDR or matches a hostname
// pattern. Simplified version of ssrf.go's internal helpers, duplicated here
// to avoid exporting test-only helpers from the main package.
func matchHostOrCIDR(host, pattern string) bool {
	// "localhost" / literal hostname match.
	if host == "localhost" || host == pattern {
		return true
	}
	// CIDR check.
	if ip := net.ParseIP(host); ip != nil {
		if _, network, err := net.ParseCIDR(pattern); err == nil {
			return network.Contains(ip)
		}
	}
	return false
}

// matchPaths returns the path patterns for a route (helper for logging/asserts).
func matchPaths(r caddyadmin.Route) []string {
	if len(r.Match) == 0 {
		return nil
	}
	return r.Match[0].Path
}

// handlerName returns the handler module name for a route (helper).
func handlerName(r caddyadmin.Route) string {
	if len(r.Handle) == 0 {
		return ""
	}
	return r.Handle[0].Handler
}

// --- HTTPOnly-mode tests ---

func TestBuildBootstrapConfig_HTTPOnly_NoTLS(t *testing.T) {
	cfg := BuildBootstrapConfig(BuildOpts{HTTPOnly: true})

	if cfg.Apps.TLS != nil {
		t.Errorf("HTTPOnly bootstrap must not include apps.tls, got %+v", cfg.Apps.TLS)
	}
	if _, ok := cfg.Apps.HTTP.Servers[srvPlain]; !ok {
		t.Errorf("HTTPOnly bootstrap should define srv_plain, got servers=%v", serverNames(cfg.Apps.HTTP))
	}
	if _, ok := cfg.Apps.HTTP.Servers[srvHTTPS]; ok {
		t.Error("HTTPOnly bootstrap must not define srv_https")
	}
	if _, ok := cfg.Apps.HTTP.Servers[srvHTTP]; ok {
		t.Error("HTTPOnly bootstrap must not define srv_http redirect")
	}

	plain := cfg.Apps.HTTP.Servers[srvPlain]
	if len(plain.Listen) != 1 || plain.Listen[0] != ":80" {
		t.Errorf("srv_plain should listen on :80, got %v", plain.Listen)
	}
	if len(plain.Routes) != 1 || plain.Routes[0].ID != maintenanceRouteID {
		t.Errorf("srv_plain should host the maintenance route, got %+v", plain.Routes)
	}
}

func TestBuildFullConfig_HTTPOnly_NoTLS(t *testing.T) {
	cfg, err := BuildFullConfig(BuildOpts{HTTPOnly: true}, nil)
	if err != nil {
		t.Fatalf("BuildFullConfig HTTPOnly: %v", err)
	}

	if cfg.Apps.TLS != nil {
		t.Errorf("HTTPOnly full config must not include apps.tls, got %+v", cfg.Apps.TLS)
	}

	plain := cfg.Apps.HTTP.Servers[srvPlain]
	if plain == nil {
		t.Fatalf("srv_plain missing")
	}
	if len(plain.Listen) != 1 || plain.Listen[0] != ":80" {
		t.Errorf("srv_plain :80 listen wrong: %v", plain.Listen)
	}

	// Route order must mirror the HTTPS path:
	//   system API → system admin → system cache rules → (user rules — none here) → Astro fallback
	wantHead := []string{systemAPIRouteID, systemAdminRouteID}
	if len(plain.Routes) < len(wantHead)+1 {
		t.Fatalf("srv_plain route count too small: got %d (%+v)", len(plain.Routes), plain.Routes)
	}
	for i, want := range wantHead {
		if plain.Routes[i].ID != want {
			t.Errorf("route[%d].ID: want %q, got %q", i, want, plain.Routes[i].ID)
		}
	}
	if plain.Routes[len(plain.Routes)-1].ID != systemFallbackID {
		t.Errorf("last route should be %q, got %q", systemFallbackID, plain.Routes[len(plain.Routes)-1].ID)
	}

	// User rules land between system cache rules and Astro fallback.
	cfg2, _ := BuildFullConfig(BuildOpts{HTTPOnly: true}, []UserRule{{
		ID: "test-user", Type: "redirect", From: "/old/*", To: "/new/",
	}})
	plain2 := cfg2.Apps.HTTP.Servers[srvPlain]
	ids := routeIDs(plain2.Routes)
	found := false
	for i, id := range ids {
		if id == "test-user" && i < len(ids)-1 && ids[i+1] == systemFallbackID {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("user rule should sit immediately before fallback, got order: %v", ids)
	}
}

func routeIDs(routes []caddyadmin.Route) []string {
	out := make([]string, 0, len(routes))
	for _, r := range routes {
		out = append(out, r.ID)
	}
	return out
}

func serverNames(h *caddyadmin.HTTPApp) []string {
	out := make([]string, 0, len(h.Servers))
	for k := range h.Servers {
		out = append(out, k)
	}
	return out
}
