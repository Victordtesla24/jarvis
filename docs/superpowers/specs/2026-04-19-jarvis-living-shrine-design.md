# JARVIS Living Shrine HUD Uplift — Design Spec

**Date:** 2026-04-19
**Status:** Approved (brainstorming complete; awaiting build + visual A/B approval)
**Author:** brainstorming session, 2026-04-19
**Approval log:** Approach A → reactor uplift to "more Iron Man" → living-shrine direction → full design (no trims) → prototype-first workflow → spec write
**Predecessors:**
- `docs/superpowers/specs/2026-04-09-jarvis-cinematic-hud-design.md` (original cinematic spec)
- `docs/ideation/2026-04-13-jarvis-reactor-cinematic-fidelity-ideation.md` (reactor fidelity gaps that this spec closes)

---

## 1. Goal

Transform the **currently deployed** JARVIS HUD (`jarvis-full-animation.html` at repo root, loaded by `JarvisTelemetry/Sources/JarvisTelemetry/AppDelegate.swift:262`) from "animated wallpaper" into a **living presence**:

- **Cinematic + working HUD** as the visual axis — closer to an Iron Man movie still while staying glance-readable.
- **Living shrine** as the behavioral axis — JARVIS as a presence, not a tool. Subtle breathing, slow ambient pulse, reactive but never demanding. Most of the time you barely notice it; under stress it announces itself.
- **Demo-grade** as the convergence point — every tweak must read well in a single screenshot or 3-second clip.

**Effort budget:** ~4.5 hours of focused work, ~280 LOC net-new across one HTML file plus ~20 LOC in one Swift file.

**Non-negotiable constraint:** the deployed HUD does not regress. All work happens in a prototype copy, validated visually, before the deployed file is touched. See §8 (Testing & prototype workflow).

---

## 2. Direction Synthesis

User-ranked direction (from brainstorming Q3): **A + B → D, with C as the unifying behavioral layer.**

- **A (Cinematic film frame)** — primary visual axis. Heavier blacks, deeper bloom, more depth, "wet" lighting.
- **B (Working HUD)** — telemetry remains glance-readable. Aesthetics serve legibility, not the other way around.
- **C (Living shrine)** — primary behavioral axis. Vitality engine modulates everything based on system state. Idle is calm; load announces itself.
- **D (Production demo)** — convergence point. All five components must compose into a screenshot moment.

---

## 3. Architecture & File Scope

### 3.1 Touched files

| File | Change | Notes |
|------|--------|-------|
| `jarvis-full-animation.html` (root) | All HUD/CSS/JS changes (~260 LOC net-new). Touched **only in Phase 5** (promotion). | Deployed render engine. AppDelegate loads this path. |
| `prototypes/jarvis-shrine-uplift.html` | **New file.** Byte-copy of the deployed HTML at HEAD plus all design changes. Used for Phases 1-4. | New `prototypes/` directory (gitignored from build). |
| `JarvisTelemetry/Sources/JarvisTelemetry/AppDelegate.swift` | One new method `injectWakeExhale()` (~20 LOC) + one notification observer for `NSWorkspace.didWakeNotification`. | Wake-exhale lifecycle hook. Existing sleep observer pattern reused. |
| `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html` | **Deleted.** Already 425+ lines behind root, never loaded. | Removes drift source. Verified via `git grep` that nothing references it as a runtime path. |

### 3.2 Untouched files

- `mactop/` (Go daemon) — telemetry contract sufficient as-is.
- `TelemetryBridge.swift` — JSON stream is fine.
- `JarvisHUDView.swift` — already secondary path, not deployed.
- `build-app.sh` / `start-jarvis.sh` / `stop-jarvis.sh` — already point at the right HTML.

### 3.3 New global state (extends existing `STATE` object, no new globals)

