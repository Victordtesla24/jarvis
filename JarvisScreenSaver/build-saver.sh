#!/usr/bin/env bash
# build-saver.sh — compile JARVIS.saver loadable bundle and install to ~/Library/Screen Savers/
set -euo pipefail

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$THIS_DIR/.." && pwd)"
HTML_SRC="$REPO_ROOT/jarvis-full-animation.html"

SRC="$THIS_DIR/Sources/JarvisSaverView.swift"
INFO="$THIS_DIR/Info.plist"

SAVER="$HOME/Library/Screen Savers/JARVIS.saver"
SAVER_CONTENTS="$SAVER/Contents"
SAVER_MACOS="$SAVER_CONTENTS/MacOS"
SAVER_RESOURCES="$SAVER_CONTENTS/Resources"

echo "[build-saver] cleaning old .saver bundle"
rm -rf "$SAVER"

echo "[build-saver] creating directory structure"
mkdir -p "$SAVER_MACOS" "$SAVER_RESOURCES"

echo "[build-saver] compiling loadable bundle (Mach-O bundle, -Xlinker -bundle)"
# -emit-library + -Xlinker -bundle produces a Mach-O bundle file suitable for
# NSBundle to load via principalClass — which is how ScreenSaverEngine instantiates
# NSPrincipalClass. A regular dylib would fail to load.
swiftc \
    -emit-library \
    -Xlinker -bundle \
    -Xlinker -macosx_version_min -Xlinker 14.0 \
    -target arm64-apple-macos14.0 \
    -module-name JARVIS \
    -framework ScreenSaver \
    -framework WebKit \
    -framework AppKit \
    -framework Foundation \
    -o "$SAVER_MACOS/JARVIS" \
    "$SRC"

echo "[build-saver] verifying Mach-O type"
file "$SAVER_MACOS/JARVIS"
# Expect: "Mach-O 64-bit bundle arm64"

echo "[build-saver] copying Info.plist"
cp "$INFO" "$SAVER_CONTENTS/Info.plist"

echo "[build-saver] copying jarvis-full-animation.html"
cp "$HTML_SRC" "$SAVER_RESOURCES/jarvis-full-animation.html"

echo "[build-saver] ad-hoc codesign"
codesign --sign - --force --deep "$SAVER" 2>&1 || true
codesign -v "$SAVER_MACOS/JARVIS" 2>&1 && echo "[build-saver] binary signature valid"

echo
echo "[build-saver] final tree:"
find "$SAVER" -type f

echo
echo "[build-saver] installed: $SAVER"
