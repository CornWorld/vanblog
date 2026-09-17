/// <reference path="./types.d.ts" />
/// <reference path="./lib/vanblog.d.ts" />

// ============================================================================
// Vanblog System Hooks (JSVM, PocketBase 0.40 API)
// ============================================================================
// 2026-09-17: 核心审计已迁移到 Go 层(vault/internal/audit)——通配
// onRecord*Request 覆盖全部 collection(含 Pack 动态建表,此前 JS 版按表
// 注册,对 moments/bookmarks 等零覆盖),auth.login 一并恢复。依据与判据:
// docs/pocketbase-extension-contract.md「扩展边界判据」。
// 本文件只剩 JSVM 独有能力:cron 聚合。用户自定义钩子照旧放自己的 *.pb.js。
//
// ⚠️ 用户钩子两条硬约束(历史事故,别再踩):
// 1. Request 钩子里 **e.next() 必须第一个调用**;每条链恰好调用一次。
//    不归还即静默断链,饿死其后注册的所有处理器(事故 2026-09-15:审计
//    钩子未归还链,Go 侧 SSR 缓存失效 webhook 被饿死,首页停在陈旧快照)。
// 2. 回调会被 jsvm 序列化重编译,闭包变量全部丢失——回调内只能引用参数
//    (e)与全局(require/$app/__hooks),库一律在回调体内 require()。
// ============================================================================

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
