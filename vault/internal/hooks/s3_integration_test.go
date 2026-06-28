//go:build integration

// Integration tests for the dedup hook end-to-end, against a real S3 backend.
// Skipped unless VANBLOG_S3TEST_ENDPOINT is set (see docker/dev-services/minio.yml).
//
// What this verifies that unit tests in this package don't:
//   - The hook is actually registered by Register() and fires on media create.
//   - mediaMgr.ReadFileContent works through the S3-backed filesystem
//     (regressions in path construction would silently break dedup).
//   - Two identical uploads end up with exactly one survivor.
package hooks

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"os"
	"testing"
	"time"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/cornworld/vanblog/internal/media"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

func s3TestEnvHooks(t *testing.T) (endpoint, accessKey, secretKey, bucket string) {
	t.Helper()
	endpoint = os.Getenv("VANBLOG_S3TEST_ENDPOINT")
	accessKey = os.Getenv("VANBLOG_S3TEST_ACCESS_KEY")
	secretKey = os.Getenv("VANBLOG_S3TEST_SECRET_KEY")
	bucket = os.Getenv("VANBLOG_S3TEST_BUCKET")
	if endpoint == "" || accessKey == "" || secretKey == "" || bucket == "" {
		t.Skip("set VANBLOG_S3TEST_* to run hooks S3 integration test")
	}
	return
}

// TestS3DedupHook_FiresOnMediaCreate proves the OnRecordAfterCreateSuccess("media")
// hook chain works end-to-end against S3:
//   - Upload identical bytes twice.
//   - Hook reads each via S3 filesystem, computes MD5, queries for prior dup.
//   - Second save triggers deletion of the newer duplicate.
//   - Survivor carries a non-empty `sign` (proves ReadFileContent worked).
func TestS3DedupHook_FiresOnMediaCreate(t *testing.T) {
	endpoint, accessKey, secretKey, bucket := s3TestEnvHooks(t)

	tmpDir, _ := os.MkdirTemp("", "pb-hooks-s3-dedup")
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migration: %v", err)
	}

	// Register the production hook wiring. This binds the dedup closure to
	// OnRecordAfterCreateSuccess("media").
	Register(app)

	// Enable S3 via site.s3Config + sync (same path as production startup).
	site, _ := app.FindFirstRecordByFilter("site", "")
	cfg := media.S3ConfigUser{
		Enabled: true, Bucket: bucket, Region: "us-east-1",
		Endpoint: endpoint, AccessKey: accessKey, Secret: secretKey,
		ForcePathStyle: true,
	}
	siteJSON, _ := json.Marshal(cfg)
	site.Set("s3Config", siteJSON)
	if err := app.Save(site); err != nil {
		t.Fatalf("save site: %v", err)
	}
	if err := media.SyncS3ToSettings(app); err != nil {
		t.Fatalf("SyncS3ToSettings: %v", err)
	}

	mediaCol, _ := app.FindCollectionByNameOrId("media")
	pngBytes := minimalPNGBytes()

	// Upload #1.
	rec1 := core.NewRecord(mediaCol)
	f1, _ := filesystem.NewFileFromBytes(pngBytes, "dedup-a.png")
	rec1.Set("file", f1)
	rec1.Set("staticType", "img")
	if err := app.Save(rec1); err != nil {
		t.Fatalf("save #1: %v", err)
	}
	defer cleanupBucket(t, endpoint, accessKey, secretKey, bucket, mediaCol.Id+"/"+rec1.Id+"/")

	// Upload #2 — identical bytes.
	rec2 := core.NewRecord(mediaCol)
	f2, _ := filesystem.NewFileFromBytes(pngBytes, "dedup-b.png")
	rec2.Set("file", f2)
	rec2.Set("staticType", "img")
	if err := app.Save(rec2); err != nil {
		t.Fatalf("save #2: %v", err)
	}
	defer cleanupBucket(t, endpoint, accessKey, secretKey, bucket, mediaCol.Id+"/"+rec2.Id+"/")

	// pb's OnRecordAfterCreateSuccess fires after the create tx commits,
	// but its scheduling has overhead — and the hook itself does an S3 read
	// (ReadFileContent) which on first MinIO connection takes ~100ms+
	// (DNS + TLS handshake + bucket HEAD). On cold starts the dedup closure
	// can still be running when the test reaches the assertion. Poll up to
	// 6s to give it room; on warm runs it completes in <50ms.
	deadline := time.Now().Add(6 * time.Second)
	for time.Now().Before(deadline) {
		_, err1 := app.FindRecordById("media", rec1.Id)
		_, err2 := app.FindRecordById("media", rec2.Id)
		if err1 != nil && err2 != nil {
			t.Fatal("both records deleted — dedup hook over-deleted")
		}
		if (err1 != nil) != (err2 != nil) {
			break // exactly one survivor
		}
		time.Sleep(50 * time.Millisecond)
	}

	_, err1 := app.FindRecordById("media", rec1.Id)
	_, err2 := app.FindRecordById("media", rec2.Id)
	switch {
	case err1 == nil && err2 == nil:
		t.Fatal("dedup hook did not fire — both duplicate records survived")
	case err1 != nil && err2 != nil:
		t.Fatal("dedup hook over-deleted — both records gone")
	}

	// The survivor should have sign set (proves ReadFileContent computed MD5
	// against the S3-backed filesystem, not just that one record vanished).
	var survivor *core.Record
	if err1 == nil {
		survivor, _ = app.FindRecordById("media", rec1.Id)
	} else {
		survivor, _ = app.FindRecordById("media", rec2.Id)
	}
	if survivor == nil {
		t.Fatal("survivor lookup failed")
	}
	if survivor.GetString("sign") == "" {
		t.Error("survivor has empty sign — ReadFileContent did not run against S3 (hook chain broken)")
	}
}

// helpers ----------------------------------------------------------------

func minimalPNGBytes() []byte {
	var buf bytes.Buffer
	img := image.NewRGBA(image.Rect(0, 0, 100, 100))
	for y := 0; y < 100; y++ {
		for x := 0; x < 100; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x * 2), G: uint8(y * 2), B: 128, A: 255})
		}
	}
	if err := png.Encode(&buf, img); err != nil {
		panic(err)
	}
	return buf.Bytes()
}

func cleanupBucket(t *testing.T, endpoint, accessKey, secretKey, bucket, prefix string) {
	t.Helper()
	f, err := filesystem.NewS3(bucket, "us-east-1", endpoint, accessKey, secretKey, true)
	if err != nil {
		return
	}
	defer f.Close()
	if errs := f.DeletePrefix(prefix); len(errs) > 0 {
		t.Logf("cleanup %s: %v", prefix, errs)
	}
}
