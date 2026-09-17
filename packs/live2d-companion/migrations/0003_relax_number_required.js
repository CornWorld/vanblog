// 0003 — 放宽 live2d_config 数字字段的 required + 读规则公开化。
//
// 1. PB number 字段的 required 把 0 视为「空值」:面板默认 modelId=0、
//    modelTexturesId=0,且 minWidth=0 是合法语义(「0 表示不隐藏」)——
//    required:true 导致这三者为 0 时任何保存都 400(blank),配置自创建
//    以来无法保存。改为可选:缺省时前端按 DEFAULT_CONFIG 兜底。
// 2. list/view 规则放开为公开:widget 加载源(source)是全站行为,匿名
//    访客页面的 companion 需要能读到配置才能按所选源加载;字段全是
//    URL/数字/枚举,无敏感数据。写规则保持 admin-only。
migrate((app) => {
  const collection = app.findCollectionByNameOrId("live2d_config");
  for (const name of ["modelId", "modelTexturesId", "minWidth"]) {
    const field = collection.fields.getByName(name);
    if (field) field.required = false;
  }
  collection.listRule = "";
  collection.viewRule = "";
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("live2d_config");
  for (const name of ["modelId", "modelTexturesId", "minWidth"]) {
    const field = collection.fields.getByName(name);
    if (field) field.required = true;
  }
  collection.listRule = '@request.auth.role = "admin"';
  collection.viewRule = '@request.auth.role = "admin"';
  return app.save(collection);
});
