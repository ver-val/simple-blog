#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/server"

if ! command -v staticcheck >/dev/null 2>&1; then
  echo "staticcheck is required but not installed."
  echo "Install it with: go install honnef.co/go/tools/cmd/staticcheck@latest"
  exit 1
fi

GOCACHE="$(pwd)/.cache/go-build" GOMODCACHE="$(pwd)/.cache/go-mod" staticcheck ./...
