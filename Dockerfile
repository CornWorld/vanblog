# ============================================================================
# Vanblog Dockerfile — Multi-stage build for prod and dev targets
# ============================================================================
#
# Build:
#   docker build --target prod -t vanblog:prod .
#   docker build --target dev  -t vanblog:dev .
#
#   # With mirror (China):
#   docker build --target dev --build-arg GOPROXY=https://goproxy.cn,direct \
#                --build-arg NPM_MIRROR=https://registry.npmmirror.com -t vanblog:dev .
#
# Run:
#   docker run -p 80:80 -p 443:443 -v $(pwd)/pb_data:/pb_data vanblog:prod
#
# Layer notes:
#   - ARGs declared per-stage so cache-reuse is maximized.
#   - GOPROXY/NPM_MIRROR only invalidate the download layer, not earlier COPY steps.
#

# --- Stage 1: Install shared Node workspace dependencies ---
FROM node:lts-alpine AS workspace-deps
ARG NPM_MIRROR
RUN corepack enable pnpm
WORKDIR /build

# Keep dependency installation independent from application and model sources.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY sdk/package.json ./sdk/package.json
COPY app/package.json ./app/package.json
RUN pnpm config set store-dir /pnpm/store && \
    if [ -n "$NPM_MIRROR" ]; then \
      pnpm config set registry "$NPM_MIRROR"; \
    fi && \
    pnpm install --frozen-lockfile

# --- Stage 2: Build the generated model bundle embedded by Go ---
FROM workspace-deps AS models-build
COPY models.config.mjs ./
COPY sdk/src/models/ ./sdk/src/models/
RUN pnpm build:models

# --- Stage 3: Build Go binary (PocketBase + vanblog SDK) ---
FROM golang:alpine AS go-build
ARG GOPROXY
ENV GOPROXY=${GOPROXY}
WORKDIR /build
COPY vault/go.mod vault/go.sum ./
RUN go mod download
COPY vault/ ./
COPY packs/ /packs/
COPY --from=models-build /build/vault/internal/validation/models.js ./internal/validation/models.js
RUN CGO_ENABLED=0 go build -o /pocketbase -ldflags="-s -w" .

# --- Stage 4: Build Astro frontend + SDK ---
FROM workspace-deps AS astro-build
COPY sdk/ ./sdk/
COPY app/ ./app/
COPY packs/ ./packs/

# Build SDK first
RUN pnpm --filter sdk build

# Build Astro
RUN pnpm --filter vanblog-app build
# Output: /build/app/dist/

# --- Stage 5: PROD image (Caddy + pb + Node SSR) ---
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

# Copy core hooks, external builtin Pack resources, and the remaining legacy
# Moments plugin compatibility package.
COPY vault/pb_hooks /pb_hooks
COPY packs /packs
COPY plugins /plugins

# Copy bootstrap.json (minimal maintenance-mode config for Caddy startup)
COPY docker/bootstrap.json /etc/caddy/bootstrap.json
COPY docker/bootstrap-http-only.json /etc/caddy/bootstrap-http-only.json

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

# --- Stage 6: DEV image (extends prod + full Node toolchain + source) ---
FROM prod AS dev

RUN apk add --no-cache npm git && npm install -g pnpm@latest-10

# Keep the dev workspace layout identical to the source workspace so Astro can
# resolve app/integrations, root packs/, and the workspace SDK consistently.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc /workspace/
COPY sdk/ /workspace/sdk/
COPY app/ /workspace/app/
COPY packs/ /workspace/packs/

WORKDIR /workspace
RUN pnpm install --frozen-lockfile

# Copy dev entrypoint (bootstrap.json was already COPYed in the prod stage)
COPY docker/entrypoint.dev.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV VANBLOG_MODE=dev
EXPOSE 80 443 4321 8080

ENTRYPOINT ["/entrypoint.sh"]
