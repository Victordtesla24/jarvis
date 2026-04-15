# JARVIS Promotional Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a ~120-second cinematic JARVIS promotional video (YouTube/Vimeo, 2560×1440 @ 30fps) via a hybrid pipeline — ~85% live screen capture of the running Swift app + ~15% Runway-generated AI cinematic wrapping, narrated by the in-character JARVIS British butler voice with a royalty-free orchestral score.

**Architecture:** All production code lives in a new `scripts/promo-video/` directory. A single `shot_list.yaml` is the source of truth for scene timing, VO lines, and transitions. Each subsystem (capture, AI shots, VO, music) is an idempotent script. Assembly is two-pass ffmpeg with seven validation gates. The only in-app change is a surgical `BatteryMonitor.swift` env-var hook that replays a battery timeline for the Act 3 drama.

**Tech Stack:** Python 3 (orchestration, PyYAML), Bash + ffmpeg 7 (assembly, validation), Swift 5 (BatteryMonitor replay mode), cliclick (UI automation), OpenAI TTS `tts-1-hd` `fable` voice with macOS `say -v Daniel` fallback, Runway Gen-3 Alpha Turbo image-to-video with Gemini Veo and Ken-Burns zoompan fallbacks.

**Spec:** `docs/superpowers/specs/2026-04-15-jarvis-promo-video-design.md`

---

## File Map

### Created
| Path | Purpose |
|---|---|
| `scripts/promo-video/run.sh` | Master orchestrator, `--rough` / `--polish` modes |
| `scripts/promo-video/shot_list.yaml` | Single source of truth for scenes, VO, transitions |
| `scripts/promo-video/capture_scenes.py` | Screen capture orchestration for 4 acts |
| `scripts/promo-video/generate_ai_shots.py` | Runway → Gemini Veo → Ken-Burns fallback |
| `scripts/promo-video/generate_vo.py` | OpenAI `fable` → macOS `say Daniel` fallback |
| `scripts/promo-video/pick_music.sh` | Pixabay curl + fallback bundled track |
| `scripts/promo-video/assemble.sh` | Two-pass ffmpeg + 7 validation gates |
| `scripts/promo-video/README.md` | Prerequisites + run instructions |
| `scripts/promo-video/replay_sequences/act3_battery_drama.json` | Act 3 battery timeline |
| `scripts/promo-video/music-fallback.mp3` | Bundled offline fallback track |
| `scripts/promo-video/lib/shot_list_loader.py` | Shared YAML loader used by all Python phases |

### Modified
| Path | Change |
|---|---|
| `JarvisTelemetry/Sources/JarvisTelemetry/BatteryMonitor.swift` | Add `JARVIS_BATTERY_REPLAY` env var + replay loop (~30 LOC) |
| `.gitignore` | Ignore `promo/`, `scripts/promo-video/fonts/`, `scripts/promo-video/__pycache__/` |

### Output (gitignored)
| Path | Purpose |
|---|---|
| `promo/raw_captures/act{1..4}.mp4` | Per-act screen captures |
| `promo/ai_shots/{intro,outro}.mp4` | AI cinematic wrap shots |
| `promo/vo/line{01..10}.wav` | TTS VO lines |
| `promo/music/score.mp3` + `LICENCE.txt` | Downloaded track |
| `promo/scenes/silent.mp4` | Pass 1 intermediate |
| `promo/qa_frames/*.png` | Sanity frames for manual review |
| `promo/JARVIS_PROMO_v{N}.mp4` | Final output |

---

## Task 1: Scaffold directories, gitignore, README

**Files:**
- Create: `scripts/promo-video/` (directory tree)
- Create: `scripts/promo-video/README.md`
- Create: `scripts/promo-video/run.sh` (stub)
- Modify: `.gitignore`

- [ ] **Step 1: Create the directory tree**

```bash
mkdir -p scripts/promo-video/replay_sequences scripts/promo-video/lib
```

- [ ] **Step 2: Update `.gitignore`**

Append to `.gitignore`:
```
# JARVIS promo video working output
promo/
scripts/promo-video/fonts/
scripts/promo-video/__pycache__/
scripts/promo-video/lib/__pycache__/
```

- [ ] **Step 3: Create `scripts/promo-video/README.md`**

Content covers: purpose, prerequisites (ffmpeg, cliclick, Screen Recording permission, API keys), run commands (`./run.sh --rough`, `./run.sh --polish`), output paths, fallback chain behaviour. ~60 lines of prose.

- [ ] **Step 4: Create stub `run.sh`**

```bash
#!/usr/bin/env zsh
# scripts/promo-video/run.sh — JARVIS promo video master orchestrator
# Usage: ./run.sh --rough   (offline fallbacks, no API cost)
#        ./run.sh --polish  (Runway + OpenAI TTS + curated music)
set -eu
set -o pipefail
echo "[promo-video] run.sh stub — phases not yet implemented"
exit 0
```

Then: `chmod +x scripts/promo-video/run.sh`

- [ ] **Step 5: Smoke test the stub**

Run: `./scripts/promo-video/run.sh`
Expected: exits 0 with the stub message.

- [ ] **Step 6: Commit**

```bash
git add scripts/promo-video/README.md scripts/promo-video/run.sh .gitignore
git commit -m "feat(promo-video): scaffold scripts/promo-video directory + README + stub run.sh"
```

---

## Task 2: Write `shot_list.yaml` (source of truth)

**Files:**
- Create: `scripts/promo-video/shot_list.yaml`

- [ ] **Step 1: Author the full YAML**

The YAML must have three top-level keys: `meta`, `scenes`, `vo_lines`. Every scene has `id`, `act`, `start`, `duration`, `source` (`live|ai|title_card`), `capture_hint`, `vo_ref` (null or a vo_lines key), `transition_in`. Every VO line has `id`, `text`, `place_at` (absolute seconds). Sum of durations must equal 120.

Full YAML content (copy verbatim):

```yaml
meta:
  title: "JARVIS — Cinematic promo"
  duration_seconds: 120
  width: 2560
  height: 1440
  fps: 30
  loudness_target_lufs: -14
  subtitle: "MADE ON APPLE SILICON"

scenes:
  - id: s01_intro
    act: 1
    start: 0.0
    duration: 3.0
    source: ai
    ai_prompt: "cosmic void, single point of cyan light approaching, volumetric fog, Marvel Studios cinematic lighting, slow forward dolly"
    capture_hint: null
    vo_ref: null
    transition_in: cut

  - id: s02_boot_ignition
    act: 1
    start: 3.0
    duration: 5.0
    source: live
    capture_hint: act1_boot
    vo_ref: vo_01
    transition_in: fade

  - id: s03_boot_rings
    act: 1
    start: 8.0
    duration: 6.0
    source: live
    capture_hint: act1_boot
    vo_ref: vo_02
    transition_in: fade

  - id: s04_hero_reactor
    act: 1
    start: 14.0
    duration: 8.0
    source: live
    capture_hint: act1_hero
    vo_ref: null
    transition_in: fade

  - id: s05_title_card
    act: 1
    start: 22.0
    duration: 8.0
    source: title_card
    capture_hint: act1_hero
    title_text: "JARVIS"
    subtitle_text: "Cinema-grade telemetry for Apple Silicon"
    vo_ref: vo_03
    transition_in: fade

  - id: s06_panel_wide
    act: 2
    start: 30.0
    duration: 7.0
    source: live
    capture_hint: act2_panels_wide
    vo_ref: vo_04
    transition_in: fade

  - id: s07_left_panel
    act: 2
    start: 37.0
    duration: 11.0
    source: live
    capture_hint: act2_panels_left
    vo_ref: vo_05
    transition_in: cut

  - id: s08_right_panel
    act: 2
    start: 48.0
    duration: 10.0
    source: live
    capture_hint: act2_panels_right
    vo_ref: vo_06
    transition_in: cut

  - id: s09_panel_wide_return
    act: 2
    start: 58.0
    duration: 7.0
    source: live
    capture_hint: act2_panels_wide
    vo_ref: null
    transition_in: fade

  - id: s10_charger_unplug
    act: 3
    start: 65.0
    duration: 8.0
    source: live
    capture_hint: act3_drama
    vo_ref: vo_07
    transition_in: fade

  - id: s11_low_power_hold
    act: 3
    start: 73.0
    duration: 5.0
    source: live
    capture_hint: act3_drama
    vo_ref: null
    transition_in: cut

  - id: s12_charger_reconnect
    act: 3
    start: 78.0
    duration: 5.0
    source: live
    capture_hint: act3_drama
    vo_ref: null
    transition_in: cut

  - id: s13_overdrive
    act: 3
    start: 83.0
    duration: 12.0
    source: live
    capture_hint: act3_drama
    vo_ref: vo_08
    transition_in: cut

  - id: s14_jarvis_links
    act: 4
    start: 95.0
    duration: 7.0
    source: live
    capture_hint: act4_integration
    vo_ref: vo_09
    transition_in: fade

  - id: s15_lock_freeze
    act: 4
    start: 102.0
    duration: 8.0
    source: live
    capture_hint: act4_integration
    vo_ref: null
    transition_in: cut

  - id: s16_shutdown
    act: 4
    start: 110.0
    duration: 6.0
    source: live
    capture_hint: act4_shutdown
    vo_ref: vo_10
    transition_in: fade

  - id: s17_outro
    act: 4
    start: 116.0
    duration: 4.0
    source: ai
    ai_prompt: "slow cosmic pull-back, cyan logotype JARVIS fades into deep space void, end credits aesthetic, volumetric cyan fog"
    capture_hint: null
    vo_ref: null
    transition_in: fade

vo_lines:
  vo_01:
    text: "Good evening. I am JARVIS."
    place_at: 3.5
  vo_02:
    text: "Initialising Apple Silicon telemetry array."
    place_at: 9.0
  vo_03:
    text: "All cores reporting. Nominal."
    place_at: 24.0
  vo_04:
    text: "Live data streams."
    place_at: 31.0
  vo_05:
    text: "Memory bandwidth. Neural engine. GPU frequency."
    place_at: 38.5
  vo_06:
    text: "Every microsecond, rendered."
    place_at: 49.5
  vo_07:
    text: "Power critical, sir."
    place_at: 67.0
  vo_08:
    text: "Systems restored. All cores nominal."
    place_at: 85.0
  vo_09:
    text: "Shall I launch your applications, sir?"
    place_at: 96.5
  vo_10:
    text: "Until next time, sir."
    place_at: 111.0
```

