// Package commentssso implements a minimal OIDC-style SSO bridge for the
// Artalk comment system. It lets a logged-in VanBlog admin exchange their
// VanBlog session for a short-lived opaque token that Artalk's
// POST /api/v2/sso/exchange endpoint can then redeem via GET /userinfo.
//
// Why so minimal: Artalk's /sso/exchange does NOT validate the token itself
// (no JWT/JWKS verification) — it just forwards it as a Bearer token to
// {issuer}/userinfo and trusts the JSON response. So the token can be an
// opaque random string held in memory, with only the /userinfo endpoint
// needing to recognise it. No JWT, no keys, no discovery document.
//
// Enabled by VANBLOG_COMMENTS_SSO_ENABLED=1 (default off). The /token
// endpoint is admin-gated; /userinfo is unauthenticated by design (Artalk's
// server calls it), but only returns data for a valid unexpired token.
package commentssso

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

const (
	ssoIssueRoute    = "/api/vanblog/comments-sso/token"
	ssoUserinfoRoute = "/api/vanblog/comments-sso/userinfo"
	ssoTTL           = 60 * time.Second
	ssoEnabledEnv    = "VANBLOG_COMMENTS_SSO_ENABLED"
)

type tokenEntry struct {
	email     string
	name      string
	expiresAt time.Time
}

type tokenStore struct {
	mu    sync.Mutex
	items map[string]tokenEntry
}

func newTokenStore() *tokenStore {
	return &tokenStore{items: make(map[string]tokenEntry)}
}

func (s *tokenStore) put(token string, entry tokenEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for k, v := range s.items {
		if now.After(v.expiresAt) {
			delete(s.items, k)
		}
	}
	s.items[token] = entry
}

func (s *tokenStore) get(token string) (tokenEntry, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.items[token]
	if !ok || time.Now().After(entry.expiresAt) {
		return tokenEntry{}, false
	}
	return entry, true
}

type Manager struct {
	app   core.App
	store *tokenStore
}

func New(app core.App) *Manager {
	m := &Manager{app: app, store: newTokenStore()}
	if !enabled() {
		return m
	}
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST(ssoIssueRoute, m.handleIssueToken)
		se.Router.GET(ssoUserinfoRoute, m.handleUserinfo)
		return se.Next()
	})
	return m
}

func enabled() bool {
	v := os.Getenv(ssoEnabledEnv)
	return v == "1" || v == "true"
}

// requireAdmin mirrors the strict admin gate used elsewhere for destructive
// ops. The SSO bridge lets an admin impersonate themselves in Artalk, so it
// must be admin-only — not content-manager.
func requireAdmin(auth *core.Record) bool {
	return auth != nil && auth.GetString("role") == "admin"
}

func (m *Manager) handleIssueToken(e *core.RequestEvent) error {
	if !requireAdmin(e.Auth) {
		return e.ForbiddenError("admin role required", "")
	}
	email := e.Auth.GetString("email")
	if email == "" {
		return e.BadRequestError("admin account has no email address", "")
	}
	name := e.Auth.GetString("name")
	if name == "" {
		name = strings.Split(email, "@")[0]
	}
	token, err := generateToken()
	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to generate token"})
	}
	m.store.put(token, tokenEntry{
		email:     email,
		name:      name,
		expiresAt: time.Now().Add(ssoTTL),
	})
	return e.JSON(http.StatusOK, map[string]string{"token": token})
}

func (m *Manager) handleUserinfo(e *core.RequestEvent) error {
	token := bearerToken(e.Request)
	if token == "" {
		return e.UnauthorizedError("missing bearer token", "")
	}
	entry, ok := m.store.get(token)
	if !ok {
		return e.UnauthorizedError("invalid or expired token", "")
	}
	return e.JSON(http.StatusOK, map[string]any{
		"sub":            entry.email,
		"name":           entry.name,
		"email":          entry.email,
		"email_verified": true,
	})
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(h) > len(prefix) && strings.EqualFold(h[:len(prefix)], prefix) {
		return strings.TrimSpace(h[len(prefix):])
	}
	return ""
}
