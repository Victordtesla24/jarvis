# §1 · Project Identity

**Title:** JARVIS Telemetry — Cinema-Grade macOS HUD: 6 Animation Panels + 3 Lifecycle Sequences
**Scope:** Build, harden, and validate all 6 animation panel components and all 3 lifecycle sequences (Boot → Loop → Shutdown) to production quality — 60fps sustained, zero implicit CALayer animations, all data from real Mach/IOKit/sysctl APIs.
**Platform:** macOS 14+ (Sonoma+), Apple Silicon ARM64 (M1/M2/M3/M4)
**Stack:** Swift 5.9+, SwiftUI Canvas + TimelineView, Metal (fragment shaders), Core Animation (explicit CABasicAnimation/CAKeyframeAnimation only), Go 1.21+ (telemetry daemon via NSPipe)
**Repository:** `/Users/vic/claude/General-Work/jarvis/jarvis-build`
**Mission:** Every animation primitive renders at 60fps, every lifecycle sequence completes its full timeline, every data source reads from real hardware APIs — validated until all 8 success criteria pass simultaneously.

---

# §2 · Requirements

## R-1: Six Animation Panel Components — Production Quality

Each panel component is an independent SwiftUI view composited over the main reactor canvas. All six MUST build, render, and animate correctly.

### R-1.1: CorePulseRingView (`CorePulseRingView.swift`)
- CALayer-based pulsing ring at reactor centre
- Scale animation: 1.0 → 1.6 → 1.0 via **explicit** `CASpringAnimation` (keyPath: `transform.scale`)
- Opacity animation: 1.0 → 0.0 → 1.0 via **explicit** `CAKeyframeAnimation` (keyPath: `opacity`)
- `isRemovedOnCompletion = false`, `repeatCount = .infinity` on all animations
- Ring border: #00D4FF cyan, 2pt width, 8px shadow radius, 0.6 shadow opacity
- Ring radius: `R × 0.09` where `R = min(width, height) × 0.42`

### R-1.2: RingRotationView (`RingRotationView.swift`)
- 5 concentric `CAShapeLayer` rings with independent `CABasicAnimation` rotation
- Ring specs (outermost → innermost):
  - Ring 1: R×0.95, 1.8pt, α=0.32, dash [12,6], 45s CW
  - Ring 2: R×0.82, 1.4pt, α=0.26, dash [8,4], 32s CCW
  - Ring 3: R×0.68, 1.4pt, α=0.24, dash [10,5], 22s CW
  - Ring 4: R×0.50, 1.2pt, α=0.20, dash [6,3], 18s CCW
  - Ring 5: R×0.35, 1.0pt, α=0.16, dash [4,2], 12s CW
- All rotations: explicit `CABasicAnimation(keyPath: "transform.rotation.z")`, `repeatCount = .infinity`, `isRemovedOnCompletion = false`, `.linear` timing
- Stroke color: #00D4FF at per-ring alpha

### R-1.3: ReactorParticleEmitter (`ReactorParticleEmitter.swift`)
- `CAEmitterLayer` centred on reactor core, `.point` shape, `.additive` render mode
- Cell spec: birthRate=12, lifetime=2.8s, velocity=140, velocityRange=60, emissionRange=2π, scale=0.04, scaleRange=0.008, alphaSpeed=-0.35
- Particle image: procedural CGImage — 200×200px glowing cyan disc (6-step radial glow + solid core + white-hot highlight)
- Emitter recentres on view resize via `recenter()` in `updateNSView`

### R-1.4: ScanLineMetalView (`ScanLineMetalView.swift`)
- Metal fragment shader renders a horizontal gradient band sweeping top→bottom over 3.5s, repeating
- Full-screen quad via 6-vertex triangle pair (no VBO)
- Band half-width: 0.003 normalised, max opacity 0.18, soft quadratic falloff
- `MTKView` at 60fps (`preferredFramesPerSecond = 60`, `isPaused = false`, `enableSetNeedsDisplay = false`)
- Transparent background (`clearColor = (0,0,0,0)`, `layer?.isOpaque = false`)
- Shader compiled inline at runtime — no `.metal` bundle resource
- Pre-multiplied alpha source-over blending

