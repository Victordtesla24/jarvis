#!/usr/bin/env zsh
# tests/run_reactive_demo.sh — Step 6 live 90s integration test.
#
# Launches JarvisTelemetry, fires CPU / memory / network stress triggers in
# parallel, captures 36 frames at 2.5s intervals (total 90s), stops the app
# cleanly, and prints a checklist summary.
#
# Deviation from spec: uses Python + Quartz window-targeted capture through
# tests/capture_window.py instead of `screencapture -x`. The reactor runs at
# kCGDesktopWindowLevel and screencapture grabs the full desktop composite,
# which would show foreground windows (Cursor, browsers) instead of the HUD.
# The Quartz path targets the JarvisTelemetry window directly and renders
# what the wallpaper layer is actually drawing.

set -eu
set -o pipefail

REPO_ROOT="${REPO_ROOT:-/Users/vic/claude/General-Work/jarvis/jarvis-build}"
cd "$REPO_ROOT"
export REPO_ROOT

TESTS_DIR="$REPO_ROOT/tests"
SWIFT_BINARY="$REPO_ROOT/JarvisTelemetry/.build/release/JarvisTelemetry"
REACTIVE_DIR="$REPO_ROOT/tests/output/reactive"
PID_FILE="/tmp/jarvis_reactive.pid"

log() { printf "[reactive] %s\n" "$*"; }
die() { printf "[reactive][FATAL] %s\n" "$*" >&2; exit 1; }

[[ -x "$SWIFT_BINARY" ]] || die "JarvisTelemetry binary missing: $SWIFT_BINARY"

mkdir -p "$REACTIVE_DIR"
# Clean any prior frames so we don't mix runs
find "$REACTIVE_DIR" -maxdepth 1 -name 'frame_*.png' -delete 2>/dev/null || true

# ---- Launch JarvisTelemetry ------------------------------------------------
# Three env vars coordinate the seamless reactor → lock-screen → reactor demo:
#   JARVIS_DISABLE_LOCKSCREEN=1   — suppress session-resign subscriptions so
#       the HUD doesn't flip to .lockScreen when the capture process steals
#       focus or the session idles. We drive the phase ourselves below.
#   JARVIS_AUTO_LOCK_AFTER_MS=25000   — call phaseController.enterLockScreen()
#       25s after launch. That's ~8 capture frames into the run, giving the
#       reactor stress phase time to be visible first.
#   JARVIS_AUTO_UNLOCK_AFTER_MS=65000 — call phaseController.exitLockScreen()
#       65s after launch. That's ~24 frames in, leaving 12 frames (frames
#       25-36) to capture post-unlock reactor recovery.
log "Launching JarvisTelemetry with auto-lock/unlock timers"
log "  JARVIS_DISABLE_LOCKSCREEN=1 (spontaneous session-resign suppressed)"
log "  JARVIS_AUTO_LOCK_AFTER_MS=25000  (lock at t=25s, ~frame 9)"
log "  JARVIS_AUTO_UNLOCK_AFTER_MS=65000 (unlock at t=65s, ~frame 25)"
JARVIS_DISABLE_LOCKSCREEN=1 \
JARVIS_AUTO_LOCK_AFTER_MS=25000 \
JARVIS_AUTO_UNLOCK_AFTER_MS=65000 \
  "$SWIFT_BINARY" >"$REACTIVE_DIR/jarvis_stderr.log" 2>&1 &
APP_PID=$!
echo "$APP_PID" > "$PID_FILE"
log "  pid=$APP_PID (log → tests/output/reactive/jarvis_stderr.log)"

# Trap: guarantee we always kill the app on exit
cleanup() {
  if [[ -f "$PID_FILE" ]]; then
    local pid=$(cat "$PID_FILE" || true)
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      log "trap: sending SIGTERM to JarvisTelemetry pid=$pid"
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  pkill -9 -f 'reactive_burn|reactive_mem' 2>/dev/null || true
}
trap cleanup EXIT

log "Waiting 5s for boot sequence + HUD nominal"
sleep 5

if ! kill -0 "$APP_PID" 2>/dev/null; then
  die "JarvisTelemetry died during boot. stderr tail:
$(tail -20 "$REACTIVE_DIR/jarvis_stderr.log")"
fi

