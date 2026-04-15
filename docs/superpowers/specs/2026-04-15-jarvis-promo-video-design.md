---
date: 2026-04-15
topic: jarvis-promo-video
status: approved
type: feat
origin: brainstorming session 2026-04-15
---

# JARVIS Promotional Video — Design Spec

## Overview

A ~120-second cinematic promotional video for JARVIS Telemetry, targeting YouTube/Vimeo, rendered at 2560×1440 @ 30fps. The video showcases four feature beats — cold boot + hero reactor, floating panels + chatter, battery/thermal reactive drama, and macOS integration + shutdown closer — wrapped in AI-generated cinematic intro and outro shots. Narration is in an in-character JARVIS British-butler voice; music is a curated royalty-free orchestral-cinematic score. Production mode is hybrid: ~85% live screen capture of the real running Swift app, ~15% Runway-generated AI cinematic wrapping. Final output is a single MP4 delivered as `promo/JARVIS_PROMO_v1.mp4`.

## Problem Frame

JARVIS Telemetry is visually striking but has no polished way to show its features to anyone who cannot install, build, and run the Swift/Go codebase locally. The existing `tests/output/references/target_reference.mp4` (89 MB, 30s, 2560×1440) is a raw capture with no narration, music, or narrative structure — suitable as a technical reference but not as a promotional asset. A cinematic promo closes this gap: it turns the product into something that can be watched, shared, and understood in two minutes without any tooling.

## Scope Boundaries

**In scope:**
- A new `scripts/promo-video/` directory containing the full production pipeline (orchestration script, scene capture, AI shot generation, TTS, music selection, ffmpeg assembly).
- A minimal change to `JarvisTelemetry/Sources/JarvisTelemetry/BatteryMonitor.swift` to support deterministic battery-state replay for the Act 3 battery drama.
- A single YAML source-of-truth file `shot_list.yaml` defining every shot, VO line, music cue, and transition.
- Two ffmpeg passes: video (concat + crossfades + title cards + color grade) and audio (music + VO with sidechain ducking + loudness normalisation).
- Seven validation gates that verify captures, VO, music, timing, encode settings, loudness, and sanity frames.
- A rough-cut → polish iteration flow using layered fallback providers so the first rough cut runs entirely offline.

**Out of scope:**
- 9:16 vertical and 1:1 square variants (trivial to add later from the same pipeline, not required for YouTube).
- Burned-in subtitles / SRT captions (easy to add from the VO script, not requested).
- Multiple-language VO.
- YouTube thumbnail generation.
- Automated upload to YouTube / Vimeo.
- Any change to the existing `JarvisTelemetry/Sources/JarvisTelemetry/VideoGenerationPipeline.swift` — that Swift pipeline serves a different purpose (user-provided images) and stays untouched.
- Any change to `JarvisWallpaper/` — only `JarvisTelemetry/` is touched.

## Context & Research

### Existing assets and tooling

- `tests/output/references/target_reference.mp4` — 89 MB, 30s, 2560×1440 @ 30fps, H.264. Establishes the resolution/framerate baseline.
- `tests/generate_marvel_assets.py` — existing multi-provider image-gen script (Runway → OpenAI → OpenRouter → Replicate → Stability). The provider-fallback pattern is reused directly.
- `tests/lib/visual_lib.py` — existing screen/window capture primitives using Quartz `CGWindowListCreateImage`. Used as the capture fallback when ffmpeg avfoundation is unavailable.
- `tests/build_and_launch.sh` — existing app launch wrapper. Reused by `capture_scenes.py`.
- `JarvisTelemetry/Sources/JarvisTelemetry/VideoGenerationPipeline.swift` — existing Swift pipeline for user-provided image → video conversion. NOT used by the promo pipeline. Stays untouched.
- `JarvisTelemetry/Sources/JarvisTelemetry/BatteryMonitor.swift` — polls IOKit power sources at 2 Hz for `batteryPercent` / `isCharging`. Minimal change adds a `JARVIS_BATTERY_REPLAY` env var that swaps IOKit polling for a pre-recorded JSON timeline. `TelemetryBridge.swift` is untouched.
- `JarvisTelemetry/Sources/JarvisTelemetry/HUDPhaseController.swift` — the theatrical boot/shutdown sequences. These are already cinema-quality and need no changes; capture just records them.
- `JarvisTelemetry/Sources/JarvisTelemetry/JarvisPersonality.swift` — the battery reactivity controller that produces the Act 3 drama.

