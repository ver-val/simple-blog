#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/client"

echo "[security] Running npm audit for production dependencies..."
npm audit --omit=dev