# ---- Stress triggers (parallel, background) --------------------------------
log "Starting stress triggers"

# CPU burn — 6 threads × 20s (should trip cpuPCoreSpikeActive)
python3 -c "
import threading, time, sys
def burn():
    end = time.time() + 20
    x = 0
    while time.time() < end:
        x = (x * 1103515245 + 12345) & 0x7fffffff
threads = [threading.Thread(target=burn, name='reactive_burn_%d'%i, daemon=True) for i in range(6)]
for t in threads: t.start()
for t in threads: t.join()
" >/dev/null 2>&1 &
BURN_PID=$!
log "  cpu burn pid=$BURN_PID"

# Memory pressure — allocate 13 GB for 20s. On 16 GB systems this pushes
# the classifier into .warning (>75%) and usually .critical (>90%).
python3 -c "
import time, sys
sys.argv[0] = 'reactive_mem_alloc'
buf = bytearray(int(13e9))
# Touch every 64 KB page so the OS can't lazy-skip the allocation
step = 64 * 1024
for i in range(0, len(buf), step):
    buf[i] = 1
time.sleep(20)
del buf
" >/dev/null 2>&1 &
MEM_PID=$!
log "  memory pressure pid=$MEM_PID"

# Network activity — 300 MB download spread over ≤30s
# Uses cloudflare speed endpoint; quiet on failure.
(curl -s -o /dev/null --max-time 30 \
  'https://speed.cloudflare.com/__down?bytes=314572800' 2>/dev/null || true) &
NET_PID=$!
log "  network download pid=$NET_PID"

# ---- Frame capture loop ----------------------------------------------------
log "Capturing 36 frames at 2.5s intervals (90s total) via Quartz window targeting"
# shellcheck disable=SC1091
source "$TESTS_DIR/.venv/bin/activate"

python3 "$TESTS_DIR/capture_window.py" \
  --count 36 \
  --interval 2.5 \
  --owner JarvisTelemetry \
  --out-dir "$REACTIVE_DIR" \
  --prefix frame_

# ---- Ensure stress triggers clean up ---------------------------------------
log "Stress triggers finishing (waiting ≤5s)"
wait "$BURN_PID" 2>/dev/null || true
kill "$MEM_PID" 2>/dev/null || true
wait "$MEM_PID" 2>/dev/null || true
kill "$NET_PID" 2>/dev/null || true

# ---- Stop app cleanly ------------------------------------------------------
log "Stopping JarvisTelemetry via SIGTERM"
kill -TERM "$APP_PID" 2>/dev/null || true
# Wait up to 10s — the SwiftUI shutdown sequence animation runs for ~7s, plus
# daemon child teardown. Script's old 2s wait was too tight under stress load.
DEADLINE=$((SECONDS + 10))
SHUTDOWN_STATUS="Clean shutdown confirmed"
while (( SECONDS < DEADLINE )); do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    break
  fi
  sleep 0.5
done
if kill -0 "$APP_PID" 2>/dev/null; then
  log "SIGTERM ignored for 10s — escalating to SIGKILL"
  kill -9 "$APP_PID" 2>/dev/null || true
  SHUTDOWN_STATUS="SIGKILL required"
fi
rm -f "$PID_FILE"

# ---- Checklist summary -----------------------------------------------------
log ""
log "============================================================"
log "REACTIVE DEMO CHECKLIST"
log "============================================================"
FRAME_COUNT=$(find "$REACTIVE_DIR" -maxdepth 1 -name 'frame_*.png' | wc -l | tr -d ' ')
log "  Frames captured:           $FRAME_COUNT / 36"
log "  Shutdown:                  $SHUTDOWN_STATUS"
log ""
log "  [ ] frames 01-04: boot → reactor nominal state"
log "  [ ] frames 05-08: reactor under stress (CPU burn + memory + network)"
log "  [ ] frames 09-24: lock screen cinematic animations"
log "                    (ParticleWireframeSphere + RadialTextMenu + MonochromeArrows)"
log "  [ ] frames 25-36: reactor recovery after unlock"
log ""
log "Frames: $REACTIVE_DIR"
log "App log: $REACTIVE_DIR/jarvis_stderr.log"