### Available API keys (from `tests/api_keys.env` and `~/.jarvis/.env`)

| Key | Purpose in pipeline |
|---|---|
| `RUNWAY_API_KEY` | Primary AI shot generator (Gen-3 Alpha Turbo image-to-video) |
| `GEMINI_API_KEY` | Fallback AI shot generator (Veo) + still image generator (Imagen) for Ken-Burns fallback |
| `OPENAI_API_KEY` | TTS `tts-1-hd` model, `fable` voice for VO; fallback still image source |
| `ANTHROPIC_API_KEY` | Not used in pipeline |
| `OPENROUTER_API_KEY` | Unused; kept as a deeper fallback tier if ever needed |

### Installed tools

- `/opt/homebrew/bin/ffmpeg`, `/opt/homebrew/bin/ffprobe` — present.
- macOS `say` command — built in, `Daniel` voice pre-installed (British English).
- `cliclick` — not verified installed; `run.sh` checks at startup and prompts `brew install cliclick` if missing.

### Target venue and format decisions (resolved during brainstorming)

- **Venue:** YouTube / Vimeo (feature-complete walkthrough)
- **Length:** 120s ±2s, nominal target
- **Aspect:** 16:9, 2560×1440 @ 30fps, H.264 + AAC in MP4 container
- **Production mode:** Hybrid — ~85% live capture, ~15% AI-generated cinematic wrapping
- **VO style:** JARVIS British butler voice, in-character
- **Music:** Royalty-free curated orchestral-cinematic (Pixabay Music or equivalent CC0 / YouTube-safe source)
- **Iteration approach:** Rough cut → polish. First cut runs offline with free fallbacks; polish pass spends API credits only after the rough cut is approved.

## Key Technical Decisions

1. **Single source of truth in `shot_list.yaml`.** Every script reads the same YAML for timing, sources, VO lines, and transitions. Eliminates timing drift between capture, VO synthesis, and assembly.
2. **Idempotent phase scripts.** Each phase (`capture_scenes.py`, `generate_vo.py`, etc.) skips work whose output already exists. Rerunning after a tweak only regenerates what changed. Makes iteration cheap.
3. **Layered provider fallback, not retry loops.** If Runway fails, fall through to Gemini Veo, then to Ken-Burns zoom on a Gemini/OpenAI-generated still. Log which provider was actually used so the provenance of every shot is traceable. Same pattern for TTS (OpenAI `fable` → macOS `say Daniel`) and music (curated track → bundled ambient fallback).
4. **Two-pass ffmpeg assembly.** Pass 1 builds a silent video (concat + crossfades + title cards + color grade), Pass 2 muxes the mixed audio (music + VO with sidechain ducking + loudness normalisation). Two passes are easier to debug and rerun independently than one mega filter-graph.
5. **`BatteryMonitor` gains a replay env var.** A new `JARVIS_BATTERY_REPLAY=path/to/battery_timeline.json` env var makes `BatteryMonitor` read a scripted timeline of `(t, batteryPercent, isCharging)` frames instead of polling IOKit. This is the only way to produce the Act 3 battery drama deterministically on a machine that isn't at 4% battery. All downstream reactive logic (ring slowdown, core dim, chatter fade, spark burst) flows through `JarvisPersonality` which already reads `BatteryMonitor`, so only one file is touched. `TelemetryBridge` is untouched — the live Go daemon still drives real CPU / GPU / thermal values, which is exactly what we want. ~30 LOC change to `BatteryMonitor.swift`.
6. **`VideoGenerationPipeline.swift` stays untouched.** That Swift class is for user-provided images, not for screen-capture-based promos. Duplicating functionality is avoided by keeping the promo pipeline Python-side.
7. **Rough cut first.** The first run (`run.sh --rough`) uses Ken-Burns fallback for AI shots, macOS `say Daniel` for VO, and a bundled placeholder music track. Produces a watchable ~5-10 min wall-clock cut with zero external API cost. The polish pass only spends credits after the rough cut is approved.
8. **Validation gates abort early and loudly.** Seven gates check captures, VO, music, timing drift, encode settings, loudness, and sanity frames. Anything wrong halts the pipeline at the earliest possible point with a clear error message.

