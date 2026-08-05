// visits pack — 全站访问量 + 当前在线（复刻原版 mereithhh Viewer）。
//
// 提供 `GET /api/packs/visits?action=record|ping&session=<id>`：
//   - action=record：累计一次访问（visited += 1）并登记会话心跳
//   - action=ping：  仅登记会话心跳（保持 online 存活）
// 返回 `{ ok, visited, online }`。
//
// online = 最近 60s 内有心跳的会话数（内存维护）；visited 持久化到
// `site_visits` collection（单条记录，由 migration 创建）。
const ONLINE_WINDOW_MS = 60 * 1000;
const COLLECTION = "site_visits";

const sessions = new Map(); // sessionId -> lastSeen (ms)

function getRecord(app) {
  const col = app.findCollectionByNameOrId(COLLECTION);
  let record = null;
  try {
    record = app.findFirstRecordByFilter(col, "1=1");
  } catch (e) {
    // no record yet
  }
  if (!record) {
    record = new Record(col);
    record.set("visited", 0);
    app.save(record);
  }
  return record;
}

routerAdd("GET", "/api/packs/visits", (c) => {
  const now = Date.now();
  const session = c.queryParam("session") || "";
  const action = c.queryParam("action") || "ping";

  let record;
  try {
    record = getRecord($app);
  } catch (err) {
    console.error("[visits] collection unavailable:", err);
    return c.json(500, { ok: false, error: "collection unavailable" });
  }

  let visited = record.getInt("visited");
  if (action === "record" && session) {
    visited += 1;
    record.set("visited", visited);
    try {
      $app.save(record);
    } catch (err) {
      console.error("[visits] persist failed:", err);
    }
  }

  if (session) sessions.set(session, now);
  // prune stale sessions
  for (const [id, ts] of sessions) {
    if (now - ts > ONLINE_WINDOW_MS) sessions.delete(id);
  }

  return c.json(200, { ok: true, visited, online: sessions.size });
});

console.log("[visits] Pack hook loaded");
