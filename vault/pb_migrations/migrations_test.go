package migrations

// 原 verify_mig3.go 迁移而来：真实运行 pb 迁移，断言 schema 正确。
// 注意：不把 tokens 放进断言集合——该 collection 已从 schema 删除，
// verify_e2e.go 当年正是因为多断言了 tokens 才假失败。

import (
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func TestMigrationsCreateExpectedCollections(t *testing.T) {
	tmpDir := t.TempDir()
	var app core.App = pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("RunAppMigrations: %v", err)
	}

	// 断言 9 个业务 collection 全部存在，且每个都有字段。
	for _, name := range []string{"tags", "categories", "users", "posts", "revisions", "media", "site", "visits", "audits"} {
		col, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			t.Errorf("collection %s missing: %v", name, err)
			continue
		}
		if len(col.Fields) == 0 {
			t.Errorf("collection %s has no fields", name)
		}
	}

	// site 应有单例记录（insertDefaultSite 迁移负责插入）。
	site, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || site == nil {
		t.Errorf("site singleton record missing: %v", err)
	}

	// posts 应有 tags(RelationField) 与 deleted(BoolField) 字段。
	postsCol, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Errorf("posts collection missing: %v", err)
	} else {
		if postsCol.Fields.GetByName("tags") == nil {
			t.Error("posts missing 'tags' relation field")
		}
		if postsCol.Fields.GetByName("deleted") == nil {
			t.Error("posts missing 'deleted' bool field")
		}
	}
}
