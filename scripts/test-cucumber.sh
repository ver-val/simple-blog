#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d tests/cucumber/node_modules ]; then
  echo "[cucumber] Installing npm dependencies..."
  (
    cd tests/cucumber
    npm install
  )
fi

CLIENT_LOG="$(mktemp -t simple-blog-cucumber-vite.XXXXXX.log)"
CLIENT_PID=""

cleanup() {
  if [ -n "${CLIENT_PID}" ] && kill -0 "${CLIENT_PID}" >/dev/null 2>&1; then
    kill "${CLIENT_PID}" >/dev/null 2>&1 || true
    wait "${CLIENT_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT

echo "[cucumber] Starting frontend..."
(
  cd client
  npm run dev -- --host 127.0.0.1
) >"${CLIENT_LOG}" 2>&1 &
CLIENT_PID=$!

echo "[cucumber] Waiting for frontend on http://127.0.0.1:5173..."
for _ in {1..30}; do
  if curl -fsS http://127.0.0.1:5173 >/dev/null; then
    break
  fi
  sleep 1
done

if ! curl -fsS http://127.0.0.1:5173 >/dev/null; then
  echo "Frontend did not start in time."
  cat "${CLIENT_LOG}"
  exit 1
fi

echo "[cucumber] Running Cucumber tests..."
(
  cd tests/cucumber
  mkdir -p results
  npm test
)
