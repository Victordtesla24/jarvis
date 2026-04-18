#!/usr/bin/env zsh
# tests/stop_jarvis.sh — kill any JarvisTelemetry process spawned by the harness.

set -eu
REPO_ROOT="${REPO_ROOT:-/Users/vic/claude/General-Work/jarvis/jarvis-build}"
PID_FILE="/tmp/jarvis_validation.pid"

if [[ -f "$PID_FILE" ]]; then
  PID=$(cat "$PID_FILE" || true)
  if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
    echo "[stop] killing JarvisTelemetry PID $PID"
    kill "$PID" 2>/dev/null || sudo -n kill "$PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

# Belt-and-braces: any leftover JarvisTelemetry processes.
SWIFT_BINARY="$REPO_ROOT/JarvisTelemetry/.build/release/JarvisTelemetry"
for pid in $(pgrep -f "$SWIFT_BINARY" 2>/dev/null || true); do
  echo "[stop] killing stray JarvisTelemetry PID $pid"
  kill "$pid" 2>/dev/null || sudo -n kill "$pid" 2>/dev/null || true
done

echo "[stop] done"
