#!/usr/bin/env bash
# start-jarvis.sh — launch the JARVIS wallpaper
# Prefers the .app bundle if built; falls back to the SPM binary.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_BUNDLE="$REPO_ROOT/JarvisWallpaper.app"
SPM_BIN="$REPO_ROOT/JarvisTelemetry/.build/release/JarvisTelemetry"
PIDFILE="/tmp/jarvis-wallpaper.pid"

# Already running?
if [[ -f "$PIDFILE" ]]; then
    PID=$(cat "$PIDFILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "JARVIS already running (PID $PID)"
        exit 0
    fi
    rm -f "$PIDFILE"
fi

if [[ -d "$APP_BUNDLE" ]]; then
    echo "==> Launching $APP_BUNDLE"
    open "$APP_BUNDLE"
    # Poll for up to 5s — `open` returns immediately but the process fork
    # can take longer under load. Empty-PID case MUST NOT reach the pidfile write.
    PID=""
    for _ in $(seq 1 10); do
        PID=$(pgrep -n -x JarvisWallpaper 2>/dev/null || pgrep -n -x JarvisTelemetry 2>/dev/null || true)
        [[ -n "$PID" ]] && break
        sleep 0.5
    done
    if [[ -z "$PID" ]]; then
        echo "ERROR: JarvisWallpaper did not start within 5s"
        exit 1
    fi
elif [[ -x "$SPM_BIN" ]]; then
    echo "==> Launching $SPM_BIN"
    nohup "$SPM_BIN" > /tmp/jarvis-wallpaper.log 2>&1 &
    PID=$!
else
    echo "ERROR: neither JarvisWallpaper.app nor SPM binary found."
    echo "       Run ./build-app.sh first."
    exit 1
fi

echo "$PID" > "$PIDFILE"
echo "JARVIS started (PID $PID)"
echo "Log: /tmp/jarvis-wallpaper.log"