```js
STATE.vitality       = 0.40;   // smoothed [0,1], drives the living-shrine layer
STATE.vitalityTarget = 0.40;   // unsmoothed instantaneous target
STATE.deepSleepIdleSec = 0;    // seconds since last interaction or active vitality
STATE.flickerT       = 0;      // 0..1, decremented per frame, additive bloom boost on power spike
STATE.wakeExhaleT    = 0;      // 0..1, drives the 600ms unlock keyframe (set by JS, read by CSS class)
STATE.castIntensity  = 0;      // 0..1, drives wallpaper light cast (mirrors bloomMul × vitality)
STATE.lastPowerW     = 0;      // for delta detection on power spikes
STATE.lastMouseTick  = 0;      // for mousemove throttling
```

That's 8 new fields on the existing `STATE` object. No new singletons, no new modules.

### 3.4 Edit anchors in the HTML (line numbers from current deployed file)

| Anchor | What lands there |
|--------|------------------|
| `:1372–1379` (palette constants) | Add `WARM_HEARTH = '255,100,30'` for the embered undertone. |
| `:1621` (`STATE` object) | Add the 8 new fields above. |
| `:1650` (`TEL` object) | Untouched. |
| `:1704` (`drawRings`) | Add 1-line vitality multiplier on ring speed. |
| `:1755` → new `drawCore()` extension | All R1-R9 reactor sub-changes (the big block). |
| New helper `breathSkew(t, rate)` near existing breathing math | Asymmetric inhale/exhale waveform. |
| New helper `computeVitality()` and `tickVitality(dt)` | Vitality engine state machine. |
| `:1888-1911` (`spawnParticles`, `drawParticles`) | Modulate spawn rate by vitality (no pool resize). |
| Existing `drawHexGrid` | Single multiplier on alpha. |
| New `runWakeExhale()` JS function | Toggles `.wake-exhale` body class. |
| `<style>` block (~`:9-1200`) | Type-rhythm tier classes, trigger pill restyle, wake-exhale keyframe, `body::after` light cast. |
| Existing `#jt-toggle` / `#jt-root` (~`:1183-1209`) | Replace rectangle with pill. |
| New peripheral effects (edge sparkles, distant data ticks) | Inside the existing RAF loop. |

### 3.5 Risk surface

- One ~150-LOC new draw block in `drawCore()`. Local risk to the reactor only.
- One new CSS pseudo-element with `mix-blend-mode: screen` (`body::after`). WKWebView blend-mode support has a guarded fallback (see §7).
- One new postMessage hook (`runWakeExhale`). Verified by grep: zero collision with existing handlers.
- One new Swift notification observer. Existing sleep observer pattern reused.

---

## 4. Components in Detail

### 4.1 Component 1 — Reactor (R1-R9)

The big swing. All sub-changes land inside or adjacent to `drawCore()`. ~150 LOC.

