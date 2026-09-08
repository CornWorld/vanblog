// secrets.go — access to the admin-only site_secrets collection.
//
// Credential-bearing site configuration (s3Config AK/SK, syncConfig sshKey,
// syncRemote git URL credentials, outputConfig) lives in a dedicated
// admin-only collection instead of the publicly-readable `site` row
// (migration 1783600100_site_secrets_isolation.go). This package is the
// single read/write seam for that row so no other domain has to know the
// storage layout.
package site

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

// secretsKey is the singleton row key inside site_secrets.
const secretsKey = "main"

// secretJSONFields are the JSON site fields that hold credentials and must
// never remain on the public `site` row.
var secretJSONFields = []string{"s3Config", "syncConfig", "outputConfig"}

// secretsRecord loads the singleton site_secrets row. Returns an unsaved
// record when the row does not exist yet, so callers can Set + Save without
// branching on existence.
func secretsRecord(app core.App) (*core.Record, error) {
	secCol, err := app.FindCollectionByNameOrId("site_secrets")
	if err != nil {
		return nil, fmt.Errorf("site: site_secrets collection not found: %w", err)
	}
	rec, err := app.FindFirstRecordByFilter("site_secrets", "key={:k}", dbx.Params{"k": secretsKey})
	if err != nil {
		// No row yet is the normal fresh-install case → fall through to the
		// unsaved record. Any other lookup failure must propagate: silently
		// writing a second row on a transient read error would corrupt the
		// singleton contract.
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("site: read site_secrets row: %w", err)
		}
	}
	if rec != nil {
		return rec, nil
	}
	fresh := core.NewRecord(secCol)
	fresh.Set("key", secretsKey)
	return fresh, nil
}

// S3Config returns the S3 configuration from site_secrets. Returns the zero
// config when the row is missing or holds no/invalid JSON so callers fall
// through to "S3 disabled" rather than crashing on malformed input.
func S3Config(app core.App) (core.S3Config, error) {
	rec, err := secretsRecord(app)
	if err != nil {
		return core.S3Config{}, err
	}
	raw := rec.GetString("s3Config")
	if raw == "" || raw == "null" {
		return core.S3Config{}, nil
	}
	var cfg core.S3Config
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return core.S3Config{}, fmt.Errorf("site: invalid site_secrets.s3Config JSON: %w", err)
	}
	return cfg, nil
}

// MoveSecretsFromRecord parks any credential-bearing values found on a site
// record into site_secrets (key "main") and nulls them on the incoming
// record, so the values never reach the public `site` collection. Bound to
// the site create/update request hooks (see internal/media).
//
// syncRemote is a scalar (not JSON): its value merges into the secrets row's
// syncRemote column.
func MoveSecretsFromRecord(app core.App, rec *core.Record) error {
	if rec == nil {
		return nil
	}
	secrets, err := secretsRecord(app)
	if err != nil {
		return err
	}
	dirty := false
	for _, f := range secretJSONFields {
		raw := rec.GetString(f)
		if raw == "" || raw == "null" {
			continue
		}
		secrets.Set(f, raw)
		dirty = true
	}
	if v := rec.GetString("syncRemote"); v != "" {
		secrets.Set("syncRemote", v)
		dirty = true
	}
	if dirty {
		if err := app.Save(secrets); err != nil {
			return err
		}
	}
	for _, f := range secretJSONFields {
		// JSON literal `null`, NOT Go nil: SQL NULL fails PB JSONField
		// validation on every subsequent save ("Invalid input" 400).
		rec.Set(f, json.RawMessage("null"))
	}
	rec.Set("syncRemote", "")
	return nil
}

// HealSecrets runs at every server start and fixes two artifacts on the
// public site row:
//
//  1. Residual credential values (old backups restoring the pre-1783600100
//     schema) → moved into site_secrets.
//  2. SQL NULL in the secretJSONFields columns — written by 1783600100
//     itself on fresh installs — which PB 0.40 JSONField validation rejects
//     on every subsequent site save ("Invalid input" 400; settings become
//     unsavable). Normalized to the JSON literal `null` (valid JSON, renders
//     as null on the wire, and the invariant templates/assertions treat it
//     as "field empty").
//
// Idempotent no-op once the row is clean.
func HealSecrets(app core.App) error {
	siteRec, err := app.FindFirstRecordByFilter("site", "")
	// No site row yet (fresh install before setup) is the normal no-op
	// case; only a real DB error propagates (caller logs a warning).
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if siteRec == nil {
		return nil
	}
	dirty := false
	for _, f := range secretJSONFields {
		if raw := siteRec.GetString(f); raw != "" && raw != "null" {
			dirty = true
			break
		}
	}
	if v := siteRec.GetString("syncRemote"); v != "" {
		dirty = true
	}
	if dirty {
		secrets, serr := secretsRecord(app)
		if serr != nil {
			return serr
		}
		for _, f := range secretJSONFields {
			if raw := siteRec.GetString(f); raw != "" && raw != "null" {
				secrets.Set(f, raw)
			}
		}
		if v := siteRec.GetString("syncRemote"); v != "" {
			secrets.Set("syncRemote", v)
		}
		if err := app.Save(secrets); err != nil {
			return err
		}
	}
	normalized := false
	for _, f := range secretJSONFields {
		// SQL NULL loads as an EMPTY types.JSONRaw whose GetString is
		// "null" — indistinguishable from a real JSON null literal by
		// string alone. Empty bytes = no JSON at all = the zod validation
		// bridge chokes on it; rewrite as the literal.
		if raw, ok := siteRec.Get(f).(types.JSONRaw); ok && len(raw) == 0 {
			siteRec.Set(f, json.RawMessage("null"))
			normalized = true
		}
	}
	if dirty {
		for _, f := range secretJSONFields {
			siteRec.Set(f, json.RawMessage("null"))
		}
		siteRec.Set("syncRemote", "")
		normalized = true
	}
	if !normalized {
		return nil
	}
	return app.Save(siteRec)
}
