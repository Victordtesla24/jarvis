#!/bin/bash
# deploy.sh — Build, sign, and deploy JARVIS to the desktop .app bundle
# Usage: ./scripts/deploy.sh
# Must be run from the repo root or scripts/ directory.
set -e

APP="/Users/vic/Desktop/JarvisWallpaper.app"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[deploy] Building Swift binary..."
cd "$REPO_DIR/JarvisTelemetry"
swift build -c release

echo "[deploy] Copying binary and HTML to bundle..."
cp ".build/release/JarvisTelemetry"          "$APP/Contents/MacOS/JarvisTelemetry"
cp "$REPO_DIR/jarvis-full-animation.html"    "$APP/Contents/Resources/jarvis-full-animation.html"

echo "[deploy] Re-signing binary (ad-hoc)..."
# REQUIRED: Replacing the binary invalidates the bundle signature.
# macOS taskgated will SIGKILL the process on launch if the signature is stale.
codesign --sign - --force "$APP/Contents/MacOS/JarvisTelemetry"
codesign -v "$APP/Contents/MacOS/JarvisTelemetry" && echo "[deploy] Signature valid"

echo "[deploy] Restarting JARVIS..."
BINARY="$APP/Contents/MacOS/JarvisTelemetry"
USERID=$(id -u)
osascript -e "do shell script \"pkill -9 JarvisTelemetry 2>/dev/null; true\" with administrator privileges" 2>/dev/null || true
sleep 1
osascript -e "do shell script \"launchctl asuser $USERID '$BINARY' >> /tmp/jarvis.log 2>&1 &\" with administrator privileges"
sleep 2

if pgrep -q JarvisTelemetry; then
    echo "[deploy] JARVIS running: $(pgrep -la JarvisTelemetry)"
    tail -5 /tmp/jarvis.log
else
    echo "[deploy] WARNING: JARVIS did not start — check /tmp/jarvis.log"
    exit 1
fi