## Open Questions

### Resolved during brainstorming

- **How do we produce the Act 3 battery drama without actually draining the battery?** → New `JARVIS_TELEMETRY_REPLAY` env var in `TelemetryBridge` that swaps the Go daemon for a scripted JSON sequence.
- **Which TTS voice fits "posh British butler"?** → OpenAI `tts-1-hd` `fable` voice primary, macOS `say -v Daniel` fallback.
- **Runway vs Ken-Burns for cinematic shots?** → Runway for the polish pass (budget ~$4 for 2 generations), Ken-Burns for the rough cut (zero cost).
- **Where does the music come from?** → Royalty-free Pixabay Music, shortlist 3 candidates after the Act 1+2 rough cut, A/B pick the winner.
- **Do we touch the existing `VideoGenerationPipeline.swift`?** → No. It's for a different purpose. The promo pipeline is Python-side.

### Deferred to implementation

- **Exact music track.** Shortlisted after the rough cut so we can A/B candidates against real footage.
- **Exact Runway Gen-3 prompts and seed reference images.** Hand-tuned during the polish pass based on how the AI shots composite against live capture in the rough cut.
- **Exact title card fade timing and easing curves.** Decided during Pass 1 assembly iteration.

## High-Level Technical Design

### Directory layout

```
scripts/promo-video/
├── run.sh                              master orchestrator
├── shot_list.yaml                      single source of truth
├── capture_scenes.py                   screen capture orchestration
├── generate_ai_shots.py                Runway / Gemini / Ken-Burns fallback chain
├── generate_vo.py                      OpenAI fable / macOS say Daniel
├── pick_music.sh                       Pixabay curl, 3 candidates
├── assemble.sh                         two-pass ffmpeg
├── README.md                           how to run + prerequisites
├── replay_sequences/
│   └── act3_battery_drama.json         scripted telemetry for Act 3
├── fonts/                              gitignored, downloaded on first run
│   ├── Orbitron-Bold.ttf
│   └── Rajdhani-Medium.ttf
└── music-fallback.mp3                  bundled offline fallback track

promo/                                  gitignored working dir
├── raw_captures/
│   ├── act1.mp4
│   ├── act2.mp4
│   ├── act3.mp4
│   └── act4.mp4
├── ai_shots/
│   ├── intro.mp4
│   └── outro.mp4
├── vo/
│   ├── line01.wav
│   ├── line02.wav
│   └── …                               10 lines total
├── music/
│   ├── score.mp3
│   └── LICENCE.txt
├── scenes/
│   └── silent.mp4                      Pass 1 intermediate
├── qa_frames/
│   ├── t000s.png
│   ├── t015s.png
│   └── …
└── JARVIS_PROMO_v1.mp4                 final output, versioned
```

### Data flow

```
shot_list.yaml
      │
      ├──▶ capture_scenes.py ─────▶ promo/raw_captures/act{1..4}.mp4
      ├──▶ generate_ai_shots.py ──▶ promo/ai_shots/{intro,outro}.mp4
      ├──▶ generate_vo.py ────────▶ promo/vo/line{01..11}.wav
      ├──▶ pick_music.sh ─────────▶ promo/music/score.mp3
      │
      └──▶ assemble.sh
                 ├─ Pass 1 ──▶ promo/scenes/silent.mp4
                 └─ Pass 2 ──▶ promo/JARVIS_PROMO_v{N}.mp4
```

### Narrative structure — 4 acts, ~120 seconds total

#### Act 1 — Cold Boot + Hero Reactor (0:00–0:30)

