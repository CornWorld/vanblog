package bootstrap

// bootstrap_test.go covers the first-run setup logic.
//
// Strategy: reuse setupApp from site_test.go (real pb + migrations). The
// setup endpoints themselves are HTTP shims; we exercise CreateFirstAdmin
// + HasAdmin directly. Handler-level tests would need a fake RequestEvent
// which the caddy package already documented as broken.

import (
	"errors"
	"strings"
	"testing"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func setupApp(t *testing.T) core.App {
	t.Helper()
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migration: %v", err)
	}
	return app
}

// freshApp returns an app guaranteed to be in bootstrap mode (no admin
// in users). The migrations create an empty users collection, so the
// state after setupApp IS bootstrap mode by construction. This helper
// exists purely for readability at call sites.
func freshApp(t *testing.T) core.App {
	t.Helper()
	app := setupApp(t)
	if HasAdmin(app) {
		t.Fatalf("test fixture: users table already has an admin?")
	}
	return app
}

func TestHasAdmin_FreshInstallIsBootstrap(t *testing.T) {
	app := freshApp(t)
	if HasAdmin(app) != false {
		t.Errorf("fresh install should be in bootstrap mode")
	}
}

func TestCreateFirstAdmin_SucceedsAndExitsBootstrap(t *testing.T) {
	app := freshApp(t)

	err := CreateFirstAdmin(app, SetupReq{
		Username:        "admin",
		Email:           "admin@example.com",
		Password:        "password123",
		PasswordConfirm: "password123",
	})
	if err != nil {
		t.Fatalf("CreateFirstAdmin: %v", err)
	}

	if !HasAdmin(app) {
		t.Errorf("after successful setup, HasAdmin should be true")
	}

	// Verify the record has the right fields.
	recs, _ := app.FindRecordsByFilter("users", "role = 'admin'", "", 1, 0)
	if len(recs) != 1 {
		t.Fatalf("expected 1 admin record, got %d", len(recs))
	}
	rec := recs[0]
	if rec.GetString("username") != "admin" {
		t.Errorf("username mismatch: %q", rec.GetString("username"))
	}
	if rec.GetString("role") != "admin" {
		t.Errorf("role mismatch: %q", rec.GetString("role"))
	}
	perms := rec.GetStringSlice("permissions")
	if len(perms) != 1 || perms[0] != "all" {
		t.Errorf("permissions mismatch: %+v", perms)
	}
}

func TestCreateFirstAdmin_RefusesAfterFirstAdmin(t *testing.T) {
	app := freshApp(t)

	// First setup succeeds.
	if err := CreateFirstAdmin(app, SetupReq{
		Username: "admin", Email: "a@x.com",
		Password: "password123", PasswordConfirm: "password123",
	}); err != nil {
		t.Fatalf("first setup: %v", err)
	}

	// Second setup must refuse — the bootstrap window is closed.
	err := CreateFirstAdmin(app, SetupReq{
		Username: "attacker", Email: "b@x.com",
		Password: "password123", PasswordConfirm: "password123",
	})
	if err == nil {
		t.Fatalf("second setup should have failed")
	}
	if !strings.Contains(err.Error(), "already exists") {
		t.Errorf("expected 'already exists' error, got %q", err.Error())
	}

	// And critically, no second admin got created.
	recs, _ := app.FindRecordsByFilter("users", "role = 'admin'", "", 100, 0)
	if len(recs) != 1 {
		t.Errorf("expected 1 admin (no attacker added), got %d", len(recs))
	}
}

func TestCreateFirstAdmin_ValidationErrors(t *testing.T) {
	cases := []struct {
		name string
		req  SetupReq
		want string
	}{
		{"empty username", SetupReq{Email: "a@x.com", Password: "password123", PasswordConfirm: "password123"}, "username"},
		{"empty email", SetupReq{Username: "a", Password: "password123", PasswordConfirm: "password123"}, "email"},
		{"empty password", SetupReq{Username: "a", Email: "a@x.com", PasswordConfirm: "password123"}, "password"},
		{"password too short", SetupReq{Username: "a", Email: "a@x.com", Password: "short", PasswordConfirm: "short"}, "8 characters"},
		{"password mismatch", SetupReq{Username: "a", Email: "a@x.com", Password: "password123", PasswordConfirm: "different"}, "do not match"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app := freshApp(t)
			err := CreateFirstAdmin(app, tc.req)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Errorf("want error containing %q, got %v", tc.want, err)
			}
			// Validation failure must not leave a record behind.
			if HasAdmin(app) {
				t.Errorf("validation failure should not create admin")
			}
		})
	}
}

func TestCreateFirstAdmin_TrimsWhitespace(t *testing.T) {
	app := freshApp(t)
	err := CreateFirstAdmin(app, SetupReq{
		Username:        "  admin  ",
		Email:           "  admin@example.com  ",
		Password:        "password123",
		PasswordConfirm: "password123",
	})
	if err != nil {
		t.Fatalf("CreateFirstAdmin: %v", err)
	}
	recs, _ := app.FindRecordsByFilter("users", "role = 'admin'", "", 1, 0)
	if len(recs) != 1 {
		t.Fatalf("expected 1 admin, got %d", len(recs))
	}
	if recs[0].GetString("username") != "admin" {
		t.Errorf("username should be trimmed, got %q", recs[0].GetString("username"))
	}
	if recs[0].GetString("email") != "admin@example.com" {
		t.Errorf("email should be trimmed, got %q", recs[0].GetString("email"))
	}
}

func TestHasAdmin_HandlesDBError(t *testing.T) {
	// Construct a minimal app that has no migrations run — querying the
	// users table will fail. HasAdmin must fail-open into bootstrap mode
	// rather than panic. This is the safe default: a broken DB should not
	// silently claim "bootstrap is closed" and lock the operator out.
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	// Don't run migrations — users table doesn't exist yet.
	if HasAdmin(app) != false {
		t.Errorf("DB error should fail-open to bootstrap=false")
	}
}

func TestErrorsArePlainErrors(t *testing.T) {
	// Sanity: errors returned to callers are plain errors, not wrapped
	// multiple times. The handler-level HTTP status mapping in
	// handleComplete matches on substring "already exists", so this test
	// guards that contract.
	app := freshApp(t)
	_ = CreateFirstAdmin(app, SetupReq{
		Username: "admin", Email: "a@x.com",
		Password: "password123", PasswordConfirm: "password123",
	})
	err := CreateFirstAdmin(app, SetupReq{
		Username: "b", Email: "b@x.com",
		Password: "password123", PasswordConfirm: "password123",
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if errors.Unwrap(err) != nil {
		t.Errorf("expected unwrapped error for the already-exists case, got %+v", err)
	}
}
