# Theme 概念模型：平台层 / base 主题 / vanblog 主题

> 目的：澄清三个容易混淆的概念，让"什么是平台层、什么是 base、什么是 vanblog 主题"在代码结构上清晰可辨。
>
> 背景：旧称 **builtin** 一词退役。它过去同时指代 4 件不同的事——`@vanblog/builtin/*` alias、`src/builtin-overrides/` 目录、`app/src/`（所谓"builtin 源头"），还跟 Packs 的 `builtinPacksDir`（Go 侧）撞词。这个词造成的认知混乱正是本文件要消除的。

---

## 0. 一句话版本

- **平台层**（`app/`）：数据访问与渲染基础设施，不属于任何主题。
- **base 主题**（`themes/base/`）：纯布局 + 简单颜色的 minimal 主题，用于验证后端能力、提供最基本的前端能力，是兜底/降级主题。
- **vanblog 主题**（`themes/vanblog/`）：从 mereithhh 的 vanblog 项目迁移而来的完整视觉主题，**独立于 base 主题**，是两个概念。

## 1. 三层模型

| 层            | 位置       | 内容                                                                                                              | 职责                                                            | 谁能改                |
| ------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------- |
| **L0 后端**   | `vault/`   | PocketBase + Go 业务层                                                                                            | 数据 / API / 权限                                               | vanblog 维护者        |
| **L1 平台层** | `app/`     | `middleware.ts`、`lib/`、`loaders/`、`pages/api/`、`pages/admin/`、base 布局、`styles/`、dispatcher、integrations | 提供数据访问与渲染基础设施；提供 base 布局（纯布局 + 简单颜色） | vanblog 维护者        |
| **L2 主题**   | `themes/*` | 每个主题 = 一个独立 Astro 项目                                                                                    | 定义站点的视觉 / 信息架构 / 交互                                | 任何人（含 AI agent） |

- **平台层不是主题**。它不决定站点长什么样，只保证"能拿到数据、能渲染出页面骨架、admin 可用"。
- **主题是独立 Astro 项目**。一个主题拥有自己的 `src/pages/`、`src/layouts/`、`src/components/`，通过 `@vanblog/base/*` alias 引用平台层基础设施。
- **主题之间互不可见、互不继承**。没有 child-theme 机制。

## 2. base 主题

- 位置：`themes/base/`
- 本质：**minimal theme**（纯布局 + 简单颜色）
- 用途：
  1. **验证后端能力**——所有 public 路由都能跑通（列表/详情/归档/时间轴/搜索/分类/标签/关于/404）。
  2. **提供最基本的前端能力**——一个没有多余视觉负担、能正常阅读的站点。
  3. **兜底/降级主题**——当其他主题（如 vanblog）缺失或构建失败时，回退到 base。
- 视觉：依赖平台层的 base 布局（`@vanblog/base/layouts/BaseLayout.astro`），不引入品牌级视觉。
- **不依赖 vanblog 主题**。

## 3. vanblog 主题

- 位置：`themes/vanblog/`
- 来源：**从 mereithhh 的 vanblog 项目（`packages/website`）迁移而来**，是"另一个项目迁移进来"的产品，与 base 是**两个独立概念**。
- 定位：完整视觉 / 信息架构 / 交互的旗舰主题（NavBar、文章卡片、Toc、时间轴、赞赏、版权、统计等）。
- **不继承 base 主题的布局**：自带 `layouts/BaseLayout.astro`、全套 `components/` 与 `pages/`。
- 仅通过 `@vanblog/base/*` alias 引用平台层基础设施（`middleware`、`lib`、`pages/api`）。admin / login / setup 是**独立 admin SSR app**（`app/`，由 dispatcher 单独服务），主题不编译它们。

## 4. "builtin" 退役与新旧命名对照

