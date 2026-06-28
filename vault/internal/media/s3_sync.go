package media

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/pocketbase/pocketbase/core"
)

// S3ConfigUser is the user-facing shape stored in the site.s3Config JSON
// column. It maps 1:1 to core.S3Config — kept as our own struct so the
// site ↔ settings sync logic is independent of pb's internal field tags.
type S3ConfigUser struct {
	Enabled        bool   `json:"enabled"`
	Bucket         string `json:"bucket"`
	Region         string `json:"region"`
	Endpoint       string `json:"endpoint"`
	AccessKey      string `json:"accessKey"`
	Secret         string `json:"secret"`
	ForcePathStyle bool   `json:"forcePathStyle"`
}

// readSiteS3 returns the S3 configuration stored in the single site record.
// Returns (zero, nil) when the site row has no/invalid JSON so that callers
// fall through to "S3 disabled" rather than crashing on malformed input.
func readSiteS3(app core.App) (S3ConfigUser, error) {
	rec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || rec == nil {
		return S3ConfigUser{}, err
	}
	raw := rec.GetString("s3Config")
	if raw == "" || raw == "null" {
		return S3ConfigUser{}, nil
	}
	var cfg S3ConfigUser
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return S3ConfigUser{}, fmt.Errorf("media: invalid site.s3Config JSON: %w", err)
	}
	return cfg, nil
}

// s3Equal reports whether the user config matches what's already in pb settings.
// Used to make ApplyS3BackendToSettings idempotent — skip the DB write when nothing changed.
func s3Equal(a S3ConfigUser, b core.S3Config) bool {
	return a.Enabled == b.Enabled &&
		a.Bucket == b.Bucket &&
		a.Region == b.Region &&
		a.Endpoint == b.Endpoint &&
		a.AccessKey == b.AccessKey &&
		a.Secret == b.Secret &&
		a.ForcePathStyle == b.ForcePathStyle
}

// ApplyS3BackendToSettings reads site.s3Config and pushes it into PocketBase's
// app settings when the value has changed. PocketBase's BaseApp.NewFilesystem
// auto-routes FileField uploads to S3 when settings.S3.Enabled is true, so
// this is the only place needed for S3 support.
//
// Idempotent: returns nil without writing when settings already match site.
// Called from startup (via caddy Service OnServe) and from the site-update
// hook (via Manager.reapplyS3Backend).
func ApplyS3BackendToSettings(app core.App) error {
	userCfg, err := readSiteS3(app)
	if err != nil {
		return fmt.Errorf("media: read site.s3Config: %w", err)
	}

	settings := app.Settings()
	if settings == nil {
		return fmt.Errorf("media: app settings not loaded")
	}

	if s3Equal(userCfg, settings.S3) {
		return nil
	}

	// Mutate the live *Settings and persist. app.Save runs validations
	// (S3Config.Validate enforces required fields when Enabled), so an
	// incomplete config surfaces as an error rather than silently breaking
	// uploads.
	settings.S3 = core.S3Config{
		Enabled:        userCfg.Enabled,
		Bucket:         userCfg.Bucket,
		Region:         userCfg.Region,
		Endpoint:       userCfg.Endpoint,
		AccessKey:      userCfg.AccessKey,
		Secret:         userCfg.Secret,
		ForcePathStyle: userCfg.ForcePathStyle,
	}

	if err := app.Save(settings); err != nil {
		return fmt.Errorf("media: persist S3 settings: %w", err)
	}
	if err := app.ReloadSettings(); err != nil {
		return fmt.Errorf("media: reload settings after S3 update: %w", err)
	}

	// Do not log secret. Bucket/endpoint are non-sensitive and useful for
	// operators confirming a config change took effect.
	log.Printf("[vanblog] S3 settings synced: enabled=%v bucket=%s endpoint=%s",
		userCfg.Enabled, userCfg.Bucket, userCfg.Endpoint)
	return nil
}
