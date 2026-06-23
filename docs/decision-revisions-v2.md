# 决策修订 v2(已归档)

> **状态**:✅ ARCHIVED —— 全部修订已合并到正式文档。
>
> **⚠️ 本文件不再维护**,内容可能已过时。实施时**请以下列正式文档为准**:
>
> - [`feature-decision-matrix.md`](./feature-decision-matrix.md) — 功能决策(含 Waline / Pipeline / picgo / 主题 / 表名 / CustomPage / 版本控制)
> - [`pb-schema-design.md`](./pb-schema-design.md) — Schema(含 audits 替代 logins / tags relation 数组 / site 单行表)
> - [`migration-path.md`](./migration-path.md) — 迁移路径(含三独立开关 / CustomPage 导出)
> - [`https-strategy.md`](./https-strategy.md) — HTTPS(prod/dev 都用 Caddy on-demand TLS)
> - [`routing-strategy.md`](./routing-strategy.md) — 路由(Caddy + vanblog 中间层)
> - [`deployment-strategy.md`](./deployment-strategy.md) — 部署(双镜像多阶段构建 + vanblog.sh)
>
> 本文件保留作为决策溯源记录,不再同步更新。

---

## 修订清单

| #   | 反馈点                 | 原决策                                 | 新决策                                                     | 影响文档                    |
| --- | ---------------------- | -------------------------------------- | ---------------------------------------------------------- | --------------------------- |
| 1   | 标签做成 pb collection | `tags` + `post_tags` + posts.tags 冗余 | ✅ 保留 `tags` + `post_tag`,**砍掉 `posts.tags` 冗余数组** | schema                      |
| 2   | 评论系统选型           | ✂️ 砍 Waline / 🔌 外挂                 | 🔁 **Waline 仍是首选外挂**,支持多种数据源                  | decision-matrix / migration |
| 3   | picgo S3 类接口        | ✂️ 砍 picgo                            | 🔁 **picgo 提供 S3 插件**,可平滑迁移到 pb S3 provider      | decision-matrix / migration |
| 4   | 图片处理位置           | 水印/WebP 移到 Astro 构建期            | 🔁 **前端 WASM 处理**(Photon/Squoosh)+ pb Go extend 可选   | decision-matrix             |
| 5   | 主题系统               | 🔁 外挂 Astro 前端(宽泛)               | ✅ **明确主题 = Astro 项目级配置**,支持运行时切换          | decision-matrix / schema    |
| 6   | 表名精简               | 长驼峰名(users/posts/categories 等)    | ✅ **短名**(users/posts/cats/tags/...)                     | schema                      |
| 7   | Pipeline 去留          | 🔁 用 pb_hooks 替代                    | ✂️ **完全砍掉**,不提不替代不迁移                           | decision-matrix / migration |
| 8   | config 表重新出方案    | `site_config` 单行 + 4 个展开表        | 🔄 **单表 `site` JSON 字段 + 展开表只在需要时**            | schema / migration          |

---

## 1. 标签 — 砍掉 posts.tags 冗余

**原设计**(schema §2.2):

```
posts.tags: relation(multiple → tags)   ← 冗余
post_tags: 关联表(post, tag)           ← 主表
```

**问题**:同时维护两处,数据一致性负担。

**修订**:

```
tags: 标签表(name, slug, description, oldName)
post_tag: 关联表(post → posts, tag → tags)  ← 唯一索引 (post, tag)
posts: 无 tags 字段
```

**查询**:

- 列出某篇文章的标签:`/api/collections/post_tag/records?filter=post='xxx'&expand=tag`
- 列出某标签下的文章:反向查询,同上
- 标签云:直接查 `tags` 表 + 聚合 `post_tag` 计数(pb 支持 `@request` 规则)

---

## 2. 评论系统选型 — Waline 仍是首选(外挂)

> LeanCloud 2027 年 1 月关停,但不影响 Waline 本身。Waline 支持多种数据源,官方已移除 LeanCloud 引用。

### Waline 数据源现状

