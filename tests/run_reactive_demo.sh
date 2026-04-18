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
# Four env vars coordinate the seamless boot → live → lock → recovery → shutdown
# capture. The capture starts 2 s after launch (during boot) and runs for 100 s
# total, crossing all four phase transitions. Frame budget (2.5 s interval):
#   frames 01-04  (t=02-12s)  boot sequence
#   frames 05-11  (t=12-27s)  live reactor + stress (nominal state)
#   frames 12-22  (t=27-52s)  lock screen cinematic animations
#   frames 23-30  (t=52-75s)  unlock + live reactor recovery
#   frames 31-40  (t=75-100s) shutdown sequence
#
#   JARVIS_DISABLE_LOCKSCREEN=1      — suppress session-resign subscription
#   JARVIS_AUTO_LOCK_AFTER_MS=15000   — lock at t=15s (~frame 6, just after boot)
#   JARVIS_AUTO_UNLOCK_AFTER_MS=45000 — unlock at t=45s (~frame 18, 30s of lock)
#   JARVIS_AUTO_SHUTDOWN_AFTER_MS=75000 — shutdown at t=75s (~frame 30)
log "Launching JarvisTelemetry with auto phase timers"
log "  JARVIS_DISABLE_LOCKSCREEN=1"
log "  JARVIS_AUTO_LOCK_AFTER_MS=15000     (lock at t=15s,   ~frame 6)"
log "  JARVIS_AUTO_UNLOCK_AFTER_MS=45000   (unlock at t=45s, ~frame 18)"
log "  JARVIS_AUTO_SHUTDOWN_AFTER_MS=75000 (shutdown at t=75s, ~frame 30)"
JARVIS_DISABLE_LOCKSCREEN=1 \
JARVIS_AUTO_LOCK_AFTER_MS=15000 \
JARVIS_AUTO_UNLOCK_AFTER_MS=45000 \
JARVIS_AUTO_SHUTDOWN_AFTER_MS=75000 \
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

log "Waiting 2s so the first captured frame lands inside the boot sequence"
sleep 2

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
  --count 40 \
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
# JARVIS_AUTO_SHUTDOWN_AFTER_MS already fired startShutdown() 20s before the
# last capture frame, so the ShutdownSequenceView is mid-playback or finished
# by now. Check whether the process self-terminated (after the shutdown
# animation plus applicationWillTerminate), and SIGTERM only if it's still up.
log "Checking if app self-terminated via scheduled shutdown sequence"
if kill -0 "$APP_PID" 2>/dev/null; then
    log "Still running — sending SIGTERM"
    kill -TERM "$APP_PID" 2>/dev/null || true
    DEADLINE=$((SECONDS + 10))
    SHUTDOWN_STATUS="Clean shutdown via SIGTERM"
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
else
    log "App already terminated via scheduled shutdown sequence"
    SHUTDOWN_STATUS="Clean shutdown via JARVIS_AUTO_SHUTDOWN_AFTER_MS"
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
log "  [ ] frames 01-04: BOOT sequence (BootSequenceView)"
log "  [ ] frames 05-11: LIVE reactor + stress (nominal + reactive animations)"
log "  [ ] frames 12-22: LOCK screen cinematic animations"
log "  [ ] frames 23-30: UNLOCK + reactor recovery"
log "  [ ] frames 31-40: SHUTDOWN sequence (ShutdownSequenceView)"
log ""
log "Frames: $REACTIVE_DIR"
log "App log: $REACTIVE_DIR/jarvis_stderr.log"

# R-64: fail the demo on too-few frames or non-clean shutdown.
die() { printf '[run_reactive_demo][FAIL] %s\n' "$1" >&2; exit 1; }
if [[ "$FRAME_COUNT" -lt 36 ]]; then
    die "Expected >=36 frames, got $FRAME_COUNT"
fi
if [[ "$SHUTDOWN_STATUS" == "SIGKILL required" ]]; then
    die "SIGTERM non-compliance — SIGKILL was required"
fi
log "REACTIVE DEMO: PASS ($FRAME_COUNT frames, shutdown: $SHUTDOWN_STATUS)"
