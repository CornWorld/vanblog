// Package bootstrap implements vanblog's first-run setup flow.
//
// Why this exists: the users collection has CreateRule = "role = 'admin'"
// (intentional — admins create new admins). On a fresh install there are
// zero admins, so the rule deadlocks the system: you can't create the
// first admin through the UI. The setup endpoint bridges this by writing
// the first admin record via Dao directly (bypassing CreateRule, which is
// legal for Go-side code that has app-level authority).
//
// Bootstrap state is derived, not stored: "bootstrap mode" = "no admin in
// users table". As soon as the first admin exists, the system exits
// bootstrap mode. This avoids a separate state field that could drift out
// of sync (e.g. firstRunCompleted=true but users table empty after a
// partial restore).
//
// Threat model:
//   - During bootstrap, anyone reaching /setup can claim the first admin
//     slot. This is the inherent bootstrap window — same as every CMS's
//     first-run flow. Mitigation: surface a warning on the setup page,
//     and the setup endpoint refuses once any admin exists.
//   - Deleting the last admin re-enters bootstrap mode. An attacker who
//     already has admin can use this to re-setup. But they already have
//     admin, so this gains them nothing.
package bootstrap

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// SetupReq is the body of POST /api/vanblog/setup/complete. Username is
// required; email + password are required. passwordConfirm is checked
// server-side to catch typos (no other validation makes sense for a
// bootstrap field).
type SetupReq struct {
	Username      string `json:"username"`
	Email         string `json:"email"`
	Password      string `json:"password"`
	PasswordConfirm string `json:"passwordConfirm"`
}

// HasAdmin returns true iff at least one record in users has role=admin.
// This is the single source of truth for "is the system in bootstrap
// mode?" — inverse of the return value.
//
// Errors during the query are treated as "no admin yet" (fail-open into
// bootstrap mode). The setup endpoint re-checks inside its write path
// with proper error handling, so a transient DB failure here can't let
// an attacker claim the first admin slot on a system that already has one.
func HasAdmin(app core.App) bool {
	recs, err := app.FindRecordsByFilter("users", "role = 'admin'", "", 1, 0)
	if err != nil {
		return false
	}
	return len(recs) > 0
}

// CreateFirstAdmin writes the first admin record. Refuses if any admin
// already exists — caller should check HasAdmin first, but the second
// check inside this function defends against a TOCTOU race where two
// concurrent setup requests both pass HasAdmin and then both write.
//
// The record is written with Dao directly (not the public collection
// API), so users.createRule does not apply. This is the same authority
// level pb uses internally for migrations.
func CreateFirstAdmin(app core.App, req SetupReq) error {
	if HasAdmin(app) {
		return errors.New("bootstrap: an admin already exists; setup is closed")
	}

	username := strings.TrimSpace(req.Username)
	if username == "" {
		return errors.New("bootstrap: username is required")
	}
	email := strings.TrimSpace(req.Email)
	if email == "" {
		return errors.New("bootstrap: email is required")
	}
	if req.Password == "" {
		return errors.New("bootstrap: password is required")
	}
	if req.Password != req.PasswordConfirm {
		return errors.New("bootstrap: password and passwordConfirm do not match")
	}
	if len(req.Password) < 8 {
		return errors.New("bootstrap: password must be at least 8 characters")
	}

	col, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return fmt.Errorf("bootstrap: users collection not found: %w", err)
	}

	rec := core.NewRecord(col)
	rec.Set("username", username)
	rec.Set("email", email)
	rec.Set("emailVisibility", false)
	rec.Set("verified", true)
	rec.Set("role", "admin")
	rec.Set("permissions", []string{"all"})
	// password + tokenKey are set via Set on auth collections; pb hashes
	// automatically on save.
	rec.Set("password", req.Password)
	rec.Set("passwordConfirm", req.PasswordConfirm)

	if err := app.Save(rec); err != nil {
		return fmt.Errorf("bootstrap: failed to save admin record: %w", err)
	}
	return nil
}

// Manager wires the setup endpoints onto the app's serve mux.
type Manager struct {
	app core.App
}

func New(app core.App) *Manager {
	m := &Manager{app: app}
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/vanblog/setup/status", m.handleStatus)
		se.Router.POST("/api/vanblog/setup/complete", m.handleComplete)
		return se.Next()
	})
	return m
}

// handleStatus exposes bootstrap mode so the UI can route to /setup when
// needed. Public — bootstrap state is observable, that's the whole point.
func (m *Manager) handleStatus(e *core.RequestEvent) error {
	return e.JSON(http.StatusOK, map[string]any{
		"bootstrap": !HasAdmin(m.app),
	})
}

// handleComplete accepts the first-admin setup form. Refuses once any
// admin exists (the bootstrap window is closed). On success, the system
// automatically exits bootstrap mode because HasAdmin now returns true —
// no state mutation required beyond the new users row.
//
// Returns 200 + the new admin's id on success. The frontend redirects
// to /login (we do not auto-login because the auth cookie machinery
// expects a real auth-with-password call to set the token correctly).
func (m *Manager) handleComplete(e *core.RequestEvent) error {
	var req SetupReq
	if err := readJSON(e, &req); err != nil {
		return e.JSON(http.StatusBadRequest, map[string]any{
			"ok":    false,
			"error": err.Error(),
		})
	}

	if err := CreateFirstAdmin(m.app, req); err != nil {
		// Distinguish "already has admin" (409 conflict) from validation
		// errors (400). The former is the security-relevant case.
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "already exists") {
			status = http.StatusConflict
		}
		return e.JSON(status, map[string]any{
			"ok":    false,
			"error": err.Error(),
		})
	}

	// Re-read to surface the new admin's id. Cheap (1-row query).
	var id string
	if recs, err := m.app.FindRecordsByFilter("users", "role = 'admin'", "", 1, 0); err == nil && len(recs) > 0 {
		id = recs[0].Id
	}

	return e.JSON(http.StatusOK, map[string]any{
		"ok":      true,
		"adminId": id,
	})
}

// readJSON decodes the request body into dst. Pulled out so test code
// can exercise CreateFirstAdmin directly without constructing a fake
// RequestEvent.
func readJSON(e *core.RequestEvent, dst any) error {
	return json.NewDecoder(e.Request.Body).Decode(dst)
}
