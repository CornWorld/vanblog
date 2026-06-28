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
> - macOS: `brew install gum`
> - Linux: 参考 [gum README](https://github.com/charmbracelet/gum#installation)

## S3 / 对象存储配置

容器启动后,通过 pb Admin UI (`/_/`) 编辑 `site` 集合的 `s3Config` JSON 字段即可启用 S3 上传:

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

| Mount point | Purpose | Required |
|---|---|---|
| `/pb_data` | PocketBase database (SQLite) + uploaded files | **Yes** |
| `/data/caddy` | Caddy TLS certificates + ACME state | Recommended |

### Ports

| Port | Protocol | Purpose | Expose by default |
|---|---|---|---|
| `443` | HTTPS | Main site (on-demand TLS) | Yes |
| `80` | HTTP | Redirect to HTTPS | Yes |
| `8080` | HTTP | **Management fallback** (emergency access when TLS is broken) | No |

**Management port (8080)**: Only exposes `/api/*`, `/admin/*`, and `/_/*` (pb Admin UI). The public frontend is NOT served. Use this when you're locked out due to TLS misconfiguration:

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
           ├── /api/*      → PocketBase (:8090)
           ├── /static/*   → PocketBase (:8090)
           ├── /_/         → PocketBase Admin UI
           └── /*          → Astro SSG (/app/dist) or dev server (:4321)
```
