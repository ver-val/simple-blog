#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/server"

mkdir -p bin .cache/go-build .cache/go-mod

if [ ! -x ./bin/gosec ]; then
  echo "[security] Installing gosec..."
  GOBIN="$(pwd)/bin" go install github.com/securego/gosec/v2/cmd/gosec@latest
fi

echo "[security] Running gosec..."
GOCACHE="$(pwd)/.cache/go-build" GOMODCACHE="$(pwd)/.cache/go-mod" ./bin/gosec ./cmd/... ./internal/...
