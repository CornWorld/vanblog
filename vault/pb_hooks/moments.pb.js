/// <reference path="./lib/vanblog.d.ts" />

// Moments legacy UI/fragment registration has been removed. The collection
// remains a core model for now; keep the author ownership hook so existing
// create flows retain the same data behavior.
onRecordCreateRequest(function (e) {
  if (e.auth && e.auth.id) {
    e.record.set("author", e.auth.id);
  }
  return e.next();
}, "moments");

console.log("[moments] Core author hook loaded");
