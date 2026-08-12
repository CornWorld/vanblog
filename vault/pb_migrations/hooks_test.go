package migrations

// 原 verify_audits.go 迁移而来：真实注册 jsvm 加载 pb_hooks，
// 通过 Go 层 app.Save 触发 CRUD，断言 audits 集合中审计事件齐全。
// 注意：goja VM 加载较慢，本测试耗时为正常现象。

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
)

func TestJSVMAuditHooksFire(t *testing.T) {
	tmpDir := t.TempDir()
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("RunAppMigrations: %v", err)
	}

	// 测试运行目录是 vault/pb_migrations，所以 ../pb_hooks 指向 vault/pb_hooks。
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

	// 依次创建 user/tag/category/post，每个都应产生一条审计记录。
	usersCol, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("users collection: %v", err)
	}
	admin := core.NewRecord(usersCol)
	admin.Set("username", "admin")
	admin.Set("email", "admin@example.com")
	admin.Set("password", "password12345678") // ≥8 位，否则校验失败
	admin.Set("passwordConfirm", "password12345678")
	admin.Set("role", "admin")
	if err := app.Save(admin); err != nil {
		t.Fatalf("create admin user: %v", err)
	}

	tagsCol, err := app.FindCollectionByNameOrId("tags")
	if err != nil {
		t.Fatalf("tags collection: %v", err)
	}
	tag := core.NewRecord(tagsCol)
	tag.Set("name", "Go")
	if err := app.Save(tag); err != nil {
		t.Fatalf("create tag: %v", err)
	}

	catsCol, err := app.FindCollectionByNameOrId("categories")
	if err != nil {
		t.Fatalf("categories collection: %v", err)
	}
	cat := core.NewRecord(catsCol)
	cat.Set("name", "Tech")
	cat.Set("type", "category")
	if err := app.Save(cat); err != nil {
		t.Fatalf("create category: %v", err)
	}

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
	if err := app.Save(post); err != nil {
		t.Fatalf("create post: %v", err)
	}

	// 关键坑：更新前必须先按 id 重新加载 post（PostScan → MarkAsNotNew）。
	// 否则 pb 0.39 内存中记录的 IsNew 标志仍为 true，第二次 Save 会走
	// create 路径，导致拿不到 post.update 审计。
	post2, err := app.FindRecordById(postsCol, post.Id)
	if err != nil || post2 == nil {
		t.Fatalf("reload post: %v", err)
	}

	post2.Set("title", "Hello (edited)")
	if err := app.Save(post2); err != nil {
		t.Fatalf("update post: %v", err)
	}

	// 硬删除（走 onRecordAfterDeleteSuccess）。软删除(deleted=true)走的是
	// update 路径，只会产生 post.update 而不是 post.delete。
	if err := app.Delete(post2); err != nil {
		t.Fatalf("delete post: %v", err)
	}

	// 检查 audits 集合，确认 5 个关键审计动作全部触发。
	audits, err := app.FindRecordsByFilter("audits", "1=1", "-created", 100, 0)
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
		if _, ok := expected[a.GetString("action")]; ok {
			expected[a.GetString("action")] = true
		}
	}

	for action, found := range expected {
		if !found {
			t.Errorf("missing audit action %s", action)
		}
	}
}
