#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d postman/node_modules ]; then
  echo "[postman] Installing npm dependencies..."
  (
    cd postman
    npm install
  )
fi

mkdir -p postman/results

echo "[postman] Running Newman API tests..."
(
  cd postman
  npm test
)
