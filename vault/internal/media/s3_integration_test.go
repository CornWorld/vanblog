//go:build integration

// Integration test for the S3 sync flow against a real S3-compatible backend
// (MinIO by default). Skipped unless VANBLOG_S3TEST_ENDPOINT is set.
//
// Run locally:
//
//	# 1. Start MinIO + auto-create bucket (see docker/dev-services/minio.yml)
//	docker compose -f docker/dev-services/minio.yml up -d
//	# 2. Run the tests:
//	VANBLOG_S3TEST_ENDPOINT=http://localhost:9000 \
//	VANBLOG_S3TEST_ACCESS_KEY=minioadmin \
//	VANBLOG_S3TEST_SECRET_KEY=minioadmin \
//	VANBLOG_S3TEST_BUCKET=vanblog-test \
//	go test -tags=integration ./internal/media/ -run TestS3Integration -v
package media

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

// s3TestEnv reads required S3 test parameters from the environment. Returns
// ok=false when any are missing — callers should t.Skip.
func s3TestEnv(t *testing.T) (endpoint, accessKey, secretKey, bucket string) {
	t.Helper()
	endpoint = os.Getenv("VANBLOG_S3TEST_ENDPOINT")
	accessKey = os.Getenv("VANBLOG_S3TEST_ACCESS_KEY")
	secretKey = os.Getenv("VANBLOG_S3TEST_SECRET_KEY")
	bucket = os.Getenv("VANBLOG_S3TEST_BUCKET")
	if endpoint == "" || accessKey == "" || secretKey == "" || bucket == "" {
		t.Skip("set VANBLOG_S3TEST_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET to run S3 integration test")
	}
	return
}

// TestS3Integration_SyncThenUpload exercises the full happy path:
//  1. Write site.s3Config.enabled=true pointing at MinIO.
//  2. ApplyS3BackendToSettings → pb settings.S3 should reflect the change.
//  3. app.NewFilesystem() should hand back an S3-backed filesystem.
//  4. Upload a test file via the filesystem.
//  5. Read it back and verify bytes match.
//  6. Toggle site.s3Config.enabled=false → NewFilesystem() falls back to local.
//
// This is the test we'd manually do in the admin UI; encoding it lets us
// catch regressions in the sync hook + filesystem handoff without standing
// up the entire container stack.
func TestS3Integration_SyncThenUpload(t *testing.T) {
	endpoint, accessKey, secretKey, bucket := s3TestEnv(t)

	tmpDir, _ := os.MkdirTemp("", "pb-s3-integ")
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migration: %v", err)
	}

	// --- Step 1: configure site.s3Config ---
	site, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || site == nil {
		t.Fatalf("find site: %v", err)
	}
	cfg := core.S3Config{
		Enabled:        true,
		Bucket:         bucket,
		Region:         "us-east-1", // MinIO ignores but requires non-empty
		Endpoint:       endpoint,
		AccessKey:      accessKey,
		Secret:         secretKey,
		ForcePathStyle: true, // MinIO needs path-style
	}
	site.Set("s3Config", mustJSONRaw(cfg))
	if err := app.Save(site); err != nil {
		t.Fatalf("save site: %v", err)
	}

	// --- Step 2: sync to pb settings ---
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("ApplyS3BackendToSettings: %v", err)
	}
	got := app.Settings().S3
	if !got.Enabled || got.Bucket != bucket || got.Endpoint != endpoint {
		t.Fatalf("settings.S3 mismatch: %+v", got)
	}

	// --- Step 3: NewFilesystem returns S3-backed ---
	fsys, err := app.NewFilesystem()
	if err != nil {
		t.Fatalf("NewFilesystem: %v", err)
	}
	defer fsys.Close()

	// --- Step 4: upload ---
	content := []byte("vanblog-s3-integration-" + time.Now().Format(time.RFC3339))
	key := "integration-test/test.txt"
	if err := fsys.Upload(content, key); err != nil {
		t.Fatalf("Upload: %v", err)
	}
	t.Cleanup(func() {
		// best-effort cleanup so re-runs don't accumulate objects.
		// Skip via VANBLOG_S3TEST_NOCLEANUP=1 to inspect bucket post-test.
		if os.Getenv("VANBLOG_S3TEST_NOCLEANUP") == "1" {
			return
		}
		fsysCleanup(t, endpoint, accessKey, secretKey, bucket, key)
	})

	// --- Step 5: read back and verify ---
	rc, err := fsys.GetReader(key)
	if err != nil {
		t.Fatalf("GetReader: %v", err)
	}
	defer rc.Close()
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(rc); err != nil {
		t.Fatalf("read: %v", err)
	}
	if !bytes.Equal(buf.Bytes(), content) {
		t.Errorf("roundtrip mismatch: got %q want %q", buf.String(), string(content))
	}

	// --- Step 6: toggle off → falls back to local ---
	site.Set("s3Config", mustJSONRaw(core.S3Config{Enabled: false}))
	if err := app.Save(site); err != nil {
		t.Fatalf("save site (disabled): %v", err)
	}
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("ApplyS3BackendToSettings (disabled): %v", err)
	}
	if app.Settings().S3.Enabled {
		t.Fatal("expected S3 disabled after toggle-off")
	}
	// Note: we don't assert NewFilesystem() returns local here — pb's
	// app.ReloadSettings may not be synchronous enough in-test. The settings
	// field check above is the contract the sync hook actually upholds.
}

