#!/usr/bin/env bash
# deploy.sh — Build, sign, and deploy JARVIS to the desktop .app bundle.
# Usage: ./scripts/deploy.sh [--dry-run]
# Env:
#   JARVIS_APP_BUNDLE   override destination .app bundle path
#   CODESIGN_IDENTITY   signing identity ("-" for ad-hoc, default)
#   JARVIS_NO_RESTART   if set, skip the osascript restart block (CI/agents)
#   JARVIS_LOG_DIR      override log directory (default $HOME/Library/Logs)
set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

# shellcheck source=./_paths.sh disable=SC1091
. "$(cd "$(dirname "$0")" && pwd)/_paths.sh"

APP="${JARVIS_APP_BUNDLE:-${JARVIS_REPO_ROOT}/JarvisWallpaper.app}"
REPO_DIR="${JARVIS_REPO_ROOT}"
CODESIGN_IDENTITY="${CODESIGN_IDENTITY:--}"
LOG_DIR="${JARVIS_LOG_DIR:-${HOME}/Library/Logs}"
LOG_FILE="${LOG_DIR}/jarvis.log"
mkdir -p "$LOG_DIR"

echo "[deploy] APP=$APP"
echo "[deploy] REPO=$REPO_DIR"
echo "[deploy] CODESIGN_IDENTITY=$CODESIGN_IDENTITY"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[deploy] --dry-run: skipping build/sign/restart"
  exit 0
fi

echo "[deploy] Building Swift binary..."
cd "$REPO_DIR/JarvisTelemetry"
swift build -c release

echo "[deploy] Copying binary and HTML to bundle..."
cp ".build/release/JarvisTelemetry"          "$APP/Contents/MacOS/JarvisTelemetry"
cp "$REPO_DIR/jarvis-full-animation.html"    "$APP/Contents/Resources/jarvis-full-animation.html"

echo "[deploy] Re-signing binary with identity='$CODESIGN_IDENTITY'..."
# REQUIRED: Replacing the binary invalidates the bundle signature.
# macOS taskgated will SIGKILL the process on launch if the signature is stale.
codesign --sign "$CODESIGN_IDENTITY" --force "$APP/Contents/MacOS/JarvisTelemetry"
codesign -v "$APP/Contents/MacOS/JarvisTelemetry"
echo "[deploy] Signature valid"

if [[ "${JARVIS_NO_RESTART:-0}" == "1" ]]; then
  echo "[deploy] JARVIS_NO_RESTART=1 — skipping restart"
  exit 0
fi

echo "[deploy] Restarting JARVIS..."
BINARY="$APP/Contents/MacOS/JarvisTelemetry"
USERID=$(id -u)

if sudo -n true 2>/dev/null; then
  echo "[deploy] sudo cached — using direct sudo"
  sudo pkill -9 JarvisTelemetry 2>/dev/null || true
  sleep 1
  # Use printf with %q for shell-safe quoting of the binary path.
  BINARY_QUOTED=$(printf '%q' "$BINARY")
  LOG_QUOTED=$(printf '%q' "$LOG_FILE")
  sudo -n launchctl asuser "$USERID" sh -c \
    "$BINARY_QUOTED >> $LOG_QUOTED 2>&1 &"
else
  echo "[deploy] sudo not cached — prompting via osascript"
  # POSIX-safe quoting via printf %q wrapped in double quotes.
  BINARY_OSA=$(printf '%s' "$BINARY" | sed "s/'/'\\\\''/g")
  LOG_OSA=$(printf '%s' "$LOG_FILE" | sed "s/'/'\\\\''/g")
  osascript -e "do shell script \"pkill -9 JarvisTelemetry 2>/dev/null; true\" with administrator privileges" 2>/dev/null || true
  sleep 1
  osascript -e "do shell script \"launchctl asuser $USERID '$BINARY_OSA' >> '$LOG_OSA' 2>&1 &\" with administrator privileges"
fi

sleep 2

if pgrep -q JarvisTelemetry; then
  echo "[deploy] JARVIS running: $(pgrep -la JarvisTelemetry)"
  tail -5 "$LOG_FILE" 2>/dev/null || true
else
  echo "[deploy] WARNING: JARVIS did not start — check $LOG_FILE"
  exit 1
fi
