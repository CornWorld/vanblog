# 迁移 vanblog 前端 → Astro 标准 theme + palette 架构（Spike 3 模型）

> **Status: ✅ 已执行（2026-07-31）—— 结构重构落地，概念文档见 [`docs/theme-concepts.md`](../docs/theme-concepts.md)**
>
> 本 plan 的**架构部分已实施完成**：`themes/base`（原 bare，minimal）与 `themes/vanblog`（原 app/src 视觉层迁出）已落地，`@vanblog/builtin/*` → `@vanblog/base/*` 改名完成，app/src 收缩为纯平台层。
> 未完成的余量（palette 多套内置、MCP tools、admin 切换 UI）属后续独立任务，见 `docs/theme-host-design.md` 与本文档 Phase 5/6/7。

> 本 plan **取代** 旧版「custom/builtin 二分 + git submodule」方案（Spike 2）。
> 新方向（Spike 3）：**theme 是独立 Astro 项目，通过 `@vanblog/builtin/*` alias 引用主仓库 builtin，theme 的 `src/builtin-overrides/` 可选覆盖**。30 行 integration 代码，零额外机制。

---

## Context（为什么做这件事 + 为什么走 Spike 3）

### 业务目标（不变）

vanblog 后端已重构到 PocketBase + Go 业务层，前端基于 Astro 5/6 重写，但 `app/src/` 是一个简化骨架（11 public + 14 admin 页面）。目标是：

1. 让"换主题像 WordPress 一样"——非技术用户通过 AI agent 自定义前端。
2. 把原 vanblog（`refs/xxddccaa-fork/repo/packages/website` + `admin`）的视觉/信息架构/交互模式重写为 `default-public` + `default-admin`。
3. 用 palette（CSS 变量层）给低风险换肤一条独立路径。

### 三个 Spike 的演进路径

vanblog 走过三轮 spike，每一轮都基于上一轮的实测结论收敛：

| Spike          | 模型                                                                             | 验证结论                                                                                                                                                                                                                     | 致命问题                                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Spike 1**    | 覆盖式（`hooks/themes/{n}/` 覆盖 `app/src/`）                                    | Vite `resolveId` 劫持 `.astro` 可行；`injectRoute` + `src/pages/` 同名路由冲突                                                                                                                                               | Astro 6 禁止 `injectRoute` 与 `src/pages/` 同名（F1），修正方案要把所有 builtin page 物理移走，侵入性极大（F2）                                                                            |
| **Spike 2**    | custom/builtin 二分 + git submodule                                              | 同路径覆盖生效；alias 劫持工作；admin 禁区 fail closed；自引用 submodule 可行；Dockerfile build-arg 工作                                                                                                                     | submodule 的 cone sparse-checkout 在 fresh clone 后**不持久化**；路径 5 层嵌套（`themes/<n>/src/builtin/app/src/...`）；integration ~150 行（resolver + plugin + scanTheme + injectRoute） |
| **Spike 3** ✅ | theme = 独立 Astro 项目 + `@vanblog/builtin/*` alias + 可选 `builtin-overrides/` | Astro 6 接受 Vite plugin `resolveId` 劫持 `.astro`；theme 是独立 Astro 项目工作；`@vanblog/builtin/<rel>` → `app/src/<rel>` alias 工作；`src/builtin-overrides/<rel>` 优先；HMR 完全实时；**30 行 integration + 零额外机制** | （无）                                                                                                                                                                                     |

**为什么最终走 Spike 3**：

- Spike 3 的 integration 代码量从 ~150 行降到 **30 行**（只剩纯 `resolveId`，删除 injectRoute/scanTheme）。
- 不需要 submodule、不需要 sparse-checkout、不需要 Dockerfile cp、不需要 `.vanblog/resolved/` 临时合成目录。
- theme 目录是 Astro 标准（`src/pages/layouts/components/styles`），用户认知零负担。
- HMR 完全实时（Spike 2 新增 custom 文件要重启 dev server）。
- 升级路径变简单：theme 不持有 builtin 副本，主仓库 `app/src/` 升级即对所有 theme 生效。

### Spike 3 核心机制（30 行 integration）

theme 是**独立的 Astro 项目**（标准 `src/pages/` 文件路由），通过 `import BaseLayout from '@vanblog/builtin/layouts/BaseLayout.astro'` 引用 builtin。Vite plugin 解析 `@vanblog/builtin/*` 前缀：

1. 优先返回 theme 的 `src/builtin-overrides/<rel>`（如果存在）
2. fallback 到主仓库 `app/src/<rel>`

- **不需要 injectRoute**（用 Astro 标准文件路由）
- **不需要 cp**（astro build 直接在 theme 目录跑）
- **不需要 submodule**（builtin 是 alias，不是副本）
- **不需要 sparse-checkout**

**Spike 3 验证结论**（已实测）：

| 验证项                                                   | 结论 |
| -------------------------------------------------------- | ---- |
| Astro 6 接受 Vite plugin `resolveId` 劫持 `.astro` 文件  | ✅   |
| theme 是独立 Astro 项目（`astro --root themes/<name>/`） | ✅   |
| `@vanblog/builtin/<rel>` alias 解析到 `app/src/<rel>`    | ✅   |
| `src/builtin-overrides/<rel>` 优先级高于 builtin         | ✅   |
| HMR 实时生效（改 override 文件立即反映）                 | ✅   |
| 30 行 integration 代码 + 零额外机制                      | ✅   |

### Spike 2 → Spike 3 关键改进

| 维度               | Spike 2（旧 plan）                                     | Spike 3（新 plan）                         |
| ------------------ | ------------------------------------------------------ | ------------------------------------------ |
| integration 代码   | ~150 行（resolver + plugin + scanTheme + injectRoute） | **30 行**                                  |
| 机制复杂度         | injectRoute + resolveId 双机制                         | **纯 resolveId**                           |
| theme 目录         | `src/builtin` + `src/custom` 二分                      | **Astro 标准** + 可选 `builtin-overrides`  |
| 路径嵌套           | `themes/<n>/src/builtin/app/src/...`（5 层）           | **无嵌套**                                 |
| submodule + sparse | 必须                                                   | **不需要**                                 |
| Dockerfile cp      | 需要 cp 到 `app/src/`                                  | **不需要**                                 |
| HMR                | 部分支持（新增 custom 文件要重启）                     | **完全实时**                               |
| 升级路径           | theme submodule update（冲突）                         | **theme 不持有 builtin，主仓库升级即生效** |

---

## Analysis（事实依据，复用旧 plan）

### 当前 app/src/ 现状（filesystem-read 验证）

`app/src/` 目录结构：`components/ env.d.ts layouts/ lib/ live.config.ts loaders/ middleware.ts pages/ styles/`

