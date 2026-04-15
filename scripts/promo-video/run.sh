#!/usr/bin/env zsh
# scripts/promo-video/run.sh — JARVIS promo video master orchestrator.
# Usage: ./run.sh --rough   (offline fallbacks, no paid API)
#        ./run.sh --polish  (Runway + OpenAI TTS + curated music)
set -eu
set -o pipefail

MODE="${1:---rough}"
REPO_ROOT="${REPO_ROOT:-/Users/vic/claude/General-Work/jarvis/jarvis-build}"
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
  *)
    echo "usage: $0 [--rough|--polish]" >&2
    exit 2
    ;;
esac

echo "================================================================"
echo " JARVIS promo video — mode: $MODE"
echo "================================================================"

# Sudo credentials (capture_scenes.py needs them to launch the app)
if ! sudo -n true 2>/dev/null; then
  echo "[run] sudo credentials not cached. Run 'sudo -v' in this terminal first."
  exit 1
fi

# Phase 1: capture scenes (idempotent)
echo ""
echo "--- Phase 1: scene capture ---"
python3 scripts/promo-video/capture_scenes.py

# Phase 2: VO synthesis (idempotent)
echo ""
echo "--- Phase 2: voice narration ---"
python3 scripts/promo-video/generate_vo.py

# Phase 3: music download (idempotent)
echo ""
echo "--- Phase 3: music ---"
./scripts/promo-video/pick_music.sh 1

# Phase 4: AI shots (Ken-Burns in rough, Runway in polish)
echo ""
echo "--- Phase 4: AI shots ---"
python3 scripts/promo-video/generate_ai_shots.py

# Phase 5: assembly
echo ""
echo "--- Phase 5: assembly ---"
./scripts/promo-video/assemble.sh

echo ""
echo "[run] DONE. Final cuts in promo/JARVIS_PROMO_v*.mp4"
ls -la promo/JARVIS_PROMO_v*.mp4 2>/dev/null || true
