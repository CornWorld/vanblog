package admin

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

func setBackupKeep(t *testing.T, app core.App, v int) {
	t.Helper()
	siteRec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil {
		t.Fatalf("site get: %v", err)
	}
	var opts map[string]any
	if raw := siteRec.GetString("displayOptions"); raw != "" {
		_ = json.Unmarshal([]byte(raw), &opts)
	}
	if opts == nil {
		opts = map[string]any{}
	}
	opts["backupKeep"] = v
	b, _ := json.Marshal(opts)
	siteRec.Set("displayOptions", string(b))
	if err := app.Save(siteRec); err != nil {
		t.Fatalf("site save: %v", err)
	}
}

func countBackups(t *testing.T, app core.App) int {
	t.Helper()
	fsys, err := openBackupsFilesystem(app, context.Background())
	if err != nil {
		t.Fatalf("open backups filesystem: %v", err)
	}
	defer fsys.Close()
	files, err := fsys.List("")
	if err != nil {
		t.Fatalf("list backups: %v", err)
	}
	n := 0
	for _, f := range files {
		if !f.IsDir && strings.HasPrefix(f.Key, backupNamePrefix) {
			n++
		}
	}
	return n
}

// TestDailyBackupCronRegistered 钉住注册面:cron 缺席 = 备份安全网静默失效。
func TestDailyBackupCronRegistered(t *testing.T) {
	app := setupBackupApp(t)
	m := New(app)
	found := false
	for _, job := range app.Cron().Jobs() {
		if job.Id() == backupCronId {
			found = true
		}
	}
	if !found {
		t.Fatal("cron job backups-daily not registered")
	}
	_ = m
}

// TestDailyBackupCreatesAndPrunes 钉住行为:每日备份创建一份;超过
// backupKeep 的最旧 vanblog_backup_* 被裁剪;<=0 = 不裁剪。
func TestDailyBackupCreatesAndPrunes(t *testing.T) {
	app := setupBackupApp(t)
	m := New(app)

	setBackupKeep(t, app, 2)
	for i := 0; i < 4; i++ {
		m.runDailyBackup()
	}
	if got := countBackups(t, app); got != 2 {
		t.Fatalf("backups with keep=2 after 4 runs = %d, want 2", got)
	}

	setBackupKeep(t, app, 0)
	m.runDailyBackup()
	if got := countBackups(t, app); got != 3 {
		t.Fatalf("backups with keep=0 after 1 more run = %d, want 3 (unlimited)", got)
	}
}
