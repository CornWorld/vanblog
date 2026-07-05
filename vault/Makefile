.PHONY: migrate migrate-all

# Build migration CLI for current platform
migrate:
	CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/migrate ./cmd/migrate

# Cross-compile for all target platforms (for GitHub Releases)
migrate-all: migrate-linux-amd64 migrate-linux-arm64 migrate-darwin-amd64 migrate-darwin-arm64

migrate-linux-amd64:
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/migrate-linux-amd64 ./cmd/migrate

migrate-linux-arm64:
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/migrate-linux-arm64 ./cmd/migrate

migrate-darwin-amd64:
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/migrate-darwin-amd64 ./cmd/migrate

migrate-darwin-arm64:
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/migrate-darwin-arm64 ./cmd/migrate
