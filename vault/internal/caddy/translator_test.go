package caddy

// Tests for translator.go (Translate / TranslateAll / ReservedPaths).

import "testing"

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
	// redirect's static_response Headers uses HeaderPolicy with Response.Set
	// producing nested {"response":{"set":{...}}} JSON, matching bootstrap.json.
	hp := route.Handle[0].Headers
	if hp == nil || hp.Response == nil || hp.Response.Set == nil {
		t.Fatalf("expected Headers.Response.Set to be populated, got %+v", hp)
	}
	loc := hp.Response.Set["Location"]
	if len(loc) == 0 || loc[0] != "https://new.example.com/" {
		t.Errorf("location mismatch: %+v", loc)
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