| Time | Shot | Source | VO line |
|---|---|---|---|
| 0:00–0:03 | Pitch black, single cyan pixel materialises, ambient drone rises | AI (Runway / Ken-Burns fallback) | — |
| 0:03–0:08 | Shockwave expands outward, 12 rings materialise staggered, boot-text reads live chip name / core counts | Live capture (HUDPhaseController.boot) | "Good evening. I am JARVIS." |
| 0:08–0:14 | Push-in (ffmpeg zoompan) toward reactor core; core ignites white-blue; ring rotation begins | Live capture | "Initialising Apple Silicon telemetry array." |
| 0:14–0:22 | Full reactor hero shot at 1:1 scale, scanner overlay sweeps, DigitCipherText flickers live values | Live capture | (silence + music hit) |
| 0:22–0:30 | Title card overlay "JARVIS" in Orbitron + subtitle "Cinema-grade telemetry for Apple Silicon" | Live capture + drawtext overlay | "All cores reporting. Nominal." |

#### Act 2 — Floating Panels + Chatter (0:30–1:05)

| Time | Shot | Source | VO line |
|---|---|---|---|
| 0:30–0:37 | Pull-back reveal, full HUD with left + right floating panels | Live capture | "Live data streams." |
| 0:37–0:48 | Close-up on left panel (clock, storage, app list, chatter scrolls, DigitCipherText) | Live capture (crop) | "Memory bandwidth, neural engine, GPU frequency." |
| 0:48–0:58 | Close-up on right panel (network I/O dots, Tier 2 animations: DRAM BW waves, ANE arc, GUMER particles, GPU freq ticks) | Live capture (crop) | "Every microsecond, rendered." |
| 0:58–1:05 | Wide shot again, music builds | Live capture | — |

#### Act 3 — Reactive Drama: Battery + Thermal (1:05–1:35)

| Time | Shot | Source | VO line |
|---|---|---|---|
| 1:05–1:13 | Charger unplug, rings slow, core dims, chatter fades, music drops to near-silence | Live capture with replay JSON | "Power critical, sir." |
| 1:13–1:18 | Low-power hold, amber warning, heartbeat pulse on core | Live capture with replay JSON | — |
| 1:18–1:23 | Charger reconnect, spark burst, screen shake, bloom overdrive, music swells | Live capture with replay JSON | (music only) |
| 1:23–1:35 | Rings at max speed, core at maximum bloom, chatter roars back | Live capture with replay JSON | "Systems restored. All systems nominal." |

#### Act 4 — macOS Integration + Shutdown Closer (1:35–2:00)

| Time | Shot | Source | VO line |
|---|---|---|---|
| 1:35–1:42 | Click `jarvis://Clock` link; Clock launches over HUD; then click `jarvis://Documents` | Live capture + cliclick | "Shall I launch your applications, sir?" |
| 1:42–1:50 | Cmd+Ctrl+Q screen lock; reactor freezes into desktop wallpaper via `setDesktopImageURL` | Live capture | — |
| 1:50–1:56 | Shutdown sequence — rings decelerate 5→4→3→2→1, core pulses, final white flash | Live capture (HUDPhaseController.shutdown) | "Until next time, sir." |
| 1:56–2:00 | Black screen, cyan logotype fade — "JARVIS · MADE ON APPLE SILICON" | AI (Runway / Ken-Burns fallback) | — |

### Music arc

- Ambient drone rise at 0:00
- Orchestral build at 0:08
- Steady build Act 2
- Dramatic drop at 1:05 (Act 3 power loss)
- Near-silence 1:13–1:18
- Swell at 1:18 (Act 3 charger reconnect)
- Peak intensity 1:23–1:35
- Slow outro fall Act 4

## Implementation Units

### Unit 1 — Spec and scaffolding

**Goal:** Create `scripts/promo-video/` directory structure, stub files, and `shot_list.yaml` with every scene, VO line, music cue, and transition enumerated. Write `README.md` with prerequisites and run instructions.

**Files:**
- Create: `scripts/promo-video/` (directory)
- Create: `scripts/promo-video/shot_list.yaml`
- Create: `scripts/promo-video/README.md`
- Create: `scripts/promo-video/run.sh` (stub, exits 0)
- Modify: `.gitignore` (add `promo/`, `scripts/promo-video/fonts/`)

