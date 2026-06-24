/// <reference path="./types.d.ts" />

// ============================================================================
// Vanblog System Hooks (JSVM)
// ============================================================================
// These hooks provide "soft" business logic that benefits from hot-reload
// and user customization. Performance-critical hooks (revisions, visits
// counting, RSS/sitemap generation) are in Go's internal/hooks package.
//
// Users can modify these files without recompiling the Go binary.
// Files in pb_hooks/ are auto-reloaded on change (UNIX).
// ============================================================================

// --- 1. Audits: log auth events ---
// Records login/logout to the audits table for security tracking.
onRecordAuthRequest((e) => {
    try {
        const collection = $app.findCollectionByNameOrId("audits");
        const record = new Record(collection);
        record.set("actor", e.record.id);
        record.set("action", "auth.login");
        record.set("target", e.record.email || e.record.username);
        record.set("result", "success");
        record.set("ip", e.realIP());
        record.set("userAgent", e.request.header("User-Agent") || "");
        $app.save(record);
    } catch (err) {
        console.log("[vanblog] audit log failed:", err);
    }
}, "users");

// --- 2. Audits: log post deletion ---
// Records when articles are deleted for accountability.
onRecordDeleteRequest((e) => {
    try {
        const collection = $app.findCollectionByNameOrId("audits");
        const record = new Record(collection);
        record.set("action", "post.delete");
        record.set("target", e.record.id + ":" + e.record.get("title"));
        record.set("result", "success");
        record.set("detail", JSON.stringify({
            title: e.record.get("title"),
            status: e.record.get("status"),
            pathname: e.record.get("pathname"),
        }));
        $app.save(record);
    } catch (err) {
        console.log("[vanblog] delete audit failed:", err);
    }
}, "posts");

// --- 3. Daily visits aggregation (cron) ---
// Runs at midnight to create the site-wide aggregate row (path="")
// for the previous day's visits.
cronAdd("visits-daily-aggregate", "0 0 * * *", () => {
    const yesterday = new Date(Date.now() - 86400000)
        .toISOString().split("T")[0];

    try {
        // Sum all per-path visits for yesterday
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

        // Find or create aggregate row
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
