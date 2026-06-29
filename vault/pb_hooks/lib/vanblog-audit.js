// Audit helper module for vanblog JSVM hooks.
//
// Loaded via require() so the SAME cached module instance is shared across
// both the loader VM and all executor VMs (goja_nodejs require registry is
// shared per jsvm plugin — see jsvm.go:285). Hook files cannot rely on
// top-level function declarations because jsvm re-compiles callback strings
// inside executor VMs where loader-only bindings are invisible.

function recordAudit(args) {
    try {
        const collection = $app.findCollectionByNameOrId("audits");
        const record = new Record(collection);
        record.set("actor", args.actor || "");
        record.set("action", args.action || "unknown");
        record.set("target", args.target || "");
        record.set("result", args.result || "success");
        record.set(
            "detail",
            typeof args.detail === "object"
                ? JSON.stringify(args.detail)
                : (args.detail || "")
        );
        record.set("ip", args.ip || "");
        record.set("userAgent", args.userAgent || "");
        $app.save(record);
    } catch (err) {
        console.log("[vanblog] recordAudit failed:", err);
    }
}

function auditContext(e) {
    let actor = "";
    let ip = "";
    let ua = "";
    try { actor = (e.auth && e.auth.id) || ""; } catch (_) {}
    try { ip = e.realIP ? e.realIP() : ""; } catch (_) {}
    try {
        if (e.request) {
            ua = (e.request.header && e.request.header("User-Agent")) || "";
        }
    } catch (_) {}
    return { actor, ip, userAgent: ua };
}

function targetOf(id, label) {
    return label ? `${id}:${label}` : id;
}

function postSummary(rec) {
    return {
        id: rec.id,
        title: rec.get("title"),
        status: rec.get("status"),
        pathname: rec.get("pathname"),
        category: rec.get("category") || "",
        tags: rec.get("tags") || [],
        deleted: !!rec.get("deleted"),
    };
}

function tagSummary(rec) {
    return { id: rec.id, name: rec.get("name"), slug: rec.get("slug") || "" };
}

function categorySummary(rec) {
    return {
        id: rec.id,
        name: rec.get("name"),
        type: rec.get("type") || "",
        private: !!rec.get("private"),
    };
}

function mediaSummary(rec) {
    return {
        id: rec.id,
        file: rec.get("file") || "",
        staticType: rec.get("staticType") || "",
        storageType: rec.get("storageType") || "",
    };
}

function userSummary(rec) {
    return {
        id: rec.id,
        username: rec.get("username"),
        nickname: rec.get("nickname") || "",
        email: rec.get("email") || "",
        role: rec.get("role") || "",
        permissions: rec.get("permissions") || [],
    };
}

// ---- Per-collection audit helpers (called from hook callbacks) ------------

function postAction(action, e) {
    const ctx = auditContext(e);
    recordAudit({
        actor: ctx.actor,
        action,
        target: targetOf(e.record.id, e.record.get("title")),
        detail: postSummary(e.record),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
    });
}

function tagAction(action, e) {
    const ctx = auditContext(e);
    recordAudit({
        actor: ctx.actor,
        action,
        target: targetOf(e.record.id, e.record.get("name")),
        detail: tagSummary(e.record),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
    });
}

function categoryAction(action, e) {
    const ctx = auditContext(e);
    recordAudit({
        actor: ctx.actor,
        action,
        target: targetOf(e.record.id, e.record.get("name")),
        detail: categorySummary(e.record),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
    });
}

function mediaAction(action, e) {
    const ctx = auditContext(e);
    recordAudit({
        actor: ctx.actor,
        action,
        target: targetOf(e.record.id, e.record.get("file") || e.record.get("staticType") || ""),
        detail: mediaSummary(e.record),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
    });
}

function userAction(action, e, fallbackSelf) {
    const ctx = auditContext(e);
    recordAudit({
        actor: ctx.actor || (fallbackSelf ? e.record.id : ""),
        action,
        target: targetOf(e.record.id, e.record.get("username")),
        detail: userSummary(e.record),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
    });
}

function siteAction(e) {
    const ctx = auditContext(e);
    recordAudit({
        actor: ctx.actor,
        action: "site.update",
        target: targetOf(e.record.id, "site"),
        detail: {
            siteName: e.record.get("siteName"),
            baseUrl: e.record.get("baseUrl"),
            theme: e.record.get("theme"),
            httpsRedirect: !!e.record.get("httpsRedirect"),
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
    });
}

function authLogin(e) {
    const ctx = auditContext(e);
    recordAudit({
        actor: e.record.id,
        action: "auth.login",
        target: e.record.email || e.record.username || e.record.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
    });
}

module.exports = {
    recordAudit,
    auditContext,
    targetOf,
    postSummary,
    tagSummary,
    categorySummary,
    mediaSummary,
    userSummary,
    postAction,
    tagAction,
    categoryAction,
    mediaAction,
    userAction,
    siteAction,
    authLogin,
};
