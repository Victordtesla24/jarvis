# JARVIS — Product Requirements Document

> Autonomous machine agent + **JARVIS_3.0 Iron-Man desktop HUD**.
> Idle time = sleep. No shortcuts, no "good enough" — match the reference exactly.

- **Owner:** vic · **Updated:** 2026-05-30
- **Repo:** `~/.jarvis/` (git; `.env`, runtime, `node_modules` gitignored)
- **Active objective:** **§3 — JARVIS_3.0 Desktop HUD** (visual + motion match to the reference video, real-time monitoring)

---

## 1. Delivered core (do not regress)

Background daemon (launchd `com.jarvis.daemon`, RunAtLoad+KeepAlive), APScheduler jobs
(tidy 15m, **autopilot** 30m idle-aware reclamation, health 60m, deep_clean 00:00, db_cleanup 30d),
SQLite audit DB, MiniMax LLM brain (optional), macOS notifications, CLI (`status/stats/log/tidy/ask/dashboard`).
Telemetry/command backend at `lib/dashboard.py`: loopback HTTP **`/api/stats`** (system/docker/brain/audit/machines/recent, fault-isolated per sensor) + **`/api/command`** allow-list. Test suite green.
Safety invariants: never touch `.env`/credentials; `SKIP_PATTERNS` protects `.ssh`, `.claude`, `mcp-servers`, editor/agent caches; destructive actions idle/dormancy/confirm-gated; loopback-only.

---

## 2. Reference assets (the quality bar — match these)

Source video the user wants replicated **exactly** (quality, layout, animation, behavior):
- **`~/Downloads/JARVIS_EXPECTATIONS_4K.mov`** (2294×1284, 60fps, 75s) — the definitive target.

Extracted/derived stills in **`design_refs/`** (read these):
- `ref_boot.jpg` — BOOT: assembling reactor, **gold progress arc**, "J.A.R.V.I.S." center, "IN PROGRESS".
- `ref_reactor_closeup.jpg` — high-detail reactor + right panels (level-meter sliders, big numeric readouts `73.812`, rounded circuit-bus routing).
- `ref_full_layout.jpg` — full desktop: SYSTEM-JARVIS_3.0 top-left, STATUS bars, badge readout, orbital radar, `PLANET_01..08` rows, "– LISTENING –" waveform, center reactor, right launchers (Notepad/Todo List/My Files/Youtube), clock.
- `ref_jarvis_desktop.jpg` — related JARVIS desktop theme.
- `reactor_APPROVED.png` — **user-approved** reactor look (AI-generated, matches the target).
- `reactor_gen_a.png`, `reactor_gen_b.png` — finalized AI reactor renders to use as the build target / texture.

---

## 3. JARVIS_3.0 Desktop HUD — requirements

A full-screen, **transparent, frameless, always-on-top** Iron-Man desktop overlay (the Electron `.app`),
flat thin-line **cyan/electric-blue on near-black**, built on the existing `/api/stats` + `/api/command` backend.

### 3.1 Reactor centerpiece (match `ref_reactor_closeup.jpg` + `reactor_APPROVED.png`)
- **Mechanical hub** at center (small concentric rings + iris segments + tiny hot-white core) — **NOT** a big white glow ball.
- **Segment-block ring** (bold rounded-rectangle dashes) outside the hub.
- **Dense fine radial turbine** energy burst (near-uniform blades + travelling shimmer), bright inner rim.
- **Multiple concentric tick-mark rings**, counter-rotating.
- **Boot sequence**: assembling rings + **gold/amber progress arc** + "J.A.R.V.I.S." + "IN PROGRESS" → reveal.
- Core brightness + turbine intensity **driven by live CPU load**.
- Use `reactor_gen_a/b.png` as a texture/overlay if it raises fidelity; the generated **animated reactor video** (Stage 4, in `design_refs/`) may be composited as the centerpiece.

### 3.2 Panels & layout (match `ref_full_layout.jpg`)
- **Header**: `SYSTEM · JARVIS_3.0`, large center **clock** (`HH:MM:SS AM/PM`), link/node status.
- **Left**: STATUS bars (CPU/MEM/DISK, live), badge numeric readout, **orbital radar** sweep, **`PLANET_01..08`** animated data rows, **"– LISTENING –"** waveform.
- **Center**: the reactor + a contextual command menu (Open Finder/Documents/Downloads/Pictures/APPS).
- **Right**: realtime **graphs** (CPU/RAM streams), **level-meter sliders**, big numeric readouts, **circuit-bus flow** diagram, **app launchers** (Notepad, Todo List, My Files, Youtube).
- **Footer**: STARK INDUSTRIES, node, machine tags, FPS.

### 3.3 Real-time monitoring (must be real)
Poll `/api/stats` ≤2s: CPU/RAM/disk %, Docker count, machine list, audit counts → bind to bars, graphs, badges, PLANET rows, reactor intensity. Live "data freshness": ACTIVE/STALE/OFFLINE.

### 3.4 Functionality scope (THIS pass = visual match first)
- Real-time monitoring: **functional**. Reactor + all animation: **functional**, 60fps.
- App launchers + voice "LISTENING" + command menu: **non-functional UI shells** this pass (wire real macOS `open`/Web-Speech in a later approved pass). macOS mapping when wired: Finder / `~/Documents` / `~/Downloads` / `~/Pictures` / app launch via `open`.

### 3.5 Visual standard
Palette cyan `#3ff0e0` / electric `#28e0ff` / hot `#eafdff` / teal on `#03090c`. Fonts: Orbitron (display) + Share Tech Mono (data) + Rajdhani (body). Glow/bloom, scanlines, grid, corner brackets. **Match the reference frames** — judged by side-by-side against `design_refs/` and the video. No placeholder geometry, no "good enough".

---

## 4. Success Criteria (binary — visual judged vs `design_refs/`)

- [ ] SC-H1. HUD layout matches `ref_full_layout.jpg` (header/clock, left status+radar+PLANET+listening, center reactor, right graphs+launchers, footer).
- [ ] SC-H2. Reactor matches `ref_reactor_closeup.jpg`/`reactor_APPROVED.png` (mechanical hub, segment-block ring, dense turbine, concentric tick rings) — not a white blob.
- [ ] SC-H3. Boot sequence with gold progress arc + "J.A.R.V.I.S." + "IN PROGRESS".
- [ ] SC-H4. Real-time CPU/RAM/disk drive bars, graphs, PLANET rows, reactor intensity (verified live).
- [ ] SC-H5. Holds ~60fps; transparent always-on-top `.app` launches via `jarvis dashboard`.
- [ ] SC-H6. Side-by-side visual review vs the reference passes (no AI-slop, no generic look).

---

## 5. Build approach (staged — see TASKS.md)

Design is locked via an **AI generation pipeline** (image gen → finalize → animated video), then
**ralphy builds the live HUD to match the locked assets** and the reference frames, data-driven, in the
`wip/jarvis3-hud` worktree, validated by screenshot comparison. APIs available (use wisely):
OpenRouter (Gemini 3 Pro / GPT-5 image, image-to-image), MiniMax (image→video), Gemini, OpenAI.
