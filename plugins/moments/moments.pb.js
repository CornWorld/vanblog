/// <reference path="./lib/vanblog.d.ts" />

// ============================================================================
// Vanblog Plugin: Moments (说说/动态)
// ============================================================================
// 新模式示范:
// - Collection 由 Go migration 创建(vault/pb_migrations/1783000000_*.go)
// - CRUD 走 pb 原生 /api/collections/moments/records(自动有分页/过滤/权限)
// - 页面路由 + nav 由 $vanblog.servePlugin("moments") 一次性注册
// - audit/校验等业务用 pb 原生 hook
// ============================================================================

const audit = require("./pb_hooks/lib/vanblog-audit.js");

// 一行注册 public/admin/static 三条路由 + nav items
$vanblog.servePlugin("moments");

// 自动填充 author 字段(前端 create body 只需 { content, visible })
onRecordBeforeCreateRequest(function (e) {
  if (e.auth && e.auth.id) {
    e.record.set("author", e.auth.id);
  }
}, "moments");

// 业务 hook:audit(可选,删掉也能跑)
onRecordAfterCreateSuccess(function (e) {
  const ctx = audit.auditContext(e);
  audit.recordAudit({
    actor: ctx.actor,
    action: "moment.create",
    target: e.record.id,
    detail: { content: e.record.get("content") },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}, "moments");

onRecordAfterDeleteSuccess(function (e) {
  const ctx = audit.auditContext(e);
  audit.recordAudit({
    actor: ctx.actor,
    action: "moment.delete",
    target: e.record.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}, "moments");

console.log("[moments] Plugin loaded (declarative mode)");
