#!/usr/bin/env bash
# build-app.sh — builds JarvisWallpaper.app from source
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
SPM="$REPO/JarvisTelemetry"
APPBUNDLE="$REPO/JarvisWallpaper.app"
HTML="$REPO/jarvis-full-animation.html"

echo "==> Building Swift package (release)..."
cd "$SPM"
swift build -c release

BIN="$SPM/.build/release/JarvisTelemetry"

echo "==> Assembling $APPBUNDLE..."
rm -rf "$APPBUNDLE"
mkdir -p "$APPBUNDLE/Contents/MacOS"
mkdir -p "$APPBUNDLE/Contents/Resources"

cp "$BIN"  "$APPBUNDLE/Contents/MacOS/JarvisWallpaper"
cp "$HTML" "$APPBUNDLE/Contents/Resources/jarvis-full-animation.html"

INFO="$APPBUNDLE/Contents/Info.plist"
{
  printf '<?xml version="1.0" encoding="UTF-8"?>\n'
  printf '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
  printf '<plist version="1.0"><dict>\n'
  printf '    <key>CFBundleExecutable</key><string>JarvisWallpaper</string>\n'
  printf '    <key>CFBundleIdentifier</key><string>com.jarvis.wallpaper</string>\n'
  printf '    <key>CFBundleName</key><string>JARVIS Wallpaper</string>\n'
  printf '    <key>CFBundleDisplayName</key><string>JARVIS Wallpaper</string>\n'
  printf '    <key>CFBundlePackageType</key><string>APPL</string>\n'
  printf '    <key>CFBundleShortVersionString</key><string>1.0</string>\n'
  printf '    <key>CFBundleVersion</key><string>1</string>\n'
  printf '    <key>LSMinimumSystemVersion</key><string>15.0</string>\n'
  printf '    <key>LSUIElement</key><true/>\n'
  printf '    <key>NSHighResolutionCapable</key><true/>\n'
  printf '    <key>NSPrincipalClass</key><string>NSApplication</string>\n'
  printf '    <key>NSAppTransportSecurity</key>\n'
  printf '    <dict><key>NSAllowsLocalNetworking</key><true/></dict>\n'
  printf '</dict></plist>\n'
} > "$INFO"

chmod +x "$APPBUNDLE/Contents/MacOS/JarvisWallpaper"
echo "==> Done: $APPBUNDLE"
echo "    Run:  open '$APPBUNDLE'"
echo "    Stop: ./stop-jarvis.sh"
