# VanBlog 与评论系统

本文档回答「VanBlog 的评论系统到底是什么、如何集成、边界在哪」这三个核心问题，是评论系统的**架构与集成总览**。具体部署操作（内置 sidecar / compose 多容器）见 [`comments-artalk.md`](./comments-artalk.md)。

---

## 1. 定位：评论是「前端外挂」，不是后端子系统

VanBlog 本身**不实现评论功能**，评论是外挂形态：

- 后端（PocketBase / Go / Caddy）不存储评论内容，也不提供评论增删改查 API。
- 评论正文始终存放在外部服务（Artalk 自托管实例、或任意第三方评论系统）。
- VanBlog 只做三件事：
  1. 存储并校验「用哪个评论 provider + 对应配置」这份**元数据**；
  2. 在站点配置里暴露 provider 选项，让用户选择；
  3. 由 theme 组件在文章/关于页渲染对应的评论 widget。

因此评论系统对 VanBlog 而言是一个**前端集成点**，而非后端领域模型的一部分。

---

## 2. 三个核心问题的答案

### 2.1 conf 如何处理？是否一等公民？

**是，conf 是一等公民**，端到端闭环，单一事实源是 SDK 的 zod schema。

`site` 集合上有两个字段：

| 字段               | 类型                | 含义                               |
| ------------------ | ------------------- | ---------------------------------- |
| `commentsProvider` | SelectField（枚举） | `disabled` / `artalk` / `external` |
| `commentsConfig`   | JSONField           | 按 provider 区分的配置对象         |

数据流：

```
sdk/src/models/fields.ts        ← 单一事实源（zod schema）
        │
        ├─ CommentsProviderSchema        枚举 {disabled, artalk, external}
        ├─ ArtalkConfigSchema            { server, site? }
        ├─ ExternalConfigSchema          { customScript }
        └─ CommentsConfigSchema          z.union(disabled, artalk, external)
        │
        ▼  pnpm build:models
runtime/core-schema/models.js     ← 编译产物，Go 端用 goja 执行同一套 schema
        │
        ▼
vault/internal/validation/        ← Go 校验（与前端同一套规则）
```

交叉校验在 `sdk/src/models/site.ts` 的 `superRefine`：

```ts
}).superRefine((site, context) => {
  if (
    site.commentsProvider &&
    !CommentsProviderConfigSchemas[site.commentsProvider].safeParse(site.commentsConfig).success
  ) {
    context.addIssue({ code: "custom", path: ["commentsConfig"], message: "..." });
  }
});
```

即：`commentsConfig` 必须与 `commentsProvider` 匹配，否则整份 `site` 校验失败。DB 层靠 JSONField 存原始 JSON，合法性由上面的 zod 规则在写入路径统一把关。

### 2.2 后端提供时是否走 Caddy 统一出口？鉴权/换票/require admin 怎么处理？

分两种形态：

- **Artalk 自托管**：走 Caddy 统一出口（`/comments/*`），但**不做 VanBlog 鉴权**。
- **external 自定义脚本**：完全由第三方服务自己暴露，VanBlog 不参与出口，也不做鉴权。

对 Artalk 而言：

- Caddy 系统路由 `vanblog-system-artalk` 把 `/comments/*` 反向代理到上游（内置 sidecar `127.0.0.1:23366` 或外部容器 `artalk:23366`）。
- 该路由是**纯反向代理**，`handle` 里只有 `rewrite(strip_path_prefix)` + `reverse_proxy`，**没有 auth middleware、没有换票、没有 `require admin`**。
- 这是有意设计：Artalk 有自己的独立账号体系（管理员账号、评论者身份由 Artalk 内部管理），VanBlog 的 PocketBase 鉴权不应、也无需参与评论系统。

**结论**：评论系统走 Caddy 统一出口（Artalk 场景），但鉴权边界清晰——VanBlog 不替评论系统做换票或 admin 鉴权，Artalk 自持账号体系，external 由第三方自持。

### 2.3 前端 SDK 是否需要包含评论系统能力？

**不需要，且当前没有。**

