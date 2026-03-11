#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/server"

GO_FILES=$(find . -type f -name "*.go" -not -path "./.cache/*")
UNFORMATTED=$(gofmt -l $GO_FILES)
if [ -n "$UNFORMATTED" ]; then
  echo "Unformatted Go files found:"
  echo "$UNFORMATTED"
  echo "Run: cd server && gofmt -w ./cmd ./internal"
  exit 1
fi

GOCACHE="$(pwd)/.cache/go-build" GOMODCACHE="$(pwd)/.cache/go-mod" go vet ./...
