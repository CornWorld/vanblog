onRecordBeforeCreateRequest(function (e) {
  if (e.auth && e.auth.id) {
    e.record.set("owner", e.auth.id);
  }
}, "bookmarks");

console.log("[bookmarks] Pack hook loaded");