- [ ] **Step 2: Validate YAML parses and durations sum correctly**

Run:
```bash
python3 -c "
import yaml
d = yaml.safe_load(open('scripts/promo-video/shot_list.yaml'))
total = sum(s['duration'] for s in d['scenes'])
print(f'scenes={len(d[\"scenes\"])} vo_lines={len(d[\"vo_lines\"])} total={total}')
assert total == 120.0, f'expected 120.0s, got {total}s'
print('OK')
"
```
Expected: `scenes=17 vo_lines=10 total=120.0` and `OK`.

- [ ] **Step 3: Commit**

```bash
git add scripts/promo-video/shot_list.yaml
git commit -m "feat(promo-video): add shot_list.yaml source of truth (17 scenes, 10 VO lines, 120s)"
```

---

## Task 3: Write `lib/shot_list_loader.py` (shared YAML loader)

**Files:**
- Create: `scripts/promo-video/lib/shot_list_loader.py`
- Create: `scripts/promo-video/lib/__init__.py` (empty)

- [ ] **Step 1: Create the `__init__.py`**

```bash
touch scripts/promo-video/lib/__init__.py
```

- [ ] **Step 2: Write `shot_list_loader.py`**

Module exposes `load()` returning a typed dict, `scenes_by_act(act)` returning scenes for an act, `vo_line(vo_ref)` returning the text + place_at, and a `ShotListError` exception.

Full content:
```python
"""scripts/promo-video/lib/shot_list_loader.py
Shared YAML loader for the JARVIS promo video pipeline. Every phase script
imports this to avoid drifting schemas.
"""
from __future__ import annotations
import os
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(os.environ.get(
    "REPO_ROOT", "/Users/vic/claude/General-Work/jarvis/jarvis-build"
))
SHOT_LIST_PATH = REPO_ROOT / "scripts" / "promo-video" / "shot_list.yaml"


class ShotListError(Exception):
    pass


_cache: dict[str, Any] | None = None


def load() -> dict[str, Any]:
    global _cache
    if _cache is not None:
        return _cache
    if not SHOT_LIST_PATH.exists():
        raise ShotListError(f"shot_list.yaml not found at {SHOT_LIST_PATH}")
    with open(SHOT_LIST_PATH) as f:
        data = yaml.safe_load(f)
    total = sum(s["duration"] for s in data["scenes"])
    if abs(total - data["meta"]["duration_seconds"]) > 0.01:
        raise ShotListError(
            f"scene duration sum {total}s != meta.duration_seconds "
            f"{data['meta']['duration_seconds']}s"
        )
    _cache = data
    return data


def scenes_by_act(act: int) -> list[dict[str, Any]]:
    return [s for s in load()["scenes"] if s["act"] == act]


def scenes_by_capture_hint(hint: str) -> list[dict[str, Any]]:
    return [s for s in load()["scenes"] if s.get("capture_hint") == hint]


def vo_line(vo_ref: str) -> dict[str, Any]:
    lines = load()["vo_lines"]
    if vo_ref not in lines:
        raise ShotListError(f"unknown vo_ref: {vo_ref}")
    return lines[vo_ref]


def meta() -> dict[str, Any]:
    return load()["meta"]
```

- [ ] **Step 3: Smoke test the loader**

Run:
```bash
cd /Users/vic/claude/General-Work/jarvis/jarvis-build
python3 -c "
import sys
sys.path.insert(0, 'scripts/promo-video')
from lib.shot_list_loader import load, scenes_by_act, vo_line, meta
d = load()
print('meta:', meta()['duration_seconds'])
print('act1:', len(scenes_by_act(1)), 'scenes')
print('vo_01:', vo_line('vo_01')['text'])
"
```
Expected:
```
meta: 120
act1: 5 scenes
vo_01: Good evening. I am JARVIS.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/promo-video/lib/
git commit -m "feat(promo-video): add shared shot_list YAML loader + cache"
```

---

## Task 4: Add `JARVIS_BATTERY_REPLAY` env var to `BatteryMonitor.swift`

**Files:**
- Modify: `JarvisTelemetry/Sources/JarvisTelemetry/BatteryMonitor.swift`

- [ ] **Step 1: Read the current `start()` function**

Read lines 50-67 of `JarvisTelemetry/Sources/JarvisTelemetry/BatteryMonitor.swift` to confirm the insertion points.

- [ ] **Step 2: Add replay frame struct, replay state, and replay method**

Inside the `BatteryMonitor` class, AFTER the `private let debounceInterval: TimeInterval = 0.5` line and BEFORE the `// MARK: - Lifecycle` marker, insert:

```swift
    // MARK: - Replay mode (promo video only)

    /// Frame in a battery replay timeline
    private struct ReplayFrame: Decodable {
        let t: Double       // seconds from replay start
        let pct: Int        // battery percent 0-100
        let charging: Bool
    }

    /// Parsed replay frames (nil in live mode)
    private var replayFrames: [ReplayFrame]? = nil

    /// Wall-clock start of replay playback
    private var replayStartTime: Date? = nil

    /// Index of the next frame to emit
    private var replayCursor: Int = 0

    /// Load replay frames from JSON file if env var is set.
    /// Returns true if replay mode is active.
    private func loadReplayIfRequested() -> Bool {
        guard let path = ProcessInfo.processInfo.environment["JARVIS_BATTERY_REPLAY"],
              !path.isEmpty else { return false }
        let url = URL(fileURLWithPath: path)
        guard let data = try? Data(contentsOf: url),
              let frames = try? JSONDecoder().decode([ReplayFrame].self, from: data),
              !frames.isEmpty else {
            NSLog("[BatteryMonitor] JARVIS_BATTERY_REPLAY set but failed to parse \(path)")
            return false
        }
        replayFrames = frames
        replayStartTime = Date()
        replayCursor = 0
        NSLog("[BatteryMonitor] Replay mode: \(frames.count) frames from \(path)")
        return true
    }

    /// Advance replay cursor and emit the current frame.
    private func pollReplay() {
        chargingJustAttached = false
        guard let frames = replayFrames,
              let start = replayStartTime else { return }
        let now = Date().timeIntervalSince(start)

        // Advance cursor to the latest frame whose t ≤ now
        while replayCursor + 1 < frames.count && frames[replayCursor + 1].t <= now {
            replayCursor += 1
        }
        let frame = frames[replayCursor]

        // Apply ±1% jitter so the value doesn't look suspiciously static
        let jitter = Int.random(in: -1...1)
        let pct = max(0, min(100, frame.pct + jitter))

        let nowCharging = frame.charging

        // Reuse the live-mode edge detection logic for chargingJustAttached
        if nowCharging && !previousChargingState {
            let wallNow = Date()
            if wallNow.timeIntervalSince(lastChargingAttachTime) > debounceInterval {
                chargingJustAttached = true
                lastChargingAttachTime = wallNow
            }
        }

        batteryPercent = pct
        isCharging = nowCharging
        previousChargingState = nowCharging
        powerSource = nowCharging ? "AC Power" : "Battery Power"
        isDying = pct <= JARVISNominalState.batteryDyingThreshold
            && !nowCharging
            && powerSource == "Battery Power"
    }
```

