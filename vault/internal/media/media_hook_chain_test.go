package media

import (
	"net/http"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// TestSiteUpdatePersistsThroughStripHook pins the site request-hook chain
// contract over the real HTTP path: stripSiteSecrets (bound to
// OnRecordCreateRequest/UpdateRequest("site")) must call e.Next() after
// parking secrets. A Request hook that stops short-circuits pb's default
// handler — the client gets 200 with an EMPTY body and nothing is persisted.
//
// Regression context: 2026-09-16 — found by the container e2e journey's
// theme-switch assertions (site.activeTheme updates never landed). Every
// admin site-settings save was silently lost while the UI showed success.
// The earlier s3_sync_test exercised MoveSecretsFromRecord directly,
// bypassing the hook binding, so the missing Next() stayed invisible.
func TestSiteUpdatePersistsThroughStripHook(t *testing.T) {
	var token, siteID string
	// Single prepared instance: the scenario's static URL/Headers need the
	// site record id and a superuser token, both of which only exist after
	// migrations + seeding — so prep happens here and the factory hands back
	// this same app instance.
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("test app: %v", err)
	}
	// Vault migrations create the `site` + `site_secrets` collections the
	// hook (and MoveSecretsFromRecord) depend on.
	if err := app.RunAppMigrations(); err != nil {
		app.Cleanup()
		t.Fatalf("vault migrations: %v", err)
	}
	suCol, err := app.FindCachedCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		app.Cleanup()
		t.Fatalf("superusers collection: %v", err)
	}
	su := core.NewRecord(suCol)
	su.Set("email", "hookchain@vanblog.test")
	su.Set("password", "0123456789abc")
	if err := app.Save(su); err != nil {
		app.Cleanup()
		t.Fatalf("seed superuser: %v", err)
	}
	token, err = su.NewAuthToken()
	if err != nil {
		app.Cleanup()
		t.Fatalf("superuser token: %v", err)
	}
	siteRec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil {
		app.Cleanup()
		t.Fatalf("find site record: %v", err)
	}
	siteID = siteRec.Id

	scenario := tests.ApiScenario{
		Name:   "site PATCH persists (stripSiteSecrets must not short-circuit the chain)",
		Method: http.MethodPatch,
		URL:    "/api/collections/site/records/" + siteID,
		Body:   strings.NewReader(`{"author":"persisted-probe"}`),
		Headers: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": token,
		},
		TestAppFactory: func(t testing.TB) *tests.TestApp {
			return app
		},
		BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
			New(app) // production hook binding, mirroring main.go
		},
		ExpectedStatus: 200,
		// Old code: hook stopped the chain → pb answered 200 with an empty
		// body, so the expected record JSON is exactly what distinguishes
		// the fixed chain from the short-circuited one.
		ExpectedContent: []string{`"author":"persisted-probe"`},
		AfterTestFunc: func(t testing.TB, app *tests.TestApp, res *http.Response) {
			rec, err := app.FindFirstRecordByFilter("site", "")
			if err != nil {
				t.Fatalf("reload site record: %v", err)
			}
			if got := rec.GetString("author"); got != "persisted-probe" {
				t.Fatalf("site.author not persisted, got %q — request hook short-circuited the chain", got)
			}
		},
	}
	scenario.Test(t)
}