| 资产              | 路径                                                                                                                                                                       | 完整度             | 备注                                                                                                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BaseLayout        | `app/src/layouts/BaseLayout.astro` (189 行)                                                                                                                                | 完整               | nav/footer/dark-mode/JSON-LD/RSS OG、引用 `virtual:vanblog/packs` + `virtual:vanblog/pack-frontend`；class 直接写在 tag 上                                                                                                                          |
| AdminLayout       | `app/src/layouts/AdminLayout.astro` (21 行)                                                                                                                                | 极简               | 仅继承 BaseLayout + `initClient()`                                                                                                                                                                                                                  |
| PackPage          | `app/src/layouts/PackPage.astro` (15 行)                                                                                                                                   | 极简               | Pack 页面 host                                                                                                                                                                                                                                      |
| Public 页面       | `app/src/pages/{index,404,about,archive,timeline,search,setup,login}.astro` + `posts/[id].astro` + `categories/{[id],index}.astro` + `tags/{[id],index}.astro` = **11 页** | 功能可用但极简     | 文章页有 mermaid PNG/SVG 导出 + 代码块折叠；编辑器用 ByteMD                                                                                                                                                                                         |
| Admin 页面        | `app/src/pages/admin/{index,audits,backups,categories,edit/[id],media,migrate,new,revisions/[postId],routing,site,tags,trash,users}.astro` = **14 页**                     | 功能完整但 UX 简陋 | 纯 form + table；`site.astro` 把 `theme: default\|minimal\|magazine\|custom` 当枚举字段写死                                                                                                                                                         |
| API 端点          | `app/src/pages/api/{atom.xml,feed.xml,revalidate,sitemap.xml}`                                                                                                             | 完整               | revalidate 拒绝外部 XFF                                                                                                                                                                                                                             |
| Components        | `app/src/components/{ByteMdEditor,Comments,EmptyState,ErrorNotice,ErrorState,Loading}.astro` = 6 个                                                                        | 极简               | 仅 ByteMdEditor 重，其他是 placeholder                                                                                                                                                                                                              |
| Middleware        | `app/src/middleware.ts` (4 行)                                                                                                                                             | 完整               | `createVanblogMiddleware()`                                                                                                                                                                                                                         |
| Live config       | `app/src/live.config.ts` (9 行)                                                                                                                                            | 完整               | posts Live Collection + loader                                                                                                                                                                                                                      |
| Styles            | `app/src/styles/global.css` (200 行)                                                                                                                                       | 完整               | Tailwind v4 `@theme` + 语义别名（`--text/--bg/--surface/--border/--accent/--text-muted`，自动翻转 dark），4 个 `@utility`：`container-page/nav-link/btn-primary/card-post/tag-badge`                                                                |
| Markdown lib      | `app/src/lib/markdown/{config,renderer,normalizeMathDelimiters,user-plugins,plugins/}`                                                                                     | 完整               | Astro 原生 shiki + remark/rehype                                                                                                                                                                                                                    |
| Packs integration | `app/integrations/packs/{index,resolver,resolver.test}.mjs` (260 行)                                                                                                       | 完整               | 已实现 `discoverPacks → mergeLocalPacks → loadPackMetadata → resolvePublicPages → injectRoute` + 3 个 virtual module（`vanblog:theme`, `virtual:vanblog/packs`, `virtual:vanblog/pack-frontend`）；whole-Pack replacement 与 Go `pack.Resolve` 对齐 |
| 3 个 builtin Pack | `packs/{bookmarks,moments,live2d-companion}/`                                                                                                                              | 完整               | Bookmarks/Moments 是 schema + hook + 公共页；live2d-companion 是纯 frontend contribution                                                                                                                                                            |
| SDK               | `sdk/src/{client,server,browser,services,types,cookie,dates,utils,index}.ts` + `models/`                                                                                   | 完整               | `pb.collection()` 透传 + `pb.vanblog.*` 服务 + 多上下文 + 类型                                                                                                                                                                                      |
| site collection   | `vault/pb_migrations/1782200000_init_vanblog_collections.go:255`                                                                                                           | 部分缺             | 已有 `theme: SelectField{default,minimal,magazine,custom}` 和 `defaultTheme: SelectField{auto,light,dark}`，**缺 `palette` 和 `activeTheme` 字段**                                                                                                  |

#### 关键空缺

- **`themes/` 目录不存在**（filesystem-read 报 ENOENT）
- **site 无 `palette` 字段**，`theme` 只是 select 枚举（不是 theme name 引用）
- **没有 theme.json / palette.json / tokens.css 的加载/合并/注入机制**
- **没有 `@vanblog/builtin/*` alias 解析 integration**
- **没有 Dockerfile build-arg `VANBLOG_ACTIVE_THEME` 支持**
- **没有 admin 主题切换 UI / palette 切换 UI**
- **没有 MCP tools**（`read_file/write_file/list_dir/preview/build/pb_schema/pb_query/upgrade_diff`）

### 原 vanblog 前端的参考价值（不搬运代码，仅作信息架构/视觉参考）

#### website/components/ 共 51 个组件（按参考价值分级）

**必迁（核心信息架构，13 个）**：

- `PostCard`（218 行，4 子文件）→ 文章卡片，含 overview/article/about 三模式 + 私有/加密 + Toc mobile + Reward + Copyright + 标签
- `NavBar`（268 行，含 item.tsx）→ 顶栏，含 headroom 滚动隐藏、Ctrl/Cmd+K 唤起搜索、子菜单（分类）、logo/siteName 切换、移动端汉堡
- `Footer` → 页脚社交链接/版权
- `ArticleList`（64 行）→ 归档/时间轴用列表项
- `PostViewer` → 文章阅读量（pb 已有 visits 表）
- `SiteStatsSummary`（36 行）→ 首页/归档顶部分类 × 文章 × 标签 × 字数
- `TimelinePage`（145 行）→ 时间轴年月折叠展开
- `CategoryPage`/`TagPage`/`ArchiveSummaryPage` → 分类/标签/归档聚合页
- `SearchCard` → Ctrl+K 全局搜索浮层
- `Toc`/`TocMobile`/`MarkdownTocBar` → 文章目录（左侧 sticky + 移动端抽屉）
- `BackToTop` → 回到顶部按钮
- `Markdown`/`RenderedMarkdown` → Markdown 渲染壳（Astro 端可直接用 builtin markdown renderer）

**可选（按 site 配置启用，7 个）**：

- `Reward`（赞赏二维码）→ 关于页/文章页
- `CopyRight`（CC 协议声明）→ 文章页底部
- `SocialCard`/`SocialIcon`/`AuthorCard`/`LinkCard` → 关于页
- `AlertCard` → 文章过期提醒
- `UnLockCard` → 私有文章密码解锁（pb 已支持 `password` 字段）
- `TopPinIcon`/`PageNav`/`Loading`/`ImageBox`/`ImageProvider`/`ImageUpload` → 通用 UI

**不要（不迁）**：

- `MusicPlayer` → 与 vanblog 核心功能无关
- `BaiduAnalysis`/`gaAnalysis` → 已有更通用的 `customScript` 注入
- `WaLine` → 旧 Waline 评论组件，新版用 `Comments.astro` 多 provider
- `Viewer`（图片预览库）→ ByteMD 已带 medium-zoom
- `CustomLayout`/`LayoutBody`/`Layout` → Next.js 专用，Astro 用 layouts/
- 其余装饰性组件

**统计**：51 个 → 必迁 13 + 可选 7 + 不要 11 + 其余 20（参考但不直接对应）。

#### admin/src/pages/ 共 20 个页面

| 原页面                               | 现状对应                                              | 参考价值                                                                    |
| ------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `Article/` (columns.jsx + index.jsx) | `admin/index.astro`                                   | **高**：列设计、批量操作、状态筛选                                          |
| `Editor/` (694 行)                   | `admin/edit/[id].astro` (169 行)                      | **高**：编辑器布局、保存逻辑、快捷键、文章/草稿/关于/文档/Moment 多类型编辑 |
| `Draft/`                             | 与 `Article/` 合并到 posts collection（status=draft） | 中：仅做视图筛选                                                            |
| `CommentManage/`                     | 无                                                    | 低：新版用外部 Artalk/Waline/Giscus 控制台                                  |
| `CustomPage/`                        | 关于页直接在 `admin/site.astro` 编辑 aboutContent     | 低                                                                          |
| `DataManage/` (含 tabs)              | `admin/backups.astro` + `admin/migrate.astro`         | **高**：备份列表/恢复/导入流程的 UX                                         |
| `Document/`                          | 与 Article 合并                                       | 中                                                                          |
| `InitPage/`                          | `setup.astro`                                         | 中                                                                          |
| `LogManage/`                         | `admin/audits.astro`                                  | **高**：日志筛选/详情展开                                                   |
| `MindMap/`                           | 无                                                    | 不要                                                                        |
| `Moment/`                            | 已有 `packs/moments/` builtin Pack                    | 低（Pack 自己处理）                                                         |
| `NavManage/`                         | 无（用 pack.json nav）                                | 不要                                                                        |
| `Pipeline/`                          | 无                                                    | 不要（CI/CD 移到 host vanblog.sh）                                          |
| `Static/`                            | `admin/media.astro`                                   | **高**：媒体库网格/上传/批量                                                |
| `SystemConfig/` (含 tabs)            | `admin/site.astro` + `admin/routing.astro`            | **高**：站点配置表单的分区设计                                              |
| `Welcome/`                           | `admin/index.astro` 顶部                              | 中                                                                          |
| `user/`                              | `admin/users.astro`                                   | **高**：用户列表/权限矩阵                                                   |
| `About.tsx`/`404.jsx`/`document.ejs` | 静态                                                  | 低                                                                          |

**统计**：20 个 → 必参考 8 + 中等参考 4 + 不要 4 + 已被 Pack 取代 1 + 其他 3。

#### styles/ 共 21 个文件

原 vanblog 用 Tailwind v3 + `var.css`（仅 4 个变量：theme-color + 三档 text-color）+ 大量独立 css（code-dark/light、markdown-runtime、custom-container、tip-card、toc、zoom、scrollbar、side-bar、nav.module、back-to-top.module、phycat-theme、github-markdown）。

新版已有 `app/src/styles/global.css`（Tailwind v4 `@theme` + 语义别名），**样式系统已经升级**。原 css 内容（容器、tip-card、toc、code 主题、markdown runtime、scrollbar）作为 palette 的 `tokens.css/typography.css/components.css` 素材。

---

## 架构决策（Spike 3 极简模型）

### 决策 1：theme = 独立 Astro 项目（不是主仓库的覆盖层）

