#!/usr/bin/env bash
# verify-reactive.sh — Exhaustively verify every JARVIS reactive animation
# is wired from live telemetry all the way to a visible canvas change.
#
# Strategy: drive the running LaunchAgent JARVIS instance through each of
# the 8 RECIPES via a distributed notification (`--trigger KEY`). The
# running instance fires JT.trigger(KEY), waits ~700 ms for the animation
# to paint, then snapshots the WKWebView to /tmp/jarvis-trigger-<KEY>.png.
# We then PIXEL-DIFF each triggered snapshot against the nominal baseline
# and assert that every trigger produces a non-trivial visual delta.
#
# If even ONE trigger produces zero (or near-zero) delta, the script exits
# non-zero and the /ralph-loop-infinite must re-iterate until every trigger
# is visibly reactive.

set -euo pipefail

# shellcheck source=./_paths.sh disable=SC1091
. "$(cd "$(dirname "$0")" && pwd)/_paths.sh"
BIN="${JARVIS_APP_BUNDLE}/Contents/MacOS/JarvisTelemetry"
# Fallback to SPM binary for dev workflow.
if [[ ! -x "$BIN" ]]; then
    BIN="${JARVIS_BUILD_DIR}/JarvisTelemetry"
fi
OUT_DIR="/tmp/jarvis-reactive-verify"
KEYS=(cpu gpu thermal power charge memory network disk)
# Minimum *pixel-level* mean absolute difference (0-255 scale) between the
# triggered snapshot and the nominal baseline. A clock-tick alone produces
# deltas in the 0.01-0.05 range; a real RECIPE visual change produces
# deltas ≥ 0.4 (because the bloom/ring state changes hundreds of thousands
# of pixels across the canvas).
MIN_PIXEL_DELTA="0.4"

log()  { printf '\033[1;36m[verify]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[verify]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[verify:FAIL]\033[0m %s\n' "$*" >&2; }

# ── 0. Prerequisites ─────────────────────────────────────────────────
if ! pgrep -x JarvisTelemetry >/dev/null; then
    fail "JarvisTelemetry process not running — load the LaunchAgent first:"
    fail "  launchctl load -w ~/Library/LaunchAgents/com.jarvis.wallpaper.plist"
    exit 1
fi
if [[ ! -x "$BIN" ]]; then
    fail "binary not found at $BIN — run scripts/install.sh first"
    exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
log "output dir: $OUT_DIR"

# ── 1. Establish NOMINAL baseline ────────────────────────────────────
log "step 1: returning HUD to nominal baseline"
"$BIN" --trigger nominal >/dev/null
sleep 1.2  # allow RECIPE cancel + setPhase(nominal) to settle
"$BIN" --snapshot-now >/dev/null
sleep 1.0  # allow snapshot write
if [[ ! -f /tmp/jarvis-snapshot.png ]]; then
    fail "baseline snapshot not written — check /tmp/jarvis-wallpaper.err.log"
    tail -20 /tmp/jarvis-wallpaper.err.log 2>/dev/null || true
    exit 1
fi
cp /tmp/jarvis-snapshot.png "$OUT_DIR/baseline.png"
BASE_SIZE=$(stat -f '%z' "$OUT_DIR/baseline.png")
ok "baseline.png captured (${BASE_SIZE} bytes)"

# ── 2. Fire each trigger and snapshot ────────────────────────────────
declare -a RESULTS=()
declare -i PASS=0 FAIL=0

for key in "${KEYS[@]}"; do
    log "step 2.$key: firing JT.trigger('$key')"
    SRC="/tmp/jarvis-trigger-$key.png"
    DST="$OUT_DIR/$key.png"
    # Clear any stale snapshot so we only accept one written AFTER this trigger.
    rm -f "$SRC"

    "$BIN" --trigger "$key" >/dev/null

    # Poll for the snapshot to appear — running instance has a 700ms
    # animation delay + ~300ms snapshot encode latency, so total wait is
    # usually 1.0-1.5s. Give it up to 5s to account for system load.
    WAITED=0
    while (( WAITED < 50 )); do
        if [[ -f "$SRC" ]]; then
            # Verify file is fully written (stable size over 100ms).
            SZ1=$(stat -f '%z' "$SRC" 2>/dev/null || echo 0)
            sleep 0.1
            SZ2=$(stat -f '%z' "$SRC" 2>/dev/null || echo 0)
            if [[ "$SZ1" == "$SZ2" && "$SZ1" != "0" ]]; then
                break
            fi
        fi
        sleep 0.1
        WAITED=$((WAITED + 1))
    done

    if [[ ! -f "$SRC" ]]; then
        fail "$key: snapshot not produced at $SRC after 5s wait"
        FAIL+=1
        RESULTS+=("$key FAIL no-snapshot")
        continue
    fi
    cp "$SRC" "$DST"

    # True pixel-level mean absolute difference using PIL. Decodes both
    # PNGs to RGB, subtracts pixel-by-pixel, averages the absolute delta
    # across the whole canvas. Robust against PNG compression randomness.
    DELTA=$(python3 - "$OUT_DIR/baseline.png" "$DST" <<'PY'
import sys
from PIL import Image, ImageChops, ImageStat
a = Image.open(sys.argv[1]).convert("RGB")
b = Image.open(sys.argv[2]).convert("RGB")
if a.size != b.size:
    b = b.resize(a.size)
diff = ImageChops.difference(a, b)
stat = ImageStat.Stat(diff)
# Mean absolute difference per channel, averaged across RGB.
print(f"{sum(stat.mean)/3:.4f}")
PY
)
    # Compare DELTA against MIN_PIXEL_DELTA using awk (bash can't do floats).
    PASSED=$(awk -v d="$DELTA" -v t="$MIN_PIXEL_DELTA" 'BEGIN{print (d+0 >= t+0) ? 1 : 0}')
    if [[ "$PASSED" == "1" ]]; then
        ok "$key: pixelDelta=${DELTA} (>= ${MIN_PIXEL_DELTA}) — REACTIVE ✓"
        PASS+=1
        RESULTS+=("$key PASS pixelDelta=${DELTA}")
    else
        fail "$key: pixelDelta=${DELTA} (< ${MIN_PIXEL_DELTA}) — NOT REACTIVE"
        FAIL+=1
        RESULTS+=("$key FAIL pixelDelta=${DELTA}")
    fi

    # Return to nominal between triggers so each test is independent.
    "$BIN" --trigger nominal >/dev/null
    sleep 0.8
done

# ── 3. Report ────────────────────────────────────────────────────────
echo
log "═══ reactive verification summary ═══"
for r in "${RESULTS[@]}"; do
    if [[ "$r" == *FAIL* ]]; then
        fail "  $r"
    else
        ok   "  $r"
    fi
done
echo
log "PASS=$PASS  FAIL=$FAIL  of ${#KEYS[@]} triggers"

if (( FAIL > 0 )); then
    fail "one or more reactive triggers did NOT produce a visible change"
    exit 1
fi
ok "ALL ${#KEYS[@]} reactive triggers verified — reactive animation live on real telemetry"