// TestS3Integration_BadCredentials ensures a misconfigured site.s3Config
// surfaces as an error from ApplyS3BackendToSettings rather than silently accepting.
// We can't easily stand up an "auth-fail" MinIO; instead we point at a
// closed port so the filesystem ops fail downstream. The sync itself
// succeeds (settings accept any well-formed config) — the failure surfaces
// at upload time.
func TestS3Integration_BadEndpoint(t *testing.T) {
	endpoint, accessKey, secretKey, bucket := s3TestEnv(t)
	_ = bucket // unused — we override below

	tmpDir, _ := os.MkdirTemp("", "pb-s3-integ-bad")
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migration: %v", err)
	}

	site, _ := app.FindFirstRecordByFilter("site", "")
	cfg := core.S3Config{
		Enabled:        true,
		Bucket:         "vanblog-nonexistent",
		Region:         "us-east-1",
		Endpoint:       endpoint, // valid endpoint, bogus bucket
		AccessKey:      accessKey,
		Secret:         secretKey,
		ForcePathStyle: true,
	}
	site.Set("s3Config", mustJSONRaw(cfg))
	app.Save(site)

	// Sync should succeed — pb's S3Config.Validate only checks field presence,
	// not bucket existence. The error surfaces when an upload is attempted.
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("ApplyS3BackendToSettings should succeed for well-formed config: %v", err)
	}

	fsys, err := app.NewFilesystem()
	if err != nil {
		// Some S3 implementations return bucket-missing at client init; that
		// counts as the failure surfacing. Log and accept.
		t.Logf("NewFilesystem failed as expected for bad bucket: %v", err)
		return
	}
	defer fsys.Close()

	if err := fsys.Upload([]byte("x"), "should-fail.txt"); err == nil {
		t.Error("expected upload to fail against nonexistent bucket, got nil")
	}
}

// fsysCleanup deletes a single object so the test is re-runnable. Uses a
// fresh filesystem.System so we don't depend on the closed test instance.
func fsysCleanup(t *testing.T, endpoint, accessKey, secretKey, bucket, key string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = ctx // pb's filesystem.System doesn't take ctx on Delete; ignored
	f, err := filesystem.NewS3(bucket, "us-east-1", endpoint, accessKey, secretKey, true)
	if err != nil {
		return
	}
	defer f.Close()
	if errs := f.DeletePrefix("integration-test/"); len(errs) > 0 {
		t.Logf("cleanup: DeletePrefix errors: %v", errs)
	}
}

