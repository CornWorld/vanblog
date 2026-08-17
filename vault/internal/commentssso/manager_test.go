package commentssso

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func TestTokenStorePutGet(t *testing.T) {
	s := newTokenStore()
	s.put("tok1", tokenEntry{email: "a@b.c", name: "a", expiresAt: time.Now().Add(time.Minute)})
	got, ok := s.get("tok1")
	if !ok || got.email != "a@b.c" || got.name != "a" {
		t.Fatalf("get: got=%+v ok=%v", got, ok)
	}
}

func TestTokenStoreExpired(t *testing.T) {
	s := newTokenStore()
	s.put("tok1", tokenEntry{email: "a@b.c", expiresAt: time.Now().Add(-time.Second)})
	if _, ok := s.get("tok1"); ok {
		t.Fatal("expired token unexpectedly returned")
	}
}

func TestTokenStoreCleanupOnPut(t *testing.T) {
	s := newTokenStore()
	s.put("expired", tokenEntry{email: "x@y.z", expiresAt: time.Now().Add(-time.Second)})
	s.put("fresh", tokenEntry{email: "a@b.c", expiresAt: time.Now().Add(time.Minute)})
	if _, ok := s.get("expired"); ok {
		t.Fatal("expired token should have been cleaned up on put")
	}
	if _, ok := s.get("fresh"); !ok {
		t.Fatal("fresh token missing after cleanup")
	}
}

func TestBearerToken(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer abc123")
	if got := bearerToken(r); got != "abc123" {
		t.Fatalf("got %q, want abc123", got)
	}
}

func TestBearerTokenMissing(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	if got := bearerToken(r); got != "" {
		t.Fatalf("expected empty, got %q", got)
	}
}

func TestGenerateToken(t *testing.T) {
	a, err := generateToken()
	if err != nil {
		t.Fatal(err)
	}
	b, err := generateToken()
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("tokens should be unique")
	}
	if len(a) != 64 { // 32 random bytes hex-encoded
		t.Fatalf("unexpected token length %d", len(a))
	}
}

func TestEnabled(t *testing.T) {
	old := os.Getenv(ssoEnabledEnv)
	defer os.Setenv(ssoEnabledEnv, old)

	os.Unsetenv(ssoEnabledEnv)
	if enabled() {
		t.Fatal("should be disabled by default")
	}
	os.Setenv(ssoEnabledEnv, "1")
	if !enabled() {
		t.Fatal("should be enabled with 1")
	}
	os.Setenv(ssoEnabledEnv, "true")
	if !enabled() {
		t.Fatal("should be enabled with true")
	}
	os.Setenv(ssoEnabledEnv, "0")
	if enabled() {
		t.Fatal("should be disabled with 0")
	}
}