**Success criteria:**
- `shot_list.yaml` parses as valid YAML, contains every VO line from the shot list, and the sum of durations is 120s ±0s.
- `run.sh` exists, is executable, and exits 0 with a "no phases implemented yet" message.
- `README.md` lists every prerequisite (ffmpeg, cliclick, Screen Recording permission, API keys) and the `run.sh --rough` / `run.sh --polish` usage.

**Est. time:** 30 min

### Unit 2 — Battery replay mode

**Goal:** Extend `BatteryMonitor.swift` with a `JARVIS_BATTERY_REPLAY` env var that swaps IOKit polling for a scripted JSON timeline. Author `replay_sequences/act3_battery_drama.json` with the full Act 3 drama as a ~30-second timeline. Because all downstream reactive behaviour (ring slowdown, core dim, chatter fade, spark burst) flows through `JarvisPersonality` reading `BatteryMonitor`, changing only `BatteryMonitor` is sufficient.

**Files:**
- Modify: `JarvisTelemetry/Sources/JarvisTelemetry/BatteryMonitor.swift` (~30 LOC — env var check + replay loop + JSON decoder)
- Create: `scripts/promo-video/replay_sequences/act3_battery_drama.json`

**Success criteria:**
- Launching the app with `JARVIS_BATTERY_REPLAY=…/act3_battery_drama.json` produces the full Act 3 visual sequence (battery drop, chatter fade, charger on, overdrive, stabilise) on a machine that is currently plugged in and fully charged.
- Without the env var, `BatteryMonitor` behaves exactly as before (IOKit polling at 2 Hz).
- The replay sequence includes ±1% random jitter on battery % so values don't look fake.

**Dependencies:** Unit 1

**Est. time:** 45 min

### Unit 3 — Scene capture

**Goal:** `capture_scenes.py` launches the Swift app (via `tests/build_and_launch.sh`), screen-records each of the four acts via `ffmpeg -f avfoundation`, and drives cliclick actions for Act 4 link clicks and screen-lock. Outputs `promo/raw_captures/act{1..4}.mp4`.

**Files:**
- Create: `scripts/promo-video/capture_scenes.py`

**Success criteria:**
- All four MP4s exist, each at 2560×1440 @ 30fps, H.264.
- Act 1 starts from a fresh app launch and captures the boot sequence from 0:00.
- Act 3 uses `JARVIS_TELEMETRY_REPLAY=…/act3_battery_drama.json` and produces the drama visually.
- Act 4 captures the link click, screen lock, and shutdown animation in sequence.
- Screen Recording permission is checked at startup; missing permission aborts with a clear System Settings path.

**Dependencies:** Unit 2

**Est. time:** 1.5 hours

### Unit 4 — Voice narration

**Goal:** `generate_vo.py` reads VO lines from `shot_list.yaml`, synthesises each via OpenAI `tts-1-hd` `fable` voice, and saves per-line WAVs to `promo/vo/`. Falls back to macOS `say -v Daniel -o file.aiff` → ffmpeg aiff→wav on failure.

**Files:**
- Create: `scripts/promo-video/generate_vo.py`

**Success criteria:**
- Every VO line from `shot_list.yaml` produces a corresponding `line{NN}.wav` at 48 kHz mono.
- Each WAV is 0.5s ≤ duration ≤ 5s.
- Provider used (OpenAI / macOS say) is logged.
- Rerunning with an unchanged `shot_list.yaml` is a no-op (idempotent).

**Dependencies:** Unit 1

**Est. time:** 30 min

### Unit 5 — AI shot generation

**Goal:** `generate_ai_shots.py` generates the intro and outro cinematic shots. Primary: Runway Gen-3 Alpha Turbo image-to-video. Fallback 1: Gemini Veo text-to-video. Fallback 2: ffmpeg `zoompan` Ken-Burns on a Gemini Imagen / OpenAI Images still. Outputs `promo/ai_shots/{intro,outro}.mp4` at 2560×1440 @ 30fps.

**Files:**
- Create: `scripts/promo-video/generate_ai_shots.py`

