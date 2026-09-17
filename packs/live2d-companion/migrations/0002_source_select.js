// 0002 — 加载源选择字段(source)。
//
// 配置面板按此字段决定 widget 脚本的加载源,并附优缺点说明供管理员选择:
//   auto(默认)= 本地 vendored 优先,CDN 兜底
//   local       = 仅本地 vendored 副本(随镜像分发)
//   cdn         = 仅 CDN
// 空值视为 auto(存量记录兼容,字段不设 required)。
migrate((app) => {
  const collection = app.findCollectionByNameOrId("live2d_config");
  if (collection.fields.getByName("source")) {
    return; // already added (idempotent)
  }
  collection.fields.add(new SelectField({
    name: "source",
    values: ["auto", "local", "cdn"],
    maxSelect: 1,
  }));
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("live2d_config");
  collection.fields.removeByName("source");
  return app.save(collection);
});
