/// <reference path="./types.d.ts" />
/// <reference path="./lib/vanblog.d.ts" />

// ============================================================================
// Vanblog System Hooks (JSVM, PocketBase 0.39 API)
// ============================================================================
// All audit logic (recordAudit + per-collection helpers) lives in
// ./lib/vanblog-audit.js and is require()'d inside each callback.
//
// In PocketBase 0.39, onRecord*Request hooks are interceptors that BLOCK
// the operation unless the callback explicitly returns/next's through.
// Because our audit helpers don't chain through, we ONLY use the
// After*Success observer hooks. These fire after the record is saved,
// so actor/IP/UA information is not available (RecordEvent has no request).
// For now, audit entries will have empty actor/ip/ua — acceptable for
// a personal CMS.
//
// ⚠️ 两条硬约束,新增钩子前必读:
// 1. 每个回调必须以 e.next() 归还链。After*Success 也是显式链,不归还
//    会静默终止整条链,饿死在其后注册的处理器。事故 2026-09-15:审计
//    钩子未归还链,Go 侧 article 的 SSR 缓存失效 webhook 永不执行,首
//    页停在陈旧快照直至缓存自然过期。
// 2. 回调会被 jsvm 序列化成字符串后重编译,闭包变量全部丢失 — 回调内
//    只能引用参数(e)、全局(require/$app/__hooks),库一律在回调体内
//    require(),不要抽共享辅助函数闭包。
// ============================================================================

// ----------------------------------------------------------------------------
// Posts
// ----------------------------------------------------------------------------

onRecordAfterCreateSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").postAction("post.create", e);
  e.next();
}, "posts");

onRecordAfterUpdateSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").postAction("post.update", e);
  e.next();
}, "posts");

onRecordAfterDeleteSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").postAction("post.delete", e);
  e.next();
}, "posts");

// ----------------------------------------------------------------------------
// Tags
// ----------------------------------------------------------------------------

onRecordAfterCreateSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").tagAction("tag.create", e);
  e.next();
}, "tags");

onRecordAfterUpdateSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").tagAction("tag.update", e);
  e.next();
}, "tags");

onRecordAfterDeleteSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").tagAction("tag.delete", e);
  e.next();
}, "tags");

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------

onRecordAfterCreateSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").categoryAction(
    "category.create",
    e
  );
  e.next();
}, "categories");

onRecordAfterUpdateSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").categoryAction(
    "category.update",
    e
  );
  e.next();
}, "categories");

onRecordAfterDeleteSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").categoryAction(
    "category.delete",
    e
  );
  e.next();
}, "categories");

// ----------------------------------------------------------------------------
// Media
// ----------------------------------------------------------------------------

onRecordAfterCreateSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").mediaAction("media.create", e);
  e.next();
}, "media");

onRecordAfterUpdateSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").mediaAction("media.update", e);
  e.next();
}, "media");

onRecordAfterDeleteSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").mediaAction("media.delete", e);
  e.next();
}, "media");

// ----------------------------------------------------------------------------
// Users
// ----------------------------------------------------------------------------

onRecordAfterCreateSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").userAction("user.create", e);
  e.next();
}, "users");

onRecordAfterUpdateSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").userAction(
    "user.update",
    e,
    true
  );
  e.next();
}, "users");

onRecordAfterDeleteSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").userAction("user.delete", e);
  e.next();
}, "users");

// ----------------------------------------------------------------------------
// Site
// ----------------------------------------------------------------------------

onRecordAfterUpdateSuccess((e) => {
  require(__hooks + "/lib/vanblog-audit.js").siteAction(e);
  e.next();
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
