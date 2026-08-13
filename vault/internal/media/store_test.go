package media

import (
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

// TestStoreLocalFile_RandomPrefix verifies StoreLocalFile creates a media
// record whose on-disk filename (record.GetString("file")) differs from the
// original name — pb FileField adds a random prefix. This is the exact bug
// that previously caused import URLs to 404.
func TestStoreLocalFile_RandomPrefix(t *testing.T) {
	app := setupApp(t)

	pngBytes := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xcf\xc0\x00\x00\x00\x03\x00\x01\x5d\xcc\xdb\xda\x00\x00\x00\x00IEND\xaeB`\x82")

	rec, err := StoreLocalFile(app, pngBytes, "photo.png", "https://orig.example.com/photo.png", "img")
	if err != nil {
		t.Fatalf("StoreLocalFile: %v", err)
	}

	storedName := rec.GetString("file")
	if storedName == "" {
		t.Fatal("file field empty after save")
	}
	if storedName == "photo.png" {
		t.Errorf("expected pb to rename file with random suffix, got %q", storedName)
	}
	// pb rewrites "photo.png" → "photo_<random>.png" (random suffix before ext).
	if !strings.HasPrefix(storedName, "photo") {
		t.Errorf("stored name %q should retain original base name", storedName)
	}
	if !strings.HasSuffix(storedName, ".png") {
		t.Errorf("stored name %q should retain extension", storedName)
	}

	// Record fields
	if rec.GetString("staticType") != "img" {
		t.Errorf("staticType = %q", rec.GetString("staticType"))
	}
	if rec.GetString("storageType") != "local" {
		t.Errorf("storageType = %q", rec.GetString("storageType"))
	}
	if rec.GetString("externalUrl") != "https://orig.example.com/photo.png" {
		t.Errorf("externalUrl = %q", rec.GetString("externalUrl"))
	}

	// URL built from stored name must be readable
	fsys, err := app.NewFilesystem()
	if err != nil {
		t.Fatalf("NewFilesystem: %v", err)
	}
	defer fsys.Close()
	r, err := fsys.GetReader(rec.BaseFilesPath() + "/" + storedName)
	if err != nil {
		t.Errorf("stored file not readable at %s/%s: %v", rec.BaseFilesPath(), storedName, err)
	} else {
		r.Close()
	}
}

// TestAttachFile_ExistingRecord verifies AttachFile attaches a file to an
// existing record without creating a new one — the path ingest uses when the
// scan hook already created a tracking record for the same externalUrl.
func TestAttachFile_ExistingRecord(t *testing.T) {
	app := setupApp(t)

	pngBytes := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xcf\xc0\x00\x00\x00\x03\x00\x01\x5d\xcc\xdb\xda\x00\x00\x00\x00IEND\xaeB`\x82")

	// Simulate scan hook: a tracking record with externalUrl but no file.
	mediaCol, _ := app.FindCollectionByNameOrId("media")
	tracker := core.NewRecord(mediaCol)
	tracker.Set("staticType", "img")
	tracker.Set("storageType", "external")
	tracker.Set("externalUrl", "https://orig.example.com/photo.png")
	if err := app.Save(tracker); err != nil {
		t.Fatalf("save tracker: %v", err)
	}
	if tracker.GetString("file") != "" {
		t.Fatal("tracker should start with no file")
	}

	// Attach the downloaded file to the same record.
	if err := AttachFile(app, tracker, pngBytes, "photo.png"); err != nil {
		t.Fatalf("AttachFile: %v", err)
	}

	reloaded, _ := app.FindRecordById("media", tracker.Id)
	storedName := reloaded.GetString("file")
	if storedName == "" {
		t.Fatal("file not attached after AttachFile")
	}
	if storedName == "photo.png" {
		t.Errorf("expected random-prefixed name, got %q", storedName)
	}

	// Still exactly one record for this externalUrl.
	records, _ := app.FindRecordsByFilter("media", "externalUrl='https://orig.example.com/photo.png'", "", 0, 0)
	if len(records) != 1 {
		t.Errorf("media count = %d, want 1 (no duplicate)", len(records))
	}
}

// TestStoreLocalFile_WithoutExternalURL verifies the externalUrl is optional.
func TestStoreLocalFile_WithoutExternalURL(t *testing.T) {
	app := setupApp(t)
	pngBytes := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xcf\xc0\x00\x00\x00\x03\x00\x01\x5d\xcc\xdb\xda\x00\x00\x00\x00IEND\xaeB`\x82")

	rec, err := StoreLocalFile(app, pngBytes, "a.png", "", "img")
	if err != nil {
		t.Fatalf("StoreLocalFile: %v", err)
	}
	if rec.GetString("externalUrl") != "" {
		t.Errorf("externalUrl should be empty, got %q", rec.GetString("externalUrl"))
	}
	if rec.GetString("file") == "" {
		t.Error("file should be set")
	}
}