**Success criteria:**
- Both `intro.mp4` and `outro.mp4` exist at the correct resolution and framerate.
- Log clearly states which provider produced each shot.
- When `run.sh --rough` is used, script uses Ken-Burns fallback only (no paid API calls).
- When `run.sh --polish` is used, script attempts Runway first.

**Dependencies:** Unit 1

**Est. time:** 1 hour

### Unit 6 — Music selection

**Goal:** `pick_music.sh` downloads a curated royalty-free track from Pixabay (or equivalent CC0 source) to `promo/music/score.mp3` and writes `promo/music/LICENCE.txt` with the attribution. Supports three candidate tracks via CLI arg; default is the first candidate.

**Files:**
- Create: `scripts/promo-video/pick_music.sh`
- Bundle: `scripts/promo-video/music-fallback.mp3` (committed)

**Success criteria:**
- `promo/music/score.mp3` exists and is ≥ 120s.
- `promo/music/LICENCE.txt` contains track name, source URL, licence line.
- Network failure falls back to `music-fallback.mp3`.

**Dependencies:** Unit 1

**Est. time:** 20 min

### Unit 7 — Assembly + validation

**Goal:** `assemble.sh` runs the two-pass ffmpeg pipeline with seven validation gates. Pass 1 builds `promo/scenes/silent.mp4` (concat + crossfades + title cards + color grade). Pass 2 muxes audio (music + VO with sidechain ducking + loudnorm) and produces `promo/JARVIS_PROMO_v{N}.mp4`.

**Files:**
- Create: `scripts/promo-video/assemble.sh`

**Success criteria:**
- All seven gates pass (G1–G7 per the design).
- Final output matches all SCs: 2560×1440 @ 30fps H.264 + AAC yuv420p, 120s ±2s, [−16, −12] LUFS integrated loudness.
- Sanity frames extracted to `promo/qa_frames/` for manual review.
- Any gate failure aborts with a clear, actionable error message.

**Dependencies:** Units 3, 4, 5, 6

**Est. time:** 1.5 hours

### Unit 8 — Orchestration + rough cut run

**Goal:** Fill in `run.sh` to call each phase script sequentially. Supports `--rough` (offline fallbacks only) and `--polish` (paid providers enabled). First successful rough cut produces `promo/JARVIS_PROMO_rough.mp4`.

**Files:**
- Modify: `scripts/promo-video/run.sh` (replace stub with full orchestrator)

**Success criteria:**
- `run.sh --rough` completes end-to-end in ≤10 minutes wall-clock and produces a playable MP4 with zero API cost.
- `run.sh --polish` calls Runway + OpenAI TTS + downloads music, completes in ≤30 minutes wall-clock.
- Idempotent reruns: if outputs already exist, phases skip. Partial re-runs are supported (e.g., only regenerate VO after editing `shot_list.yaml`).
- All phase failures cause `run.sh` to exit non-zero with a clear error.

**Dependencies:** Units 2–7

**Est. time:** 30 min

### Unit 9 — Rough cut review + polish iteration

**Goal:** User watches the rough cut, identifies scenes that land vs. need rework, selects the final music track from 3 candidates, approves the polish pass. Polish pass uses Runway + OpenAI TTS + chosen music and produces `promo/JARVIS_PROMO_v1.mp4`.

**Success criteria:**
- User approves the final cut.
- Integrated loudness verified via `ffmpeg -af ebur128` to be [−16, −12] LUFS.
- `promo/JARVIS_PROMO_v1.mp4` + `promo/music/LICENCE.txt` ready for upload.

**Dependencies:** Unit 8

**Est. time:** Variable (1–3 iterations per the risk cap in R7)

## Validation Gates