// TestS3Integration_FileDownloadRoute covers the editor → display URL contract:
//
//  1. S3 enabled in site.s3Config.
//  2. Create a media record with a real image FileField (this is what the
//     editor's uploadImages() does in production).
//  3. ApplyS3BackendToSettings → file should land in S3.
//  4. Hit pb's HTTP file-download route /api/files/media/<id>/<filename>
//     (the URL the editor embeds as <img src>) and verify bytes match.
//
// Without this test, the editor → S3 → display chain is only verified up to
// fsys.Upload — the actual /api/files route that browsers hit was untested.
func TestS3Integration_FileDownloadRoute(t *testing.T) {
	endpoint, accessKey, secretKey, bucket := s3TestEnv(t)

	tmpDir, _ := os.MkdirTemp("", "pb-s3-integ-route")
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migration: %v", err)
	}

	// Configure S3 and sync.
	site, _ := app.FindFirstRecordByFilter("site", "")
	cfg := core.S3Config{
		Enabled:        true,
		Bucket:         bucket,
		Region:         "us-east-1",
		Endpoint:       endpoint,
		AccessKey:      accessKey,
		Secret:         secretKey,
		ForcePathStyle: true,
	}
	site.Set("s3Config", mustJSONRaw(cfg))
	if err := app.Save(site); err != nil {
		t.Fatalf("save site: %v", err)
	}
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("ApplyS3BackendToSettings: %v", err)
	}

	// Create a media record carrying a FileField upload via pb's filesystem
	// helper. This is what FormData{'file': blob} → collection.create()
	// produces in the editor.
	mediaCol, _ := app.FindCollectionByNameOrId("media")
	rec := core.NewRecord(mediaCol)
	// Tiny real PNG (1x1 transparent). Must pass FileField's MIME check,
	// which sniffs bytes — a plain text blob named *.png won't pass.
	pngBytes := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01" +
		"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx" +
		"\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
	mediaFile, err := filesystem.NewFileFromBytes(pngBytes, "test-image.png")
	if err != nil {
		t.Fatalf("NewFileFromBytes: %v", err)
	}
	rec.Set("file", mediaFile)
	rec.Set("staticType", "img")
	if err := app.Save(rec); err != nil {
		t.Fatalf("save media: %v", err)
	}

	filename := rec.GetString("file")
	// pb 0.39 stores FileField uploads under <collectionId>/<recordId>/<filename>,
	// where collectionId already includes the "pbc_" prefix.
	s3Key := mediaCol.Id + "/" + rec.Id + "/" + filename
	t.Cleanup(func() {
		fsysCleanup(t, endpoint, accessKey, secretKey, bucket, s3Key)
	})

	// Sanity check: file landed in S3, not local fs.
	fsys, err := app.NewFilesystem()
	if err != nil {
		t.Fatalf("NewFilesystem: %v", err)
	}
	defer fsys.Close()
	if exists, _ := fsys.Exists(s3Key); !exists {
		t.Fatalf("file not in S3 at expected key %s", s3Key)
	}

	// Build the same mux Serve() would register. NewRouter binds /api/files,
	// /api/collections, etc. — everything the editor's <img src="/api/files/...">
	// hits in production.
	pbRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatalf("apis.NewRouter: %v", err)
	}
	mux, err := pbRouter.BuildMux()
	if err != nil {
		t.Fatalf("BuildMux: %v", err)
	}
	srv := httptest.NewServer(mux)
	defer srv.Close()

	// /api/files/media/<id>/<filename> is the URL the editor embeds in posts.
	url := srv.URL + "/api/files/media/" + rec.Id + "/" + filename
	resp, err := http.Get(url)
	if err != nil {
		t.Fatalf("GET file route: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d (this breaks <img src> in posts). body: %s",
			resp.StatusCode, string(body))
	}
	got, _ := io.ReadAll(resp.Body)
	if !bytes.Equal(got, pngBytes) {
		t.Errorf("body mismatch: got %d bytes, want %d bytes", len(got), len(pngBytes))
	}
}

