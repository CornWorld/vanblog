package migrations

// 原 verify_audits.go 迁移而来:真实注册 jsvm 加载 pb_hooks,触发记录写事件,
// 断言 audits 集合中审计事件齐全。
// 2026-09-16 起 audit 从 After*Success 切到 onRecord*Request(拿得到
// actor/ip/UA)。Request 钩子只在真实 HTTP 请求上触发,app.Save 这类内部
// 写不再产生审计——测试改用手工构造 RecordRequestEvent 触发钩子链,
// 这是 e.next() 之后的 JS 段在真实语义(actor/ip)下的最小等价触发面。
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

// triggerRecordHook 手工触发某 collection 的记录写 Request 钩子,模拟一次
// 已认证(admin)的 HTTP 写:auditContext 由此拿到 actor 与 realIP。
// Collection 必须设置:TaggedHook 按 event.Tags()(由 Collection 推导)
// 过滤 handler,不设则所有绑定回调都会被跳过。
func triggerRecordHook(t *testing.T, app core.App, col *core.Collection, auth *core.Record, rec *core.Record) {
	t.Helper()
	ev := &core.RecordRequestEvent{
		Record:     rec,
		Collection: col,
		RequestEvent: &core.RequestEvent{
			App:      app,
			Auth:     auth,
			Request:  httptest.NewRequest("POST", "/api/collections/"+col.Name+"/records", nil),
			Response: httptest.NewRecorder(),
		},
	}
	noop := func(e *core.RecordRequestEvent) error { return nil }
	if err := app.OnRecordCreateRequest(col.Name).Trigger(ev, noop); err != nil {
		t.Fatalf("trigger %s create hook: %v", col.Name, err)
	}
}

// triggerRecordHookOp 同 triggerRecordHook,但可指定 update/delete 等操作。
func triggerRecordHookOp(t *testing.T, app core.App, col *core.Collection, auth *core.Record, rec *core.Record, op string) {
	t.Helper()
	ev := &core.RecordRequestEvent{
		Record:     rec,
		Collection: col,
		RequestEvent: &core.RequestEvent{
			App:      app,
			Auth:     auth,
			Request:  httptest.NewRequest(op, "/api/collections/"+col.Name+"/records/"+rec.Id, nil),
			Response: httptest.NewRecorder(),
		},
	}
	noop := func(e *core.RecordRequestEvent) error { return nil }
	var err error
	switch op {
	case "PATCH":
		err = app.OnRecordUpdateRequest(col.Name).Trigger(ev, noop)
	case "DELETE":
		err = app.OnRecordDeleteRequest(col.Name).Trigger(ev, noop)
	default:
		t.Fatalf("unsupported op %q", op)
	}
	if err != nil {
		t.Fatalf("trigger %s %s hook: %v", col.Name, op, err)
	}
}

func TestJSVMAuditRequestHooksCaptureActor(t *testing.T) {
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

	// 注册 jsvm —— 同步加载 pb_hooks/*.pb.js 并把 OnRecord* 事件绑定到
	// JS 回调。不注册的话 audits 集合会一直为空。
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

	// 语义钉:Go 层内部写(app.Save)不得再产生审计行——审计只面向
	// 带 actor 的 HTTP 写。这是 Request 钩子切换的行为契约。
	audits, err := app.FindRecordsByFilter("audits", "1=1", "-created", 100, 0)
	if err != nil {
		t.Fatalf("query audits after internal save: %v", err)
	}
	if len(audits) != 0 {
		t.Fatalf("internal app.Save produced %d audit rows, want 0", len(audits))
	}

	// 依次创建 tag/category/post,每个 Request 钩子都应产出一条带 actor 的审计。
	tagsCol, err := app.FindCollectionByNameOrId("tags")
	if err != nil {
		t.Fatalf("tags collection: %v", err)
	}
	tag := core.NewRecord(tagsCol)
	tag.Set("name", "Go")

	catsCol, err := app.FindCollectionByNameOrId("categories")
	if err != nil {
		t.Fatalf("categories collection: %v", err)
	}
	cat := core.NewRecord(catsCol)
	cat.Set("name", "Tech")
	cat.Set("type", "category")

	postsCol, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Fatalf("posts collection: %v", err)
	}
	post := core.NewRecord(postsCol)
	post.Set("title", "Hello")
	post.Set("content", "first post")
	post.Set("status", "published")
	post.Set("category", cat.Id)
	post.Set("tags", []string{tag.Id})
	post.Set("author", admin.Id)

	triggerRecordHook(t, app, tagsCol, admin, tag)
	triggerRecordHook(t, app, catsCol, admin, cat)
	triggerRecordHook(t, app, postsCol, admin, post)

	// post.update:直接复用内存记录触发更新钩子(不真正落库,只验 JS 段)。
	post.Set("title", "Hello (edited)")
	triggerRecordHookOp(t, app, postsCol, admin, post, "PATCH")

	// post.delete:硬删除语义(软删除 deleted=true 走 update,只产生 post.update)。
	triggerRecordHookOp(t, app, postsCol, admin, post, "DELETE")

	// 检查 audits 集合:5 个关键动作齐全,且 actor/ip 都已捕获(本次修复核心)。
	audits, err = app.FindRecordsByFilter("audits", "1=1", "-created", 100, 0)
	if err != nil {
		t.Fatalf("query audits: %v", err)
	}

	expected := map[string]bool{
		"tag.create":      false,
		"category.create": false,
		"post.create":     false,
		"post.update":     false,
		"post.delete":     false,
	}
	for _, a := range audits {
		action := a.GetString("action")
		t.Logf("audit row: action=%q actor=%q ip=%q target=%q", action, a.GetString("actor"), a.GetString("ip"), a.GetString("target"))
		if _, ok := expected[action]; ok {
			expected[action] = true
			if a.GetString("actor") != admin.Id {
				t.Errorf("audit %s: actor = %q, want %q", action, a.GetString("actor"), admin.Id)
			}
			if a.GetString("ip") == "" {
				t.Errorf("audit %s: ip is empty, want realIP captured", action)
			}
		}
	}

	for action, found := range expected {
		if !found {
			t.Errorf("missing audit action %s", action)
		}
	}
}
