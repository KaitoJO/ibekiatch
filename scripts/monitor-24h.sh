#!/bin/bash
# 24時間・1時間ごとに監視 + Macスリープ防止
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="/tmp/ibekiatch-monitor-24h.log"
SECONDS_24H=86400

echo "=== 24h monitor started $(date -Iseconds) ===" >> "$LOG"

# 画面消灯・スリープを24時間防ぐ（子プロセス終了まで）
caffeinate -dimsu -t "$SECONDS_24H" &
CAFFEINATE_PID=$!
echo "caffeinate pid=$CAFFEINATE_PID" >> "$LOG"

cleanup() {
  kill "$CAFFEINATE_PID" 2>/dev/null || true
}
trap cleanup EXIT

for i in $(seq 1 24); do
  echo "--- run $i/24 $(date -Iseconds) ---" >> "$LOG"
  npm run monitor >> "$LOG" 2>&1 || echo "run $i failed" >> "$LOG"
  if [ "$i" -lt 24 ]; then
    sleep 3600
  fi
done

echo "=== 24h monitor finished $(date -Iseconds) ===" >> "$LOG"
