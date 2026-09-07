package media

import (
	"fmt"
	"log/slog"
	"reflect"

	"github.com/cornworld/vanblog/internal/site"
	"github.com/pocketbase/pocketbase/core"
)

// ApplyS3BackendToSettings reads the S3 config from site_secrets and pushes
// it into PocketBase's app settings when the value has changed. PocketBase's
// BaseApp.NewFilesystem auto-routes FileField uploads to S3 when
// settings.S3.Enabled is true, so this is the only place needed for S3
// support.
//
// Idempotent: returns nil without writing when settings already match site.
// Called from two places (both registered in New):
//   - startup: an OnServe hook so a fresh deploy with a pre-populated
//     site_secrets row (backup restore, image upgrade) routes uploads to S3
//     without requiring an admin to re-save the secrets record.
//   - site update: an OnRecordAfterUpdateSuccess("site") hook so config
//     edits take effect on the next upload without a restart.
func ApplyS3BackendToSettings(app core.App) error {
	userCfg, err := site.S3Config(app)
	if err != nil {
		return fmt.Errorf("media: read site_secrets.s3Config: %w", err)
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
