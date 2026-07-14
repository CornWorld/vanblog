onRecordCreateRequest(function (e) {
  if (e.auth && e.auth.id) {
    e.record.set("owner", e.auth.id);
  }
  return e.next();
}, "bookmarks");

console.log("[bookmarks] Pack hook loaded");
