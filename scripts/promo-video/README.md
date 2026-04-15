# JARVIS Promotional Video Pipeline

Build a ~120-second cinematic JARVIS promo (2560×1440 @ 30fps, 16:9, H.264 + AAC MP4)
via a hybrid pipeline: live screen capture of the running Swift app for real feature
beats, Runway / Gemini / Ken-Burns for cinematic intro + outro wrapping, in-character
JARVIS British butler TTS narration, and a curated royalty-free orchestral score.

See `docs/superpowers/specs/2026-04-15-jarvis-promo-video-design.md` for the full
design and `docs/superpowers/plans/2026-04-15-jarvis-promo-video.md` for the
implementation plan.

## Usage

```bash
# One-time: cache sudo so capture_scenes.py can launch the app with IOKit/SMC access
sudo -v

# First run — rough cut with offline fallbacks only (no paid API cost)
./scripts/promo-video/run.sh --rough

# After reviewing the rough cut — polish pass with Runway + OpenAI TTS + curated music
./scripts/promo-video/run.sh --polish
```

Output lands in `promo/JARVIS_PROMO_v{N}.mp4` (gitignored). Music licence attribution
is kept alongside as `promo/music/LICENCE.txt`. Sanity frames for manual review are
extracted to `promo/qa_frames/*.png`.

## Prerequisites

- **macOS 14+** on Apple Silicon (required by JarvisTelemetry)
- **ffmpeg + ffprobe** (`brew install ffmpeg`)
- **cliclick** — optional, only needed for Act 4 link-click automation (`brew install cliclick`)
- **Python 3** with `pyyaml` and `requests` (`pip3 install pyyaml requests python-dotenv`)
- **Screen Recording permission** granted to Terminal (or your ffmpeg binary) in
  *System Settings → Privacy & Security → Screen Recording*. Without this the first
  `./run.sh --rough` will abort at the preflight ffmpeg avfoundation probe with a
  clear error message.
- **Sudo credentials cached** (`sudo -v`) before running — the app needs root for
  IOKit / SMC sensor reads.
- **API keys** in `tests/api_keys.env` or `~/.jarvis/.env`:
  - `OPENAI_API_KEY` — TTS `fable` voice (polish pass)
  - `RUNWAY_API_KEY` — Gen-3 Alpha Turbo image-to-video (polish pass)
  - `GEMINI_API_KEY` — Imagen still generation + Veo fallback
  - Rough mode needs **none** of these.

## Pipeline phases

| Phase | Script | Purpose |
|---|---|---|
| 1 | `capture_scenes.py` | Launches JarvisTelemetry for each of 4 acts and screen-records via ffmpeg avfoundation. Act 3 uses `JARVIS_BATTERY_REPLAY` to drive the battery drama. |
| 2 | `generate_vo.py` | Synthesises 10 VO lines via OpenAI `tts-1-hd` `fable` voice (polish) or macOS `say -v Daniel` (rough / fallback). |
| 3 | `pick_music.sh` | Downloads a curated Pixabay orchestral-cinematic track, or falls back to a bundled ffmpeg-synthesised ambient drone. |
| 4 | `generate_ai_shots.py` | Generates `intro.mp4` and `outro.mp4` via Runway Gen-3 (polish) or ffmpeg Ken-Burns zoompan on a Gemini / OpenAI still (rough). |
| 5 | `assemble.sh` | Two-pass ffmpeg: Pass 1 slices raw captures into scenes, overlays title cards, concats, colour grades. Pass 2 muxes audio with music bed + VO sidechain ducking + loudnorm. Seven validation gates check inputs, timing, encode, loudness, and extract sanity frames. |

## Fallback chains

- **TTS:** OpenAI `fable` → macOS `say -v Daniel`
- **AI shots:** Runway Gen-3 → ffmpeg Ken-Burns on a Gemini Imagen / OpenAI Image still
- **Music:** Pixabay download → bundled ambient drone

Each phase logs which provider it used so the provenance of every asset is traceable.

## Idempotence

Every phase skips work whose output already exists, so:
- Re-running `./run.sh --rough` is cheap (no redundant work).
- Editing `shot_list.yaml` and re-running regenerates only the affected VO lines.
- Upgrading from rough to polish: `rm promo/vo/*.wav promo/ai_shots/*.mp4` first,
  then `./run.sh --polish` — raw screen captures are kept.

## Directory layout

```
scripts/promo-video/
├── run.sh                         master orchestrator
├── shot_list.yaml                 single source of truth
├── capture_scenes.py
├── generate_ai_shots.py
├── generate_vo.py
├── pick_music.sh
├── assemble.sh
├── lib/shot_list_loader.py        shared YAML loader
├── replay_sequences/              battery timelines for Act 3
├── fonts/                         downloaded Orbitron + Rajdhani (gitignored)
└── music-fallback.mp3             bundled offline music fallback

promo/                             gitignored working output
├── raw_captures/act{1..4}.mp4
├── ai_shots/{intro,outro}.mp4
├── vo/line{01..10}.wav
├── music/score.mp3 + LICENCE.txt
├── scenes/silent.mp4
├── qa_frames/*.png
└── JARVIS_PROMO_v{N}.mp4          final output
```