**决定**：每个 theme 是一个完整的 Astro 项目（有 `astro.config.mjs`、`package.json`、`src/`），不是 `app/` 上的覆盖层。

**理由**：

- 规避 Spike 1 发现的 Astro 6 同名路由限制——不同 theme 是不同 Astro 项目，物理隔离。
- 对应 `docs/future-pack-architecture.md` §"Full themes"：「A full theme is an independent public frontend build input, not a special collection of injected routes inside the current app」。
- 用户 fork 整个 theme 拿去改，所见即所得，没有"魔法覆盖层"的认知负担。
- theme 用 Astro 标准文件路由（`src/pages/`），不需要 injectRoute 维护路由映射表。

**与 docs 对齐**：`docs/agent-theme-architecture.md` §5 描述的 `hooks/themes/{name}/` 覆盖式结构是旧设计，**Phase 1 必须重写该章节**。

### 决策 2：builtin 通过 `@vanblog/builtin/*` alias 暴露（不需要 fork/submodule）

**决定**：主仓库 `app/src/` 仍是 builtin 内容源头，通过 Vite alias `@vanblog/builtin/*` 暴露给所有 theme。theme 通过显式 import 引用：

```astro
import BaseLayout from '@vanblog/builtin/layouts/BaseLayout.astro';
import PostCard from '@vanblog/builtin/components/PostCard.astro';
```

**理由**：

- builtin 是**引用**不是**副本**——主仓库 `app/src/` 升级，所有 theme 自动受益，无 merge 冲突。
- 不需要 submodule（Spike 2 复杂度来源）、不需要 sparse-checkout、不需要 Dockerfile cp。
- alias 解析在 Vite 层，对 Astro 完全透明（Spike 3 已实测）。

### 决策 3：theme 用 Astro 标准结构 + 可选 `src/builtin-overrides/`

**决定**：每个 theme 的 `src/` 是标准 Astro 结构：

```text
themes/{name}/src/
├── pages/             ← Astro 标准文件路由（theme 自己的页面）
├── layouts/           ← theme 自己的 layouts
├── components/        ← theme 自己的 components
├── styles/            ← theme 自己的 styles
└── builtin-overrides/ ← 可选：覆盖 @vanblog/builtin/* 引用
    ├── layouts/
    ├── components/
    └── styles/
```

**理由**：

- Astro 标准 = 用户/agent 认知零负担，符合 Spike 3 验证结论。
- `builtin-overrides/` 是**可选**的覆盖机制：theme 大多数时候直接 import builtin，只在需要时局部覆盖。
- 用户写 theme 的常见模式：page 显式 import builtin 组件 + 混用 theme 自己的组件。

### 决策 4：覆盖机制 = theme 的 `src/builtin-overrides/<rel>` 优先于 `builtin/<rel>`

**决定**：用户在 `src/builtin-overrides/components/PostCard.astro` 放同路径文件，**所有** `@vanblog/builtin/components/PostCard.astro` 的 import 自动重定向到 override 版本。

**理由**：

- 覆盖是**路径对齐**的（PostCard → PostCard），不需要维护映射表。
- 一次覆盖，全局生效（在 theme 内）——比 Spike 2 的 child-theme 合成更直观。
- 不存在 fallback 链：要么 override 胜出，要么 builtin fallback，二选一。

### 决策 5：L0/L1/L2 三层 API surface（约束 builtin 升级时的破坏性变更）

**决定**：定义三层 API surface，每层有不同的稳定性保证。这是升级时 agent 判断"哪些 override 需要适配"的依据。

| 层级               | 内容                                                                                                                                                                                                                   | 稳定性保证                                                                                         | 例外                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **L0 契约层**      | ① frontmatter 变量名（`posts`、`post`、`site`、`pb`）<br>② SDK 函数签名（`pb.vanblog.posts.listPublished`、`stripMarkdown`、`fmtDate`、`safe`、`getPage`）<br>③ PB collection 字段名（`posts.title`、`posts.content`） | **永远稳定**。major version 之间也不破坏，破坏必须 deprecated 一个版本周期。                       | 极端情况（安全修复）允许，但必须在 CHANGELOG 标 `BREAKING` |
| **L1 组件 API 层** | builtin 组件的 props 名（`BaseLayout.title`、`PostCard.post`、`PostCard.mode`、`PackPage.title`）                                                                                                                      | **语义稳定**。可以加新 props（必须 optional + 有合理默认），不可删旧 props、不可改 prop 类型语义。 | 改名需 deprecated alias 一个版本                           |
| **L2 内部实现层**  | 组件内部 DOM 结构、CSS class 名、内部 helper 函数                                                                                                                                                                      | **无保证**。任意变化。override 文件如果依赖 L2，升级时自负。                                       | —                                                          |

**强制力**：通过 CI lint + contract-check 脚本保证 L0/L1（详见 Phase 7 MCP tools）。

- builtin 维护者提 PR 时，CI 跑 `scripts/contract-diff.mjs`，对比 PR 前后的 L0/L1 surface，如果出现删除/重命名 → CI fail。
- L0 表面同时在 `theme-implementer-guide.md` 用表格明确列出（25 个页面的 frontmatter 契约），作为对外承诺。

### 决策 6：palette 仍独立（CSS 变量层，零风险）

**决定**：palette 系统**不变**，仍是 `hooks/palettes/{name}/`（保留在 `hooks/` 下，不进 `themes/`），通过 Astro 端点动态注入。

**理由**：

- palette 切换必须零 build、运行时生效——这是 `agent-theme-architecture.md` §7.3 的核心承诺。
- palette 是"换肤"层，与 theme（换布局）正交。一个 theme 配合多个 palette，一个 palette 配合多个 theme。
- theme 必须**强制用 CSS 变量**，禁止 hardcode 颜色（lint 规则）——否则 palette 无法生效。

**palette 路径**（不变）：

```text
hooks/palettes/{name}/
├── palette.json    ← { name, label, version, author, supports: ['light','dark'] }
├── tokens.css      ← 覆盖 :root / html.dark 的 CSS 变量
├── typography.css  ← 可选
└── components.css  ← 可选
```

**注入路径**：Astro 端点 `app/src/pages/api/palette.css.ts` 动态返回拼接 CSS（tokens → typography → components 固定顺序）。BaseLayout 在 SSR 时读 `site.palette` 输出 `<link href="/api/palette.css?v={site.updated}">`。

**与 docs 的偏差修正**：旧 docs §4 描述「Caddy 读取 palette.json 注入 link」，新方案改为「Astro 端点动态返回」——避免改 Caddy builder，更接近 docs 的**意图**（零 build、纯 CSS）。Phase 1 必须更新 docs §4/§7.3 措辞。

### 决策 7：admin 不开放 theme 化（依据 future-pack-architecture.md §"Admin direction"）

**决定**：admin **不开放 theme 化**，所有 admin 页面始终来自 builtin（`@vanblog/builtin/pages/admin/*`），theme 的 `builtin-overrides/pages/admin/` 拒绝。

**理由**（依据 `docs/future-pack-architecture.md` §"Admin direction"）：

> The admin surface is a control plane and does not need SEO or public SSR. The future direction is a stable SPA served independently from the active public theme.

- admin 的契约（PB authStore、`pb.collection()` 透传、`requireAdmin`）与 public 不同，不能让 theme 切换破坏 admin 可用性。
- admin 不需要 palette（控制台用稳定的中性色），但仍可被 palette 影响（CSS 变量层渗透），DOM 结构不变。
- v1 暂不让 admin 走独立 SPA，继续 Astro SSR + 同一套 theme kernel；v2 评估迁移到独立 SPA（依据 §"Future phases" #1）。

**实现**：themes integration 对 `@vanblog/builtin/pages/admin/**` 路径强制忽略 override，theme 在 `src/builtin-overrides/pages/admin/` 放任何文件直接 fail closed + 警告。

### 决策 8：Pack 沿用现有 packs integration（已实现）

**决定**（沿用 `app/integrations/packs/index.mjs` 已实现机制）：

- `packs/<name>/` 仍然提供 `/p/<pack>` 路由（pack 是横切关注点，独立于 theme）。
- theme **必须通过 `vanblog:theme` virtual module 提供 PackPage host**（`src/layouts/PackPage.astro` 或 `src/builtin-overrides/layouts/PackPage.astro`），供 pack pages 引用。
- 一个 theme 如果**不提供** `PackPage.astro` → build fail（依据 `future-pack-architecture.md` §"Theme host interface"）。
- Spike 1 已验证 `vanblog:theme` virtual module 模式，直接复用。

### 决策 9：方案 A —— theme 显式 import builtin（不用 B 的"默认继承"）