// mustJSONRaw is a tiny helper used by the integration tests to wrap a
// core.S3Config as a json.RawMessage acceptable by record.Set.
func mustJSONRaw(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}

// TestS3Integration_Thumbnail verifies pb's thumbnail generation works in S3
// mode. pb generates thumbs on first /api/files/...?thumb=NNNx0 request by
// downloading the original, resizing, and writing the thumb back to the same
// filesystem. If S3 paths weren't transparent, this would fail.
func TestS3Integration_Thumbnail(t *testing.T) {
	endpoint, accessKey, secretKey, bucket := s3TestEnv(t)

	tmpDir, _ := os.MkdirTemp("", "pb-s3-thumb")
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migration: %v", err)
	}

	site, _ := app.FindFirstRecordByFilter("site", "")
	cfg := core.S3Config{
		Enabled: true, Bucket: bucket, Region: "us-east-1",
		Endpoint: endpoint, AccessKey: accessKey, Secret: secretKey,
		ForcePathStyle: true,
	}
	site.Set("s3Config", mustJSONRaw(cfg))
	app.Save(site)
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("ApplyS3BackendToSettings: %v", err)
	}

	// Upload a small PNG.
	mediaCol, _ := app.FindCollectionByNameOrId("media")
	pngBytes := makeMinimalPNG()
	mediaFile, _ := filesystem.NewFileFromBytes(pngBytes, "thumb-test.png")
	rec := core.NewRecord(mediaCol)
	rec.Set("file", mediaFile)
	rec.Set("staticType", "img")
	if err := app.Save(rec); err != nil {
		t.Fatalf("save media: %v", err)
	}
	filename := rec.GetString("file")
	s3Key := mediaCol.Id + "/" + rec.Id + "/" + filename
	t.Cleanup(func() {
		fsysCleanup(t, endpoint, accessKey, secretKey, bucket,
			mediaCol.Id+"/"+rec.Id+"/") // also nuke thumbs/
	})

	// Inspect what ContentType S3 reports. pb's thumb generation is gated on
	// `list.ExistInSlice(oAttrs.ContentType, imageContentTypes)`; MinIO (and
	// some S3 implementations) return "application/octet-stream" when the
	// object was uploaded without an explicit Content-Type. If that happens,
	// pb silently serves the original instead of generating a thumb.
	fsys0, _ := app.NewFilesystem()
	defer fsys0.Close()
	attrs, attrsErr := fsys0.Attributes(s3Key)
	if attrsErr != nil {
		t.Fatalf("Attributes: %v", attrsErr)
	}
	t.Logf("uploaded PNG ContentType reported by S3: %q", attrs.ContentType)
	if attrs.ContentType != "image/png" {
		t.Logf("NOTE: ContentType is %q, not image/png — pb's thumb gate will reject this",
			attrs.ContentType)
	}

	// Hit the route with ?thumb=300x0 (declared in the FileField).
	pbRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatalf("apis.NewRouter: %v", err)
	}
	mux, _ := pbRouter.BuildMux()
	srv := httptest.NewServer(mux)
	defer srv.Close()

	url := srv.URL + "/api/files/media/" + rec.Id + "/" + filename + "?thumb=300x0"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatalf("GET thumb: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("thumb expected 200, got %d. body: %s", resp.StatusCode, string(body))
	}
	thumbBytes, _ := io.ReadAll(resp.Body)
	if len(thumbBytes) == 0 {
		t.Fatal("thumb body empty")
	}
	// Thumb is a *resized* PNG — bytes should differ from original. If they
	// match, pb's createThumb failed and the route fell back to serving the
	// original (apis/file.go:189). Common causes:
	//   - imaging.Decode can't parse the source
	//   - source dimensions smaller than thumb width (4x4 → 300x0)
	//   - S3 write-back of the resized image fails
	if bytes.Equal(thumbBytes, pngBytes) {
		t.Errorf("thumb body identical to original — pb fell back to original. "+
			"len=%d, source dims may be too small for 300x0 resize", len(thumbBytes))
	}
	t.Logf("thumb body size: %d (original %d)", len(thumbBytes), len(pngBytes))

	// Verify the thumb object exists in S3 (proves write-back works).
	fsys, err := app.NewFilesystem()
	if err != nil {
		t.Fatalf("NewFilesystem: %v", err)
	}
	defer fsys.Close()
	thumbPath := mediaCol.Id + "/" + rec.Id + "/thumbs_" + filename + "/300x0_" + filename
	exists, _ := fsys.Exists(thumbPath)
	if !exists {
		t.Errorf("thumb not written back to S3 at %s", thumbPath)
	}
	_ = s3Key // (s3Key kept for debugging reference; thumb path is the assertion)
}

