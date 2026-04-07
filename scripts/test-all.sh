#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[tests] Running server lint..."
./scripts/lint-server.sh

echo "[tests] Running server unit tests..."
(
  cd server
  GOCACHE="$(pwd)/.cache/go-build" GOMODCACHE="$(pwd)/.cache/go-mod" go test ./...
)

echo "[tests] Running client lint..."
(
  cd client
  npm run lint
)

echo "[tests] Running client unit tests..."
(
  cd client
  npm test
)

echo "[tests] All checks passed."
