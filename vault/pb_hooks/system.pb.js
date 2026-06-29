/// <reference path="./types.d.ts" />
/// <reference path="./lib/vanblog.d.ts" />

// ============================================================================
// Vanblog System Hooks (JSVM, PocketBase 0.39 API)
// ============================================================================
// All audit logic (recordAudit + per-collection helpers) lives in
// ./pb_hooks/lib/vanblog-audit.js and is require()'d inside each callback.
// require's module cache is shared across all jsvm VMs (loader + executors),
// which is the only way for hook callbacks — re-compiled by jsvm inside
// executor VMs — to reach helpers defined elsewhere.
//
// pb 0.39 hook surface used:
//   - onRecordAfterCreateSuccess / onRecordAfterUpdateSuccess /
//     onRecordAfterDeleteSuccess  — Go-layer success hooks fired by
//                                  app.Save / app.Delete. RecordEvent has
//                                  record but no request.
//   - onRecordCreateRequest / onRecordUpdateRequest / onRecordDeleteRequest
//                                  — HTTP API path before-save hooks.
//                                  RecordRequestEvent has auth/IP/UA.
//                                  Production admin UI hits these.
// ============================================================================

const M = "./pb_hooks/lib/vanblog-audit.js";

// ----------------------------------------------------------------------------
// Auth
// ----------------------------------------------------------------------------

onRecordAuthRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").authLogin(e), "users");

// ----------------------------------------------------------------------------
// Posts
// ----------------------------------------------------------------------------

onRecordCreateRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").postAction("post.create", e), "posts");
onRecordUpdateRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").postAction("post.update", e), "posts");
onRecordDeleteRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").postAction("post.delete", e), "posts");

onRecordAfterCreateSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").postAction("post.create", e), "posts");
onRecordAfterUpdateSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").postAction("post.update", e), "posts");
onRecordAfterDeleteSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").postAction("post.delete", e), "posts");

// ----------------------------------------------------------------------------
// Tags
// ----------------------------------------------------------------------------

onRecordCreateRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").tagAction("tag.create", e), "tags");
onRecordUpdateRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").tagAction("tag.update", e), "tags");
onRecordDeleteRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").tagAction("tag.delete", e), "tags");

onRecordAfterCreateSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").tagAction("tag.create", e), "tags");
onRecordAfterUpdateSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").tagAction("tag.update", e), "tags");
onRecordAfterDeleteSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").tagAction("tag.delete", e), "tags");

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------

onRecordCreateRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").categoryAction("category.create", e), "categories");
onRecordUpdateRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").categoryAction("category.update", e), "categories");
onRecordDeleteRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").categoryAction("category.delete", e), "categories");

onRecordAfterCreateSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").categoryAction("category.create", e), "categories");
onRecordAfterUpdateSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").categoryAction("category.update", e), "categories");
onRecordAfterDeleteSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").categoryAction("category.delete", e), "categories");

// ----------------------------------------------------------------------------
// Media
// ----------------------------------------------------------------------------

onRecordCreateRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").mediaAction("media.create", e), "media");
onRecordUpdateRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").mediaAction("media.update", e), "media");
onRecordDeleteRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").mediaAction("media.delete", e), "media");

onRecordAfterCreateSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").mediaAction("media.create", e), "media");
onRecordAfterUpdateSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").mediaAction("media.update", e), "media");
onRecordAfterDeleteSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").mediaAction("media.delete", e), "media");

// ----------------------------------------------------------------------------
// Users
// ----------------------------------------------------------------------------

onRecordCreateRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").userAction("user.create", e), "users");
onRecordUpdateRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").userAction("user.update", e, true), "users");
onRecordDeleteRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").userAction("user.delete", e), "users");

onRecordAfterCreateSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").userAction("user.create", e), "users");
onRecordAfterUpdateSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").userAction("user.update", e, true), "users");
onRecordAfterDeleteSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").userAction("user.delete", e), "users");

// ----------------------------------------------------------------------------
// Site
// ----------------------------------------------------------------------------

onRecordUpdateRequest((e) => require("./pb_hooks/lib/vanblog-audit.js").siteAction(e), "site");
onRecordAfterUpdateSuccess((e) => require("./pb_hooks/lib/vanblog-audit.js").siteAction(e), "site");

// ----------------------------------------------------------------------------
// Daily visits aggregation (cron)
// ----------------------------------------------------------------------------

cronAdd("visits-daily-aggregate", "0 0 * * *", () => {
    const yesterday = new Date(Date.now() - 86400000)
        .toISOString().split("T")[0];

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
        } catch (e) {
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

        console.log("[vanblog] visits aggregated for", yesterday,
            "views:", totalViews, "uniques:", totalUniques);
    } catch (err) {
        console.log("[vanblog] visits aggregation failed:", err);
    }
});
