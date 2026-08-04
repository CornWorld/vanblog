# ============================================================================
# Vanblog 根 Makefile — 统一的开发/构建入口
#
# 用法:
#   make help           显示此帮助
#   make dev-go         运行 Go 后端 (开发模式)
#   make dev-astro      启动 Astro 前端开发服务器
#   make dev            同时启动前后端开发模式
#   make build          构建所有产物 (models → Go → Astro)
#   make test           运行所有测试
#   make vet            运行 Go 静态分析
#   make docker         构建生产 Docker 镜像
#   make clean          清理构建产物
#
# 不覆盖现有的工具链:
#   - vault/Makefile → Go 构建细节委托给 $(MAKE) -C vault
#   - vanblog.sh     → 部署/运维脚本, 保持独立
#   - pnpm scripts   → 前端构建保持原样
# ============================================================================

# Source files that feed into models.js (triggers incremental rebuild)
MODEL_SOURCES := $(wildcard sdk/src/models/*.ts)

.PHONY: help dev dev-go dev-astro build build-go build-astro test vet docker clean
# build-models is NOT in .PHONY — it tracks models.js freshness via its prerequisites.

# --- Help ---

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  dev           Start Astro dev server (Go backend runs separately via 'make dev-go')"
	@echo "  dev-go        Run Go backend locally (builds models.js first if missing)"
	@echo "  dev-astro     Start Astro dev server (pnpm dev)"
	@echo "  build         Build all artifacts (models → Go binary → Astro)"
	@echo "  test          Run all tests (Go tests + model type/fixture tests)"
	@echo "  vet           Run go vet -all + staticcheck (strict static analysis)"
	@echo "  docker        Build production Docker image (docker buildx)"
	@echo "  clean         Remove all build artifacts"

# --- Development ---

# Generate core schema artifact (incremental — only when sources change)
runtime/core-schema/models.js: $(MODEL_SOURCES)
	pnpm build:models

# Run Go backend in dev mode
dev-go: runtime/core-schema/models.js
	cd vault && go run . --dev --coreSchemaPath ../runtime/core-schema/models.js

# Start Astro dev server
dev-astro:
	pnpm dev

# Run Astro dev server; Go backend must be started separately (make dev-go).
dev: dev-astro
	@echo ""
	@echo "ℹ Next: open another terminal and run 'make dev-go' to start the Go backend."
	@echo "  Astro dev server is running at http://localhost:4321"

# --- Build (production) ---

build-models: runtime/core-schema/models.js
	@# models.js is up to date

build-go: build-models
	$(MAKE) -C vault build

build-astro:
	pnpm --filter vanblog-app build

# Full production build
build: build-models build-go build-astro
	@echo "✓ Build complete"

# --- Validation ---

test:
	@fail=0; \
	(cd vault && go test ./... -count=1) || fail=1; \
	pnpm test:models:types || fail=1; \
	pnpm test:models:fixtures || fail=1; \
	[ "$$fail" -eq 0 ] || { echo "✗ 部分测试套件失败（详见上方输出）"; exit 1; }

# Strict static analysis gate: all vet analyzers + staticcheck (U1000/dead
# code, style, deprecated usage). staticcheck install:
#   go install honnef.co/go/tools/cmd/staticcheck@latest
vet:
	cd vault && go vet -all ./... && "$$(go env GOPATH)/bin/staticcheck" ./...

# --- Docker ---

docker:
	docker build --target prod -t vanblog:prod .

# --- Clean ---

clean:
	$(MAKE) -C vault clean
	rm -rf app/dist/
	rm -rf sdk/dist/
	rm -rf runtime/core-schema/