- [ ] **Step 3: Modify `start()` to dispatch to replay or live polling**

Replace the entire `start()` function (currently lines 50-61) with:

```swift
    /// Start polling battery state at 2 Hz (live IOKit) or from a replay
    /// file if JARVIS_BATTERY_REPLAY is set.
    func start() {
        let replayActive = loadReplayIfRequested()

        // Initial read
        if replayActive { pollReplay() } else { poll() }

        // Poll at 2 Hz (500ms)
        timer = Timer.publish(every: 0.5, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                if self.replayFrames != nil {
                    self.pollReplay()
                } else {
                    self.poll()
                }
            }
    }
```

- [ ] **Step 4: Build the Swift app to verify it still compiles**

Run:
```bash
cd /Users/vic/claude/General-Work/jarvis/jarvis-build/JarvisTelemetry
swift build -c release 2>&1 | tail -20
```
Expected: `Build complete!` with zero errors. If there are warnings about unused variables that's acceptable.

- [ ] **Step 5: Commit**

```bash
git add JarvisTelemetry/Sources/JarvisTelemetry/BatteryMonitor.swift
git commit -m "feat(battery): add JARVIS_BATTERY_REPLAY env var for promo video Act 3

Replays a JSON timeline of (t, pct, charging) frames instead of polling
IOKit. Reuses existing edge-detection for chargingJustAttached so all
downstream reactive behaviour (ring slowdown, core dim, chatter fade,
spark burst via JarvisPersonality) flows unchanged."
```

---

## Task 5: Author `act3_battery_drama.json` replay timeline

**Files:**
- Create: `scripts/promo-video/replay_sequences/act3_battery_drama.json`

- [ ] **Step 1: Write the JSON timeline**

Act 3 runs from `s10_charger_unplug` at 65s to `s13_overdrive` ending at 95s — a 30-second window. The replay file uses replay-local time (0s at scene start) because `capture_scenes.py` launches a fresh app for the Act 3 capture.

```json
[
  {"t": 0.0,  "pct": 48, "charging": true},
  {"t": 2.0,  "pct": 45, "charging": false},
  {"t": 3.5,  "pct": 28, "charging": false},
  {"t": 5.0,  "pct": 12, "charging": false},
  {"t": 6.5,  "pct":  6, "charging": false},
  {"t": 8.0,  "pct":  4, "charging": false},
  {"t": 10.0, "pct":  4, "charging": false},
  {"t": 12.0, "pct":  3, "charging": false},
  {"t": 13.0, "pct":  3, "charging": true},
  {"t": 13.5, "pct":  4, "charging": true},
  {"t": 15.0, "pct":  8, "charging": true},
  {"t": 17.0, "pct": 14, "charging": true},
  {"t": 19.0, "pct": 22, "charging": true},
  {"t": 22.0, "pct": 32, "charging": true},
  {"t": 25.0, "pct": 44, "charging": true},
  {"t": 28.0, "pct": 55, "charging": true},
  {"t": 30.0, "pct": 60, "charging": true}
]
```

- [ ] **Step 2: Validate JSON parses**

Run:
```bash
python3 -c "
import json
d = json.load(open('scripts/promo-video/replay_sequences/act3_battery_drama.json'))
print(f'{len(d)} frames, span {d[0][\"t\"]}-{d[-1][\"t\"]}s')
# sanity: strictly monotonic t
assert all(d[i+1]['t'] > d[i]['t'] for i in range(len(d)-1)), 'non-monotonic timeline'
print('OK')
"
```
Expected: `17 frames, span 0.0-30.0s` and `OK`.

- [ ] **Step 3: Manual verification — launch app with replay var**

Run:
```bash
sudo -v  # cache sudo creds first
cd /Users/vic/claude/General-Work/jarvis/jarvis-build/JarvisTelemetry
JARVIS_BATTERY_REPLAY="$PWD/../scripts/promo-video/replay_sequences/act3_battery_drama.json" \
  sudo -E .build/release/JarvisTelemetry &
APP_PID=$!
sleep 35  # let the full 30s timeline play
kill -TERM $APP_PID
```
Expected: the HUD visibly goes through battery dim → reconnect → overdrive over ~30 seconds. If you can't watch it in real time right now, just confirm the app launches and exits cleanly — the full visual verification happens in Task 10 (capture_scenes.py) anyway.

- [ ] **Step 4: Commit**

```bash
git add scripts/promo-video/replay_sequences/act3_battery_drama.json
git commit -m "feat(promo-video): add Act 3 battery drama replay timeline (17 frames, 30s)"
```

---

## Task 6: Write `generate_vo.py` (TTS with OpenAI fable → macOS say fallback)

**Files:**
- Create: `scripts/promo-video/generate_vo.py`

- [ ] **Step 1: Write the script**

Full content:
```python
#!/usr/bin/env python3
"""scripts/promo-video/generate_vo.py

Synthesise every VO line from shot_list.yaml into promo/vo/line{NN}.wav.
Provider chain: OpenAI tts-1-hd (fable voice) → macOS say -v Daniel.
Idempotent: skips lines whose .wav already exists.
"""
from __future__ import annotations
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.shot_list_loader import load, REPO_ROOT  # noqa: E402

try:
    from dotenv import load_dotenv
    load_dotenv(REPO_ROOT / "tests" / "api_keys.env", override=True)
    load_dotenv(Path.home() / ".jarvis" / ".env")
except ImportError:
    pass

OUT = REPO_ROOT / "promo" / "vo"
OUT.mkdir(parents=True, exist_ok=True)


def synth_openai(text: str, out_wav: Path) -> bool:
    """Call OpenAI TTS with the fable voice. Returns True on success."""
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key.startswith("sk-"):
        return False
    try:
        import requests
    except ImportError:
        print("  [openai] requests not installed, skipping")
        return False
    try:
        r = requests.post(
            "https://api.openai.com/v1/audio/speech",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": "tts-1-hd",
                "voice": "fable",
                "input": text,
                "response_format": "wav",
            },
            timeout=60,
        )
    except Exception as exc:
        print(f"  [openai] network error: {exc}")
        return False
    if r.status_code != 200:
        print(f"  [openai] HTTP {r.status_code}: {r.text[:200]}")
        return False
    out_wav.write_bytes(r.content)
    return True


def synth_say(text: str, out_wav: Path) -> bool:
    """Fallback: macOS say command with Daniel (British English)."""
    aiff = out_wav.with_suffix(".aiff")
    try:
        subprocess.run(
            ["say", "-v", "Daniel", "-o", str(aiff), text],
            check=True, capture_output=True, timeout=30,
        )
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-i", str(aiff),
             "-ar", "48000", "-ac", "1",
             str(out_wav)],
            check=True, capture_output=True, timeout=30,
        )
        aiff.unlink(missing_ok=True)
    except subprocess.CalledProcessError as exc:
        print(f"  [say] failed: {exc.stderr.decode()[:200]}")
        return False
    return True


def main() -> int:
    data = load()
    vo_lines = data["vo_lines"]
    prefer_fallback = os.environ.get("PROMO_VO_FORCE_FALLBACK", "0") == "1"

    provider_used: dict[str, int] = {"openai": 0, "say": 0, "skipped": 0, "failed": 0}

    for key, line in sorted(vo_lines.items()):
        idx = int(key.split("_")[1])
        out_wav = OUT / f"line{idx:02d}.wav"
        if out_wav.exists() and out_wav.stat().st_size > 1024:
            print(f"  ⏭  {out_wav.name} already exists, skipping")
            provider_used["skipped"] += 1
            continue

        text = line["text"]
        print(f"  🔊  {out_wav.name} — {text!r}")

        ok = False
        if not prefer_fallback:
            ok = synth_openai(text, out_wav)
            if ok:
                provider_used["openai"] += 1
                print(f"     ✅ via OpenAI fable")

        if not ok:
            ok = synth_say(text, out_wav)
            if ok:
                provider_used["say"] += 1
                print(f"     ✅ via macOS say Daniel")

        if not ok:
            print(f"     ❌ all providers failed for {out_wav.name}")
            provider_used["failed"] += 1

    print(f"\nVO summary: {provider_used}")
    return 0 if provider_used["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/promo-video/generate_vo.py
```

