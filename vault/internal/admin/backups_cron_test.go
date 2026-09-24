package admin

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"sort"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
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

// backupKeys lists vanblog_backup_* keys ascending. 命名含纳秒时间戳
// (newBackupName),字典序即时间序——keys[0] 恒为最旧。
func backupKeys(t *testing.T, app core.App) []string {
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
	keys := make([]string, 0, len(files))
	for _, f := range files {
		if !f.IsDir && strings.HasPrefix(f.Key, backupNamePrefix) {
			keys = append(keys, f.Key)
		}
	}
	sort.Strings(keys)
	return keys
}

func countBackups(t *testing.T, app core.App) int {
	t.Helper()
	return len(backupKeys(t, app))
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

// TestPruneSkipsActiveBackup 钉住:Restore 正在读的备份
// (core.StoreKeyActiveBackup)绝不被裁剪删除——runDailyBackup 开头的
// conflict 检查挡不住「裁剪进行中才开始的 restore」,删了就是恢复中途
// 404(与 handleDeleteBackup 的在用守卫同口径)。
func TestPruneSkipsActiveBackup(t *testing.T) {
	app := setupBackupApp(t)
	m := New(app)

	// keep=0(不限)造 3 份,造份数据本身不触发裁剪。
	setBackupKeep(t, app, 0)
	for range 3 {
		m.runDailyBackup()
	}
	active := backupKeys(t, app)[0] // 最旧
	app.Store().Set(core.StoreKeyActiveBackup, active)
	if err := m.pruneOldBackups(1); err != nil {
		t.Fatalf("prune with active backup: %v", err)
	}
	keys := backupKeys(t, app)
	if len(keys) != 2 || !slices.Contains(keys, active) {
		t.Fatalf("after prune(keep=1, active=oldest): keys = %v, want [newest, active]", keys)
	}

	app.Store().Remove(core.StoreKeyActiveBackup)
	if err := m.pruneOldBackups(1); err != nil {
		t.Fatalf("prune after active cleared: %v", err)
	}
	if keys = backupKeys(t, app); len(keys) != 1 || keys[0] == active {
		t.Fatalf("after prune(keep=1, no active): keys = %v, want [newest]", keys)
	}
}

// TestDailyBackupBadConfigSkipsPrune 钉住 fail-closed:displayOptions 坏
// JSON 时 backupKeep 必须跳过裁剪(只增不删)。回退 defaultBackupKeep 是
// 数据丢失方向的 fail-open——管理员配了保留 30,一次读失败就被裁到 7。
// 坏 JSON 经 SaveNoValidate 落库(JSONField 校验会拒收,corrupted row 恰是
// 该守卫针对的真实形态)。
func TestDailyBackupBadConfigSkipsPrune(t *testing.T) {
	app := setupBackupApp(t)
	m := New(app)

	// 造 8 份(> defaultBackupKeep=7):若坏配置回退默认值,本次运行就会
	// 触发裁剪,测试即失败。
	setBackupKeep(t, app, 0)
	for range 8 {
		m.runDailyBackup()
	}

	siteRec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil {
		t.Fatalf("site get: %v", err)
	}
	siteRec.Set("displayOptions", "{bad")
	if err := app.SaveNoValidate(siteRec); err != nil {
		t.Fatalf("site save (no validate): %v", err)
	}

	before := countBackups(t, app)
	m.runDailyBackup()
	if got := countBackups(t, app); got != before+1 {
		t.Fatalf("backups after bad-config run = %d, want %d (create only, prune skipped)", got, before+1)
	}
}

// flakyBackupsApp 只让 NewBackupsFilesystem 失败。pb 的 CreateBackup 在
// *BaseApp 具体接收者上运行(v0.40.1 core/backup_create.go),不经本
// wrapper——创建走真实存储成功,而 openBackupsFilesystem(接口调用)必
// 败。确定性复现「裁剪失灵」,免 chmod/root skip。
type flakyBackupsApp struct {
	core.App
}

func (flakyBackupsApp) NewBackupsFilesystem() (*filesystem.System, error) {
	return nil, errors.New("flaky backups filesystem")
}

// TestPruneFailureWritesAuditRow 钉住:裁剪失灵必须写 result=failure 的
// backup.prune 审计行——只 slog 的话,备份目录静默膨胀在审计链里不可见。
// 审计 writeRow 是同步 app.Save,断言无需轮询。
func TestPruneFailureWritesAuditRow(t *testing.T) {
	app := setupBackupApp(t)
	// 直接 &Manager{app: flaky}:New(flaky) 会再次 MustAdd cron id
	// backups-daily 而重复注册 panic。
	flaky := flakyBackupsApp{App: app}
	m := &Manager{app: flaky}

	setBackupKeep(t, app, 1)
	m.runDailyBackup() // 创建成功(BaseApp 内部路径),裁剪必败(wrapper)

	if got := countBackups(t, app); got != 1 {
		t.Fatalf("backups = %d, want 1 (create must succeed past the wrapper)", got)
	}
	rows, err := app.FindRecordsByFilter("audits", "action={:a}", "-created", 10, 0,
		map[string]any{"a": "backup.prune"})
	if err != nil {
		t.Fatalf("query audits: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("backup.prune rows = %d, want 1", len(rows))
	}
	if rows[0].GetString("result") != "failure" {
		t.Fatalf("result = %q, want failure", rows[0].GetString("result"))
	}
}
