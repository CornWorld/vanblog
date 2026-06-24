# 部署策略

> **依据**:用户反馈 + [原项目 `scripts/vanblog.sh`](file:///Users/corn/Code/vanblog-upstream/scripts/vanblog.sh) + [原项目 `Dockerfile`](file:///Users/corn/Code/vanblog-upstream/Dockerfile) + [Astro 官方文档](https://docs.astro.build/en/guides/on-demand-rendering/)
>
> **核心决策(v2)**:
>
> - **双镜像**(prod / dev),一个 Dockerfile 多阶段构建
> - **prod 带 Node**(运行 Astro SSR server),但不带 npm/pnpm/源码
> - **前台走 Astro Hybrid 模式**(`output: 'static'` + 逐页 `prerender`):静态页 SSG + 文章页 SSR + `Astro.cache` 缓存
> - **缓存失效**:pb hook → 调 Astro `/api/revalidate` → `Astro.cache.invalidate()` → 无需重新 build
> - **vanblog.sh 继承原项目形态**(curl 一键脚本 + 交互式菜单),管 docker-compose.yml
> - **Admin UI 不碰 host**(信任域隔离),未来 v2 考虑本地 agent + 中央 Web 控制台
>
> **关联文档**:[`https-strategy.md`](./https-strategy.md) / [`routing-strategy.md`](./routing-strategy.md)

---

## 0. 渲染策略(v2 修订)

> **v1 决策**:prod 纯 SSG,无 Node。文章内容用 CSR fetch。
> **v1 问题**:博客的核心价值是 SEO。CSR 返回空壳 HTML,搜索引擎无法收录文章。
> **v2 决策**:Hybrid 模式,prod 带 Node 跑 Astro SSR。

### 0.1 Astro Hybrid 模式

Astro `output: 'static'`(默认)+ Node adapter = **逐页控制渲染策略**:

| 页面                 | `prerender` | 渲染方式                    | 缓存                        |
| -------------------- | ----------- | --------------------------- | --------------------------- |
| 首页 `/`             | `true`      | SSG(build 时编译)           | 永久静态                    |
| 关于 `/about`        | `true`      | SSG                         | 永久静态                    |
| 文章 `/posts/[slug]` | `false`     | SSR(运行时 fetch pb + 渲染) | `Astro.cache`(maxAge + swr) |
| 归档 `/archive`      | `false`     | SSR                         | `Astro.cache`               |
| 后台 `/admin/*`      | `false`     | SSR/CSR                     | 无缓存                      |
| `/api/revalidate`    | `false`     | API 端点                    | —                           |

### 0.2 文章发布 → 缓存失效流程

```
1. 用户在 Admin 发布/更新文章
2. pb Go hook (OnRecordAfterUpdateSuccess "posts")
   → HTTP POST http://127.0.0.1:4321/api/revalidate { tags: ["posts"] }
3. Astro.cache.invalidate({ tags: ["posts"] })
4. 下一个访客请求 /posts/[slug]
   → 缓存 miss → SSR 重新渲染(从 pb 拿最新数据)
   → 写入新缓存 → 返回完整 HTML
```

**不需要重新 build。不需要 cron。** 文章发布后缓存立即失效,下次访问自动刷新。

### 0.3 为什么 prod 仍然需要 Node

Astro 的 SSR 页面(`prerender = false`)在运行时需要一个 Node 进程执行 `fetch()` + 渲染组件。编译产物是 `dist/server/entry.mjs`,用 `node ./dist/server/entry.mjs` 启动。

prod 镜像包含 `node` 二进制 + 编译产物,但**不含 npm/pnpm/Astro 源码**。攻击面比 v1 大一个 node 进程,但远小于带完整开发环境的 dev 镜像。

---

## 1. 镜像策略:双镜像 + 多阶段构建

### 1.1 为什么双镜像(不是单镜像 + 运行时模式)

**安全考量(决定性因素)**:

- 博客系统是面向公网的服务,攻击面真实存在
- 单镜像(即使 prod 模式不启动 Node)仍包含 `node` / `npm` / `pnpm` / Astro 源码
- 容器被攻破后,攻击者可 `docker exec` 进去手动启动 Node / 安装恶意包
- 双镜像的 prod 镜像只有 `caddy + pb + 编译产物`,最小化攻击面

**镜像扫描**(Trivy / Snyk / GHCR 自带):

- 单镜像会报 Node 相关 CVE,即使用户不启动 Node
- 双镜像的 prod 镜像 CVE 数量大幅减少

### 1.2 prod vs dev 的差异

| 维度                        | prod                                | dev                     |
| --------------------------- | ----------------------------------- | ----------------------- |
| Caddy(HTTPS + 路由)         | ✅ 内嵌                             | ✅ 内嵌                 |
| pb 二进制                   | ✅                                  | ✅                      |
| Astro 编译产物(`/app/dist`) | ✅                                  | ✅                      |
| Node runtime                | ✅(跑 SSR server)                   | ✅                      |
| npm / pnpm                  | ❌                                  | ✅                      |
| Astro 源码(`/app/src`)      | ❌                                  | ✅                      |
| MCP / Skill                 | ❌                                  | ✅                      |
| Astro 运行模式              | `node ./dist/server/entry.mjs`(SSR) | `astro dev`(HMR 热重载) |
| Astro.cache                 | ✅(生效)                            | ❌(dev 下禁用)          |
| 镜像体积                    | ~120MB                              | ~200MB                  |
| VANBLOG_MODE 环境变量       | `prod`                              | `dev`                   |

**功能完全对齐**(都有 Caddy + pb + Node + 路由 + on-demand TLS),差异只在"是否支持源码热重载"。

### 1.3 一个 Dockerfile,两个 target

**关键**:不是两个 Dockerfile,而是**多阶段构建 + target**。维护成本等同单 Dockerfile。

```dockerfile
# ============ Stage 1: 编译 Astro ============
FROM node:20-alpine AS astro-build
WORKDIR /app
COPY app/ .
RUN pnpm install --frozen-lockfile && pnpm build

# ============ Stage 2: 编译 PocketBase ============
FROM golang:1.22-alpine AS pb-build
WORKDIR /vault
COPY vault/ .
RUN CGO_ENABLED=0 go build -o /pocketbase main.go

# ============ Stage 3: prod 镜像(最小化) ============
FROM alpine:3.19 AS prod
COPY --from=pb-build /pocketbase /usr/local/bin/
COPY --from=astro-build /app/dist /app/dist
RUN apk add --no-cache caddy ca-certificates tzdata
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/entrypoint.prod.sh /entrypoint.sh
ENV VANBLOG_MODE=prod
EXPOSE 80 443
ENTRYPOINT ["/entrypoint.sh"]

# ============ Stage 4: dev 镜像(继承 prod + Node) ============
FROM prod AS dev
RUN apk add --no-cache nodejs npm git
COPY --from=astro-build /app /app/src
COPY docker/entrypoint.dev.sh /entrypoint.dev.sh
ENV VANBLOG_MODE=dev
```

**构建命令**:

```bash
docker build --target prod -t ghcr.io/cornworld/vanblog:prod .
docker build --target dev  -t ghcr.io/cornworld/vanblog:dev .
```

### 1.4 CI/CD 流水线

**一次构建,两个 tag**:

```yaml
# .github/workflows/release.yml
jobs:
  build:
    strategy:
      matrix:
        target: [prod, dev]
    steps:
      - uses: docker/build-push-action@v5
        with:
          target: ${{ matrix.target }}
          tags: ghcr.io/cornworld/vanblog:${{ matrix.target }}-${{ github.ref_name }}
          platforms: linux/amd64,linux/arm64
```

---

## 2. entrypoint 脚本

### 2.1 prod entrypoint

```bash
#!/bin/sh
set -e

# 1. 启动 Caddy(用 Caddyfile 模板)
caddy start --config /etc/caddy/Caddyfile --adapter caddyfile

# 2. 启动 PocketBase
exec pocketbase serve \
  --http=127.0.0.1:8090 \
  --dir=/var/lib/pb_data \
  --hooksDir=/var/lib/pb_hooks \
  "$@"
```

**特点**:

- pb 只绑 `127.0.0.1:8090`,不对外(由 Caddy 反代)
- 无 Node 进程
- 无 dev server

### 2.2 dev entrypoint

```bash
#!/bin/sh
set -e

# 1. 启动 Caddy(同 prod)
caddy start --config /etc/caddy/Caddyfile --adapter caddyfile

# 2. 启动 PocketBase
pocketbase serve \
  --http=127.0.0.1:8090 \
  --dir=/var/lib/pb_data \
  --hooksDir=/var/lib/pb_hooks &

# 3. 启动 Astro dev server
cd /app/src
exec pnpm dev --host 127.0.0.1 --port 4321
```

**特点**:

- 额外启动 Astro dev server(监听 127.0.0.1:4321)
- 用户挂载 `/app/src` 可改源码,热重载
- Caddy 兜底反代到 4321

---

## 3. vanblog.sh —— 容器运维层

### 3.1 定位与信任域

**关键边界**(用户明确指出):

- `vanblog.sh` 运行在 **host 上**,有 docker/socket 权限
- Admin UI 运行在**容器内**,无权碰 host
- **Admin UI 永远不能直接 `docker-compose up`**

| 工具       | 运行位置         | 能力                                        | 信任域      |
| ---------- | ---------------- | ------------------------------------------- | ----------- |
| vanblog.sh | host(root)       | docker-compose / 镜像 / 数据卷 / 备份       | host 运维层 |
| Admin UI   | 容器内(pb_hooks) | 只能管 pb 数据 / Caddy admin API(127.0.0.1) | 应用层      |

### 3.2 继承原项目的形态

原项目 `vanblog.sh` 已验证的交互模式(curl 一键 + 菜单),**保持兼容**:

```
$ curl -L https://vanblog.example.com/vanblog.sh -o vanblog.sh && chmod +x vanblog.sh && ./vanblog.sh

    VanBlog 管理脚本 v1.0.0
    --- https://github.com/cornworld/vanblog ---
    1.  安装 VanBlog
    2.  修改配置
    3.  启动服务
    4.  停止服务
    5.  重启服务
    6.  更新
    7.  查看日志
    8.  卸载
    9.  重置 HTTPS 设置
    10. 备份 VanBlog
    11. 恢复 VanBlog
    12. 切换模式(prod ↔ dev)        ← 新增
    ————————————————-
    20. 更新此脚本
    30. 查看脚本使用说明
    0.  退出脚本
```

### 3.3 与原项目 vanblog.sh 的差异

| 功能            | 原项目                                                    | 新版                                                           |
| --------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| 安装            | 下载 docker-compose-template.yml + sed 替换               | 同,但支持选 prod/dev                                           |
| 镜像源          | 中国 IP 自动切换阿里云                                    | 继承,可选 GHCR / 阿里云                                        |
| 数据目录        | `/var/vanblog/data`                                       | 继承                                                           |
| 备份            | `tar czvf ./data`                                         | 继承(增:可选 `pb_data` + `site.sync` git push)                 |
| 模式切换        | ❌ 不存在                                                 | ✅ 新增,改 compose 的 image + environment                      |
| HTTPS 重置      | `docker-compose exec vanblog node /app/cli/resetHttps.js` | `docker-compose exec vanblog pocketbase admin hook resetHttps` |
| Dockerfile 管理 | ❌                                                        | ❌(仍只管 compose,不管 Dockerfile)                             |

### 3.4 安装流程(交互式)

```bash
install_vanblog() {
  # 1. 检查环境(root / docker / curl)
  pre_check

  # 2. 选模式
  echo "请选择安装模式:"
  echo "  [1] 标准版(prod,推荐新手,~80MB)"
  echo "  [2] 开发版(dev,支持二次开发,~150MB)"
  read -p "选择 [1]: " mode_choice
  case "$mode_choice" in
    2) VANBLOG_IMAGE="ghcr.io/cornworld/vanblog:dev"; VANBLOG_MODE="dev" ;;
    *) VANBLOG_IMAGE="ghcr.io/cornworld/vanblog:prod"; VANBLOG_MODE="prod" ;;
  esac

  # 3. 收集配置
  read -p "邮箱(用于 Let's Encrypt): " vanblog_email
  read -p "HTTP 端口 [80]: " http_port
  read -p "HTTPS 端口 [443]: " https_port

  # 4. 下载 compose 模板并替换占位符
  wget -O /var/vanblog/docker-compose.yml "$COMPOSE_URL"
  sed -i "s|{{IMAGE}}|$VANBLOG_IMAGE|g" /var/vanblog/docker-compose.yml
  sed -i "s|{{EMAIL}}|$vanblog_email|g" /var/vanblog/docker-compose.yml
  sed -i "s|{{HTTP_PORT}}|${http_port:-80}|g" /var/vanblog/docker-compose.yml
  sed -i "s|{{HTTPS_PORT}}|${https_port:-443}|g" /var/vanblog/docker-compose.yml
  sed -i "s|{{MODE}}|$VANBLOG_MODE|g" /var/vanblog/docker-compose.yml

  # 5. 启动
  cd /var/vanblog && docker-compose up -d
}
```

### 3.5 模式切换(新增)

```bash
switch_mode() {
  current=$(grep "image:" /var/vanblog/docker-compose.yml | awk '{print $2}')
  if echo "$current" | grep -q ":prod"; then
    new_image="ghcr.io/cornworld/vanblog:dev"
    new_mode="dev"
    echo "切换到开发版(将下载 ~150MB 额外 layer)"
  else
    new_image="ghcr.io/cornworld/vanblog:prod"
    new_mode="prod"
    echo "切换到标准版(将移除 Node 运行时)"
  fi

  read -p "确认切换? [y/N]: " confirm
  [ "$confirm" != "y" ] && exit 0

  sed -i "s|image:.*|image: $new_image|g" /var/vanblog/docker-compose.yml
  sed -i "s|VANBLOG_MODE=.*|VANBLOG_MODE=$new_mode|g" /var/vanblog/docker-compose.yml

  cd /var/vanblog
  docker-compose pull
  docker-compose down
  docker-compose up -d
}
```

---

## 4. docker-compose.yml 模板

```yaml
# 由 vanblog.sh 生成,用户一般不直接编辑
version: "3.8"

services:
  vanblog:
    image: {{IMAGE}}                    # ghcr.io/cornworld/vanblog:prod 或 :dev
    container_name: vanblog
    restart: unless-stopped
    environment:
      - VANBLOG_MODE={{MODE}}           # prod | dev
      - VANBLOG_EMAIL={{EMAIL}}         # Let's Encrypt 用
      - TZ=Asia/Shanghai
    ports:
      - "{{HTTP_PORT}}:80"
      - "{{HTTPS_PORT}}:443"
    volumes:
      - {{DATA_PATH}}/pb_data:/var/lib/pb_data
      - {{DATA_PATH}}/pb_hooks:/var/lib/pb_hooks
      - {{DATA_PATH}}/md_output:/var/lib/md_output    # 可选:site.output
      # dev 模式额外挂载(由 vanblog.sh 按模式添加)
      # - ./app/src:/app/src

  # 可选:Waline 评论系统独立容器
  # waline:
  #   image: lizhengmsocal/waline:latest
  #   ...

volumes:
  pb_data:
```

**设计原则**:

- 用户**不直接编辑** Dockerfile
- 用户**可以编辑** docker-compose.yml(加 Waline、改端口、加卷)
- `vanblog.sh config` 命令重新生成此文件(保留用户手动改动?待决,倾向:提示冲突让用户选)

---

## 5. 未来方向:本地 agent + 中央 Web 控制台

> **v1 不实现**,仅记录方向。用户提出的愿景。

### 5.1 问题

`vanblog.sh` 是 CLI,对新手不友好。但 Admin UI 又不能碰 host。

### 5.2 架构(v2 考虑)

```
┌─────────────────────────────────┐
│  中央 Web 控制台                 │
│  (vanblog.example.com/install)  │
│  - 可视化安装向导                │
│  - 多机管理                      │
│  - 版本/升级通知                 │
└────────────┬────────────────────┘
             │ HTTPS(用户 token)
             ▼
┌─────────────────────────────────┐
│  本地 agent(监听端口)           │
│  (host 上的轻量 daemon)          │
│  - 接收中央控制台指令             │
│  - 执行 docker-compose 操作      │
│  - 上报健康状态                  │
└────────────┬────────────────────┘
             │ docker.sock
             ▼
┌─────────────────────────────────┐
│  vanblog 容器                    │
└─────────────────────────────────┘
```

### 5.3 agent 能力

- 监听本地端口(如 `127.0.0.1:9090`)
- 只接受带 token 的请求(token 由中央控制台签发)
- 代理执行 `docker-compose up/down/pull/logs`
- 上报容器健康状态、磁盘、内存

### 5.4 安全考量

- agent **只绑 127.0.0.1**,不对外(由 SSH 隧道或 Cloudflare Tunnel 暴露给中央)
- 或 agent 主动 outbound 连接中央(WebSocket),不开入站端口
- token 一次性,安装完成后用户可禁用 agent

### 5.5 不在 v1 实现的理由

- `vanblog.sh` 已经覆盖 90% 运维场景
- agent + 中央控制台是独立项目级工作量
- 需要运营成本(中央服务器的托管、token 管理)
- v1 应先证明重构后的 vanblog 本身可行,再加运维增强

---

## 6. 升级路径

### 6.1 版本升级

```bash
./vanblog.sh update
# 等价于:
#   docker-compose pull
#   docker-compose down
#   docker-compose up -d
```

**升级前自动备份**:

```bash
update() {
  # 1. 备份当前数据
  backup    # tar czvf ./pb_data

  # 2. 拉新镜像
  docker-compose pull

  # 3. 重启
  docker-compose down
  docker-compose up -d

  # 4. 验证健康
  sleep 5
  curl -sf http://localhost:8090/api/health || echo "⚠️ 健康检查失败"
}
```

### 6.2 模式升级(prod → dev)

用户开始用 prod,后来想二次开发:

```bash
./vanblog.sh switch-mode dev
```

### 6.3 数据迁移(原 Vanblog 用户)

见 [`migration-path.md`](./migration-path.md):

1. 原后台导出 `temp.json`
2. 用 vanblog.sh 安装新 vanblog
3. 新后台 → 迁移 → 上传 JSON

---

## 7. 安全模型汇总

| 层   | 组件                       | 权限                     | 防护                                                                           |
| ---- | -------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| host | vanblog.sh                 | root(管 docker)          | 必须 root 运行,用户自己负责                                                    |
| 容器 | entrypoint.sh              | root(容器内)             | Docker capability 最小化(待细化为 `--cap-drop ALL --cap-add NET_BIND_SERVICE`) |
| 容器 | Caddy                      | 非 root(user caddy)      | admin API 只绑 127.0.0.1:2019                                                  |
| 容器 | pb                         | 非 root(user pb)         | 只绑 127.0.0.1:8090,由 Caddy 反代                                              |
| 容器 | Astro dev server(dev 模式) | 非 root                  | 只绑 127.0.0.1:4321                                                            |
| 应用 | Admin UI                   | pb auth                  | 基于 pb Rule,无 host 访问                                                      |
| 应用 | 路由配置                   | pb auth + vanblog 中间层 | SSRF 白名单 + audit(见 routing-strategy.md)                                    |

**信任域隔离**:Admin UI 被攻破 ≠ host 被攻破。攻击者拿到 pb admin token 也无法 `docker-compose down` 或访问 host 文件系统。

---

## 8. 待决细节

1. **docker-compose.yml 用户手动改动的保留**:`vanblog.sh config` 重生成时,是否保留用户手动加的 Waline 容器 / 卷?(倾向:解析旧文件,提示冲突)
2. **中国镜像源**:GHCR 在中国可能被墙,阿里云 / 腾讯云镜像同步策略
3. **ARM 支持**:pb Go 二进制 + Caddy 都支持 arm64,Node 镜像也支持,验证多架构构建
4. **capability 最小化**:`docker-compose.yml` 里加 `cap_drop: [ALL]` + `cap_add: [NET_BIND_SERVICE]` 是否影响 Caddy bind 80/443
5. **只读根文件系统**:`read_only: true` + 必要的 tmpfs 挂载(进一步减小攻击面)
