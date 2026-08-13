# Artalk 评论系统集成（自托管 + 同源）

VanBlog 内置 Artalk 评论系统的支持，提供两种部署方式，**都走 Caddy 同源出口 `/comments/*`**，无跨域、无独立 TLS 证书、无额外端口暴露。

- **内置 sidecar（单容器，默认推荐）**：Artalk 进程跑在 VanBlog 容器内，一个开关启用。
- **compose 多容器（external 接入）**：Artalk 作为独立容器（官方镜像），VanBlog 反代接入。

两种方式共用同一套前端配置和 Caddy 路由生成逻辑。

---

## 方式一：内置 sidecar（单容器）

Artalk 二进制已内置在 prod 镜像里（构建期下载，`--build-arg ARTALK_VERSION=vX.Y.Z` 可覆盖版本，默认 `v2.10.0`）。

### 1. 启用

在 `docker-compose.yml` 的 `vanblog` 服务里取消注释：

```yaml
environment:
  - VANBLOG_ARTALK_ENABLED=1
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

> 注意：`VANBLOG_ARTALK_UPSTREAM` 优先级高于 `VANBLOG_ARTALK_ENABLED`。外部容器模式下**不要**同时设 `VANBLOG_ARTALK_ENABLED=1`（那会额外启动内置 sidecar）。

---

## 前端配置（两种方式通用）

1. 进入 VanBlog 后台 → 站点配置 → 评论。
2. 评论 provider 选 `artalk`。
3. Artalk Server 填 `https://<你的域名>/comments`（同源）。
4. Artalk Site 名填你的站点名（如 `VanBlog`）。

保存后，文章页 / 关于页的评论框会加载 Artalk widget，并请求同源 `/comments/api/...`。

---

## Artalk 管理员账号初始化

Artalk 首次部署后不会自动创建管理员。两种方式任选：

1. **评论框初始化（推荐）**：打开任意文章页评论框，输入管理员用户名和邮箱并提交一条评论，评论框右下角会出现「控制台」按钮，进入 Artalk 管理后台。
2. **CLI**（内置 sidecar）：`docker exec -it <容器> artalk admin`。

---

## 数据迁移（Waline → Artalk）

存量 Waline 评论数据用 Artransfer-CLI 迁移到 Artalk：

```bash
# 参考 admin 后台「迁移」页，或：
# vault/cmd/migrate/main.go 内含交互式 Waline → Artalk 迁移引导
```

迁移产出 `.artrans` 文件，在 Artalk 控制中心 → 迁移 → 上传即可。

---

## 架构说明

- **Caddy 路由生成**：`vault/internal/caddy/config_builder.go` 的 `buildFullRouteTable` 在系统 API 路由后、用户规则前插入 `/comments/*` 反向代理路由（当 `BuildOpts.ArtalkUpstream` 非空时）。
- **上游地址**：`vault/internal/caddy/bootstrap.go` 读环境变量 `VANBLOG_ARTALK_UPSTREAM`；为空时若 `VANBLOG_ARTALK_ENABLED=1` 则回退到 `127.0.0.1:23366`。
- **同源前缀剥离**：Artalk 本身不支持 base path（以 `/` 为根），所以系统路由用 `rewrite strip_path_prefix` 剥掉 `/comments` 前缀后再反向代理。`site.routing` 的 proxy 规则也提供 `stripPathPrefix` 字段，可复用于任意不支持 base path 的上游。
