package caddy

import (
	"testing"

	"github.com/cornworld/vanblog/utils/caddyadmin"
)

func TestValidateTarget_Loopback(t *testing.T) {
	cases := []string{
		"http://127.0.0.1:3000",
		"http://localhost:3000",
		"http://127.0.0.1:80",
		"https://127.0.0.1",
	}
	for _, url := range cases {
		if err := ValidateTarget(url, nil); err != nil {
			t.Errorf("expected %q to be allowed, got error: %v", url, err)
		}
	}
}

func TestValidateTarget_PrivateNetwork(t *testing.T) {
	cases := []string{
		"http://192.168.1.100:3000",
		"http://10.0.0.5:8080",
		"http://172.16.0.2:9090",
	}
	for _, url := range cases {
		if err := ValidateTarget(url, nil); err != nil {
			t.Errorf("expected %q to be allowed, got error: %v", url, err)
		}
	}
}

func TestValidateTarget_BlockedMetadata(t *testing.T) {
	cases := []string{
		"http://169.254.169.254/latest/meta-data/",
		"http://169.254.169.254/",
	}
	for _, url := range cases {
		if err := ValidateTarget(url, nil); err == nil {
			t.Errorf("expected %q to be BLOCKED (cloud metadata), but was allowed", url)
		}
	}
}

func TestValidateTarget_PublicIP(t *testing.T) {
	cases := []string{
		"http://8.8.8.8:80",
		"http://1.1.1.1",
		"http://203.0.113.5:443",
	}
	for _, url := range cases {
		if err := ValidateTarget(url, nil); err == nil {
			t.Errorf("expected %q to be BLOCKED (public IP), but was allowed", url)
		}
	}
}

func TestValidateTarget_InvalidScheme(t *testing.T) {
	if err := ValidateTarget("ftp://localhost", nil); err == nil {
		t.Error("expected ftp scheme to be rejected")
	}
	if err := ValidateTarget("file:///etc/passwd", nil); err == nil {
		t.Error("expected file scheme to be rejected")
	}
}

func TestValidateTarget_ExtraAllowlist(t *testing.T) {
	// Public hostname not in default allowlist
	if err := ValidateTarget("http://example.com:80", nil); err == nil {
		t.Error("expected public hostname to be rejected without allowlist")
	}

	// With allowlist
	if err := ValidateTarget("http://example.com:80", []string{"example.com"}); err != nil {
		t.Errorf("expected example.com to be allowed with allowlist, got: %v", err)
	}

	// Wildcard
	if err := ValidateTarget("http://api.example.com:80", []string{"*.example.com"}); err != nil {
		t.Errorf("expected wildcard match, got: %v", err)
	}
}

func TestValidateTarget_DockerHostnames(t *testing.T) {
	cases := []string{
		"http://my-service.docker:3000",
		"http://redis.svc.cluster.local:6379",
		"http://waline.orb.local:8360",
	}
	for _, url := range cases {
		if err := ValidateTarget(url, nil); err != nil {
			t.Errorf("expected %q to be allowed (container hostname), got: %v", url, err)
		}
	}
}

// --- Translator tests ---

func TestTranslate_Proxy(t *testing.T) {
	rule := UserRule{
		ID:   "test-proxy",
		Type: "proxy",
		From: "/api/internal/*",
		To:   "http://127.0.0.1:3000",
	}

	route, err := Translate(rule)
	if err != nil {
		t.Fatalf("Translate failed: %v", err)
	}

	if route.ID != "test-proxy" {
		t.Errorf("expected ID=test-proxy, got %s", route.ID)
	}
	if len(route.Match) != 1 || len(route.Match[0].Path) != 1 || route.Match[0].Path[0] != "/api/internal/*" {
		t.Errorf("match mismatch: %+v", route.Match)
	}
	if len(route.Handle) != 1 || route.Handle[0].Handler != "reverse_proxy" {
		t.Errorf("handler mismatch: %+v", route.Handle)
	}
	if len(route.Handle[0].Upstreams) != 1 || route.Handle[0].Upstreams[0].Dial != "127.0.0.1:3000" {
		t.Errorf("upstream mismatch: %+v", route.Handle[0].Upstreams)
	}
}

func TestTranslate_Redirect(t *testing.T) {
	rule := UserRule{
		ID:   "old-blog",
		Type: "redirect",
		From: "/old/*",
		To:   "https://new.example.com/",
		Code: 302,
	}

	route, err := Translate(rule)
	if err != nil {
		t.Fatalf("Translate failed: %v", err)
	}

	if route.Handle[0].StatusCode != 302 {
		t.Errorf("expected code 302, got %d", route.Handle[0].StatusCode)
	}
	if route.Handle[0].Headers.Response.Set["Location"][0] != "https://new.example.com/" {
		t.Errorf("location mismatch: %+v", route.Handle[0].Headers)
	}
}

