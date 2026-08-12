migrate((app) => {
  try {
    app.findCollectionByNameOrId("bookmarks");
    return; // already exists (idempotent)
  } catch (_e) {
    // not found; create below
  }

  const users = app.findCollectionByNameOrId("users");
  const collection = new Collection({
    type: "base",
    name: "bookmarks",
    fields: [
      { name: "title", type: "text", required: true },
      { name: "url", type: "url", required: true },
      { name: "description", type: "text" },
      { name: "owner", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != "" && (@request.auth.id = owner || @request.auth.role = "admin")',
    deleteRule: '@request.auth.id != "" && (@request.auth.id = owner || @request.auth.role = "admin")',
  });
  return app.save(collection);
}, (app) => {
  try {
    return app.delete(app.findCollectionByNameOrId("bookmarks"));
  } catch (_e) {
    return; // already gone
  }
});
