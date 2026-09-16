package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// tags/categories 补 admin 写规则。
//
// Root cause:初始迁移只给了 tags/categories 公开 List/View 规则,写规则
// 保持 nil。pb 语义里 nil = 仅 _superusers;而本仓管理端以 users(role=admin)
// 普通认证记录登录(非 _superuser),admin/tags.astro 与 admin/categories.astro
// 直接经 pb REST create/update,对 role=admin 必然被拒——两个管理页的
// 写入自初始迁移起就是死的。补齐为 admin-only(对齐 site 写规则语义):
// 公开读不变,写收敛到 role=admin。
func init() {
	m.Register(func(db core.App) error {
		adminOnly := `@request.auth.role = "admin"`
		for _, name := range []string{"tags", "categories"} {
			col, err := db.FindCollectionByNameOrId(name)
			if err != nil {
				return err
			}
			col.CreateRule = new(adminOnly)
			col.UpdateRule = new(adminOnly)
			col.DeleteRule = new(adminOnly)
			if err := db.Save(col); err != nil {
				return err
			}
		}
		return nil
	}, func(db core.App) error {
		// Forward-only. To revert, write a new migration restoring nil rules.
		return nil
	})
}
