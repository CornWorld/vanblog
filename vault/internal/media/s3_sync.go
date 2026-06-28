package media

import (
	"encoding/json"
	"fmt"
	"log"
	"reflect"

	"github.com/pocketbase/pocketbase/core"
)

// readSiteS3 returns the S3 configuration stored in the single site record.
// Returns the zero value when the site row has no/invalid JSON so callers
// fall through to "S3 disabled" rather than crashing on malformed input.
func readSiteS3(app core.App) (core.S3Config, error) {
	rec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || rec == nil {
		return core.S3Config{}, err
	}
	raw := rec.GetString("s3Config")
	if raw == "" || raw == "null" {
		return core.S3Config{}, nil
	}
	var cfg core.S3Config
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return core.S3Config{}, fmt.Errorf("media: invalid site.s3Config JSON: %w", err)
	}
	return cfg, nil
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
	log.Printf("[media] S3 settings synced: enabled=%v bucket=%s endpoint=%s",
		userCfg.Enabled, userCfg.Bucket, userCfg.Endpoint)
	return nil
}
