#!/usr/bin/env zsh
# scripts/promo-video/assemble.sh — two-pass ffmpeg assembly with 7 validation gates.
# Reads inputs from promo/raw_captures, promo/ai_shots, promo/vo, promo/music.
# Writes promo/scenes/silent.mp4 (pass 1) and promo/JARVIS_PROMO_v${N}.mp4 (pass 2).
set -eu
set -o pipefail

REPO_ROOT="${REPO_ROOT:-/Users/vic/claude/General-Work/jarvis/jarvis-build}"
cd "$REPO_ROOT"

PROMO="$REPO_ROOT/promo"
RAW="$PROMO/raw_captures"
AI="$PROMO/ai_shots"
VO="$PROMO/vo"
MUSIC="$PROMO/music"
SCENES="$PROMO/scenes"
SCENES_DIR="$SCENES/slices"
QA="$PROMO/qa_frames"
mkdir -p "$SCENES" "$SCENES_DIR" "$QA"

log()  { printf "[assemble] %s\n" "$*"; }
die()  { printf "[assemble][FATAL] %s\n" "$*" >&2; exit 1; }
warn() { printf "[assemble][WARN] %s\n" "$*"; }

# ---- G1: raw captures present --------------------------------------------
for act in 1 2 3 4; do
  f="$RAW/act${act}.mp4"
  [[ -f "$f" ]] || die "G1: missing $f (run capture_scenes.py)"
  dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f")
  log "G1: act${act}.mp4 ${dur}s"
done

# ---- G2: VO lines present -------------------------------------------------
for i in 01 02 03 04 05 06 07 08 09 10; do
  f="$VO/line${i}.wav"
  [[ -f "$f" ]] || die "G2: missing $f (run generate_vo.py)"
  sz=$(stat -f%z "$f")
  [[ "$sz" -gt 10000 ]] || die "G2: $f only ${sz}B — likely empty (sandbox?)"
done
log "G2: 10 VO lines OK"

# ---- G3: music present ----------------------------------------------------
[[ -f "$MUSIC/score.mp3" ]] || die "G3: missing $MUSIC/score.mp3 (run pick_music.sh)"
mdur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$MUSIC/score.mp3")
aw=$(awk -v d="$mdur" 'BEGIN{print (d>=120)?1:0}')
[[ "$aw" == "1" ]] || die "G3: music track too short (${mdur}s < 120s)"
log "G3: score.mp3 ${mdur}s"

# ---- AI shots present -----------------------------------------------------
for name in intro outro; do
  [[ -f "$AI/${name}.mp4" ]] || die "missing $AI/${name}.mp4 (run generate_ai_shots.py)"
done

# ---- Fonts (download once if missing, fall back to system fonts) ----------
FONTS="$REPO_ROOT/scripts/promo-video/fonts"
mkdir -p "$FONTS"
if [[ ! -f "$FONTS/Orbitron-Bold.ttf" ]]; then
  log "downloading Orbitron-Bold.ttf (one-time)"
  curl -fsSL -o "$FONTS/Orbitron-Bold.ttf" \
    "https://github.com/google/fonts/raw/main/ofl/orbitron/static/Orbitron-Bold.ttf" \
    2>/dev/null || warn "Orbitron download failed; using system Helvetica"
fi
if [[ ! -f "$FONTS/Rajdhani-Medium.ttf" ]]; then
  log "downloading Rajdhani-Medium.ttf (one-time)"
  curl -fsSL -o "$FONTS/Rajdhani-Medium.ttf" \
    "https://github.com/google/fonts/raw/main/ofl/rajdhani/Rajdhani-Medium.ttf" \
    2>/dev/null || warn "Rajdhani download failed; using system Helvetica"
fi

ORBITRON="$FONTS/Orbitron-Bold.ttf"
RAJDHANI="$FONTS/Rajdhani-Medium.ttf"
[[ -s "$ORBITRON" ]] || ORBITRON="/System/Library/Fonts/Helvetica.ttc"
[[ -s "$RAJDHANI" ]] || RAJDHANI="/System/Library/Fonts/Helvetica.ttc"
log "fonts: orbitron=$ORBITRON rajdhani=$RAJDHANI"

# ---- Pass 1a: slice raw captures into scene clips -------------------------
slice() {
  local src="$1" start_in="$2" dur="$3" out="$4"
  ffmpeg -y -loglevel error \
    -ss "$start_in" -i "$src" -t "$dur" \
    -c:v libx264 -preset medium -crf 18 \
    -pix_fmt yuv420p -r 30 -an \
    "$out"
}

log "Pass 1a: slicing 17 scenes"

