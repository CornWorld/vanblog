/// <reference path="./lib/vanblog.d.ts" />

// Legacy moments remains a core hook until it is migrated to Pack resources.
$vanblog.servePlugin("moments");

onRecordBeforeCreateRequest(function (e) {
  if (e.auth && e.auth.id) {
    e.record.set("author", e.auth.id);
  }
}, "moments");

console.log("[moments] Plugin loaded (declarative mode)");
