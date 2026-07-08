/// <reference path="./lib/vanblog.d.ts" />

// ============================================================================
// Vanblog Plugin: Bookmarks (网址收藏)
// ============================================================================
// 新模式:collection 由 Go migration 创建,CRUD 走 pb 原生 API,
// 页面路由 + nav 由 servePlugin 注册。
// ============================================================================

// 一行注册 public/admin/static 三条路由 + nav items
$vanblog.servePlugin("bookmarks");

// 自动填充 owner 字段(前端 create body 只需 { title, url, description })
onRecordBeforeCreateRequest(function (e) {
  if (e.auth && e.auth.id) {
    e.record.set("owner", e.auth.id);
  }
}, "bookmarks");

console.log("[bookmarks] Plugin loaded (declarative mode)");
