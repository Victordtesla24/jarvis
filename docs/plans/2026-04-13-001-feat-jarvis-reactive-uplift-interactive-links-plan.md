---
title: "feat: JARVIS Reactive Uplift — Tier 2 Animations + Boot/Shutdown + Interactive Links"
type: feat
status: active
date: 2026-04-13
origin: docs/brainstorms/2026-04-13-jarvis-reactive-uplift-interactive-links-requirements.md
---

# feat: JARVIS Reactive Uplift — Tier 2 Animations + Boot/Shutdown + Interactive Links

## Overview

Extend the JARVIS HUD with seven new telemetry-driven canvas animations (DRAM BW, Network I/O, ANE power, GPU frequency, swap pressure, DVHOP shadow, GUMER particles), cinematic boot/shutdown sequences that read live chip topology, and a WKWebView-based interactive link layer using a custom `jarvis://` URL scheme. The Swift hotkey overlay (R15–R17) is deferred per scope boundaries.

**Architecture boundary:** Tier 2 animations (R1–R7) and boot/shutdown (R8–R10) touch `JarvisTelemetry/`. Interactive links (R11–R14) touch `JarvisWallpaper/`. The two SPM packages are independent; changes do not cross the boundary.

(see origin: `docs/brainstorms/2026-04-13-jarvis-reactive-uplift-interactive-links-requirements.md`)

---

## Requirements Trace

| ID | Requirement | Unit |
|----|-------------|------|
| R1 | DRAM BW radial pulse waves from reactor centre, chip-tier BW ceiling | 1, 2, 3, 4 |
| R2 | Network I/O dot stream along outer ring perimeter (~100 MB/s normalisation) | 3, 4 |
| R3 | ANE power arc at 0.68R (new slot between Ring 2 @ 0.78R and Ring 3 @ 0.62R) | 3, 4 |
| R4 | GPU frequency tick brightness on Ring 5 ticks at 0.35R (24 ticks every 15°), normalised against gpuFreqMaxMHz | 1, 2, 3, 4 |
| R5 | Swap pressure hex-grid overlay, active when swapPressure > 0.05 | 3, 4 |
| R6 | DVHOP shadow ring at 0.95R, additional draw pass on Ring 1 geometry | 3, 4 |
| R7 | GUMER particle burst from GPU arc zone, gumerCell birthRate ∝ gumerMBs | 5 |
| R8 | Boot text reads live chipName/eCoreCount/pCoreCount/sCoreCount from TelemetryStore (note: already largely implemented — guard against "Apple Silicon" default needed) | 6 |
| R9 | Arc clusters materialise in staggered order: E-Core → P-Core → GPU arc → remaining rings, ~200ms per cluster | 6 |
| R10 | Shutdown rings decelerate 5→4→3→2→1, each 400ms, core pulse fades last | 7 |
| R11 | jarvis:// links on "Documents", "Weather", "Clock", "MPC", panel data labels in jarvis-reactor.html | 8 |
| R12 | WKURLSchemeHandler intercepts jarvis:// and dispatches NSWorkspace.shared.open; silent failure on missing app | 8 |
| R13 | Static dim bracket [ ] at 20% opacity always visible; brightens within 50ms of jarvis:// navigation fire | 8 |
| R14 | No external JS dependencies — plain DOM events and window.location assignment | 8 |

---

## Decisions

**D1 — Chip-tier BW ceiling is derived at startup from memoryTotalGB**
`memoryTotalGB <= 32` → 50 GB/s; `> 32–64` → 200 GB/s; `> 64` → 400 GB/s. These thresholds live in `JARVISNominalState.swift`. The ceiling is read once and stored as a non-`@Published` constant on `TelemetryStore` alongside `gpuFreqMaxMHz`.

**D2 — gpuFreqMaxMHz pipeline: Go emits once, Swift receives once**
`GetMaxGPUFrequency()` already exists at `mactop/internal/app/native_stats.go:1316` and is already called in `collectHeadlessData()`. The value is currently used for TFLOP calculation only; it must also be emitted in `HeadlessOutput` as `max_gpu_freq_mhz`. **Two distinct changes are required in `headless.go`:** (1) add `MaxGPUFreqMHz float64` field to the `HeadlessOutput` struct, AND (2) assign `output.MaxGPUFreqMHz = float64(maxGPUFreq)` in `collectHeadlessData()` — the local variable `maxGPUFreq` is already populated at line ~515 but never written to the output struct. Swift reads it once into a non-Published property. Fallback: `max(rawValue, 1000.0)` prevents division-by-zero. (see origin: Dependencies)

