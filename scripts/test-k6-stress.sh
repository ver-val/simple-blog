#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p tests/performance/results

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is not installed."
  echo "Install it first, for example on macOS: brew install k6"
  exit 1
fi

cleanup() {
  if [[ -n "${STATS_PID:-}" ]]; then
    kill "${STATS_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

echo "[stress] Capturing docker stats..."
./scripts/capture-docker-stats.sh tests/performance/results/docker-stats.csv &
STATS_PID=$!

echo "[stress] Running k6 stress scenarios against ${BASE_URL:-http://localhost:8080}..."
k6 run \
  --summary-export tests/performance/results/k6-stress-summary.json \
  tests/performance/blog-stress.js
