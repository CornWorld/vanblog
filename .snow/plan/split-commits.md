# 拆分现有改动为多次提交

## Context

工作区有大量未提交改动，涵盖插件系统的 SDK、后端、前端、示例插件和文档。需要按逻辑拆分为多个独立提交。

## 分析

- **改动范围**: 8 个已修改文件 + 13 个新文件
- **核心主题**: 插件系统（Go 后端引擎 + Astro 前端集成 + 示例插件）
- **格式化噪音**: 多处 single→double quotes、缩进调整，与功能改动混在一起，不适合单独拆分

## 提交拆分方案

### Commit 1: `feat(sdk): add PluginNavItem + getNavItems to server middleware`

- **文件**:
  - `sdk/src/index.ts` — 导出 PluginNavItem 类型
  - `sdk/src/server.ts` — PluginNavItem 接口、getNavItems 中间件、pbUrl 注入
  - `app/src/env.d.ts` — Locals 类型声明（pbUrl、getNavItems）
- **说明**: SDK 层新增插件导航支持，前端后续依赖此接口

### Commit 2: `feat(app): render plugin nav items in header, tailwind plugin scanning`

- **文件**:
  - `app/src/layouts/BaseLayout.astro` — 导航栏渲染 pluginNavItems
  - `app/src/styles/global.css` — 新增 `@source "../../plugins/**/frontend/**/*.html"`
- **说明**: 前端集成插件导航项，Tailwind 扫描插件 HTML 模板

### Commit 3: `feat(vault): plugin engine backend`

- **文件**:
  - `vault/main.go` — 插件管理器初始化
  - `vault/internal/plugins/plugins.go` — 新文件，Go 插件引擎
  - `vault/pb_hooks/lib/vanblog.d.ts` — $vanblog 类型声明
  - `vault/pb_hooks/plugins.pb.js` — 新文件，插件系统 JSVM hooks
- **说明**: Go 后端插件加载、模板渲染、导航注册

### Commit 4: `feat(app): plugin frontend pages + loader`

- **文件**:
  - `app/src/lib/plugin-loader.ts` — 新文件，SSR 端插件页面获取
  - `app/src/pages/admin/plugins/[plugin].astro` — 新文件，管理后台插件页
  - `app/src/pages/p/[plugin].astro` — 新文件，公开插件页
- **说明**: 前端插件路由和 SSR 数据加载

### Commit 5: `feat: example plugins (moments + bookmarks)`

- **文件**:
  - `plugins/moments/*` — 新文件，Moments 插件示例
  - `plugins/bookmarks/*` — 新文件，Bookmarks 插件示例
  - `vault/pb_hooks/moments.pb.js` — 新文件，Moments JSVM hooks
- **说明**: 两个示例插件，验证插件系统可用

### Commit 6: `chore: plugin docs + eslint config`

- **文件**:
  - `docs/plugin-authoring.md` — 新文件，插件开发文档
  - `eslint.config.js` — 新增 plugins/pb_hooks 忽略规则 + JSVM globals
- **说明**: 开发者文档和 lint 配置

## 完成总结

**状态**: ✅ 全部完成
**提交次数**: 6/6

### 结果

| #   | Commit                                 | 文件数 | Hash      |
| --- | -------------------------------------- | ------ | --------- |
| 1   | feat(sdk): PluginNavItem + getNavItems | 3      | `a03ab52` |
| 2   | feat(app): plugin nav in header        | 2      | `e843888` |
| 3   | feat(vault): plugin engine backend     | 4      | `7b93097` |
| 4   | feat(app): plugin frontend pages       | 3      | `8050b41` |
| 5   | feat: example plugins                  | 9      | `28e5686` |
| 6   | chore: docs + eslint                   | 2      | `9d3a39d` |

### 验证

- [x] 每次提交均通过 `go vet` + `astro check`（0 errors）
- [x] 工作区干净，无未提交改动
- [x] 仅剩 `.snow/plan/*.md` 为未追踪文件

### ⚠️ 未提交

- `.snow/plan/*.md` — 计划文档，建议加入 `.gitignore`

## 执行方式

使用 `git add` 按文件分组提交，避免交互式暂存（部分文件格式化与功能混杂，完整提交更可靠）。