**D3 — Tier 2 animation state lives in ReactorAnimationController, not JarvisHUDView**
New `@Published` properties follow the existing `lastFiredAt` debounce pattern from the Tier 1 implementation. Canvas draws read from environment objects — no new bindings thread through the view hierarchy.

**D4 — 0.68R slot is confirmed empty**
Draw-order audit of `JarvisHUDView.swift` confirms the slot between Ring 3 P-core arcs (0.62–0.65R) and Ring 2 GPU arc (0.84R) is unoccupied. ANE arc insertion is after line 931 (end of Ring 3 P-core arcs block).

**D5 — WKWebView requires hitTest override for click-passthrough**
Setting `win.ignoresMouseEvents = false` at `JarvisWallpaper/Sources/JarvisWallpaper/main.swift:90` without additional work causes WKWebView to swallow all desktop mouse events. A custom `PassthroughWebView: WKWebView` subclass overrides `hitTest(_:with:)` to return `nil` (passthrough) for non-link regions and `self` for link regions. Link regions are identified by querying JS `document.elementFromPoint` or by CSS pointer-events.

**D6 — Dual SIGTERM handler race is fixed by removing AppDelegate's handler**
`AppDelegate.makeSignalSource()` (`AppDelegate.swift:44–57`) installs a `DispatchSource` for SIGTERM that calls `NSApp.terminate(nil)` synchronously, racing with and typically beating `ProcessLifecycleObserver.setupSignalHandlers()` which posts `.jarvisGracefulShutdown`. The fix is to remove `makeSignalSource()` entirely from `JarvisTelemetry`'s `AppDelegate`. `ProcessLifecycleObserver` becomes the sole SIGTERM owner. **Note:** `JarvisWallpaper`'s `AppDelegate` (`JarvisWallpaper/Sources/JarvisWallpaper/main.swift` lines 47–54) is a **separate file** in a separate SPM package and must **not** be modified — its SIGTERM handler is intentional and correct for the wallpaper process.

**D7 — R9 stagger state is local @State in BootSequenceView, not HUDPhaseController**
Stagger is deterministic from `bootProgress` (HUDPhaseController scalar 0→1). A local `@State var clusterProgress: [Int: Double]` array in `BootReactorRings` maps cluster index to local progress, computed from `bootProgress` thresholds. No async timers; purely reactive.

**D8 — R10 uses explicit per-ring timeout offsets, not momentum physics**
Total budget 5.0s (`JARVISNominalState.shutdownDuration`). Ring 5 starts dimming at t=0.0s, Ring 4 at t=0.4s, Ring 3 at t=0.8s, Ring 2 at t=1.2s, Ring 1 at t=1.6s; each ring fades over 400ms. Core pulse starts fade at t=2.0s, completes at t=4.0s. Existing `ShutdownRings` momentum physics are replaced with explicit `phaseProgress`-gated opacity per ring. Constant offsets added to `JARVISNominalState`.

**D9 — WKURLSchemeHandler over WKNavigationDelegate**
`WKURLSchemeHandler` is the correct API for custom schemes registered via `config.setURLSchemeHandler(handler, forURLScheme: "jarvis")`. The registered handler intercepts `jarvis://` navigations before `WKNavigationDelegate` sees them, so bracket brightening feedback must be triggered from `JarvisSchemeHandler.webView(_:start:)` on the main thread (via `DispatchQueue.main.async { /* post JS to flash bracket */ }`), **not** from `WKNavigationDelegate`. The handler dispatches `NSWorkspace.shared.open`; failures are logged to `os.Logger` with subsystem `"com.jarvis.wallpaper"` and silently suppressed from UI.

**D10 — R8 chip name is already implemented; scope reduces to a guard**
`BootDiagnosticStream` in `BootSequenceView.swift:752` already reads `store.chipName`, `store.eCoreCount`, `store.pCoreCount`, `store.sCoreCount`, `store.gpuCoreCount`. Unit 6 only needs to add a guard: if `store.chipName == "Apple Silicon"` (the TelemetryStore default before daemon data arrives), defer text reveal until chipName is populated.

---

## Existing Patterns to Follow

- **bloomArc helper** (`JarvisHUDView.swift:664`): `func bloomArc(_ r: Double, _ startAngle: Double, _ sweep: Double, _ col: Color, _ w: Double)` — all arc draws use this
- **Ring draw pattern**: `Path { p in p.addArc(center: c, radius: R * factor, ...) }` then `ctx.stroke(path, with: .color(...), style: StrokeStyle(lineWidth: ..., lineCap: .round))`
- **ReactorAnimationController @Published debounce**: check `Date().timeIntervalSince(lastFiredAt[key] ?? .distantPast) > debounceInterval` before `withAnimation(.spring()) { property = newValue }`, then set `lastFiredAt[key] = Date()`
- **Canvas environment object access**: `@Environment(\.animationPhase) var phase` — all new canvas effects read phase for time-based animation without adding new state
- **CAEmitterCell pattern**: `ReactorParticleEmitter.swift` — `makeCell(name:contents:)` factory, `birthRate` set in `updateReactiveState`
- **BootSequenceView threshold tuples**: `(text: String, color: Color, threshold: Double)` at lines 766–779 — stagger thresholds follow same pattern
- **JARVISNominalState constants**: all timing constants, radii, and thresholds are defined here first, then referenced by name

