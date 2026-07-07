/// <reference path="./lib/vanblog.d.ts" />

// ============================================================================
// Vanblog Plugin: Bookmarks (网址收藏) — Data Layer + Page Rendering
// ============================================================================

// Collection creation (idempotent)
onBootstrap(function (e) {
  try {
    var existing = $app.findCollectionByNameOrId("bookmarks");
    if (existing) {
      console.log("[bookmarks] Collection already exists, skipping creation.");
      return;
    }
  } catch (_) {}

  var usersCol = $app.findCollectionByNameOrId("users");

  var collection = new Collection({
    type: "base",
    name: "bookmarks",
    listRule: "",
    viewRule: "",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && @request.auth.id = owner",
    deleteRule:
      "@request.auth.id != '' && (@request.auth.id = owner || @request.auth.role = 'admin')",
    fields: [
      { name: "title", type: "text", required: true },
      { name: "url", type: "url", required: true },
      { name: "description", type: "text", required: false },
      {
        name: "owner",
        type: "relation",
        collectionId: usersCol.id,
        maxSelect: 1,
        required: true,
      },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });

  $app.save(collection);
  console.log("[bookmarks] Collection created successfully.");
});

// Shared utilities
var getQuery = require("./pb_hooks/lib/vanblog-query.js");

// API: List all (use ?mine=1 for current user only)
routerAdd("GET", "/api/bookmarks/list", function (e) {
  try {
    var filter = "id != ''";
    if (getQuery(e, "mine") === "1" && e.auth) {
      filter = "owner = '" + e.auth.id + "'";
    }
    var records = $app.findRecordsByFilter(
      "bookmarks",
      filter,
      "-created",
      100,
      0
    );
    var items = [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      items.push({
        id: rec.id,
        title: rec.getString("title"),
        url: rec.getString("url"),
        description: rec.getString("description") || "",
        created: rec.getString("created"),
      });
    }
    return e.json(200, { items: items });
  } catch (err) {
    return e.json(500, { error: "Failed to list: " + (err.message || err) });
  }
});

// API: Create
routerAdd("POST", "/api/bookmarks/create", function (e) {
  try {
    if (!e.auth) return e.json(401, { error: "Authentication required" });
    var body;
    try {
      body = JSON.parse(toString(e.request.body) || "{}");
    } catch (_) {
      return e.json(400, { error: "Invalid JSON" });
    }
    var title = (body.title || "").trim();
    var url = (body.url || "").trim();
    if (!title || !url)
      return e.json(400, { error: "Title and URL are required" });

    var col = $app.findCollectionByNameOrId("bookmarks");
    var record = new Record(col);
    record.set("title", title);
    record.set("url", url);
    record.set("description", (body.description || "").trim());
    record.set("owner", e.auth.id);
    $app.save(record);

    return e.json(200, {
      id: record.id,
      title: record.getString("title"),
      url: record.getString("url"),
    });
  } catch (err) {
    return e.json(500, { error: "Failed to create: " + (err.message || err) });
  }
});

// API: Delete
routerAdd("DELETE", "/api/bookmarks/{id}", function (e) {
  try {
    if (!e.auth) return e.json(401, { error: "Authentication required" });
    var id = e.request && e.request.pathValue ? e.request.pathValue("id") : "";
    if (!id) return e.json(400, { error: "ID is required" });

    var record;
    try {
      record = $app.findRecordById("bookmarks", id);
    } catch (_) {
      return e.json(404, { error: "Not found" });
    }

    var ownerId = record.getString("owner");
    if (ownerId !== e.auth.id && (e.auth.getString("role") || "") !== "admin") {
      return e.json(403, { error: "Not authorized" });
    } else {
    }
    $app.delete(record);
    return e.json(200, { success: true });
  } catch (err) {
    return e.json(500, { error: "Failed to delete: " + (err.message || err) });
  }
});

// ----------------------------------------------------------------------------
// Page Rendering (keep existing $vanblog code below)
// ----------------------------------------------------------------------------

// ============================================================================
// Plugin: bookmarks — registers routes using $vanblog helpers
// ============================================================================

var name = "bookmarks";

// Collect nav items at load time
$vanblog.addNavItems(name);

// Public page render
routerAdd("GET", "/_plugin/bookmarks/render", function (e) {
  var manifest = $vanblog.readManifest("bookmarks");
  var data = $vanblog.buildPageData(manifest, e.auth ? e.auth.id : "");
  var html = $vanblog.renderTemplate("bookmarks", "frontend/index.html", data);
  return e.json(200, {
    html: html,
    title: manifest.routes.public.title || manifest.title || "",
    head: "",
    scripts: manifest.scripts || [],
    styles: manifest.styles || [],
  });
});

// Admin page render
routerAdd("GET", "/_plugin/bookmarks/admin", function (e) {
  if (!e.auth) return e.json(401, { error: "Unauthorized" });
  var manifest = $vanblog.readManifest("bookmarks");
  var data = $vanblog.buildPageData(manifest, e.auth.id);
  var html = $vanblog.renderTemplate("bookmarks", "frontend/admin.html", data);
  return e.json(200, {
    html: html,
    title: manifest.routes.admin.title || "",
    head: "",
    scripts: manifest.scripts || [],
    styles: manifest.styles || [],
  });
});

// Static assets
routerAdd(
  "GET",
  "/plugins/bookmarks/{path...}",
  $vanblog.serveStatic("bookmarks")
);