| # | Sub-change | Iron Man reference | Implementation summary |
|---|------------|--------------------|------------------------|
| **R1** | Stacked-disc palladium core | The signature "depth trap" | 5 concentric translucent discs at R×{0.06, 0.05, 0.04, 0.03, 0.02}, golden-ratio rotation offsets, blend `lighter`. Innermost = brilliant white α=0.95, outers fade to teal-cyan. ~25 LOC. |
| **R2** | Triangular core glyph (replaces "2") | Mark III palladium triangle | 3-vertex equilateral triangle at R×0.025, apex-up, stroked + filled brilliant white-cyan, pulses on `breathingPhase`, rotates 0.05 rad/s. ~12 LOC. |
| **R3** | Anamorphic horizontal lens flare | Iconic JJ Abrams / MCU cinematography | Stretched radial gradient ~3R wide × 0.06R tall across reactor center, blend `lighter`, cyan-white. Alpha modulated by `bloomMul × vitality`. ~15 LOC. |
| **R4** | Volumetric god-rays | Light shafts cutting workshop dust | 8 triangular radial fans from R×0.04 → R×0.6, alpha 0.04 base × `bloomMul × vitality`, blend `lighter`, counter-rotating at 0.02 rad/s. ~20 LOC. |
| **R5** | Copper-amber coil ring | Internal coil windings under glass | Helical pattern at R×0.13 — 60 short tangent ticks at varying angles in `AMBER` (`#FFC800`), alpha 0.18. Suggests wound copper. ~10 LOC. |
| **R6** | Counter-rotating inner sub-ring | Mechanical rotation inside dome | Thin gauge ring at R×0.085 rotating opposite dome, light teal, alpha 0.35. Rotational variety inside the core. ~8 LOC. |
| **R7** | 4 holographic data callouts | Tony's HUD overlays | At 30°/150°/210°/330° (asymmetric, deliberate), draw leader line from R×0.20 → R×0.32, then 50-px label box showing real values: `PWR 23W` / `LOAD 47%` / `TMP 64°C` / `MEM 38GB`. Rajdhani 9pt, 0.18em letter-spacing. Labels micro-fade on value change. Alpha = `0.5 + 0.5 × vitality`. ~35 LOC. |
| **R8** | Power-spike flicker | Reactor surging when Tony pulls power | When `TEL.powerW − STATE.lastPowerW > 5W`, set `STATE.flickerT = 0.20`. Per-frame: decrement by `dt`, additive `+0.30 × flickerT` boost to `bloomMul`. ~8 LOC. |
| **R9** | Reactor light cast on wallpaper | Reactor lighting workshop around it | Full-viewport `body::after { background: radial-gradient(circle at center, rgba(26,230,245,var(--cast)) 0%, transparent 55%); mix-blend-mode: screen; }`. `--cast` driven by `STATE.castIntensity = bloomMul × vitality × 0.18`. ~15 LOC CSS + 3 LOC JS. |

### 4.2 Component 2 — Telemetry type-rhythm pass

Pure CSS. ~25 LOC in the existing `<style>` block.

```css
/* Three-tier opacity hierarchy */
.tlm-label  { opacity: 0.55; letter-spacing: 0.18em; text-transform: uppercase; font-family: 'Rajdhani', sans-serif; }
.tlm-value  { opacity: 1.00; font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
.tlm-unit   { opacity: 0.45; font-family: 'Rajdhani', sans-serif; font-size: 0.78em; }
```

Apply `.tlm-label` / `.tlm-value` / `.tlm-unit` classes to existing telemetry strings via small JS template-string adjustments at the existing render points. No new HTML elements.

### 4.3 Component 3 — Lifecycle wake exhale

Swift side (`AppDelegate.swift`):
```swift
NotificationCenter.default.addObserver(
    forName: NSWorkspace.didWakeNotification, object: nil, queue: .main
) { [weak self] _ in
    self?.injectWakeExhale()
}

private var lastWakeExhaleAt: Date = .distantPast
private func injectWakeExhale() {
    let now = Date()
    guard now.timeIntervalSince(lastWakeExhaleAt) > 1.5 else { return }  // debounce
    lastWakeExhaleAt = now
    webView?.evaluateJavaScript("runWakeExhale && runWakeExhale()", completionHandler: nil)
}
```

JS side:
```js
function runWakeExhale() {
    document.body.classList.remove('wake-exhale');
    void document.body.offsetWidth;       // restart keyframe
    document.body.classList.add('wake-exhale');
    setTimeout(() => document.body.classList.remove('wake-exhale'), 650);
}
```

