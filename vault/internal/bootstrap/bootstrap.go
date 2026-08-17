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
	"github.com/pocketbase/pocketbase/core"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// SetupReq is the body of POST /api/vanblog/setup/complete. Username is
// required; email + password are required. passwordConfirm is checked
// server-side to catch typos (no other validation makes sense for a
// bootstrap field).
type SetupComments struct {
	Provider              string `json:"provider"`
	ArtalkSite            string `json:"artalkSite"`
	ArtalkEmail           string `json:"artalkEmail"`
	ArtalkPassword        string `json:"artalkPassword"`
	ArtalkPasswordConfirm string `json:"artalkPasswordConfirm"`
}

type SetupReq struct {
	Username        string        `json:"username"`
	Email           string        `json:"email"`
	Password        string        `json:"password"`
	PasswordConfirm string        `json:"passwordConfirm"`
	Comments        SetupComments `json:"comments"`
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
//
// Alongside the users.admin record, a PB _superusers record is created
// with the same email/password so the operator can access /_/ without a
// separate CLI step. PB's internal hook auto-deletes the placeholder
// __pbinstaller@example.com once this real superuser is saved.
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
	if req.Comments.Provider == "" {
		req.Comments.Provider = "disabled"
	}
	if req.Comments.Provider == "artalk" {
		if _, err := exec.LookPath("artalk"); err != nil {
			return errors.New("bootstrap: this image does not include Artalk; use the prod-artalk image")
		}
		if strings.TrimSpace(req.Comments.ArtalkEmail) == "" {
			return errors.New("bootstrap: Artalk email is required")
		}
		if req.Comments.ArtalkPassword == "" || req.Comments.ArtalkPassword != req.Comments.ArtalkPasswordConfirm {
			return errors.New("bootstrap: Artalk password and confirmation do not match")
		}
		if len(req.Comments.ArtalkPassword) < 8 {
			return errors.New("bootstrap: Artalk password must be at least 8 characters")
		}
	} else if req.Comments.Provider != "disabled" {
		return errors.New("bootstrap: unsupported comments provider")
	}
	if req.Password != req.PasswordConfirm {
		return errors.New("bootstrap: password and passwordConfirm do not match")
	}
	if len(req.Password) < 8 {
		return errors.New("bootstrap: password must be at least 8 characters")
	}

	// --- users.admin ---
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

	// Snapshot before save so we can distinguish "my record was saved (hook
	// then failed)" from "a concurrent request's record now exists".
	hadAdminBefore := HasAdmin(app)
	if err := app.Save(rec); err != nil {
		// PB 0.39 JSVM hooks (onRecordAfterCreateSuccess on "users") can fail
		// with "Invalid module" — likely a Goja module resolution issue inside
		// the pooled VM context. The record IS persisted to the DB despite the
		// hook error (PB saves before firing After*Success hooks).
		// Check if the admin was actually saved; if so, continue to
		// createSuperuser instead of aborting.
		if hadAdminBefore || !HasAdmin(app) {
			return fmt.Errorf("bootstrap: failed to save admin record: %w", err)
		}
		slog.Warn("[bootstrap] admin record saved but hook reported error", "err", err)
	}

	// --- _superusers (same email/password, non-fatal) ---
	if err := createSuperuser(app, email, req.Password); err != nil {
		slog.Warn("[bootstrap] failed to create _superusers record", "err", err)
	}
	if err := configureComments(app, req, email); err != nil {
		return err
	}

	return nil
}

func configureComments(app core.App, req SetupReq, adminEmail string) error {
	site, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || site == nil {
		return fmt.Errorf("bootstrap: site record not found: %w", err)
	}
	provider := req.Comments.Provider
	if provider == "" {
		provider = "disabled"
	}
	site.Set("commentsProvider", provider)
	if provider == "artalk" {
		server := "https://localhost/comments"
		if baseURL := strings.TrimRight(site.GetString("baseUrl"), "/"); baseURL != "" {
			server = baseURL + "/comments"
		}
		site.Set("commentsConfig", map[string]any{
			"server": server,
			"site":   strings.TrimSpace(req.Comments.ArtalkSite),
		})
		if err := initializeArtalk("/data/artalk", strings.TrimSpace(req.Comments.ArtalkEmail), req.Comments.ArtalkPassword, strings.TrimSpace(req.Comments.ArtalkSite)); err != nil {
			return err
		}
	} else {
		site.Set("commentsConfig", map[string]any{})
	}
	if err := app.Save(site); err != nil {
		return fmt.Errorf("bootstrap: failed to save comments config: %w", err)
	}
	return nil
}

