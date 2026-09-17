// Audit helper module for vanblog JSVM hooks.
//
// Loaded via require() so the SAME cached module instance is shared across
// both the loader VM and all executor VMs (goja_nodejs require registry is
// shared per jsvm plugin — see jsvm.go:285). Hook files cannot rely on
// top-level function declarations because jsvm re-compiles callback strings
// inside executor VMs where loader-only bindings are invisible.
//
// Error visibility contract (2026-09-16):
// - Every action helper wraps its body: an unexpected throw is reported via
//   hookError() — a failure row in `audits` (result="failure", visible in the
//   admin audits page) plus console.error on stdout — and then SWALLOWED.
//   The operation has already succeeded at that point (helpers run after
//   e.next() in Request hooks), so a broken audit must never corrupt the
//   HTTP result with a misleading 500.
// - $app.logger() is NOT callable from the JSVM: the returned slog.Logger
//   exposes only pointer-receiver methods, which goja cannot see on the
//   value ("Object has no member 'Error'"). console.* goes through Go's log
//   package → stdout with a timestamp, no levels, not into the _logs table.
//   audits failure rows + console.error are the error surfaces.

function recordAudit(args) {
  try {
    const collection = $app.findCollectionByNameOrId("audits");
    const record = new Record(collection);
    if (args.actor) record.set("actor", args.actor);
    record.set("action", args.action || "unknown");
    record.set("target", args.target || "");
    record.set("result", args.result || "success");
    record.set(
      "detail",
      typeof args.detail === "object"
        ? JSON.stringify(args.detail)
        : args.detail || ""
    );
    record.set("ip", args.ip || "");
    record.set("userAgent", args.userAgent || "");
    $app.save(record);
  } catch (err) {
    console.error("[vanblog] recordAudit failed:", err);
  }
}

// hookError reports a hook-layer bug without corrupting the in-flight
// operation. Two surfaces: a failure row in `audits` (queryable in the
// admin UI) and console.error (stdout with timestamp). Never rethrows —
// callers rely on that to keep the HTTP result intact.
function hookError(action, e, err) {
  let recordId = "";
  try {
    recordId = (e.record && e.record.id) || "";
  } catch (_e) {
    /* e.record unavailable in some event shapes */
  }
  console.error(
    "[vanblog] hook error:",
    action,
    "record:",
    recordId,
    err && (err.stack || String(err))
  );
  try {
    recordAudit({
      action: "hook.error",
      target: action + ":" + recordId,
      result: "failure",
      detail: {
        error: String(err),
        stack: err && err.stack ? String(err.stack) : "",
      },
    });
  } catch (_e2) {
    /* audits table itself unwritable — stdout line above is all we have */
  }
}

function auditContext(e) {
  let actor = "";
  let ip = "";
  let ua = "";
  try {
    // audits.actor 是指向 users 的 relation;_superusers 的 id 塞进去会
    // 校验失败。superuser 操作(actor 留空=系统动作)与匿名写都不落 actor。
    const a = e.auth;
    if (
      a &&
      a.id &&
      a.collection &&
      a.collection() &&
      a.collection().name === "users"
    ) {
      actor = a.id;
    }
  } catch {
    /* expected when no auth is attached */
  }
  try {
    ip = e.realIP ? e.realIP() : "";
  } catch {
    /* expected outside a request event */
  }
  try {
    if (e.request) {
      ua = (e.request.header && e.request.header("User-Agent")) || "";
    }
  } catch {
    /* expected outside a request event */
  }
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
// Each helper is fail-safe: unexpected throws become hookError reports
// (audits failure row + console.error) instead of a 500 on a succeeded write.

function postAction(action, e) {
  try {
    const ctx = auditContext(e);
    recordAudit({
      actor: ctx.actor,
      action,
      target: targetOf(e.record.id, e.record.get("title")),
      detail: postSummary(e.record),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    hookError(action, e, err);
  }
}

function tagAction(action, e) {
  try {
    const ctx = auditContext(e);
    recordAudit({
      actor: ctx.actor,
      action,
      target: targetOf(e.record.id, e.record.get("name")),
      detail: tagSummary(e.record),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    hookError(action, e, err);
  }
}

function categoryAction(action, e) {
  try {
    const ctx = auditContext(e);
    recordAudit({
      actor: ctx.actor,
      action,
      target: targetOf(e.record.id, e.record.get("name")),
      detail: categorySummary(e.record),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    hookError(action, e, err);
  }
}

function mediaAction(action, e) {
  try {
    const ctx = auditContext(e);
    recordAudit({
      actor: ctx.actor,
      action,
      target: targetOf(
        e.record.id,
        e.record.get("file") || e.record.get("staticType") || ""
      ),
      detail: mediaSummary(e.record),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    hookError(action, e, err);
  }
}

function userAction(action, e, fallbackSelf) {
  try {
    const ctx = auditContext(e);
    recordAudit({
      actor: ctx.actor || (fallbackSelf ? e.record.id : ""),
      action,
      target: targetOf(e.record.id, e.record.get("username")),
      detail: userSummary(e.record),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    hookError(action, e, err);
  }
}

function siteAction(e) {
  try {
    const ctx = auditContext(e);
    recordAudit({
      actor: ctx.actor,
      action: "site.update",
      target: targetOf(e.record.id, "site"),
      detail: {
        siteName: e.record.get("siteName"),
        baseUrl: e.record.get("baseUrl"),
        palette: e.record.get("palette"),
        activeTheme: e.record.get("activeTheme"),
        httpsRedirect: !!e.record.get("httpsRedirect"),
      },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    hookError("site.update", e, err);
  }
}

function authLogin(e) {
  try {
    const ctx = auditContext(e);
    recordAudit({
      actor: e.record.id,
      action: "auth.login",
      target: e.record.email || e.record.username || e.record.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    hookError("auth.login", e, err);
  }
}

module.exports = {
  recordAudit,
  auditContext,
  hookError,
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
