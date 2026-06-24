# 部署指南

## Quick Start

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
