package caddyadmin

import (
	"encoding/json"
	"strings"
	"testing"
)

// TestConfigMarshalRoundTrip builds a Config that mirrors the semantics of
// docker/Caddyfile.prod (admin bind / on_demand_tls / storage / three servers:
// HTTPS / HTTP redirect / management port) and verifies:
//  1. It marshals to valid JSON without error.
//  2. The JSON round-trips back to an equivalent Config.
//  3. The marshaled JSON does NOT contain the insecure origins ["*"] value
//     (zero-trust default — admin API must never be exposed to the network).
func TestConfigMarshalRoundTrip(t *testing.T) {
	persist := false
	cfg := &Config{
		Admin: &AdminConfig{
			Listen:  "127.0.0.1:2019",
			Origins: []string{"127.0.0.1"},
			Persist: &persist,
		},
		Logs: &LogsConfig{
			Logs: map[string]LogEntry{
				"default": {
					Writer: &LogWriter{
						Output:   "file",
						Filename: "/var/log/caddy.log",
					},
					Level: "WARN",
				},
			},
		},
		Storage: &Storage{
			Module: "file_system",
			Root:   "/data/caddy",
		},
		Apps: &Apps{
			HTTP: &HTTPApp{
				Servers: map[string]*Server{
					// HTTPS server (:443) — main site with on-demand TLS.
					"srv0": {
						Listen: []string{":443"},
						Routes: []Route{
							{
								ID: "api-proxy",
								Match: []MatchRule{{
									Path: []string{"/api/*"},
								}},
								Handle: []Handler{{
									Handler:   "reverse_proxy",
									Upstreams: []Upstream{{Dial: "127.0.0.1:8090"}},
								}},
							},
							{
								ID: "pb-admin",
								Match: []MatchRule{{
									Path: []string{"/_/*"},
								}},
								Handle: []Handler{{
									Handler:   "reverse_proxy",
									Upstreams: []Upstream{{Dial: "127.0.0.1:8090"}},
								}},
							},
							{
								// Astro SSR fallback
								Handle: []Handler{{
									Handler:   "reverse_proxy",
									Upstreams: []Upstream{{Dial: "127.0.0.1:4321"}},
								}},
							},
						},
					},
					// HTTP redirect server (:80) — redirects everything to HTTPS.
					"srv1": {
						Listen: []string{":80"},
						ListenerWrappers: []ListenerWrapper{
							{Wrapper: "http_redirect"},
						},
					},
					// Management port (:8080) — plain HTTP admin access.
					"srv_mgmt": {
						Listen: []string{":8080"},
						Routes: []Route{
							{
								Match: []MatchRule{{Path: []string{"/api/*"}}},
								Handle: []Handler{{
									Handler:   "reverse_proxy",
									Upstreams: []Upstream{{Dial: "127.0.0.1:8090"}},
								}},
							},
							{
								Match: []MatchRule{{Path: []string{"/_/*"}}},
								Handle: []Handler{{
									Handler:   "reverse_proxy",
									Upstreams: []Upstream{{Dial: "127.0.0.1:8090"}},
								}},
							},
							{
								Handle: []Handler{{
									Handler:   "reverse_proxy",
									Upstreams: []Upstream{{Dial: "127.0.0.1:4321"}},
								}},
							},
						},
					},
				},
			},
			TLS: &TLSApp{
				Automation: &Automation{
					OnDemand: &OnDemandTLS{
						Ask: "http://127.0.0.1:8090/api/hooks/caddy/ask",
					},
					Policies: []AutomationPolicy{{
						OnDemand: true,
						Issuers: []Issuer{{
							Module: "acme",
							Email:  "admin@example.com",
						}},
					}},
				},
			},
		},
	}

	// 1. Marshal via the convenience method.
	data, err := cfg.JSON()
	if err != nil {
		t.Fatalf("Config.JSON() failed: %v", err)
	}

	jsonStr := string(data)
	t.Logf("marshaled config:\n%s", jsonStr)

	// 2. Security assertion: zero-trust default — origins must NEVER be ["*"].
	// This would expose the Caddy admin API to the network and is a remote
	// takeover vector.
	if strings.Contains(jsonStr, `"origins":["*"]`) {
		t.Fatal("SECURITY: marshaled config contains insecure origins [\"*\"] — admin API would be exposed to the network")
	}

	// 3. Round-trip: unmarshal back and verify key fields survived.
	var back Config
	if err := json.Unmarshal(data, &back); err != nil {
		t.Fatalf("round-trip unmarshal failed: %v", err)
	}
	if back.Admin == nil || back.Admin.Listen != "127.0.0.1:2019" {
		t.Fatalf("round-trip: admin.listen mismatch: %+v", back.Admin)
	}
	if back.Storage == nil || back.Storage.Root != "/data/caddy" {
		t.Fatalf("round-trip: storage.root mismatch: %+v", back.Storage)
	}
	if back.Apps == nil || back.Apps.HTTP == nil || back.Apps.TLS == nil {
		t.Fatalf("round-trip: apps missing http or tls: %+v", back.Apps)
	}
	if len(back.Apps.HTTP.Servers) != 3 {
		t.Fatalf("round-trip: expected 3 HTTP servers, got %d", len(back.Apps.HTTP.Servers))
	}
	srv0 := back.Apps.HTTP.Servers["srv0"]
	if srv0 == nil || len(srv0.Listen) != 1 || srv0.Listen[0] != ":443" {
		t.Fatalf("round-trip: srv0.listen mismatch: %+v", srv0)
	}
	if len(srv0.Routes) != 3 {
		t.Fatalf("round-trip: srv0 expected 3 routes, got %d", len(srv0.Routes))
	}
	srv1 := back.Apps.HTTP.Servers["srv1"]
	if srv1 == nil || len(srv1.ListenerWrappers) != 1 || srv1.ListenerWrappers[0].Wrapper != "http_redirect" {
		t.Fatalf("round-trip: srv1 http_redirect wrapper mismatch: %+v", srv1)
	}
	if back.Apps.TLS.Automation == nil ||
		back.Apps.TLS.Automation.OnDemand == nil ||
		back.Apps.TLS.Automation.OnDemand.Ask != "http://127.0.0.1:8090/api/hooks/caddy/ask" {
		t.Fatalf("round-trip: on_demand.ask mismatch: %+v", back.Apps.TLS.Automation)
	}
	if len(back.Apps.TLS.Automation.Policies) != 1 || !back.Apps.TLS.Automation.Policies[0].OnDemand {
		t.Fatalf("round-trip: automation policy mismatch: %+v", back.Apps.TLS.Automation.Policies)
	}
}

