# Vanblog 原项目调研

> 本文档作为 Vanblog 重构(PocketBase + Astro)的事实基础。
> 所有后续设计决策(pb schema、功能裁剪、迁移路径、前端外挂机制)都应以本文档为依据。
> 信息来源:GitHub `Mereithhh/vanblog` master 分支 README、官方文档站 `vanblog.mereith.com`、`docs/reference/api.md`(截至 2024-09)。

---

## 1. 项目定位

> 一款简洁、实用、优雅的个人博客系统。

核心卖点:

- All in One 单容器部署,内置 HTTPS / 图床 / 评论 / 统计
- 静态化(SSG) + 秒级增量渲染,Lighthouse 接近满分
- 数据私密性(自托管,不依赖第三方 SaaS)
- 个人用途为主,二次开发友好

---

## 2. 技术栈(原项目)

| 层       | 选型                         | 备注                            |
| -------- | ---------------------------- | ------------------------------- |
| 前端框架 | React                        | "基于 React,项目工程化"         |
| 渲染策略 | SSG + ISR(增量静态再生)      | 秒级增量,无需全量重建           |
| 包管理   | pnpm + workspace             | monorepo                        |
| 编辑器   | ByteMD(与掘金同款)           | 支持 mermaid / 数学公式 / Emoji |
| 图片上传 | picgo 集成                   | 外置插件式,本地/OSS/GitHub      |
| 反向代理 | Caddy v2                     | 内部服务网格,自动 HTTPS         |
| 数据库   | MongoDB(默认 `mongo:4.4.16`) | K8s 可外接                      |
| 部署     | Docker / 一键脚本            | 支持 ARM                        |

**架构特点**:容器内多个微服务 + Caddy 反向代理。对外只暴露 HTTP/HTTPS 端口,内部 Caddy 不需要用户感知。

---

## 3. 功能矩阵(原项目)

### 3.1 内容管理

- 草稿 / 发布
- 分类(Category)
- 标签(Tag)
- 全文搜索
- 目录(TOC)
- 自定义文章路径(SEO 友好 URL)
- 加密文章(密码访问)
- 阅读量统计

### 3.2 编辑器

- Markdown(ByteMD)
- Mermaid 图表
- 数学公式
- Emoji 选择器
- "更多"标记(`<!-- more -->`)插入
- 剪贴板/本地图片一键上传
- 自定义高亮块语法

### 3.3 图床系统(核心卖点之一)

- 本地图床
- OSS 图床(阿里云等)
- GitHub 图床
- 通过 **picgo** 外挂其他图床
- 上传自动水印
- 上传自动压缩

### 3.4 评论系统

- 内嵌评论(自建,非 Disqus)
- 评论数展示

### 3.5 统计分析

- 内置访客统计
- 精美数据看板
- 登录日志
- Caddy 日志查看
- 百度统计集成
- Google Analytics 集成

### 3.6 鉴权与协作

- 管理员账户
- 协作者模式(自定义权限)
- 登录日志
- Token 管理(API 访问)
- Swagger API 文档(后台入口)

### 3.7 HTTPS 与安全

- Caddy 自动按需申请证书(无需预填域名)
- 自动续期
- 文章加密

### 3.8 定制化

- 自定义 HTML / CSS / JS 注入
- 自定义页面
- 强大的"流水线"功能(管道式数据处理)
- 多布局可选
- 主题与插件(官方标注"未来支持",截至调研时未完全落地)

### 3.9 SEO

- 自定义文章 URL
- 结构化数据
- Lighthouse SEO 近满分
- RSS 订阅

### 3.10 部署与运维

- Docker 一键部署
- 一键脚本部署(裸机)
- K8s 部署(通过 `VAN_BLOG_DATABASE_URL` 接外部 Mongo)
- ARM 架构支持
- 版本号展示与更新提醒
- 数据导入/导出

### 3.11 REST API

