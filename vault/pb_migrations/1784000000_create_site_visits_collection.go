package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Creates the `site_visits` collection backing the visits pack
// (全站访问量 + 当前在线，复刻原版 mereithhh Viewer)。
//
// - visited: 总访问次数（持久化累计）
// - sessions: JSON 字段，存 { sessionId: lastSeenMs } 心跳表，online = 活跃会话数
// Counters are maintained by the pack hook (`routerAdd /api/packs/visits`),
// which writes through $app directly and bypasses the records API. We keep
// all CRUD rules empty (superuser-only) so visitors cannot tamper with the
// counts via /api/collections/site_visits/records.
func init() {
	m.Register(func(db core.App) error {
		// Idempotent: skip if the pack was previously installed.
		if existing, err := db.FindCollectionByNameOrId("site_visits"); err == nil && existing != nil {
			return nil
		}

		col := core.NewCollection(core.CollectionTypeBase, "site_visits")
		col.Fields.Add(&core.NumberField{Name: "visited"})
		col.Fields.Add(&core.JSONField{Name: "sessions"})
		col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
		col.Fields.Add(&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true})

		return db.Save(col)
	}, func(db core.App) error {
		// Down: remove the collection. Data is lost — only run on explicit
		// pack uninstall.
		if col, err := db.FindCollectionByNameOrId("site_visits"); err == nil && col != nil {
			return db.Delete(col)
		}
		return nil
	})
}
