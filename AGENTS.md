# AGENTS.md

Vanblog dev 容器（`VANBLOG_MODE=dev`）。三服务：PocketBase `:8090`、Astro `:4321`、Caddy `:80/:443`。工作区 `/workspace`，工具链 `pnpm node go git caddy`。

## 环境

`. /etc/vanblog/agent.env` 取 `PB_URL`、`ASTRO_URL`、`VANBLOG_EMAIL`。admin 密码**不由容器输出**——跑 `curl -s $PB_URL/api/vanblog/setup/status` 判断是否首次启动：返回未初始化就引导用户完成 setup，已初始化则向用户索取密码。

SDK：`createVanblogClient({ url: process.env.PB_URL })`，登录 `pb.collection('users').authWithPassword(email, password)`。

## 知识源

`docs/` 是权威。**动手前读相关 docs**——用 `grep -n '^## ' docs/*.md` 找章节，不要盲改。本文件不抄录 docs 内容，只列规则。

## 构建与测试

```bash
pnpm --filter sdk build              # SDK（改 sdk/src 后必跑）
pnpm --filter vanblog-app build      # admin SSR app
cd themes/<name> && pnpm dev         # 主题 HMR
cd themes/<name> && pnpm build       # 主题构建验证
cd themes/<name> && pnpm check       # astro check 类型
cd vault && go test ./...            # Go 后端
cd vault && go build -o bin/vanblog . # pb 二进制
node scripts/theme-init.mjs <name>   # 脚手架新主题
```

改任何 `themes/*/astro.config.mjs` 或 `app/integrations/` 后，所有 theme 都要 rebuild。

## 禁区（不要改）

- `app/src/pages/admin/**` — 控制面板，锁定
- `app/src/pages/api/**` — API 端点
- `app/src/lib/**`、`app/src/loaders/**`、`app/src/live.config.*`、`app/src/middleware.*` — 平台基础设施
- `vault/pb_migrations/*.go` — 已锁定的 schema 迁移
- `sdk/src/` 公开 API 签名（L0 契约，破坏需 major 版本）
- `themes/<name>/src/base-overrides/{pages/admin,pages/api,lib,loaders}/**` — integration 对这些路径 fail-closed

## 主题规则

- 每个 theme 是独立 Astro 项目，通过 `@vanblog/base/*` alias 引用平台层
- 覆盖 base 组件时**保留所有现有 props**，可加 optional 新 props——详见 `docs/theme-implementer-guide.md` 的 L0/L1/L2 契约
- theme 必须自备：`src/middleware.ts`（可 re-export base）、`src/live.config.ts`（可空）、`src/layouts/PackPage.astro`
- CSS 永远用 `var(--color-*)`，不要硬编码颜色

## 后端规则

- Go managers 在 `vault/internal/<domain>/`，每个 `New(app)` 自挂 pb hook——见 `vault/main.go`
- 自定义路由挂 `/api/vanblog/*`，pb 原生 CRUD 走 `/api/collections/*`
- pb collection 的字段/权限规则定义在 `vault/pb_migrations/*.go`（文件名=变更说明）
- JSVM 钩子（用户扩展）在 `vault/pb_hooks/`，用 pb 原生 API（`$app`、`Record`、`cronAdd`），不做核心业务
- 破坏性操作（删数据、改 routing/schema）先 dry-run，向用户确认

## 迁移与升级

- 数据迁移走 Go 层 `POST /api/vanblog/migrate/import`（body=JSON，限 100MB，事务）——见 `vault/internal/migration/`
- 升级检查：对每个 `themes/<active>/src/base-overrides/<rel>` diff `app/src/<rel>`，按 L0/L1/L2 判断影响（L0 永远稳定、L1 可加不可减、L2 无保证）

## Skill 作者

Skill（`SKILL.md`）只写流程编排和检查清单，**不要抄 docs 内容**——领域知识一律 `read docs/<file>` 现场取。