---

## Implementation Units

### Unit 1 — Go daemon: emit gpuFreqMaxMHz in headless JSON

**Files:**
- `mactop/internal/app/headless.go`

**Changes:**
1. Add `MaxGPUFreqMHz float64` field to `HeadlessOutput` struct (line ~98) with JSON tag `"max_gpu_freq_mhz,omitempty"`
2. In `collectHeadlessData()` (line ~452), after the existing call to `GetMaxGPUFrequency()` (line ~515), assign the result to `output.MaxGPUFreqMHz`

**Constraints:**
- `omitempty` is acceptable — zero means "not available"; Swift handles fallback
- No new CGO calls; `GetMaxGPUFrequency()` already exists
- `make test` must pass after change

**Test scenarios:**
- T1.1: `go test ./internal/app/...` — verify `HeadlessOutput` JSON includes `"max_gpu_freq_mhz"` key when the function returns a nonzero value
- T1.2: On M3/M4/M5 hardware, verify the emitted value is ≥ 1000 (MHz) and matches what IORegistry reports for `voltage-states9`

---

### Unit 2 — TelemetryStore + TelemetryBridge + JARVISNominalState: Tier 2 constants and gpuFreqMaxMHz

**Files:**
- `JarvisTelemetry/Sources/JarvisTelemetry/JARVISNominalState.swift`
- `JarvisTelemetry/Sources/JarvisTelemetry/TelemetryBridge.swift`
- `JarvisTelemetry/Sources/JarvisTelemetry/TelemetryStore.swift`

**Changes:**

*JARVISNominalState.swift* — add constants block for Tier 2 and shutdown:
```
// Tier 2 reactive ceilings
static let dramBWCeilingSmall:  Double = 50.0     // GB/s for ≤32 GB unified memory
static let dramBWCeilingMid:    Double = 200.0    // GB/s for >32–64 GB unified memory
static let dramBWCeilingLarge:  Double = 400.0    // GB/s for >64 GB unified memory
static let networkBWCeiling:    Double = 100      // MB/s
static let anePowerCeiling:     Double = 20.0     // W
static let swapPressureFloor:   Double = 0.05     // activation threshold

// Shutdown stagger offsets (seconds, relative to shutdownStartTime)
static let shutdownRing5Start:  Double = 0.0
static let shutdownRing4Start:  Double = 0.4
static let shutdownRing3Start:  Double = 0.8
static let shutdownRing2Start:  Double = 1.2
static let shutdownRing1Start:  Double = 1.6
static let shutdownCoreFadeStart: Double = 2.0
static let shutdownRingFadeDur: Double = 0.4
static let shutdownCoreFadeDur: Double = 2.0

// Boot stagger thresholds (bootProgress scalar 0→1)
static let bootClusterECore:    Double = 0.25
static let bootClusterPCore:    Double = 0.45
static let bootClusterGPUArc:   Double = 0.60
static let bootClusterRings:    Double = 0.75
```

*TelemetryBridge.swift* — add `maxGPUFreqMHz: Double` to `TelemetrySnapshot` (the **top-level** struct) with `CodingKey = "max_gpu_freq_mhz"` and default `0.0`. **Do not** add it to `SocMetrics` — the Go daemon emits `max_gpu_freq_mhz` at the `HeadlessOutput` top level, not nested under `soc_metrics`.

*TelemetryStore.swift*:
- Add non-Published `var gpuFreqMaxMHz: Double = 1000.0` (fallback is 1000 MHz, not 0)
- Add non-Published `var dramBWCeilingGBs: Double = 200.0` (default to mid-tier before first snapshot; use a `hasSetBWCeiling: Bool = false` guard to prevent re-setting after first live receipt), computed from `memoryTotalGB` at first data receipt using `JARVISNominalState` tier thresholds
- In the metrics update path, on first receipt of `maxGPUFreqMHz > 0`, set `gpuFreqMaxMHz = max(metrics.maxGPUFreqMHz, 1000.0)`

