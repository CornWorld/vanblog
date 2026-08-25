# 贡献指南

欢迎贡献！无论是修 bug、写文档、做主题还是提想法。

## 快速开始（本地开发）

推荐使用 dev 镜像（含全部工具链 + 内置 agent）：

```bash
docker build --target dev -t vanblog:dev .
./scripts/dev/dev-up.sh        # 启动 dev 容器（PocketBase :8090 / Astro :4321 / Caddy :80/:443）
```

也可以本地直接开发（`pnpm` + `go`）：

```bash
pnpm install
pnpm --filter sdk build          # 改 sdk/src 后必跑
pnpm --filter vanblog-app build  # admin SSR app
cd vault && go test ./...        # 后端测试
cd vault && go build -o bin/vanblog .   # pb 二进制
cd themes/<name> && pnpm dev     # 主题 HMR
```

> 详细环境见 `AGENTS.md`。

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat(theme): 增加暗色模式切换
fix(comments): 修复 Artalk 同源加载失败
docs(guide): 新增反代指南
test(migration): 补导入回环测试
```

类型：`feat` / `fix` / `docs` / `test` / `refactor` / `ci` / `chore` / `build`。

## 文档纪律

**这是本项目与其他项目最不同的地方，请务必遵守。**

- 文档分四层：`docs/reference/`（事实 SSOT）、`docs/guide/`（按 level 使用）、`docs/faq.md`（症状→ref）、README（门面）。
- **事实只写一次**：端口/路径/变量/默认值/命令在 `reference/` 定义，使用文档引用（`ref`）而不是复制。
- 动手写文档前读 [docs/quality/doc-standard.md](docs/quality/doc-standard.md)。
- 文档变更后跑：`node scripts/check/doc-dup-check.mjs`，要求 **S0 冲突 = 0**。

## 禁区（不要改）

- `app/src/pages/admin/**`、`app/src/pages/api/**` — 控制面板 / API 端点
- `app/src/lib/**`、`app/src/loaders/**`、`app/src/live.config.*`、`app/src/middleware.*` — 平台基础设施
- `vault/pb_migrations/*.go` — 已锁定的 schema 迁移
- `sdk/src/` 公开 API 签名（L0 契约，破坏需 major 版本）
- `themes/<name>/src/base-overrides/{pages/admin,pages/api,lib,loaders}/**`

## 主题 / Pack 开发

- 主题作者：[theme-implementer-guide.md](docs/developer/theme-implementer-guide.md)
- Pack：参考内置 `packs/*` 结构 + [docs/reference/packs.md](docs/reference/packs.md)

## PR 流程

1. 从 `main` 切分支。
2. 提交信息遵循规范；一个 PR 聚焦一件事。
3. 跑测试：`cd vault && go test ./...` + `pnpm --filter vanblog-app build`。
4. 若涉及 docs，跑 `node scripts/check/doc-dup-check.mjs`。
5. 打开 PR 并描述改动动机与验证方式。

## 安全

发现安全漏洞请走 [SECURITY.md](SECURITY.md) 私有渠道，**不要**开公开 Issue。