**决定**：theme 的 page **显式 import** builtin 组件，而不是靠"默认继承 builtin 同路径 page"的魔法。

**用户写 theme 的方式**：

```astro
---
// themes/my-theme/src/pages/index.astro
import BaseLayout from '@vanblog/builtin/layouts/BaseLayout.astro';
import PostCard from '@vanblog/builtin/components/PostCard.astro';

// 也可以 import theme 自己的
import CustomHero from '../components/CustomHero.astro';

const posts = await fetchPosts();
---
<BaseLayout title="My Home">
  <CustomHero />
  {posts.map(p => <PostCard post={p} />)}
</BaseLayout>
```

**理由**：

- 显式 > 隐式：用户和 agent 一眼能看到这个 page 用了哪些 builtin。
- 避免"默认继承"机制（方案 B）的复杂度——不需要为每个 builtin page 维护一份"theme 默认值"。
- 想"原样用 builtin 页面"的 theme：直接 `export { default } from '@vanblog/builtin/pages/index.astro'` re-export。
- 想"覆盖 builtin 页面"的 theme：自己写一个，显式 import 需要的 builtin 组件。

---

## integration 完整实现（30 行核心）

### `app/integrations/themes/index.mjs`（基于 Spike 3 验证过的版本）

```js
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BUILTIN_PREFIX = "@vanblog/builtin/";
// 禁区：theme 的 builtin-overrides 不允许覆盖这些路径
const FORBIDDEN_OVERRIDE_GLOBS = [
  /^pages\/admin\//, // admin 锁定（决策 7）
  /^pages\/api\//, // API 端点锁定
  /^lib\//, // markdown 渲染等
  /^loaders\//, // 数据加载器
  /^live\.config\.ts$/, // Live Collections 配置
  /^middleware\.ts$/, // 中间件
];

export default function themesIntegration(options) {
  const themeSrcDir = options.themeSrcDir; // themes/<active>/src
  const mainAppSrcDir = options.mainAppSrcDir; // app/src（builtin 源头）
  const overridesDir = join(themeSrcDir, "builtin-overrides");

  function resolveId(id) {
    if (!id.startsWith(BUILTIN_PREFIX)) return null;
    const rel = id.slice(BUILTIN_PREFIX.length);

    // 禁区检查：override 试图覆盖锁定路径 → 拒绝（fail closed）
    if (FORBIDDEN_OVERRIDE_GLOBS.some((re) => re.test(rel))) {
      // 只有当 theme 真的放了 override 文件时才报错
      const overridePath = join(overridesDir, rel);
      if (existsSync(overridePath)) {
        throw new Error(
          `[vanblog-themes] FORBIDDEN override: ${rel} is locked (admin/api/lib/loaders/middleware/live.config). ` +
            `Theme cannot override this path.`
        );
      }
    }

    // 1. theme 的 builtin-overrides/ 优先
    const override = join(overridesDir, rel);
    if (existsSync(override)) return override;

    // 2. fallback 主仓库 app/src/
    const builtin = join(mainAppSrcDir, rel);
    if (existsSync(builtin)) return builtin;

    return null; // 让 Vite 走默认解析（会报 not found）
  }

  return {
    name: "vanblog-themes",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [{ name: "vanblog-builtin-resolver", resolveId }],
          },
        });
      },
      // HMR 通过 Astro 标准机制自动工作（theme 自己的 src/ + overrides/ 都在项目内）
      // 不需要 server.watcher.add
    },
  };
}
```

**关键设计点**：

1. **纯 `resolveId`，无 `injectRoute`**：theme 用 Astro 标准文件路由，integration 不维护路由映射。
2. **禁区规则**：`pages/admin/`、`pages/api/`、`lib/`、`loaders/`、`live.config.ts`、`middleware.ts` 拒绝 override。
3. **HMR 零配置**：theme 的 `src/` 和 `src/builtin-overrides/` 都在 theme 项目内，Astro 标准 file watcher 自动监听，改 override 文件即时反映。
4. **`mainAppSrcDir` 是绝对路径**：integration 接受 option，由 `astro.config.mjs` 传入（解析到主仓库 `app/src/`）。

### 与 packs integration 的关系

theme 的 `astro.config.mjs` 同时引用两个 integration：

```js
// themes/<active>/astro.config.mjs
import { defineConfig } from "astro/config";
import packs from "../../app/integrations/packs/index.mjs";
import themes from "../../app/integrations/themes/index.mjs";

export default defineConfig({
  integrations: [
    themes({
      themeSrcDir: fileURLToPath(new URL("./src", import.meta.url)),
      mainAppSrcDir: fileURLToPath(new URL("../../app/src", import.meta.url)),
    }),
    packs(), // 沿用现有 packs integration（处理 /p/* + vanblog:theme virtual module）
  ],
});
```

**注意**：packs integration 当前硬编码 `themePage = app/src/layouts/PackPage.astro`（见 `app/integrations/packs/index.mjs:6`）。Phase 2 需要改造为接受 option，让 theme 的 PackPage 优先：

```js
// packs/index.mjs 改造（Phase 2）
const themePage =
  options.themePage ||
  fileURLToPath(new URL("src/layouts/PackPage.astro", appDirectory));
```

---

## 完整目录结构

```text
vanblog/
├── app/                          ← 主仓库，仍是 Astro 项目（也是 default theme 的 builtin 源头）
│   ├── astro.config.mjs          ← 顶层 dev 用（指向 active theme 或 builtin 自身）
│   ├── integrations/
│   │   ├── packs/                ← 已存在（处理 /p/* + vanblog:theme virtual module）
│   │   └── themes/               ← ★ 新增（30 行 integration）
│   │       └── index.mjs
│   ├── src/                      ← builtin 内容源头（被 @vanblog/builtin/* 引用）
│   │   ├── layouts/
│   │   ├── pages/
│   │   │   ├── admin/            ← admin 锁定区（任何 theme 都从这里来）
│   │   │   ├── api/              ← ❌ 不可被 override 覆盖
│   │   │   └── ...public pages
│   │   ├── components/
│   │   ├── styles/global.css     ← builtin palette 默认值
│   │   ├── lib/                  ← ❌ 不可被覆盖（markdown 渲染等）
│   │   ├── loaders/              ← ❌ 不可被覆盖
│   │   ├── live.config.ts        ← ❌ 不可被覆盖
│   │   └── middleware.ts         ← ❌ 不可被覆盖
│   └── public/
│
├── themes/                       ← ★ 新增顶层目录（每个 theme 是独立 Astro 项目）
│   ├── README.md                 ← theme 作者指南入口
│   └── {theme-name}/             ← 一个 theme = 一个完整 Astro 项目
│       ├── astro.config.mjs      ← 引用 app/integrations/{packs,themes}
│       ├── package.json          ← 声明对 @vanblog/sdk 的依赖
│       ├── theme.json            ← 元数据（name/label/version/screenshot/builtinRef）
│       ├── screenshot.png        ← admin 切换 UI 缩略图
│       └── src/
│           ├── pages/            ← Astro 标准文件路由（theme 自己的页面）
│           ├── layouts/          ← theme 自己的 layouts
│           ├── components/       ← theme 自己的 components
│           ├── styles/           ← theme 自己的 styles
│           └── builtin-overrides/← 可选：覆盖 @vanblog/builtin/* 引用
│               ├── layouts/      ← （不允许 admin/、api/、lib/、loaders/ 等）
│               ├── components/
│               └── styles/
│
├── themes/default/               ← ★ 官方参考实现（与 app/src 形成 default-public + default-admin）
│
├── hooks/                        ← ★ 角色收窄：只剩 palette
│   └── palettes/
│       ├── README.md
│       └── {palette-name}/
│           ├── palette.json
│           ├── tokens.css
│           ├── typography.css    ← 可选
│           └── components.css    ← 可选
│
├── packs/                        ← 已存在（builtin Pack 源树）
│   └── {bookmarks,moments,live2d-companion}/
│
├── sdk/                          ← ❌ 不可改（NO-GO ZONE for theme）
├── vault/                        ← ❌ 不可改（NO-GO ZONE for theme）
│   └── pb_migrations/
│       └── 1782400000_add_site_palette_theme_fields.go  ← ★ 新增：site.palette + site.activeTheme
│
├── docker/
│   ├── entrypoint.prod.sh        ← 修改：build-arg VANBLOG_ACTIVE_THEME 注入 + 校验
│   ├── entrypoint.dev.sh         ← 修改：cd themes/<active>/ && astro dev
│   └── Dockerfile                ← 修改：astro-build stage 接受 VANBLOG_ACTIVE_THEME，COPY 对应 theme
│
├── scripts/
│   ├── contract-diff.mjs         ← ★ 新增：CI 用的 L0/L1 surface diff
│   └── theme-init.mjs            ← ★ 新增：scaffold 新 theme（cp themes/default + 改 theme.json）
│
└── docs/
    ├── agent-theme-architecture.md    ← 重写 §5/§7/§8（旧 hooks/themes/ → 新 themes/ + alias 模型）
    ├── future-pack-architecture.md    ← cross-reference + 强化 Admin direction
    └── theme-implementer-guide.md     ← ★ 新增：面向 theme 作者的实施手册
```

