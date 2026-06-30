# 实施经验教训

> 记录从 2026-06-24 重构过程中发现的关键问题、踩过的坑、以及设计决策背后的理由。
> 供后续维护者参考,避免重复踩坑。

---

## 1. PocketBase 0.39 Breaking Changes

### 1.1 JSVM 不再自动注册

**问题**:pb 0.22 之前,预编译的 pb 二进制自动加载 `pb_hooks/*.pb.js`。0.39 把 JSVM 改成了可选插件,自定义 Go 构建必须在 `main.go` 里显式调用 `jsvm.MustRegister(app, jsvm.Config{})`。

**症状**:`pb_hooks/system.pb.js`(审计日志、visits 聚合)静默失效——没有错误日志,没有 panic,JS 文件就是不执行。

**发现方式**:Docker 构建冒烟测试时,发现 JS hooks 未加载。

**修复**:`main.go` 添加:

```go
jsvm.MustRegister(app, jsvm.Config{
    HooksDir:      hooksDir,
    HooksWatch:    hooksWatch,
    HooksPoolSize: hooksPool,
})
migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{...})
```

**教训**:版本升级后必须验证所有功能路径,不能假设"编译通过=功能正常"。特别是插件式的框架,breaking change 可能是静默的。

### 1.2 CLI Flag 变更

**问题**:pb 0.22 有 `--hooksDir` CLI flag。0.39 移除了它(JSVM 是插件后,flag 由 main.go 自行定义)。

**修复**:在 `main.go` 用 `app.RootCmd.PersistentFlags().StringVar(&hooksDir, "hooksDir", ...)` 自行注册。或者依赖默认值(`<DataDir>/../pb_hooks`)。

### 1.3 Go 版本要求

**问题**:`go.mod` 要求 Go 1.26.4(Darwin arm64),但 Dockerfile 用 `golang:1.23-alpine`。构建失败。

**修复**:Dockerfile 改为 `golang:alpine`(跟踪最新版)。

---

## 2. TLS 安全模型

### 2.1 On-Demand TLS 必须配 Ask 端点

