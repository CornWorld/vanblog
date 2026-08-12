migrate((app) => {
  try {
    app.findCollectionByNameOrId("live2d_config");
    return; // already exists (idempotent)
  } catch (_e) {
    // not found; create below
  }

  const collection = new Collection({
    type: "base",
    name: "live2d_config",
    fields: [
      { name: "widgetPath", type: "url", required: true },
      { name: "cdnPath", type: "url", required: true },
      { name: "modelId", type: "number", required: true },
      { name: "modelTexturesId", type: "number", required: true },
      { name: "tools", type: "json" },
      { name: "minWidth", type: "number", required: true },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    listRule: '@request.auth.role = "admin"',
    viewRule: '@request.auth.role = "admin"',
    createRule: '@request.auth.role = "admin"',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  });
  return app.save(collection);
}, (app) => {
  try {
    return app.delete(app.findCollectionByNameOrId("live2d_config"));
  } catch (_e) {
    return; // already gone
  }
});
