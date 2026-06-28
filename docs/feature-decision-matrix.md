# 功能决策矩阵 v2

> **决策基调**(用户确认):现代化精简 + 数据兼容。保留数据模型兼容性(原 Vanblog 用户可带数据迁移),功能层基于 PocketBase / Astro 生态重做,遗留包袱砍掉或外挂。
>
> **依赖文档**:
>
> - [`vanblog-legacy-research.md`](./vanblog-legacy-research.md)(基于 `upstream-baseline` 源码核对)
> - [`decision-revisions-v2.md`](./decision-revisions-v2.md)(11 项修订依据)
>
> **决策符号**:✅ 保留 · 🔁 替代 · 🔌 外挂 · ✂️ 裁剪 · 📦 数据兼容

---

## 决策总览

| #   | 原项目功能                            | 决策  | 一句话理由                                                                                                  |
| --- | ------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| 1   | 文章(Article)+ 草稿(Draft)双表        | ✅ 📦 | 合并为 `posts` + `status` 字段                                                                              |
| 2   | 分类(Category)                        | ✅ 📦 | `categories` 表,`type` 保留                                                                                 |
| 3   | 标签(Tag)                             | ✅ 📦 | 独立 `tags` 表 + `posts.tags` relation 数组(pb 原生多对多,无关联表)                                         |
| 4   | 自定义页面(CustomPage)                | ✂️    | Astro `src/pages/` 原生支持;用户需求改为 `site.routing` 路由配置                                            |
| 5   | 菜单/友链/社交/打赏/关于(Meta 单文档) | ✅ 📦 | 并入 `site` 表 JSON 字段                                                                                    |
| 6   | 访客/访问计数                         | 🔁 📦 | `visits` 单表(pb hooks 维护)                                                                                |
| 7   | Waline 评论(内嵌子进程)               | 🔌    | 独立 Waline 容器,数据存储由用户配置(v1 不深入)                                                              |
| 8   | Pipeline(Node fork + pnpm add)        | ✂️    | 完全砍掉,不替代不迁移                                                                                       |
| 9   | 图床 local                            | ✅    | pb `media.file` FileField                                                                                   |
| 10  | 图床 picgo(OSS / GitHub / 插件)       | 🔁    | pb S3 provider(用户配置平移,所有云厂商有 S3 兼容 API)                                                       |
| 11  | 上传水印 / WebP 压缩                  | 🔁    | 前端 WASM(Photon.rs / Squoosh)                                                                              |
| 12  | Caddy on-demand TLS                   | 🔁    | prod/dev 都内嵌 Caddy on-demand TLS(保留零域名卖点)                                                         |
| 13  | ISR(增量静态再生)                     | 🔁    | prod 纯 SSG(预编译产物,容器内无 Node);重建在 dev/CI 做,pb hooks 通过 webhook 触发外部 CI(v1 不实现自动重建) |
| 14  | 协作者权限                            | ✅    | pb 原生 RBAC + `users` 表                                                                                   |
| 15  | Token 管理                            | ✅    | `tokens` 表(pb 也可用 `_externalAuths`)                                                                     |
| 16  | Swagger API 文档                      | ✅    | pb 自带 Admin UI + OpenAPI                                                                                  |
| 17  | 百度统计 / GA 脚本注入                | ✂️    | 改为 `site.analyticsScript`(Umami/Plausible/GA)                                                             |
| 18  | 自建分析看板                          | ✂️    | 砍掉,推荐外接 Umami/Plausible                                                                               |
| 19  | 自定义 HTML/CSS/JS 注入               | ✅    | Astro layout slot + `site.customize`                                                                        |
| 20  | RSS / sitemap / atom                  | ✅    | Astro integration                                                                                           |
| 21  | 加密文章(password)                    | ✅ 📦 | 明文迁移,Admin UI 不展示                                                                                    |
| 22  | 邮件(SMTP,Waline 用)                  | 🔌    | 外挂 Waline 自管                                                                                            |
| 23  | 登录日志                              | ✅    | `audits` 表(action='auth.login',pb hook 写入)                                                               |
| 24  | Caddy 日志查看                        | ✅    | 保留(默认 warn 级别,`site.caddyLogLevel` 可配,详见 https-strategy.md §3.2)                                  |
| 25  | 数据导入/导出(JSON)                   | ✅ 📦 | Admin UI 上传 JSON + pb_hooks 处理                                                                          |
| 26  | Docker / 一键脚本部署                 | ✅    | prod / dev 双镜像                                                                                           |
| 27  | ARM 支持                              | ✅    | pb 官方多架构镜像                                                                                           |
| 28  | 主题系统(原"未来支持")                | ✅    | Astro 三层:L1 内置 / L2 CSS 注入 / L3 外挂                                                                  |
| 29  | 插件系统(原"未来支持")                | ✂️    | Astro integration + pb_hooks 各自生态原生方案                                                               |
| 30  | 文章历史版本(新增)                    | ✅    | DB `revisions` 表(应用内)+ 可选 md_output + 可选 git sync                                                   |

---

## 决策统计

| 类别        | 数量 |
| ----------- | ---- |
| ✅ 保留     | 14   |
| 🔁 替代     | 6    |
| 🔌 外挂     | 3    |
| ✂️ 裁剪     | 7    |
| 📦 数据兼容 | 9    |