**关键变化对比旧 plan**：

| 旧 plan（Spike 2）                               | 新 plan（Spike 3）                                 | 原因                 |
| ------------------------------------------------ | -------------------------------------------------- | -------------------- |
| `hooks/themes/{name}/`                           | `themes/{name}/`                                   | theme 升级为顶层公民 |
| theme 内部 `src/builtin/` + `src/custom/` 二分   | Astro 标准 + 可选 `src/builtin-overrides/`         | 删除二分认知负担     |
| `src/builtin/` 是 git submodule                  | `@vanblog/builtin/*` alias 指向 `app/src/`         | 不需要 submodule     |
| `themes/<n>/src/builtin/app/src/...`（5 层嵌套） | 无嵌套（alias 透明解析）                           | Spike 3 极简         |
| Dockerfile cp theme 到 app/src/                  | Dockerfile COPY theme 到 /build/theme/，直接 build | 不需要 cp            |
| `.vanblog/resolved/` 物理合成                    | 不存在，纯 Vite alias                              | 更轻量，HMR 更顺     |
| palette 走 Caddy 注入                            | palette 走 Astro 端点（`/api/palette.css`）        | 避免改 Caddy builder |

---

## 加载机制（极简）

### Dev 模式

```text
1. entrypoint.dev.sh 读 VANBLOG_ACTIVE_THEME（默认 default）
2. cd themes/<active>/ && astro dev
3. themes() integration 在 astro:config:setup 阶段注册 Vite plugin
4. plugin 每次 resolveId 跑：
   - id 以 @vanblog/builtin/ 开头？
   - 是 → 查 theme 的 src/builtin-overrides/<rel>
   - override 存在 → 返回 override 路径
   - 否则 → fallback 到 app/src/<rel>
5. Astro 标准 HMR 自动工作（theme 的 src/ 和 overrides/ 都在项目内）
```

### Prod 模式

```dockerfile
ARG VANBLOG_ACTIVE_THEME=default
# astro-build stage:
COPY themes/${VANBLOG_ACTIVE_THEME}/ /build/theme/
COPY app/ /build/app/        # integration + builtin 源头
WORKDIR /build/theme
RUN pnpm install && pnpm build
# 输出 /build/theme/dist/

# prod stage:
COPY --from=astro-build /build/theme/dist/ /app/dist/
RUN echo "${VANBLOG_ACTIVE_THEME}" > /etc/vanblog/active-theme
# entrypoint.prod.sh 启动时校验 site.activeTheme 与 /etc/vanblog/active-theme 一致
```

### Theme 切换

- **dev**：admin 改 `site.activeTheme` → entrypoint 重启 dev server（cd 到新 theme 目录）→ 即时生效。
- **prod**：admin 改 `site.activeTheme` → 提示用户重建镜像：
  ```
  ⚠️ 切换 theme 需要重建镜像：
  docker build --build-arg VANBLOG_ACTIVE_THEME=<theme-name> -t vanblog:prod .
  ```
- entrypoint.prod.sh 启动时校验 `site.activeTheme` 与镜像内 `/etc/vanblog/active-theme` 一致；不一致警告 + 强制用镜像内 theme。

### Palette 切换（不变）

- Astro 端点 `/api/palette.css` 动态返回（读 `site.palette` → 拼接 `hooks/palettes/{name}/*.css`）。
- 零 build，刷新即生效。
- BaseLayout 在 SSR 时输出 `<link href="/api/palette.css?v={site.updated}">`，`site.updated` 变 → 浏览器重拉。

---

## 模板契约清单（L0 层，依据现有 11 个 public 页 + 14 个 admin 页）

每个 public 页面，frontmatter 契约变量名固定如下，theme 作者**禁止修改**（L0 层）：

### Public 页面（被 BaseLayout 包裹，路径前缀 `pages/`）

| 页面     | builtin 路径                                    | override 路径（如覆盖）                                                         | frontmatter 契约变量                                                              |
| -------- | ----------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 首页     | `@vanblog/builtin/pages/index.astro`            | `src/builtin-overrides/pages/index.astro` 或 theme 自写 `src/pages/index.astro` | `posts: PostExpand[]`, `totalPages: number`, `page: number`                       |
| 文章     | `@vanblog/builtin/pages/posts/[id].astro`       | 同上                                                                            | `post: Post \| null`, `html: string \| null`, `id: string`, `site: Site`          |
| 归档     | `@vanblog/builtin/pages/archive.astro`          | 同上                                                                            | `posts: Post[]`, `years: number[]`                                                |
| 时间轴   | `@vanblog/builtin/pages/timeline.astro`         | 同上                                                                            | `entries: TimelineEntry[]`                                                        |
| 搜索     | `@vanblog/builtin/pages/search.astro`           | 同上                                                                            | `q: string`, `results: SearchResult[]`                                            |
| 分类索引 | `@vanblog/builtin/pages/categories/index.astro` | 同上                                                                            | `categories: Category[]`                                                          |
| 分类详情 | `@vanblog/builtin/pages/categories/[id].astro`  | 同上                                                                            | `category: Category`, `posts: PostExpand[]`, `totalPages: number`, `page: number` |
| 标签索引 | `@vanblog/builtin/pages/tags/index.astro`       | 同上                                                                            | `tags: Tag[]`                                                                     |
| 标签详情 | `@vanblog/builtin/pages/tags/[id].astro`        | 同上                                                                            | `tag: Tag`, `posts: PostExpand[]`, `totalPages: number`, `page: number`           |
| 关于     | `@vanblog/builtin/pages/about.astro`            | 同上                                                                            | `site: Site`, `html: string`, `updatedAt: string`                                 |
| 404      | `@vanblog/builtin/pages/404.astro`              | 同上                                                                            | （无）                                                                            |

每个 public 页面**必须** `import BaseLayout from '@vanblog/builtin/layouts/BaseLayout.astro'` 并用 `<BaseLayout ...>` 包裹。`Astro.locals.pb` 是数据访问入口。

### Admin 页面（**锁定，不允许 override 覆盖**）

| 页面     | builtin 路径                                            | frontmatter 契约变量                                                                                                                                                       |
| -------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文章列表 | `@vanblog/builtin/pages/admin/index.astro`              | `posts: Post[]`, `totalPosts: number`, `totalPages: number`, `page: number`, `q: string`, `status: string`, `user: AuthUser`, `isAdmin/canEditPost/canDeletePost: boolean` |
| 编辑器   | `@vanblog/builtin/pages/admin/edit/[id].astro`          | `post: Partial<Post>`, `tags: Tag[]`, `cats: Category[]`, `site: Site`, `isNew: boolean`, `notFound: boolean`, `denied: boolean`                                           |
| 媒体     | `@vanblog/builtin/pages/admin/media.astro`              | `media: Media[]`, `totalMedia: number`, `totalPages: number`, `page: number`, `canDelete: boolean`                                                                         |
| 标签     | `@vanblog/builtin/pages/admin/tags.astro`               | `tags: Tag[]`                                                                                                                                                              |
| 分类     | `@vanblog/builtin/pages/admin/categories.astro`         | `cats: Category[]`                                                                                                                                                         |
| 回收站   | `@vanblog/builtin/pages/admin/trash.astro`              | `trash: TrashEntry[]`, `canEditPost/canDeletePost: boolean`                                                                                                                |
| 用户     | `@vanblog/builtin/pages/admin/users.astro`              | `users: User[]`, `adminCount: number`                                                                                                                                      |
| 站点     | `@vanblog/builtin/pages/admin/site.astro`               | `site: Site`, `tlsStatus: TLSStatus`, `denied: boolean`, `themes: ThemeMeta[]`, `palettes: PaletteMeta[]`, `activeTheme: string`, `activePalette: string`                  |
| 路由     | `@vanblog/builtin/pages/admin/routing.astro`            | `rules: RouteRule[]`, `allowlist: string[]`, `status: RoutingStatus`, `auditItems: AuditItem[]`                                                                            |
| 审计     | `@vanblog/builtin/pages/admin/audits.astro`             | `audits: AuditEntry[]`, `totalAudits: number`, `totalPages: number`, `page: number`, `action: string`, `resultQ: string`                                                   |
| 备份     | `@vanblog/builtin/pages/admin/backups.astro`            | `backups: BackupFile[]`, `isAdmin: boolean`                                                                                                                                |
| 迁移     | `@vanblog/builtin/pages/admin/migrate.astro`            | `isAdmin: boolean`                                                                                                                                                         |
| 修订     | `@vanblog/builtin/pages/admin/revisions/[postId].astro` | `post: Post`, `revisions: Revision[]`                                                                                                                                      |

