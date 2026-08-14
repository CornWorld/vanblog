# Changelog

> 完整逐版本记录见 [GitHub Releases](https://github.com/CornWorld/vanblog/releases)（release.yml 自动生成）。
> 本文件记录重构以来（`v0.54.0-corn` fork 分支）的主要变化，按 Keep a Changelog 格式。

本 fork 承袭 [mereithhh/vanblog](https://github.com/Mereithhh/vanblog)（GPL-3.0，原版已停止维护），用 **PocketBase + Astro + Caddy** 整体重构，替换无人维护的 Next.js + MongoDB 基础组件。

## [Unreleased]

- 文档与生态治理：质量审查 agent（`#agent_doc-reviewer`）、重复内容标准（`docs/quality/doc-standard.md`）、检测脚本（`scripts/doc-dup-check.mjs`）、去 AI 味写作 skill（`.agents/skills/de-ai-write`）、用户文档分层（reference / guide / faq）、README 门面、LICENSE、SECURITY、Issue 模板、CONTRIBUTING。
- Demo 站：`vanblog.corn.im` 线上演示（后台 demo/demo1234），部署指南 `docs/guide/demo.md` + 初始化脚本 `scripts/demo-setup.sh`。

## [0.54.0-corn.x] — 2026-06 起（重构主线）

### 架构

- 三服务重构：Caddy（路由/TLS）+ PocketBase（数据/API）+ Astro Theme Host（前台/后台 SSR）。
- 单容器 All-in-One；pb 只绑内网，所有外部流量经 Caddy。
- 迁移：ZIP 导入/导出（`POST /api/vanblog/migrate/import`），读取上游 MongoDB 集合并归档不兼容数据。

### 主题系统

- 三层模型（L0 后端 / L1 平台层 / L2 主题），`@vanblog/base/*` 引用。
- 旗舰主题 `vanblog`（原版前端迁移）+ 兜底主题 `base`；`site.activeTheme` 运行时切换。
- 主题/调色盘选择器（后台实时预览）；用户主题持久卷 + 内置只读合并，fsnotify 自动重扫。

### Pack 生态

- Pack 可插拔扩展：`pack.json` + `pages/` + `hooks/` + `migrations/*.js` 自声明集合。
- 内置 Pack：bookmarks / moments / visits / live2d-companion。
- CLI：`vanblog.sh pack list|status|plan|inspect|add`、`pack theme install|remove|list`。

### 评论

- Artalk 集成：内置 sidecar（`VANBLOG_ARTALK_ENABLED`）或外部容器（`VANBLOG_ARTALK_UPSTREAM`）。
- 评论 provider 收敛为 Artalk（移除 waline/giscus）。

### 媒体 / 图床

- S3 兼容对象存储（`site.s3Config` 同步 pb settings，上传自动切后端）。
- 图片归一化：BMP/TIFF/AVIF → WebP/AVIF（`site.mediaConfig`），SVG 直传。

### 内容

- 文章：草稿、分类、标签、自定义 pathname、回收站（软删除 + 恢复）、RSS、搜索、归档、时间线。
- 版本/修订：revisions 集合 + 自动捕获。

### 安全

- On-Demand TLS + `allowedDomains` 白名单（Setup 后空=拒绝）；`:8080` 纯 HTTP 应急管理端口。
- HTTP_ONLY 外置反代模式（`VANBLOG_HTTP_ONLY=1`）。

### 开发者体验

- dev 镜像：Go/Node 运行时 + 源码 + MCP（admin-only）+ Skill + 内置 pi agent。
- Go SDK + JSVM 扩展边界文档；`@vanblog/sdk` TypeScript SDK。
- CI：golangci-lint（11 linter）、`go test ./...`、test-build、release（ghcr prod+dev 双架构）。

### 早期（2026-06 之前，从原版继承的历史版本）

`v0.10.0` ~ `v0.54.0` 为原版 mereithhh/vanblog 的历史版本，记录见原仓库与 [GitHub Releases](https://github.com/CornWorld/vanblog/releases)。
