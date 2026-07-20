OUTDIR  ?= bin
LDFLAGS ?= -s -w
CGO     ?= 0

.PHONY: help build clean check-models migrate migrate-all \
        migrate-linux-amd64 migrate-linux-arm64 migrate-darwin-amd64 migrate-darwin-arm64

# Show available targets
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  build          Build main vanblog binary   → $(OUTDIR)/vanblog"
	@echo "  migrate        Build migration CLI         → $(OUTDIR)/migrate"
	@echo "  migrate-all    Cross-compile migration CLI for all platforms"
	@echo "  clean          Remove $(OUTDIR)/"

# Check that core schema artifact exists (required before build)
# Path is relative to repo root (../ from vault/), where pnpm build:models outputs.
check-models:
	@test -f ../runtime/core-schema/models.js || { \
		echo "ERROR: core schema artifact missing. Run 'pnpm build:models' from repo root first."; \
		exit 1; \
	}

# Build main vanblog binary for current platform
build: check-models
	CGO_ENABLED=$(CGO) go build -ldflags="$(LDFLAGS)" -o $(OUTDIR)/vanblog .

# Build migration CLI for current platform
migrate:
	CGO_ENABLED=$(CGO) go build -ldflags="$(LDFLAGS)" -o $(OUTDIR)/migrate ./cmd/migrate

# Cross-compile for all target platforms (for GitHub Releases)
migrate-all: migrate-linux-amd64 migrate-linux-arm64 migrate-darwin-amd64 migrate-darwin-arm64

migrate-linux-amd64:
	GOOS=linux GOARCH=amd64  CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(OUTDIR)/migrate-linux-amd64  ./cmd/migrate

migrate-linux-arm64:
	GOOS=linux GOARCH=arm64  CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(OUTDIR)/migrate-linux-arm64  ./cmd/migrate

migrate-darwin-amd64:
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(OUTDIR)/migrate-darwin-amd64 ./cmd/migrate

migrate-darwin-arm64:
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(OUTDIR)/migrate-darwin-arm64 ./cmd/migrate

# Remove built binaries
clean:
	rm -rf $(OUTDIR)/
