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

# --- Stage 2: Build the generated core schema runtime artifact ---
FROM workspace-deps AS models-build
COPY models.config.mjs ./
COPY sdk/src/models/ ./sdk/src/models/
RUN pnpm build:models

# --- Stage 3: Build Go binary (PocketBase + vanblog SDK) ---
FROM golang:alpine AS go-build
ARG GOPROXY
ENV GOPROXY=${GOPROXY}

# Install git for cloning caddyadmin (replace directive target).
RUN apk add --no-cache git

WORKDIR /build

# vault/go.mod has `replace github.com/CornWorld/caddyadmin => ../../caddyadmin`.
# In Docker the build workspace is /build, so the replace target resolves to
# /caddyadmin. Clone it there before go mod download runs.
RUN git clone --depth=1 https://github.com/CornWorld/caddyadmin.git /caddyadmin

COPY vault/go.mod vault/go.sum ./
RUN go mod download
COPY vault/ ./
COPY packs/ /packs/
# The Go binary consumes this artifact at runtime; it is not compiled into the binary.
COPY --from=models-build /build/runtime/core-schema/models.js /core/models.js
RUN CGO_ENABLED=0 go build -o /pocketbase -ldflags="-s -w" .

# --- Stage 4: Build Astro frontend + SDK ---
# Each Vanblog theme is an independent Astro project that imports builtin
# files via the `@vanblog/builtin/*` alias (resolved by
# app/integrations/themes/index.mjs). The build must therefore run inside
# the active theme directory — the default theme mirrors app/src/ via thin
# re-export shells. VANBLOG_ACTIVE_THEME selects which theme gets compiled
# into the prod image; entrypoint.prod.sh compares it against site.activeTheme
# at startup so operators cannot silently serve a stale theme.
FROM workspace-deps AS astro-build
ARG NPM_MIRROR
ARG VANBLOG_ACTIVE_THEME=default

COPY sdk/ ./sdk/
COPY app/ ./app/
COPY packs/ ./packs/
COPY scripts/ ./scripts/
COPY models.config.mjs ./models.config.mjs
COPY themes/ ./themes/

# Validate at least one theme directory exists.
RUN ls themes/ > /dev/null

# Build SDK first — themes import from @vanblog/sdk.
RUN pnpm --filter sdk build

# Build ALL themes (not just the active one).
# Each theme's astro.config.mjs reads VANBLOG_THEME_NAME to set base/assetsPrefix.
RUN for theme in themes/*/; do \
      name=$(basename "$theme"); \
      if [ -f "$theme/astro.config.mjs" ]; then \
        echo "Building theme: $name"; \
        (cd "$theme" && VANBLOG_THEME_NAME="$name" pnpm build) || exit 1; \
      fi; \
    done

# Record the default theme so the prod entrypoint knows which one to start.
ARG VANBLOG_ACTIVE_THEME=default
RUN echo "${VANBLOG_ACTIVE_THEME}" > /build/.default-theme

# Build Pack schema artifacts (schema.ts -> schema.js) for any Pack that ships one.
# The Go runtime reads schema.js from the Pack fs.FS to validate Pack-owned models.
RUN for pack in packs/*/; do \
      if [ -f "$pack/schema.ts" ]; then \
        node scripts/pack-schema-build.mjs "$pack"; \
      fi; \
    done

# --- Stage 5: PROD image (Caddy + pb + Node SSR) ---
FROM alpine:3.21 AS prod

WORKDIR /app

# Install Caddy + Node.js (for Astro SSR) + ca-certificates
RUN apk add --no-cache caddy nodejs ca-certificates tzdata

# Copy Go binary and the separately-built core schema artifact.
COPY --from=go-build /pocketbase /usr/local/bin/vanblog
COPY --from=go-build /core/models.js /core/models.js

# Copy the whole astro-build workspace so the pnpm symlink layout resolves.
COPY --from=astro-build /build /build

# Copy built themes (all of them, not just active).
# Each theme has its own dist/ with server/entry.mjs + client/ assets.
COPY --from=astro-build /build/.default-theme /etc/vanblog/default-theme
# No more symlink — the dispatcher (Phase B) or entrypoint reads default-theme.
# Copy the theme dispatcher (ESM module, no compilation needed).
COPY --from=astro-build /build/app/src/dispatcher/index.mjs /app/dispatcher.mjs

# Copy core hooks and builtin Pack resources (with schema.js artifacts built in
# the astro-build stage — the Go runtime reads schema.js from /packs/<name>/).
COPY vault/pb_hooks /pb_hooks
COPY --from=astro-build /build/packs /packs

# Copy palettes directory (used by /api/palettes and /api/palette.css endpoints
# to enumerate and serve palette CSS at runtime).
COPY hooks/ /build/hooks/

# Copy bootstrap.json (minimal maintenance-mode config for Caddy startup)
COPY docker/bootstrap.json /etc/caddy/bootstrap.json
COPY docker/bootstrap-http-only.json /etc/caddy/bootstrap-http-only.json

# Copy entrypoint
COPY docker/entrypoint.prod.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create data directories + symlink themes to the path dispatcher expects.
# astro-build emits /build/themes/<name>/dist/; dispatcher reads /var/lib/vanblog/themes/.
RUN mkdir -p /pb_data /data/caddy /var/log /var/lib/vanblog && \
    ln -s /build/themes /var/lib/vanblog/themes

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
# resolve app/integrations, root packs/, themes/, and the workspace SDK consistently.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc /workspace/
COPY sdk/ /workspace/sdk/
COPY app/ /workspace/app/
COPY packs/ /workspace/packs/
COPY themes/ /workspace/themes/
COPY scripts/ /workspace/scripts/
COPY models.config.mjs /workspace/models.config.mjs

WORKDIR /workspace
RUN pnpm install --frozen-lockfile

# Copy dev entrypoint (bootstrap.json was already COPYed in the prod stage)
COPY docker/entrypoint.dev.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV VANBLOG_MODE=dev
EXPOSE 80 443 4321 8080

ENTRYPOINT ["/entrypoint.sh"]
