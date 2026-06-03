#!/bin/bash
# 1時間ごとに全ソース監視を永続実行（launchd から起動）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="/tmp/ibekiatch-monitor.log"
cd "$ROOT"

echo "=== monitor loop started $(date -Iseconds) pid=$$ ===" >> "$LOG"

while true; do
  echo "--- run $(date -Iseconds) ---" >> "$LOG"
  npm run monitor >> "$LOG" 2>&1 || echo "run failed $(date -Iseconds)" >> "$LOG"
  sleep 3600
done
