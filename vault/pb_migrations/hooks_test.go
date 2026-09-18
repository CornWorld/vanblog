package migrations

// JSVM 装载冒烟 + 审计退役钉(2026-09-17)。
// 核心审计已迁 Go 层(internal/audit,通配 Request 钩子,原 verify_audits.go
// → hooks_test.go 的行为断言随迁到 internal/audit/audit_test.go);visits 聚合
// cron 同日迁 internal/visits(cronAdd 只是 app.Cron() 的 JS 绑定),system.pb.js
// 已删除,pb_hooks 只剩用户扩展面(examples + 用户自己的 *.pb.js;另有平台
// 自带的用户可改造钩子 selfheal.pb.js,见 selfheal_hooks_test.go)。本测试只锁:
//  1. 真实 pb_hooks/*.pb.js 仍能被 jsvm 加载(lessons §1.1:jsvm 是可选插件,
//     不注册 = 静默失效,无报错);
//  2. 审计不在 JS 层——posts 的 Request 写产生 0 条审计行。
//
// 注意:goja VM 加载较慢,本测试耗时为正常现象。

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
)

func TestJSVMLoadsAndAuditRetired(t *testing.T) {
	tmpDir := t.TempDir()
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("RunAppMigrations: %v", err)
	}

	// 测试运行目录是 vault/pb_migrations,所以 ../pb_hooks 指向 vault/pb_hooks。
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

	usersCol, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("users collection: %v", err)
	}
	admin := core.NewRecord(usersCol)
	admin.Set("username", "admin")
	admin.Set("email", "admin@example.com")
	admin.Set("password", "password12345678") // ≥8 位,否则校验失败
	admin.Set("passwordConfirm", "password12345678")
	admin.Set("role", "admin")
	if err := app.Save(admin); err != nil {
		t.Fatalf("create admin user: %v", err)
	}

	postsCol, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Fatalf("posts collection: %v", err)
	}
	post := core.NewRecord(postsCol)
	post.Set("title", "smoke")
	ev := &core.RecordRequestEvent{
		Record:     post,
		Collection: postsCol,
		RequestEvent: &core.RequestEvent{
			App:      app,
			Auth:     admin,
			Request:  httptest.NewRequest("POST", "/api/collections/posts/records", nil),
			Response: httptest.NewRecorder(),
		},
	}
	noop := func(e *core.RecordRequestEvent) error { return nil }
	if err := app.OnRecordCreateRequest(postsCol.Name).Trigger(ev, noop); err != nil {
		t.Fatalf("trigger posts create hook: %v", err)
	}

	// 审计退役钉:JS 侧不再写审计;Go 通配钩子不在 jsvm 注册路径里
	// (本测试只加载 jsvm,未构造 internal/audit.Manager)。
	audits, err := app.FindRecordsByFilter("audits", "1=1", "-created", 100, 0)
	if err != nil {
		t.Fatalf("query audits: %v", err)
	}
	if len(audits) != 0 {
		t.Fatalf("JS hooks produced %d audit rows, want 0 (audit should be Go-side only)", len(audits))
	}
}