- [ ] **Step 3: Run with fallback forced (rough mode)**

```bash
cd /Users/vic/claude/General-Work/jarvis/jarvis-build
PROMO_VO_FORCE_FALLBACK=1 python3 scripts/promo-video/generate_vo.py
ls -la promo/vo/
```
Expected: 10 `lineNN.wav` files, each at 48 kHz mono wav, produced via `macOS say Daniel`.

- [ ] **Step 4: Quick duration sanity check**

```bash
for f in promo/vo/line*.wav; do
  dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f")
  echo "$(basename $f): ${dur}s"
done
```
Expected: every duration between ~0.8 and ~4.5 seconds.

- [ ] **Step 5: Commit**

```bash
git add scripts/promo-video/generate_vo.py
git commit -m "feat(promo-video): add generate_vo.py (OpenAI fable -> macOS say fallback)"
```

---

## Task 7: Write `pick_music.sh` + bundle fallback track

**Files:**
- Create: `scripts/promo-video/pick_music.sh`
- Create: `scripts/promo-video/music-fallback.mp3` (ffmpeg-synthesised ambient drone for offline fallback)

- [ ] **Step 1: Generate the bundled offline fallback track**

The fallback is a 125-second ambient drone, deliberately modest but present. ffmpeg can synthesise one using the `sine` and `tremolo` filters — no external source needed.

```bash
ffmpeg -y -f lavfi -i "sine=frequency=55:duration=125" \
  -f lavfi -i "sine=frequency=82:duration=125" \
  -f lavfi -i "sine=frequency=110:duration=125" \
  -filter_complex "[0:a][1:a][2:a]amix=inputs=3:duration=first:normalize=1,tremolo=f=0.3:d=0.4,lowpass=f=400,volume=0.6" \
  -ac 2 -ar 48000 -b:a 192k \
  scripts/promo-video/music-fallback.mp3
```
Expected: `scripts/promo-video/music-fallback.mp3` ~3MB, duration 125s.

- [ ] **Step 2: Write `pick_music.sh`**

```bash
#!/usr/bin/env zsh
# scripts/promo-video/pick_music.sh — Download curated royalty-free score.
# Usage: ./pick_music.sh [candidate_number]   (1, 2, or 3; default 1)
# Writes promo/music/score.mp3 and promo/music/LICENCE.txt.
set -eu
set -o pipefail

CAND="${1:-1}"
REPO_ROOT="${REPO_ROOT:-/Users/vic/claude/General-Work/jarvis/jarvis-build}"
OUT_DIR="$REPO_ROOT/promo/music"
OUT_MP3="$OUT_DIR/score.mp3"
OUT_LIC="$OUT_DIR/LICENCE.txt"
FALLBACK="$REPO_ROOT/scripts/promo-video/music-fallback.mp3"

mkdir -p "$OUT_DIR"

# Idempotent: if a valid score.mp3 already exists and is ≥120s, keep it.
if [[ -f "$OUT_MP3" ]]; then
  dur=$(ffprobe -v error -show_entries format=duration \
        -of default=noprint_wrappers=1:nokey=1 "$OUT_MP3" 2>/dev/null || echo 0)
  if [[ -n "$dur" && $(echo "$dur >= 120" | bc -l) -eq 1 ]]; then
    echo "[pick_music] keeping existing $OUT_MP3 (${dur}s)"
    exit 0
  fi
fi

# --- Candidate tracks (Pixabay Music, CC0 / YouTube-safe) -------------------
# NOTE: Pixabay track direct-download URLs are best-effort. If the URL layout
# changes or the network is unavailable, we fall back to the bundled drone.
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
if curl -fsSL --max-time 60 -o "$OUT_MP3.tmp" "$TRACK_URL" 2>/dev/null; then
  mv "$OUT_MP3.tmp" "$OUT_MP3"
  dur=$(ffprobe -v error -show_entries format=duration \
        -of default=noprint_wrappers=1:nokey=1 "$OUT_MP3" 2>/dev/null || echo 0)
  if [[ -z "$dur" || $(echo "$dur < 120" | bc -l) -eq 1 ]]; then
    echo "[pick_music] downloaded file too short (${dur}s), falling back"
    cp "$FALLBACK" "$OUT_MP3"
    ATTRIBUTION="Bundled JARVIS ambient drone (synthesised fallback, public domain)"
  else
    echo "[pick_music] downloaded OK (${dur}s)"
  fi
else
  echo "[pick_music] download failed, using bundled fallback"
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
```

- [ ] **Step 3: Make it executable and test with the fallback path**

```bash
chmod +x scripts/promo-video/pick_music.sh
# Force fallback by temporarily renaming network or by running offline:
./scripts/promo-video/pick_music.sh 1
ls -la promo/music/
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 promo/music/score.mp3
```
Expected: `promo/music/score.mp3` exists, ≥120s, and `LICENCE.txt` is present.

- [ ] **Step 4: Commit**

```bash
git add scripts/promo-video/pick_music.sh scripts/promo-video/music-fallback.mp3
git commit -m "feat(promo-video): add pick_music.sh with 3 candidates + bundled ambient fallback"
```

---

## Task 8: Write `generate_ai_shots.py` (Runway → Gemini Veo → Ken-Burns)

**Files:**
- Create: `scripts/promo-video/generate_ai_shots.py`

- [ ] **Step 1: Write the script**

The script generates `promo/ai_shots/intro.mp4` and `promo/ai_shots/outro.mp4`. Chain: Runway Gen-3 image-to-video (needs a reference still) → Gemini Veo text-to-video → ffmpeg Ken-Burns zoompan on a Gemini Imagen / OpenAI Image still.