# Act 1: intro (AI 3s) + act1.mp4 slices [0-5,5-11,11-19,19-27]
slice "$AI/intro.mp4"   0   3  "$SCENES_DIR/01_intro.mp4"
slice "$RAW/act1.mp4"   0   5  "$SCENES_DIR/02_boot_ignition.mp4"
slice "$RAW/act1.mp4"   5   6  "$SCENES_DIR/03_boot_rings.mp4"
slice "$RAW/act1.mp4"   11  8  "$SCENES_DIR/04_hero_reactor.mp4"
slice "$RAW/act1.mp4"   19  8  "$SCENES_DIR/05_title_card.mp4"

# Act 2: act2.mp4 slices [0-7,7-18,18-28,28-35]
slice "$RAW/act2.mp4"   0   7  "$SCENES_DIR/06_panel_wide.mp4"
slice "$RAW/act2.mp4"   7  11  "$SCENES_DIR/07_left_panel.mp4"
slice "$RAW/act2.mp4"   18 10  "$SCENES_DIR/08_right_panel.mp4"
slice "$RAW/act2.mp4"   28  7  "$SCENES_DIR/09_panel_wide_return.mp4"

# Act 3: act3.mp4 slices [0-8,8-13,13-18,18-30]
slice "$RAW/act3.mp4"   0   8  "$SCENES_DIR/10_charger_unplug.mp4"
slice "$RAW/act3.mp4"   8   5  "$SCENES_DIR/11_low_power_hold.mp4"
slice "$RAW/act3.mp4"   13  5  "$SCENES_DIR/12_charger_reconnect.mp4"
slice "$RAW/act3.mp4"   18 12  "$SCENES_DIR/13_overdrive.mp4"

# Act 4: act4.mp4 slices [0-7,7-15,15-21] + outro (AI 4s)
slice "$RAW/act4.mp4"   0   7  "$SCENES_DIR/14_jarvis_links.mp4"
slice "$RAW/act4.mp4"   7   8  "$SCENES_DIR/15_lock_freeze.mp4"
slice "$RAW/act4.mp4"   15  6  "$SCENES_DIR/16_shutdown.mp4"
slice "$AI/outro.mp4"   0   4  "$SCENES_DIR/17_outro.mp4"

# ---- Pass 1b: overlay title card on scene 05 ------------------------------
log "Pass 1b: overlay JARVIS title on scene 05"
TITLE_IN="$SCENES_DIR/05_title_card.mp4"
TITLE_OUT="$SCENES_DIR/05_title_card_overlay.mp4"
ffmpeg -y -loglevel error -i "$TITLE_IN" -vf "\
drawtext=fontfile='$ORBITRON':text='JARVIS':fontcolor=0x1AE6F5:fontsize=220:x=(w-text_w)/2:y=(h-text_h)/2-40:alpha='if(lt(t\,0.5)\,0\,if(lt(t\,1.3)\,(t-0.5)*1.25\,if(lt(t\,5.0)\,1\,if(lt(t\,6.0)\,(6.0-t)\,0))))',\
drawtext=fontfile='$RAJDHANI':text='Cinema-grade telemetry for Apple Silicon':fontcolor=white:fontsize=56:x=(w-text_w)/2:y=(h/2)+140:alpha='if(lt(t\,1.5)\,0\,if(lt(t\,2.2)\,(t-1.5)*1.43\,if(lt(t\,5.0)\,1\,if(lt(t\,6.0)\,(6.0-t)\,0))))'\
" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -an "$TITLE_OUT"
mv "$TITLE_OUT" "$TITLE_IN"

# ---- Pass 1c: concat all scenes into silent.mp4 ---------------------------
log "Pass 1c: concat + colour grade -> silent.mp4"
CONCAT_LIST="$SCENES_DIR/concat.txt"
: > "$CONCAT_LIST"
for f in "$SCENES_DIR"/01_*.mp4 \
          "$SCENES_DIR"/02_*.mp4 \
          "$SCENES_DIR"/03_*.mp4 \
          "$SCENES_DIR"/04_*.mp4 \
          "$SCENES_DIR"/05_*.mp4 \
          "$SCENES_DIR"/06_*.mp4 \
          "$SCENES_DIR"/07_*.mp4 \
          "$SCENES_DIR"/08_*.mp4 \
          "$SCENES_DIR"/09_*.mp4 \
          "$SCENES_DIR"/10_*.mp4 \
          "$SCENES_DIR"/11_*.mp4 \
          "$SCENES_DIR"/12_*.mp4 \
          "$SCENES_DIR"/13_*.mp4 \
          "$SCENES_DIR"/14_*.mp4 \
          "$SCENES_DIR"/15_*.mp4 \
          "$SCENES_DIR"/16_*.mp4 \
          "$SCENES_DIR"/17_*.mp4 ; do
  echo "file '$f'" >> "$CONCAT_LIST"
