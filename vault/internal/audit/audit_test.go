package audit

// 语义钉:Go 通配审计的行为契约。从 pb_migrations/hooks_test.go(2026-09-16
// 的 JSVM 审计测试)与 gowildcard_spike_test.go(2026-09-17 实验)迁移而来。
//
// 覆盖:
//   - 通配钩子对核心表与运行时动态建的 Pack 表都生效(actor/ip/UA 可取);
//   - action 字符串与退役的 JS 版逐字节兼容(post.create/tag.update/...);
//   - skip 面:audits(防递归)与 visits(匿名遥测)不产审计;
//   - Go 内部 app.Save 不产审计(审计 = 认证主体经 HTTP 做的事);
//   - users.update 无认证回退 actor=被编辑记录(superuser 管理/自助编辑归因);
//   - superuser 操作 actor 为空 = 系统动作(audits.actor 是 users relation);
//   - auth.login 恢复记录(338b6f42 原始意图,bd4aee11 回撤后失联)。

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	_ "github.com/cornworld/vanblog/pb_migrations" // 注册 Go 迁移,否则库里没有 collections
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func newTestApp(t *testing.T) (core.App, *core.Record) {
	t.Helper()
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("RunAppMigrations: %v", err)
	}
	New(app)

	usersCol, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("users collection: %v", err)
	}
	admin := core.NewRecord(usersCol)
	admin.Set("username", "admin")
	admin.Set("email", "admin@example.com")
	admin.Set("password", "password12345678")
	admin.Set("passwordConfirm", "password12345678")
	admin.Set("role", "admin")
	if err := app.Save(admin); err != nil {
		t.Fatalf("create admin: %v", err)
	}
	return app, admin
}

func triggerRecord(t *testing.T, app core.App, col *core.Collection, auth *core.Record, rec *core.Record, op string) {
	t.Helper()
	ev := &core.RecordRequestEvent{
		Record:     rec,
		Collection: col,
		RequestEvent: &core.RequestEvent{
			App:      app,
			Auth:     auth,
			Request:  httptest.NewRequest(op, "/api/collections/"+col.Name+"/records", nil),
			Response: httptest.NewRecorder(),
		},
	}
	ev.Request.Header.Set("User-Agent", "audit-test/1.0")
	noop := func(e *core.RecordRequestEvent) error { return nil }
	var err error
	switch op {
	case "POST":
		err = app.OnRecordCreateRequest(col.Name).Trigger(ev, noop)
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

func auditRows(t *testing.T, app core.App, action string) []*core.Record {
	t.Helper()
	rows, err := app.FindRecordsByFilter("audits", "action={:a}", "-created", 50, 0, map[string]any{"a": action})
	if err != nil {
		t.Fatalf("query audits action=%s: %v", action, err)
	}
	return rows
}

func countAudits(t *testing.T, app core.App) int {
	t.Helper()
	rows, err := app.FindRecordsByFilter("audits", "1=1", "-created", 500, 0)
	if err != nil {
		t.Fatalf("query audits: %v", err)
	}
	return len(rows)
}

func makePackCollection(t *testing.T, app core.App) *core.Collection {
	t.Helper()
	col := core.NewCollection(core.CollectionTypeBase, "spike_moments")
	col.Fields.Add(&core.TextField{Name: "title", Required: true})
	col.ListRule = new("")
	if _, err := app.FindCollectionByNameOrId("spike_moments"); err == nil {
		return col // already created in this test
	}
	if err := app.Save(col); err != nil {
		t.Fatalf("create spike_moments: %v", err)
	}
	return col
}

func TestWildcardAuditCoversCoreAndPack(t *testing.T) {
	app, admin := newTestApp(t)

	postsCol, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Fatalf("posts collection: %v", err)
	}
	post := core.NewRecord(postsCol)
	post.Set("title", "hello")
	post.Set("status", "published")
	post.Set("pathname", "/posts/hello")
	triggerRecord(t, app, postsCol, admin, post, "POST")

	rows := auditRows(t, app, "post.create")
	if len(rows) != 1 {
		t.Fatalf("post.create rows = %d, want 1", len(rows))
	}
	row := rows[0]
	if row.GetString("actor") != admin.Id {
		t.Fatalf("actor = %q, want admin id", row.GetString("actor"))
	}
	if row.GetString("target") != post.Id+":hello" {
		t.Fatalf("target = %q, want %q", row.GetString("target"), post.Id+":hello")
	}
	if row.GetString("ip") == "" || row.GetString("userAgent") != "audit-test/1.0" {
		t.Fatalf("ip/ua not captured: ip=%q ua=%q", row.GetString("ip"), row.GetString("userAgent"))
	}
	var detail map[string]any
	if err := json.Unmarshal([]byte(row.GetString("detail")), &detail); err != nil {
		t.Fatalf("detail not JSON: %v", err)
	}
	for _, key := range []string{"id", "title", "status", "pathname", "category", "tags", "deleted"} {
		if _, ok := detail[key]; !ok {
			t.Fatalf("post detail missing key %q (JS parity)", key)
		}
	}

	// Pack 表:动态建出的 collection 立即进审计覆盖面。
	col := makePackCollection(t, app)
	rec := core.NewRecord(col)
	rec.Set("title", "moment one")
	triggerRecord(t, app, col, admin, rec, "POST")

	packRows := auditRows(t, app, "spike_moments.create")
	if len(packRows) != 1 {
		t.Fatalf("Pack collection audit rows = %d, want 1", len(packRows))
	}
	if packRows[0].GetString("actor") != admin.Id {
		t.Fatalf("Pack audit actor = %q, want admin id", packRows[0].GetString("actor"))
	}
}

func TestActionNamesByteCompatibleWithJS(t *testing.T) {
	app, admin := newTestApp(t)

	tagsCol, err := app.FindCollectionByNameOrId("tags")
	if err != nil {
		t.Fatalf("tags collection: %v", err)
	}
	tag := core.NewRecord(tagsCol)
	tag.Set("name", "golang")
	if err := app.Save(tag); err != nil {
		t.Fatalf("save tag: %v", err)
	}
	triggerRecord(t, app, tagsCol, admin, tag, "PATCH")

	catsCol, err := app.FindCollectionByNameOrId("categories")
	if err != nil {
		t.Fatalf("categories collection: %v", err)
	}
	cat := core.NewRecord(catsCol)
	cat.Set("name", "tech")
	if err := app.Save(cat); err != nil {
		t.Fatalf("save category: %v", err)
	}
	triggerRecord(t, app, catsCol, admin, cat, "DELETE")

	siteCol, err := app.FindCollectionByNameOrId("site")
	if err != nil {
		t.Fatalf("site collection: %v", err)
	}
	site, err := app.FindFirstRecordByFilter("site", "1=1", nil)
	if err != nil {
		t.Fatalf("site record: %v", err)
	}
	triggerRecord(t, app, siteCol, admin, site, "PATCH")

	for _, action := range []string{"tag.update", "category.delete", "site.update"} {
		if got := len(auditRows(t, app, action)); got != 1 {
			t.Fatalf("%s rows = %d, want 1", action, got)
		}
	}
}

func TestSkipSelfAndVisits(t *testing.T) {
	app, admin := newTestApp(t)

	for _, name := range []string{"audits", "visits"} {
		col, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			t.Fatalf("%s collection: %v", name, err)
		}
		rec := core.NewRecord(col)
		triggerRecord(t, app, col, admin, rec, "POST")
	}
	if got := countAudits(t, app); got != 0 {
		t.Fatalf("audits/visits writes produced %d audit rows, want 0", got)
	}
}

