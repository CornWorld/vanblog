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

**修复**:测试中创建 post 时必须显式 `post.Set("deleted", false)`。生产代码里 migration 应设置默认值。

---

## 7. 未完成项与风险

| 项目 | 状态 | 风险 |
|---|---|---|
| Astro 前端 | 仅占位页面 | 产品不可用,需要实现主题 |
| media S3 驱动 | 未实现 | 云存储用户无法使用 |
| Waline 集成 | 仅文档 | 评论系统不可用 |
| ARM 多架构 | 未验证 | 树莓派/ARM 服务器不可用 |
| HTTP_ONLY 模式 | 未实现 | 外置反代用户需自行处理 |
| Caddy admin api 调用方式 | Go 已实现 | routing-strategy.md §9 原计划用 JSVM $http,实际用 Go extend |
| ~~Go markdown 包~~ | 已删除(2026-06-28) | 原本基于 goldmark 的 `internal/markdown` 是死代码,前端 `posts/[id].astro` 改用 marked + DOMPurify 后 Go 端零调用方。删除后 vault 测试全过,go.mod 同步去掉 goldmark 依赖 |