**Test scenarios:**
- T2.1: With a stubbed `SocMetrics` where `maxGPUFreqMHz = 0`, verify `TelemetryStore.gpuFreqMaxMHz` stays at 1000.0 (fallback guard)
- T2.2: With `maxGPUFreqMHz = 2050`, verify `TelemetryStore.gpuFreqMaxMHz = 2050.0`
- T2.3: With `memoryTotalGB = 24`, verify `dramBWCeilingGBs = 50.0`
- T2.4: With `memoryTotalGB = 48`, verify `dramBWCeilingGBs = 200.0`

---

### Unit 3 — ReactorAnimationController: Tier 2 reactive state

**Files:**
- `JarvisTelemetry/Sources/JarvisTelemetry/ReactorAnimationController.swift`

**Changes:**
Add 6 new `@Published` properties following the existing debounce pattern:

```swift
@Published var dramPulseIntensity: Double = 0       // R1 — 0–1 normalised to chip BW ceiling
@Published var networkDotPhase: Double = 0          // R2 — accumulates at speed ∝ networkMBs
@Published var aneFillFraction: Double = 0          // R3 — 0–1 against 20W ceiling
@Published var gpuFreqFraction: Double = 0          // R4 — 0–1 against gpuFreqMaxMHz
@Published var hexGridOpacity: Double = 0           // R5 — 0–1 scaled from swapPressure
@Published var dvhopGhostOpacity: Double = 0        // R6 — 0–30% scaled from dvhopCPUPct
```

In `reactToTelemetry()`:
- `dramPulseIntensity`: `(store.dramReadBW + store.dramWriteBW) / store.dramBWCeilingGBs`, clamped 0–1
- `networkDotPhase`: accumulates `+= netFrac * 0.02` each tick (wraps at 1.0), where `netFrac = ((store.netInBytesPerSec ?? 0) + (store.netOutBytesPerSec ?? 0)) / (JARVISNominalState.networkBWCeiling * 1_000_000)` (note: `netInBytesPerSec`/`netOutBytesPerSec` are `Double?` in bytes/sec; `networkBWCeiling` is 100 MB/s = 100×10⁶ bytes/sec)
- `aneFillFraction`: `store.anePower / JARVISNominalState.anePowerCeiling`, clamped 0–1
- `gpuFreqFraction`: `store.gpuFreqMHz / store.gpuFreqMaxMHz`, clamped 0–1
- `hexGridOpacity`: `store.swapPressure > JARVISNominalState.swapPressureFloor ? store.swapPressure : 0`, clamped 0–1
- `dvhopGhostOpacity`: `min(store.dvhopCPUPct / 100.0 * 0.30, 0.30)` — max 30% opacity

GUMER is handled by ReactorParticleEmitter directly (Unit 5) — no new property needed here.

**Test scenarios:**
- T3.1: With `dramReadBW = 25.0 GB/s, dramWriteBW = 25.0 GB/s, dramBWCeilingGBs = 50.0`, verify `dramPulseIntensity = 1.0`
- T3.2: With `swapPressure = 0.03`, verify `hexGridOpacity = 0` (below floor)
- T3.3: With `swapPressure = 0.40`, verify `hexGridOpacity = 0.40`
- T3.4: With `dvhopCPUPct = 50`, verify `dvhopGhostOpacity = 0.15`
- T3.5: With `gpuFreqMHz = 1200, gpuFreqMaxMHz = 2400`, verify `gpuFreqFraction = 0.5`

---

### Unit 4 — JarvisHUDView: Tier 2 Canvas draws

**Files:**
- `JarvisTelemetry/Sources/JarvisTelemetry/JarvisHUDView.swift`

**Draw insertion points** (all use existing `ctx`, `c`, `R` locals; reference `@EnvironmentObject var reactorController`):

**R6 — DVHOP shadow ring** (after ghost trails block, line ~848, before Ring 1):
```
if reactorController.dvhopGhostOpacity > 0 {
    // Additional draw pass on Ring 1 geometry at 0.95R, cyan at scaled opacity
    // 48 segments, same arc geometry as Ring 1, opacity = dvhopGhostOpacity
    // Draw BEFORE Ring 1 so it reads as a ghost layer beneath
}
```

**R5 — Swap pressure hex-grid** (after interior fill + stars, before ghost trails, line ~795; `hexGridOpacity` is the `ReactorAnimationController` property added in Unit 3):
```
if reactorController.hexGridOpacity > 0 {
    // 8×6 hex grid over a 0.65R×0.65R screen zone centred on reactor
    // Each hex: 12pt radius, stroke at hexGridOpacity * 0.15 alpha, cyan colour
    // Zone: CGRect centered at c, side = R * 0.65
}
```

**R3 — ANE arc at 0.68R** (after Ring 3 P-core arcs, before Ring 2 GPU arc, after line 931):
```
// bloomArc(R * 0.68, startAngle, sweep, cyan, 2.0)
// sweep = aneFillFraction * 2π (full circle at ANE = 20W)
// Glow: secondary bloomArc same params, lineWidth 4.0, opacity * 0.3
```

