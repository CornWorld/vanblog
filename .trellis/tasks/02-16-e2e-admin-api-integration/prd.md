# Task: e2e-admin-api-integration

## Overview

验证并修复 admin 前端与 server-ng 后端的完整 CRUD API 集成。上一轮（02-02-e2e-api-walk）已通过直接 HTTP 请求验证了 30 个 GET 端点全部 200。本轮聚焦于 **写操作（Create/Update/Delete）** 的端到端验证，确保 admin 前端通过 ts-rest 契约调用的所有 API 路径、HTTP 方法、请求参数与 server-ng 实际控制器路由完全匹配。

## Requirements

### 核心修复：9 个路由/方法不匹配

以下问题必须全部修复，修复策略为 **修改控制器以匹配契约**（契约是 Single Source of Truth）：

1. **Settings 子路由缺失**：`setting-core.controller.ts` 缺少 social、waline、isr、login、https、static、donations 的路由端点。`SettingCoreService` 中已实现相应方法，需添加控制器路由暴露它们。

2. **Settings 更新 HTTP 方法不匹配**：契约使用 `PUT`，控制器使用 `@Patch`。需统一为 `@Put` 以匹配契约。

3. **Category 路径不匹配**：契约 `PUT/DELETE /v2/categories/:name`，控制器 `PUT/DELETE /v2/categories/name/:name`（多余 `name/` 前缀）。需移除多余路径段。

4. **Tag 参数类型不匹配**：契约按 `:name`(string) 操作，控制器按 `:id`(number) 操作。需添加 by-name 路由或修改现有路由。

5. **User 方法+参数不匹配**：契约 `PUT /v2/admin/users`（body 含 id），控制器 `PATCH /v2/admin/users/:id`（path 参数）。需统一。

6. **Media 删除参数不匹配**：契约 `DELETE /v2/admin/media/:sign`(string)，控制器 `DELETE /v2/admin/media/:id`(number)。需匹配。

7. **Caddy 路径前缀不匹配**：契约 `/v2/caddy/*`，控制器 `/v2/admin/caddy/*`。需调整控制器路径或契约路径。

8. **Public Analytics 路径不匹配**：契约 `/analytics/public/overview`，控制器 `/analytics/viewers/public`。需统一。

9. **CustomPages CRUD stub 未实现**：`custom-pages.controller.ts` 的 create/update/delete 方法为空 stub，需实现实际逻辑。

### CRUD 端到端验证

对以下模块的完整 CRUD 流程进行端到端验证（HTTP 请求级别）：

| 模块           | Create | Read       | Update | Delete | 备注                    |
| -------------- | ------ | ---------- | ------ | ------ | ----------------------- |
| Article        | ✅     | ✅(已验证) | ✅     | ✅     |                         |
| Draft          | ✅     | ✅(已验证) | ✅     | ✅     | 含 publishDraft         |
| Category       | ✅     | ✅(已验证) | ✅     | ✅     | 按名称操作              |
| Tag            | -      | ✅(已验证) | ✅     | ✅     | 按名称操作              |
| User           | ✅     | ✅(已验证) | ✅     | ✅     | collaborator            |
| Pipeline       | ✅     | ✅(已验证) | ✅     | ✅     | 含 trigger              |
| CustomPage     | ✅     | ✅(已验证) | ✅     | ✅     | 按路径操作              |
| Settings (all) | -      | ✅(已验证) | ✅     | 部分   | social/donations 有删除 |
| Media          | -      | ✅(已验证) | -      | ✅     | 按 sign 删除            |
| Token          | ✅     | ✅(已验证) | -      | ✅     |                         |
| Backup         | -      | ✅(已验证) | -      | -      | 导入导出                |

### Admin 前端 API 层验证

- 验证 `packages/admin/src/services/van-blog/api.ts` 中所有函数的请求参数格式
- 验证响应数据解构是否与 server-ng 返回格式一致
- 验证错误处理（非 2xx 响应）是否正确传播到 UI

## Acceptance Criteria

- [ ] 所有 9 个路由/方法不匹配问题已修复
- [ ] Setting 控制器添加了所有缺失的子路由端点（social, waline, isr, login, https, static, donations）
- [ ] 所有控制器的 HTTP 方法（GET/POST/PUT/DELETE）与 contract.ts 中的定义一致
- [ ] 所有控制器的路由路径与 contract.ts 中的定义一致
- [ ] 所有控制器的参数名称和类型与 contract.ts 中的定义一致
- [ ] 所有 CRUD 端点通过 HTTP 请求测试验证（200/201/204 响应）
- [ ] CustomPages 的 create/update/delete 实现了实际逻辑（非空 stub）
- [ ] admin 前端可以成功完成文章创建→编辑→删除的完整流程
- [ ] admin 前端可以成功完成分类创建→更新→删除的完整流程
- [ ] admin 前端可以成功完成标签更新→删除的流程
- [ ] admin 前端可以成功完成用户创建→更新→删除的流程
- [ ] 现有单元测试全部通过（`pnpm --filter @vanblog/server-ng test`）
- [ ] TypeScript 编译无错误（`pnpm build:server`）

## Technical Notes

### 修复策略：控制器适配契约

- **契约是 Single Source of Truth**：`packages/shared/src/contract.ts` 定义了规范路径
- admin 前端通过 ts-rest `initClient(contract)` 自动按契约路径发请求
- 因此应修改 server-ng 控制器以匹配契约，而非反向修改
- 对于 tag/category 的 name vs id 问题，需分析哪种方式更合理后再决定方向

### admin API 调用三层架构

```
admin 页面组件
  → api.ts（聚合层，数据格式转换）
    → xxxService（映射层，代理 client 方法）
      → client.ts（ts-rest initClient，baseUrl: '/api', jsonQuery: true）
        → Vite proxy → server-ng :3050
```

### 上一轮成果参考

- 修复了 ts-rest 路由 doubling 问题（39 文件，-2688 行）
- 修复了 PermissionService Vite ESM 多实例问题
- 修复了插件路由顺序问题
- 报告文件：`.trellis/tasks/02-02-e2e-api-walk/E2E_API_WALK_REPORT.md`

### 浏览器自动化

- Playwright 已安装配置但无测试用例
- 本轮优先通过 HTTP 请求验证后端路由修复
- 如有余力可编写 Playwright 自动化 CRUD 测试

### 工作量估算

- 修改约 8-10 个控制器文件
- 为 setting-core.controller.ts 添加约 13 个缺失路由方法
- 验证约 60+ 个 API 端点的 CRUD 流程

## Out of Scope

- **前端 UI 重构**：不修改 admin 页面组件的布局或交互逻辑
- **新增 API 端点**：不设计新功能，只修复现有端点的路由/方法不匹配
- **性能优化**：不优化 API 响应速度
- **新增 Playwright E2E 测试**：本轮以 HTTP 请求级别验证为主，Playwright 测试为可选项
- **数据库 Schema 变更**：不修改 Drizzle 表定义
- **Website（前台）集成**：本轮只验证 admin 后台