- 完整 REST API(供自定义前端/SSG 生成器使用)
- Swagger 文档
- Token 鉴权
- `public` 标签下的接口免鉴权

---

## 4. 资源占用基线(供重构对标)

| 指标         | 原项目                             |
| ------------ | ---------------------------------- |
| 内存         | < 400MB(含静态页面缓存,不含 Mongo) |
| CPU 启动峰值 | 单核 ~30%                          |
| CPU 稳态     | 接近 0                             |
| 端口         | 80 / 443                           |

> 重构后目标:由于去掉了 Mongo(改 SQLite)、去掉了 Caddy 内部网格、Astro 构建产物更轻,**内存应显著低于 400MB**。

---

## 5. 数据模型(源码核对版)

> 已通过 git worktree 检出 `upstream-baseline` 分支,直接读取 `packages/server/src/scheme/*.schema.ts` 得到真实字段。Worktree 路径:`/Users/corn/Code/vanblog-upstream`。

### 真实 schema 清单(11 张 Mongoose 表)

| 表名           | 文件                   | 关键字段                                                                                                                                                                                                         | 说明                                                 |
| -------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Article**    | `article.schema.ts`    | `id`(unique), `title`, `content`, `tags[]`, `top`, `category`, `hidden`, `author`, `pathname`, `private`, `password`, `deleted`, `viewer`, `visited`, `copyright?`, `lastVisitedTime?`, `createdAt`, `updatedAt` | 已发布文章,包含阅读量、加密、置顶、自定义路径        |
| **Draft**      | `draft.schema.ts`      | `id`(unique), `title`, `content`, `tags[]`, `author`, `category`, `deleted`, `createdAt`, `updatedAt`                                                                                                            | 草稿,**独立表**,与 Article 分离                      |
| **Category**   | `category.schema.ts`   | `id`(unique), `name`(unique), `type: CategoryType`(默认 `'category'`), `private`, `password`, `meta?: Mixed`                                                                                                     | `type` 字段暗示承担多种角色(分类/导航/链接组)        |
| **Meta**       | `meta.schema.ts`       | `links[]`, `socials[]`, `menus[]`, `rewards[]`, `about {updatedAt, content}`, `siteInfo`, `viewer`, `visited`, `categories[]`, `totalWordCount`                                                                  | **单文档**聚合所有站点元数据,内嵌 4 种 LinkItem 数组 |
| **CustomPage** | `customPage.schema.ts` | `name`(unique), `path`(unique), `type: CustomType`(默认 `'file'`), `html`, `createdAt`, `updatedAt`                                                                                                              | 自定义页面,支持 html/file 两种类型                   |
| **Pipeline**   | `pipeline.schema.ts`   | `id`(unique), `name`, `eventType: VanblogEventType`, `description`, `enabled`, `deps[]`, `eventName`, `script`, `deleted`, `createdAt`, `updatedAt`                                                              | 用户可编辑的 JS 脚本,通过事件触发                    |
| **Static**     | `static.schema.ts`     | `staticType: StaticType`(默认 `'img'`), `storageType: StorageType`(默认 `'local'`), `fileType`, `realPath`, `meta: Mixed`, `name`, `sign`, `updatedAt`                                                           | 图床文件表,`sign` 是 MD5 去重签名                    |
| **Setting**    | `setting.schema.ts`    | `type: SettingType`(unique), `value: Mixed`                                                                                                                                                                      | 通用配置 KV 表,按 type 存 JSON                       |
| **User**       | `user.schema.ts`       | `id`(unique), `name`, `password`, `createdAt`, `type: 'admin' \| 'collaborator'`, `nickname?`, `permissions?: Permission[]`, `salt`                                                                              | 用户表,密码 salt+hash                                |
| **Token**      | `token.schema.ts`      | `userId`, `token`, `name?`, `expiresIn`, `createdAt`, `disabled`                                                                                                                                                 | API Token,独立于 session                             |
| **Viewer**     | `viewer.schema.ts`     | `visited`, `viewer`, `date`, `createdAt`                                                                                                                                                                         | 全站每日访问计数                                     |
| **Visit**      | `visit.schema.ts`      | `visited`, `viewer`, `date`, `pathname`, `lastVisitedTime`, `createdAt`                                                                                                                                          | 按路径的每日访问计数                                 |

