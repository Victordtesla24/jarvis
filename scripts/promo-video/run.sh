#!/usr/bin/env bash
# scripts/promo-video/run.sh — JARVIS promo video master orchestrator.
# Usage: ./run.sh --rough              offline fallbacks, no paid API
#        ./run.sh --polish             Runway + OpenAI TTS + curated music
#        ./run.sh --rough --json       progress->stderr, final JSON->stdout
#
# R-46: progress → stderr. Final artifact path (or JSON) → stdout.
set -eu
set -o pipefail

MODE=""
EMIT_JSON=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rough|--polish) MODE="$1"; shift;;
    --json) EMIT_JSON=1; shift;;
    -h|--help)
      cat <<'EOF' >&2
Usage: run.sh [--rough|--polish] [--json]
  --rough       offline fallbacks only (no paid API)
  --polish      Runway + OpenAI TTS + curated music
  --json        emit one-line JSON {"output","duration_s","size_b"} on success
EOF
      exit 0
      ;;
    *)
      echo "usage: $0 [--rough|--polish] [--json]" >&2
      exit 2
      ;;
  esac
done
MODE="${MODE:---rough}"

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$REPO_ROOT"

case "$MODE" in
  --rough)
    export PROMO_MODE=rough
    export PROMO_VO_FORCE_FALLBACK=1
    ;;
  --polish)
    export PROMO_MODE=polish
    export PROMO_VO_FORCE_FALLBACK=0
    ;;
esac

log() { printf '%s\n' "$*" >&2; }

log "================================================================"
log " JARVIS promo video — mode: $MODE"
log "================================================================"

if sudo -n true 2>/dev/null; then
  log "[run] sudo cached — full SMC sensor access"
else
  log "[run] sudo not cached — running unprivileged (SMC temps may report 0)"
fi

log ""
log "--- Phase 1: scene capture ---"
python3 scripts/promo-video/capture_scenes.py >/dev/null

log ""
log "--- Phase 2: voice narration ---"
python3 scripts/promo-video/generate_vo.py

log ""
log "--- Phase 3: music ---"
./scripts/promo-video/pick_music.sh 1 >&2

log ""
log "--- Phase 4: AI shots ---"
python3 scripts/promo-video/generate_ai_shots.py

log ""
log "--- Phase 5: assembly ---"
FINAL_PATH=$(./scripts/promo-video/assemble.sh)

# Fallback: assemble.sh prints the path on last stdout line; otherwise probe promo/
if [[ -z "${FINAL_PATH:-}" || ! -f "$FINAL_PATH" ]]; then
  FINAL_PATH=$(find "$REPO_ROOT/promo" -maxdepth 1 -type f -name 'JARVIS_PROMO_v*.mp4' -print0 2>/dev/null \
              | xargs -0 stat -f '%m %N' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
fi

[[ -n "$FINAL_PATH" && -f "$FINAL_PATH" ]] || {
  log "[run] ERROR: no final artifact produced"
  exit 1
}

DURATION=$(ffprobe -v error -show_entries format=duration \
           -of default=noprint_wrappers=1:nokey=1 "$FINAL_PATH" 2>/dev/null || echo 0)
SIZE=$(stat -f%z "$FINAL_PATH" 2>/dev/null || echo 0)

log ""
log "[run] DONE. Final cut: $FINAL_PATH"

if [[ "$EMIT_JSON" == "1" ]]; then
  printf '{"output":"%s","duration_s":%s,"size_b":%s}\n' \
    "$FINAL_PATH" "$DURATION" "$SIZE"
else
  printf '%s\n' "$FINAL_PATH"
fi