**R4 — GPU freq tick brightness** (Ring 5 ticks at `ring5R = R * 0.35`, 24 ticks every 15°, drawn at line ~961):
```
// Ring 5 ticks get opacity multiplier: 0.3 + gpuFreqFraction * 0.7
// Range: 0.3 (idle, dim) → 1.0 (max GPU freq, fully bright)
// Prototype visual in jarvis-reactor.html first to confirm the effect reads
// clearly at 0.35R before touching JarvisHUDView.swift Ring 5 draw block
```

**R2 — Network dots along outer ring perimeter** (after battery ring, before arc text, line ~1064):
```
// 12 dots equally spaced on ring at 1.02R
// Each dot's angle offset by networkDotPhase * 2π
// Dot size: 3pt; opacity: 0.6 + 0.4 * sin(dotIndex * π / 6)
// Colour: cyan at 0.8 alpha
```

**R1 — DRAM BW radial pulse waves** (after network dots, before arc text):
```
// 3 concentric pulse rings at R * (0.10 + waveIndex * 0.08) for waveIndex 0,1,2
// Each offset by phase * 0.2 * (1 + dramPulseIntensity)
// Radius expands outward: currentR = baseR + (dramPulseIntensity * R * 0.15 * waveOffset)
// Opacity: dramPulseIntensity * 0.4 * (1 - waveIndex * 0.25)
// Colour: cyan
// Skipped entirely when dramPulseIntensity < 0.05
```

All new canvas draws follow the existing pattern: `Path { p in ... }` → `ctx.stroke(...)` or `ctx.fill(...)`. No new view structs. No new `@State`.

**Test scenarios:**
- T4.1: With `aneFillFraction = 0.5`, verify ANE arc sweeps exactly π radians (180°) from start angle
- T4.2: With `hexGridOpacity = 0`, verify hex-grid draw block is skipped entirely (guard check)
- T4.3: With `dvhopGhostOpacity = 0`, verify shadow ring draw block is skipped entirely
- T4.4: With `gpuFreqFraction = 1.0`, verify Ring 5 tick opacity multiplier = 1.0 (fully bright) at `ring5R = R * 0.35`
- T4.5: With `gpuFreqFraction = 0.0`, verify Ring 5 tick opacity multiplier = 0.3 (dim baseline) at `ring5R = R * 0.35`
- T4.6: Visual smoke test — launch app with daemon, confirm 6 new effects visible at varying telemetry levels

---

### Unit 5 — ReactorParticleEmitter: gumerCell for R7 GUMER burst

**Files:**
- `JarvisTelemetry/Sources/JarvisTelemetry/ReactorParticleEmitter.swift`

**Changes:**
1. Add `gumerCell: CAEmitterCell` property alongside existing `mainCell` and `flareCell`
2. In `makeGumerCell()` factory (new private method):
   - `contents`: same cyan particle image as mainCell
   - `birthRate = 0` (starts dormant)
   - `lifetime = 0.8`, `lifetimeRange = 0.3`
   - `velocity = 80`, `velocityRange = 40`
   - `emissionRange = Float.pi / 4` (burst cone from GPU arc zone ~330°)
   - `scale = 0.04`, `scaleRange = 0.02`
   - `color`: CGColor cyan with alpha 0.7
3. In `updateReactiveState(load:flare:powerFlow:densityMul:gumerMBs:)` (add `gumerMBs: Double` parameter):
   - `gumerCell.birthRate = Float(min(gumerMBs / 50.0, 1.0) * 60.0)` when `gumerMBs > 10`
   - `gumerCell.birthRate = 0` when `gumerMBs <= 10`
4. Update the existing call site in `JarvisHUDView.swift` (the `reactorController.updateReactiveState(load:flare:powerFlow:densityMul:)` call) to include the new `gumerMBs: store.gumerMBs` parameter

**Test scenarios:**
- T5.1: With `gumerMBs = 0`, verify `gumerCell.birthRate == 0`
- T5.2: With `gumerMBs = 50`, verify `gumerCell.birthRate == 60`
- T5.3: With `gumerMBs = 200` (>50), verify `gumerCell.birthRate` is capped at 60 (ceiling = 100% * 60)
- T5.4: Visual check — under GPU memory pressure, a cyan burst emits from ~330° zone

---

### Unit 6 — BootSequenceView: R9 cluster stagger + R8 chipName guard

**Files:**
- `JarvisTelemetry/Sources/JarvisTelemetry/BootSequenceView.swift`

