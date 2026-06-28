package media

import (
	"encoding/json"
	"testing"
)

func TestApplyS3BackendToSettings_DisabledByDefault(t *testing.T) {
	app := setupApp(t)

	// Fresh install: site.s3Config = {"enabled":false} (set by migration).
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

func TestApplyS3BackendToSettings_AppliesEnabledConfig(t *testing.T) {
	app := setupApp(t)

	// Write a complete S3 config to site.s3Config (simulating admin UI save).
	site, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || site == nil {
		t.Fatalf("find site: %v", err)
	}
	cfg := S3ConfigUser{
		Enabled:        true,
		Bucket:         "vanblog-test",
		Region:         "us-east-1",
		Endpoint:       "https://s3.example.com",
		AccessKey:      "AKIAFAKE",
		Secret:         "FAKESECRET",
		ForcePathStyle: true,
	}
	raw, _ := json.Marshal(cfg)
	site.Set("s3Config", json.RawMessage(raw))
	if err := app.Save(site); err != nil {
		t.Fatalf("save site: %v", err)
	}

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

	// Apply once.
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("first sync: %v", err)
	}

	// Calling again with same config should be a no-op (no error, no change).
	// We can't directly assert "no DB write" but a clean return is the contract.
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("second sync should be no-op: %v", err)
	}
}

func TestApplyS3BackendToSettings_RejectsIncomplete(t *testing.T) {
	app := setupApp(t)

	// Enabled=true but missing required fields → pb's S3Config.Validate
	// should reject, and ApplyS3BackendToSettings should surface that error.
	site, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || site == nil {
		t.Fatalf("find site: %v", err)
	}
	cfg := S3ConfigUser{Enabled: true, Bucket: "", Region: "", Endpoint: "", AccessKey: "", Secret: ""}
	raw, _ := json.Marshal(cfg)
	site.Set("s3Config", json.RawMessage(raw))
	if err := app.Save(site); err != nil {
		t.Fatalf("save site: %v", err)
	}

	if err := ApplyS3BackendToSettings(app); err == nil {
		t.Error("expected validation error for incomplete S3 config, got nil")
	}
}

func TestApplyS3BackendToSettings_ToggleOff(t *testing.T) {
	app := setupApp(t)

	// Turn on.
	site, _ := app.FindFirstRecordByFilter("site", "")
	onCfg := S3ConfigUser{Enabled: true, Bucket: "b", Region: "r", Endpoint: "https://e", AccessKey: "a", Secret: "s"}
	raw, _ := json.Marshal(onCfg)
	site.Set("s3Config", json.RawMessage(raw))
	app.Save(site)
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("enable: %v", err)
	}
	if !app.Settings().S3.Enabled {
		t.Fatal("expected enabled after first sync")
	}

	// Turn off.
	site.Set("s3Config", json.RawMessage(`{"enabled":false}`))
	app.Save(site)
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("disable: %v", err)
	}
	if app.Settings().S3.Enabled {
		t.Error("expected disabled after toggling off")
	}
}
