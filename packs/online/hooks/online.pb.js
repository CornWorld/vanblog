// online pack — 当前在线（非核心展示功能，不参与页面加载热点）。
//
// 提供 `GET /api/packs/online?session=<id>`：
//   登记/刷新该会话的心跳，返回 60s 窗口内的在线人数。
// 返回 `{ ok, online }`；失败静默。
//
// 与文章浏览计数解耦：计数（posts.viewCount / per-path）由平台 Go 层
// /api/vanblog/visits/record 负责（原子 SQL，热点稳定）；本 pack 只做
// 会话心跳与在线展示，30s 一次，独立旁路。
//
// 数据模型（见 migrations/0001_init.js）：visit_sessions 每会话一行
// （session 唯一 + lastSeenAt）。online = COUNT 活跃行；剪枝 = SQL 惰性 DELETE。
//
// ⚠️ PocketBase JSVM 限制：.pb.js 的顶层 const/function 在 executor VM 中
// 不可见（routerAdd 回调被重新编译执行）。因此本 hook **不声明任何顶层
// 变量/函数**，回调内只用 PB 全局（$app / Record / $dbx）。
routerAdd("GET", "/api/packs/online", (c) => {
  const now = Date.now();
  const q = c.request.url.query();
  const session = (q.get("session") || "").trim();
  const isoNow = new Date(now).toISOString().replace("T", " ");
  const isoCutoff = new Date(now - 60000).toISOString().replace("T", " "); // 60s 在线窗口

  // ── 登记/心跳：每会话一行 upsert lastSeenAt ───────────────────────
  if (session) {
    try {
      let s = null;
      try {
        s = $app.findFirstRecordByFilter(
          "visit_sessions",
          "session = {:s}",
          { s: session }
        );
      } catch (e) {
        s = null;
      }
      if (s) {
        s.set("lastSeenAt", isoNow);
        $app.save(s);
      } else {
        const col = $app.findCollectionByNameOrId("visit_sessions");
        const nr = new Record(col);
        nr.set("session", session);
        nr.set("lastSeenAt", isoNow);
        $app.save(nr);
      }
    } catch (err) {
      console.error("[online] session touch failed:", err);
    }

    // 惰性剪枝：删掉 60s 窗口外的过期会话行（单条索引 DELETE，非全量遍历）
    try {
      $app.db()
        .delete("visit_sessions", $dbx.exp("lastSeenAt <= {:t}", { t: isoCutoff }))
        .execute();
    } catch (err) {
      console.error("[online] session prune failed:", err);
    }
  }

  // ── online = 60s 窗口内活跃会话数（COUNT 聚合）─────────────────────
  let online = 0;
  try {
    online = $app.countRecords(
      "visit_sessions",
      $dbx.exp("lastSeenAt > {:t}", { t: isoCutoff })
    );
  } catch (err) {
    console.error("[online] online count failed:", err);
  }

  return c.json(200, { ok: true, online });
});

console.log("[online] Pack hook loaded");
