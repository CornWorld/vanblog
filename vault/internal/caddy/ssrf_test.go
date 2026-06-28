package caddy

// Tests for ssrf.go (ValidateTarget + DefaultAllowlist).

import "testing"

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
