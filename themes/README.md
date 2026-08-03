# themes/ — 主题目录

> 概念模型见 [`docs/theme-concepts.md`](../docs/theme-concepts.md)。
> 主题作者手册见 [`docs/theme-implementer-guide.md`](../docs/theme-implementer-guide.md)。

## 三层模型（一句话）

| 层            | 位置       | 职责                                                                          |
| ------------- | ---------- | ----------------------------------------------------------------------------- |
| **L0 后端**   | `vault/`   | 数据 / API / 权限（PocketBase + Go）                                          |
| **L1 平台层** | `app/`     | 数据访问与渲染基础设施 + base 布局（纯布局 + 简单颜色）；admin / api 是平台层 |
| **L2 主题**   | `themes/*` | 站点的视觉 / 信息架构 / 交互（独立 Astro 项目）                               |

`builtin` 一词已退役：旧 `@vanblog/builtin/*` → `@vanblog/base/*`，旧 `src/builtin-overrides/` → `src/base-overrides/`。

## 内置主题

### `base/` — 基础主题（minimal）

- **定位**：纯布局 + 简单颜色的 minimal 主题。
- **用途**：验证后端能力；提供最基本前端能力（列表/详情/归档/时间轴/搜索/分类/标签/关于/404）；作为**兜底/降级主题**。
- **不依赖** vanblog 主题；直接复用平台层 base 布局。
- **脚手架**：`node scripts/theme-init.mjs <name>` 会克隆本目录作为新主题起点。

### `vanblog/` — 旗舰主题（mereithhh 迁移）

- **定位**：从 mereithhh 的 vanblog 前端（`packages/website`）迁移而来的**完整视觉主题**，独立于 base。
- **特点**：自带 BaseLayout、全套组件（ArticleCard / Nav / Footer / Toc / Reward / ...）、11 个 public 页面。
- **默认主题**：镜像/首次启动的默认主题是 `vanblog`（`Dockerfile ARG VANBLOG_ACTIVE_THEME=vanblog`）；base 是文档化的兜底。

## 主题怎么工作

- 每个主题是**独立 Astro 项目**（标准 `src/pages/`、`src/layouts/`、`src/components/`）。
- 通过 `@vanblog/base/*` alias 引用平台层（`app/src/`），由 `app/integrations/themes/index.mjs` 解析：
  1. 优先 `src/base-overrides/<rel>`（主题局部覆盖）
  2. fallback `app/src/<rel>`（平台层）
- admin / login / setup 是**平台层 control plane**，由独立 admin SSR app（`app/`，产物 `app/dist`）服务，dispatcher 在 `/admin` `/login` `/setup` 特判转发，主题**不再编译**它们。`/api/revalidate` 仍是平台层端点，主题用薄壳 re-export（`@vanblog/base/pages/api/revalidate`）。
- public 页面（首页/文章/...）**主题自有**，参考 `vanblog/` 的写法。
- 运行期由 dispatcher 按 `site.activeTheme` 切换主题（`app/src/dispatcher/index.mjs`）。

## 新增主题

```bash
node scripts/theme-init.mjs my-theme   # 克隆 themes/base 模板
cd themes/my-theme
pnpm install
pnpm dev                               # http://localhost:4321
```