---

## 关键决策依据

### #3 标签:pb 原生 relation 数组(无关联表)

**原项目**:`tags[]` 内嵌 Article 字符串数组
**新方案**:`tags` 独立表 + `posts.tags` relation(multiple)

> **关键**:pb 的 relation 字段(`MaxSelect > 1`)**原生就是多对多**,**不需要关联表**(官方文档明确)。支持 `+tags` / `tags-` 修饰符增删,back-relation `posts_via_tags` 自动可用。

### #4 CustomPage:砍掉,用 Astro 原生

**原项目实际是个简陋的静态文件服务器**(`type: 'file' | 'folder'` + HTML 上传到图床 + `/c/{path}` 反代)。

**新方案三层**:

1. 自定义页面 → Astro `src/pages/`(放 `.astro`/`.md`/`.html`)
2. 自定义路由/反代 → `site.routing` JSON 配置(dev 镜像生成 Caddyfile,prod 用 Astro middleware)
3. 静态资源 → Astro `public/`

### #7 评论系统:Waline 仍是首选(外挂)

> LeanCloud 2027-01 关停 ≠ Waline 关停。Waline 支持 8 种数据源(含 SQLite),官方已移除 LeanCloud 引用。

**方案**:Waline 独立容器(外挂)。数据源由用户选择(SQLite / PostgreSQL / MongoDB 等,Waline 官方支持 8 种)。**v1 不承诺与 pb 共享 SQLite 文件**(并发写安全性待实测,见 decision-revisions-v2.md §2)。
**备选**:Giscus(零后端)/ Artalk(轻量自托管)。

### #10 图床:pb S3 provider 替代 picgo

picgo 生态有 [`picgo-plugin-s3`](https://github.com/wayjam/picgo-plugin-s3),所有云厂商都有 S3 兼容 API(阿里云 OSS / 腾讯 COS / Cloudflare R2 / MinIO)。用户原 picgo 配置几乎可以平移到 pb S3 provider。

### #11 图片处理:前端 WASM

- **Photon.rs**(Rust + WASM,3.2k stars):水印,对标 libvips — 未实现
- **@jsquash/{webp,avif}**(Squoosh 拆出的 npm 包):BMP/TIFF/AVIF → WebP/AVIF 归一化 — **已实现(2026-06-28)**,见 `app/src/lib/media/normalizeImage.ts`。targetFormat 由 `site.mediaConfig` 控制(webp / avif / preserve 三选一,默认 webp),质量 1-100 可调。按需动态 import,wasm code-split 出主 bundle。AVIF 走多线程 worker,需 `vite.worker.format='es'`(见 `app/astro.config.mjs`)
- **pb Go extend**:运行时复杂场景(可选) — 未实现
- pb JSVM 无文件 I/O,不做图片处理
- SVG 不做转换(矢量图 resize 无意义),pb 后端 fallback 原图 + 编辑器状态条提示

### #12 HTTPS:双镜像策略

| 镜像     | 方案                        | 能力                           |
| -------- | --------------------------- | ------------------------------ |
| prod     | Caddy on-demand TLS         | 完整零域名 HTTPS(与原项目一致) |
| dev      | Caddy on-demand TLS         | 同 prod                        |
| 外置反代 | 文档支持(Caddy/Traefik/NPM) | 用户自管                       |

prod 与 dev 都内嵌 Caddy(理由见 [`deployment-strategy.md`](./deployment-strategy.md) §1)。

### #28 主题:Astro 三层

| 层级              | 用户操作                          | 技术                          |
| ----------------- | --------------------------------- | ----------------------------- |
| L1 内置主题       | 后台选 `default/minimal/magazine` | CSS 变量 + layout 切换        |
| L2 自定义 CSS/JS  | 后台填 `site.customize`           | Astro layout slot             |
| L3 完全自定义前端 | 外挂整个 Astro 项目               | dev 镜像构建 + 切换 prod 模式 |

### #30 版本控制 / md 输出 / 外部同步(三个独立开关)

```
posts.content (pb 主存储)
    │
    ├─→ revisions 表          (应用内历史,默认 ON)
    ├─→ md_output 目录         (markdown 导出,默认 OFF)
    └─→ git remote            (外部同步,默认 OFF)
```

**应用内历史**(DB `revisions` 表):UI 一键撤销,查询快,事务一致。
**外部同步**(git cli,不用 go-git):用户期望标准 git 仓库,SSH/LFS 完整支持。go-git 适合程序内部(Gitea/CI/Pulumi),不适合用户直接交互。

详见 [`pb-schema-design.md`](./pb-schema-design.md) §2.5 和 [`migration-path.md`](./migration-path.md) §6。

---

## 遗留待决问题

以下问题转入专门文档:

1. **HTTPS 策略选型** → [`https-strategy.md`](./https-strategy.md)
2. **pb schema 字段级设计** → [`pb-schema-design.md`](./pb-schema-design.md)
3. **迁移工具形态** → [`migration-path.md`](./migration-path.md)
4. **dev 镜像 MCP 工具白名单** → 待 README 更新时定
