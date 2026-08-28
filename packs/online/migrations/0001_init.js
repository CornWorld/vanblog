// 0001 — 当前在线：每个会话一行（visit_sessions）。
//
// 在线判定是独立、非核心、可扩展的展示功能，与文章浏览计数（Go 平台层
// /api/vanblog/visits/record）完全解耦：它不参与页面加载热点，仅由
// frontend 每 30s 一次心跳驱动。
//
// 模型：visit_sessions 每会话一行（session 唯一 + lastSeenAt）。
//   登记/心跳 = 单行 upsert；online = COUNT 活跃行；剪枝 = SQL 惰性 DELETE。
//
// 顺带清理旧 site_visits（曾用于全站总量 + sessions JSON，已废弃，容错删除）。
migrate((app) => {
  let exists = true;
  try {
    app.findCollectionByNameOrId("visit_sessions");
  } catch (_e) {
    exists = false;
  }
  if (!exists) {
    const collection = new Collection({
      type: "base",
      name: "visit_sessions",
      fields: [
        { name: "session", type: "text", required: true, unique: true },
        { name: "lastSeenAt", type: "date", required: true },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    });
    app.save(collection);
  }

  try {
    app.delete(app.findCollectionByNameOrId("site_visits"));
  } catch (_e) {
    /* already gone */
  }
}, (app) => {
  try {
    return app.delete(app.findCollectionByNameOrId("visit_sessions"));
  } catch (_e) {
    return; // already gone
  }
});
