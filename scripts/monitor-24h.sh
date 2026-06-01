#!/bin/bash
# 24時間・1時間ごとに監視を実行（Mac起動中のみ）
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="/tmp/ibekiatch-monitor-24h.log"
echo "=== 24h monitor started $(date -Iseconds) ===" >> "$LOG"
for i in $(seq 1 24); do
  echo "--- run $i/24 $(date -Iseconds) ---" >> "$LOG"
  npm run monitor >> "$LOG" 2>&1 || echo "run $i failed" >> "$LOG"
  if [ "$i" -lt 24 ]; then
    sleep 3600
  fi
done
echo "=== 24h monitor finished $(date -Iseconds) ===" >> "$LOG"
