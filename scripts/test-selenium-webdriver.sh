#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d tests/selenium/node_modules ]; then
  echo "[selenium-webdriver] Installing npm dependencies..."
  (
    cd tests/selenium
    npm install
  )
fi

CLIENT_LOG="$(mktemp -t simple-blog-selenium-vite.XXXXXX.log)"
CLIENT_PID=""

cleanup() {
  if [ -n "${CLIENT_PID}" ] && kill -0 "${CLIENT_PID}" >/dev/null 2>&1; then
    kill "${CLIENT_PID}" >/dev/null 2>&1 || true
    wait "${CLIENT_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT

echo "[selenium-webdriver] Starting frontend..."
(
  cd client
  npm run dev -- --host 127.0.0.1
) >"${CLIENT_LOG}" 2>&1 &
CLIENT_PID=$!

echo "[selenium-webdriver] Waiting for frontend on http://127.0.0.1:5173..."
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

echo "[selenium-webdriver] Running Selenium WebDriver tests..."
(
  cd tests/selenium
  npm test
)
