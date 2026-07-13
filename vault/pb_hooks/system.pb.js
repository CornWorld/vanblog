/// <reference path="./types.d.ts" />
/// <reference path="./lib/vanblog.d.ts" />

// ============================================================================
// Vanblog System Hooks (JSVM, PocketBase 0.39 API)
// ============================================================================
// All audit logic (recordAudit + per-collection helpers) lives in
// ./pb_hooks/lib/vanblog-audit.js and is require()'d inside each callback.
//
// In PocketBase 0.39, onRecord*Request hooks are interceptors that BLOCK
// the operation unless the callback explicitly returns/next's through.
// Because our audit helpers don't chain through, we ONLY use the
// After*Success observer hooks. These fire after the record is saved,
// so actor/IP/UA information is not available (RecordEvent has no request).
// For now, audit entries will have empty actor/ip/ua — acceptable for
// a personal CMS.
// ============================================================================

// ----------------------------------------------------------------------------
// Posts
// ----------------------------------------------------------------------------

onRecordAfterCreateSuccess(
  (e) =>
    require("./pb_hooks/lib/vanblog-audit.js").postAction("post.create", e),
  "posts"
);
onRecordAfterUpdateSuccess(
  (e) =>
    require("./pb_hooks/lib/vanblog-audit.js").postAction("post.update", e),
  "posts"
);
onRecordAfterDeleteSuccess(
  (e) =>
    require("./pb_hooks/lib/vanblog-audit.js").postAction("post.delete", e),
  "posts"
);

// ----------------------------------------------------------------------------
// Tags
// ----------------------------------------------------------------------------

onRecordAfterCreateSuccess(
  (e) => require("./pb_hooks/lib/vanblog-audit.js").tagAction("tag.create", e),
  "tags"
);
onRecordAfterUpdateSuccess(
  (e) => require("./pb_hooks/lib/vanblog-audit.js").tagAction("tag.update", e),
  "tags"
);
onRecordAfterDeleteSuccess(
  (e) => require("./pb_hooks/lib/vanblog-audit.js").tagAction("tag.delete", e),
  "tags"
);

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------

onRecordAfterCreateSuccess(
  (e) =>
    require("./pb_hooks/lib/vanblog-audit.js").categoryAction(
      "category.create",
      e
    ),
  "categories"
);
onRecordAfterUpdateSuccess(
  (e) =>
    require("./pb_hooks/lib/vanblog-audit.js").categoryAction(
      "category.update",
      e
    ),
  "categories"
);
onRecordAfterDeleteSuccess(
  (e) =>
    require("./pb_hooks/lib/vanblog-audit.js").categoryAction(
      "category.delete",
      e
    ),
  "categories"
);

// ----------------------------------------------------------------------------
// Media
// ----------------------------------------------------------------------------

onRecordAfterCreateSuccess(
  (e) =>
    require("./pb_hooks/lib/vanblog-audit.js").mediaAction("media.create", e),
  "media"
);
onRecordAfterUpdateSuccess(
  (e) =>
    require("./pb_hooks/lib/vanblog-audit.js").mediaAction("media.update", e),
  "media"
);
onRecordAfterDeleteSuccess(
  (e) =>
    require("./pb_hooks/lib/vanblog-audit.js").mediaAction("media.delete", e),
  "media"
);

// ----------------------------------------------------------------------------
// Users
// ----------------------------------------------------------------------------

onRecordAfterCreateSuccess(
  (e) =>
    require("./pb_hooks/lib/vanblog-audit.js").userAction("user.create", e),
  "users"
);
onRecordAfterUpdateSuccess(
  (e) =>
    require("./pb_hooks/lib/vanblog-audit.js").userAction(
      "user.update",
      e,
      true
    ),
  "users"
);
onRecordAfterDeleteSuccess(
  (e) =>
    require("./pb_hooks/lib/vanblog-audit.js").userAction("user.delete", e),
  "users"
);

// ----------------------------------------------------------------------------
// Site
// ----------------------------------------------------------------------------

onRecordAfterUpdateSuccess(
  (e) => require("./pb_hooks/lib/vanblog-audit.js").siteAction(e),
  "site"
);

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
