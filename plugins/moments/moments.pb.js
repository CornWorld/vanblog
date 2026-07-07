/// <reference path="./lib/vanblog.d.ts" />

// ============================================================================
// Vanblog Plugin: Moments (说说/动态) — Data Layer + Page Rendering
// ============================================================================
// Install: symlink to pb_hooks/moments.pb.js
//   ln -s ../../plugins/moments/moments.pb.js vault/pb_hooks/moments.pb.js
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Collection Creation — deferred to Go migrations (pb_migrations/)
// ----------------------------------------------------------------------------
//
// PB v0.39.5 may fire OnBootstrap before the concurrency pool is initialized,
// causing $app.findCollectionByNameOrId to panic. Collection auto-creation is
// handled by Go code in pb_migrations/ instead.
//
// When ready, re-enable with:
//   onBootstrap(function (e) {
//     try { ... } catch(_) { ... }
//   });
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// 2. Utility: query param parser (JSVM has no built-in URL parser)
// ----------------------------------------------------------------------------

function getQuery(e, name) {
  try {
    if (e.request && e.request.url) {
      var rawQuery = e.request.url.rawQuery || "";
      if (!rawQuery) return null;
      var pairs = rawQuery.split("&");
      for (var i = 0; i < pairs.length; i++) {
        var eq = pairs[i].indexOf("=");
        if (eq === -1) continue;
        var key = decodeURIComponent(
          pairs[i].substring(0, eq).replace(/\+/g, " ")
        );
        if (key === name) {
          return decodeURIComponent(
            pairs[i].substring(eq + 1).replace(/\+/g, " ")
          );
        }
      }
    }
  } catch (_) {}
  return null;
}

// ----------------------------------------------------------------------------
// 3. Audit helper (same module used by system.pb.js)
// ----------------------------------------------------------------------------

var audit;
function getAudit() {
  if (!audit) {
    audit = require("./pb_hooks/lib/vanblog-audit.js");
  }
  return audit;
}

// ----------------------------------------------------------------------------
// 4. API Routes
// ----------------------------------------------------------------------------

// 4a. Public list — GET /api/moments/list
routerAdd("GET", "/api/moments/list", function (e) {
  try {
    var page = parseInt(getQuery(e, "page") || "1");
    var perPage = parseInt(getQuery(e, "perPage") || "20");

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(perPage) || perPage < 1) perPage = 20;

    var totalItems = $app.countRecords(
      "moments",
      $dbx.hashExp({ visible: true })
    );
    var records = $app.findRecordsByFilter(
      "moments",
      "visible = true",
      "-created",
      perPage,
      (page - 1) * perPage
    );

    var items = [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      var authorId = rec.getString("author");
      var author = null;
      try {
        var authorRec = $app.findRecordById("users", authorId);
        author = {
          id: authorRec.id,
          username: authorRec.getString("username") || "",
          nickname: authorRec.getString("nickname") || "",
        };
      } catch (_) {}

      items.push({
        id: rec.id,
        content: rec.getString("content"),
        author: author,
        visible: rec.getBool("visible"),
        created: rec.getString("created"),
        updated: rec.getString("updated"),
      });
    }

    var totalPages = Math.ceil(totalItems / perPage);

    return e.json(200, {
      items: items,
      page: page,
      perPage: perPage,
      totalItems: totalItems,
      totalPages: totalPages,
    });
  } catch (err) {
    return e.json(500, { error: "Failed to list: " + (err.message || err) });
  }
});

// 4b. Create — POST /api/moments/create (auth required)
routerAdd("POST", "/api/moments/create", function (e) {
  try {
    if (!e.auth) {
      return e.json(401, { error: "Authentication required" });
    }

    var body;
    try {
      body = JSON.parse(toString(e.request.body) || "{}");
    } catch (_) {
      return e.json(400, { error: "Invalid JSON body" });
    }

    var content = (body.content || "").trim();
    if (!content) {
      return e.json(400, { error: "Content is required" });
    }
    if (content.length > 500) {
      return e.json(400, { error: "Content must be at most 500 characters" });
    }

    var collection = $app.findCollectionByNameOrId("moments");
    var record = new Record(collection);
    record.set("content", content);
    record.set("author", e.auth.id);
    record.set("visible", true);

    $app.save(record);

    getAudit().recordAudit({
      collection: "moments",
      recordId: record.id,
      action: "moment.create",
    });

    return e.json(200, {
      id: record.id,
      content: record.getString("content"),
      author: { id: e.auth.id, username: e.auth.getString("username") || "" },
      created: record.getString("created"),
    });
  } catch (err) {
    return e.json(500, { error: "Failed to create: " + (err.message || err) });
  }
});

// 4c. Delete — DELETE /api/moments/{id} (auth required, owner or admin)
routerAdd("DELETE", "/api/moments/{id}", function (e) {
  try {
    if (!e.auth) {
      return e.json(401, { error: "Authentication required" });
    }

    var momentId =
      e.request && e.request.pathValue ? e.request.pathValue("id") : "";

    if (!momentId) {
      return e.json(400, { error: "Moment ID is required" });
    }

    var record;
    try {
      record = $app.findRecordById("moments", momentId);
    } catch (_) {
      return e.json(404, { error: "Moment not found" });
    }

    var authorId = record.getString("author");
    var isAuthor = authorId === e.auth.id;
    var userRole = e.auth.getString("role") || "";
    var isAdmin = userRole === "admin";

    if (!isAuthor && !isAdmin) {
      return e.json(403, {
        error: "Not authorized: you must be the author or an admin",
      });
    }

    $app.delete(record);

    getAudit().recordAudit({
      collection: "moments",
      recordId: momentId,
      action: "moment.delete",
    });

    return e.json(200, { success: true });
  } catch (err) {
    return e.json(500, { error: "Failed to delete: " + (err.message || err) });
  }
});

// ----------------------------------------------------------------------------
// 5. Page Rendering — registered via $vanblog Go helpers
// ----------------------------------------------------------------------------

$vanblog.addNavItems("moments");

routerAdd("GET", "/_plugin/moments/render", function (e) {
  var manifest = $vanblog.readManifest("moments");
  var data = $vanblog.buildPageData(manifest, e.auth ? e.auth.id : "");
  var html = $vanblog.renderTemplate("moments", "frontend/index.html", data);
  return e.json(200, {
    html: html,
    title: manifest.routes.public.title || manifest.title || "",
    head: "",
    scripts: manifest.scripts || [],
    styles: manifest.styles || [],
  });
});

routerAdd("GET", "/_plugin/moments/admin", function (e) {
  if (!e.auth) return e.json(401, { error: "Unauthorized" });
  var manifest = $vanblog.readManifest("moments");
  var data = $vanblog.buildPageData(manifest, e.auth.id);
  var html = $vanblog.renderTemplate("moments", "frontend/admin.html", data);
  return e.json(200, {
    html: html,
    title: manifest.routes.admin.title || "",
    head: "",
    scripts: manifest.scripts || [],
    styles: manifest.styles || [],
  });
});

routerAdd("GET", "/plugins/moments/{path...}", $vanblog.serveStatic("moments"));

console.log("[moments] Plugin loaded (data layer + page rendering)");