done

SILENT="$PROMO/scenes/silent.mp4"
ffmpeg -y -loglevel error \
  -f concat -safe 0 -i "$CONCAT_LIST" \
  -vf "eq=contrast=1.1:saturation=1.05:brightness=0.02,unsharp=3:3:0.5" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 -an \
  "$SILENT"

# ---- G4: silent.mp4 is 120s ±1s ------------------------------------------
sdur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$SILENT")
aw=$(awk -v d="$sdur" 'BEGIN{print (d>=119 && d<=121)?1:0}')
[[ "$aw" == "1" ]] || die "G4: silent.mp4 duration ${sdur}s not in [119, 121]"
log "G4: silent.mp4 ${sdur}s ✓"

# ---- Pass 2: audio mix with sidechain ducking + loudnorm ------------------
log "Pass 2: audio mix"
VO_FILTERS=$(python3 <<'PY'
import sys
sys.path.insert(0, 'scripts/promo-video')
from lib.shot_list_loader import load
d = load()
vo = d['vo_lines']
# Emit adelay filter per line and a final amix
lines = []
for i, key in enumerate(sorted(vo.keys())):
    ms = int(vo[key]['place_at'] * 1000)
    idx = i + 1  # input index (0 is silent.mp4)
    lines.append(f"[{idx}:a]adelay={ms}|{ms},volume=1.5[v{idx}]")
mix_inputs = "".join(f"[v{i+1}]" for i in range(len(vo)))
lines.append(f"{mix_inputs}amix=inputs={len(vo)}:duration=longest:normalize=0[vo_mix]")
print(";".join(lines))
PY
)

# Collect VO inputs in sorted order
VO_ARGS=""
for f in "$VO"/line01.wav "$VO"/line02.wav "$VO"/line03.wav "$VO"/line04.wav \
         "$VO"/line05.wav "$VO"/line06.wav "$VO"/line07.wav "$VO"/line08.wav \
         "$VO"/line09.wav "$VO"/line10.wav ; do
  VO_ARGS+="-i $f "
done

FINAL_VER=1
while [[ -f "$PROMO/JARVIS_PROMO_v${FINAL_VER}.mp4" ]]; do
  FINAL_VER=$((FINAL_VER + 1))
done
FINAL="$PROMO/JARVIS_PROMO_v${FINAL_VER}.mp4"

# 0: silent video, 1..10: VO wavs, 11: music
# shellcheck disable=SC2086
ffmpeg -y -loglevel error \
  -i "$SILENT" \
  ${=VO_ARGS} \
  -i "$MUSIC/score.mp3" \
  -filter_complex "\
${VO_FILTERS};\
[vo_mix]apad=whole_dur=120,asplit=2[vo_duck][vo_out];\
[11:a]atrim=end=120,volume=0.5[music_raw];\
[music_raw][vo_duck]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=400[music_duck];\
[music_duck][vo_out]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,atrim=end=120[aout]" \
  -map 0:v -map "[aout]" \
  -c:v copy \
  -c:a aac -b:a 192k \
  -shortest \
  "$FINAL"

# ---- G5: final output probe ----------------------------------------------
probe=$(ffprobe -v error -show_entries format=duration \
        -show_entries stream=width,height,codec_name,r_frame_rate,pix_fmt \
        -of default=noprint_wrappers=1 "$FINAL")
log "G5 probe:"
echo "$probe" | sed 's/^/  /'
echo "$probe" | grep -q "width=2560" || die "G5: width != 2560"
echo "$probe" | grep -q "height=1440" || die "G5: height != 1440"
echo "$probe" | grep -q "r_frame_rate=30/1" || die "G5: fps != 30"
echo "$probe" | grep -q "pix_fmt=yuv420p" || die "G5: pix_fmt != yuv420p"

# ---- G6: loudness check (non-fatal) ---------------------------------------
lufs_out=$(ffmpeg -nostats -hide_banner -i "$FINAL" \
  -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s*I:" | head -1 || true)
if [[ -n "$lufs_out" ]]; then
  log "G6: $lufs_out"
fi

# ---- G7: sanity frames ----------------------------------------------------
for t in 0 15 45 75 105 115; do
  ffmpeg -y -loglevel error -ss "$t" -i "$FINAL" -frames:v 1 \
    -q:v 2 "$QA/t${t}s.png"
done
log "G7: sanity frames in $QA/"

log "DONE: $FINAL"
