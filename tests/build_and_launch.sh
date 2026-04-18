#!/usr/bin/env zsh
# tests/build_and_launch.sh — build Go daemon + Swift frontend, smoke-test the daemon,
# then launch JarvisTelemetry and record its PID at /tmp/jarvis_validation.pid.
#
# Safe-use notes:
#  • JarvisTelemetry requires sudo to read IOKit/SMC sensors. This script uses `sudo -n`
#    (non-interactive) to avoid hanging on a password prompt. Run `sudo -v` in the same
#    terminal BEFORE invoking this script so credentials are cached.
#  • The script does not push, commit, install system packages, or edit global config.

set -eu
set -o pipefail

REPO_ROOT="${REPO_ROOT:-/Users/vic/claude/General-Work/jarvis/jarvis-build}"
cd "$REPO_ROOT"

MACTOP_DIR="$REPO_ROOT/mactop"
SWIFT_DIR="$REPO_ROOT/JarvisTelemetry"
DAEMON_OUT="$SWIFT_DIR/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon"
SWIFT_BINARY="$SWIFT_DIR/.build/release/JarvisTelemetry"
PID_FILE="/tmp/jarvis_validation.pid"
LAUNCH_LOG="$REPO_ROOT/tests/output/jarvis_launch.log"

log() { printf "[build] %s\n" "$*"; }
die() { printf "[build][FATAL] %s\n" "$*" >&2; exit 1; }

mkdir -p "$(dirname "$LAUNCH_LOG")"

# ---- 0. sudo credential detection (best-effort) ----------------------------
if sudo -n true 2>/dev/null; then
  USE_SUDO=1
  log "sudo credentials cached; will launch JarvisTelemetry with sudo."
else
  USE_SUDO=0
  log "sudo credentials NOT cached; will attempt launch WITHOUT sudo."
  log "  IOKit/IOReport reads usually work unprivileged on Apple Silicon;"
  log "  some SMC sensors may report zeros. This is acceptable for visual tests."
fi

# ---- 1. Build Go daemon -----------------------------------------------------
log "Building Go daemon (arm64, CGO)"
pushd "$MACTOP_DIR" >/dev/null
GOARCH=arm64 GOOS=darwin CGO_ENABLED=1 \
  go build -ldflags="-s -w" -o "$DAEMON_OUT" ./ 2>&1 | sed 's/^/[go] /'
popd >/dev/null

if [[ ! -x "$DAEMON_OUT" ]]; then
  die "Daemon binary not produced at $DAEMON_OUT"
fi
arch_info=$(file "$DAEMON_OUT")
if [[ "$arch_info" != *"arm64"* ]]; then
  die "Daemon is not arm64: $arch_info"
fi
log "Daemon built: $DAEMON_OUT"

# ---- 2. Daemon smoke test ---------------------------------------------------
log "Daemon smoke test (--headless --count 1)"
SAMPLE_FILE="$REPO_ROOT/tests/output/_daemon_sample.json"
mkdir -p "$(dirname "$SAMPLE_FILE")"
"$DAEMON_OUT" --headless --count 1 >"$SAMPLE_FILE" 2>/dev/null || true
if [[ ! -s "$SAMPLE_FILE" ]]; then
  die "Daemon produced no output. First 20 lines of stderr:
$("$DAEMON_OUT" --headless --count 1 2>&1 | head -20)"
fi

python3 "$REPO_ROOT/tests/_verify_daemon_sample.py" "$SAMPLE_FILE" \
  || die "Daemon JSON smoke test failed. Raw sample:
$(head -5 "$SAMPLE_FILE")"

# ---- 3. Build Swift release -------------------------------------------------
log "Building Swift release"
pushd "$SWIFT_DIR" >/dev/null
swift build -c release 2>&1 | sed 's/^/[swift] /'
popd >/dev/null

if [[ ! -x "$SWIFT_BINARY" ]]; then
  die "Swift binary not produced at $SWIFT_BINARY"
fi
log "Swift binary built: $SWIFT_BINARY"

# ---- 4. Stop any previous instance -----------------------------------------
if [[ -f "$PID_FILE" ]]; then
  PREV=$(cat "$PID_FILE" || true)
  if [[ -n "$PREV" ]] && kill -0 "$PREV" 2>/dev/null; then
    log "Killing previous JarvisTelemetry PID $PREV"
    if (( USE_SUDO == 1 )); then
      sudo -n kill "$PREV" 2>/dev/null || kill "$PREV" 2>/dev/null || true
    else
      kill "$PREV" 2>/dev/null || true
    fi
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

# ---- 5. Launch JarvisTelemetry ---------------------------------------------
log "Launching JarvisTelemetry (background)"
: > "$LAUNCH_LOG"
if (( USE_SUDO == 1 )); then
  sudo -n "$SWIFT_BINARY" >>"$LAUNCH_LOG" 2>&1 &
else
  "$SWIFT_BINARY" >>"$LAUNCH_LOG" 2>&1 &
fi
LAUNCHER_PID=$!
# When launched via sudo, the real JarvisTelemetry PID is its child; otherwise
# $LAUNCHER_PID is the real PID already. Give it a moment to spawn in either case.
sleep 3

REAL_PID=$(pgrep -n -f "$SWIFT_BINARY" 2>/dev/null || true)
if [[ -z "$REAL_PID" ]]; then
  REAL_PID="$LAUNCHER_PID"
fi
if ! kill -0 "$REAL_PID" 2>/dev/null; then
  die "JarvisTelemetry failed to start (launcher pid=$LAUNCHER_PID). Last log lines:
$(tail -40 "$LAUNCH_LOG")"
fi

echo "$REAL_PID" > "$PID_FILE"
log "JarvisTelemetry running: PID=$REAL_PID (launcher=$LAUNCHER_PID, sudo=$USE_SUDO)"
log "Launch log: $LAUNCH_LOG"

# ---- 6. Wait for first render ----------------------------------------------
log "Waiting 6 seconds for boot sequence + first HUD frame"
sleep 6

if ! kill -0 "$REAL_PID" 2>/dev/null; then
  die "JarvisTelemetry crashed after launch. Last log lines:
$(tail -40 "$LAUNCH_LOG")"
fi
log "JarvisTelemetry alive and rendering."