CSS keyframe:
```css
@keyframes wakeExhale {
    0%   { opacity: 0; transform: scale(1.04); }
    100% { opacity: 1; transform: scale(1.00); }
}
body.wake-exhale #hexCanvas, body.wake-exhale #bloomCanvas,
body.wake-exhale #mainCanvas, body.wake-exhale #scanCanvas,
body.wake-exhale #fxCanvas, body.wake-exhale #grainCanvas {
    animation: wakeExhale 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

### 4.4 Component 4 — Ambient hex-grid pulse-on-load

Inside existing `drawHexGrid()`, multiply alpha by `(0.5 + 0.5 × STATE.vitality)`. Smoothed via vitality EMA so no jitter. ~6 LOC including a 1-line `STATE.hexLoadMul` reference if needed for color modulation.

### 4.5 Component 5 — Trigger pill restyle

Replace rectangle with pill. ~30 LOC CSS, no JS change.

```css
#jt-toggle {
    background: rgba(2, 8, 18, 0.92);
    border: 1.5px solid rgba(26, 230, 245, 0.85);
    border-radius: 14px;
    height: 28px;
    padding: 0 16px;
    font-family: 'Rajdhani', sans-serif;
    font-size: 11px;
    letter-spacing: 0.22em;
    color: #1AE6F5;
    box-shadow: 0 0 var(--pill-glow, 8px) rgba(26, 230, 245, 0.45);
    opacity: calc(0.32 + 0.63 * var(--vitality, 0.4));
    transition: opacity 0.4s ease-out;
}
#jt-toggle::before { content: "◊  "; }
```

`--pill-glow` is breathed via `STATE.breathingPhase` (one CSS variable update per RAF tick). `--vitality` is also pushed once per tick.

---

## 5. The Vitality Engine (Living Shrine Layer)

### 5.1 State machine

Single field `STATE.vitality ∈ [0, 1]`, smoothed via EMA over ~6 seconds (α = 0.005 per frame at 60 fps), driven by:

```
vitality_target = 0.40·cpuLoad
                + 0.30·thermalNorm
                + 0.20·powerNorm
                + 0.10·gpuLoad
where:
    thermalNorm = clamp((tempCPU - 50) / 40, 0, 1)
    powerNorm   = clamp((powerW   -  5) / 60, 0, 1)
    cpuLoad, gpuLoad are already 0..1 in TEL