func TestTranslate_Rewrite(t *testing.T) {
	rule := UserRule{
		ID:   "docs",
		Type: "rewrite",
		From: "/docs/*",
		To:   "/static/docs/*",
	}

	route, err := Translate(rule)
	if err != nil {
		t.Fatalf("Translate failed: %v", err)
	}

	if route.Handle[0].Handler != "rewrite" {
		t.Errorf("expected rewrite handler, got %s", route.Handle[0].Handler)
	}
	if route.Handle[0].URI != "/static/docs/*" {
		t.Errorf("expected URI /static/docs/*, got %s", route.Handle[0].URI)
	}
}

func TestTranslate_Block(t *testing.T) {
	rule := UserRule{
		ID:   "block-external-admin",
		Type: "block",
		From: "/admin/*",
	}

	route, err := Translate(rule)
	if err != nil {
		t.Fatalf("Translate failed: %v", err)
	}

	if route.Handle[0].StatusCode != 403 {
		t.Errorf("expected 403, got %d", route.Handle[0].StatusCode)
	}
}

func TestTranslate_UnknownType(t *testing.T) {
	rule := UserRule{Type: "fancy"}
	_, err := Translate(rule)
	if err == nil {
		t.Fatal("expected error for unknown type")
	}
}

func TestTranslateAll_ReservedPath(t *testing.T) {
	rules := []UserRule{{
		ID:   "hijack-api",
		Type: "proxy",
		From: "/api/*", // reserved!
		To:   "http://127.0.0.1:9999",
	}}

	_, err := TranslateAll(rules, nil)
	if err == nil {
		t.Fatal("expected error for reserved path conflict")
	}
}

func TestTranslateAll_SSRFCheck(t *testing.T) {
	rules := []UserRule{{
		ID:   "metadata-steal",
		Type: "proxy",
		From: "/my-api/*",
		To:   "http://169.254.169.254/latest/meta-data/",
	}}

	_, err := TranslateAll(rules, nil)
	if err == nil {
		t.Fatal("expected SSRF error for metadata endpoint")
	}
}

func TestTranslateAll_Valid(t *testing.T) {
	rules := []UserRule{
		{ID: "proxy1", Type: "proxy", From: "/internal/*", To: "http://127.0.0.1:3000"},
		{ID: "redirect1", Type: "redirect", From: "/old/*", To: "https://new.example.com/"},
	}

	routes, err := TranslateAll(rules, nil)
	if err != nil {
		t.Fatalf("TranslateAll failed: %v", err)
	}
	if len(routes) != 2 {
		t.Fatalf("expected 2 routes, got %d", len(routes))
	}

	// Verify route types
	if routes[0].Handle[0].Handler != "reverse_proxy" {
		t.Errorf("first route should be reverse_proxy, got %s", routes[0].Handle[0].Handler)
	}
	if routes[1].Handle[0].Handler != "static_response" {
		t.Errorf("second route should be static_response, got %s", routes[1].Handle[0].Handler)
	}
}

// --- Template tests ---

func TestRenderProdCaddyfile(t *testing.T) {
	output := RenderProdCaddyfile(TemplateOpts{
		Email:    "test@example.com",
		LogLevel: "debug",
	})

	// Check key elements exist
	contains := []string{
		"on_demand_tls",
		"test@example.com",
		"level debug",
		"reverse_proxy 127.0.0.1:8090",
		"file_server",
		"redir https://{host}{uri}",
	}
	for _, s := range contains {
		if !stringContains(output, s) {
			t.Errorf("prod Caddyfile missing %q", s)
		}
	}
}

func TestRenderDevCaddyfile(t *testing.T) {
	output := RenderDevCaddyfile(TemplateOpts{
		Email: "dev@test.com",
	})

	// Dev should proxy to Astro dev server
	contains := []string{
		"reverse_proxy 127.0.0.1:4321",
		"dev@test.com",
	}
	for _, s := range contains {
		if !stringContains(output, s) {
			t.Errorf("dev Caddyfile missing %q", s)
		}
	}

	// Dev should NOT have file_server as fallback
	if stringContains(output, "root * /app/dist\n\ttry_files") {
		t.Error("dev Caddyfile should not have file_server fallback (that's prod)")
	}
}

func TestRenderJSONConfig(t *testing.T) {
	output := RenderJSONConfig("0.0.0.0:2019", []string{"*"})
	if !stringContains(output, `"listen": "0.0.0.0:2019"`) {
		t.Errorf("JSON config missing listen: %s", output)
	}
	if !stringContains(output, `"origins": ["*"]`) {
		t.Errorf("JSON config missing origins: %s", output)
	}
}

func TestRenderJSONConfig_Defaults(t *testing.T) {
	output := RenderJSONConfig("", nil)
	if !stringContains(output, "0.0.0.0:2019") {
		t.Errorf("default bind missing: %s", output)
	}
}

// stringContains is a simple helper to avoid importing strings in test.
func stringContains(haystack, needle string) bool {
	return len(haystack) >= len(needle) && indexOf(haystack, needle) >= 0
}

func indexOf(haystack, needle string) int {
	for i := 0; i <= len(haystack)-len(needle); i++ {
		match := true
		for j := 0; j < len(needle); j++ {
			if haystack[i+j] != needle[j] {
				match = false
				break
			}
		}
		if match {
			return i
		}
	}
	return -1
}

// Ensure caddyadmin types compile
var _ caddyadmin.Route = caddyadmin.Route{}
