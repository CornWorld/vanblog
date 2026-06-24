# Vanblog

Docker-only build. No local Go/Node required.

## Quick Start

```bash
# Build prod image
docker build --target prod -t vanblog:prod .

# Run
docker run -d \
  -p 80:80 -p 443:443 \
  -v $(pwd)/pb_data:/pb_data \
  -e VANBLOG_EMAIL=you@example.com \
  vanblog:prod
```

## Development

```bash
# Build dev image
docker build --target dev -t vanblog:dev .

# Run with source mounted
docker run -d \
  -p 80:80 -p 443:443 -p 4321:4321 \
  -v $(pwd)/pb_data:/pb_data \
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