### Pack 页面（`packs/*/pages/index.astro`）

契约：必须 `import { Page } from 'vanblog:theme'` 并用 `<Page>` 包裹。Pack 自己 frontmatter 自由。theme 必须提供 `PackPage.astro`（`src/layouts/` 或 `src/builtin-overrides/layouts/`），否则 build fail。

---

## Phases

每个 phase 都有 done 标准，前一 phase 不通过不进下一 phase。Spike 3 已完成验证，**不需要 Phase 0**。

### Phase 1: docs 对齐

- **Goal**：把新模型写进 docs，让后人对得上。在 Phase 2 实施前完成，避免 docs 与代码脱节。
- **Files**：
  - `docs/agent-theme-architecture.md`（重写 §4 调色盘加载、§5 主题目录结构、§7 加载机制、§8 MCP tools）
    - §4：palette 加载从「Caddy 注入」改为「Astro 端点 `/api/palette.css`」
    - §5：从 `hooks/themes/{name}/` 改为 `themes/{name}/` + Astro 标准结构 + `src/builtin-overrides/` + `@vanblog/builtin/*` alias
    - §7：dev/prod/theme 切换/palette 切换 4 个加载路径（基于 Spike 3 极简模型）
    - §8：MCP tools 路径从 `hooks/themes/` 改为 `themes/{name}/src/` 和 `themes/{name}/src/builtin-overrides/`
  - `docs/future-pack-architecture.md`（cross-reference）
    - "Full themes" 章节加 cross-reference，指向 `agent-theme-architecture.md` 的 Spike 3 模型
    - "Admin direction" 强化「admin 锁定」决策
  - `docs/theme-implementer-guide.md`（★ 新增）
    - 目录约定（Astro 标准 + 可选 `builtin-overrides/`）
    - `@vanblog/builtin/*` alias 引用方式（方案 A：显式 import）
    - L0/L1/L2 三层 API surface 完整说明
    - 25 个页面的 frontmatter 契约清单
    - 禁区列表（admin/api/lib/loaders/middleware/live.config）
    - 升级流程（主仓库 `app/src/` 升级 → 所有 theme 自动受益；agent 扫描 override 看哪些需要适配）
    - 完整的最小 theme 示例
- **Steps**：
  - [ ] PR 1：重写 `agent-theme-architecture.md` §4/§5/§7/§8（基于 Spike 3 最终结论）
  - [ ] PR 2：新增 `theme-implementer-guide.md`
  - [ ] PR 3：`future-pack-architecture.md` cross-reference + Admin direction 强化
- **Done when**：
  - 3 个 PR review 通过合并
  - `theme-implementer-guide.md` 涵盖所有 25 个页面的 frontmatter 契约 + L0/L1/L2 分层
  - docs 与 Spike 3 验证结论一致（无 submodule / sparse-checkout / Dockerfile cp 残留）

### Phase 2: theme kernel（30 行 integration + default theme 模板 + Dockerfile）

- **Goal**：让 `themes/{name}/` 真正可运行——integration 能解析 alias、theme 是独立 Astro 项目、Dockerfile build-arg 能切。
- **Files**：
  - `app/integrations/themes/index.mjs`（★ 新建，30 行核心 + 禁区检查）
  - `app/integrations/packs/index.mjs`（修改：`themePage` 改为接受 option，让 theme 的 PackPage 优先）
  - `themes/default/astro.config.mjs`（★ 新建：引用 themes() + packs() integration）
  - `themes/default/package.json`（★ 新建：声明对 @vanblog/sdk 的依赖）
  - `themes/default/theme.json`（★ 新建：元数据 `{name: "default", label, version, screenshot, builtinRef}`）
  - `themes/default/src/layouts/PackPage.astro`（★ 新建：最小 PackPage host，re-export builtin 或自写）
  - `themes/default/src/pages/`（★ 新建：11 个 public 页面，初始内容是 re-export builtin 的薄壳）
    - 例：`themes/default/src/pages/index.astro` 内容 `export { default } from '@vanblog/builtin/pages/index.astro';`
  - `themes/README.md`（★ 新建：theme 作者快速上手）
  - `app/src/pages/api/palette.css.ts`（★ 新建：SSR 端点，读 `site.palette` → 拼接 `hooks/palettes/{name}/*.css` → 返回 text/css）
  - `app/src/pages/api/themes.ts`（★ 新建：GET 列出 `themes/` + 元数据）
  - `app/src/pages/api/palettes.ts`（★ 新建：GET 列出 `hooks/palettes/`）
  - `app/src/pages/api/revalidate.ts`（★ 新建：dev only，触发 dev server 重启）
  - `app/src/layouts/BaseLayout.astro`（修改：注入 `<link rel="stylesheet" href="/api/palette.css?v={site.updated}">`）
  - `vault/pb_migrations/1782400000_add_site_palette_theme_fields.go`（★ 新建：site 加 `palette: TextField` + `activeTheme: TextField` 替换原 select 枚举）
  - `vault/internal/site/...`（暴露 site.palette / site.activeTheme 给 SDK）
  - `sdk/src/services.ts`（修改：site.get/update 携带 palette、activeTheme）
  - `Dockerfile`（修改：astro-build stage 加 `ARG VANBLOG_ACTIVE_THEME` + `COPY themes/${VANBLOG_ACTIVE_THEME}/ /build/theme/` + `COPY app/ /build/app/` + `WORKDIR /build/theme` + `RUN pnpm build`）
  - `docker/entrypoint.prod.sh`（修改：读 `/etc/vanblog/active-theme` 校验与 `site.activeTheme` 一致）
  - `docker/entrypoint.dev.sh`（修改：`cd themes/${VANBLOG_ACTIVE_THEME}/ && astro dev`）
  - `scripts/theme-init.mjs`（★ 新建：scaffold 新 theme = `cp -R themes/default themes/{name}` + 改 theme.json + 改 astro.config.mjs 引用）
- **Steps**：
  - [ ] 写 `themes/index.mjs`：30 行核心 resolveId + 禁区检查（admin/api/lib/loaders/middleware/live.config）
  - [ ] 改造 `packs/index.mjs`：`themePage` 接受 option，theme 的 `src/layouts/PackPage.astro` 优先
  - [ ] 建 `themes/default/`：astro.config.mjs 引用 `../../app/integrations/{packs,themes}`，package.json 依赖 @vanblog/sdk，theme.json 元数据
  - [ ] 建 `themes/default/src/pages/`：11 个 public 页面薄壳（re-export builtin）
  - [ ] 建 `themes/default/src/layouts/PackPage.astro`：最小 host
  - [ ] 加 `api/palette.css.ts`：SSR 端点，读 site.palette → 拼接 hooks/palettes/{name}/\*.css
  - [ ] 加 `api/themes.ts`/`api/palettes.ts`：枚举端点
  - [ ] 加 `api/revalidate.ts`：dev only 重启触发器
  - [ ] pb migration 加 site.palette + site.activeTheme 字段
  - [ ] 修改 Dockerfile astro-build stage：build-arg + COPY theme + WORKDIR theme + pnpm build
  - [ ] 修改 entrypoint.prod.sh：校验 activeTheme
  - [ ] 修改 entrypoint.dev.sh：cd theme 目录
  - [ ] 写 `scripts/theme-init.mjs`
  - [ ] 测试：本地起 dev server，访问 `themes/default/` 渲染的首页应与 `app/src/pages/index.astro` 一致（alias 工作）
- **Done when**：
  - `pnpm --filter vanblog-app build` 在 `themes/default/` 目录跑通过
  - `docker build --build-arg VANBLOG_ACTIVE_THEME=default -t vanblog:test .` 成功
  - 本地手动验证：在 `themes/default/src/builtin-overrides/components/` 放一个差异 PostCard.astro，启动 dev，所有 `@vanblog/builtin/components/PostCard.astro` 引用切换到 override 版本（HMR 即时）
  - 禁区规则验证：尝试创建 `themes/default/src/builtin-overrides/pages/admin/index.astro` → integration 报错
  - `api/palette.css` 端点能正确返回拼接 CSS
  - pb migration 在 fresh db 上成功执行，site 表新字段存在
  - PackPage 缺失时 build fail（theme 必须提供 PackPage host）

