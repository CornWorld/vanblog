// PB JS 迁移骨架:建 pack 自己的 collection(DDL),启动时执行,幂等。
// ⚠️ findCollectionByNameOrId 找不到时抛异常不返回 null —— 存在性判断必须
// try/catch(见 docs/internal/pocketbase-extension-contract.md 事实 5)。
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId("__NAME___records");
      return; // 已存在(幂等)
    } catch (_e) {
      // 未找到,继续创建
    }
    const collection = new Collection({
      name: "__NAME___records",
      type: "base",
      fields: [
        { name: "title", type: "text", required: true },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onUpdate: true },
      ],
      listRule: "",   // 公开读(空字符串 = public;null = 仅 superuser)
      viewRule: "",
    });
    app.save(collection);
  },
  (app) => {
    try {
      return app.delete(app.findCollectionByNameOrId("__NAME___records"));
    } catch (_e) {
      return; // 已删除(幂等)
    }
  }
);
