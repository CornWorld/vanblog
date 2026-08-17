package commentssso

import (
	"net/http"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// TestUserinfoEndpoint exercises the /userinfo HTTP handler that Artalk's
// /sso/exchange calls. It does not need a real admin auth record — the
// handler only validates the opaque bearer token against the in-memory store.
func TestUserinfoEndpoint(t *testing.T) {
	scenarios := []tests.ApiScenario{
		{
			Name:           "valid token returns verified identity",
			Method:         http.MethodGet,
			URL:            ssoUserinfoRoute,
			Headers:        map[string]string{"Authorization": "Bearer valid-token"},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"email":"admin@example.com"`,
				`"name":"admin"`,
				`"email_verified":true`,
			},
		},
		{
			Name:            "missing bearer token",
			Method:          http.MethodGet,
			URL:             ssoUserinfoRoute,
			ExpectedStatus:  401,
			ExpectedContent: []string{`"status":401`},
		},
		{
			Name:            "invalid bearer token",
			Method:          http.MethodGet,
			URL:             ssoUserinfoRoute,
			Headers:         map[string]string{"Authorization": "Bearer does-not-exist"},
			ExpectedStatus:  401,
			ExpectedContent: []string{`"status":401`},
		},
		{
			Name:            "expired bearer token",
			Method:          http.MethodGet,
			URL:             ssoUserinfoRoute,
			Headers:         map[string]string{"Authorization": "Bearer expired-token"},
			ExpectedStatus:  401,
			ExpectedContent: []string{`"status":401`},
		},
	}

	for _, scenario := range scenarios {
		scenario := scenario
		scenario.BeforeTestFunc = func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
			mgr := &Manager{app: app, store: newTokenStore()}
			mgr.store.put("valid-token", tokenEntry{
				email:     "admin@example.com",
				name:      "admin",
				expiresAt: time.Now().Add(time.Minute),
			})
			mgr.store.put("expired-token", tokenEntry{
				email:     "expired@example.com",
				name:      "expired",
				expiresAt: time.Now().Add(-time.Second),
			})
			e.Router.GET(ssoUserinfoRoute, mgr.handleUserinfo)
		}
		scenario.Test(t)
	}
}

// TestIssueTokenRequiresAdmin ensures the token-issuing endpoint is gated.
// Without an Authorization header e.Auth is nil, so requireAdmin must reject.
func TestIssueTokenRequiresAdmin(t *testing.T) {
	scenario := tests.ApiScenario{
		Name:            "unauthenticated is forbidden",
		Method:          http.MethodPost,
		URL:             ssoIssueRoute,
		ExpectedStatus:  403,
		ExpectedContent: []string{`"status":403`},
		BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
			mgr := &Manager{app: app, store: newTokenStore()}
			e.Router.POST(ssoIssueRoute, mgr.handleIssueToken)
		},
	}
	scenario.Test(t)
}