### Phase 3: default-public theme 重写（参考 vanblog 视觉）

- **Goal**：把 11 个 public 页面 + BaseLayout + 组件重写为有原 vanblog 视觉风格的 default theme。**操作位置**：`app/src/`（builtin 源头）+ `themes/default/src/pages/`（薄壳改为实际页面）。
- **Files**：
  - `app/src/layouts/BaseLayout.astro`（重写：NavBar + 子菜单 + Ctrl+K 搜索 + footer 社交链接 + SiteStatsSummary）
  - `app/src/styles/global.css`（扩展：加 tip-card / custom-container / toc / scrollbar / markdown-runtime / code-dark/light / zoom 等 palette 素材，全部用 CSS 变量）
  - `app/src/components/`（新增 13 个必迁组件的 Astro 版本）：
    - `NavBar.astro` + `NavItem.astro` + `NavMobile.astro`
    - `Footer.astro`
    - `PostCard.astro`（含 overview/article/about 三模式 + 私有加密 + Reward + Copyright）
    - `ArticleList.astro`
    - `SiteStatsSummary.astro`
    - `TimelinePage.astro`
    - `Toc.astro` + `TocMobile.astro`
    - `BackToTop.astro`
    - `SearchDialog.astro`（Ctrl+K 浮层）
    - `Reward.astro` / `Copyright.astro` / `UnlockCard.astro` / `AlertCard.astro`
  - `app/src/pages/index.astro`（重写：用 PostCard overview 模式 + SiteStatsSummary 顶部）
  - `app/src/pages/posts/[id].astro`（重写：Toc + Reward + Copyright + AlertCard + UnlockCard，保留现有 mermaid/code 增强）
  - `app/src/pages/{archive,timeline,search,about,404}.astro`
  - `app/src/pages/{categories,tags}/{[id],index}.astro`
  - 给所有 11 个 public 页面顶部加 L0 契约注释
  - `themes/default/src/pages/*.astro`（从薄壳改为实际页面，或保留 re-export builtin）
- **Steps**：
  - [ ] 先扩 `global.css`：把原 `refs/.../styles/*.css` 用 Tailwind v4 语义别名重写为 tokens + components
  - [ ] 写 13 个组件（Astro + Tailwind v4 + CSS 变量），逐个对照原 vanblog 视觉
  - [ ] 重写 BaseLayout（含 NavBar 子菜单、Ctrl+K、footer）
  - [ ] 重写 11 个 public 页面，每个加 L0 契约注释
  - [ ] 跑 `pnpm --filter vanblog-app build`，跑 astro check
  - [ ] 手动验证：首页/文章/归档/时间轴/搜索/关于视觉与原 vanblog 接近
- **Done when**：
  - `astro check` 无 error
  - `pnpm --filter vanblog-app build` 通过（在 themes/default/ 跑）
  - 11 个 public 页面在 fresh db + seed 数据下视觉接近原 vanblog（截图对比）
  - 11 个页面顶部都有 `⛔ AGENT: DO NOT EDIT` L0 契约注释
  - `pages/api/`、`lib/`、`loaders/`、`live.config.ts`、`middleware.ts` 字节级未动

### Phase 4: default-admin 完善（admin 锁定，UX 完善）

- **Goal**：重写 14 个 admin 页面 + AdminLayout，达到原 vanblog admin 的 UX 完整度。**admin 锁定为 builtin，override 不能覆盖**。
- **Files**：
  - `app/src/layouts/AdminLayout.astro`（重写：admin sidebar + topbar + palette 切换入口）
  - `app/src/pages/admin/index.astro`（Article 列表：批量选择 + 列设计参考 `refs/.../admin/src/pages/Article/columns.jsx`）
  - `app/src/pages/admin/edit/[id].astro`（编辑器：参考 `refs/.../admin/src/pages/Editor/index.jsx`）
  - `app/src/pages/admin/{media,users,tags,categories,trash,routing,audits,backups,migrate,revisions/[postId]}.astro`
  - `app/src/pages/admin/site.astro`（重点扩展：theme/palette 切换 section）
- **Steps**：
  - [ ] 重写 AdminLayout：固定侧栏 + 顶部 user 状态 + palette 切换 button
  - [ ] 重写 14 个 admin 页面，参考原 vanblog admin 的列设计、tab 分区、Modal 流程
  - [ ] site.astro 加 theme/palette 下拉（数据来自 `api/themes` 和 `api/palettes`）
  - [ ] site.astro dev/prod 模式提示（dev 即时切，prod 提示重建）
  - [ ] 跑 astro check + build
  - [ ] 手动跑过 14 个页面的核心流程（CRUD + 备份恢复 + 路由编辑 + 用户管理）
- **Done when**：
  - 所有 14 个 admin 页 astro check 无 error
  - 关键 CRUD 流程手动通过（创建文章 → 发布 → 编辑 → 修订 → 删除 → 恢复 →purge；上传媒体 → 删除；创建用户 → 改权限 → 删除；改路由 → 应用 → 回滚）
  - theme/palette 切换在 dev 模式即时生效
  - 尝试在 `themes/default/src/builtin-overrides/pages/admin/` 写文件 → integration 报错（admin 锁定验证）

### Phase 5: palette 系统完善（4-5 个 builtin palette + 切换 UI）

- **Goal**：把 palette 从"一个端点"完善为"多个 builtin palette + 切换 UI"，让用户开箱即用。
- **Files**：
  - `hooks/palettes/midnight/`（深色优先）
  - `hooks/palettes/solarized/`（Solarized Light/Dark）
  - `hooks/palettes/rose-pine/`（Rose Pine）
  - `hooks/palettes/catppuccin/`（Catppuccin Mocha/Latte）
  - `hooks/palettes/README.md`
  - `app/src/pages/api/palette.css.ts`（扩展：支持 palette.json 元数据 + dark/light 双套 tokens）
  - `app/src/layouts/BaseLayout.astro`（扩展：palette 与 defaultTheme 联动，auto/light/dark 三态）
  - CI lint 规则：扫描 `app/src/**/*.{astro,css}` 禁止 hardcode 颜色（必须用 CSS 变量）
- **Steps**：
  - [ ] 设计 palette.json schema：`{name, label, version, author, supports: ['light','dark']}`
  - [ ] 实现 4-5 个 builtin palette（tokens.css + typography.css + components.css）
  - [ ] 完善 palette.css 端点：读 palette.json，按 site.defaultTheme 选择对应 token 集
  - [ ] BaseLayout 处理 palette + dark mode 联动（dark class + palette link 同时切）
  - [ ] 加 CI lint 规则：禁止 builtin 文件 hardcode 颜色
- **Done when**：
  - 4 个以上 builtin palette 可在 admin 切换
  - 每个 palette 在 light/dark/auto 三态都正确显示
  - palette 切换不需要 build，刷新页面即生效
  - CI lint 能 catch hardcode 颜色（`#fff`、`rgb(...)`、`hsl(...)` 在 builtin 文件中出现 → CI fail）

### Phase 6: admin 切换 UI（ThemeCard/PaletteCard + preview iframe）

- **Goal**：admin/site 页有完整的 theme/palette 管理面板，含预览缩略图、dev/prod 模式提示、当前选中状态。
- **Files**：
  - `app/src/pages/admin/site.astro`（最终完善）
  - `app/src/components/admin/ThemeCard.astro`（缩略图 + 名称 + 当前选中标记）
  - `app/src/components/admin/PaletteCard.astro`（颜色色板预览 + 名称）
  - `app/src/pages/api/preview.astro`（★ 新端点：给定 theme + palette，返回首页 SSR 预览 HTML，用 iframe 嵌入 admin）
- **Steps**：
  - [ ] 实现 ThemeCard/PaletteCard 组件
  - [ ] site.astro 排版为 grid，每个 theme/palette 卡片化
  - [ ] 加 dev/prod 模式提示（dev 即时切换，prod 提示重建）
  - [ ] preview 端点支持 `?theme=x&palette=y` 临时覆盖（仅 admin 可访问）
- **Done when**：
  - admin 能看到所有 builtin + 用户 theme/palette 的卡片
  - 点击卡片即时切换（dev）或显示重建提示（prod）
  - preview iframe 正确渲染选中组合

### Phase 7: MCP tools（agent 升级辅助 + theme 编辑工具）