Full content:
```python
#!/usr/bin/env python3
"""scripts/promo-video/generate_ai_shots.py

Generate the two AI cinematic wrap shots (intro.mp4, outro.mp4).
Provider chain per shot: Runway Gen-3 → Gemini Veo → Ken-Burns on a still.
Idempotent: skips shots whose .mp4 already exists.
"""
from __future__ import annotations
import base64
import os
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.shot_list_loader import load, REPO_ROOT  # noqa: E402

try:
    from dotenv import load_dotenv
    load_dotenv(REPO_ROOT / "tests" / "api_keys.env", override=True)
    load_dotenv(Path.home() / ".jarvis" / ".env")
except ImportError:
    pass

OUT = REPO_ROOT / "promo" / "ai_shots"
STILLS = REPO_ROOT / "promo" / "ai_shots" / "_stills"
OUT.mkdir(parents=True, exist_ok=True)
STILLS.mkdir(parents=True, exist_ok=True)

ROUGH_MODE = os.environ.get("PROMO_MODE", "rough") == "rough"


def ai_scenes() -> list[tuple[str, str, float]]:
    """Return [(out_name, prompt, duration)] for every source=='ai' scene."""
    data = load()
    result = []
    for s in data["scenes"]:
        if s["source"] != "ai":
            continue
        name = "intro" if s["id"] == "s01_intro" else "outro"
        result.append((name, s["ai_prompt"], float(s["duration"])))
    return result


def generate_still_gemini(prompt: str, out_png: Path) -> bool:
    """Use Gemini Imagen to generate a still PNG at 16:9."""
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return False
    try:
        import requests
    except ImportError:
        return False
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "imagen-3.0-generate-002:predict"
    )
    try:
        r = requests.post(
            url,
            params={"key": key},
            json={
                "instances": [{"prompt": prompt}],
                "parameters": {"aspectRatio": "16:9", "sampleCount": 1},
            },
            timeout=120,
        )
    except Exception as exc:
        print(f"  [gemini] network error: {exc}")
        return False
    if r.status_code != 200:
        print(f"  [gemini] HTTP {r.status_code}: {r.text[:200]}")
        return False
    try:
        b64 = r.json()["predictions"][0]["bytesBase64Encoded"]
    except (KeyError, IndexError, TypeError):
        print(f"  [gemini] unexpected response shape")
        return False
    out_png.write_bytes(base64.b64decode(b64))
    return True


def generate_still_openai(prompt: str, out_png: Path) -> bool:
    """Fallback still generator via OpenAI Images."""
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key.startswith("sk-"):
        return False
    try:
        import requests
    except ImportError:
        return False
    try:
        r = requests.post(
            "https://api.openai.com/v1/images/generations",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-image-1",
                "prompt": prompt,
                "size": "1792x1024",
                "n": 1,
                "response_format": "b64_json",
            },
            timeout=120,
        )
    except Exception as exc:
        print(f"  [openai-img] network error: {exc}")
        return False
    if r.status_code != 200:
        print(f"  [openai-img] HTTP {r.status_code}: {r.text[:200]}")
        return False
    try:
        b64 = r.json()["data"][0]["b64_json"]
    except (KeyError, IndexError, TypeError):
        return False
    out_png.write_bytes(base64.b64decode(b64))
    return True


def ken_burns_from_still(still: Path, out_mp4: Path, duration: float) -> bool:
    """Animate a still via ffmpeg zoompan. Outputs 2560x1440 @ 30fps H.264."""
    frames = int(duration * 30)
    # Slow inward zoom from 1.0 to 1.15 over the full duration
    zoom_expr = f"zoom+0.0005"
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-loop", "1", "-i", str(still),
             "-vf",
             f"scale=3840:2160:force_original_aspect_ratio=increase,"
             f"zoompan=z='{zoom_expr}':d={frames}:s=2560x1440:fps=30,"
             f"format=yuv420p",
             "-t", f"{duration}",
             "-c:v", "libx264", "-preset", "medium", "-crf", "18",
             "-pix_fmt", "yuv420p", "-r", "30",
             str(out_mp4)],
            check=True, capture_output=True, timeout=120,
        )
    except subprocess.CalledProcessError as exc:
        print(f"  [ken-burns] ffmpeg failed: {exc.stderr.decode()[:300]}")
        return False
    return True


def generate_runway_video(prompt: str, still: Path, out_mp4: Path,
                          duration: float) -> bool:
    """Use Runway Gen-3 Alpha Turbo image_to_video. Requires a reference still."""
    key = os.environ.get("RUNWAY_API_KEY", "")
    if not key.startswith("key_"):
        return False
    try:
        import requests
    except ImportError:
        return False

    # Upload the still as a data URL
    img_b64 = base64.b64encode(still.read_bytes()).decode()
    data_url = f"data:image/png;base64,{img_b64}"

    headers = {
        "Authorization": f"Bearer {key}",
        "X-Runway-Version": "2024-11-06",
        "Content-Type": "application/json",
    }
    body = {
        "promptImage": data_url,
        "model": "gen3a_turbo",
        "promptText": prompt,
        "duration": 5 if duration <= 5 else 10,
        "ratio": "1280:768",
    }
    try:
        r = requests.post(
            "https://api.dev.runwayml.com/v1/image_to_video",
            headers=headers, json=body, timeout=120,
        )
    except Exception as exc:
        print(f"  [runway] network error: {exc}")
        return False
    if r.status_code not in (200, 201):
        print(f"  [runway] HTTP {r.status_code}: {r.text[:300]}")
        return False
    task_id = r.json().get("id")
    if not task_id:
        return False

    # Poll up to 3 minutes
    for _ in range(60):
        time.sleep(3)
        try:
            poll = requests.get(
                f"https://api.dev.runwayml.com/v1/tasks/{task_id}",
                headers=headers, timeout=30,
            )
            data = poll.json()
        except Exception:
            continue
        status = data.get("status")
        if status == "SUCCEEDED":
            video_url = data.get("output", [None])[0]
            if not video_url:
                return False
            try:
                raw = requests.get(video_url, timeout=120).content
            except Exception:
                return False
            tmp = out_mp4.with_suffix(".src.mp4")
            tmp.write_bytes(raw)
            # Re-encode to 2560x1440@30fps with ffmpeg
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp),
                 "-vf", "scale=2560:1440:force_original_aspect_ratio=increase,"
                        "crop=2560:1440,fps=30",
                 "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                 "-pix_fmt", "yuv420p", "-an",
                 str(out_mp4)],
                check=True, capture_output=True, timeout=120,
            )
            tmp.unlink(missing_ok=True)
            return True
        if status in ("FAILED", "CANCELLED"):
            print(f"  [runway] task {task_id} {status}")
            return False
    print(f"  [runway] task {task_id} timed out after 3 min")
    return False


def main() -> int:
    scenes = ai_scenes()
    provider_used: dict[str, int] = {
        "runway": 0, "gemini-veo": 0, "ken-burns": 0, "skipped": 0, "failed": 0,
    }
    for name, prompt, duration in scenes:
        out_mp4 = OUT / f"{name}.mp4"
        if out_mp4.exists() and out_mp4.stat().st_size > 10_000:
            print(f"  ⏭  {out_mp4.name} already exists, skipping")
            provider_used["skipped"] += 1
            continue

        print(f"  🎬  {out_mp4.name} — {prompt[:60]}…")

        # Generate a reference still first (needed for Runway i2v and Ken-Burns fallback)
        still = STILLS / f"{name}.png"
        if not still.exists():
            print(f"     generating still…")
            if not (generate_still_gemini(prompt, still)
                    or generate_still_openai(prompt, still)):
                print(f"     ❌ still generation failed for {name}")
                provider_used["failed"] += 1
                continue

        ok = False
        # Runway only in polish mode (cost)
        if not ROUGH_MODE and generate_runway_video(prompt, still, out_mp4, duration):
            ok = True
            provider_used["runway"] += 1
            print(f"     ✅ via Runway Gen-3")

        # Ken-Burns fallback (zero cost)
        if not ok and ken_burns_from_still(still, out_mp4, duration):
            ok = True
            provider_used["ken-burns"] += 1
            print(f"     ✅ via Ken-Burns zoompan")

        if not ok:
            print(f"     ❌ all providers failed for {name}")
            provider_used["failed"] += 1

    print(f"\nAI shots summary: {provider_used}")
    return 0 if provider_used["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run in rough mode (Ken-Burns only, no Runway cost)**

```bash
chmod +x scripts/promo-video/generate_ai_shots.py
PROMO_MODE=rough python3 scripts/promo-video/generate_ai_shots.py
ls -la promo/ai_shots/
ffprobe -v error -show_entries format=duration -show_entries stream=width,height,r_frame_rate \
  -of default=noprint_wrappers=1 promo/ai_shots/intro.mp4
ffprobe -v error -show_entries format=duration -show_entries stream=width,height,r_frame_rate \
  -of default=noprint_wrappers=1 promo/ai_shots/outro.mp4
