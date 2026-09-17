/// <reference path="./types.d.ts" />

// ============================================================================
// Vanblog Example Hooks (JSVM)
// ============================================================================
// These are examples for users to learn from and customize.
// Copy any of these patterns into your own .pb.js file to extend vanblog.
// ============================================================================

// --- Example 1: Send webhook notification on new published post ---
// onRecordCreateRequest((e) => {
//     if (e.record.get("status") !== "published") return;
//     const title = e.record.get("title");
//     const pathname = e.record.get("pathname") || ("/posts/" + e.record.id);
//     // Send to Slack/Discord/etc via webhook
//     // $http.send({ method: "POST", url: "https://hooks.slack.com/...", body: ... })
//     console.log("[vanblog] new post published:", title);
// }, "posts");

// --- Example 2: Auto-generate slug from title if empty ---
// onRecordCreateRequest((e) => {
//     if (!e.record.get("pathname")) {
//         const title = e.record.get("title") || "untitled";
//         const slug = title.toLowerCase()
//             .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
//             .replace(/^-+|-+$/g, "");
//         e.record.set("pathname", "/" + slug);
//     }
// }, "posts");

// --- Example 3: Validate tag count limit ---
// onRecordCreateRequest((e) => {
//     const tags = e.record.get("tags") || [];
//     if (tags.length > 10) {
//         throw new BadRequestError("Maximum 10 tags per post");
//     }
// }, "posts");

// --- Example 4: Daily stats summary ---
// cronAdd("daily-stats-push", "0 8 * * *", () => {
//     const yesterday = new Date(Date.now() - 86400000)
//         .toISOString().split("T")[0];
//     const visits = $app.findRecordsByFilter(
//         "visits", "date = {:d}", { d: yesterday }
//     );
//     let total = 0;
//     for (const v of visits) total += v.getInt("views");
//     console.log("[vanblog] yesterday views:", total);
// });

// --- Example 5: Add custom header to all API responses ---
// routerUse((e) => {
//     e.response.header("X-Powered-By", "Vanblog")
//     return e.next()
// })

// --- Example 6: Record a custom audit event ---
// Core auditing (post.create, tag.delete, auth.login, ...) is handled by the
// Go layer (internal/audit) since 2026-09-17 — you don't need to re-register
// those. To record YOUR OWN events, write rows into the shared `audits`
// collection directly:
// onRecordCreateRequest((e) => {
//     e.next(); // must be first — see constraints in system.pb.js
//     const col = $app.findCollectionByNameOrId("audits");
//     const row = new Record(col);
//     if (e.auth && e.auth.collection().name === "users") row.set("actor", e.auth.id);
//     row.set("action", "newsletter.subscribe");
//     row.set("target", e.record.id);
//     row.set("result", "success");
//     row.set("ip", e.realIP());
//     $app.save(row);
// }, "subscribers");
