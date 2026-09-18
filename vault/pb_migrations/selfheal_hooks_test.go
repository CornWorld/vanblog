package migrations

// selfheal.pb.js 钉子(2026-09-18)。
//
// 每日缓存自愈 cron 住在 pb_hooks/selfheal.pb.js(用户可关闭/改造的平台
// 自带钩子;发布触发的失效本体在 internal/article,Go 层)。本测试锁:
//  1. cron 注册面——jsvm 装载 pb_hooks 后 "posts-revalidate-selfheal" 必须存在
//     (jsvm 不注册 = 静默失效,lessons §1.1);
//  2. 开关语义——site.displayOptions.revalidateSelfHeal=false 时 Run() 不发
//     Astro 请求;缺省/true 时发;
//  3. 失败提醒——Astro 非 200 时写 result=failure 审计行
//     (action="revalidate.selfheal",管理员审计页可见)。
//
// 注意:goja VM 装载较慢,本测试耗时为正常现象。

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
)

func setupSelfHealApp(t *testing.T) *pocketbase.PocketBase {
	t.Helper()
	tmpDir := t.TempDir()
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("RunAppMigrations: %v", err)
	}
	hooksDir, err := filepath.Abs("../pb_hooks")
	if err != nil {
		t.Fatalf("filepath.Abs: %v", err)
	}
	if _, err := os.Stat(hooksDir); err != nil {
		t.Fatalf("pb_hooks dir missing at %s: %v", hooksDir, err)
	}
	jsvm.MustRegister(app, jsvm.Config{
		HooksDir:      hooksDir,
		HooksWatch:    false,
		HooksPoolSize: 5,
	})
	return app
}

func selfHealJob(t *testing.T, app *pocketbase.PocketBase) (found bool) {
	t.Helper()
	for _, job := range app.Cron().Jobs() {
		if job.Id() == "posts-revalidate-selfheal" {
			found = true
		}
	}
	return found
}

func setSelfHealFlag(t *testing.T, app *pocketbase.PocketBase, v bool) {
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
	opts["revalidateSelfHeal"] = v
	b, _ := json.Marshal(opts)
	siteRec.Set("displayOptions", string(b))
	if err := app.Save(siteRec); err != nil {
		t.Fatalf("site save: %v", err)
	}
}

func runSelfHealJob(t *testing.T, app *pocketbase.PocketBase) {
	t.Helper()
	for _, job := range app.Cron().Jobs() {
		if job.Id() == "posts-revalidate-selfheal" {
			job.Run()
			return
		}
	}
	t.Fatal("cron job posts-revalidate-selfheal not registered")
}

func TestSelfHealHookBehavior(t *testing.T) {
	app := setupSelfHealApp(t)

	// 1. 注册面:jsvm 装载 pb_hooks 后 cron 必须注册。
	if !selfHealJob(t, app) {
		t.Fatal("cron job posts-revalidate-selfheal not registered (selfheal.pb.js not loaded?)")
	}

	// 2. 缺省开启:Run() 发一次 Astro 失效请求。
	var hits int32
	okSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		w.WriteHeader(200)
	}))
	defer okSrv.Close()
	t.Setenv("ASTRO_URL", okSrv.URL)
	runSelfHealJob(t, app)
	if got := atomic.LoadInt32(&hits); got != 1 {
		t.Fatalf("default enabled: astro hits = %d, want 1", got)
	}

	// 3. 开关关闭:再 Run() 不发请求(运行时读取,无需重启)。
	setSelfHealFlag(t, app, false)
	runSelfHealJob(t, app)
	if got := atomic.LoadInt32(&hits); got != 1 {
		t.Fatalf("disabled: astro hits = %d, want still 1", got)
	}

	// 4. 失败提醒:Astro 非 200 → result=failure 审计行。
	setSelfHealFlag(t, app, true)
	badSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(502)
	}))
	defer badSrv.Close()
	t.Setenv("ASTRO_URL", badSrv.URL)
	runSelfHealJob(t, app)
	rows, err := app.FindRecordsByFilter("audits", "action = {:a} && result = {:r}", "-created", 1, 0, map[string]any{"a": "revalidate.selfheal", "r": "failure"})
	if err != nil {
		t.Fatalf("query audits: %v", err)
	}
	if len(rows) == 0 {
		t.Fatal("failure audit row (action=revalidate.selfheal) missing after 502")
	}
}