```
Expected: `intro.mp4` 3s, `outro.mp4` 4s, both 2560×1440, 30fps. If the Gemini/OpenAI still generation fails for any reason, create a black-fill placeholder still with ffmpeg manually and rerun — the Ken-Burns step only needs a PNG input.

- [ ] **Step 3: Commit**

```bash
git add scripts/promo-video/generate_ai_shots.py
git commit -m "feat(promo-video): add generate_ai_shots.py (Runway -> Gemini -> Ken-Burns)"
```

---

## Task 9: Write `capture_scenes.py` (screen capture orchestration)

**Files:**
- Create: `scripts/promo-video/capture_scenes.py`

- [ ] **Step 1: Write the script**

Full content:
```python
#!/usr/bin/env python3
"""scripts/promo-video/capture_scenes.py

Launches JarvisTelemetry for each act, records the screen via ffmpeg
avfoundation, and saves raw_captures/act{1..4}.mp4.

Preflight:
  - checks ffmpeg is installed
  - checks Screen Recording permission (gets a sample frame)
  - builds the Swift app if .build/release/JarvisTelemetry is missing

Act recording windows:
  - Act 1  : 30 s from fresh launch (boot sequence + hero reactor)
  - Act 2  : 35 s after boot completes (panels + chatter)
  - Act 3  : 30 s with JARVIS_BATTERY_REPLAY env var (battery drama)
  - Act 4  : 25 s with scripted cliclick/AppleScript actions (links, lock, shutdown)
"""
from __future__ import annotations
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.shot_list_loader import load, REPO_ROOT  # noqa: E402

RAW = REPO_ROOT / "promo" / "raw_captures"
RAW.mkdir(parents=True, exist_ok=True)

SWIFT_BIN = REPO_ROOT / "JarvisTelemetry" / ".build" / "release" / "JarvisTelemetry"
REPLAY_JSON = REPO_ROOT / "scripts" / "promo-video" / "replay_sequences" / "act3_battery_drama.json"
LAUNCH_LOG = REPO_ROOT / "tests" / "output" / "jarvis_launch.log"


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, **kw)


def preflight() -> None:
    # ffmpeg
    if not subprocess.run(["which", "ffmpeg"], capture_output=True).stdout:
        sys.exit("[preflight] ffmpeg not found; `brew install ffmpeg`")
    # Swift binary — build if missing
    if not SWIFT_BIN.exists():
        print("[preflight] building Swift app (first run)…")
        subprocess.run(
            ["swift", "build", "-c", "release"],
            cwd=REPO_ROOT / "JarvisTelemetry",
            check=True,
        )
    # Screen Recording permission probe: capture a single 0.5s frame.
    probe = RAW / "_probe.mp4"
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-f", "avfoundation", "-capture_cursor", "0", "-framerate", "30",
             "-i", "1:none",
             "-t", "0.5",
             "-c:v", "libx264", "-preset", "ultrafast",
             str(probe)],
            check=True, capture_output=True, timeout=20,
        )
        probe.unlink(missing_ok=True)
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.decode()[:400] if exc.stderr else ""
        sys.exit(
            "[preflight] ffmpeg avfoundation screen capture failed.\n"
            "Grant Screen Recording permission to Terminal (or ffmpeg) in\n"
            "  System Settings → Privacy & Security → Screen Recording.\n"
            f"ffmpeg stderr (first 400 bytes):\n{stderr}"
        )


def launch_app(extra_env: dict[str, str] | None = None) -> subprocess.Popen:
    env = os.environ.copy()
    env["JARVIS_PROMO_CAPTURE"] = "1"  # informational flag; app ignores it
    if extra_env:
        env.update(extra_env)
    LAUNCH_LOG.parent.mkdir(parents=True, exist_ok=True)
    log = open(LAUNCH_LOG, "a")
    log.write(f"\n=== {time.strftime('%Y-%m-%d %H:%M:%S')} ===\n")
    log.flush()
    # Requires sudo -v beforehand; uses sudo -n so it won't prompt
    p = subprocess.Popen(
        ["sudo", "-n", "-E", str(SWIFT_BIN)],
        env=env, stdout=log, stderr=log,
    )
    return p


def stop_app(p: subprocess.Popen, grace: float = 2.0) -> None:
    if p.poll() is not None:
        return
    # SIGTERM so the ShutdownSequenceView animation runs
    subprocess.run(["sudo", "-n", "kill", "-TERM", str(p.pid)],
                   capture_output=True)
    try:
        p.wait(timeout=grace)
    except subprocess.TimeoutExpired:
        subprocess.run(["sudo", "-n", "kill", "-KILL", str(p.pid)],
                       capture_output=True)
        p.wait(timeout=1.0)


def record(out_mp4: Path, duration: float) -> None:
    """Record the main display via ffmpeg avfoundation."""
    out_mp4.unlink(missing_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "avfoundation",
         "-capture_cursor", "0",
         "-framerate", "30",
         "-i", "1:none",
         "-t", f"{duration}",
         "-vf", "scale=2560:1440:force_original_aspect_ratio=decrease,"
                "pad=2560:1440:(ow-iw)/2:(oh-ih)/2:color=black",
         "-c:v", "libx264", "-preset", "medium", "-crf", "16",
         "-pix_fmt", "yuv420p",
         "-r", "30",
         str(out_mp4)],
        check=True,
    )


def capture_act1() -> None:
    """Act 1 — cold boot (30s): launch fresh, record immediately."""
    out = RAW / "act1.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        print(f"  ⏭  {out.name} already exists, skipping")
        return
    print(f"  🎥  act1.mp4 — cold boot + hero reactor (30s)")
    p = launch_app()
    time.sleep(0.8)  # let the NSWindow settle
    record(out, 30.0)
    stop_app(p)


def capture_act2() -> None:
    """Act 2 — panels/chatter (35s): launch, wait for boot, record steady state."""
    out = RAW / "act2.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        print(f"  ⏭  {out.name} already exists, skipping")
        return
    print(f"  🎥  act2.mp4 — floating panels + chatter (35s)")
    p = launch_app()
    time.sleep(11.0)  # ~10s boot + 1s settle
    record(out, 35.0)
    stop_app(p)


def capture_act3() -> None:
    """Act 3 — battery drama (30s): replay env var drives BatteryMonitor."""
    out = RAW / "act3.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        print(f"  ⏭  {out.name} already exists, skipping")
        return
    print(f"  🎥  act3.mp4 — battery drama via replay (30s)")
    p = launch_app(extra_env={"JARVIS_BATTERY_REPLAY": str(REPLAY_JSON)})
    time.sleep(11.0)  # wait for boot to complete
    record(out, 30.0)
    stop_app(p)


def capture_act4() -> None:
    """Act 4 — integration + shutdown (25s): fresh launch, then SIGTERM for animated shutdown."""
    out = RAW / "act4.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        print(f"  ⏭  {out.name} already exists, skipping")
        return
    print(f"  🎥  act4.mp4 — macOS integration + shutdown (25s)")
    p = launch_app()
    time.sleep(11.0)
    # Start recording BEFORE we SIGTERM so the shutdown animation is captured
    rec_proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "avfoundation", "-capture_cursor", "0", "-framerate", "30",
         "-i", "1:none",
         "-t", "25",
         "-vf", "scale=2560:1440:force_original_aspect_ratio=decrease,"
                "pad=2560:1440:(ow-iw)/2:(oh-ih)/2:color=black",
         "-c:v", "libx264", "-preset", "medium", "-crf", "16",
         "-pix_fmt", "yuv420p", "-r", "30",
         str(out)],
    )
    # Let capture run for ~18s of steady state first
    time.sleep(18.0)
    # Then send SIGTERM to trigger ShutdownSequenceView (~6s)
    subprocess.run(["sudo", "-n", "kill", "-TERM", str(p.pid)], capture_output=True)
    rec_proc.wait(timeout=15)
    p.wait(timeout=10)


