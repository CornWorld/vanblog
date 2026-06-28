package caddy

// Tests for cache.go (SystemCacheRules + the "cache" UserRule type).

import "testing"

func TestTranslate_Cache(t *testing.T) {
	rule := UserRule{
		ID:      "cache-emoji",
		Type:    "cache",
		From:    "/emoji-data.json",
		Headers: map[string]string{"Cache-Control": CacheImmutable},
	}

	route, err := Translate(rule)
	if err != nil {
		t.Fatalf("Translate failed: %v", err)
	}

	if route.ID != "cache-emoji" {
		t.Errorf("expected ID cache-emoji, got %s", route.ID)
	}
	if len(route.Handle) != 1 || route.Handle[0].Handler != "reverse_proxy" {
		t.Errorf("expected single reverse_proxy handler (cache wraps proxy for header_down), got %+v", route.Handle)
	}
	if len(route.Handle[0].Upstreams) != 1 || route.Handle[0].Upstreams[0].Dial != "127.0.0.1:4321" {
		t.Errorf("expected upstream 127.0.0.1:4321, got %+v", route.Handle[0].Upstreams)
	}
	hp := route.Handle[0].Headers
	if hp == nil {
		t.Fatalf("expected Headers to be non-nil for reverse_proxy cache")
	}
	if hp.Response == nil {
		t.Fatal("expected Response header policy on the reverse_proxy")
	}
	got := hp.Response.Set["Cache-Control"]
	if len(got) != 1 || got[0] != CacheImmutable {
		t.Errorf("expected Cache-Control=%q, got %v", CacheImmutable, got)
	}
	if len(route.Match) != 1 || len(route.Match[0].Path) != 1 || route.Match[0].Path[0] != "/emoji-data.json" {
		t.Errorf("expected match on /emoji-data.json, got %+v", route.Match)
	}
}

func TestTranslate_Cache_NoHeaders(t *testing.T) {
	rule := UserRule{ID: "empty-cache", Type: "cache", From: "/x"}
	if _, err := Translate(rule); err == nil {
		t.Fatal("expected error for cache rule without headers")
	}
}

func TestSystemCacheRules_AppliesInTranslateAll(t *testing.T) {
	rules := SystemCacheRules()
	if len(rules) == 0 {
		t.Fatal("expected at least one system cache rule")
	}

	routes, err := TranslateAll(rules, nil)
	if err != nil {
		t.Fatalf("TranslateAll(system) failed: %v", err)
	}
	if len(routes) != len(rules) {
		t.Fatalf("expected %d routes, got %d", len(rules), len(routes))
	}

	// Cache rules terminate (they own the reverse_proxy for the matched path),
	// so we just sanity-check the handler kind.
	for _, r := range routes {
		if len(r.Handle) != 1 || r.Handle[0].Handler != "reverse_proxy" {
			t.Errorf("system cache route %s should be reverse_proxy, got %+v", r.ID, r.Handle)
		}
	}
}
