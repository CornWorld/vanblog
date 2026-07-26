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
WORKDIR /build
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

# Validate the requested theme exists before paying for the install step.
RUN if [ ! -d "themes/${VANBLOG_ACTIVE_THEME}" ]; then \
      echo "ERROR: themes/${VANBLOG_ACTIVE_THEME}/ not found. Available:"; \
      ls themes/ 2>/dev/null; \
      exit 1; \
    fi

# Build SDK first — themes import from @vanblog/sdk.
RUN pnpm --filter sdk build

# Build the active theme as the canonical Astro project for this image.
# The theme's astro.config.mjs wires both packs() and themes() integrations,
# and emits dist/server/entry.mjs at themes/${VANBLOG_ACTIVE_THEME}/dist/.
RUN cd "themes/${VANBLOG_ACTIVE_THEME}" && pnpm build

# Record the compiled theme so the prod entrypoint can compare against
# site.activeTheme and surface a "rebuild required" warning when operators
# flip the field without rebuilding.
RUN echo "${VANBLOG_ACTIVE_THEME}" > /build/.active-theme
# Output: /build/themes/${VANBLOG_ACTIVE_THEME}/dist/

# Build Pack schema artifacts (schema.ts -> schema.js) for any Pack that ships one.
# The Go runtime reads schema.js from the Pack fs.FS to validate Pack-owned models.
RUN for pack in packs/*/; do \
      if [ -f "$pack/schema.ts" ]; then \
        node scripts/pack-schema-build.mjs "$pack"; \
      fi; \
    done

# --- Stage 5: PROD image (Caddy + pb + Node SSR) ---
FROM alpine:3.21 AS prod

# Install Caddy + Node.js (for Astro SSR) + ca-certificates
RUN apk add --no-cache caddy nodejs ca-certificates tzdata

# Copy Go binary and the separately-built core schema artifact.
COPY --from=go-build /pocketbase /usr/local/bin/vanblog
COPY --from=go-build /core/models.js /core/models.js

# Copy the whole astro-build workspace so the pnpm symlink layout (app/node_modules/<pkg>
# → ../../node_modules/.pnpm/...) resolves correctly at the same depth.
# Astro Node SSR externalizes deps (isomorphic-dompurify, etc.) — keep node_modules.
COPY --from=astro-build /build /build
# Surface the compiled active theme at /app so entrypoint.prod.sh can keep
# using `cd /app/dist`. The active theme name is recorded by the astro-build
# stage in /build/.active-theme.
COPY --from=astro-build /build/.active-theme /etc/vanblog/active-theme
RUN ln -s "/build/themes/$(cat /etc/vanblog/active-theme)" /app

# Copy core hooks and builtin Pack resources (with schema.js artifacts built in
# the astro-build stage — the Go runtime reads schema.js from /packs/<name>/).
COPY vault/pb_hooks /pb_hooks
COPY --from=astro-build /build/packs /packs

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