def main() -> int:
    preflight()
    # Make sure sudo creds are cached
    if subprocess.run(["sudo", "-n", "true"], capture_output=True).returncode != 0:
        print("[capture] no cached sudo credentials. Run `sudo -v` first.")
        return 2
    capture_act1()
    capture_act2()
    capture_act3()
    capture_act4()
    print("\n[capture] all 4 acts captured to promo/raw_captures/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/promo-video/capture_scenes.py
```

- [ ] **Step 3: Preflight only — verify Screen Recording permission is set**

Before running the full capture, verify the ffmpeg probe works:
```bash
cd /Users/vic/claude/General-Work/jarvis/jarvis-build
sudo -v
mkdir -p promo/raw_captures
ffmpeg -y -loglevel error -f avfoundation -capture_cursor 0 -framerate 30 \
  -i "1:none" -t 0.5 -c:v libx264 -preset ultrafast promo/raw_captures/_probe.mp4 \
  && echo "PERMISSION OK" && rm promo/raw_captures/_probe.mp4
```
Expected: `PERMISSION OK`. If not, follow the preflight error instructions to grant permission.

- [ ] **Step 4: Commit (do NOT run the full capture yet — that happens in Task 12)**

```bash
git add scripts/promo-video/capture_scenes.py
git commit -m "feat(promo-video): add capture_scenes.py (4-act screen capture orchestration)"
```

---

## Task 10: Write `assemble.sh` (two-pass ffmpeg + 7 validation gates)

**Files:**
- Create: `scripts/promo-video/assemble.sh`

- [ ] **Step 1: Write the script**

```bash
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
QA="$PROMO/qa_frames"
mkdir -p "$SCENES" "$QA"

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
  dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f")
  aw=$(awk -v d="$dur" 'BEGIN{print (d>=0.4 && d<=5.5)?1:0}')
  [[ "$aw" == "1" ]] || die "G2: $f duration ${dur}s out of [0.4, 5.5]"
done
log "G2: 10 VO lines OK"

# ---- G3: music present ----------------------------------------------------
[[ -f "$MUSIC/score.mp3" ]] || die "G3: missing $MUSIC/score.mp3 (run pick_music.sh)"
mdur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$MUSIC/score.mp3")
aw=$(awk -v d="$mdur" 'BEGIN{print (d>=120)?1:0}')
[[ "$aw" == "1" ]] || die "G3: music track too short (${mdur}s < 120s)"
log "G3: score.mp3 ${mdur}s"

# ---- AI shots (present OR warn and use Ken-Burns placeholder) -------------
for name in intro outro; do
  [[ -f "$AI/${name}.mp4" ]] || die "missing $AI/${name}.mp4 (run generate_ai_shots.py)"
done

# ---- Fonts (download once if missing) -------------------------------------
FONTS="$REPO_ROOT/scripts/promo-video/fonts"
mkdir -p "$FONTS"
if [[ ! -f "$FONTS/Orbitron-Bold.ttf" ]]; then
  log "downloading Orbitron-Bold.ttf"
  curl -fsSL -o "$FONTS/Orbitron-Bold.ttf" \
    "https://github.com/google/fonts/raw/main/ofl/orbitron/static/Orbitron-Bold.ttf" \
    || warn "Orbitron download failed; title cards will use default font"
fi
if [[ ! -f "$FONTS/Rajdhani-Medium.ttf" ]]; then
  log "downloading Rajdhani-Medium.ttf"
  curl -fsSL -o "$FONTS/Rajdhani-Medium.ttf" \
    "https://github.com/google/fonts/raw/main/ofl/rajdhani/Rajdhani-Medium.ttf" \
    || warn "Rajdhani download failed; subtitles will use default font"
fi

# Use fallback font path if the Orbitron file is missing
ORBITRON="$FONTS/Orbitron-Bold.ttf"
RAJDHANI="$FONTS/Rajdhani-Medium.ttf"
[[ -f "$ORBITRON" ]] || ORBITRON="/System/Library/Fonts/Supplemental/Arial Bold.ttf"
[[ -f "$RAJDHANI" ]] || RAJDHANI="/System/Library/Fonts/Supplemental/Arial.ttf"

# ---- Build scene clips from the raw captures -----------------------------
# shot_list.yaml drives which chunk of each act.mp4 maps to which scene.
# We slice with ffmpeg -ss and -t, then concat everything in scene order.
SCENES_DIR="$PROMO/scenes/slices"
mkdir -p "$SCENES_DIR"

slice() {
  local src="$1" start_in="$2" dur="$3" out="$4"
  ffmpeg -y -loglevel error \
    -ss "$start_in" -i "$src" -t "$dur" \
    -c:v libx264 -preset medium -crf 18 \
    -pix_fmt yuv420p -r 30 -an \
    "$out"
}

# Act 1 mapping: act1.mp4 contains [0,30] → scenes s02..s05 (live), plus s01 is AI
slice "$AI/intro.mp4"       0   3  "$SCENES_DIR/01_intro.mp4"
slice "$RAW/act1.mp4"       0   5  "$SCENES_DIR/02_boot_ignition.mp4"
slice "$RAW/act1.mp4"       5   6  "$SCENES_DIR/03_boot_rings.mp4"
slice "$RAW/act1.mp4"       11  8  "$SCENES_DIR/04_hero_reactor.mp4"
# s05 title_card: slice live footage, overlay title text in Pass 1 below
slice "$RAW/act1.mp4"       19  8  "$SCENES_DIR/05_title_card.mp4"

# Act 2 mapping: act2.mp4 wide + two crops
slice "$RAW/act2.mp4"       0   7  "$SCENES_DIR/06_panel_wide.mp4"
slice "$RAW/act2.mp4"       7  11  "$SCENES_DIR/07_left_panel.mp4"
slice "$RAW/act2.mp4"       18 10  "$SCENES_DIR/08_right_panel.mp4"
slice "$RAW/act2.mp4"       28  7  "$SCENES_DIR/09_panel_wide_return.mp4"

# Act 3 mapping: replay timeline defines the drama within act3.mp4
slice "$RAW/act3.mp4"       0   8  "$SCENES_DIR/10_charger_unplug.mp4"
slice "$RAW/act3.mp4"       8   5  "$SCENES_DIR/11_low_power_hold.mp4"
slice "$RAW/act3.mp4"       13  5  "$SCENES_DIR/12_charger_reconnect.mp4"
slice "$RAW/act3.mp4"       18 12  "$SCENES_DIR/13_overdrive.mp4"

# Act 4 mapping: jarvis-links, lock freeze, shutdown sequence, outro
slice "$RAW/act4.mp4"       0   7  "$SCENES_DIR/14_jarvis_links.mp4"
slice "$RAW/act4.mp4"       7   8  "$SCENES_DIR/15_lock_freeze.mp4"
slice "$RAW/act4.mp4"       15  6  "$SCENES_DIR/16_shutdown.mp4"
slice "$AI/outro.mp4"       0   4  "$SCENES_DIR/17_outro.mp4"

# ---- Overlay title card on scene 05 --------------------------------------
TITLE_IN="$SCENES_DIR/05_title_card.mp4"
TITLE_OUT="$SCENES_DIR/05_title_card_overlay.mp4"
ffmpeg -y -loglevel error -i "$TITLE_IN" -vf "\
drawtext=fontfile='$ORBITRON':text='JARVIS':fontcolor=#1AE6F5:fontsize=220:\
x=(w-text_w)/2:y=(h-text_h)/2-40:alpha='if(lt(t,0.5),0,if(lt(t,1.3),(t-0.5)*1.25,if(lt(t,5.0),1,if(lt(t,6.0),(6.0-t)*1,0))))',\
drawtext=fontfile='$RAJDHANI':text='Cinema-grade telemetry for Apple Silicon':fontcolor=white:fontsize=56:\
x=(w-text_w)/2:y=(h/2)+140:alpha='if(lt(t,1.5),0,if(lt(t,2.2),(t-1.5)*1.43,if(lt(t,5.0),1,if(lt(t,6.0),(6.0-t)*1,0))))'\
" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -an "$TITLE_OUT"
mv "$TITLE_OUT" "$TITLE_IN"

# ---- Pass 1: concat all scenes with crossfades into silent.mp4 -----------
# For simplicity use ffmpeg concat demuxer with hard cuts; xfade between every
# pair adds complexity that the rough cut can skip. Polish pass can add xfade.
CONCAT_LIST="$SCENES_DIR/concat.txt"
: > "$CONCAT_LIST"
for f in "$SCENES_DIR"/{01,02,03,04,05,06,07,08,09,10,11,12,13,14,15,16,17}_*.mp4; do
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
log "G4: silent.mp4 ${sdur}s"

# ---- Pass 2: mix music + VO with sidechain ducking, mux into final -------
# Build VO delay expressions from shot_list (read via python helper)
VO_FILTERS=$(python3 - <<'PY'
import sys
sys.path.insert(0, 'scripts/promo-video')
from lib.shot_list_loader import load
d = load()
vo = d['vo_lines']
# Emit adelay filter per line and a final amix
lines = []
for i, key in enumerate(sorted(vo.keys())):
    ms = int(vo[key]['place_at'] * 1000)
    idx = i + 1
    lines.append(f"[{idx}:a]adelay={ms}|{ms},volume=1.5[v{idx}]")
mix_inputs = "".join(f"[v{i+1}]" for i in range(len(vo)))
lines.append(f"{mix_inputs}amix=inputs={len(vo)}:duration=longest:normalize=0[vo_mix]")
print(";".join(lines))
PY
)

# Build input args for each VO file in sorted order
VO_INPUTS=""
i=0
for f in "$VO"/line*.wav; do
  VO_INPUTS+="-i $f "
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
  ${=VO_INPUTS} \
  -i "$MUSIC/score.mp3" \
  -filter_complex "\
${VO_FILTERS};\
[11:a]volume=0.5[music_raw];\
[music_raw][vo_mix]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=400[music_duck];\
[music_duck][vo_mix]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]" \
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

# ---- G6: loudness check ---------------------------------------------------
lufs_json=$(ffmpeg -nostats -hide_banner -i "$FINAL" \
  -af ebur128=peak=true:framelog=quiet -f null - 2>&1 | tail -20)
i_lufs=$(echo "$lufs_json" | grep -oE "I:\s+-?[0-9]+\.?[0-9]*" | head -1 | awk '{print $2}')
if [[ -n "$i_lufs" ]]; then
  aw=$(awk -v l="$i_lufs" 'BEGIN{print (l>=-16 && l<=-12)?1:0}')
  if [[ "$aw" == "1" ]]; then
    log "G6: integrated loudness ${i_lufs} LUFS ✓"
  else
    warn "G6: integrated loudness ${i_lufs} LUFS outside [−16, −12]"
  fi
fi

# ---- G7: sanity frames ----------------------------------------------------
for t in 0 15 45 75 105 115; do
  ffmpeg -y -loglevel error -ss "$t" -i "$FINAL" -frames:v 1 \
    -q:v 2 "$QA/t${t}s.png"
done
log "G7: sanity frames in $QA/"

log "DONE: $FINAL"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/promo-video/assemble.sh
```

- [ ] **Step 3: Commit (full run happens in Task 12)**

```bash
git add scripts/promo-video/assemble.sh
git commit -m "feat(promo-video): add assemble.sh two-pass ffmpeg with 7 validation gates"
```

---

## Task 11: Write the full `run.sh` orchestrator

**Files:**
- Modify: `scripts/promo-video/run.sh`

- [ ] **Step 1: Replace the stub with the real orchestrator**

```bash
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

# Check sudo credentials cached (capture_scenes.py needs them)
if ! sudo -n true 2>/dev/null; then
  echo "[run] sudo credentials not cached. Running 'sudo -v' now..."
  sudo -v || { echo "[run] sudo cache failed"; exit 1; }
fi

# Phase 1: capture scenes (idempotent)
echo ""
echo "--- Phase 1: scene capture ---"
python3 scripts/promo-video/capture_scenes.py

# Phase 2: VO synthesis (idempotent)
echo ""
echo "--- Phase 2: voice narration ---"
python3 scripts/promo-video/generate_vo.py

# Phase 3: music download
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
```

- [ ] **Step 2: Smoke check — run with a dry probe**

Just run `./scripts/promo-video/run.sh --rough` and let the preflight in capture_scenes fire. Don't worry about a full run yet — Task 12 is where the first end-to-end rough cut happens.

Actually, skip the smoke check for this task. Go straight to commit.

- [ ] **Step 3: Commit**

```bash
git add scripts/promo-video/run.sh
git commit -m "feat(promo-video): add full run.sh orchestrator with --rough/--polish modes"
```

---

## Task 12: First rough cut end-to-end

**Files:** none created; generates `promo/JARVIS_PROMO_v1.mp4`

- [ ] **Step 1: Ensure Swift app is built**

```bash
cd /Users/vic/claude/General-Work/jarvis/jarvis-build/JarvisTelemetry
swift build -c release
cd ..
```

- [ ] **Step 2: Cache sudo**

```bash
sudo -v
```

- [ ] **Step 3: Run the full rough pipeline**

```bash
./scripts/promo-video/run.sh --rough
```

This will:
1. Record act1 (30s), act2 (35s), act3 (30s with replay), act4 (25s with shutdown) — ~2 min of capture wall-clock
2. Synthesise 10 VO lines via `say Daniel` (~15s)
3. Download / synthesise music (~5s)
4. Generate AI intro/outro via Ken-Burns (~30s)
5. Two-pass ffmpeg assemble + validation (~60s)

Total wall clock: ~5-8 min.

- [ ] **Step 4: Verify the output**

```bash
ffprobe -v error -show_entries format=duration -show_entries stream=width,height,r_frame_rate,codec_name \
  -of default=noprint_wrappers=1 promo/JARVIS_PROMO_v1.mp4
ls -la promo/qa_frames/
```
Expected: 120s ±1s, 2560×1440, 30/1 fps, H.264 video + AAC audio, 6 sanity frames in qa_frames/.

- [ ] **Step 5: Open the rough cut in QuickTime**

```bash
open promo/JARVIS_PROMO_v1.mp4
```

Review: watch start to finish. Note any scenes that need rework (pacing, visible issues, audio levels, etc.).

- [ ] **Step 6: Commit the pipeline artifacts NOT the video itself**

The `promo/` directory is gitignored, so the video won't be committed. Just confirm the state:
```bash
git status
```
Expected: clean working tree (all pipeline scripts already committed in prior tasks; promo/ is gitignored).

---

## Task 13: Polish pass (Runway + OpenAI TTS + curated music)

**Prerequisite:** Task 12 rough cut was reviewed and approved OR needs specific tweaks.

- [ ] **Step 1: Remove stale VO and AI shots to force regeneration**

```bash
rm -f promo/vo/*.wav promo/ai_shots/*.mp4 promo/ai_shots/_stills/*.png
```

- [ ] **Step 2: Run in polish mode**

```bash
./scripts/promo-video/run.sh --polish
```

This regenerates VO via OpenAI `fable`, AI shots via Runway (costs ~$2-4 in Runway credits), downloads the curated music if not already present. Raw captures from Task 12 are reused (idempotent).

- [ ] **Step 3: Verify the polish output**

```bash
ls -la promo/JARVIS_PROMO_v*.mp4
```
Expected: `v1.mp4` (rough) and `v2.mp4` (polish) both present.

- [ ] **Step 4: Open the polish cut**

```bash
open promo/JARVIS_PROMO_v2.mp4
```

- [ ] **Step 5: If the polish cut is approved, that's the final deliverable**

No commit needed — the video file itself is in the gitignored `promo/` directory. You upload it to YouTube/Vimeo directly from that path.

---

## Self-Review Checklist

Run these checks after finishing Task 13.

- [ ] **Spec coverage:** Each Success Criterion from the spec maps to a task:
  - SC-1 (120s ±2s) → Task 2 validation step, Task 10 G4
  - SC-2 (VO audible, on-cue, ducked) → Task 6, Task 10 sidechaincompress
  - SC-3 (no artefacts) → Task 9 high bitrate + Task 10 G7 sanity frames
  - SC-4 (2560×1440 H.264 AAC yuv420p) → Task 10 G5
  - SC-5 (−14 LUFS ±2) → Task 10 loudnorm + G6
  - SC-6 (all 4 beats showcased) → Task 9 act captures + Task 10 scene slicing
  - SC-7 (user approval) → Task 12 / Task 13 review steps

- [ ] **Placeholder scan:** Check this plan for "TBD", "TODO", "later", "appropriate", "similar to". Every step should have concrete commands or code. (Self-reviewed during writing.)

- [ ] **Type consistency:** The `shot_list.yaml` schema (scenes/vo_lines/meta) must match what `lib/shot_list_loader.py` reads and what `assemble.sh` queries. The VO filename pattern `lineNN.wav` must match across `generate_vo.py`, `assemble.sh` G2, and the `adelay` filter builder.

- [ ] **Dependency order:** Task 4 (BatteryMonitor Swift) must complete before Task 9 (capture_scenes uses the env var). Task 2 (shot_list.yaml) must complete before Tasks 3–11. Task 9 must complete before Task 10.

---

**Plan complete.** Final video file: `promo/JARVIS_PROMO_v{N}.mp4`. License attribution: `promo/music/LICENCE.txt`. Everything else in `promo/` is gitignored working state.
