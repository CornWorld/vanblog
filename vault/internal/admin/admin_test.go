package admin

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func setupBackupApp(t *testing.T) core.App {
	t.Helper()
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	t.Cleanup(func() { _ = app.ResetBootstrapState() })
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migration: %v", err)
	}
	return app
}

func TestValidateBackupKey(t *testing.T) {
	valid := []string{"backup.zip", "vanblog_backup_20260714_010203.zip", "UPPER.ZIP"}
	for _, key := range valid {
		if err := validateBackupKey(key); err != nil {
			t.Errorf("validateBackupKey(%q): %v", key, err)
		}
	}
	invalid := []string{"", "backup", "backup.tar.gz", "../backup.zip", "a/backup.zip", ".zip/../x.zip"}
	for _, key := range invalid {
		if err := validateBackupKey(key); err == nil {
			t.Errorf("validateBackupKey(%q) unexpectedly succeeded", key)
		}
	}
}

func TestNewBackupName(t *testing.T) {
	name := newBackupName(time.Date(2026, 7, 14, 1, 2, 3, 4, time.UTC))
	if !strings.HasPrefix(name, "vanblog_backup_20260714_010203.") || !strings.HasSuffix(name, ".zip") {
		t.Fatalf("unexpected backup name %q", name)
	}
	if err := validateBackupKey(name); err != nil {
		t.Fatalf("generated name invalid: %v", err)
	}
}

func TestBackupLifecycle(t *testing.T) {
	app := setupBackupApp(t)
	name := newBackupName(time.Now())
	if err := app.CreateBackup(t.Context(), name); err != nil {
		t.Fatalf("CreateBackup: %v", err)
	}

	fsys, err := openBackupsFilesystem(app, t.Context())
	if err != nil {
		t.Fatalf("NewBackupsFilesystem: %v", err)
	}
	if err := ensureBackupExists(fsys, name); err != nil {
		t.Fatalf("ensureBackupExists: %v", err)
	}
	files, err := fsys.List("")
	if err != nil || len(files) != 1 || files[0].Key != name {
		t.Fatalf("List: files=%v err=%v", files, err)
	}
	reader, err := fsys.GetReader(name)
	if err != nil {
		t.Fatalf("GetReader: %v", err)
	}
	backupPath := filepath.Join(t.TempDir(), name)
	out, err := os.Create(backupPath)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := reader.WriteTo(out); err != nil {
		t.Fatalf("copy backup: %v", err)
	}
	_ = reader.Close()
	_ = out.Close()

	zr, err := zip.OpenReader(backupPath)
	if err != nil {
		t.Fatalf("open backup zip: %v", err)
	}
	defer zr.Close()
	foundDB := false
	for _, f := range zr.File {
		if f.Name == "data.db" {
			foundDB = true
			break
		}
	}
	if !foundDB {
		t.Fatal("backup zip does not contain data.db")
	}

	if err := fsys.Delete(name); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if err := ensureBackupExists(fsys, name); err == nil {
		t.Fatal("deleted backup still exists")
	}
	_ = fsys.Close()
}

func TestBackupConflict(t *testing.T) {
	app := setupBackupApp(t)
	if backupConflict(app) {
		t.Fatal("fresh app unexpectedly has active backup")
	}
	app.Store().Set(core.StoreKeyActiveBackup, "active.zip")
	if !backupConflict(app) {
		t.Fatal("active backup was not detected")
	}
}