### R-1.5: JarvisLeftPanel (`JarvisLeftPanel.swift`)
- 4 widgets stacked vertically: Clock, Storage, PowerGauge, Communication
- **ClockWidget:** Real-time `TimelineView(.periodic(from: .now, by: 1.0))` — month/day (32pt bold), weekday (9pt tracked), HH:mm:ss (32pt mono)
- **StorageWidget:** Disk capacity from `FileManager.attributesOfFileSystem(forPath:)` using `.systemSize` and `.systemFreeSize` — total/free GB + progress bar
- **PowerGaugeWidget:** 270° circular arc gauge driven by `store.totalPower` (normalised against 60W max) — live watts display + LOW/MED/HIGH status
- **CommunicationWidget:** Rotating 30% arc trim at `phase × 60.0` degrees, hostname from `ProcessInfo.processInfo.hostName`
- All data sources: `TelemetryStore` via `@EnvironmentObject`, `FileManager`, `ProcessInfo` — real APIs only

### R-1.6: JarvisRightPanel (`JarvisRightPanel.swift`)
- 5 widgets: Directories, ArcReactorMini, AppShortcuts, SystemName, Weather
- **DirectoriesWidget:** 5 folder shortcuts (Documents, Downloads, Images, Music, Videos) — opens via `NSWorkspace.shared.open(url)`, paths from `FileManager.urls(for:in:)`
- **ArcReactorMiniWidget:** 8-segment arc notches (white, 3pt), inner glow ring pulsing at `phase × 1.5`, core dot at `phase × 2.0`, outer cyan border
- **AppShortcutsWidget:** 8 web app links — opened via `NSWorkspace.shared.open(url)`. `allowsHitTesting(true)` on panel
- **SystemNameWidget:** `NSUserName().uppercased()` + "'S SYSTEM" — real system API
- **WeatherWidget:** Real weather from wttr.in API (`URLSession.shared.data(from:)`), 600s refresh via `Timer.publish`, animated decorative bars at `phase × 1.2`

## R-2: Three Lifecycle Sequences — Full Timeline Completion