func TestInternalSaveProducesNoAudit(t *testing.T) {
	app, _ := newTestApp(t)

	tagsCol, err := app.FindCollectionByNameOrId("tags")
	if err != nil {
		t.Fatalf("tags collection: %v", err)
	}
	tag := core.NewRecord(tagsCol)
	tag.Set("name", "internal")
	if err := app.Save(tag); err != nil {
		t.Fatalf("save tag: %v", err)
	}
	if got := countAudits(t, app); got != 0 {
		t.Fatalf("internal app.Save produced %d audit rows, want 0", got)
	}
}

func TestUsersUpdateFallbackSelf(t *testing.T) {
	app, _ := newTestApp(t)

	usersCol, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("users collection: %v", err)
	}
	user := core.NewRecord(usersCol)
	user.Set("username", "selfedit")
	user.Set("email", "self@example.com")
	user.Set("password", "password12345678")
	user.Set("passwordConfirm", "password12345678")
	user.Set("role", "collaborator")
	if err := app.Save(user); err != nil {
		t.Fatalf("save user: %v", err)
	}

	// 无认证的自助编辑(改自己的资料)归因到被编辑记录本身。
	triggerRecord(t, app, usersCol, nil, user, "PATCH")
	rows := auditRows(t, app, "user.update")
	if len(rows) != 1 {
		t.Fatalf("user.update rows = %d, want 1", len(rows))
	}
	if rows[0].GetString("actor") != user.Id {
		t.Fatalf("fallbackSelf actor = %q, want record id %q", rows[0].GetString("actor"), user.Id)
	}
}