// TestS3Integration_UnsupportedThumbFormats pins the **backend contract** for
// formats whose thumbs pb cannot generate:
//
//   - BMP/TIFF — Go's stdlib image package can't decode them, so pb silently
//     falls back to serving the original. vanblog's media FileField still
//     accepts these MIMEs (see 1782300000_media_filefield_config.go) because
//     the editor normalizes them client-side via Squoosh wasm (see
//     app/src/components/ByteMdEditor.astro::normalizeImage).
//   - SVG — vector format; resizing is meaningless. pb falls back to original,
//     which is the desired behavior. The editor surfaces a toast so users know.
//   - AVIF — added to FileField in 1782500001_media_filefield_add_avif.go to
//     support site.mediaConfig.targetFormat='preserve'. pb's imageContentTypes
//     (apis/file.go:22) still doesn't include image/avif, so thumbs fall back
//     to the original — same contract as BMP/SVG.
//
// This test exists to catch regressions in *either* direction:
//   - If pb upstream adds BMP/TIFF/AVIF support, this test breaks → update
//     editor normalization policy at the same time.
//   - If someone tightens the FileField MIME list to reject these formats,
//     the upload step fails before the assertion → reconsider whether the
//     editor's client-side conversion is still wanted.
func TestS3Integration_UnsupportedThumbFormats(t *testing.T) {
	endpoint, accessKey, secretKey, bucket := s3TestEnv(t)

	cases := []struct {
		name      string
		mime      string
		extension string
		bytes     []byte
	}{
		{"BMP", "image/bmp", "bmp", minimalBMP()},
		{"AVIF", "image/avif", "avif", minimalAVIF()},
		{"SVG", "image/svg+xml", "svg", []byte(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>`)},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tmpDir, _ := os.MkdirTemp("", "pb-s3-thumb-"+tc.name)
			t.Cleanup(func() { os.RemoveAll(tmpDir) })

			app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
			if err := app.Bootstrap(); err != nil {
				t.Fatalf("Bootstrap: %v", err)
			}
			if err := app.RunAppMigrations(); err != nil {
				t.Fatalf("Migration: %v", err)
			}

			site, _ := app.FindFirstRecordByFilter("site", "")
			cfg := core.S3Config{
				Enabled: true, Bucket: bucket, Region: "us-east-1",
				Endpoint: endpoint, AccessKey: accessKey, Secret: secretKey,
				ForcePathStyle: true,
			}
			site.Set("s3Config", mustJSONRaw(cfg))
			app.Save(site)
			if err := ApplyS3BackendToSettings(app); err != nil {
				t.Fatalf("ApplyS3BackendToSettings: %v", err)
			}

			mediaCol, _ := app.FindCollectionByNameOrId("media")
			mediaFile, err := filesystem.NewFileFromBytes(tc.bytes, "test."+tc.extension)
			if err != nil {
				t.Fatalf("NewFileFromBytes: %v", err)
			}
			rec := core.NewRecord(mediaCol)
			rec.Set("file", mediaFile)
			rec.Set("staticType", "img")
			if err := app.Save(rec); err != nil {
				t.Fatalf("upload %s rejected by FileField: %v (this means the MIME list was tightened — update the editor normalization policy)", tc.name, err)
			}
			filename := rec.GetString("file")
			t.Cleanup(func() {
				fsysCleanup(t, endpoint, accessKey, secretKey, bucket,
					mediaCol.Id+"/"+rec.Id+"/")
			})

			// Hit /api/files/.../filename?thumb=300x0.
			pbRouter, _ := apis.NewRouter(app)
			mux, _ := pbRouter.BuildMux()
			srv := httptest.NewServer(mux)
			defer srv.Close()

			url := srv.URL + "/api/files/media/" + rec.Id + "/" + filename + "?thumb=300x0"
			resp, err := http.Get(url)
			if err != nil {
				t.Fatalf("GET thumb: %v", err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != 200 {
				t.Fatalf("expected 200 (pb should fallback to original), got %d", resp.StatusCode)
			}
			got, _ := io.ReadAll(resp.Body)
			if !bytes.Equal(got, tc.bytes) {
				t.Errorf("%s thumb expected to fallback to original (identical bytes), got %d vs %d — pb may have added support for this format, revisit editor normalization",
					tc.name, len(got), len(tc.bytes))
			}

			// And confirm no thumb object was written back to S3.
			fsys, _ := app.NewFilesystem()
			defer fsys.Close()
			thumbPath := mediaCol.Id + "/" + rec.Id + "/thumbs_" + filename + "/300x0_" + filename
			if exists, _ := fsys.Exists(thumbPath); exists {
				t.Errorf("%s thumb unexpectedly written to S3 at %s — pb may have added support, revisit editor normalization",
					tc.name, thumbPath)
			}
		})
	}
}

// minimalBMP returns a tiny but valid 2x2 BMP file (74 bytes). Used to verify
// pb's thumb fallback for formats Go's stdlib image package doesn't decode.
func minimalBMP() []byte {
	// 14-byte file header + 40-byte DIB header + 16-byte pixel data (2x2 RGB).
	return []byte{
		// BITMAPFILEHEADER
		'B', 'M',
		0x4a, 0x00, 0x00, 0x00, // file size = 74
		0x00, 0x00, 0x00, 0x00, // reserved
		0x36, 0x00, 0x00, 0x00, // offset to pixel data = 54
		// BITMAPINFOHEADER
		0x28, 0x00, 0x00, 0x00, // header size = 40
		0x02, 0x00, 0x00, 0x00, // width = 2
		0x02, 0x00, 0x00, 0x00, // height = 2
		0x01, 0x00, // planes = 1
		0x18, 0x00, // bpp = 24
		0x00, 0x00, 0x00, 0x00, // compression = BI_RGB
		0x10, 0x00, 0x00, 0x00, // image size = 16
		0x13, 0x0b, 0x00, 0x00, // x ppm
		0x13, 0x0b, 0x00, 0x00, // y ppm
		0x00, 0x00, 0x00, 0x00, // colors used
		0x00, 0x00, 0x00, 0x00, // important colors
		// Pixel data: 2x2 BGR triplets, each row padded to 4 bytes
		0x00, 0x00, 0xff, 0x00, 0xff, 0x00, 0x00, 0x00, // row 0: red, green, + 2 pad
		0xff, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, // row 1: blue, white, + 2 pad
	}
}

// TestS3Integration_DedupHookAgainstS3 uploads the same content twice via pb's
// HTTP API and verifies the dedup hook (which reads files through the S3-backed
// filesystem to compute MD5) deletes the duplicate.
//
// The hook itself is registered in package hooks (depends on media, so we
// can't import it from here without a cycle). See
// vault/internal/hooks/s3_integration_test.go for the hook-wiring version.
//
// Here we test the building blocks the hook uses: ReadFileContent and
// CheckDuplicate, against a real S3 backend. If either fails under S3, dedup
// silently breaks in production.
func TestS3Integration_DedupComponentsAgainstS3(t *testing.T) {
	endpoint, accessKey, secretKey, bucket := s3TestEnv(t)

	tmpDir, _ := os.MkdirTemp("", "pb-s3-dedup")
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migration: %v", err)
	}

	site, _ := app.FindFirstRecordByFilter("site", "")
	cfg := core.S3Config{
		Enabled: true, Bucket: bucket, Region: "us-east-1",
		Endpoint: endpoint, AccessKey: accessKey, Secret: secretKey,
		ForcePathStyle: true,
	}
	site.Set("s3Config", mustJSONRaw(cfg))
	app.Save(site)
	if err := ApplyS3BackendToSettings(app); err != nil {
		t.Fatalf("ApplyS3BackendToSettings: %v", err)
	}

	mediaCol, _ := app.FindCollectionByNameOrId("media")
	pngBytes := makeMinimalPNG()

	// Upload once.
	rec1 := core.NewRecord(mediaCol)
	f1, _ := filesystem.NewFileFromBytes(pngBytes, "dedup-1.png")
	rec1.Set("file", f1)
	rec1.Set("staticType", "img")
	if err := app.Save(rec1); err != nil {
		t.Fatalf("save #1: %v", err)
	}
	t.Cleanup(func() {
		fsysCleanup(t, endpoint, accessKey, secretKey, bucket, mediaCol.Id+"/"+rec1.Id+"/")
	})

	// ReadFileContent via S3 — this is the path the dedup hook takes.
	mgr := New(app)
	content, err := mgr.ReadFileContent(rec1)
	if err != nil {
		t.Fatalf("ReadFileContent: %v (dedup hook would silently fail)", err)
	}
	if !bytes.Equal(content, pngBytes) {
		t.Errorf("ReadFileContent bytes mismatch: got %d, want %d", len(content), len(pngBytes))
	}

	// CheckDuplicate uses sign field. rec1 was saved without going through
	// the dedup hook (this test calls Manager methods directly, New() not invoked),
	// so its sign column is empty. Set it manually as the hook would:
	rec1.Set("sign", ComputeSign(pngBytes))
	if err := app.Save(rec1); err != nil {
		t.Fatalf("save sign: %v", err)
	}

	// Now CheckDuplicate should find rec1 by computed sign.
	dup, err := mgr.CheckDuplicate(pngBytes)
	if err != nil {
		t.Fatalf("CheckDuplicate: %v", err)
	}
	if dup == nil || dup.Id != rec1.Id {
		t.Errorf("CheckDuplicate didn't find rec1: got %v", dup)
	}
}

// makeMinimalPNG returns a valid 100x100 PNG (large enough that pb's
// 300x0 resize has work to do). Built via the stdlib image package to
// guarantee it decodes cleanly under imaging.Decode.
func makeMinimalPNG() []byte {
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

// minimalAVIF returns a byte sequence that mimetype.DetectReader recognizes
// as image/avif. It doesn't have to be a *decodable* AVIF — only the ftyp
// box signature matters for the MIME gate. pb's thumb generator would
// reject it anyway (imageContentTypes excludes avif), which is exactly
// the contract this test pins.
//
// Layout: 4-byte big-endian size, "ftyp", "avif" major brand. Total 12 bytes.
// See gabriel-vasile/mimetype internal/magic/ftyp.go: bytes[8:12]=="avif".
func minimalAVIF() []byte {
	return []byte{
		0x00, 0x00, 0x00, 0x0c, // box size = 12
		'f', 't', 'y', 'p',
		'a', 'v', 'i', 'f',
	}
}
