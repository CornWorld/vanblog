package media

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"reflect"

	"github.com/pocketbase/pocketbase/core"
)

// readSiteS3 returns the S3 configuration from the admin-only site_secrets
// collection. Secret material no longer lives in the publicly-readable `site`
// row (see migration 1783600100_site_secrets_isolation.go).
// Returns the zero config when the row has no/invalid JSON so callers fall
// through to "S3 disabled" rather than crashing on malformed input.
func readSiteS3(app core.App) (core.S3Config, error) {
	rec, err := app.FindFirstRecordByFilter("site_secrets", "key={:k}", map[string]any{"k": "main"})
	if err != nil || rec == nil {
		return core.S3Config{}, err
	}
	raw := rec.GetString("s3Config")
	if raw == "" || raw == "null" {
		return core.S3Config{}, nil
	}
	var cfg core.S3Config
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return core.S3Config{}, fmt.Errorf("media: invalid site_secrets.s3Config JSON: %w", err)
	}
	return cfg, nil
}

// HealSiteSecrets guards against old backups restoring a
// site.s3Config/syncConfig/outputConfig row (pre-1783600100 schema). The
// migration may have already run on this DB, so it cannot rewrite the row;
// instead, on every server start, move any residual public-site secret
// values into site_secrets and null the site fields. Idempotent no-op once
// the row is clean.
func HealSiteSecrets(db core.App) error {
	site, err := db.FindFirstRecordByFilter("site", "")
	if err != nil || site == nil {
		return nil
	}
	var dirty bool
	for _, f := range []string{"s3Config", "syncConfig", "outputConfig"} {
		if raw := site.GetString(f); raw != "" && raw != "null" {
			dirty = true
			break
		}
	}
	if !dirty {
		return nil
	}
	secCol, err := db.FindCollectionByNameOrId("site_secrets")
	if err != nil {
		return err
	}
	secrets, err := db.FindFirstRecordByFilter("site_secrets", "key={:k}", map[string]any{"k": "main"})
	if secrets == nil || err != nil {
		secrets = core.NewRecord(secCol)
		secrets.Set("key", "main")
	}
	for _, f := range []string{"s3Config", "syncConfig", "outputConfig"} {
		if raw := site.GetString(f); raw != "" && raw != "null" {
			secrets.Set(f, raw)
		}
	}
	if err := db.Save(secrets); err != nil {
		return err
	}
	for _, f := range []string{"s3Config", "syncConfig", "outputConfig"} {
		site.Set(f, nil)
	}
	return db.Save(site)
}

// MoveSiteSecretsFromRecord parks any credential-bearing values found on a
// site record into site_secrets (key "main") and nulls them on the incoming
// record, so the value never reaches the public `site` collection. Bound to
// OnRecordBeforeCreateRequest/OnRecordBeforeUpdateRequest("site").
func MoveSiteSecretsFromRecord(db core.App, rec *core.Record) error {
	if rec == nil {
		return nil
	}
	secCol, err := db.FindCollectionByNameOrId("site_secrets")
	if err != nil {
		return err
	}
	secrets, err := db.FindFirstRecordByFilter("site_secrets", "key={:k}", map[string]any{"k": "main"})
	if secrets == nil || err != nil {
		secrets = core.NewRecord(secCol)
		secrets.Set("key", "main")
	}
	dirty := false
	for _, f := range []string{"s3Config", "syncConfig", "outputConfig"} {
		raw := rec.GetString(f)
		if raw == "" || raw == "null" {
			continue
		}
		secrets.Set(f, raw)
		dirty = true
	}
	if dirty {
		if err := db.Save(secrets); err != nil {
			return err
		}
	}
	for _, f := range []string{"s3Config", "syncConfig", "outputConfig"} {
		rec.Set(f, nil)
	}
	return nil
}

// ApplyS3BackendToSettings reads site.s3Config and pushes it into PocketBase's
// app settings when the value has changed. PocketBase's BaseApp.NewFilesystem
// auto-routes FileField uploads to S3 when settings.S3.Enabled is true, so
// this is the only place needed for S3 support.
//
// Idempotent: returns nil without writing when settings already match site.
// Called from two places (both registered in New):
//   - startup: an OnServe hook so a fresh deploy with a pre-populated
//     site.s3Config (backup restore, image upgrade) routes uploads to S3
//     without requiring an admin to re-save the site record.
//   - site update: an OnRecordAfterUpdateSuccess("site") hook so config
//     edits take effect on the next upload without a restart.
func ApplyS3BackendToSettings(app core.App) error {
	userCfg, err := readSiteS3(app)
	if err != nil {
		return fmt.Errorf("media: read site.s3Config: %w", err)
	}

	settings := app.Settings()
	if settings == nil {
		return fmt.Errorf("media: app settings not loaded")
	}

	if reflect.DeepEqual(userCfg, settings.S3) {
		return nil
	}

	// Mutate the live *Settings and persist. app.Save runs validations
	// (S3Config.Validate enforces required fields when Enabled), so an
	// incomplete config surfaces as an error rather than silently breaking
	// uploads.
	settings.S3 = userCfg

	if err := app.Save(settings); err != nil {
		return fmt.Errorf("media: persist S3 settings: %w", err)
	}
	if err := app.ReloadSettings(); err != nil {
		return fmt.Errorf("media: reload settings after S3 update: %w", err)
	}

	// Do not log secret. Bucket/endpoint are non-sensitive and useful for
	// operators confirming a config change took effect.
	slog.Info("[media] S3 settings synced", "enabled", userCfg.Enabled, "bucket", userCfg.Bucket, "endpoint", userCfg.Endpoint)
	return nil
}