func TestSuperuserActionHasEmptyActor(t *testing.T) {
	app, _ := newTestApp(t)

	superCol, err := app.FindCollectionByNameOrId("_superusers")
	if err != nil {
		t.Fatalf("_superusers collection: %v", err)
	}
	super := core.NewRecord(superCol)
	super.Set("email", "root@example.com")
	super.Set("password", "password12345678")
	super.Set("passwordConfirm", "password12345678")

	postsCol, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Fatalf("posts collection: %v", err)
	}
	post := core.NewRecord(postsCol)
	post.Set("title", "by root")
	// audits.actor 是 users relation,_superusers 的 id 塞进去会校验失败
	// ——actor 留空 = 系统动作,与 JS auditContext 语义一致。
	triggerRecord(t, app, postsCol, super, post, "POST")

	rows := auditRows(t, app, "post.create")
	if len(rows) != 1 {
		t.Fatalf("post.create rows = %d, want 1", len(rows))
	}
	if rows[0].GetString("actor") != "" {
		t.Fatalf("superuser op actor = %q, want empty", rows[0].GetString("actor"))
	}
}

func TestAuthLoginAudited(t *testing.T) {
	app, admin := newTestApp(t)

	ev := &core.RecordAuthRequestEvent{
		Record: admin,
		// 真实登录路径(password/oauth2/otp)由 PB 填 AuthMethod;refresh 与
		// impersonate 传 ""(见 TestAuthRefreshNotAudited)。
		AuthMethod: "password",
		RequestEvent: &core.RequestEvent{
			App:      app,
			Auth:     admin,
			Request:  httptest.NewRequest("POST", "/api/collections/users/auth-with-password", nil),
			Response: httptest.NewRecorder(),
		},
	}
	noop := func(e *core.RecordAuthRequestEvent) error { return nil }
	if err := app.OnRecordAuthRequest().Trigger(ev, noop); err != nil {
		t.Fatalf("trigger auth hook: %v", err)
	}

	rows := auditRows(t, app, "auth.login")
	if len(rows) != 1 {
		t.Fatalf("auth.login rows = %d, want 1", len(rows))
	}
	if rows[0].GetString("actor") != admin.Id {
		t.Fatalf("auth.login actor = %q, want admin id", rows[0].GetString("actor"))
	}
	if rows[0].GetString("target") != "admin@example.com" {
		t.Fatalf("auth.login target = %q, want email", rows[0].GetString("target"))
	}
	// JS recordAudit 走 pb JSONField,传 "" 落库为 JSON 空串编码 `""`;
	// Go 同一 Set 路径,两种空形态都算 parity。
	if d := rows[0].GetString("detail"); d != "" && d != `""` {
		t.Fatalf("auth.login detail = %q, want empty (JS parity)", d)
	}
}

// TestAuthRefreshNotAudited 钉住:auth-refresh / impersonate 复用
// OnRecordAuthRequest 且 AuthMethod 为空,不得写 auth.login。SDK 中间件
// 对每个带认证 cookie 的请求 authRefresh——不豁免则 audits 被每个已认证
// 请求的噪音行淹没(2026-09-17 3 天改动审查发现)。
func TestAuthRefreshNotAudited(t *testing.T) {
	app, admin := newTestApp(t)

	ev := &core.RecordAuthRequestEvent{
		Record:     admin,
		AuthMethod: "", // record_auth_refresh.go:33 传 ""
		RequestEvent: &core.RequestEvent{
			App:      app,
			Auth:     admin,
			Request:  httptest.NewRequest("POST", "/api/collections/users/auth-refresh", nil),
			Response: httptest.NewRecorder(),
		},
	}
	noop := func(e *core.RecordAuthRequestEvent) error { return nil }
	if err := app.OnRecordAuthRequest().Trigger(ev, noop); err != nil {
		t.Fatalf("trigger auth hook: %v", err)
	}

	rows := auditRows(t, app, "auth.login")
	if len(rows) != 0 {
		t.Fatalf("auth.login rows = %d, want 0 (refresh is not a login)", len(rows))
	}
}

// TestOpsFailedWritesFailureRow 钉住后台链失败提醒机制:OpsFailed 必须写
// result=failure 的系统审计行(actor 空,ip/ua 空)。缓存失效丢失等链式
// 失败经此提醒管理员。
func TestOpsFailedWritesFailureRow(t *testing.T) {
	app, _ := newTestApp(t)

	OpsFailed(app, "revalidate.failure", "posts,feed", map[string]any{"reason": "probe"})

	rows := auditRows(t, app, "revalidate.failure")
	if len(rows) != 1 {
		t.Fatalf("failure rows = %d, want 1", len(rows))
	}
	if rows[0].GetString("result") != "failure" {
		t.Fatalf("result = %q, want failure", rows[0].GetString("result"))
	}
	if rows[0].GetString("actor") != "" {
		t.Fatalf("actor = %q, want empty (system)", rows[0].GetString("actor"))
	}
}