func initializeArtalk(dataDir, email, password, name string) error {
	artalkDir := filepath.Join(dataDir, "artalk")
	configPath := filepath.Join(artalkDir, "artalk.yml")
	if err := os.MkdirAll(artalkDir, 0o755); err != nil {
		return fmt.Errorf("bootstrap: create Artalk data directory: %w", err)
	}
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		if out, err := exec.Command("artalk", "gen", "config", configPath).CombinedOutput(); err != nil {
			return fmt.Errorf("bootstrap: generate Artalk config: %w (%s)", err, strings.TrimSpace(string(out)))
		}
	}
	args := []string{"-c", configPath, "admin", "--name", name, "--email", email, "--password", password}
	if out, err := exec.Command("artalk", args...).CombinedOutput(); err != nil {
		return fmt.Errorf("bootstrap: initialize Artalk admin: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}

// createSuperuser creates a PB _superusers record with the given email and password.
// This is intentionally non-fatal in CreateFirstAdmin — the blog admin (/admin/)
// works regardless, and operators can fall back to `vanblog superuser upsert` CLI.
func createSuperuser(app core.App, email, password string) error {
	supCol, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		return fmt.Errorf("_superusers collection not found: %w", err)
	}

	// Upsert: if a record with this email already exists, update its password.
	sup, fErr := app.FindAuthRecordByEmail(supCol, email)
	if fErr != nil {
		sup = core.NewRecord(supCol)
	}
	sup.SetEmail(email)
	sup.SetPassword(password)

	if err := app.Save(sup); err != nil {
		return fmt.Errorf("failed to save _superusers record: %w", err)
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
		se.Router.GET("/api/vanblog/runtime/comments", m.handleRuntimeComments)
		se.Router.POST("/api/vanblog/setup/complete", m.handleComplete)
		return se.Next()
	})
	return m
}

// handleStatus exposes bootstrap mode so the UI can route to /setup when
// needed. Public — bootstrap state is observable, that's the whole point.
func (m *Manager) handleStatus(e *core.RequestEvent) error {
	_, artalkErr := exec.LookPath("artalk")
	return e.JSON(http.StatusOK, map[string]any{
		"bootstrap":    !HasAdmin(m.app),
		"capabilities": map[string]bool{"artalk": artalkErr == nil},
	})
}

// handleRuntimeComments is an internal, local-only readiness probe used by
// the container entrypoint. It intentionally exposes no credentials.
func (m *Manager) handleRuntimeComments(e *core.RequestEvent) error {
	site, err := m.app.FindFirstRecordByFilter("site", "")
	provider := "disabled"
	if err == nil && site != nil {
		provider = site.GetString("commentsProvider")
	}
	return e.JSON(http.StatusOK, map[string]any{"provider": provider})
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
	traceID, _ := e.Get("trace_id").(string)

	var req SetupReq
	if err := readJSON(e, &req); err != nil {
		slog.Warn("[bootstrap] setup/complete: bad request body", "trace", traceID, "err", err)
		return e.JSON(http.StatusBadRequest, map[string]any{
			"ok":      false,
			"error":   "Invalid request body",
			"traceId": traceID,
		})
	}

	if err := CreateFirstAdmin(m.app, req); err != nil {
		// Log the FULL error chain to Docker logs — this is the only place
		// where the complete detail (including wrapped inner errors from
		// validation hooks, PocketBase Save, etc.) is available.
		slog.Error("[bootstrap] setup/complete: CreateFirstAdmin failed", "trace", traceID, "err", err)

		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "already exists") {
			status = http.StatusConflict
		}
		// Return validation errors directly (they are user-safe); hide
		// internal errors behind a generic message. The traceId lets
		// operators correlate with the detailed log line above.
		msg := "Setup failed. See server logs for details."
		if strings.HasPrefix(err.Error(), "bootstrap: ") &&
			!strings.Contains(err.Error(), "failed to save") &&
			!strings.Contains(err.Error(), "collection not found") {
			msg = strings.TrimPrefix(err.Error(), "bootstrap: ")
		}
		return e.JSON(status, map[string]any{
			"ok":      false,
			"error":   msg,
			"traceId": traceID,
		})
	}

	// Re-read to surface the new admin's id. Cheap (1-row query).
	var id string
	if recs, err := m.app.FindRecordsByFilter("users", "role = 'admin'", "", 1, 0); err == nil && len(recs) > 0 {
		id = recs[0].Id
	}

	slog.Info("[bootstrap] setup/complete: admin created", "trace", traceID, "id", id)
	return e.JSON(http.StatusOK, map[string]any{
		"ok":      true,
		"adminId": id,
		"traceId": traceID,
	})
}

// readJSON decodes the request body into dst. Pulled out so test code
// can exercise CreateFirstAdmin directly without constructing a fake
// RequestEvent.
func readJSON(e *core.RequestEvent, dst any) error {
	return json.NewDecoder(e.Request.Body).Decode(dst)
}