| Gate | Check | Phase | Action on fail |
|---|---|---|---|
| G0 | Screen Recording permission granted to ffmpeg / Terminal | run.sh start | abort with System Settings path |
| G1 | Every `raw_captures/act{1..4}.mp4` exists and duration ≥ shot_list expected | pre-assemble | abort, log missing or short capture |
| G2 | Every `vo/line{01..10}.wav` exists, 0.5s ≤ duration ≤ 5s | pre-assemble | abort, log offending line |
| G3 | `music/score.mp3` exists and duration ≥ 120s | pre-assemble | abort, suggest fallback bundled track |
| G4 | Intermediate `silent.mp4` is 120s ±1s (matches `shot_list.yaml` sum) | post Pass 1 | abort, show timing drift per scene |
| G5 | Final output is 2560×1440 @ 30fps, H.264, yuv420p, AAC | post Pass 2 | abort, show ffprobe output |
| G6 | Integrated loudness ∈ [−16, −12] LUFS via `ebur128` | post Pass 2 | warn (non-fatal; YouTube renormalises) |
| G7 | Sanity frames extracted at 0s/15s/45s/75s/105s/115s to `qa_frames/` | post Pass 2 | always runs; manual review |

## Success Criteria

- **SC-1** Final cut is 120s ±2s across all four acts.
- **SC-2** Every VO line is audible, on-cue, and cleanly ducked under music.
- **SC-3** No visual artefacts: no screen-capture tearing, no dropped frames, no pixelation.
- **SC-4** Final output is 2560×1440 @ 30fps, H.264, AAC, yuv420p.
- **SC-5** Integrated loudness ∈ [−16, −12] LUFS (YouTube-safe).
- **SC-6** All four feature beats (boot, panels/chatter, battery drama, macOS + shutdown) are clearly showcased and recognisable in a single end-to-end watch.
- **SC-7** User approves aesthetic after the polish pass.

## Risks and Mitigations

| # | Risk | Mitigation |
|---|---|---|
| R1 | Screen Recording permission missing for ffmpeg / Terminal | `run.sh` gate G0 checks at startup; prints exact System Settings path to grant it |
| R2 | Runway API unavailable or credits exhausted | Fall back to Gemini Veo → Ken-Burns zoompan on a Gemini / OpenAI still image |
| R3 | Screen capture tears, drops frames, or looks low quality | High ffmpeg bitrate (~50 Mbps capture target); fall back to `CGWindowListCreateImage`-based capture via existing `tests/lib/visual_lib.py` pattern |
| R4 | `fable` voice sounds robotic or wrong | Fall back to macOS `say -v Daniel`; user can override any VO line with a custom WAV |
| R5 | Music track does not sit well against footage | Shortlist 3 candidates after rough cut; A/B blind pick against Act 1+2 |
| R6 | Replay telemetry feels artificial | ±3% random jitter on values; seed with captured real data rather than hand-authored numbers |
| R7 | Iteration scope creep | Cap at 3 polish iterations; after that, ship current state and open follow-up tasks |

## Estimated Timeline

| Phase | Work | Est. time |
|---|---|---|
| P1 | Scaffold `scripts/promo-video/` + `shot_list.yaml` (Unit 1) | 30 min |
| P2 | `BatteryMonitor` replay mode + Act 3 JSON (Unit 2) | 45 min |
| P3 | `capture_scenes.py` (Unit 3) | 1.5 hours |
| P4 | `generate_vo.py` (Unit 4) | 30 min |
| P5 | `generate_ai_shots.py` (Unit 5) | 1 hour |
| P6 | `pick_music.sh` (Unit 6) | 20 min |
| P7 | `assemble.sh` (Unit 7) | 1.5 hours |
| P8 | Orchestration + first rough cut run (Unit 8) | 40 min (30 + 10 wall) |
| P9 | User review + feedback (Unit 9) | variable |
| P10 | Polish pass (Unit 9) | 45 min |
| P11 | Final delivery | 15 min |

**Total implementation work:** ~6–7 hours of focused work. Rough cut watchable after P8 (~5 hours in). Polish watchable after P10.

## Out of Scope (Explicitly Deferred)

- 9:16 vertical and 1:1 square variants — pipeline supports them trivially via a final crop/pad filter; not required for YouTube.
- Burned-in subtitles / SRT captions — easy to add from the VO script; not requested.
- Multiple-language VO.
- YouTube thumbnail generation.
- Automated upload to YouTube / Vimeo.
- Any change to existing `VideoGenerationPipeline.swift`.
- Any change to `JarvisWallpaper/`.
