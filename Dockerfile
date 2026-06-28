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
FROM node:22-alpine AS astro-build
RUN corepack enable pnpm
WORKDIR /build

# Copy workspace root + sdk + app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY sdk/ ./sdk/
COPY app/package.json app/astro.config.mjs app/tsconfig.json ./app/
COPY app/src/ ./app/src/
COPY app/public/ ./app/public/

# Install deps (monorepo)
RUN pnpm install --no-frozen-lockfile

# Build SDK first
RUN pnpm --filter sdk build

# Build Astro
RUN pnpm --filter vanblog-app build
# Output: /build/app/dist/

# --- Stage 3: PROD image (Caddy + pb + Node SSR) ---
FROM alpine:3.21 AS prod

# Install Caddy + Node.js (for Astro SSR) + ca-certificates
RUN apk add --no-cache caddy nodejs ca-certificates tzdata

# Copy Go binary
COPY --from=go-build /pocketbase /usr/local/bin/vanblog

# Copy the whole astro-build workspace so the pnpm symlink layout (app/node_modules/<pkg>
# → ../../node_modules/.pnpm/...) resolves correctly at the same depth.
# Astro Node SSR externalizes deps (isomorphic-dompurify, etc.) — keep node_modules.
COPY --from=astro-build /build /build
# Symlink so entrypoint's `cd /app/dist` works without changing the script.
RUN ln -s /build/app /app

# Copy pb_hooks (JSVM hooks: system.pb.js, examples.pb.js)
COPY vault/pb_hooks /pb_hooks

# Copy bootstrap.json (minimal maintenance-mode config for Caddy startup)
# and the legacy Caddyfile as a fallback for VANBLOG_CADDY_MODE=legacy.
COPY docker/bootstrap.json /etc/caddy/bootstrap.json
COPY docker/Caddyfile.legacy.prod /etc/caddy/Caddyfile.legacy

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

# Copy dev entrypoint (bootstrap.json was already COPYed in the prod stage;
# Caddyfile.legacy.dev is copied as a fallback for VANBLOG_CADDY_MODE=legacy)
COPY docker/Caddyfile.legacy.dev /etc/caddy/Caddyfile.legacy.dev
COPY docker/entrypoint.dev.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV VANBLOG_MODE=dev
EXPOSE 80 443 4321 8080

ENTRYPOINT ["/entrypoint.sh"]
