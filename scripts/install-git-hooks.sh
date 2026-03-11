#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

git config core.hooksPath .githooks
chmod +x .githooks/pre-push scripts/lint-server.sh

echo "Configured git hooks path to .githooks"
echo "pre-push hook is now active"
