OUTDIR  ?= bin
LDFLAGS ?= -s -w
CGO     ?= 0

.PHONY: help build clean check-models

# Show available targets
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  build          Build main vanblog binary   → $(OUTDIR)/vanblog"
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