// TestConfigEmptyOmitsFields verifies that an empty Config marshals to a clean
// "{}" rather than leaking null/empty fields. This is what makes the pointer
// + omitempty design worthwhile — callers can build configs incrementally and
// only the fields they set appear in the output.
func TestConfigEmptyOmitsFields(t *testing.T) {
	cfg := &Config{}
	data, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}
	if string(data) != "{}" {
		t.Fatalf("empty Config should marshal to {}, got: %s", string(data))
	}
}

// TestConfigJSONMethodEquivalence verifies that Config.JSON() and
// json.Marshal(*Config) produce identical output. The method is documented as
// a convenience wrapper; callers must not be surprised by a difference.
func TestConfigJSONMethodEquivalence(t *testing.T) {
	cfg := &Config{
		Admin: &AdminConfig{
			Listen:  "127.0.0.1:2019",
			Origins: []string{"127.0.0.1"},
		},
	}
	viaMethod, err := cfg.JSON()
	if err != nil {
		t.Fatalf("Config.JSON() failed: %v", err)
	}
	viaStdlib, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}
	if string(viaMethod) != string(viaStdlib) {
		t.Fatalf("Config.JSON() and json.Marshal disagree:\n method: %s\n stdlib: %s", viaMethod, viaStdlib)
	}
}

// TestAdminConfigOriginsRequired is a documentation-as-test reminder that
// Origins should be an explicit allowlist. The struct itself doesn't enforce
// this (omitempty allows nil), but this test pins the convention: when Origins
// IS set, it must not contain "*".
func TestAdminConfigOriginsRequired(t *testing.T) {
	admin := &AdminConfig{
		Listen:  "127.0.0.1:2019",
		Origins: []string{"127.0.0.1", "::1"},
	}
	data, err := json.Marshal(admin)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}
	if strings.Contains(string(data), `"*"`) {
		t.Fatal("admin.origins must never contain \"*\"")
	}
}
