#!/usr/bin/env bash
# install.sh — End-to-end JARVIS installer.
#
#   1. Builds the Swift binary (release).
#   2. Rebuilds the JarvisWallpaper.app bundle on ~/Desktop.
#   3. Builds and installs the JARVIS.saver screen-saver bundle.
#   4. Installs ~/Library/LaunchAgents/com.jarvis.wallpaper.plist
#      pointed directly at the binary (bypasses the osascript-sudo
#      launcher so auto-start at login is unattended).
#   5. Loads the LaunchAgent so JARVIS is running immediately and will
#      auto-start on every subsequent login.
#
# Post-conditions:
#   - JarvisTelemetry is running (pgrep JarvisTelemetry succeeds).
#   - ~/Library/LaunchAgents/com.jarvis.wallpaper.plist exists and is loaded.
#   - ~/Library/Screen Savers/JARVIS.saver exists.
#   - /tmp/jarvis-wallpaper.log is being written to.
#
# Usage:   ./scripts/install.sh
# Requires: swiftc, swift, codesign

set -euo pipefail

# ── Paths ────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPM_DIR="$REPO_ROOT/JarvisTelemetry"
APP_BUNDLE="$HOME/Desktop/JarvisWallpaper.app"
HTML_SRC="$REPO_ROOT/jarvis-full-animation.html"
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
LAUNCH_AGENT_LABEL="com.jarvis.wallpaper"
LAUNCH_AGENT_PLIST="$LAUNCH_AGENT_DIR/${LAUNCH_AGENT_LABEL}.plist"
PLIST_TEMPLATE="$REPO_ROOT/scripts/com.jarvis.wallpaper.plist"
SAVER_SCRIPT="$REPO_ROOT/JarvisScreenSaver/build-saver.sh"

log() { printf '\033[1;36m[install]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[install:ERROR]\033[0m %s\n' "$*" >&2; }

# ── 1. Build Swift binary ────────────────────────────────────────────
log "Building JarvisTelemetry (swift build -c release)…"
cd "$SPM_DIR"
swift build -c release
BIN="$SPM_DIR/.build/release/JarvisTelemetry"
if [[ ! -x "$BIN" ]]; then
    err "swift build produced no executable at $BIN"
    exit 1
fi
log "  → $BIN"

# ── 2. Rebuild JarvisWallpaper.app bundle ────────────────────────────
log "Rebuilding ${APP_BUNDLE}…"
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

cp "$BIN"       "$APP_BUNDLE/Contents/MacOS/JarvisTelemetry"
cp "$HTML_SRC"  "$APP_BUNDLE/Contents/Resources/jarvis-full-animation.html"

# Copy daemon if present (bundled as a resource so TelemetryBridge finds it).
DAEMON_SRC="$SPM_DIR/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon"
if [[ -x "$DAEMON_SRC" ]]; then
    cp "$DAEMON_SRC" "$APP_BUNDLE/Contents/Resources/jarvis-mactop-daemon"
    chmod +x "$APP_BUNDLE/Contents/Resources/jarvis-mactop-daemon"
    log "  → bundled daemon: $DAEMON_SRC"
fi

cat > "$APP_BUNDLE/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>JarvisTelemetry</string>
    <key>CFBundleIdentifier</key>
    <string>com.jarvis.wallpaper</string>
    <key>CFBundleName</key>
    <string>JARVIS Wallpaper</string>
    <key>CFBundleDisplayName</key>
    <string>JARVIS Wallpaper</string>
    <key>CFBundleVersion</key>
    <string>3.0</string>
    <key>CFBundleShortVersionString</key>
    <string>3.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
</dict>
</plist>
PLIST

chmod +x "$APP_BUNDLE/Contents/MacOS/JarvisTelemetry"

# Re-sign ad-hoc — required whenever the binary is replaced, or macOS
# taskgated will SIGKILL the process on next launch.
log "Code-signing bundle (ad-hoc)…"
codesign --sign - --force --deep "$APP_BUNDLE" 2>&1 || true
codesign -v "$APP_BUNDLE/Contents/MacOS/JarvisTelemetry" \
    && log "  → signature valid"

# ── 3. Build and install JARVIS.saver ────────────────────────────────
if [[ -x "$SAVER_SCRIPT" ]]; then
    log "Building JARVIS.saver bundle…"
    "$SAVER_SCRIPT" || log "  (screen-saver build failed — continuing)"
else
    log "  (no $SAVER_SCRIPT — skipping saver build)"
fi

# ── 4. Install LaunchAgent plist ─────────────────────────────────────
log "Installing LaunchAgent ${LAUNCH_AGENT_PLIST}…"
mkdir -p "$LAUNCH_AGENT_DIR"

# Substitute the binary path into the plist template.
BINARY_IN_BUNDLE="$APP_BUNDLE/Contents/MacOS/JarvisTelemetry"
sed "s|__JARVIS_BINARY__|${BINARY_IN_BUNDLE}|g" "$PLIST_TEMPLATE" > "$LAUNCH_AGENT_PLIST"

# Validate plist syntax.
plutil -lint "$LAUNCH_AGENT_PLIST" >/dev/null \
    || { err "LaunchAgent plist is malformed"; exit 1; }
log "  → plist valid: $LAUNCH_AGENT_PLIST"

# ── 5. Reload LaunchAgent ────────────────────────────────────────────
log "Unloading any previous instance…"
launchctl unload "$LAUNCH_AGENT_PLIST" 2>/dev/null || true
pkill -x JarvisTelemetry 2>/dev/null || true
sleep 0.5

log "Loading LaunchAgent…"
launchctl load -w "$LAUNCH_AGENT_PLIST"

# ── 6. Verify ────────────────────────────────────────────────────────
sleep 2
if launchctl list | grep -q "$LAUNCH_AGENT_LABEL"; then
    log "LaunchAgent loaded: $(launchctl list | grep "$LAUNCH_AGENT_LABEL")"
else
    err "LaunchAgent NOT found in launchctl list"
    exit 1
fi

if pgrep -x JarvisTelemetry >/dev/null; then
    log "JARVIS process running: PID $(pgrep -x JarvisTelemetry)"
else
    err "JarvisTelemetry process did not start — check /tmp/jarvis-wallpaper.err.log"
    tail -20 /tmp/jarvis-wallpaper.err.log 2>/dev/null || true
    exit 1
fi

log "Done. JARVIS will auto-start at every login."
log "  Logs:    /tmp/jarvis-wallpaper.log (stdout), /tmp/jarvis-wallpaper.err.log (stderr)"
log "  Stop:    launchctl unload $LAUNCH_AGENT_PLIST"
log "  Start:   launchctl load   $LAUNCH_AGENT_PLIST"
