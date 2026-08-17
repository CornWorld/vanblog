# Artalk 评论系统集成（自托管 + 同源）

> 本文是 Artalk 的**部署操作手册**。评论系统的架构与集成总览（conf 数据流、鉴权边界、provider 模型）见 [`comments-system.md`](./comments-system.md)。

VanBlog 内置 Artalk 评论系统的支持，提供两种部署方式，**都走 Caddy 同源出口 `/comments/*`**，无跨域、无独立 TLS 证书、无额外端口暴露。

- **内置 Artalk（prod-artalk 镜像）**：镜像带有 Artalk 二进制；是否启动在首次 `/setup` 向导中选择，默认关闭。
- **compose 多容器（external 接入）**：Artalk 作为独立容器（官方镜像），VanBlog 反代接入。

两种方式共用同一套前端配置和 Caddy 路由生成逻辑。

---

## 方式一：内置 sidecar（单容器）

Artalk 二进制已内置在 prod 镜像里（构建期下载，`--build-arg ARTALK_VERSION=vX.Y.Z` 可覆盖版本，默认 `v2.10.0`）。

### 1. 启用

在 `docker-compose.yml` 的 `vanblog` 服务里取消注释：

```yaml
environment:
  - 选择 `prod-artalk` 镜像，并在首次 `/setup` 向导中启用内置 Artalk
```

同时确认 vanblog 服务已挂载 Artalk 数据卷（`docker-compose.yml` 里默认已带）：

```yaml
volumes:
  - artalk_data:/data/artalk
```

### 2. 启动后行为

- entrypoint 启动 `artalk server`，监听 `127.0.0.1:23366`（以 `/` 为根，Artalk 不支持 base path），数据落在 `/data/artalk`。
- Go 侧 Caddy config builder 自动生成系统路由 `/comments/* → 127.0.0.1:23366`（先用 `rewrite` strip 掉 `/comments` 前缀，再反向代理到 Artalk 根 `/`）。

---

## 方式二：compose 多容器（external 接入）

适合希望 Artalk 独立升级、生命周期与 VanBlog 解耦的场景。

### 1. 在 `docker-compose.yml` 取消 artalk 服务注释

```yaml
services:
  artalk:
    image: artalk/artalk-go
    restart: unless-stopped
    environment:
      - ATK_HOST=0.0.0.0
      - ATK_PORT=23366
      - ATK_LOCALE=zh-CN
      - ATK_SITE_DEFAULT=VanBlog
    volumes:
      - artalk_data:/data
    # 不暴露端口到公网，只被 vanblog 的 Caddy 反代
```

### 2. 在 vanblog 服务里指向外部 Artalk 容器

```yaml
services:
  vanblog:
    environment:
      - VANBLOG_ARTALK_UPSTREAM=artalk:23366
```

> 注意：`VANBLOG_ARTALK_UPSTREAM` 只表示外部上游地址，不负责启用 Artalk。内置 Artalk 是否启动由 `site.commentsProvider` 决定。

---

## 前端配置（两种方式通用）

1. 进入 VanBlog 后台 → 站点配置 → 评论。
2. 评论 provider 选 `artalk`。
3. Artalk Server 填 `https://<你的域名>/comments`（同源）。
4. Artalk Site 名填你的站点名（如 `VanBlog`）。

保存后，文章页 / 关于页的评论框会加载 Artalk widget，并请求同源 `/comments/api/...`。

---

## Artalk 管理员账号初始化

Artalk 管理员不通过命令行初始化。选择 `prod-artalk` 镜像后，首次打开 `/setup` 时可以直接选择启用 Artalk，并填写 Artalk 管理员 email/password；VanBlog 会生成配置并完成账号初始化。

账号由 `/setup` 向导创建。Artalk 管理员 email 建议与 VanBlog 管理员 email 保持一致，这样后续 SSO 免二次登录可以按 email 映射为 Artalk 管理员。

---

## 数据迁移（Waline → Artalk）