### 关键发现

1. **Article/Draft 双表** —— 字段差异大(Article 多 12 个字段),非简单状态区分,迁移时需注意
2. **没有独立 Tag 表** —— 标签是 `string[]` 内嵌 Article
3. **没有 Comment 表** —— 评论由内嵌的 Waline 进程管理,使用**独立 Mongo 库** `config.walineDB`(见 `waline.provider.ts`)
4. **Meta 是单文档** —— 所有站点配置(links/socials/menus/rewards/about/siteInfo)塞在一个 Mongo document 里
5. **Pipeline 是重型功能** —— 完整的 fork 子进程执行 + `pnpm add` 依赖管理(266 行实现,见 `pipeline.provider.ts`)
6. **双计数体系** —— `Article.viewer/visited`(单篇)+ `Viewer/Visit`(时序聚合)+ `Meta.viewer/visited`(全站累计),三处冗余
7. **Static 表使用 MD5 去重**(`sign` 字段)—— 上传前先 `getOneBySign` 查重

### 不存在的实体(原推断错误)

- ❌ Comment(评论在 Waline 独立库)
- ❌ LoginLog(虽有 README 提及,但 schema 目录无对应文件)
- ❌ AnalyticsEvent(统计由 Viewer/Visit 表 + AnalysisProvider 聚合实现,无独立事件表)

---

## 6. 已知的历史决策与遗留问题

1. **主题/插件未落地**:原项目 README/官网多次提到"未来将支持",但到调研时点未见成熟生态。重构时应明确:是否真的要做主题/插件系统?还是通过"外挂 Astro 前端"替代?
2. **MongoDB 版本固定 4.4**:因为部分机器不支持 AVX。重构换 SQLite 后此问题消失。
3. **Caddy 内部服务网格**:是原项目"微服务架构"的产物。重构后 PocketBase 单二进制 + Astro,理论上不需要 Caddy(除非仍要自动 HTTPS)。
4. **自动 HTTPS 是核心卖点**:Caddy 的 on-demand TLS(无需预填域名)是 Vanblog 的差异化能力。**重构方案必须明确 HTTPS 由谁负责**(宿主机 Caddy?Traefik?PocketBase 自带?还是交给用户?)。

---

## 7. 重构需重点回答的问题

以下是 README 中尚未闭合、但本文档已提供调研依据的核心问题:

| 问题                   | 本文档提供的依据                                       |
| ---------------------- | ------------------------------------------------------ |
| 哪些后端功能保留/裁剪? | 第 3 节功能矩阵 — 作为裁剪决策的候选清单               |
| pb schema 怎么设计?    | 第 5 节推断数据模型 — 作为 schema 起草起点             |
| 自动 HTTPS 怎么办?     | 第 6.3 / 6.4 节 — 必须在方案里明确替代方案             |
| 评论系统要不要自建?    | 第 3.4 节 — pb 没有,需要外挂或自建或砍掉               |
| 图床怎么迁移?          | 第 3.3 节 — picgo 是 Node 生态,Astro/pb 环境下需要替代 |
| 统计要不要保留?        | 第 3.5 节 — 可用轻量方案(Umami / Plausible)替代自建    |

---

## 8. 下一步

基于本文档,在 `docs/` 下继续产出:

- `pb-schema-design.md` — PocketBase collections 详细设计
- `feature-decision-matrix.md` — 保留 / 裁剪 / 替代 的三列表格 + 理由
- `migration-path.md` — 从原 Mongo 数据迁移到 pb 的方案
- `https-strategy.md` — 自动 HTTPS 的替代方案选型