| 数据源          | 状态            | 推荐度 |
| --------------- | --------------- | ------ |
| LeanCloud       | 🚫 2027-01 关停 | ❌     |
| Vercel Postgres | ✅ 官方推荐     | ⭐⭐⭐ |
| MySQL           | ✅              | ⭐⭐   |
| PostgreSQL      | ✅              | ⭐⭐⭐ |
| MongoDB         | ✅              | ⭐⭐   |
| Redis           | ✅(仅缓存)      | ⚠️     |
| TiDB            | ✅              | ⭐⭐   |
| Cloudflare D1   | ✅              | ⭐⭐   |
| SQLite          | ✅              | ⭐⭐   |

**关键洞察**:Waline 支持 SQLite。**这意味着可以把 Waline 与 pb 放在同一个 SQLite 文件里**(不同表前缀),大幅简化部署。

### 新决策

**✅ Waline 仍是首选评论系统**,但形态从"内嵌子进程"改为"独立容器 + 共享 SQLite":

```
docker-compose:
  - vanblog (pb + Astro)
  - waline (独立容器,SQLite 挂载到 vanblog 数据卷)
```

**迁移路径**:

- 原 Vanblog 用户的 Waline 数据在独立 Mongo 库 → Waline 官方迁移工具(支持跨数据源)
- 新部署的 Waline 用 SQLite,数据与 pb 共存,备份一体化
- vanblog 后台只存 `site.commentsConfig`(waline serverUrl / jwtToken)

**备选方案**(用户可选):

- **Giscus**(GitHub Discussions 驱动,零后端)— 适合技术博客
- **Artalk**(自托管,轻量)— Waline 替代
- **Disqus**(商用)— 不推荐(隐私/广告)

`site.commentsProvider` 枚举扩展为:`disabled / waline / giscus / artalk / external`

---

## 3. picgo S3 类接口 — 平滑迁移

### 事实核查

**picgo 生态提供 S3 兼容插件**:

