onRecordCreateRequest(function (e) {
  if (e.auth && e.auth.id) {
    e.record.set("author", e.auth.id);
  }
  return e.next();
}, "moments");

console.log("[moments] Pack hook loaded");
