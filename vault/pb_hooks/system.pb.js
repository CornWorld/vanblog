/// <reference path="./types.d.ts" />
/// <reference path="./lib/vanblog.d.ts" />

// ============================================================================
// Vanblog System Hooks (JSVM, PocketBase 0.40 API)
// ============================================================================
// All audit logic (recordAudit + per-collection helpers + hookError) lives in
// ./lib/vanblog-audit.js and is require()'d inside each callback.
//
// Audits run on the *Request* hooks (onRecord*Request), NOT After*Success:
// Request events carry e.auth / e.realIP() / e.request, so audit rows get a
// real actor, IP and User-Agent (After*Success events have none — every row
// used to be actor=""). By design, Go-layer INTERNAL saves (visits counters,
// cache invalidation, media dedup) no longer produce audit rows — they have
// no HTTP actor to attribute. Audit = what authenticated people did over HTTP.
//
// ⚠️ 三条硬约束,新增钩子前必读:
// 1. Request 钩子里 **e.next() 必须第一个调用**(先落操作、再写审计)。它抛出的
//    错误(pb 原生校验/权限错误)会原样传播给客户端——不要用 try/catch 包住
//    e.next(),pb 自己会记 WARN。每条链恰好调用一次。
//    (旧"回调必须归还链"纪律依然适用于所有非 Request 钩子:不归还 e.next()
//    会静默终止整条链。事故 2026-09-15:审计钩子未归还链,Go 侧 SSR 缓存
//    失效 webhook 被饿死,首页停在陈旧快照。)
// 2. 回调会被 jsvm 序列化成字符串后重编译,闭包变量全部丢失 — 回调内
//    只能引用参数(e)、全局(require/$app/__hooks),库一律在回调体内
//    require(),不要抽共享辅助函数闭包。
// 3. 审计代码自身的意外抛错由 lib 的 hookError 兜底:写一条 audits failure
//    行 + console.error,然后吞掉——审计故障不允许把已成功的操作污染成 500。
// ============================================================================

// ----------------------------------------------------------------------------
// Posts
// ----------------------------------------------------------------------------

onRecordCreateRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").postAction("post.create", e);
}, "posts");

onRecordUpdateRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").postAction("post.update", e);
}, "posts");

onRecordDeleteRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").postAction("post.delete", e);
}, "posts");

// ----------------------------------------------------------------------------
// Tags
// ----------------------------------------------------------------------------

onRecordCreateRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").tagAction("tag.create", e);
}, "tags");

onRecordUpdateRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").tagAction("tag.update", e);
}, "tags");

onRecordDeleteRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").tagAction("tag.delete", e);
}, "tags");

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------

onRecordCreateRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").categoryAction(
    "category.create",
    e
  );
}, "categories");

onRecordUpdateRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").categoryAction(
    "category.update",
    e
  );
}, "categories");

onRecordDeleteRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").categoryAction(
    "category.delete",
    e
  );
}, "categories");

// ----------------------------------------------------------------------------
// Media
// ----------------------------------------------------------------------------

onRecordCreateRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").mediaAction("media.create", e);
}, "media");

onRecordUpdateRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").mediaAction("media.update", e);
}, "media");

onRecordDeleteRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").mediaAction("media.delete", e);
}, "media");

// ----------------------------------------------------------------------------
// Users
// ----------------------------------------------------------------------------

onRecordCreateRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").userAction("user.create", e);
}, "users");

onRecordUpdateRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").userAction(
    "user.update",
    e,
    true
  );
}, "users");

onRecordDeleteRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").userAction("user.delete", e);
}, "users");

// ----------------------------------------------------------------------------
// Site
// ----------------------------------------------------------------------------

onRecordUpdateRequest((e) => {
  e.next();
  require(__hooks + "/lib/vanblog-audit.js").siteAction(e);
}, "site");

// ----------------------------------------------------------------------------
// Daily visits aggregation (cron)
// ----------------------------------------------------------------------------

cronAdd("visits-daily-aggregate", "0 0 * * *", () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  try {
    const records = $app.findRecordsByFilter(
      "visits",
      "date = {:date} && path != ''",
      { date: yesterday }
    );

    let totalViews = 0;
    let totalUniques = 0;
    for (const r of records) {
      totalViews += r.getInt("views");
      totalUniques += r.getInt("uniques");
    }

    let aggregate = null;
    try {
      aggregate = $app.findFirstRecordByFilter(
        "visits",
        "date = {:date} && path = ''",
        { date: yesterday }
      );
    } catch {
      // not found, will create
    }

    const collection = $app.findCollectionByNameOrId("visits");
    if (!aggregate) {
      aggregate = new Record(collection);
      aggregate.set("date", yesterday);
      aggregate.set("path", "");
    }
    aggregate.set("views", totalViews);
    aggregate.set("uniques", totalUniques);
    $app.save(aggregate);

    console.log(
      "[vanblog] visits aggregated for",
      yesterday,
      "views:",
      totalViews,
      "uniques:",
      totalUniques
    );
  } catch (err) {
    console.log("[vanblog] visits aggregation failed:", err);
  }
});
