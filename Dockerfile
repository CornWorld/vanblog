# ============================================================================
# Vanblog Dockerfile — Multi-stage build for prod and dev targets
# ============================================================================
#
# Build:
#   docker build --target prod -t vanblog:prod .
#   docker build --target dev  -t vanblog:dev .
#
# Run:
#   docker run -p 80:80 -p 443:443 -v $(pwd)/pb_data:/pb_data vanblog:prod
#

# --- Stage 1: Build Go binary (PocketBase + vanblog SDK) ---
FROM golang:alpine AS go-build
WORKDIR /build
COPY vault/go.mod vault/go.sum ./
RUN go mod download
COPY vault/ ./
RUN CGO_ENABLED=0 go build -o /pocketbase -ldflags="-s -w" .

# --- Stage 2: Build Astro frontend ---
FROM node:20-alpine AS astro-build
WORKDIR /app
COPY app/package.json app/pnpm-lock.yaml* app/package-lock.json* ./
RUN corepack enable && \
    (pnpm install --frozen-lockfile 2>/dev/null || \
     npm ci 2>/dev/null || \
     npm install)
COPY app/ ./
RUN (pnpm build 2>/dev/null || npm run build)
# Output: /app/dist/

# --- Stage 3: PROD image (minimal, no Node runtime) ---
FROM alpine:3.19 AS prod

# Install Caddy + ca-certificates (for Let's Encrypt)
RUN apk add --no-cache caddy ca-certificates tzdata

# Copy Go binary
COPY --from=go-build /pocketbase /usr/local/bin/vanblog

# Copy Astro static build
COPY --from=astro-build /app/dist /app/dist

# Copy pb_hooks (JSVM hooks: system.pb.js, examples.pb.js)
COPY vault/pb_hooks /pb_hooks

# Copy Caddyfile templates
COPY docker/Caddyfile.prod /etc/caddy/Caddyfile

# Copy entrypoint
COPY docker/entrypoint.prod.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create data directories
# /pb_data = PocketBase database + uploads
# /data/caddy = Caddy TLS certificates + ACME state (persist across restarts)
RUN mkdir -p /pb_data /data/caddy /var/log

ENV VANBLOG_MODE=prod
EXPOSE 80 443

# Persist pb_data + caddy certs across container restarts
VOLUME ["/pb_data", "/data/caddy"]

ENTRYPOINT ["/entrypoint.sh"]

# --- Stage 4: DEV image (extends prod + Node runtime + source) ---
FROM prod AS dev

RUN apk add --no-cache nodejs npm git

# Copy Astro source for dev server
COPY --from=astro-build /app /app/src
COPY app/package.json app/pnpm-lock.yaml* /app/src/

WORKDIR /app/src
RUN npm install 2>/dev/null || true

# Copy dev Caddyfile + entrypoint
COPY docker/Caddyfile.dev /etc/caddy/Caddyfile
COPY docker/entrypoint.dev.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /

ENV VANBLOG_MODE=dev
EXPOSE 80 443 4321

ENTRYPOINT ["/entrypoint.sh"]