**R8 guard** (at `BootDiagnosticStream`, line ~752):
`BootSequenceView.swift` lines 757–759 already contains an `"Apple Silicon"` guard that shows `"APPLE M4 MAX"` as a hardcoded fallback. The scope of Unit 6 is to: (1) replace the hardcoded `"APPLE M4 MAX"` fallback string with a dynamic `"CHIP: READING..."` placeholder, and (2) extract the `"Apple Silicon"` sentinel string to a named constant in `JARVISNominalState` (e.g., `chipNameDefault`). Observe `store.$chipName` with `.onChange` to trigger a re-reveal when the real name arrives.

**R9 cluster stagger** (in `BootReactorRings`, line ~406):
Current implementation: `ringProgress * 220` rings drawn uniformly from `bootProgress`.
`bootProgress` is **already threaded through** as the `progress: Double` `let` parameter (confirmed: `BootReactorRings(progress: p, phase: phase, cx: cx, cy: cy, R: R, ...)` at line ~109). No architectural change to the call site; all cluster logic is purely computed from the existing `progress` parameter.

Replace with cluster-gated draw:
```swift
// Local computed clusters from bootProgress
let eCoreVisible   = bootProgress >= JARVISNominalState.bootClusterECore
let pCoreVisible   = bootProgress >= JARVISNominalState.bootClusterPCore
let gpuArcVisible  = bootProgress >= JARVISNominalState.bootClusterGPUArc
let ringsVisible   = bootProgress >= JARVISNominalState.bootClusterRings

// E-Core arcs materialise first (bootProgress threshold 0.25)
// P-Core arcs materialise second (threshold 0.45)
// GPU arc materialises third (threshold 0.60)
// Remaining structural rings materialise last (threshold 0.75)
// Each cluster's local progress = (bootProgress - threshold) / 0.20, clamped 0–1
```

Each cluster draws its arc geometry with opacity = `clusterLocalProgress` (fade-in).

**Note:** R9 stagger applies only to `fullBoot` path — `bootDurationFull = 8.0s`. The wake path (`bootDurationWake = 3.5s`) skips stagger and uses uniform reveal.

**Test scenarios:**
- T6.1: At `bootProgress = 0.20`, verify no arcs visible (all clusters below threshold)
- T6.2: At `bootProgress = 0.30`, verify E-Core arcs at `(0.30 - 0.25) / 0.20 = 0.25` opacity
- T6.3: At `bootProgress = 0.50`, verify P-Core arcs at `(0.50 - 0.45) / 0.20 = 0.25`, E-Core at full opacity
- T6.4: At `bootProgress = 1.0`, verify all clusters at full opacity
- T6.5: With `store.chipName = "Apple Silicon"`, verify boot text shows "CHIP: READING..." placeholder
- T6.6: When `store.chipName` updates to "Apple M4 Pro", verify boot text reveals chip line

---

### Unit 7 — Shutdown: fix dual SIGTERM handler + R10 per-ring deceleration

**Files:**
- `JarvisTelemetry/Sources/JarvisTelemetry/AppDelegate.swift`
- `JarvisTelemetry/Sources/JarvisTelemetry/ShutdownSequenceView.swift`
- `JarvisTelemetry/Sources/JarvisTelemetry/JARVISNominalState.swift` (already updated in Unit 2)

**Fix dual SIGTERM handler** (`AppDelegate.swift`):
- Remove `makeSignalSource()` function entirely (lines 44–57)
- Remove the call to `makeSignalSource()` from `applicationDidFinishLaunching`
- `ProcessLifecycleObserver.setupSignalHandlers()` becomes the sole SIGTERM handler; it posts `.jarvisGracefulShutdown` and defers `NSApp.terminate(nil)` by `shutdownDuration + 1.0s`
- **Phase guard** (`ProcessLifecycleObserver.swift`): add `guard phaseController.phase == .loop else { return }` before calling `phaseController.startShutdown()` — this guard does **not** currently exist; adding it prevents SIGTERM during boot from triggering the shutdown animation prematurely

**R10 per-ring deceleration** (`ShutdownSequenceView.swift`):
Replace the existing momentum-physics 16-ring implementation in `ShutdownRings` with explicit `phaseProgress`-gated opacity:

```swift
// phaseProgress = elapsed since shutdown start / shutdownDuration
let ringConfigs: [(startOffset: Double, radius: Double)] = [
    (JARVISNominalState.shutdownRing5Start, 0.35),  // Ring 5
    (JARVISNominalState.shutdownRing4Start, 0.48),  // Ring 4
    (JARVISNominalState.shutdownRing3Start, 0.62),  // Ring 3
    (JARVISNominalState.shutdownRing2Start, 0.78),  // Ring 2
    (JARVISNominalState.shutdownRing1Start, 0.95),  // Ring 1
]
// Each ring's opacity: 1.0 - clamp((elapsed - startOffset) / fadeDur, 0, 1)
// Core pulse: separate fade, starts at shutdownCoreFadeStart, duration shutdownCoreFadeDur
```

