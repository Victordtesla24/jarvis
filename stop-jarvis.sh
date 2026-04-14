#!/usr/bin/env bash
# stop-jarvis.sh — graceful shutdown: triggers 6s HTML shutdown animation then exit(0)
set -euo pipefail

PIDFILE="/tmp/jarvis-wallpaper.pid"

# Find the process — prefer pidfile, fall back to pgrep
if [[ -f "$PIDFILE" ]]; then
    PID=$(cat "$PIDFILE")
    if ! kill -0 "$PID" 2>/dev/null; then
        echo "JARVIS not running (stale pidfile, clearing)"
        rm -f "$PIDFILE"
        exit 0
    fi
else
    PID=$(pgrep -x JarvisWallpaper || pgrep -x JarvisTelemetry || true)
    if [[ -z "$PID" ]]; then
        echo "JARVIS not running"
        exit 0
    fi
fi

echo "==> Sending SIGTERM to PID $PID (shutdown animation will play for ~6s)…"
kill -TERM "$PID"

# Wait up to 10s for clean exit
for i in $(seq 1 10); do
    sleep 1
    if ! kill -0 "$PID" 2>/dev/null; then
        echo "JARVIS stopped (exit after ${i}s)"
        rm -f "$PIDFILE"
        exit 0
    fi
done

echo "WARN: process did not exit in 10s — sending SIGKILL"
kill -KILL "$PID" 2>/dev/null || true
rm -f "$PIDFILE"
