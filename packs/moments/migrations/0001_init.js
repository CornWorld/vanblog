migrate((app) => {
  try {
    app.findCollectionByNameOrId("moments");
    return; // already exists (idempotent)
  } catch (_e) {
    // not found; create below
  }

  const users = app.findCollectionByNameOrId("users");
  const collection = new Collection({
    type: "base",
    name: "moments",
    fields: [
      { name: "content", type: "text", required: true, max: 500 },
      { name: "author", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
      { name: "visible", type: "bool" },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    listRule: 'visible = true || @request.auth.id = author || @request.auth.role = "admin"',
    viewRule: 'visible = true || @request.auth.id = author || @request.auth.role = "admin"',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != "" && (@request.auth.id = author || @request.auth.role = "admin")',
    deleteRule: '@request.auth.id != "" && (@request.auth.id = author || @request.auth.role = "admin")',
  });
  return app.save(collection);
}, (app) => {
  try {
    return app.delete(app.findCollectionByNameOrId("moments"));
  } catch (_e) {
    return; // already gone
  }
});
