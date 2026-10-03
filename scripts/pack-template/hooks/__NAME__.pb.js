// Pack JSVM 钩子骨架:事件钩子 / 自定义路由 / cron。
// 路由前缀统一 /api/packs/<name>/…;可用全局见 docs/reference/packs.md。
// 安装/修改后需重启容器(POST /api/vanblog/system/restart 或 docker restart)。
routerAdd("GET", "/api/packs/__NAME__/hello", (e) => {
  return e.json(200, { ok: true, pack: "__NAME__" });
});