存量 Waline 评论数据用 Artransfer-CLI 迁移到 Artalk：

```bash
# 参考 admin 后台「迁移」页，或：
# vault/cmd/migrate/main.go 内含交互式 Waline → Artalk 迁移引导
```

迁移产出 `.artrans` 文件，在 Artalk 控制中心 → 迁移 → 上传即可。

---

## SSO 免二次登录（可选）

VanBlog 提供与 Artalk 的单点登录桥接：博主在 VanBlog 后台点「打开评论管理」，无需再次输入 Artalk 账号密码，直接以管理员身份进入评论管理。

### 原理

复用 Artalk 原生的 `POST /api/v2/sso/exchange` 换票端点：VanBlog 签发一个短期（60 秒）随机 token，Artalk 拿它去 VanBlog 的 `/userinfo` 端点换出登录态。**VanBlog 不持有 Artalk 凭证**，只签发自己控制的短期 token。

### 1. 启用 VanBlog 侧 SSO

在 `docker-compose.yml` 的 `vanblog` 服务环境变量里加：

```yaml
environment:
  - VANBLOG_COMMENTS_SSO_ENABLED=1
```

默认关闭；不设该变量时两个 SSO 端点（`/api/vanblog/comments-sso/*`）不会注册，零攻击面。

### 2. 生成并配置 Artalk

Artalk 提供 `gen config` 命令主动生成默认配置文件：

```bash
# 在宿主机执行，直接生成当前目录的配置
artalk gen config ./artalk.yml

# 如果文件已存在，使用 -f 强制覆盖（会丢失已有配置）
artalk gen config ./artalk.yml -f
```

也可以在内置 sidecar 的数据卷中生成：

```bash
docker compose exec vanblog artalk gen config /data/artalk/artalk.yml
```

然后编辑 `artalk.yml`，至少配置 SSO：

```yaml
auth:
  enabled: true
  sso:
    enabled: true
    issuer: "https://<你的域名>/api/vanblog/comments-sso"
```

管理员账号使用 Artalk 自带命令创建或修改，不需要把密码写进 `artalk.yml`：

```bash
artalk admin \
  --name 博主 \
  --email <你的博主邮箱> \
  --password '<一个初始密码>'
```

`--email` **必须与 VanBlog 管理员账号的邮箱一致**。SSO 换票按邮箱找到 Artalk 用户；邮箱一致时，换票用户才能获得 Artalk 管理员身份。

- `issuer` 的域名必须与 VanBlog 的 `baseUrl` 一致，且为 HTTPS（生产环境）。
- Artalk 会请求 `{issuer}/userinfo`，即 VanBlog 的 `/api/vanblog/comments-sso/userinfo`。
- `gen config` 默认不会覆盖已有文件；只有明确传 `-f` 才会覆盖。

### 3. 使用

进入 VanBlog 后台 → 站点配置 → 评论，选 `artalk` 并填好 Server 后，点「打开评论管理（免二次登录）」。系统会换票并跳转到博客首页，评论框自动识别管理员身份，右下角出现「控制台」按钮即可进入管理。

---

## 架构说明

- **Caddy 路由生成**：`vault/internal/caddy/config_builder.go` 的 `buildFullRouteTable` 在系统 API 路由后、用户规则前插入 `/comments/*` 反向代理路由（当 `BuildOpts.ArtalkUpstream` 非空时）。
- **上游地址**：`vault/internal/caddy/bootstrap.go` 仅在 `site.commentsProvider=artalk` 时生成 Artalk 上游；配置 `VANBLOG_ARTALK_UPSTREAM` 时使用外部实例，否则回退到 `127.0.0.1:23366`。
- **同源前缀剥离**：Artalk 本身不支持 base path（以 `/` 为根），所以系统路由用 `rewrite strip_path_prefix` 剥掉 `/comments` 前缀后再反向代理。`site.routing` 的 proxy 规则也提供 `stripPathPrefix` 字段，可复用于任意不支持 base path 的上游。
