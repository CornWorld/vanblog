package media

import (
	"bytes"
	"os"
	"testing"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

func setupApp(t *testing.T) core.App {
	t.Helper()
	tmpDir, _ := os.MkdirTemp("", "pb-media-test")
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migration: %v", err)
	}
	return app
}

func TestComputeSign(t *testing.T) {
	data := []byte("hello world")
	sign := ComputeSign(data)
	if sign != "5eb63bbbe01eeed093cb22bb8f5acdc3" {
		t.Errorf("sign = %q, want known MD5", sign)
	}

	// Same input → same sign
	sign2 := ComputeSign(data)
	if sign != sign2 {
		t.Error("same input should produce same sign")
	}

	// Different input → different sign
	sign3 := ComputeSign([]byte("hello world!"))
	if sign == sign3 {
		t.Error("different input should produce different sign")
	}
}

func TestCheckDuplicate_None(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	existing, err := mgr.CheckDuplicate([]byte("test content"))
	if err != nil {
		t.Fatalf("CheckDuplicate: %v", err)
	}
	if existing != nil {
		t.Error("expected nil for new content")
	}
}

func TestUploadOrDedup_New(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	content := []byte("fake image data")
	record, isNew, err := mgr.UploadOrDedup(content, "img", "local", "png", "")
	if err != nil {
		t.Fatalf("UploadOrDedup: %v", err)
	}
	if !isNew {
		t.Error("expected new record for first upload")
	}
	if record.GetString("sign") != ComputeSign(content) {
		t.Error("sign mismatch")
	}
	if record.GetString("staticType") != "img" {
		t.Errorf("staticType = %q, want %q", record.GetString("staticType"), "img")
	}
}

func TestUploadOrDedup_Duplicate(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	content := []byte("same image data")

	// First upload
	record1, isNew1, _ := mgr.UploadOrDedup(content, "img", "local", "png", "")
	if !isNew1 {
		t.Fatal("first upload should be new")
	}

	// Second upload of same content
	record2, isNew2, _ := mgr.UploadOrDedup(content, "img", "local", "png", "")
	if isNew2 {
		t.Fatal("second upload of same content should be duplicate")
	}
	if record2.Id != record1.Id {
		t.Errorf("duplicate should return same record: %s != %s", record2.Id, record1.Id)
	}
}

func TestCreateRecord(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	sign := "abc123"
	record, err := mgr.CreateRecord(sign, "favicon", "local", "ico", "/favicon.ico", []byte(`{"size":1024}`))
	if err != nil {
		t.Fatalf("CreateRecord: %v", err)
	}

	// Verify
	loaded, _ := app.FindRecordById("media", record.Id)
	if loaded.GetString("sign") != sign {
		t.Errorf("sign = %q, want %q", loaded.GetString("sign"), sign)
	}
	if loaded.GetString("staticType") != "favicon" {
		t.Errorf("staticType = %q", loaded.GetString("staticType"))
	}
}

// TestReadFileContent_AfterUpload verifies that ReadFileContent can locate a file
// after a real pb file upload (path = BaseFilesPath + filename).
// Regression test: previously used record.Id + "/" + filename, missing the
// collectionId level → every dedup read failed.
func TestReadFileContent_AfterUpload(t *testing.T) {
	app := setupApp(t)
	mgr := New(app)

	col, err := app.FindCollectionByNameOrId("media")
	if err != nil {
		t.Fatalf("find collection: %v", err)
	}

	// PNG file (media collection restricts to image/* MIME types)
	content := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xcf\xc0\x00\x00\x00\x03\x00\x01\x5d\xcc\xdb\xda\x00\x00\x00\x00IEND\xaeB`\x82")
	file, err := filesystem.NewFileFromBytes(content, "test.png")
	if err != nil {
		t.Fatalf("NewFileFromBytes: %v", err)
	}
	file.Name = "test.png"

	record := core.NewRecord(col)
	record.Set("staticType", "img")
	record.Set("storageType", "local")
	record.Set("file", []*filesystem.File{file})
	if err := app.Save(record); err != nil {
		t.Fatalf("save: %v", err)
	}

	got, err := mgr.ReadFileContent(record)
	if err != nil {
		t.Fatalf("ReadFileContent: %v", err)
	}
	if !bytes.Equal(got, content) {
		t.Errorf("ReadFileContent returned %q, want %q", got, content)
	}
}