- [`picgo-plugin-s3`](https://github.com/wayjam/picgo-plugin-s3) — 通用 S3 插件(AWS S3 / Cloudflare R2 / MinIO / 阿里云 OSS / 腾讯 COS / 七牛 / 又拍云)
- picgo 官方原生支持:阿里云 OSS、腾讯云 COS、七牛、又拍云、GitHub、Imgur
- **所有云存储厂商都有 S3 兼容 API**(阿里云 OSS、腾讯 COS、Cloudflare R2、MinIO 等)

### 新决策

**🔁 图床策略:pb S3 provider 替代 picgo,用户无感**:

| 原项目                        | 新方案                                               |
| ----------------------------- | ---------------------------------------------------- |
| picgo + 本地插件 → 阿里云 OSS | pb S3 provider 直连阿里云 OSS(S3 兼容)               |
| picgo + GitHub 图床           | pb S3 provider + Cloudflare R2 / GitHub releases API |
| picgo + 自建 MinIO            | pb S3 provider + MinIO(原生 S3)                      |

**迁移**:

- 用户在 picgo 中配置的 `endpoint/bucket/accessKey/secretKey` 几乎可以原样填入 pb S3 provider 配置
- pb S3 文档:https://pocketbase.io/docs/files/#s3-storage
- `file.storageType` 枚举:`local / s3`(原 `picgo` 改为 `s3`)

**裁剪项**:

- ✂️ picgo 本身(Node 生态,不入 pb)
- ✂️ picgo 插件机制(用户直接用 pb S3 配置)

---

## 4. 图片处理 — 前端 WASM + pb Go extend

### 4.1 前端 WASM 方案成熟度(事实核查)

**Photon.rs**(Rust + WASM):

- ⭐ 3.2k stars,活跃维护
- 性能对标 libvips,超越 ImageMagick
- 浏览器端原生级性能
- 支持水印、压缩、格式转换

**Squoosh**(Google 出品):

- 浏览器端图片压缩官方参考实现
- 支持 WebP / AVIF / MozJPEG
- 已被广泛用于生产环境

**browser-image-compression**(JS):

- 纯 JS,无 WASM 依赖
- 适合简单压缩场景

### 4.2 pb 的图片处理能力

**事实核查**:

- pb_hooks JSVM:**无图片处理能力**(JSVM 是纯 JS 沙箱,无文件 I/O)
- pb Go extend:**完整能力**(Go 原生 image 包 + 第三方库),社区有 [水印实现示例](https://github.com/pocketbase/pocketbase/discussions/5836)
- pb 本身:`FileField` 支持 thumbs 生成(内置)

### 4.3 新决策

**两层架构**:

```
前端上传前 → WASM 处理(水印 + WebP + 压缩) → 上传 → pb 存原始 + 生成 thumbs
```

| 场景             | 位置             | 技术                                |
| ---------------- | ---------------- | ----------------------------------- |
| 上传时水印       | 前端             | Photon.rs / Canvas API              |
| 上传时 WebP 压缩 | 前端             | Squoosh / browser-image-compression |
| 运行时缩略图     | pb               | FileField thumbs 内置               |
| 运行时格式转换   | pb Go extend     | 复杂场景可选(v0.2+)                 |
| 批量重新加水印   | pb Go extend CLI | 管理员工具                          |

**影响迁移**:

- 原项目水印/WebP 配置迁移到前端配置(`site.imageConfig: { enableWatermark, watermarkText, enableWebp }`)
- 存量图片不变(决策同 v1),新上传走新流程

---

## 5. 主题系统 — 明确为 Astro 项目级配置

### 5.1 Astro 主题能力(事实核查)

**Astro 原生支持**:

- 主题作为 npm 包(`@vanblog/theme-xxx`)
- 主题作为 git submodule / 子目录
- 运行时主题切换(CSS 变量 + `data-theme` 属性)
- Astro integration API(主题可注册自定义集成)

**社区参考**:

- [`astro-theme-switcher`](https://github.com/jonnysmillie/astro-theme-switcher):运行时多主题切换,token 化设计系统
- Astro 官方 [Themes & Integrations](https://astro.build/themes/)

### 5.2 新决策:主题 = Astro 项目级模板

**三层可定制性**:

| 层级                   | 用户操作                               | 技术形态                         |
| ---------------------- | -------------------------------------- | -------------------------------- |
| **L1: 内置主题**       | 后台选 `default / minimal / magazine`  | Astro 配置切换 CSS 变量 + layout |
| **L2: 自定义 CSS/JS**  | 后台填 `site.customCss / customScript` | Astro layout slot 注入           |
| **L3: 完全自定义前端** | 外挂整个 Astro 项目                    | dev 镜像构建 + 切换 prod 模式    |

**与 README 一致性**:

> README 第 48-51 行的"前端外挂"= L3
> 决策矩阵 #28 "主题系统"= L1 + L2
> 两者是不同层级,不冲突

**schema 影响**:

- `site.theme` 字段(select: default/minimal/magazine/custom)
- `site.customCss / customHead / customScript / customHtml` 字段(已存在于 v1)

**外挂机制**(L3 细化):

- dev 镜像内,Astro 项目位于 `/app`
- 用户挂载 `/app/src` 到宿主机,直接改源码
- 提供构建脚本 `vanblog build`,输出静态资源到 `/vanblog/dist`
- 切换 prod 模式时,优先加载 `/vanblog/dist`(用户产物),fallback 到内置 `/app/dist`

---

## 6. 表名精简 — 行业惯例版

### 设计原则

1. **集合名用复数**(REST + pb 惯例):`/api/posts`、`/api/tags`
2. **用全词,不强行缩写**:`categories` 是对的,`cats` 是自造词;`media` 是行业通用词
3. **真正需要精简的是复合词**:`custom_pages`、`site_config`、`api_tokens` 这种"修饰词+名词"才是冗长来源
4. **移除下划线复合,用更短的等价全词**:`friend_links` → `links`,`login_log` → `logins`

### 最终表名

```
auth:     _superusers, users
content:  posts, categories, tags, post_tags, pages
config:   site(单行)
media:    media
stats:    visits, logins
api:      tokens
```

### 逐项变更理由

| v1 名称        | v2 名称               | 变更类型 | 理由                                 |
| -------------- | --------------------- | -------- | ------------------------------------ |
| `users`        | `users`               | 不变     | 已是惯例                             |
| `posts`        | `posts`               | 不变     | 已是惯例                             |
| `categories`   | `categories`          | **回退** | `cats` 是自造词,行业无此用法         |
| `tags`         | `tags`                | 不变     | 已是惯例                             |
| `post_tags`    | `post_tags`           | **回退** | 复数表关联,比 `post_tag` 更一致      |
| `custom_pages` | `pages`               | 精简复合 | `custom_` 前缀冗余,`pages` 已够      |
| `site_config`  | `site`                | 精简复合 | 单行表不需要 `_config` 后缀          |
| `nav_menus`    | (并入 `site.nav`)     | 移除     | 数组放 JSON 字段更合适               |
| `friend_links` | (并入 `site.links`)   | 移除     | 同上                                 |
| `socials`      | (并入 `site.socials`) | 移除     | 同上                                 |
| `rewards`      | (并入 `site.rewards`) | 移除     | 同上                                 |
| `media`        | `media`               | **回退** | `media` 是行业通用词,`file` 反而歧义 |
| `site_visits`  | `visits`              | 精简复合 | `site_` 前缀冗余                     |
| `login_log`    | `logins`              | 复数惯例 | log/audit 类表统一复数               |
| `api_tokens`   | `tokens`              | 精简复合 | `api_` 前缀冗余                      |

### 对比常见开源博客系统

| 系统           | 文章表                 | 分类表       | 标签表           |
| -------------- | ---------------------- | ------------ | ---------------- |
| WordPress      | `wp_posts`             | `wp_terms`   | `wp_terms`(共用) |
| Ghost          | `posts`                | `tags`(扁平) | `tags`           |
| Hashnode       | `posts`                | `tags`(扁平) | `tags`           |
| Strapi CMS     | `posts`(用户命名)      | `categories` | `tags`           |
| Directus       | 用户命名(惯例 `posts`) | `categories` | `tags`           |
| **vanblog v2** | `posts`                | `categories` | `tags`           |

**结论**:v2 表名与主流 CMS/博客系统对齐,无怪异自造词。

---

## 7. Pipeline — 完全砍掉

**确认**:Pipeline 功能**完全砍掉**,不做替代、不做迁移、不写入文档(除了用户指南中的"pb_hooks 可实现类似效果"一句提示)。

**影响**:

- `pb-schema-design.md` §4 "pb_hooks 事件映射"表删除
- `feature-decision-matrix.md` #8 改为 ✂️
- `migration-path.md` §4 不迁移项中 Pipeline 行保留但标注"已确认裁剪"

---

## 8. Config 表重新设计

### v1 的问题

v1 把原 `Meta` 单文档**过度展开**为 5 张表(`site_config` + `nav_menus` + `friend_links` + `socials` + `rewards`),导致:

- 简单 CRUD 要查 5 张表
- 关联表关系复杂
- 违背"原项目单文档读写"的简单模型

### 新设计:单表 + JSON 字段

**只有一张表 `site`**,永远只有一行(id=1):

| 字段               | pb 类型                                        | 说明                                                      |
| ------------------ | ---------------------------------------------- | --------------------------------------------------------- |
| `info`             | json                                           | 站点基本信息(原 siteInfo 标量字段)                        |
| `theme`            | select(default/minimal/magazine/custom)        | 主题                                                      |
| `commentsProvider` | select(disabled/waline/giscus/artalk/external) | 评论 provider                                             |
| `commentsConfig`   | json                                           | 评论配置(waline serverUrl / giscus repo 等)               |
| `analyticsScript`  | text                                           | 统计脚本注入(Umami/Plausible/GA)                          |
| `nav`              | json                                           | 导航菜单数组(原 Meta.menus)                               |
| `links`            | json                                           | 友链数组(原 Meta.links)                                   |
| `socials`          | json                                           | 社交数组(原 Meta.socials)                                 |
| `rewards`          | json                                           | 打赏数组(原 Meta.rewards)                                 |
| `about`            | json                                           | 关于页面 `{ content, updatedAt }`                         |
| `customize`        | json                                           | 自定义注入 `{ head, css, html, script }`                  |
| `imageConfig`      | json                                           | 图片处理 `{ enableWatermark, watermarkText, enableWebp }` |
| `allowedDomains`   | json                                           | Caddy on-demand TLS 白名单(dev 镜像用)                    |

### 设计理由

1. **对齐原项目**:原 `Meta` 就是单文档,新 `site` 也是单行,读写模型一致
2. **JSON 字段灵活**:pb 的 JSON 字段支持任意结构,未来加字段不用 migration
3. **避免过度归一化**:友链/社交这种 5-10 条的数据,放数组比建表更实用
4. **Rule 简单**:整表 `@request.auth.role = "admin"` 才能写,公开只读

### 查询示例

```
# 前台获取站点配置(一次请求拿到全部)
GET /api/collections/site/records/1

# 后台修改导航菜单
PATCH /api/collections/site/records/1
{ "nav": [{"name": "首页", "value": "/"}, ...] }
```

### 迁移影响

**v1 的六阶段迁移** → **v2 一阶段**:

- 原 `Meta` 单文档直接序列化为各 JSON 字段
- 不再需要展开到关联表
- 迁移代码量减半

---

## 9. CustomPage — 砍掉数据库表,用 Astro 原生

### 原项目实际做了什么

从 `customPage.controller.ts` + `customPage.schema.ts` 看:

- `type: 'file' | 'folder'` —— 支持单文件或目录
- 上传 HTML/静态文件到 `/static/customPage/{path}/`(复用图床存储)
- 通过 `/c/{path}` URL 访问(Caddyfile 反代)
- **本质 = 一个简陋的静态文件服务器**

### 新决策

| 原方案           | 新方案                                |
| ---------------- | ------------------------------------- |
| 数据库表 `pages` | ✂️ **砍掉表**                         |
| HTML 字段存 DB   | ✂️ **砍掉字段**                       |
| `/c/{path}` URL  | ✅ **Astro `src/pages/{path}.astro`** |
| 文件上传到图床   | ✅ **直接放 Astro 项目目录**          |

**Astro 原生页面路由**就是 CustomPage 的正确实现 —— 用户想要什么自定义页面,放一个 `.astro`/`.md`/`.html` 到 `src/pages/` 即可。

### 用户真实需求:自定义路由/反代规则

这才是 CustomPage 真正有价值的使用场景(用户反馈)。不在数据库里存 HTML,改为**配置化路由规则**,放在 `site.routing` JSON 字段:

```json
{
  "routing": [
    {
      "type": "proxy",
      "from": "/api/internal/*",
      "to": "http://localhost:3000/*"
    },
    { "type": "redirect", "from": "/old-path", "to": "/new-path", "code": 301 },
    { "type": "rewrite", "from": "/custom/*", "to": "/static/*" }
  ]
}
```

**生效路径**:

- dev 镜像:Caddyfile 模板根据 `routing` 生成 `route` / `reverse_proxy` / `redir` 指令
- prod 镜像:Astro middleware 在运行时解析 routing 配置
- 外置反代:文档提供 Caddy / Traefik / Nginx 配置生成脚本

### 迁移影响

- 原 `CustomPage.html` 内容 → 导出为独立 `.html` 文件,用户手动放入 Astro `src/pages/`
- 迁移文档提供"原 path → Astro 文件路径"的对照说明
- 原 `type: 'folder'` 的目录型 CustomPage → 用户直接挂载到 Astro `public/` 目录

---

## 10. 数据库不维护 file / html 内容

### 原则

**数据库不应该存 HTML / file 内容**(应该是文件系统或 git)。静态资源服务不是博客系统的核心职责。

### 原项目的问题

`static` 表(`staticType: 'img' | 'customPage'`)把图片、自定义页面 HTML、favicon 全塞一起,既是文件服务器又是 CMS,职责混乱。

### 新决策

| 数据                      | 存储位置                            |
| ------------------------- | ----------------------------------- |
| 文章 Markdown 源码        | `posts.content` (text) ✅           |
| 图片/附件二进制           | `media.file` (pb FileField) ✅      |
| 图片/附件元数据           | `media` 表的其他字段 ✅             |
| ~~自定义页面 HTML~~       | ✂️ 不入数据库,放 Astro `src/pages/` |
| ~~favicon / logo 二进制~~ | ✂️ 不入数据库,放 Astro `public/`    |
| 站点配置                  | `site` 表(JSON 字段) ✅             |

### 静态服务器问题

**不需要单独启**:

- Astro build → 静态文件(HTML/CSS/JS/图片)→ pb 通过 `FileField` 和 `public/` 目录直接 serve
- dev 镜像里 Caddy 做反代和 TLS,不承担静态服务
- 外置反代场景:用户已有反代(Nginx/Caddy/Traefik),vanblog 容器只暴露 HTTP

---

## 11. 版本控制 / md 输出 / 外部同步 — 三个独立问题

> **修订原因**:v1 把这三件事混为一个"文章历史版本"决策是错的。用户反馈点破了:
>
> - 输出 md 到外部应该是**用户可选开关**
> - 版本控制可以放 db 里
> - go-git vs git cli 需要明确选型
>
> 本节重新拆分为三个正交决策。

### 11.1 文章历史版本(应用内功能)— DB 模式

**问题**:用户在后台改文章,想要"撤销"或"查看上一版"。这是**应用内功能**,用户不应为此管理 git。

**调研**:pb 官方 [discussion #4006](https://github.com/pocketbase/pocketbase/discussions/4006) 推荐采用 WordPress 式 status='revision' 模式。

**决策:数据库表 `revisions`(轻量)**

```
revisions: {
  target:     relation(single → posts, required)   // 哪篇文章
  snapshot:   json                                   // 完整字段快照
  diff:       text                                   // 与上版的 unified diff(可选,加速渲染)
  authoredBy: relation(single → users)
  reason:     text                                   // "auto-save" / "manual" / "publish"
}
```

**机制**:

- `OnRecordBeforeUpdate("posts")` hook:把**旧版本**写入 `revisions`(新版本由正常 update 流程写入 posts)
- 后台 UI:`/admin/posts/{id}/revisions` 列出历史,点击"恢复"即将 snapshot 写回 posts
- **保留策略**:`site.revisionRetention`(默认 50 版/篇,或 90 天,LRU 清理)

**为什么不放 git**:

- 这是"应用状态",不是"内容分发" —— 用户不需要看到 commit message
- 恢复操作是 UI 一键完成,不需要 git 命令
- 数据库事务保证一致性,git 不提供
- 查询快(按 post_id 索引),git log 需要解析

**schema 影响**:➕ **保留 `revisions` 表**(与 v1 一致),只是明确为"应用内历史",不与外部同步混淆。

---

### 11.2 Markdown 外部输出 — 可选开关,用户决定

**问题**:README 第 43 行提到 `md_output`(markdown 单向同步,用于备份和迁移)。这是**内容导出**功能,不是版本控制。

**决策:用户可选的内容输出**

**配置**(`site.output` JSON 字段):

```json
{
  "output": {
    "enabled": false,
    "format": "markdown", // "markdown" | "json" | "both"
    "dest": "/vanblog/md_output", // 输出目录(挂载点)
    "include": ["posts", "categories"], // 导出哪些 collection
    "naming": "{oldId}-{slug}.md", // 文件命名规则
    "trigger": "onUpdate" // "onUpdate" | "cron" | "manual"
  }
}
```

**开关默认关闭** —— 新用户不需要,老 Vanblog 用户迁移时按需开启。

**实现**:

- `OnRecordAfterUpdate("posts")` hook:若 `site.output.enabled=true`,写文件到 `dest`
- **不涉及版本管理**(覆盖即可,没有 .git)
- 定时任务可做完整快照(`trigger: "cron"`)

**为什么独立于版本控制**:

- 这是"导出给别人看",不是"管理历史"
- 用户可能想要 markdown 但不想要 git
- 用户可能想要 git 但不想要 markdown

---

### 11.3 外部 git 同步 — 用户可选,用 git cli 不用 go-git

**问题**:部分用户希望整个博客内容同步到 GitHub 做多设备备份/迁移。

**决策:可选的外部 git 同步,用 git cli 不用 go-git**

#### go-git vs git cli 选型结论(调研)

| 维度           | go-git                  | git cli                              |
| -------------- | ----------------------- | ------------------------------------ |
| 功能完整性     | ~80%(无 LFS,SSH 弱)     | 100%                                 |
| 性能           | Go 实现,大仓慢          | C 优化,快                            |
| 外部依赖       | 无                      | 需要 `apk add git`(~20MB)            |
| 用户可直接交互 | ❌(API only)            | ✅(标准命令)                         |
| SSH 认证       | 有限(不支持硬件 key 等) | 完整(1Password agent / hardware key) |
| 适用场景       | 应用内部、内存操作      | 用户直接操作、外部同步               |

**关键事实**(来自 Pro Git 官方附录 + go-git README):

- go-git 是**纯 Go 重新实现**,不是 git cli 的 wrapper
- 官方明确:"git 是个庞大项目,go-git **很难实现所有功能**"
- go-git 适合:Gitea 内部、CI 流水线、Keybase、Pulumi —— **程序内部**的版本管理
- **go-git 不适合:用户会直接 git clone / git push 的仓库**

**结论**:**外部同步场景,git cli 完胜**。

#### 实现

- dev 镜像预装 git cli(`apk add git`)
- prod 镜像**默认不装**,用户通过 `site.sync.enabled=true` 触发"启用 git 同步"向导,提示重新部署为 dev 模式
- `site.sync` 配置:
  ```json
  {
    "sync": {
      "enabled": false,
      "remote": "git@github.com:user/blog-backup.git",
      "branch": "main",
      "schedule": "0 */6 * * *", // 每 6 小时 push 一次
      "sshKey": "/vanblog/secrets/id_rsa"
    }
  }
  ```
- **复用 11.2 的输出**:git sync 基于 `md_output` 目录,在其上 `git init` + cron push
- 用户也可直接 `git clone /vanblog/md_output` 本地操作

#### 为什么不用 go-git

- 用户期望"这是标准 git 仓库",用任何 git 工具都能操作
- SSH 认证复杂场景 go-git 支持不全
- git cli 性能更好
- git cli 的缺失功能对博客场景无关(LFS 不需要)

---

### 11.4 三者关系总结

```
┌─────────────────────────────────────────────────────────────┐
│  posts.content(pb 主存储)                                  │
└──────────┬──────────────────────┬─────────────────────────┘
           │                      │
           ▼                      ▼
   ┌───────────────┐      ┌──────────────────┐
   │ revisions 表  │      │ md_output 目录   │
   │ (应用内历史)  │      │ (可选,覆盖式)   │
   │  - 后台撤销   │      │  - 导出/备份     │
   │  - LRU 清理   │      │  - 用户可选开关  │
   └───────────────┘      └────────┬─────────┘
                                   │
                                   │ 可选
                                   ▼
                          ┌──────────────────┐
                          │ git cli + remote │
                          │ (可选,外部同步) │
                          │  - 多设备备份    │
                          │  - GitHub 镜像   │
                          │  - 用户 cron push│
                          └──────────────────┘
```

**三个独立开关**:

- `site.revisions.enabled`(默认 true)— 应用内历史
- `site.output.enabled`(默认 false)— markdown 导出
- `site.sync.enabled`(默认 false)— git 远程同步

**依赖关系**:`sync` 依赖 `output`(git 需要 md_output 目录作为工作树),其余独立。

**默认行为**:新部署只开启 `revisions`,其他两个关闭。老 Vanblog 用户迁移时可一并启用。

---

## 下一步

本 diff 确认后,我会:

1. 更新 `pb-schema-design.md`(表名、posts.tags 砍掉、site 重设计)
2. 更新 `feature-decision-matrix.md`(#7 Waline / #8 Pipeline / #10 picgo / #11 图片处理 / #28 主题)
3. 更新 `migration-path.md`(简化 Meta 迁移、评论数据迁移)
4. 新增 `docs/comments-system.md`(评论选型详细对比)