```

Per-frame update inside the main RAF tick:
```js
function tickVitality(dt) {
    STATE.vitalityTarget = 0.40 * (TEL.cpuLoad / 100)
                         + 0.30 * Math.min(1, Math.max(0, (TEL.tempCPU - 50) / 40))
                         + 0.20 * Math.min(1, Math.max(0, (TEL.powerW - 5) / 60))
                         + 0.10 * (TEL.gpuLoad / 100);
    const alpha = 0.005;  // ~6s time constant at 60fps
    STATE.vitality += (STATE.vitalityTarget - STATE.vitality) * alpha;
}
```

Three named bands (used only for palette warmth shift; everything else reads continuous vitality):
- **REST** — `vitality < 0.25`
- **ACTIVE** — `0.25 ≤ vitality < 0.65`
- **STRESS** — `vitality ≥ 0.65`

### 5.2 Modulation table

Each component reads `STATE.vitality` and multiplies one or two parameters:

| Element | At REST (v=0) | At STRESS (v=1) | Code form |
|---------|---------------|-----------------|-----------|
| Reactor brightness | ×0.62 | ×1.32 | `0.62 + 0.70 × v` |
| Reactor breathing rate (Hz) | 0.38 | 1.10 | `0.38 + 0.72 × v` |
| Reactor disc rotation | ×0.70 | ×1.25 | `0.70 + 0.55 × v` |
| Hex grid alpha | 0.10 | 0.28 | `0.10 + 0.18 × v` |
| Particle spawn multiplier | 0.45 | 1.00 | `0.45 + 0.55 × v` |
| Callout label (R7) alpha | 0.50 | 1.00 | `0.50 + 0.50 × v` |
| Trigger pill alpha | 0.32 | 0.95 | `0.32 + 0.63 × v` |
| Bloom multiplier | ×0.72 | ×1.30 | `0.72 + 0.58 × v` |
| Palette warmth offset | +5% warm | -3% cool | `0.05 - 0.08 × v` |

### 5.3 Asymmetric breathing

Replace existing `sin(t × rate)` with skewed waveform: 40% inhale / 60% exhale.

```js
function breathSkew(t, rate) {
    // Period = 1/rate. Inhale 40%, exhale 60%. Returns [0, 1] envelope.
    const p = (t * rate) % 1;
    if (p < 0.40) return 0.5 - 0.5 * Math.cos(Math.PI * (p / 0.40));        // inhale
    else          return 0.5 + 0.5 * Math.cos(Math.PI * ((p - 0.40) / 0.60)); // exhale
}
STATE.breathingPhase = breathSkew(STATE.t, 0.4 + 0.7 * STATE.vitality);
```

Used by reactor pulse, bloom intensity, hex grid alpha, trigger pill glow.

### 5.4 Idle deep-sleep

After **300 seconds** in REST band (`vitality < 0.25` continuously), enter DEEP_REST:
- Clamp `vitality` to **0.18**
- Shift palette further warm (subtle amber undertone)
- Drop breathing rate to **0.30 Hz**

Wake conditions (any one resets `STATE.deepSleepIdleSec` to 0 and unclamps):
- `vitality_target > 0.30` (system spike)
- DOM `mousemove` event (throttled to 1 Hz)

```js
// In tickVitality(dt):
if (STATE.vitality < 0.25) {
    STATE.deepSleepIdleSec += dt;
    if (STATE.deepSleepIdleSec > 300 && STATE.vitalityTarget < 0.30) {
        STATE.vitality = Math.min(STATE.vitality, 0.18);
    }
} else {
    STATE.deepSleepIdleSec = 0;
}
```

### 5.5 Peripheral activity (presence cues)

Both gated by `vitality > 0.20` so deep-sleep is fully silent.

**Edge sparkles:** 1-in-600 frames (≈ 1 per 10s at 60fps). Random viewport edge, 8-32 px inset, lifetime 400 ms. Cyan, alpha 0.6 fading to 0. Drawn on `fxCanvas`.

**Distant data ticks:** every 8-15s (random within range), a faint 3-px horizontal tick flashes at left or right edge, 200 ms lifetime, alpha 0.45. Drawn on `fxCanvas`.

```js
function tickPeripheral(dt) {
    if (STATE.vitality < 0.20) return;
    if (Math.random() < 1/600) STATE.sparks.push(makeEdgeSpark());
    if (STATE.t - STATE.lastTickAt > (8 + Math.random() * 7)) {
        STATE.distantTicks.push(makeDistantTick());
        STATE.lastTickAt = STATE.t;
    }
}
```

### 5.6 Warm hearth undertone

Inside the disc stack (R1), add `rgba(255, 100, 30, 0.06 × (1 - vitality))` radial gradient at R×0.04. Invisible at STRESS (drowned by cyan), faintly perceptible at REST, more visible in DEEP_REST. Embered hearth quality.

---

## 6. Data Flow

```
[Go daemon]
   │ JSON 1Hz
   ▼
[TelemetryBridge.swift] ─► [AppDelegate.injectFullTelemetry @MainActor]
                                       │ evaluateJavaScript(updateTelemetry(...))
                                       ▼
                              [TEL object] ◄─────────┐
                                       │ each tick   │
                                       ▼             │
                             [tickVitality(dt)]      │
                                       │             │
                                       ▼             │
                       smoothed EMA → [STATE.vitality]
                                       │             │
                          reads in every drawX()     │
                                       │             │
        ┌────────────┬────────────┬────┴────────┬──────────┬────────────┐
        ▼            ▼            ▼             ▼          ▼            ▼
     drawCore   drawRings   drawHexGrid   drawParticles  callouts  trigger pill
        │
        └─► reads STATE.breathingPhase = breathSkew(STATE.t, 0.4 + 0.7 × vitality)

[ NSWorkspace.didWakeNotification ]
        │ (1.5s debounce)
        ▼
AppDelegate.injectWakeExhale()
        │ evaluateJavaScript("runWakeExhale()")
        ▼
JS toggles `.wake-exhale` body class for 600ms
        │
        ▼