SDK 只负责**数据契约**：`commentsProvider` 枚举 + `commentsConfig` 的 zod schema（类型定义与校验）。SDK 里**没有**任何评论渲染、初始化、组件逻辑。

真正的评论渲染在 **theme 层**：

```
themes/vanblog/src/components/Comments.astro
```

它根据 `site.commentsProvider` 分发：

- `disabled` → 不渲染
- `artalk` → 同源加载 `{server}/dist/Artalk.{js,css}` 并 `Artalk.init(...)`
- `external` → `set:html` 原样注入 `commentsConfig.customScript`

这是正确的边界：**SDK 管数据契约，theme 管渲染**。评论能力属于 theme 的呈现层，不应该下沉进 SDK。

---

## 3. Provider 模型

### 3.1 `disabled` —— 关闭评论

- 配置：空对象 `{}`
- 渲染：无

### 3.2 `artalk` —— 自托管 Artalk（推荐）

- 配置：`{ server: string, site?: string }`
- `server` 是同源地址 `https://<域名>/comments`
- 渲染：同源加载 Artalk 前端资源 + `Artalk.init`
- 部署：内置 sidecar 或 compose 多容器，见 [`comments-artalk.md`](./comments-artalk.md)

### 3.3 `external` —— 任意第三方评论系统兜底

- 配置：`{ customScript: string }`
- `customScript` 是**完整 HTML/JS 片段**，由 theme 组件用 `set:html` **原样注入**（无 sanitize）
- 适用：giscus、twikoo、Waline 自定义 embed 等任意第三方
- 注意：`commentsConfig.customScript`（评论容器内注入）与 `site.customScript`（全局 JS 注入）是**两个独立字段**，不要混淆

---

## 4. 运行时架构（Artalk 自托管）

```
浏览器
  │  /comments/api/v2/*（评论读写）
  │  /comments/dist/Artalk.{js,css}（前端资源）
  ▼
Caddy（统一出口，单域名单 TLS）
  │  route: vanblog-system-artalk
  │  handle: [rewrite(strip_path_prefix=/comments), reverse_proxy]
  ▼
Artalk（127.0.0.1:23366 或 artalk:23366）
  │  以 / 为根（Artalk 不支持 base path）
  ▼
SQLite 数据（/data/artalk 或独立卷）
```

关键点：

- Artalk 不支持 `base_path`，同源 `/comments` 前缀靠 Caddy `rewrite strip_path_prefix` 剥离后再反代到 Artalk 根 `/`。
- `strip_path_prefix` 同时作为**通用 proxy 能力**暴露在 `site.routing` 规则里（`RouteRuleSchema.stripPathPrefix`），可复用于任意不支持 base path 的上游。

两种部署形态：

| 形态             | 选择方式                                                 |
| ---------------- | -------------------------------------------------------- |
| 内置 Artalk      | 使用 `prod-artalk` 镜像，在 `/setup` 向导中选择 `artalk` |
| compose 外部容器 | 使用 `VANBLOG_ARTALK_UPSTREAM=artalk:23366` 接入外部实例 |

是否启用由持久化的 `site.commentsProvider` 决定；`VANBLOG_ARTALK_UPSTREAM` 只表示外部上游地址，不负责启用 Artalk。

---

## 5. 相关文件索引

| 功能                         | 路径                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| SDK zod schema（单一事实源） | `sdk/src/models/fields.ts`                                        |
| 交叉校验 superRefine         | `sdk/src/models/site.ts`                                          |
| schema 编译产物              | `runtime/core-schema/models.js`                                   |
| Go Caddy 路由生成            | `vault/internal/caddy/config_builder.go`                          |
| 上游地址解析                 | `vault/internal/caddy/bootstrap.go`                               |
| 通用 proxy strip 能力        | `vault/internal/caddy/translator.go`                              |
| 评论前端渲染组件             | `themes/vanblog/src/components/Comments.astro`                    |
| admin 站点配置面板           | `app/src/pages/admin/site.astro`                                  |
| 部署操作手册                 | `docs/comments-artalk.md`                                         |
| 存量 provider 迁移           | `vault/pb_migrations/1783500000_shrink_comments_provider_enum.go` |
