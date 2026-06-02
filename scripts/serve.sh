#!/usr/bin/env bash
set -euo pipefail
PORT="${PORT:-3000}"
LOG_DIR="./server-logs"
LOG_FILE="$LOG_DIR/server-$(date +%Y%m%d-%H%M%S).log"
PID_FILE="$LOG_DIR/server.pid"

# Flush old logs on start
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

# Trap for graceful shutdown
cleanup() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Shutting down server..." | tee -a "$LOG_FILE"
  if [ -f "$PID_FILE" ]; then
    kill $(cat "$PID_FILE") 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server stopped gracefully." | tee -a "$LOG_FILE"
}
trap cleanup EXIT INT TERM

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting JARVIS server on port $PORT..." | tee "$LOG_FILE"

# Start vite dev server, log all output
npx vite --port "$PORT" --host 0.0.0.0 2>&1 | while IFS= read -r line; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $line" | tee -a "$LOG_FILE"
done &

echo $! > "$PID_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server PID: $(cat $PID_FILE)" | tee -a "$LOG_FILE"

# Wait for server process
wait $(cat "$PID_FILE") 2>/dev/null || true