**Test scenarios:**
- T7.1: Send SIGTERM to running JarvisTelemetry process; verify shutdown animation plays (rings fade in order 5→1) before app exits
- T7.2: At 1.0s after shutdown start, verify Ring 5 fully faded, Ring 4 partially faded, Rings 3–1 still visible
- T7.3: At 2.0s after shutdown start, verify Rings 5 and 4 fully faded, Ring 3 partially faded
- T7.4: Verify app does NOT exit until `shutdownDuration + 1.0s` after SIGTERM (ProcessLifecycleObserver delay)
- T7.5: Verify no double-terminate race condition (AppDelegate's SIGTERM handler removed)

---

### Unit 8 — WKWebView interactive links (R11–R14)

**Files:**
- `JarvisWallpaper/Sources/JarvisWallpaper/main.swift`
- `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html`
- `JarvisWallpaper/Sources/JarvisWallpaper/PassthroughWebView.swift` (new)
- `JarvisWallpaper/Sources/JarvisWallpaper/JarvisSchemeHandler.swift` (new)

**PassthroughWebView.swift** (new file):
```swift
// Custom WKWebView subclass
// Stores a Swift-side [CGRect] of link hit regions, populated once after
// DOM load via a single evaluateJavaScript call that reads
// document.querySelectorAll('.hud-link') bounding rects.
// hitTest(_:with:): purely synchronous CGRect.contains check
//   → return nil (passthrough) if point is not inside any link region
//   → return self if point is inside a link region
// This avoids async JS evaluation in hitTest and allows desktop mouse
// events to fall through on all non-link areas of the wallpaper.
// linkRegions is refreshed on WKNavigationDelegate.didFinish.
```

**JarvisSchemeHandler.swift** (new file, implements `WKURLSchemeHandler`):
```swift
// webView(_:start:) intercepts jarvis:// URLs
// Dispatch table:
//   jarvis://documents → NSWorkspace.shared.openApplication(.finder, nil)
//   jarvis://weather   → NSWorkspace.shared.open(URL("weather://")!) or Weather.app bundle
//   jarvis://clock     → NSWorkspace.shared.open(URL("clock://")!) or System Preferences
//   jarvis://mpc       → NSWorkspace.shared.openApplication(.musicApp, nil) or custom MPC
// IMPORTANT: WKURLSchemeHandler.webView(_:start:) is called on a background thread
// All NSWorkspace.shared.open calls must be dispatched to DispatchQueue.main
// Failure: os.Logger("com.jarvis.wallpaper").error("jarvis:// open failed: \(url)")
// No blocking UI. webView(_:stop:) is a no-op.
```

**main.swift changes** (3 atomic changes per requirements doc):
1. Line 90: `win.ignoresMouseEvents = false` (was `true`)
2. At line 97 (between `let config = WKWebViewConfiguration()` at line 94 and `WKWebView(frame:configuration:)` at line 99): add `config.setURLSchemeHandler(JarvisSchemeHandler(), forURLScheme: "jarvis")` — **must be called before the WKWebView is created**
3. Replace `WKWebView(frame:configuration:)` with `PassthroughWebView(frame:configuration:)`
4. Bracket flash feedback is delivered from `JarvisSchemeHandler.webView(_:start:)` on the main thread (see D9) — **no** `WKNavigationDelegate` conformance needed on `AppDelegate` for this purpose

**jarvis-reactor.html changes**:
- Wrap existing "Documents", "Weather", "Clock", "MPC" text nodes in `<a href="jarvis://documents">`, `<a href="jarvis://weather">`, etc.
- Add CSS class `.hud-link` with `pointer-events: auto` and the static bracket affordance:
  ```css
  .hud-link::before { content: "[ "; opacity: 0.20; }
  .hud-link::after  { content: " ]"; opacity: 0.20; }
  .hud-link.activated::before,
  .hud-link.activated::after { opacity: 0.80; transition: opacity 0.05s; }
  ```
- JS click handler: `document.querySelectorAll('.hud-link').forEach(el => el.addEventListener('click', e => { e.preventDefault(); window.location.href = el.href; el.classList.add('activated'); setTimeout(() => el.classList.remove('activated'), 300); }))`
- No CDN dependencies; all inline

**Test scenarios:**
- T8.1: On macOS 14, click "Documents" label in wallpaper — Finder opens
- T8.2: On macOS 14, click "Weather" — system Weather app opens
- T8.3: On macOS 14, click "Clock" — Date & Time system panel or Clock widget opens
- T8.4: On macOS 14, click "MPC" — Music app opens (or configured MPC client)
- T8.5: Click on blank desktop area (no link) — click passes through to desktop; no app opens
- T8.6: With a non-installed app bundle, verify silent failure (no dialog, only console log)
- T8.7: After clicking a link, verify bracket [ ] brightens within 50ms and returns to 20% opacity within 350ms. The flash is driven by the HTML's own JS click handler (CSS class toggle on `.hud-link` before `window.location.href` assignment) — IPC round-trip from native scheme handler is <5ms and does not contribute to the 50ms budget
- T8.8: Verify HTML contains no `<script src="...">` external dependencies
- T8.9: `win.ignoresMouseEvents = false` is set; verify wallpaper window accepts mouse events

---

## Dependencies and Sequencing

```
Unit 1 (Go emit gpuFreqMaxMHz)
  → Unit 2 (TelemetryStore + TelemetryBridge receive gpuFreqMaxMHz + BW ceilings)
    → Unit 3 (ReactorAnimationController Tier 2 state)
      → Unit 4 (JarvisHUDView Tier 2 canvas draws)
      → Unit 5 (ReactorParticleEmitter gumerCell)
    → Unit 6 (BootSequenceView stagger — reads store directly)
    → Unit 7 (AppDelegate SIGTERM fix + ShutdownRings — reads JARVISNominalState)

Unit 8 (JarvisWallpaper WKWebView links) — fully independent; can ship in parallel
```

Units 1→2 are strictly sequential. Units 3→4, 3→5, 2→6, 2→7 can proceed in parallel once Unit 2 is complete. Unit 8 is fully independent throughout.

**Recommended ship order:**
1. Unit 8 (quick, standalone, early user value)
2. Units 1–2 in sequence
3. Units 3, 6, 7 in parallel
4. Units 4, 5 after Unit 3

---

## Risks

**R-1: ignoresMouseEvents=false breaks desktop interaction**
Mitigation: PassthroughWebView.hitTest override is required before setting ignoresMouseEvents=false. The two changes must land in the same commit. If hitTest override is not working, revert both atomically.

**R-2: gpuFreqMaxMHz returns 0 on some hardware or kernel states**
Mitigation: `max(rawValue, 1000.0)` guard in TelemetryStore. Worst case: GPU freq ticks dim to baseline 30% opacity (graceful degradation).

**R-3: SIGTERM fix causes regression in existing shutdown flow**
Mitigation: ProcessLifecycleObserver's `setupSignalHandlers()` already handles SIGTERM with the correct animation delay. Removing AppDelegate's makeSignalSource simplifies rather than changes the flow. Verify T7.1–T7.5 carefully.

**R-4: SIGTERM arrives during boot phase**
`ProcessLifecycleObserver.setupSignalHandlers()` currently unconditionally calls `self.phaseController.startShutdown()` with **no phase guard**. Unit 7 must add `guard phaseController.phase == .loop else { return }` in `ProcessLifecycleObserver` before calling `startShutdown()`. Once added, if SIGTERM fires during boot, `startShutdown()` no-ops and the app exits cleanly after `ProcessLifecycleObserver`'s terminate delay. This is accepted behaviour after the fix.

**R-5: Boot stagger makes boot feel slower on fast hardware**
Mitigation: The stagger is deterministic on `bootProgress` scalar, which is driven by a timer. The visual clusters appear within the same 8s window — stagger only affects the order of appearance, not the total boot duration.

**R-6: WKURLSchemeHandler `start` called on background thread**
`NSWorkspace.shared.open` must be dispatched to `DispatchQueue.main`. Handler must capture main dispatch.

---

## Scope Boundaries

Per requirements document:
- R15–R17 (Swift hotkey NSPanel overlay) — **deferred to separate task**
- No new external Swift Package dependencies
- No external JavaScript libraries in HTML path
- No live weather API calls — `jarvis://weather` opens system Weather app only
- No draggable/resizable overlay UI
- DVHOP shadow ring is an additional draw pass, not a new structural ring

---

## Success Criteria Verification

| SC | Verification |
|----|-------------|
| SC-1: All 7 Tier 2 effects visually distinct and continuously updating | T4.6 visual smoke test; instruments frame counter confirms 60fps |
| SC-2: Boot chip label reads live chipName/counts | T6.5 + T6.6 |
| SC-3: Shutdown rings decelerate 5→1 with visible speed reduction | T7.1 + T7.2 + T7.3 |
| SC-4: WKWebView links open correct apps on macOS 14 | T8.1–T8.4 |
| SC-6: 60fps under full CPU load | Instruments Time Profiler after Unit 4 merge |
