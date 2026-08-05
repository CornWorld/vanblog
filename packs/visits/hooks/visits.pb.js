// visits pack — 全站访问量 + 当前在线（复刻原版 mereithhh Viewer）。
//
// 提供 `GET /api/packs/visits?action=record|ping&session=<id>`：
//   - action=record：累计一次访问（visited += 1）并登记会话心跳
//   - action=ping：  仅登记会话心跳（保持 online 存活）
// 返回 `{ ok, visited, online }`。
//
// ⚠️ PocketBase JSVM 限制：.pb.js 的顶层 const/function 在 executor VM 中不可见
// （routerAdd 回调被重新编译执行）。因此本 hook **不声明任何顶层变量**，
// 全部状态（visited + sessions map）持久化在 `site_visits` 单条记录的 JSON 字段，
// 回调内只用 PB 全局（$app / Record / c）。查询参数用 `c.request.url.query().get()`。
routerAdd("GET", "/api/packs/visits", (c) => {
  const now = Date.now();
  const q = c.request.url.query();
  const session = (q.get("session") || "").trim();
  const action = (q.get("action") || "ping").trim();

  let record;
  try {
    const col = $app.findCollectionByNameOrId("site_visits");
    try {
      record = $app.findFirstRecordByFilter(col, "1=1");
    } catch (e) {
      record = null;
    }
    if (!record) {
      record = new Record(col);
      record.set("visited", 0);
      record.set("sessions", {});
      $app.save(record);
    }
  } catch (err) {
    console.error("[visits] collection unavailable:", err);
    return c.json(500, { ok: false, error: "collection unavailable" });
  }

  let visited = record.getInt("visited");
  let sessions = {};
  try {
    const raw = record.get("sessions");
    if (raw && typeof raw === "object") sessions = raw;
  } catch (e) {
    sessions = {};
  }

  if (action === "record" && session) {
    visited += 1;
    record.set("visited", visited);
  }
  if (session) sessions[session] = now;
  // prune stale sessions（60s 窗口）
  for (const id in sessions) {
    if (now - sessions[id] > 60000) delete sessions[id];
  }
  record.set("sessions", sessions);
  try {
    $app.save(record);
  } catch (err) {
    console.error("[visits] persist failed:", err);
  }

  return c.json(200, { ok: true, visited, online: Object.keys(sessions).length });
});

console.log("[visits] Pack hook loaded");
