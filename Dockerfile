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

# --- Stage 2: Build Astro frontend + SDK ---
FROM node:20-alpine AS astro-build
RUN corepack enable pnpm
WORKDIR /build

# Copy workspace root + sdk + app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY sdk/ ./sdk/
COPY app/package.json app/astro.config.mjs app/tsconfig.json ./app/
COPY app/src/ ./app/src/
COPY app/public/ ./app/public/ 2>/dev/null || true

# Install deps (monorepo)
RUN pnpm install --frozen-lockfile

# Build SDK first
RUN pnpm --filter sdk build

# Build Astro
RUN pnpm --filter vanblog-app build
# Output: /build/app/dist/

# --- Stage 3: PROD image (Caddy + pb + Node SSR) ---
FROM alpine:3.19 AS prod

# Install Caddy + Node.js (for Astro SSR) + ca-certificates
RUN apk add --no-cache caddy nodejs ca-certificates tzdata

# Copy Go binary
COPY --from=go-build /pocketbase /usr/local/bin/vanblog

# Copy Astro build output (SSR server + static client)
COPY --from=astro-build /build/app/dist /app/dist

# Copy pb_hooks (JSVM hooks: system.pb.js, examples.pb.js)
COPY vault/pb_hooks /pb_hooks

# Copy Caddyfile
COPY docker/Caddyfile.prod /etc/caddy/Caddyfile

# Copy entrypoint
COPY docker/entrypoint.prod.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create data directories
RUN mkdir -p /pb_data /data/caddy /var/log

ENV VANBLOG_MODE=prod
# 80  = HTTP → redirect to HTTPS
# 443 = HTTPS (main site)
# 8080 = management port (HTTP fallback)
EXPOSE 80 443 8080

VOLUME ["/pb_data", "/data/caddy"]

ENTRYPOINT ["/entrypoint.sh"]

# --- Stage 4: DEV image (extends prod + full Node toolchain + source) ---
FROM prod AS dev

RUN apk add --no-cache npm git

# Copy Astro + SDK source for dev server
COPY --from=astro-build /build/sdk /sdk
COPY --from=astro-build /build/app /app/src
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml /
COPY sdk/ /sdk/
COPY app/ /app/src/

WORKDIR /
RUN pnpm install --frozen-lockfile || npm install || true

# Copy dev Caddyfile + entrypoint
COPY docker/Caddyfile.dev /etc/caddy/Caddyfile
COPY docker/entrypoint.dev.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV VANBLOG_MODE=dev
EXPOSE 80 443 4321 8080

ENTRYPOINT ["/entrypoint.sh"]