### R-2.1: Boot Sequence (`BootSequenceView.swift`)
- **Full boot:** 10.0s theatrical power-on driven by `HUDPhaseController.bootProgress` (0.0 → 1.0)
- **Wake boot:** 3.5s abbreviated re-ignition (`isWake: true`)
- Timeline stages: core ignition (0-15%) → triple shockwave (4-25%) → ring materialization (20-60%) → hardware enumeration text (35-55%) → panel slide-in (80-90%) → awareness pulse + "JARVIS ONLINE" (95-100%)
- All text overlays display **real hardware data** from `TelemetryStore`: chip name, core counts, memory size, GPU core count
- 60fps via `TimelineView(.animation(minimumInterval: 1.0/60.0))`
- Color palette: cyan (#00D4FF), bright cyan (#69F1F1), dim cyan (#008CB3), amber (#FFC800), crimson (#FF2633), steel (#668494)
- Transition to `.loop` phase on completion via `HUDPhaseController.transitionToLoop()`

### R-2.2: Main Loop (`JarvisHUDView.swift` via `AnimatedCanvasHost`)
- 60fps sustained rendering of 700+ vector paths via SwiftUI `Canvas` + `TimelineView(.animation)`
- 220+ concentric rings from R×0.02 to R×1.08
- Data-driven arcs: E-Core (cyan, R×0.84), P-Core (amber, R×0.74), S-Core (crimson, R×0.64), GPU (cyan, R×0.91) — all from `TelemetryStore` normalised values
- Three industrial bezels at R×0.94–1.08, R×0.855–0.895, R×0.75–0.78
- Corner brackets, top/bottom bars, central stats overlay
- Overlay layers: `CorePulseRingView`, `RingRotationView`, `ReactorParticleEmitter`, `ScanLineMetalView`, `JarvisLeftPanel`, `JarvisRightPanel`
- Animation phase propagated via `Environment(\.animationPhase)`

### R-2.3: Shutdown Sequence (`ShutdownSequenceView.swift`)
- 7.0s cinematic power-down driven by `HUDPhaseController.shutdownProgress` (0.0 → 1.0)
- Timeline stages: hex grid fade (0-50%) → scan lines fade (0-40%) → reactor bloom dimming (0-80%) → ring deceleration + fade → particle implosion toward core → core shrink + final flash → "JARVIS OFFLINE" text → pure black
- Ring deceleration: exponential decay `velocity *= 0.97` per frame, outer rings stop first
- Particle implosion: ambient particles reverse toward core, accelerate on approach, flash and vanish at <20px
- Transition to `.standby` phase + static wallpaper via `LockScreenManager.setStandbyWallpaper()`

## R-3: Explicit Animation Enforcement

### R-3.1: No Implicit CALayer Animations
- Every `CABasicAnimation`, `CASpringAnimation`, `CAKeyframeAnimation` MUST set:
  - `isRemovedOnCompletion = false`
  - Explicit `duration`
  - Explicit `fromValue` / `toValue` (or `values` for keyframe)
  - Explicit `repeatCount` (`.infinity` for looping)
  - Explicit `timingFunction` (`.linear`, `.easeInEaseOut`, etc.)
- No reliance on CALayer implicit animation (no setting `.opacity`, `.transform`, `.position` directly and expecting animation)
- All animations added via `layer.add(animation, forKey:)` with named keys

### R-3.2: SwiftUI Animation Discipline
- Boot/Shutdown sequences use `TimelineView(.animation)` phase-driven rendering — no `withAnimation` blocks for continuous motion
- `HUDPhaseController` transitions use `withAnimation(.easeInOut(duration: 0.6))` only for discrete phase changes
- Panel slide-in/out uses explicit SwiftUI `.transition(.move(edge:))` with defined duration

## R-4: Real Data Source Enforcement

### R-4.1: Telemetry Data (Go Daemon → TelemetryBridge → TelemetryStore)
- CPU/GPU/memory/thermal/power from IOKit + SMC (C bindings) + IOReport (Obj-C bindings)
- Go daemon (`mactop --headless`) outputs JSON at 1Hz via stdout NSPipe
- `TelemetryBridge` reads async stream, decodes `TelemetrySnapshot`
- `TelemetryStore` normalises all values to 0.0–1.0 for rendering
- Custom metrics: DVHOP (VM overhead %), GUMER (GPU memory eviction MB/s), CCTC (thermal cost above 50°C)

### R-4.2: System APIs (Swift-native)
- Disk capacity: `FileManager.attributesOfFileSystem` → `.systemSize`, `.systemFreeSize`
- Hostname: `ProcessInfo.processInfo.hostName`
- Username: `NSUserName()`
- Time: `DateFormatter` + `Date()` via `TimelineView(.periodic)`
- Folder paths: `FileManager.urls(for:in:)`
- App launch: `NSWorkspace.shared.open(url)`

### R-4.3: No Dummy/Simulated Data
- Zero hardcoded telemetry values
- Zero placeholder strings for system info
- Zero simulated execution paths
- Weather widget: real HTTP fetch from wttr.in with graceful fallback on network failure

## R-5: 60fps Performance

### R-5.1: Rendering Pipeline
- Main reactor: SwiftUI `Canvas` in `TimelineView(.animation(minimumInterval: 1.0/60.0))`
- CALayer overlays: `CABasicAnimation` / `CASpringAnimation` at Core Animation frame rate (synced to display refresh)
- Metal scan line: `MTKView` at `preferredFramesPerSecond = 60`
- No blocking I/O on main thread — `TelemetryBridge` reads async, weather fetch via `Task`

### R-5.2: Performance Budget
- ≤700+ Canvas paths per frame (validated on Apple Silicon GPU)
- CAEmitterLayer: 12 particles/s, ≤34 concurrent particles (birthRate × lifetime)
- Metal: single full-screen quad, 6 vertices, trivial fragment shader
- CAShapeLayer: 5 ring layers with rotation animation (GPU-composited)

## R-6: Build System Integrity

### R-6.1: Go Daemon
- Build: `cd mactop && go build -o ../JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon .`
- Binary MUST exist in `Resources/` before Swift build
- CGO required for C/Obj-C bindings

### R-6.2: Swift App
- Build: `cd JarvisTelemetry && swift build -c release`
- `Package.swift`: swift-tools-version 5.9, macOS 14+
- Linked frameworks: AppKit, SwiftUI, SceneKit, CoreGraphics, Combine, Metal, MetalKit
- Resource bundle: `Resources/jarvis-mactop-daemon` via `.copy()`

### R-6.3: Run
- `sudo .build/release/JarvisTelemetry` (elevated for IOKit/SMC)
- Borderless `NSWindow` at `kCGDesktopWindowLevel`, one per screen

---

# §3 · Success Criteria

| ID | Criterion | Validation Method | Pass Condition |
|----|-----------|-------------------|----------------|
| SC-1 | Swift build succeeds | `cd JarvisTelemetry && swift build -c release 2>&1; echo $?` | Exit code 0, zero errors |
| SC-2 | All 6 panels render without crash | Launch app, observe 10s, check `Console.app` for crashes | No SIGABRT, no EXC_BAD_ACCESS, all 6 panels visible |
| SC-3 | Boot sequence completes full 10s timeline | Launch app, observe boot from t=0 to "JARVIS ONLINE" | Boot progress reaches 1.0, phase transitions to `.loop` |
| SC-4 | Main loop sustains 60fps | `CADisplayLink` frame timing or Instruments Time Profiler | Frame interval ≤16.7ms (0ms dropped frames over 30s) |
| SC-5 | Shutdown sequence completes 7s timeline | Trigger shutdown, observe ring deceleration → "JARVIS OFFLINE" → black | Shutdown progress reaches 1.0, phase transitions to `.standby` |
| SC-6 | Zero implicit CALayer animations | Code audit: every `CAAnimation` subclass has explicit `isRemovedOnCompletion = false`, `duration`, `fromValue`/`toValue`, `repeatCount`, `timingFunction` | No CALayer property set without explicit animation |
| SC-7 | All data sources use real APIs | Code audit: no hardcoded telemetry values, all store values from `TelemetrySnapshot`, system values from `ProcessInfo`/`FileManager`/`NSUserName`/`DateFormatter` | Zero dummy data paths |
| SC-8 | Visual match ≥9/10 against Iron Man JARVIS reference | Screenshot comparison against `docs/real-jarvis-01.jpg`, `docs/real-jarvis-02.jpg`, `docs/real-jarvis-03.jpg` on 10 dimensions (ring density, steel dominance, bezel presence, bloom restraint, arc precision, inner detail, spoke structure, color balance, furniture completeness, animation quality) | Average ≥9.0/10 |

---

# §4 · Constraints & Validation Gates

### C-1: Technology Stack (Immutable)
- Swift 5.9+ / SwiftUI Canvas / TimelineView — NOT UIKit, NOT WebKit, NOT Electron
- Core Animation: explicit `CABasicAnimation`, `CASpringAnimation`, `CAKeyframeAnimation` ONLY
- Metal: `MTKView` + inline shader source (no `.metal` bundle files)
- Go 1.21+: telemetry daemon with CGO for C/Obj-C bindings
- macOS 14+ / Apple Silicon ARM64 only

### C-2: Animation Quality Gates
- **GATE-A1:** Every `CAAnimation` subclass MUST set `isRemovedOnCompletion = false`
- **GATE-A2:** Every `CAAnimation` subclass MUST set explicit `duration` (no default)
- **GATE-A3:** Every `CAAnimation` subclass MUST set explicit `timingFunction`
- **GATE-A4:** Looping animations MUST set `repeatCount = .infinity`
- **GATE-A5:** `TimelineView(.animation)` MUST specify `minimumInterval: 1.0/60.0`

### C-3: Data Integrity Gates
- **GATE-D1:** `TelemetryStore` properties MUST update only from `TelemetryBridge.$snapshot`
- **GATE-D2:** System info (chip name, core counts, memory) MUST come from Go daemon's `systemInfo` JSON field
- **GATE-D3:** Disk capacity MUST use `FileManager.attributesOfFileSystem` with `.systemSize` / `.systemFreeSize`
- **GATE-D4:** No hardcoded numeric values for telemetry display (watts, temps, percentages, frequencies)

### C-4: Performance Gates
- **GATE-P1:** No synchronous network calls on main thread
- **GATE-P2:** No `Thread.sleep` or `usleep` on main thread
- **GATE-P3:** Canvas closure MUST NOT allocate objects per frame (pre-compute paths where possible)
- **GATE-P4:** `CAEmitterLayer` particle count: birthRate × lifetime ≤ 40 concurrent particles

### C-5: Code Quality Gates
- **GATE-Q1:** Zero `// TODO` or `// FIXME` placeholders
- **GATE-Q2:** Zero force unwraps (`!`) except provably safe cases (`makeFunction(name:)!` after string-literal lookup)
- **GATE-Q3:** All `CALayer` properties set in `buildPulse()` / `buildRings()` / `buildEmitter()` — not in `layout()` repeated calls
- **GATE-Q4:** `didSetup` guard prevents duplicate layer construction on re-layout

---

# §5 · Test Plan

| Test ID | Description | Input | Expected Output | Maps To |
|---------|-------------|-------|-----------------|---------|
| T-1 | Go daemon builds | `cd mactop && go build -o ../JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon .` | Exit 0, binary ≥1MB | R-6.1 |
| T-2 | Swift app builds | `cd JarvisTelemetry && swift build -c release` | Exit 0, zero errors | R-6.2, SC-1 |
| T-3 | App launches to boot | `sudo .build/release/JarvisTelemetry &` + `sleep 2 && pgrep JarvisTelemetry` | PID returned | R-6.3, SC-3 |
| T-4 | Boot completes to loop | Observe app for 12s | HUD reactor visible, panels rendered, "JARVIS ONLINE" appeared | R-2.1, SC-3 |
| T-5 | CorePulseRingView animates | Observe reactor centre | Pulsing ring scales 1.0→1.6→1.0 with opacity fade | R-1.1, SC-2 |
| T-6 | RingRotationView rotates | Observe 5 dashed rings | All 5 rings rotate at distinct speeds, CW/CCW alternating | R-1.2, SC-2 |
| T-7 | ReactorParticleEmitter emits | Observe reactor core | Cyan particles radiate outward from centre, fade with distance | R-1.3, SC-2 |
| T-8 | ScanLineMetalView sweeps | Observe screen | White gradient band sweeps top→bottom every 3.5s | R-1.4, SC-2 |
| T-9 | JarvisLeftPanel renders | Observe left edge | Clock (updating), Storage (real GB), Power gauge (live watts), Communication ring (rotating) | R-1.5, SC-2 |
| T-10 | JarvisRightPanel renders | Observe right edge | Directories, mini reactor, app shortcuts, system name, weather all visible | R-1.6, SC-2 |
| T-11 | 60fps sustained | Run Instruments Time Profiler for 30s during loop phase | 0 dropped frames, all intervals ≤16.7ms | R-5, SC-4 |
| T-12 | Shutdown sequence | Send SIGTERM or trigger via HUDPhaseController | Rings decelerate, particles implode, core dims, "JARVIS OFFLINE", black screen | R-2.3, SC-5 |
| T-13 | No implicit animations (code audit) | `grep -n "isRemovedOnCompletion" CorePulseRingView.swift RingRotationView.swift ReactorParticleEmitter.swift` | All animation objects have `isRemovedOnCompletion = false` | R-3, SC-6 |
| T-14 | Real data sources (code audit) | Review `TelemetryStore.ingest()`, panel data bindings | All values from `TelemetrySnapshot`, `FileManager`, `ProcessInfo`, `NSUserName` | R-4, SC-7 |
| T-15 | Visual fidelity | Screenshot comparison against reference images | Average score ≥9.0/10 across 10 dimensions | R-1, SC-8 |

---

# §6 · Deliverables Map

| Deliverable | File | Requirement | SC | Validation |
|-------------|------|-------------|-----|------------|
| Core pulse ring animation | `CorePulseRingView.swift` | R-1.1, R-3.1 | SC-2, SC-6 | Visible pulse + code audit |
| 5-ring rotation overlay | `RingRotationView.swift` | R-1.2, R-3.1 | SC-2, SC-6 | Visible rotation + code audit |
| Particle emitter | `ReactorParticleEmitter.swift` | R-1.3 | SC-2 | Visible particles |
| Metal scan line | `ScanLineMetalView.swift` | R-1.4 | SC-2, SC-4 | Visible sweep at 60fps |
| Left HUD panel | `JarvisLeftPanel.swift` | R-1.5, R-4.2 | SC-2, SC-7 | Widgets render real data |
| Right HUD panel | `JarvisRightPanel.swift` | R-1.6, R-4.2 | SC-2, SC-7 | Widgets render real data |
| Boot sequence | `BootSequenceView.swift` | R-2.1, R-4.1 | SC-3, SC-7 | Full timeline completes |
| Main loop HUD | `JarvisHUDView.swift` + `AnimatedCanvasHost.swift` | R-2.2, R-5 | SC-4, SC-8 | 60fps + visual match |
| Shutdown sequence | `ShutdownSequenceView.swift` | R-2.3 | SC-5 | Full timeline completes |
| Phase controller | `HUDPhaseController.swift` | R-2.1, R-2.3 | SC-3, SC-5 | Phase transitions work |
| Telemetry data pipeline | `TelemetryBridge.swift` + `TelemetryStore.swift` | R-4.1 | SC-7 | Real data flows end-to-end |
| Go daemon binary | `Resources/jarvis-mactop-daemon` | R-6.1 | SC-1 | Binary builds |
| Swift release binary | `.build/release/JarvisTelemetry` | R-6.2 | SC-1 | App builds |
| Package manifest | `Package.swift` | R-6.2 | SC-1 | Frameworks linked |

---

# §7 · Quality Standards

### Code Quality
- Production-grade Swift 5.9 — no force unwraps except provably safe Metal function lookups
- All `CAAnimation` objects: explicit timing, explicit values, `isRemovedOnCompletion = false`
- `didSetup` guard in every `NSViewRepresentable` prevents duplicate layer construction
- Color constants defined as `let` properties at view level, matching HUD palette exactly
- Structural comments: `// MARK: -` section headers, `// ──` visual separators
- No placeholder code: zero `// TODO`, zero `...rest`, zero simulated values

### Animation Quality
- 60fps sustained via `TimelineView(.animation(minimumInterval: 1.0/60.0))` for SwiftUI
- `CABasicAnimation` / `CASpringAnimation` at Core Animation native frame rate
- `MTKView` at `preferredFramesPerSecond = 60`
- Smooth phase-driven rendering — no `Timer.scheduledTimer` for animation (use `TimelineView` or `CAAnimation`)
- Boot/Shutdown progress driven by `Timer.publish(every: 1.0/60.0)` via Combine

### Visual Quality
- Iron Man JARVIS aesthetic: precision engineering, steel-over-neon, industrial bezels
- No layout breaks, no rendering artifacts, no console errors
- Panels render at fixed 220pt width with proper spacing
- Reactor scales adaptively via `GeometryReader` — works on any display resolution
- Dark background (#050A14) with subtle hex grid overlay

### Data Quality
- All telemetry values normalised 0.0–1.0 before rendering
- Delta detection for chatter: power ±3W, temperature ±2°C, swap ±5%, core spike >90%
- System info from Go daemon's first snapshot: chip name, core counts, GPU cores, memory size
- No stale data: `TelemetryStore` updates at 1Hz from daemon pipe

---

# §8 · Execution Order

### Step 1: Environment Verification
```bash
cd /Users/vic/claude/General-Work/jarvis/jarvis-build
ls JarvisTelemetry/Sources/JarvisTelemetry/{CorePulseRingView,RingRotationView,ReactorParticleEmitter,ScanLineMetalView,JarvisLeftPanel,JarvisRightPanel,BootSequenceView,ShutdownSequenceView,JarvisHUDView,AnimatedCanvasHost,HUDPhaseController,TelemetryStore,TelemetryBridge}.swift
swift --version
```
**GATE:** All 13 source files exist. Swift ≥5.9. Fail → HALT.

### Step 2: Code Audit — Explicit Animation Enforcement
- Read `CorePulseRingView.swift`, `RingRotationView.swift`, `ReactorParticleEmitter.swift`
- Verify every `CAAnimation` subclass sets: `isRemovedOnCompletion = false`, explicit `duration`, explicit `fromValue`/`toValue`, explicit `repeatCount`, explicit `timingFunction`
- Fix any violations: replace implicit property sets with explicit animation objects
**GATE:** SC-6 passes (zero implicit CALayer animations). Fail → fix, re-audit.

### Step 3: Code Audit — Real Data Source Enforcement
- Read `JarvisLeftPanel.swift`, `JarvisRightPanel.swift`, `TelemetryStore.swift`
- Verify: all telemetry from `TelemetryStore` → `TelemetryBridge.$snapshot`, disk from `FileManager.attributesOfFileSystem`, hostname from `ProcessInfo`, username from `NSUserName`
- Fix any dummy/hardcoded values
**GATE:** SC-7 passes (all data from real APIs). Fail → fix, re-audit.

### Step 4: Build Go Daemon
```bash
cd /Users/vic/claude/General-Work/jarvis/jarvis-build/mactop
go build -o ../JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon .
```
**GATE:** Binary exists at `Resources/jarvis-mactop-daemon`, size ≥1MB. Fail → fix Go errors, rebuild.

### Step 5: Build Swift App
```bash
cd /Users/vic/claude/General-Work/jarvis/jarvis-build/JarvisTelemetry
swift build -c release 2>&1
```
**GATE:** SC-1 passes (exit code 0, zero errors). Fail → fix Swift errors, rebuild.

### Step 6: Launch and Verify Boot Sequence
```bash
sudo pkill -f JarvisTelemetry 2>/dev/null; sleep 1
sudo /Users/vic/claude/General-Work/jarvis/jarvis-build/JarvisTelemetry/.build/release/JarvisTelemetry &
sleep 12
```
- Take screenshot after boot completes
- Verify: core ignition → ring materialization → hardware text → panel slide-in → "JARVIS ONLINE"
**GATE:** SC-3 passes (boot completes, transitions to loop). Fail → debug BootSequenceView, fix, rebuild.

### Step 7: Verify All 6 Panels in Loop Phase
- Take screenshot during loop phase
- Verify each panel is visible and animating:
  1. CorePulseRingView — pulsing ring at centre
  2. RingRotationView — 5 dashed rings rotating
  3. ReactorParticleEmitter — particles radiating from core
  4. ScanLineMetalView — sweep band moving top→bottom
  5. JarvisLeftPanel — clock updating, storage, power gauge, communication ring
  6. JarvisRightPanel — directories, mini reactor, shortcuts, system name, weather
**GATE:** SC-2 passes (all 6 panels render without crash). Fail → debug failing panel, fix, rebuild.

### Step 8: Verify 60fps + Visual Fidelity
- Observe animation smoothness for 30s
- Compare screenshot against `docs/real-jarvis-01.jpg`, `docs/real-jarvis-02.jpg`, `docs/real-jarvis-03.jpg`
- Score on 10 dimensions: ring density, steel dominance, bezel presence, bloom restraint, arc precision, inner detail, spoke structure, color balance, furniture completeness, animation quality
**GATE:** SC-4 passes (60fps sustained) AND SC-8 passes (visual score ≥9.0/10). Fail → identify gaps, fix JarvisHUDView.swift, rebuild.

### Step 9: Verify Shutdown Sequence
- Trigger shutdown: `sudo kill -TERM $(pgrep JarvisTelemetry)`
- Observe: ring deceleration → particle implosion → core dim → final flash → "JARVIS OFFLINE" → black
**GATE:** SC-5 passes (shutdown completes, transitions to standby). Fail → debug ShutdownSequenceView, fix, rebuild.

### Step 10: Final Validation — All 8 SC Simultaneously
- Rebuild and relaunch
- Run through complete lifecycle: Boot → Loop (30s) → Screenshot → Shutdown
- Confirm:
  - [x] SC-1: Build exits 0
  - [x] SC-2: All 6 panels render
  - [x] SC-3: Boot completes
  - [x] SC-4: 60fps sustained
  - [x] SC-5: Shutdown completes
  - [x] SC-6: Zero implicit animations
  - [x] SC-7: All real data sources
  - [x] SC-8: Visual match ≥9/10
**GATE:** All 8 SC pass. Output: `JARVIS ONLINE`

---

**BEGIN EXECUTION. DO NOT STOP UNTIL ALL 8 SUCCESS CRITERIA PASS SIMULTANEOUSLY.**
