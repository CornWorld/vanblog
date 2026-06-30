# PocketBase Schema 设计 v2

> **依据**:原项目 [`packages/server/src/scheme/`](file:///Users/corn/Code/vanblog-upstream/packages/server/src/scheme) 真实字段
>
> **目标**:用 PocketBase 0.20+ 的 collection / field 类型原生表达 Vanblog 数据模型,**保证原 Vanblog 用户数据可无损迁移**。
>
> **v2 关键变化**(对比 v1):
>
> - 表名遵循行业惯例(全词,不强行缩写)
> - **砍掉** `post_tags`(pb relation 数组原生多对多)
> - **砍掉** `pages`(CustomPage 改用 Astro 原生)
> - **保留** `revisions`(应用内历史,DB 模式)
> - `site` 表用 JSON 字段承载展开数组
> - Pipeline / Waline / picgo 不入 schema

---

## 0. 设计原则

1. **集合名用复数**(REST + pb 惯例):`/api/posts`、`/api/categories`
2. **用全词,不强行缩写**:`categories` 是对的,`cats` 是自造词
3. **真正精简的是复合词前缀**:`custom_pages` → `pages`、`site_config` → `site`、`api_tokens` → `tokens`
4. **pb 原生优先** —— 用 `_superusers` 内置表,不自建管理员鉴权
5. **autodate 用 pb 约定** —— `created` / `updated` 字段由 pb 自动维护
6. **relation 数组就是多对多** —— pb 的 `MaxSelect > 1` relation 字段原生支持,不需要关联表
7. **Rule 用 pb 表达式** —— `@request.auth.id != ""` 等
8. **数据兼容** —— 保留 `oldId` 字段做迁移映射

---

## 1. Collections 总览(10 个)

| Collection    | 类型         | 对应原表                    | 迁移兼容 | 说明                             |
| ------------- | ------------ | --------------------------- | -------- | -------------------------------- |
| `_superusers` | pb 内置 auth | —                           | —        | 管理员后台登录(pb 原生)          |
| `users`       | Auth         | `User`                      | 📦       | 协作者                           |
| `posts`       | Base         | `Article` + `Draft`         | 📦       | **合并**草稿与已发布             |
| `categories`  | Base         | `Category`                  | 📦       | 分类/专栏                        |
| `tags`        | Base         | —(原为内嵌数组)             | 📦       | 标签表                           |
| `revisions`   | Base         | —(新增)                     | —        | 文章历史版本(应用内)             |
| `media`       | Base         | `Static`                    | 📦       | 图床/文件元数据                  |
| `site`        | Base(单行)   | `Meta` + `Setting`          | 📦       | 站点配置(JSON 字段)              |
| `visits`      | Base         | `Visit` + `Viewer`          | 📦       | 访问计数(合并双表)               |
| `audits`      | Base         | —(原 README 提及,无 schema) | —        | 审计日志(登录 + 路由变更 + 配置) |
| `tokens`      | Base         | `Token`                     | 📦       | API Token                        |

**对比 v1(16 个)**:砍掉 `post_tags`、`pages`、`nav_menus`、`friend_links`、`socials`、`rewards`(后 4 个并入 `site` JSON)。

---

## 2. 详细 Schema

### 2.1 `users` — 协作者(Auth Collection)

对应原表:`User`

| 字段          | pb 类型                       | 原字段              | 说明                  |
| ------------- | ----------------------------- | ------------------- | --------------------- |
| `username`    | text(unique, required)        | `name`              | 登录名                |
| `nickname`    | text                          | `nickname`          | 展示名                |
| `role`        | select(admin/collaborator)    | `type`              | 默认 `collaborator`   |
| `permissions` | select(multiple)              | `permissions`       | 8 种权限 + `all`,见下 |
| `oldId`       | number(unique)                | `id`                | 迁移映射              |
| —             | pb 内置 `email`               | —                   | pb auth 必带          |
| —             | pb 内置 `password`            | `password` + `salt` | pb 自动加盐           |
| —             | pb 内置 `created` / `updated` | `createdAt`         | autodate              |

> **⚠️ 实施注意**: users 是 Auth Collection,需用 `core.NewAuthCollection("users")` 创建。
> 默认 identity 是 email,我们用 username 登录,必须配 `PasswordAuth.IdentityFields = ["username"]`,
> 否则用户只能用 email 登录。

**权限枚举**(select options,来自 `access/access.ts`):

```
article:create, article:delete, article:update,
draft:publish, draft:create, draft:delete, draft:update,
img:delete, all
```

**Rule**:

- List/View: `@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.id = id)` — 管理员或自己
- Create/Update/Delete: `@request.auth.role = "admin"`

---

### 2.2 `posts` — 文章(合并 Article + Draft)

对应原表:`Article` + `Draft`(双表合并)

| 字段            | pb 类型                         | 原字段                             | 说明                       |
| --------------- | ------------------------------- | ---------------------------------- | -------------------------- |
| `title`         | text(required)                  | `title`                            |                            |
| `content`       | text                            | `content`                          | Markdown 源码              |
| `status`        | select(draft/published/hidden)  | `Article.hidden` + 是否在 Draft 表 | **合并双表的关键**         |
| `oldId`         | number(unique)                  | `Article.id` / `Draft.id`          | 迁移映射                   |
| `tags`          | relation(multiple → `tags`)     | `tags[]`(string[])                 | **pb 原生多对多,无关联表** |
| `category`      | relation(single → `categories`) | `category`(string)                 | 强类型关系                 |
| `author`        | relation(single → `users`)      | `author`(string)                   | 强类型关系                 |
| `pathname`      | text(unique)                    | `pathname`                         | 自定义 URL                 |
| `top`           | number(default 0)               | `top`                              | 置顶权重                   |
| `private`       | bool(default false)             | `private`                          | 私密文章                   |
| `password`      | text                            | `password`                         | 加密文章(见迁移文档)       |
| `copyright`     | text                            | `copyright`                        |                            |
| `viewCount`     | number(default 0)               | `viewer`                           | pb hook 维护               |
| `visitedCount`  | number(default 0)               | `visited`                          | pb hook 维护               |
| `lastVisitedAt` | date                            | `lastVisitedTime`                  |                            |
| `deleted`       | bool(default false)             | `deleted`                          | 软删除                     |
| —               | pb 内置 `created` / `updated`   | `createdAt` / `updatedAt`          | autodate                   |

**迁移映射规则**:

- 原 `Draft` 行 → `status = 'draft'`
- 原 `Article` 行 → `status = 'published'`,`Article.hidden = true` → `status = 'hidden'`
- 原同一 `id` 同时存在 Article + Draft → Article 用原 id,Draft 加偏移量 `1000000 + id`

**Rule**:

- List/View: `status = "published" && private = false` || `@request.auth.id != ""`
- Create/Update/Delete: `@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.permissions ?~ "article:")`

---

### 2.3 `categories` — 分类

对应原表:`Category`

| 字段       | pb 类型                 | 原字段        | 说明            |
| ---------- | ----------------------- | ------------- | --------------- |
| `name`     | text(unique, required)  | `name`        |                 |
| `type`     | select(category/column) | `type`        | 默认 `category` |
| `private`  | bool(default false)     | `private`     |                 |
| `password` | text                    | `password`    |                 |
| `meta`     | json                    | `meta`(Mixed) |                 |
| `oldId`    | number(unique)          | `id`          | 迁移映射        |

---

### 2.4 `tags` — 标签

> 原项目用 `string[]` 内嵌 Article,改为独立表 + `posts.tags` relation 数组(**pb 原生多对多,无关联表**)。

| 字段          | pb 类型                | 说明                             |
| ------------- | ---------------------- | -------------------------------- |
| `name`        | text(unique, required) | 标签名                           |
| `slug`        | text(unique)           | URL slug,空则用 name             |
| `description` | text                   | 标签描述(可选)                   |
| `oldName`     | text                   | 迁移映射(原 tags 数组中的字符串) |

**查询**(pb 0.39.4 验证,见各条目标注):

- 文章的标签:`GET /api/collections/posts/records?expand=tags`
- **推荐**:某标签下的文章 `filter=tags~'TAG_ID'`(`~` like:Go SDK ✅ + REST API ✅)
- `?~` (any-like):Go SDK ✅ + REST API ✅
- `?=` (any-equal):Go SDK ❌(返回 0 结果);REST API 文档声明支持但未经实测验证
- `=` (exact match):不适用于多选 relation(精确匹配整个数组)
- `tags:length > 0`:查有标签的文章 ✅
- 标签云:back-relation `posts_via_tags`(用于 expand/sort,不用于直接 filter)

> **验证来源**:`scripts/verify_relation.go`(in-process Bootstrap 测试),pb 0.39.4
>
> **Back-relation**:`posts_via_tags` 用于从 tags collection 反查关联的 posts(expand/sort),直接 filter 查 posts 用 `tags~'TAG_ID'`

---

### 2.5 `revisions` — 文章历史版本(应用内)

> **决策依据**:pb 官方 [discussion #4006](https://github.com/pocketbase/pocketbase/discussions/4006) 推荐 WordPress 式 status='revision' 模式。
>
> **与外部 git 同步的区别**:这是应用内功能(UI 一键撤销),不是内容分发。

| 字段         | pb 类型                              | 说明                                               |
| ------------ | ------------------------------------ | -------------------------------------------------- |
| `target`     | relation(single → `posts`, required) | 哪篇文章                                           |
| `snapshot`   | json                                 | 完整字段快照                                       |
| `diff`       | text                                 | 与上版的 unified diff(可选,加速渲染)               |
| `authoredBy` | relation(single → `users`)           | 操作者                                             |
| `reason`     | text                                 | "auto-save" / "manual" / "publish" / **"restore"** |

**机制**:

- `OnRecordUpdateRequest("posts")` hook:在 `e.Next()` **之前**把**旧版本**写入 `revisions`(HTTP 级别 hook,API 请求触发)
- 后台 UI 列出历史,点击"恢复"即将 snapshot 写回 posts
- 保留策略:`site.revisions.retention`(默认 50 版/篇,LRU 清理)

**循环触发处理(学习 git)**:

- 恢复操作走正常 update 流程,**会再次触发 OnRecordUpdateRequest**,产生新 revision(`reason="restore"`)
- 不绕过 hook,不特殊处理 —— 语义清晰,与 git revert 产生新 commit 一致
- 前端按 `reason` 字段折叠显示 restore 记录,避免历史列表噪音

**Rule**:

- List/View/Restore: `@request.auth.id != ""`
- Create: 由 hook 自动写入(不暴露 API)
- Delete: `@request.auth.role = "admin"`

---

### 2.6 `media` — 图床/文件元数据

对应原表:`Static`

| 字段          | pb 类型                                   | 原字段              | 说明                  |
| ------------- | ----------------------------------------- | ------------------- | --------------------- |
| `file`        | file(single)                              | `realPath` + `name` | pb FileField 原生管理 |
| `staticType`  | select(img/customPage/favicon/attachment) | `staticType`        | 扩展枚举              |
| `storageType` | select(local/s3)                          | `storageType`       | `picgo → s3`          |
| `fileType`    | text                                      | `fileType`          | 扩展名                |
| `sign`        | text(unique)                              | `sign`              | MD5 去重              |
| `meta`        | json                                      | `meta`(Mixed)       | 图片宽高/尺寸         |
| `externalUrl` | text                                      | —                   | 新增:外部 URL(迁移用) |
| `oldId`       | text                                      | `name`              | 迁移映射              |

**索引**:`sign` unique,保留原 `getOneBySign` 查重行为。

**Rule**:

- List/View: `staticType = "img"` 公开,其余需 auth
- Create/Update/Delete: 需 auth

---

### 2.7 `site` — 站点配置(单行表)

对应原表:`Meta`(单文档)+ `Setting`

**设计**:v1 过度归一化(5 张表),v2 回归**单表 + JSON 字段**,对齐原项目 Meta 单文档模型。永远只有一行(id=1)。

| 字段               | pb 类型                                        | 原字段                                      | 说明                                                    |
| ------------------ | ---------------------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| `info`             | json                                           | `Meta.siteInfo` 标量字段                    | 站点基本信息                                            |
| `theme`            | select(default/minimal/magazine/custom)        | —                                           | 主题                                                    |
| `commentsProvider` | select(disabled/waline/giscus/artalk/external) | `siteInfo.enableComment`                    | 评论 provider                                           |
| `commentsConfig`   | json                                           | —                                           | waline serverUrl / giscus repo 等                       |
| `analyticsScript`  | text                                           | `siteInfo.gaAnalysisId` + `baiduAnalysisId` | 改为完整 script 注入                                    |
| `nav`              | json                                           | `Meta.menus[]`                              | 导航菜单数组                                            |
| `links`            | json                                           | `Meta.links[]`                              | 友链数组                                                |
| `socials`          | json                                           | `Meta.socials[]`                            | 社交数组                                                |
| `rewards`          | json                                           | `Meta.rewards[]`                            | 打赏数组                                                |
| `about`            | json                                           | `Meta.about`                                | `{ content, updatedAt }`                                |
| `customize`        | json                                           | `Setting.layout`                            | `{ head, css, html, script }`                           |
| `imageConfig`      | json                                           | `Setting.static` 部分                       | `{ enableWatermark, watermarkText, enableWebp }`        |
| `routing`          | json                                           | —                                           | 新增:自定义路由/反代规则                                |
| `allowedDomains`   | json                                           | `Setting.https`                             | Caddy on-demand TLS 白名单(prod/dev 镜像)                    |
| `revisions`        | json                                           | —                                           | 新增:应用内历史配置 `{ enabled, retention }`            |
| `output`           | json                                           | —                                           | 新增:markdown 导出配置 `{ enabled, format, dest, ... }` |
| `sync`             | json                                           | —                                           | 新增:外部 git 同步 `{ enabled, remote, schedule, ... }` |

**`info` JSON 结构**(来自原 `siteInfo`,消除 `'true'/'false'` 字符串):

```json
{
  "siteName": "",
  "siteDesc": "",
  "author": "",
  "authorLogo": "",
  "authorLogoDark": "",
  "authorDesc": "",
  "siteLogo": "",
  "siteLogoDark": "",
  "favicon": "",
  "since": "2024-01-01",
  "baseUrl": "",
  "beianNumber": "",
  "beianUrl": "",
  "gaBeianNumber": "",
  "gaBeianUrl": "",
  "gaBeianLogoUrl": "",
  "payAliPay": "",
  "payWechat": "",
  "payAliPayDark": "",
  "payWechatDark": "",
  "copyrightAggreement": "",
  "defaultTheme": "auto",
  "enableCustomizing": false,
  "showSubMenu": false,
  "subMenuOffset": 0,
  "headerLeftContent": "siteLogo",
  "showAdminButton": true,
  "showDonateInfo": false,
  "showFriends": true,
  "showCopyRight": true,
  "showDonateButton": false,
  "showDonateInAbout": false,
  "allowOpenHiddenPostByUrl": false,
  "showRSS": true,
  "openArticleLinksInNewWindow": false,
  "showExpirationReminder": true,
  "showEditButton": false
}
```

**`routing` JSON 结构**(替代 CustomPage):

```json
[
  {
    "type": "proxy",
    "from": "/api/internal/*",
    "to": "http://localhost:3000/*"
  },
  { "type": "redirect", "from": "/old-path", "to": "/new-path", "code": 301 },
  { "type": "rewrite", "from": "/custom/*", "to": "/static/*" }
]
```

**Rule**:

- List/View: 公开(`""`)
- Create/Update/Delete: `@request.auth.role = "admin"`

**初始化**:首次启动时由 pb migration 插入 id=1 的默认行。

---

### 2.8 `visits` — 访问计数(合并 Viewer + Visit)

对应原表:`Viewer` + `Visit`(双表合并)

**设计**:通过 `path` 字段是否为空区分 —— `path=""` 表示全站聚合行。

| 字段            | pb 类型                           | 原字段            | 说明           |
| --------------- | --------------------------------- | ----------------- | -------------- |
| `date`          | text(required, format YYYY-MM-DD) | `date`            |                |
| `path`          | text(default "")                  | `pathname`        | 空表示全站聚合 |
| `views`         | number(default 0)                 | `visited`         |                |
| `uniques`       | number(default 0)                 | `viewer`          | UV             |
| `post`          | relation(single → `posts`)        | —                 | 关联文章       |
| `lastVisitedAt` | date                              | `lastVisitedTime` |                |
| —               | pb 内置 `created`                 |                   | autodate       |

**唯一索引**:`(date, path)` 组合唯一。

**Hook**:

- `OnRecordCreateRequest("visits")`:如果是文章级记录,同步累加 `posts.viewCount`
- 定时任务:每天结束生成全站聚合行(`path = ""`)

**Rule**:

- Create: 公开(前台埋点)
- List/View/Update/Delete: `@request.auth.id != ""`

---

### 2.9 `audits` — 审计日志(替代 logins)

> **修订**:原设计为 `logins` 表,routing-strategy 决策扩展为通用 `audits`(登录、路由变更、配置修改等所有审计事件)。

| 字段        | pb 类型                    | 说明                                                                 |
| ----------- | -------------------------- | -------------------------------------------------------------------- |
| `actor`     | relation(single → `users`) | 操作者                                                               |
| `action`    | text                       | "auth.login" / "routing.add" / "routing.delete" / "config.update" 等 |
| `target`    | text                       | 操作对象(路由 id / 域名 / 配置字段)                                  |
| `result`    | select(success/failure)    | 结果                                                                 |
| `detail`    | json                       | 错误详情 / diff / 额外信息                                           |
| `ip`        | text                       |                                                                      |
| `userAgent` | text                       |                                                                      |
| —           | pb 内置 `created`          | autodate                                                             |

**Rule**:

- Create: 由 hook 写入
- List/View/Delete: `@request.auth.role = "admin"`

---

### 2.10 `tokens` — API Token

对应原表:`Token`

| 字段        | pb 类型                              | 原字段          |
| ----------- | ------------------------------------ | --------------- |
| `name`      | text                                 | `name`          |
| `tokenHash` | text(unique, required)               | `token`(存哈希) |
| `user`      | relation(single → `users`, required) | `userId`        |
| `expiresAt` | date                                 | `expiresIn`     |
| `disabled`  | bool(default false)                  | `disabled`      |

**Rule**:全部 `@request.auth.role = "admin"`。

---

## 3. 迁移映射速查表

| 原表               | → 新 collection                   | 关键字段映射                                      |
| ------------------ | --------------------------------- | ------------------------------------------------- |
| `User`             | `users`                           | `name`→`username`, `type`→`role`, 内置 `password` |
| `Article`          | `posts` (status=published/hidden) | `viewer`→`viewCount`, relation 化                 |
| `Draft`            | `posts` (status=draft)            | 同上,oldId 加偏移                                 |
| `Category`         | `categories`                      | 字段同名                                          |
| —(tags 内嵌)       | `tags` + `posts.tags` relation    | 拆分,无关联表                                     |
| —(新增)            | `revisions`                       | 应用内历史(不迁移)                                |
| `Meta`(单文档)     | `site`(单行)                      | **JSON 字段直接序列化**                           |
| `Setting`          | 并入 `site`                       | 各 type 字段展开到 site                           |
| `Static`           | `media`                           | `realPath/name`→`file`, `picgo`→`s3`              |
| `Viewer` + `Visit` | `visits`                          | 合并,`path=""` 表示全站                           |
| `Token`            | `tokens`                          | `token`→`tokenHash`, `userId`→`user` relation     |
| `Pipeline`         | —(不入库)                         | ✂️ 完全砍掉                                       |
| `CustomPage`       | —(不入库)                         | ✂️ 改用 Astro `src/pages/`                        |

---

## 4. pb_hooks 事件映射(仅必要钩子)

> Pipeline 已完全砍掉。此处只列**系统必要钩子**,不是用户可配置的"流水线"。

| 钩子(pb 0.39 验证)                                 | 用途                                                |
| -------------------------------------------------- | --------------------------------------------------- |
| `OnRecordUpdateRequest("posts")` before `e.Next()` | 写入 `revisions` 表(旧版本快照)                     |
| `OnRecordUpdateRequest("posts")` after `e.Next()`  | 可选:触发 `site.output` markdown 导出               |
| `OnRecordCreateRequest("visits")` after `e.Next()` | 累加 `posts.viewCount`                              |
| `OnRecordAuthRequest("users")`                     | 写入 `audits` 表(action='auth.login')               |
| `cronAdd`(JSVM) / 定时任务(Go)                     | 每日生成 `visits` 全站聚合行 + `site.sync` git push |

> **注意**: `app.Save()` 触发的是 model-level hooks (`OnRecordCreate` / `OnRecordUpdate`),
> 不是 HTTP-level hooks (`OnRecordCreateRequest` / `OnRecordUpdateRequest`)。
> revisions 快照必须在 HTTP-level 写(能拿到 API 请求上下文 + before/after 区分)。
> model-level hooks 适合不依赖请求的内部逻辑(如 visits 计数由 Go 层 Save 触发)。

---

## 5. 待决细节

1. **pb FileField 存储后端**:prod 镜像默认 local,dev 镜像可选 S3
2. **加密文章密码**:明文迁移,Admin UI 不展示
3. **media.file 的 thumbs**:pb 原生支持,水印/WebP 移到前端 WASM
4. **`revisions` 的 diff 生成**:可选 Go 库(`github.com/sergi/go-diff`)在 hook 中生成
