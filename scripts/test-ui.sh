#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! python3 -m robot --version >/dev/null 2>&1; then
  echo "[ui-tests] Robot Framework is not installed. Installing dependencies..."
  python3 -m pip install -r tests/keyword/requirements.txt
fi

CLIENT_LOG="$(mktemp -t simple-blog-vite.XXXXXX.log)"
CLIENT_PID=""

cleanup() {
  if [ -n "${CLIENT_PID}" ] && kill -0 "${CLIENT_PID}" >/dev/null 2>&1; then
    kill "${CLIENT_PID}" >/dev/null 2>&1 || true
    wait "${CLIENT_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT

echo "[ui-tests] Starting frontend..."
(
  cd client
  npm run dev -- --host 127.0.0.1
) >"${CLIENT_LOG}" 2>&1 &
CLIENT_PID=$!

echo "[ui-tests] Waiting for frontend on http://127.0.0.1:5173..."
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

echo "[ui-tests] Running Selenium IDE record-and-play tests..."
npx selenium-side-runner -c "browserName=chrome goog:chromeOptions.args=[headless,no-sandbox,disable-dev-shm-usage]" tests/record-play/simple-blog.side

echo "[ui-tests] Running Robot Framework keyword-driven tests..."
python3 -m robot -d tests/keyword/results -v BASE_URL:http://127.0.0.1:5173 -v BROWSER:headlesschrome tests/keyword/simple_blog.robot

echo "[ui-tests] All UI checks passed."