CSS keyframe: opacity 0→1, scale 1.04→1.00 over 600ms cubic-bezier
```

**Side flows:**
- **Mouse activity** → DOM `mousemove` (throttled 1 Hz) → resets `STATE.deepSleepIdleSec = 0`.
- **Power spike** → `TEL.powerW - STATE.lastPowerW > 5` → set `STATE.flickerT = 0.20`. Per frame: decrement by `dt`, additive boost to `bloomMul`.
- **Telemetry change** on R7 callout values → CSS opacity flicker via class toggle (no JS animation loop).

All flows are read-only against the existing TEL/STATE contract; nothing mutates the Go daemon protocol.

---

## 7. Error Handling & Fallbacks

| Hazard | Guard |
|--------|-------|
| WKWebView `mix-blend-mode: screen` not rendering correctly on `body::after` (known macOS quirk on some configurations) | Probe at boot: render a 1×1 test pixel with the blend, read back via `getComputedStyle`. If unsupported, fall back to a transparent overlay `<div>` at z-index 0.5 with no blend mode and lower alpha (0.12 vs 0.18). |
| `NSWorkspace.didWakeNotification` firing 2-3× rapidly after wake | Swift-side debounce: ignore wake notifications within 1.5s of the previous one (`lastWakeExhaleAt` timestamp). |
| `STATE.vitality` cold-start before first telemetry tick | Initialize to **0.40** (mid-ACTIVE). HUD doesn't pop dim → bright on first frame. |
| Particle pool resize jank (22 ↔ 48) | **Don't resize the pool.** Keep pool at 48 always; modulate spawn rate (`STATE.particleSpawnMul`) and per-particle alpha. Idle particles fade rather than disappear. |
| `TEL.powerW` absent or zero (cold start, daemon hiccup) | `vitality_target` clamps each input to `[0, 1]`; absent fields treat as 0. Vitality drops calmly — no NaN, no jump. |
| Wake exhale firing while previous exhale mid-run | Idempotent: `runWakeExhale()` removes class, forces reflow (`void document.body.offsetWidth`), re-adds class. Keyframe restarts cleanly. |
| Deep-sleep waking on every mousemove | Mousemove handler: `if (now - STATE.lastMouseTick < 1000) return;`. Throttled to 1 Hz. |
| R7 callout text overlapping at small viewport | Callouts use `pointer-events: none`, absolute-positioned, hidden via media query at viewport `< 900px` wide. |
| 60fps regression after additions | Per-frame path-op assertion in dev mode (logs warn if > 750 ops). Use existing `scripts/promo-video/capture_scenes.py` infrastructure to A/B before vs after. |
| Power-spike flicker false positive on first tick (`STATE.lastPowerW = 0` triggers >5W delta on first reading) | Initialize `STATE.lastPowerW = -1`; skip flicker on negative previous value. |

No new external failure modes. Everything degrades gracefully to the existing baseline.

---

## 8. Testing & Prototype Workflow *(load-bearing — protects deployed product)*

**Phase 1 — Build prototype in isolation.** Create `prototypes/jarvis-shrine-uplift.html` (new directory). Byte-copy of `jarvis-full-animation.html` at HEAD, plus all design changes applied to it. Deployed file untouched. `build-app.sh`, the running JARVIS, and the `.app` bundle continue to load the unmodified deployed file. Risk = zero.

**Phase 2 — Browser-load the prototype.** Open `prototypes/jarvis-shrine-uplift.html` directly in Chrome or Safari (self-contained — `TEL` simulates telemetry without needing the daemon). Verify in browser:
- All 9 reactor sub-changes (R1-R9) render
- Vitality engine modulates everything correctly across REST → ACTIVE → STRESS bands (force-test via DevTools console: `STATE.vitality = 0.85`)
- Asymmetric breathing visibly different from current symmetric sin
- Edge sparkles + distant data ticks fire (visible after ~10-30s)
- 60fps holds (Chrome DevTools Performance tab — 10s recording, no frame drops)
- Trigger pill restyle works
- Wake exhale runs when `runWakeExhale()` is called from console

**Phase 3 — Visual capture & A/B comparison.** Capture matched stills via Chrome MCP / `screencapture`:
- 1 frame at REST (force `STATE.vitality = 0.15`)
- 1 frame at ACTIVE (force `STATE.vitality = 0.45`)
- 1 frame at STRESS (force `STATE.vitality = 0.85`)
- Same three for the current deployed file (control)

Save as `prototypes/comparison-rest.png`, `comparison-active.png`, `comparison-stress.png`. **User reviews these before Phase 4.**

**Phase 4 — Live test under daemon.** Once user approves visuals: temporarily symlink `jarvis-full-animation.html → prototypes/jarvis-shrine-uplift.html`, run `./build-app.sh && ./start-jarvis.sh`. Observe live behavior with real telemetry for 5+ minutes. Vary load to traverse all three vitality bands (idle → `yes > /dev/null` for STRESS). Verify wake exhale by sleeping/waking the laptop. Verify deep-sleep entry/exit.

**Phase 5 — Promote to deployed.** Only after Phase 4 passes: copy prototype contents over `jarvis-full-animation.html`, delete `prototypes/jarvis-shrine-uplift.html`, commit. Single atomic promotion. `git revert <promotion-commit>` is the rollback.

**Existing test surface:**
- `scripts/promo-video/tests/` (pytest) — re-run, must still pass
- `JarvisTelemetry/Tests/` (Swift) — re-run, must still pass
- `mactop/internal/app/...` (Go) — untouched, but re-run `make test` for safety
- Visual capture diffs — manual approval gate (subjective by nature)

---

## 9. Open Questions / Deferred

### Resolved during brainstorming
- **HTML mirror at `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html`** → delete in this work. Already 425+ lines stale, never loaded by deployed app.
- **Swift edits allowed** → yes, ~20 LOC for wake-exhale observer.
- **Symmetric vs asymmetric R7 callouts** → asymmetric (30°/150°/210°/330°), more cinematic.
- **Reactor "2" digit replaceable** → yes, replaced by triangular palladium glyph.
- **Vitality weights** → 40/30/20/10 across cpu/thermal/power/gpu accepted.
- **Deep-sleep timeout** → 300s accepted.

### Deferred to implementation tuning (cannot be planned, only iterated visually)
- Exact disc layer alphas, blur radii, and inter-layer rotation deltas in R1.
- Triangle glyph stroke vs fill ratio in R2.
- Lens flare width / horizontal stretch ratio in R3 (typical anamorphic ~5:1).
- God-ray fan angles and per-ray jitter in R4.
- Coil tick angular variance in R5.
- R7 callout box width, leader-line stroke weight.
- Edge sparkle color exact tuning.
- Warm hearth undertone gradient stop positions.

These are visual-tuning parameters that need to be eyeballed during Phase 2-3, not pre-decided.

### Out of scope (deferred to future work)
- Swift native HUD (`JarvisHUDView.swift`) parity — separate workstream if/when WebView path is replaced.
- WebGL upgrade for the reactor core — Tier B from the 2026-04-13 ideation, evaluated separately if Canvas 2D approximation ever feels insufficient after this lands.
- Integration with the promo-video pipeline (`scripts/promo-video/`) — automatic, since the deployed HUD is what the pipeline captures.
- New external assets, font loads, or library imports — explicitly forbidden.

---

## 10. Done Definition

This work is **done** when:

1. ✅ `prototypes/jarvis-shrine-uplift.html` exists and renders all 9 reactor sub-changes + vitality engine + 5-component bundle.
2. ✅ Phase 3 A/B comparison stills captured at REST / ACTIVE / STRESS for both deployed and prototype.
3. ✅ User has explicitly approved the visual A/B comparison.
4. ✅ Phase 4 live test under daemon shows no regressions across 5+ minutes of varied load.
5. ✅ Phase 5 atomic promotion commit lands; prototype file deleted; stale `jarvis-reactor.html` mirror deleted.
6. ✅ All existing tests still pass (`scripts/promo-video/tests/`, `JarvisTelemetry/Tests/`, `make test` in `mactop/`).
7. ✅ Single deploy-ready commit on the working branch with clear rollback path.

If any of (1)-(7) fail, the deployed file is not promoted. The prototype stays prototype until issues are resolved.
