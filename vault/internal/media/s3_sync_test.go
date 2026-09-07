package media

import (
	"encoding/json"
	"reflect"
	"testing"

	vbsite "github.com/cornworld/vanblog/internal/site"
	"github.com/pocketbase/pocketbase/core"
)

func TestApplyS3BackendToSettings_DisabledByDefault(t *testing.T) {
	app := setupApp(t)

	// Fresh install: no secrets row, settings default zero value.
	// Sync should be a no-op (settings already match default zero value).
	before := app.Settings().S3
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("ApplyS3BackendToSettings: %v", err)
	}
	after := app.Settings().S3
	if before.Enabled != after.Enabled || before.Enabled {
		t.Errorf("expected S3 disabled by default, got %+v", after)
	}
}

// seedSiteS3Config writes an S3 config through the real path: a site payload
// carrying s3Config passes through vbsite.MoveSecretsFromRecord (bound to the
// site create/update request hooks), which parks the value in site_secrets
// and nulls it on the public site row.
func seedSiteS3Config(t *testing.T, app core.App, cfg core.S3Config) {
	t.Helper()
	site, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || site == nil {
		t.Fatalf("find site: %v", err)
	}
	raw, _ := json.Marshal(cfg)
	site.Set("s3Config", json.RawMessage(raw))
	if err := vbsite.MoveSecretsFromRecord(app, site); err != nil {
		t.Fatalf("move to site_secrets: %v", err)
	}
	if got := site.GetString("s3Config"); got != "" && got != "null" {
		t.Fatalf("site.s3Config not stripped, got %q", got)
	}
}

func TestApplyS3BackendToSettings_AppliesEnabledConfig(t *testing.T) {
	app := setupApp(t)

	// Simulate an admin UI save: the site payload carries s3Config, which the
	// request hook routes into site_secrets (never landing on the public row).
	seedSiteS3Config(t, app, core.S3Config{
		Enabled:        true,
		Bucket:         "vanblog-test",
		Region:         "us-east-1",
		Endpoint:       "https://s3.example.com",
		AccessKey:      "AKIAFAKE",
		Secret:         "FAKESECRET",
		ForcePathStyle: true,
	})

	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("ApplyS3BackendToSettings: %v", err)
	}

	got := app.Settings().S3
	if !got.Enabled || got.Bucket != "vanblog-test" || got.Secret != "FAKESECRET" || !got.ForcePathStyle {
		t.Errorf("settings.S3 not updated correctly: %+v", got)
	}
}

func TestApplyS3BackendToSettings_Idempotent(t *testing.T) {
	app := setupApp(t)

	// Seed an enabled config so the first sync actually writes settings.
	seedSiteS3Config(t, app, core.S3Config{
		Enabled:        true,
		Bucket:         "vanblog-test",
		Region:         "us-east-1",
		Endpoint:       "https://s3.example.com",
		AccessKey:      "AKIAFAKE",
		Secret:         "FAKESECRET",
		ForcePathStyle: true,
	})

	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("first sync: %v", err)
	}
	first := app.Settings().S3

	// Second sync with the same config must be a no-op: no error and no
	// drift in the settings that end up in effect.
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("second sync should be no-op: %v", err)
	}
	if got := app.Settings().S3; !reflect.DeepEqual(got, first) {
		t.Errorf("second sync drifted settings:\nfirst:  %+v\nsecond: %+v", first, got)
	}
}

func TestApplyS3BackendToSettings_RejectsIncomplete(t *testing.T) {
	app := setupApp(t)

	// Enabled=true but missing required fields → pb's S3Config.Validate
	// should reject, and ApplyS3BackendToSettings should surface that error.
	seedSiteS3Config(t, app, core.S3Config{Enabled: true, Bucket: "", Region: "", Endpoint: "", AccessKey: "", Secret: ""})

	if err := ApplyS3BackendToSettings(app); err == nil {
		t.Error("expected validation error for incomplete S3 config, got nil")
	}
}

func TestApplyS3BackendToSettings_ToggleOff(t *testing.T) {
	app := setupApp(t)

	// Turn on via the real storage path.
	seedSiteS3Config(t, app, core.S3Config{Enabled: true, Bucket: "b", Region: "r", Endpoint: "https://e", AccessKey: "a", Secret: "s"})
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("enable: %v", err)
	}
	if !app.Settings().S3.Enabled {
		t.Fatal("expected enabled after first sync")
	}

	// Turn off (disabled config replaces the secrets row; note the site row
	// itself never carries the value).
	seedSiteS3Config(t, app, core.S3Config{})
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("disable: %v", err)
	}
	if app.Settings().S3.Enabled {
		t.Error("expected disabled after toggling off")
	}
}
