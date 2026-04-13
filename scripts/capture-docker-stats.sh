#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

OUT_FILE="${1:-tests/performance/results/docker-stats.csv}"
INTERVAL="${DOCKER_STATS_INTERVAL:-2}"

mkdir -p "$(dirname "$OUT_FILE")"
echo "timestamp,name,cpu_percent,mem_usage,mem_percent,net_io,block_io,pids" > "$OUT_FILE"

while true; do
  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}},{{.PIDs}}" \
    | while IFS= read -r line; do
        echo "${timestamp},${line}" >> "$OUT_FILE"
      done
  sleep "$INTERVAL"
done