| 旧称呼                                    | 新称呼                  | 说明                                                                 |
| ----------------------------------------- | ----------------------- | -------------------------------------------------------------------- |
| `@vanblog/builtin/*` alias                | `@vanblog/base/*`       | 指向平台层（`app/src/<rel>`），先查主题的 `src/base-overrides/<rel>` |
| `src/builtin-overrides/`                  | `src/base-overrides/`   | 主题局部覆盖平台层内容的目录                                         |
| "builtin 源头"（`app/src/`）              | **平台层**（base 源头） | 只有基础设施 + base 布局，不含任何主题的视觉                         |
| `pack.Builtins` / `builtinPacksDir`（Go） | 不变                    | Packs 的内置资源，与主题无关，维持原名                               |

## 5. 目录结构（重构后）

```text
vanblog/
├── app/                          ← L1 平台层（base 源头）
│   ├── integrations/
│   │   ├── themes/               ← alias 机制：@vanblog/base/*（30 行 resolveId）
│   │   └── packs/                ← Pack 路由注入
│   └── src/
│       ├── dispatcher/           ← 主题 dispatcher（Node HTTP server）
│       ├── layouts/
│       │   ├── BaseLayout.astro  ← ★ base 布局（纯布局 + 简单颜色；admin 也用）
│       │   ├── AdminLayout.astro ← admin 布局（extends base 布局）
│       │   └── PackPage.astro    ← Pack 页面 host 默认
│       ├── lib/                  ← markdown / 媒体 / helper（禁覆盖）
│       ├── loaders/              ← Live Collection loaders（禁覆盖）
│       ├── live.config.ts        ← （禁覆盖）
│       ├── middleware.ts         ← 认证 / pb client 注入（禁覆盖）
│       ├── pages/
│       │   ├── admin/            ← control plane（禁覆盖）
│       │   └── api/              ← API 端点（禁覆盖）
│       ├── styles/               ← base CSS 变量（简单颜色）
│       └── components/           ← 仅 admin 需要的通用组件
│       ├── env.d.ts
│       ├── astro.config.mjs
│       └── package.json
│
├── themes/                       ← L2 主题（独立 Astro 项目）
│   ├── base/                     ← ★ base 主题（minimal / 纯布局）
│   │   ├── astro.config.mjs / package.json / theme.json
│   │   └── src/
│   │       ├── pages/            ← 极简页面（纯布局）
│   │       ├── layouts/PackPage.astro
│   │       ├── middleware.ts / live.config.ts / env.d.ts
│   │       └── base-overrides/   ← 可空
│   ├── vanblog/                  ← ★ vanblog 主题（mereithhh 迁移）
│   │   ├── astro.config.mjs / package.json / theme.json
│   │   └── src/
│   │       ├── pages/            ← vanblog 视觉页面
│   │       ├── components/       ← ArticleCard / Nav / Footer / Toc / ...
│   │       ├── layouts/
│   │       │   ├── BaseLayout.astro  ← vanblog 视觉布局（自带，不继承 base）
│   │       │   └── PackPage.astro
│   │       ├── middleware.ts / live.config.ts / env.d.ts
│   │       └── base-overrides/   ← 可空
│   └── (用户主题)
│
├── sdk/  vault/  packs/  hooks/  ← 其他（不属本模型）
```

## 6. 规则

1. **平台层内容禁覆盖**：`pages/admin/`、`pages/api/`、`lib/`、`loaders/`、`live.config.*`、`middleware.*` 是禁区，主题不得通过 `src/base-overrides/` 覆盖（integration fail-closed）。
2. **主题必须自备入口**：每个主题的 `src/middleware.ts`、`src/live.config.ts`、`src/layouts/PackPage.astro` 是 Astro 项目硬性要求。
3. **平台层提供 base 布局**：base 主题直接用；vanblog 主题自带布局，不继承。
4. **主题引用平台层统一走 alias**：`@vanblog/base/<rel>`，禁止相对路径跨进 `app/src/`。
5. **默认主题**：镜像内置主题在 Dockerfile 用 `ARG VANBLOG_ACTIVE_THEME` 选定；运行期由 dispatcher 按 `site.activeTheme` 切换，未设置/不可用时回退到默认主题。

## 7. 心智模型（一句话记住）

> **base 是地基，vanblog 是房子。** 地基验证能不能盖楼、提供最基本的结构；房子（vanblog 主题）是从另一个项目整体搬来的成品，跟地基是两回事——它们共享的只有"地块"（平台层）。
