# 部署指南

## Quick Start

### 路径一:一键脚本(推荐新手)

```bash
curl -L https://raw.githubusercontent.com/cornworld/vanblog/main/vanblog.sh -o vanblog.sh
chmod +x vanblog.sh
./vanblog.sh
```

脚本会引导你输入邮箱、端口,自动生成 `docker-compose.yml` 并启动。后续管理(重启、备份、更新)都通过同一个脚本。完整命令列表见 `./vanblog.sh help`。

> **可选依赖 gum**:脚本检测到 [Charm gum](https://github.com/charmbracelet/gum) 会启用 TUI 模式(箭头选择 / 输入框 / 进度 spinner),否则自动 fallback 到 `read` 模式。安装:
>
> - macOS: `brew install gum`
> - Linux: 参考 [gum README](https://github.com/charmbracelet/gum#installation)

## S3 / 对象存储配置

容器启动后,通过 pb Admin UI (`/_/`) 编辑 **`site_secrets`** 集合（admin-only）的 `s3Config` JSON 字段即可启用 S3 上传。`site` 集合公开可读,密钥一律不放那里;对 `site` 行误写入的密钥字段会被平台钩子自动剥离并移入 `site_secrets`:

```json
{
  "enabled": true,
  "bucket": "your-bucket",
  "region": "us-east-1",
  "endpoint": "https://s3.amazonaws.com",
  "accessKey": "...",
  "secret": "...",
  "forcePathStyle": false
}
```

- 修改后无需重启容器 —— vanblog 的 site 更新 hook 会自动同步到 pb settings,后续上传立即走 S3。
- 兼容 S3 协议的任何后端:AWS S3、Cloudflare R2、阿里云 OSS、腾讯 COS、MinIO 等(MinIO/OSS/COS 请设 `forcePathStyle: true`)。
- **安全提示**:`secret` 在 pb_data SQLite 中明文存储。生产环境建议对 `/pb_data` 卷启用 LUKS / BitLocker,或使用 KMS 加密。

### 路径二:手动编辑 docker-compose.yml

```bash
# Build prod image
docker build --target prod -t vanblog:prod .

# Run
docker run -d \
  -p 80:80 -p 443:443 \
  -v $(pwd)/pb_data:/pb_data \
  -v $(pwd)/caddy_data:/data/caddy \
  -e VANBLOG_EMAIL=you@example.com \
  vanblog:prod
```

或者直接用仓库自带的 `docker-compose.yml`:

```bash
VANBLOG_EMAIL=you@example.com docker compose up -d
```

### Volumes

| Mount point   | Purpose                                       | Required    |
| ------------- | --------------------------------------------- | ----------- |
| `/pb_data`    | PocketBase database (SQLite) + uploaded files | **Yes**     |
| `/data/caddy` | Caddy TLS certificates + ACME state           | Recommended |

### Ports

| Port   | Protocol | Purpose                                                       | Expose by default |
| ------ | -------- | ------------------------------------------------------------- | ----------------- |
| `443`  | HTTPS    | Main site (on-demand TLS)                                     | Yes               |
| `80`   | HTTP     | Redirect to HTTPS                                             | Yes               |
| `8080` | HTTP     | **Management fallback** (emergency access when TLS is broken) | No                |

**Management port (8080)**: Exposes `/api/*`, `/_/*`（pb Admin UI）和 `/admin/*`（Astro 管理后台，含其 `/_astro/*` 静态——Caddy file_server 同样挂在 :8080 上）。The public frontend is NOT served. Use this when you're locked out due to TLS misconfiguration:

```bash
# Restart with management port mapped
docker run -d -p 80:80 -p 443:443 -p 8080:8080 \
  -v $(pwd)/pb_data:/pb_data \
  -v $(pwd)/caddy_data:/data/caddy \
  vanblog:prod

# Access admin via HTTP (bypasses TLS)
# http://YOUR_IP:8080/admin/    (Astro admin page)
# http://YOUR_IP:8080/_/        (pb Admin UI)
```

或者直接:`./vanblog.sh maintenance`(脚本会自动添加 8080 映射并重启容器)。


## 进程权限（非 root 运行）

容器内三个服务（Caddy / PocketBase / theme host，含可选 Artalk）全部以专用用户 **`vanblog`（uid/gid 1000）** 运行：

- 容器仍以 root **启动**（docker 默认），但 entrypoint 只用 root 做一件事：把运行时可写目录（`/pb_data`、`/data/caddy`、`/data/artalk`、`/var/lib/vanblog`、`/var/log`）`chown` 给 `vanblog`，随后经 `su-exec` 降权**重新执行自身**——之后任何服务都不再以 root 运行。这是老版本（root 时代）数据卷的无感升级路径。
- Caddy 绑定特权端口 `:80/:443` 依赖镜像内 `setcap cap_net_bind_service=+ep`（文件能力），**无需** `--cap-add=NET_BIND_SERVICE`。
- 升级首次启动时，bind mount 的宿主目录属主会被改为 `1000:1000`（`vanblog.sh` 生成的部署即此形态）；宿主 root 仍可正常读写与备份。
- 可直接 `--user 1000:1000` 启动（跳过 root 阶段），前提是卷属主已是 1000。
- `docker exec` 默认用户仍是镜像默认（root）；`vanblog.sh pack ...` 走该路径，落盘文件为 root 属主，对只读消费方（PB/hooks）无影响。

## HTTP_ONLY 模式(外置反代用户)

已有 Traefik / Nginx Proxy Manager / Cloudflare Tunnel / K8s Inress 的用户,可以让外置反代终止 TLS,容器内只跑 HTTP:

```bash
docker run -d \
  -p 80:80 \
  -v $(pwd)/pb_data:/pb_data \
  -e VANBLOG_EMAIL=you@example.com \
  -e VANBLOG_HTTP_ONLY=1 \
  vanblog:prod
```

设 `VANBLOG_HTTP_ONLY=1` 后:

- 容器内 Caddy 只监听 `:80`,完全不配 TLS app,不再请求 Let's Encrypt 证书。
- 外置反代必须传递 `X-Forwarded-Proto: https`(否则 Astro 生成的 canonical URL 会错为 `http://`)。
- `/api/vanblog/tls/status` 自动降级返回 `onDemandTLS: false`。

最小外置 Caddy 反代示例:

```caddyfile
example.com {
    reverse_proxy vanblog:80
}
```

## Development

```bash
# Build dev image
docker build --target dev -t vanblog:dev .

# Run with source mounted
docker run -d \
  -p 80:80 -p 443:443 -p 4321:4321 \
  -v $(pwd)/pb_data:/pb_data \
  -v $(pwd)/caddy_data:/data/caddy \
  -v $(pwd)/app/src:/app/src/src \
  -v $(pwd)/pb_hooks:/pb_hooks \
  -e VANBLOG_EMAIL=you@example.com \
  vanblog:dev
```

## Architecture

```
Request → Caddy (:80/:443)
           ├── /api/*       → PocketBase (:8090)
           ├── /_/          → PocketBase Admin UI
           ├── /themes/*    → Caddy file_server（主题静态：_astro immutable，稳定文件 must-revalidate）
           ├── /pack-static/* → PocketBase（Pack 前端资产，活目录直出 + ETag 重验）
           ├── /_astro/* + /emoji-data.json + /robots.txt → Caddy file_server（admin 静态）
           └── /*           → theme host (:4321)
                                ├── /admin /login /setup → admin SSR（app/dist）
                                └── 其余 → 激活主题 SSR
```

> **运行时新增主题**：把新主题（含 `dist/`）放进 `VANBLOG_THEMES_DIR` 后，Caddy 的 `/themes/<name>/` 静态路由在 config-build 时枚举——**prod 下由 fsnotify 自动检测目录变化并触发重扫**（无需手动）。后台「站点配置 → 外观」的「重新加载主题」按钮（等价 `POST /api/vanblog/themes/reload`）保留为手动兜底。
