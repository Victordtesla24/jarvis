#!/usr/bin/env zsh
# scripts/promo-video/pick_music.sh — Download curated royalty-free score.
# Usage: ./pick_music.sh [candidate_number]   (1, 2, or 3; default 1)
# Writes promo/music/score.mp3 and promo/music/LICENCE.txt. Falls back to
# the bundled ambient drone if download fails or the network is blocked.
set -eu
set -o pipefail

CAND="${1:-1}"
REPO_ROOT="${REPO_ROOT:-/Users/vic/claude/General-Work/jarvis/jarvis-build}"
OUT_DIR="$REPO_ROOT/promo/music"
OUT_MP3="$OUT_DIR/score.mp3"
OUT_LIC="$OUT_DIR/LICENCE.txt"
FALLBACK="$REPO_ROOT/scripts/promo-video/music-fallback.mp3"

mkdir -p "$OUT_DIR"

# Idempotent: keep existing file if valid and ≥120s
if [[ -f "$OUT_MP3" ]]; then
  dur=$(ffprobe -v error -show_entries format=duration \
        -of default=noprint_wrappers=1:nokey=1 "$OUT_MP3" 2>/dev/null || echo 0)
  if [[ -n "$dur" && $(echo "$dur >= 120" | bc -l) -eq 1 ]]; then
    echo "[pick_music] keeping existing $OUT_MP3 (${dur}s)"
    exit 0
  fi
fi

# --- Candidate tracks (Pixabay Music, CC0 / YouTube-safe) -------------------
case "$CAND" in
  1)
    TRACK_NAME="Cinematic Dramatic Epic Trailer"
    TRACK_URL="https://cdn.pixabay.com/download/audio/2022/10/25/audio_946bc8eb46.mp3"
    ATTRIBUTION="Pixabay — Cinematic Dramatic Epic Trailer (CC0, free for commercial use, no attribution required)"
    ;;
  2)
    TRACK_NAME="Epic Orchestra"
    TRACK_URL="https://cdn.pixabay.com/download/audio/2023/06/19/audio_5a8d3e6e8f.mp3"
    ATTRIBUTION="Pixabay — Epic Orchestra (CC0)"
    ;;
  3)
    TRACK_NAME="Cinematic Tech"
    TRACK_URL="https://cdn.pixabay.com/download/audio/2022/03/15/audio_1a19f2c3ab.mp3"
    ATTRIBUTION="Pixabay — Cinematic Tech (CC0)"
    ;;
  *)
    echo "[pick_music] unknown candidate: $CAND (use 1, 2, or 3)" >&2
    exit 2
    ;;
esac

echo "[pick_music] candidate $CAND: $TRACK_NAME"
DOWNLOAD_OK=0
if curl -fsSL --max-time 60 -o "$OUT_MP3.tmp" "$TRACK_URL" 2>/dev/null; then
  mv "$OUT_MP3.tmp" "$OUT_MP3"
  dur=$(ffprobe -v error -show_entries format=duration \
        -of default=noprint_wrappers=1:nokey=1 "$OUT_MP3" 2>/dev/null || echo 0)
  if [[ -n "$dur" && $(echo "$dur >= 120" | bc -l) -eq 1 ]]; then
    echo "[pick_music] downloaded OK (${dur}s)"
    DOWNLOAD_OK=1
  else
    echo "[pick_music] downloaded file too short (${dur}s), using fallback"
  fi
else
  echo "[pick_music] download failed (network or URL unavailable), using fallback"
fi

if [[ "$DOWNLOAD_OK" == "0" ]]; then
  cp "$FALLBACK" "$OUT_MP3"
  ATTRIBUTION="Bundled JARVIS ambient drone (synthesised fallback, public domain)"
fi

cat > "$OUT_LIC" <<EOF
JARVIS promotional video — music attribution
=============================================
Track:    $TRACK_NAME
Source:   $ATTRIBUTION
Used in:  promo/JARVIS_PROMO_v*.mp4

This file is kept alongside the final MP4 for provenance.
EOF

echo "[pick_music] wrote $OUT_MP3 and $OUT_LIC"
