migrate((app) => {
  try {
    app.findCollectionByNameOrId("site_visits");
    return; // already exists (idempotent)
  } catch (_e) {
    // not found; create below
  }

  const collection = new Collection({
    type: "base",
    name: "site_visits",
    fields: [
      { name: "visited", type: "number" },
      { name: "sessions", type: "json" },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  return app.save(collection);
}, (app) => {
  try {
    return app.delete(app.findCollectionByNameOrId("site_visits"));
  } catch (_e) {
    return; // already gone
  }
});