**来源**:[Caddy 官方文档](https://caddyserver.com/docs/automatic-https) 明确说:

> The ask endpoint is **mandatory** to prevent abuse — without it, anyone could trigger certificate issuance for arbitrary domains.

**原项目行为**:`allowedDomains` 空时允许所有域名。这在个人博客场景可接受,但存在被利用为"证书农场"的风险。

**我们的方案(两阶段)**:

- **Setup 窗口**(无 superuser):允许所有(与 pb 创建窗口一致)
- **Post-setup**(有 superuser):空列表=拒绝所有;非空=严格白名单

**关键洞察**:判断"是否已初始化"的最自然标志是 `_superusers` 表是否有记录——和 pb 的 admin 创建流程天然对齐。

### 2.2 用户可能被锁在 HTTPS 门外

**场景**:用户在 admin 里把 `allowedDomains` 改错了(如漏掉 `www.`),Caddy ask 返回 403,新域名无法签发证书。但 admin 界面也走 HTTPS——死锁。

**方案**:Caddy `:8080` 管理端口(纯 HTTP 回退通道):

- 只放行 `/api/*` + `/admin/*` + `/_/*`,前台不暴露
- 用户 `-p 8080:8080` 重启容器,通过 HTTP 修复配置
- **全程走 Caddy 路由**,不绕过安全层

**教训**:任何涉及 TLS 的配置修改,必须有 HTTP 回退通道。不能假设 HTTPS 永远可用。

### 2.3 证书持久化

**问题**:Caddy 默认存储在 `/root/.local/share/caddy`(容器内,不持久)。容器重启 = 重新签发所有证书。Let's Encrypt 限制:5 duplicate certs/week/basename。

**修复**:Caddyfile 显式配置 `storage file_system { root /data/caddy }`,Dockerfile 声明 `VOLUME ["/data/caddy"]`。

---

## 3. Docker 构建实践

### 3.1 Docker 磁盘空间

**问题**:OrbStack/Docker Desktop 的虚拟磁盘有限。`go mod download` 在构建时下载 ~500MB 依赖,多次构建后磁盘满了(`no space left on device`)。

**解决**:`docker system prune -a --volumes` 清理。单次可回收 6-7GB。

### 3.2 镜像体积优化

**结果**:prod 镜像 76MB。关键:

- `CGO_ENABLED=0 go build -ldflags="-s -w"` (静态链接 + 去符号表)
- Alpine base (~7MB)
- Caddy + ca-certificates + tzdata
- 不含 Node.js(prod 用 Astro SSG 静态产物)

---

## 4. 测试策略

### 4.1 pb Hook 只在 HTTP 请求时触发

**问题**:`OnRecordUpdateRequest("posts")` 等事件 hook 只在 pb 的 Record API HTTP 路由上触发。直接 Go API `app.Save(record)` 不触发。

**影响**:集成测试不能只用 Go API 模拟"用户更新文章"来验证 revisions hook。

**方案**:直接调用 hook 委托的业务函数(`revMgr.CaptureBeforeUpdate()`),而不是模拟 HTTP 请求。hook 闭包本身是薄胶水,由 smoke test 验证挂载。

### 4.2 pb 0.39 的 RequestEvent 难以手动构造

**问题**:`core.RequestEvent` 嵌入了 `router.Event`,后者有未导出的 `data` store。零值初始化后调用 `e.Set("Content-Type", ...)` 会 panic。

**方案**:测试路由 handler 时,直接测试它委托的业务函数(`article.Search()`、`feed.GenerateRSS()` 等),不构造 `RequestEvent`。

---

## 5. 架构决策记录

### 5.1 Go Hooks vs JS Hooks 的分界线

**原则**(来自 `architecture-layering.md`):

- Go 层:系统级行为(数据一致性、计数准确性、性能敏感操作)
- JS 层:用户自定义(审计、自定义校验、webhook)

**不能简单"把 Go hooks 移到 JS 让用户改"** 的原因:

- pb hook 是事件链,JS hook 只能"追加",不能"替换" Go 行为
- 移到 JS 后性能下降(goja 解释执行 vs Go 原生)
- 类型安全丧失(JS 字符串 vs Go 编译期检查)

正确做法:Go hook 保留核心逻辑,通过配置项(如 `site.revisionsEnabled`)或 pb Rule 表达式让用户控制行为。

#### 5.1.1 Manager 自挂 hook（启动架构决策）

**背景**：V4 smoke 暴露了时机问题 —— BootstrapSync 卡死（Caddy admin 不存在）、site 表 NULL、S3 sync 报 "no rows"。诊断后发现根因是 `vault/internal/hooks/hooks.go` 集中了 5 类关注点（数据一致性 hook / 业务事件 hook / HTTP 路由 / 启动初始化 / 配置同步），所有逻辑通过 `Register(app)` 单点塞给 pb，导致启动顺序不可见。

**决策**：删除 `hooks/` 包，每个 manager 在 `New(app)` 时自挂所需的 pb hook（事件订阅、HTTP 路由、启动初始化）。main.go 是构造清单 + `pb.Start()`。

**否决的方案**：

- `wire` / `fx` DI 框架 —— pb 自己 own 生命周期（Bootstrap → Migrate → Serve），DI 框架跟它打架；痛点是「副作用时序」不是「对象图装配」
- runtime Mode 枚举（DEV/PROD）—— 又一层抽象，命名空洞（`Bootstrap` / `Sync` 看不出业务意义）
- 阶段接口（PhasePreServe / PhaseOnServe）—— 本质还是主程序在做事
- 命名约定 + 强制接口 —— 用户反馈「又臭又长」

**关键收获**：

1. pb 的 hook 系统已经是装配点，不需要 vanblog 再加一层抽象。
2. dev/prod 模式靠 `os.Getenv` 在 caddy manager 内部短路 `pushConfigToAdminAPI`，不需要 Mode 枚举。
3. `OnServe` 内跑启动初始化是安全时机 —— 此时 migration 已完成、site 表存在、`ApplyS3BackendToSettings` 不会报 "no rows"。`OnBootstrap` 只跑系统 migration，**不**会跑用户 migration。
4. 命名要具体动词（`pushConfigToAdminAPI` / `dedupeOnUpload` / `ApplyS3BackendToSettings`），不要抽象分类词（`Bootstrap` / `Sync` / `Register`）。

详见 `architecture-layering.md` §4.4。

### 5.2 不直连 pb 绕过 Caddy

**原则**:所有外部流量必须经过 Caddy 路由层。

**理由**:

- 用户自定义路由(`site.routing`)靠 Caddy 实现
- SSRF 防护在 Caddy 层
- 直接访问 pb (`0.0.0.0:8090`) 会跳过所有安全层

**实践**:pb 只绑 `127.0.0.1:8090`(Caddy 反代),管理端口 `:8080` 也走 Caddy。

---

## 6. Schema 设计回顾

### 6.1 JSON 字段 vs 独立列

**决策**:site 表从 14 个 JSON 字段(原项目设计)拆为 64 个独立列。

**理由**:

- Admin UI 直接编辑列比编辑 JSON 好得多
- pb 的 filter 查询对独立列更高效(不需要 JSON path)
- 单行表的 JSON 拆列无索引损失(本来就只有一行)

**保留为 JSON 的**:nav/links/socials/rewards/routing/allowedDomains(动态数组,JSON 比 1:N 关联表更好用)。

### 6.2 posts.deleted 字段

**坑**:`deleted` 是 BoolField,没有默认值。pb 的 `false` 是 Go 零值但不一定写入 DB。查询 `deleted=false` 时,**未显式设置 deleted 的记录可能不匹配**。

**修复(2026-06-29 更新)**:

- 测试中创建 post 时仍建议显式 `post.Set("deleted", false)`,代码即文档。
- 生产层面由 `1782300000_soft_delete_indexes.go` 兜底:
  1. `UPDATE posts SET deleted = 0 WHERE deleted IS NULL` —— 清洗历史 NULL。
  2. `BoolField.ColumnType()` 在 pb 0.39 已经返回 `BOOLEAN DEFAULT FALSE NOT NULL`,所以**未来 INSERT 不会再写 NULL**(此前关于"migration 应设置默认值"的担忧实际上已被 pb 的列类型保证消解)。
- 这意味着 `WHERE deleted = 0` 与 `WHERE deleted = false` 对所有行(含历史行)都能正确匹配。

### 6.4 软删除治理(Partial Index / 索引膨胀 / 存储回收)

**背景**:VanBlog 用 `posts.deleted` 做软删除,长期运行后必然出现三类工程问题 —— 索引膨胀、存储不释放、查询效率退化。网络调研结论(Michal Drozd《The Soft Delete Trap》等)与本项目 SQLite + PocketBase 实情对齐如下。

**问题 1 — 索引膨胀**:普通 B-tree 索引把 `deleted=1` 的行也纳入。删除率 60% 时,索引扫描 60% 是无效 I/O,SQLite 的 `VACUUM` 也不会从索引里剔除这些墓碑行(只回收空闲页)。

**问题 2 — 存储持续增长**:软删除本质是 `UPDATE`,page 不还文件系统,DB 文件只增不减。

**问题 3 — 查询计划退化**:带 `WHERE deleted=0` 谓词本应走更小的索引,但如果某条热点查询没建对应 partial index,会静默退化为扫全索引。

**对策(本项目落地)**:

- `1782300000_soft_delete_indexes.go` 给 `article.go` 三条热点读路径各建一条 partial index:
  - `idx_posts_status_created_active ON posts (status, created) WHERE deleted = 0` —— 覆盖 GetRecent / GetTimeline / Search / feed。
  - `idx_posts_category_active ON posts (category) WHERE deleted = 0` —— 覆盖 GetByCategory。
  - `idx_posts_pathname_active ON posts (pathname) WHERE deleted = 0` —— 覆盖 GetByPathname。
- 维护铁律:**新增任何 posts 读路径都必须在 partial index 覆盖范围内**,否则补一条对应的 partial index。漏建一条就会静默退化。
- 后端 + UI 链路:
  - `GET /api/vanblog/posts/trash` + `POST /api/vanblog/posts/{id}/restore`(`vault/internal/article/article.go`)—— 仅 admin 或 `article:update` 可调用,恢复后异步触发 Astro 缓存失效。
  - `app/src/pages/admin/trash.astro` 回收站页:列出已删除、支持「恢复」与「彻底删除」(后者调 pb `delete`,物理移除)。

**TTL / 物理清理建议**(未实现,留作运维 SOP):

- 个人博客(< 10k 文章、删除率 < 10%)软删除可长期保留,无需归档表。
- 若删除率上升到 30%+ 或 DB 文件超过 100MB,执行一次性脚本:
  ```sql
  DELETE FROM posts WHERE deleted = 1 AND updated < datetime('now','-90 day');
  VACUUM;
  ```
- 频率:季度或按需,跑前备份 `pb_data/*.db`。

**何时改架构**:删除率 > 50% 或单表 > 100 万行时,引入归档表(`posts_archive`)+ 触发器搬运,active 表只留 `deleted=0` 行,索引回归全量。本项目暂不需要。

### 6.3 FileField 缩略图与 imageContentTypes 不一致

**坑**:`1782300000_media_filefield_config.go` 接受 9 种 MIME(`image/jpeg/png/gif/webp/svg+xml/bmp/tiff/x-icon/avif`),但 pb 的缩略图生成(`apis/file.go:22`)只覆盖 5 种:`png/jpg/jpeg/gif/webp`。

**根因**:pb 的 thumb 生成走 Go 标准库 `image/*`,原生不支持 BMP/TIFF/AVIF;SVG 是矢量图,resize 无意义。pb 上游已有 issue tracker 没有讨论扩展 `imageContentTypes` —— 这是设计意图,不是 bug。

**症状**:用户上传 BMP / TIFF / SVG / AVIF 后,虽然文件正常存储,但 `?thumb=300x0` 等缩略图请求会**静默 fallback 到原图**(`apis/file.go:181-193` 的 `Fallback to original` 路径)。不会报错,但读者加载文章时拿不到缩略图,带宽浪费。

**决策**:对齐预想 —— **pb 后端契约不变**(继续接受 9 种 MIME、能生成 thumb 就生成、不能就 fallback 原图),**前端做上传前归一化**,且归一化策略由用户在 site 配置项控制:

`site.mediaConfig = { enabled, targetFormat, quality }`(`1782500000_add_site_media_config.go`):

- `enabled=false` 或 `targetFormat='preserve'` — 全部直传,BMP/TIFF/SVG/AVIF 在编辑器右下角状态条提示「此格式不会生成缩略图」
- `targetFormat='webp'`(默认) — BMP/TIFF/AVIF 走 `@jsquash/webp` 编码(~80KB wasm,动态 import)
- `targetFormat='avif'` — BMP/TIFF/AVIF 走 `@jsquash/avif` 编码(~8MB wasm,编码耗时 ~5-10x WebP)
- `quality` 1-100,默认 84(两个 encoder 都接受 0-100 quality 参数,无需手动映射 cqLevel)

**SVG 例外**:无论 targetFormat,SVG 始终直传(矢量图 resize 无意义,wasm 解码也帮不上)。

**AVIF 直传通道**:`1782500001_media_filefield_add_avif.go` 给 FileField 加了 `image/avif` MIME,这样 preserve 模式用户能直传 AVIF(不被 pb 拒收)。pb 不会生成 thumb,但 fallback 行为与 BMP/SVG 一致。

**构建坑(关键)**:@jsquash/avif 内含多线程 worker(`avif_enc_mt.js`),Vite 默认 `worker.format='iife'` 无法打包 ESM-only 的 worker → 构建报 `Invalid value "iife" for option "worker.format"`。`app/astro.config.mjs` 必须显式配 `worker.format='es'` + `optimizeDeps.exclude` 排除 `@jsquash/*`。详见 [jSquash#37](https://github.com/jamsinclair/jSquash/issues/37)。

**实现位置**:

- `app/src/lib/media/normalizeImage.ts` — 归一化逻辑(配置驱动)
- `app/src/components/ByteMdEditor.astro::uploadImages` — 集成点 + 状态条
- `app/src/pages/admin/edit/[id].astro` — 从 `Astro.locals.getSite()` 拿 mediaConfig 透传给编辑器

**验证覆盖**:

- `vault/internal/media/s3_integration_test.go::TestS3Integration_Thumbnail` — PNG 路径 thumb 端到端生成 + 写回 S3
- `vault/internal/media/s3_integration_test.go::TestS3Integration_UnsupportedThumbFormats` — **锁定后端契约**:BMP/AVIF/SVG 上传成功但 thumb 静默 fallback 原图,不写 thumb 对象。前端归一化是上层产品决策,这层契约不应破坏。
- 浏览器侧(BMP/TIFF → WebP/AVIF 转换)无自动化测试,依赖人工 smoke。

---

## 7. 未完成项与风险

| 项目                     | 状态                                | 风险                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Astro 前端               | 仅占位页面                          | 产品不可用,需要实现主题                                                                                                                                                                                                                                                                                                                                                                                           |
| ~~media S3 驱动~~        | 已实现 + 端到端测试覆盖(2026-06-28) | 通过 site.s3Config JSON 字段同步到 pb settings(`ApplyS3BackendToSettings`),pb `BaseApp.NewFilesystem()` 自动切 S3。secret 明文存 SQLite,用户需自管卷加密。集成测试(`vault/internal/media/s3_integration_test.go`,含 dedup 端到端用例 `TestS3Integration_DedupComponentsAgainstS3`)覆盖:同步、上传、`/api/files/...` 下载路由、`?thumb=` 缩略图生成、dedup hook —— 通过 MinIO dev-service 跑。**已知限制**:见 §6.3 |
| Waline 集成              | 仅文档                              | 评论系统不可用                                                                                                                                                                                                                                                                                                                                                                                                    |
| ARM 多架构               | 未验证                              | 树莓派/ARM 服务器不可用                                                                                                                                                                                                                                                                                                                                                                                           |
| ~~HTTP_ONLY 模式~~       | 已实现(2026-06-28)                  | `VANBLOG_HTTP_ONLY=1` 让 Caddy 只听 :80、不配 TLS app,外置反代终止 TLS。需外置反代传 `X-Forwarded-Proto: https`,否则 canonical URL 错。                                                                                                                                                                                                                                           |
| ~~外置控制脚本~~         | 已实现(2026-06-28)                  | 仓库根 `vanblog.sh`,11 项菜单(install/config/start/stop/restart/update/log/backup/restore/maintenance/uninstall)。模板 compose 内嵌脚本,模板更新需重新分发脚本                                                                                                                                                                                                                                                    |
| Caddy admin api 调用方式 | Go 已实现                           | routing-strategy.md §9 原计划用 JSVM $http,实际用 Go extend                                                                                                                                                                                                                                                                                                                                                       |
| ~~Go markdown 包~~       | 已删除(2026-06-28)                  | 原本基于 goldmark 的 `internal/markdown` 是死代码,前端 `posts/[id].astro` 改用 marked + DOMPurify 后 Go 端零调用方。删除后 vault 测试全过,go.mod 同步去掉 goldmark 依赖                                                                                                                                                                                                                                           |