- **Goal**：按 `agent-theme-architecture.md` §8 实现 8 个 MCP tools，让 agent 能读写 theme/palette、触发预览/build、读 pb schema。**重点增加**：升级辅助 tool（diff builtin 新旧版本 + 扫描 override 适配点）。
- **Files**：
  - `vault/internal/mcp/`（★ 新建 Go 包，挂 pb OnServe 路由）
    - `read_file.go` / `write_file.go` / `list_dir.go`（路径限制 `themes/*/src/` 和 `hooks/palettes/`，**禁止写 `themes/*/src/builtin-overrides/{pages/admin,pages/api,lib,loaders}/`**）
    - `preview.go`（HTTP 302 到 `/admin/preview?theme=x&palette=y`）
    - `build.go`（dev only：触发 astro build 到 staging）
    - `pb_schema.go`（GET `/api/collections/{name}` 透传）
    - `pb_query.go`（GET only pb API 透传）
    - `upgrade_diff.go`（★ 新增：对比 builtin 当前 commit 与目标 tag 的 L0/L1 surface diff，输出 `themes/*/src/builtin-overrides/` 需要适配的文件清单）
  - `sdk/src/services.ts`（扩展 `client.vanblog.mcp.*` 服务命名空间）
  - `docs/theme-implementer-guide.md`（MCP tools 章节）
  - `scripts/contract-diff.mjs`（★ 新增：CI 用的 L0/L1 surface diff，与 upgrade_diff.go 共享逻辑）
- **Steps**：
  - [ ] Go 侧实现 8 个 handler，全部挂 `/api/vanblog/mcp/*` 路由，pb Rule 限制 admin only
  - [ ] 路径校验：`read_file` / `write_file` / `list_dir` resolve 后必须落在 `themes/*/src/` 或 `hooks/palettes/` 下，否则 403；额外拒绝写 admin/api/lib/loaders 等禁区 override
  - [ ] `pb_query` 强制 GET，禁止 POST/PUT/DELETE
  - [ ] `upgrade_diff` 实现：跑 `git -C app/src diff <old>..<new> -- src/` → 分类为 L0/L1/L2 变更 → 与 `themes/*/src/builtin-overrides/` 文件交叉对比 → 输出适配清单
  - [ ] 写 `scripts/contract-diff.mjs`：CI 用，对比 PR 前后 builtin 的 L0/L1 surface
  - [ ] SDK 加 mcp 命名空间
  - [ ] 文档 + 示例
- **Done when**：
  - 用 curl 模拟 agent 调用 8 个端点全部通过
  - 路径越权尝试（写 `themes/*/src/builtin-overrides/pages/admin/`、`sdk/`、`vault/`）全部 403
  - `pb_query` 尝试 POST 被拒绝
  - `upgrade_diff` 能正确识别 L0 breaking change（手动构造一个删除 frontmatter 变量的 PR，CI 应 fail）
  - SDK TS 类型通过 astro check

---

## Risks & Mitigations

| Risk                                                                     | Impact                            | Mitigation                                                                                                                                                                                                    |
| ------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite `resolveId` 劫持 `.astro` 在 Astro 6 未来版本被限制                 | integration 失效                  | Spike 3 已验证当前可行。持续跟踪 Astro release notes；备选方案：theme build 时物理 cp `app/src/` 到 theme 的临时目录（牺牲 HMR）                                                                              |
| L0 契约注释被 agent 改掉后 build 不报错                                  | 数据层被破坏                      | contract-check 在 astro:config:setup 阶段 fail closed，任何契约区块字节级不匹配直接抛错                                                                                                                       |
| L0/L1 契约的强制力不够（vanblog 维护者不小心破坏）                       | 升级时用户 theme 大面积崩         | Phase 7 的 `scripts/contract-diff.mjs` 进 CI，PR 删除/重命名 L0/L1 surface → CI fail                                                                                                                          |
| theme 切换 prod 提示重建但用户忽略，导致 `site.activeTheme` 与镜像不一致 | 站点 500                          | entrypoint.prod.sh 启动时校验 `site.activeTheme` 与镜像内 theme 一致，不一致警告 + 强制用镜像内 theme + admin UI 红色提示                                                                                     |
| palette 切换不生效（浏览器缓存）                                         | 用户困惑                          | palette.css 端点返回 `Cache-Control: no-cache` + BaseLayout 用 `?v={site.updated}` query                                                                                                                      |
| `site.activeTheme` 指向已删除的 theme                                    | 站点 500                          | entrypoint 启动时检查 theme 目录存在，不存在则 silent fallback 到 default + admin 提示「theme 已缺失，已回退」                                                                                                |
| Pack 页面用 `vanblog:theme` host，theme 切换后 PackPage 缺失             | `/p/<pack>` 500                   | build 时校验 active theme 必须有 `PackPage.astro`（`src/layouts/` 或 `src/builtin-overrides/layouts/`），否则 build fail（依据 `future-pack-architecture.md` §"Theme host interface"）                        |
| admin 被错误开放 theme 化                                                | admin 不可用、lockout             | integration 对 `@vanblog/builtin/pages/admin/**` 强制忽略 override；theme 在 `src/builtin-overrides/pages/admin/` 放任何文件直接 fail closed + 警告                                                           |
| Phase 3/4 重写期间 breaking 现有用户                                     | 业务中断                          | 重写在 feature branch 进行；每个 phase 独立 PR，CI 必须通过所有现有测试                                                                                                                                       |
| Tailwind v4 `@theme` + theme override 的样式隔离                         | theme A 的 utility 泄漏到 theme B | 每个 theme 是独立 Astro 项目，自带 `@source` 清单，只扫描自己的 `.astro`；default theme 的 `global.css` 在 builtin 层完全自包含                                                                               |
| MCP write_file 被恶意 agent 写入恶意 `.astro`                            | RCE                               | prod 镜像中 `dist/` 是构建产物，运行时不读 `src/`；dev 模式 agent 本身就是 host 用户可控；额外限制：write_file 拒绝包含 `<script is:inline>` 中 `eval/Function/import()` 的文件；写禁区 override 路径都被拒绝 |
| palette CSS 拼接时 @import 顺序错误                                      | 样式失效                          | palette.css 端点固定顺序：tokens → typography → components；不允许 palette 内部 @import 其他文件                                                                                                              |

**已消除的风险**（Spike 3 相比 Spike 2）：

- ~~自引用 submodule 行为不可预测~~（Spike 3 无 submodule）
- ~~sparse-checkout 在 fresh clone 后不持久化~~（Spike 3 无 sparse-checkout）
- ~~Dockerfile cp theme 到 app/src/~~（Spike 3 theme 是独立 build 目标）
- ~~跨项目 import 路径 5 层嵌套~~（Spike 3 alias 透明解析）
- ~~submodule 在用户 fork 仓库时丢失或权限错~~（Spike 3 无 submodule）

---

## Rollback Strategy

按 phase 独立可回滚，**不再涉及 submodule 清理**：

- **Phase 1 失败**：revert docs PR，无运行时影响。
- **Phase 2 失败**：revert integration + migration；migration 写 down（drop site.palette / site.activeTheme 字段，恢复原 select 枚举）；`themes/` 目录保留但 `app/astro.config.mjs` 不引用 themes() integration；entrypoint 回退到直接跑 `app/` 的 astro。
- **Phase 3/4 失败**：feature branch 直接放弃，main 上的 builtin 页面不动（旧 `app/src/` 仍是 builtin 源头，未引用 themes/）。
- **Phase 5 失败**：删除 `hooks/palettes/*` 即回退到 default palette。
- **Phase 6 失败**：admin/site.astro 切换 section 隐藏即可。
- **Phase 7 失败**：`vault/internal/mcp` 包不挂 OnServe 即禁用；contract-diff.mjs 从 CI 移除。

**绝不**：

- 不用 git rollback 整个仓库（按原则，需用户明确同意）。
- 不删 `themes/{name}/src/` 和 `themes/{name}/src/builtin-overrides/` 用户数据（用户写的 theme 改动永远保留）。
- 不删 `hooks/palettes/` 用户数据。
- 不动 pb_data（migration 写 down 也只是 drop column，不删记录）。

---

## Assumptions

- PocketBase 仍是实例内容与 schema 的事实来源，SDK 不变。
- Astro 6 的 `astro:config:setup` + Vite plugin API 在未来 major 版本保持稳定（Spike 3 已验证当前可行）。
- **不需要 git submodule**（Spike 3 的 alias 模型让 builtin 是引用而非副本，无 submodule 风险）。
- Docker build-arg 机制稳定（标准 Docker 特性）。
- 用户 fork theme 后能直接跑（不需要 `git submodule update --init`，theme 是自包含 Astro 项目；只需主仓库 `app/src/` 存在即可，alias 自动解析）。
- v1 可以只开放 L0/L1 theme（即 override 文件遵守 L0 契约 + 用 L1 组件 API）；L2 内部实现层的 lint 严格度可逐步加强。
