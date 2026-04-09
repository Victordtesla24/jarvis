# §1 · Project Identity

**Title:** JARVIS Telemetry — Cinema-Grade macOS HUD for Apple Silicon Monitoring
**Scope:** Refine, build, run, visually verify, and iterate the SwiftUI JARVIS HUD until it matches the reference images from the Iron Man film series.
**Platform:** macOS 14+ (Sonoma+), Apple Silicon (ARM64), Swift 5.9+, SwiftUI Canvas, Go 1.21+ (daemon)
**Repository:** `/Users/vic/claude/General-Work/jarvis/jarvis-build`
**Mission:** Achieve pixel-level fidelity between the running JARVIS Telemetry app and the real JARVIS HUD reference images (`docs/real-jarvis-01.jpg`, `docs/real-jarvis-02.jpg`, `docs/real-jarvis-03.jpg`).

---

# §2 · Requirements

## R-1: Visual Fidelity to Iron Man JARVIS Reference Images

The running app MUST match the visual language of the three reference images in `docs/`:

### R-1.1: Arc Reactor Core Structure
- Concentric ring system with 220+ rings from center (0.02R) to outer edge (1.08R)
- Dark steel industrial bezels (thick, matte, low-opacity steel gray) at R×0.94–1.08, R×0.855–0.895, R×0.75–0.78
- Bezel panels (rectangular segmented arcs) at each bezel boundary
- Radial spokes at every bezel zone boundary

### R-1.2: Color Palette Accuracy
- Background: deep space black (#050A14)
- Primary HUD: cyan (#00D4FF) — thin, precise, never overwhelming
- Highlights: bright cyan (#69F1F1) — central stats, glow peaks
- Subtle accents: dim cyan (#008CB3) — background arcs, structural markers
- Warm data: amber (#FFC800) — P-core arcs, bezel accent ring
- Alert/hot: crimson (#FF2633) — S-core arcs, thermal warnings
- Structural: steel gray (#668494) — dominant material for bezels, ticks, rings
- Grid: dark teal (#00334D) — hex grid background overlay

### R-1.3: Design Philosophy — "Steel Over Neon"
- Structural gray-steel dominates the visual field, NOT cyan
- Cyan is accent, not protagonist
- Data arcs are thin (2–3px width), bloom is tight and restrained (3–5px max)
- Bezels are dark, industrial, matte — built from multiple overlapping low-opacity steel rings
- Density creates authority — 700+ paths per frame, no empty zones
- Every ring and tick serves a structural or data purpose

### R-1.4: Animation Quality
- 60fps via `TimelineView(.animation)` and SwiftUI `Canvas`
- Rotating tick rings at varied speeds and directions (CW/CCW)
- Radar sweep line with trailing glow wedge
- Breathing pulse on glow rings (subtle sine modulation)
- Moving scan beam (horizontal, top-to-bottom, 8-second cycle)
- Rotating glow arcs at multiple radii

### R-1.5: Data-Driven Arcs
- E-Core usage → cyan arcs at R×0.84 (per-core segmented)
- P-Core usage → amber arcs at R×0.74 (per-core segmented)
- S-Core usage → crimson arcs at R×0.64 (per-core segmented)
- GPU usage → cyan arc at R×0.91 (single continuous)
- All arcs thin (2–3px) with 3-layer precision bloom

### R-1.6: HUD Furniture
- Corner brackets (L-shaped) at all four screen corners with tick marks and dots
- Top bar: S.H.I.E.L.D. OS label (left), time (center), date with large day number (right)
- Bottom bar: chip name (left), clock (center), power + thermal state (right)
- Left panel: GPU mini-arc gauge, DVHOP/GUMER/CCTC holo-panels, E-Core bar gauge
- Right panel: mini arc reactor, power/thermal panel, DRAM bandwidth panel, P-Core bar gauge
- Horizontal status bar below reactor
- Central stats overlay (CPU %, total watts) at reactor center
- Hex grid background with distance-based opacity falloff
- CRT scan lines (horizontal, spaced 3px, black at 6% opacity)

### R-1.7: Deep Inner Detail
- Ultra-dense tick/ring/notch patterns from R×0.52 down to R×0.18
- Multiple tick densities (120, 80, 60, 48, 36, 24, 16, 12, 10, 8 ticks per ring)
- Dashed rings, segmented notch arcs, orbiting dots at deep core
- Structural spokes spanning full radius (R×0.18 to R×0.96) at varied counts

## R-2: Build System

### R-2.1: Go Daemon Build
- Source: `mactop/` directory
- Build command: `cd mactop && go build -o ../JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon .`
- Binary MUST exist at the Resources path before Swift build

### R-2.2: Swift App Build
- Source: `JarvisTelemetry/` directory
- Build command: `cd JarvisTelemetry && swift build -c release`
- SPM manifest: `Package.swift` (swift-tools-version: 5.9, macOS 14+)
- Linked frameworks: AppKit, SwiftUI, SceneKit, CoreGraphics, Combine

### R-2.3: Run Command
- `sudo .build/release/JarvisTelemetry` (requires elevated privileges for IOKit sensor access)
- App creates a borderless NSWindow at `kCGDesktopWindowLevel` (wallpaper layer)
- Renders on all connected displays

## R-3: Visual Verification Loop

### R-3.1: Screenshot Capture
- After app launches and preloader completes (~4 seconds), take a screenshot of the desktop
- Use `screencapture -x /tmp/jarvis-current.png` to capture without sound
- Wait 4 seconds after launch for preloader animation to complete before capturing

### R-3.2: Comparison Against Reference
- Compare `/tmp/jarvis-current.png` against `docs/real-jarvis-01.jpg`, `docs/real-jarvis-02.jpg`, `docs/real-jarvis-03.jpg`
- Evaluate on these dimensions:
  1. **Ring density:** Are there enough concentric rings? Do empty zones exist?
  2. **Steel dominance:** Is steel/gray the dominant visual material, not cyan?
  3. **Bezel presence:** Are dark industrial bezels visible at 3 radii?
  4. **Bloom restraint:** Are glow effects tight (3–5px), not diffuse/washy?
  5. **Arc precision:** Are data arcs thin (2–3px), not thick bars?
  6. **Inner detail:** Does the core area (R×0.18–0.52) have dense tick/ring patterns?
  7. **Spoke structure:** Are radial spokes visible at zone boundaries?
  8. **Color balance:** Does the overall tone read as dark steel-blue, not bright neon?
  9. **Furniture completeness:** Are corners, bars, panels, and gauges all present?
  10. **Animation quality:** Do rings rotate, sweep line move, elements breathe?

### R-3.3: Gap Identification
- For each dimension scoring below target, identify the specific code section in `JarvisHUDView.swift` responsible
- Document what the reference images show vs. what the current render shows
- Prioritize fixes by visual impact (large-area issues first)

### R-3.4: Code Fix
- Edit `JarvisTelemetry/Sources/JarvisTelemetry/JarvisHUDView.swift` directly
- Fix the identified gaps
- Rebuild and relaunch

### R-3.5: Iteration
- Repeat R-3.1 → R-3.4 until the visual match score reaches ≥9/10 on all dimensions
- Maximum 15 iterations before reporting final state

---

# §3 · Success Criteria

| ID | Criterion | Validation |
|---|---|---|
| SC-1.1 | App builds without errors | `swift build -c release` exits 0 |
| SC-1.2 | App launches and renders HUD at wallpaper level | Screenshot shows HUD behind desktop icons |
| SC-1.3 | 220+ concentric rings visible from center to edge | Visual inspection of screenshot |
| SC-1.4 | Three industrial bezels visible (outer, E-core, P-core) | Dark steel bands at 3 distinct radii |
| SC-1.5 | Steel gray dominates over cyan in visual field | Overall tone is dark steel-blue, not neon |
| SC-1.6 | Data arcs thin (2–3px) with tight bloom | Arcs look like precision instrument lines |
| SC-1.7 | Inner core (R×0.18–0.52) densely detailed | No empty black zones in core area |
| SC-1.8 | All HUD furniture present | Corners, bars, panels, gauges all render |
| SC-1.9 | Animations running at 60fps | Smooth rotation, sweep, breathing visible |
| SC-1.10 | Visual match score ≥9/10 against reference images | Side-by-side comparison passes |

---

# §4 · Constraints & Validation Gates

### C-1: Technology
- Swift 5.9+, SwiftUI Canvas (NOT UIKit, NOT WebKit, NOT Electron)
- All rendering via `Path` stroke/fill in Canvas closure — no `Image`, no external textures
- `TimelineView(.animation)` for 60fps phase propagation
- Go daemon provides telemetry via JSON stdout pipe

### C-2: Performance
- ≤ 700+ paths per frame (Canvas can handle this on Apple Silicon GPU)
- No blocking I/O on main thread
- TelemetryBridge reads daemon output asynchronously via `Process` pipe

### C-3: Visual Quality Gates
- **GATE-V1:** Before each iteration commit, screenshot MUST show improvement over previous
- **GATE-V2:** No fully black/empty zones between R×0.06 and R×1.08
- **GATE-V3:** Cyan-to-steel ratio must favor steel (steel covers more visual area)
- **GATE-V4:** All three bezels must be distinguishable as dark industrial bands
- **GATE-V5:** Bloom on any element must not exceed 6px total spread

### C-4: Code Quality
- No placeholder code (// TODO, ...rest of code)
- No dummy data — all arcs driven by `store.*` telemetry values
- No simulated execution — app MUST actually build and run
- Production-grade Swift: proper optionals, guard statements, computed properties

---

# §5 · Test Plan

| Test | Input | Expected Output | Maps To |
|---|---|---|---|
| T-1: Go daemon builds | `cd mactop && go build .` | Exit code 0, binary produced | R-2.1 |
| T-2: Swift app builds | `cd JarvisTelemetry && swift build -c release` | Exit code 0 | R-2.2, SC-1.1 |
| T-3: App launches | `sudo .build/release/JarvisTelemetry &` | Process running, window created | R-2.3, SC-1.2 |
| T-4: Screenshot capture | `sleep 5 && screencapture -x /tmp/jarvis-current.png` | PNG file > 500KB | R-3.1 |
| T-5: Visual ring density | Inspect screenshot | 220+ concentric rings from center to edge | R-1.1, SC-1.3 |
| T-6: Bezel visibility | Inspect screenshot | 3 dark steel bands at distinct radii | R-1.1, SC-1.4 |
| T-7: Color balance | Inspect screenshot | Steel dominates, cyan is accent | R-1.3, SC-1.5 |
| T-8: Arc precision | Inspect screenshot | Thin (2–3px) arcs with tight bloom | R-1.5, SC-1.6 |
| T-9: Inner density | Inspect screenshot | Dense detail in R×0.18–0.52 zone | R-1.7, SC-1.7 |
| T-10: HUD furniture | Inspect screenshot | All corners, bars, panels render | R-1.6, SC-1.8 |

---

# §6 · Deliverables Map

| Deliverable | Requirement | SC | Validation |
|---|---|---|---|
| `JarvisHUDView.swift` (updated) | R-1.1 through R-1.7 | SC-1.3 through SC-1.10 | Visual comparison |
| Go daemon binary | R-2.1 | SC-1.1 | Binary exists |
| Swift release binary | R-2.2 | SC-1.1 | Build exits 0 |
| `/tmp/jarvis-current.png` (per iteration) | R-3.1 | SC-1.10 | Screenshot exists |
| Gap analysis (per iteration) | R-3.2, R-3.3 | SC-1.10 | Documented in output |

---

# §7 · Quality Standards

### Code Quality
- Production-grade Swift 5.9 — no force unwraps except where provably safe
- All Canvas helpers (`ring`, `glowRing`, `ticks`, `notch`, `arcs`, `glowArcs`, `chevrons`, `dots`, `spokes`, `bezelPanels`, `coreArcs`) must remain inline in the Canvas closure for GPU batching efficiency
- Color constants defined once at the top of `JarvisHUDView`
- Structural comments with `// MARK: -` and `// ──` visual separators

### Visual Quality
- No layout breaks or rendering artifacts
- No console errors or warnings during runtime
- Smooth 60fps animation — no frame drops visible in screen recording
- HUD renders correctly on any screen resolution (uses `GeometryReader` for adaptive sizing)

### Design Quality
- Matches the **Arwes.dev** aesthetic: deep dark teal-black background, minimalist sci-fi, holographic steel bezels
- Matches the **Iron Man JARVIS** aesthetic: precision engineering display, not a toy or screensaver
- Every visible element has a functional purpose (data display, structural reference, or zone boundary)

---

# §8 · Execution Order

Execute these steps IN ORDER. Each step has a validation gate that MUST pass before proceeding.

### Step 1: Environment Verification
```bash
cd /Users/vic/claude/General-Work/jarvis/jarvis-build
ls JarvisTelemetry/Sources/JarvisTelemetry/JarvisHUDView.swift
ls docs/real-jarvis-01.jpg docs/real-jarvis-02.jpg docs/real-jarvis-03.jpg
swift --version
go version
```
**Gate:** All files exist, Swift 5.9+, Go 1.21+. If any missing, HALT and report.

### Step 2: Read Reference Images
- Open and visually analyze `docs/real-jarvis-01.jpg`, `docs/real-jarvis-02.jpg`, `docs/real-jarvis-03.jpg`
- Note: dark steel bezels, thin cyan arcs, dense concentric rings, industrial aesthetic, minimal bloom
**Gate:** Reference image analysis documented.

### Step 3: Read Current Source
- Read `JarvisTelemetry/Sources/JarvisTelemetry/JarvisHUDView.swift` in full
- Identify all 15+ view structs and the `JarvisReactorCanvas` structure
- Map each visual zone to its code section
**Gate:** Full source understanding documented.

### Step 4: Build Go Daemon
```bash
cd mactop
go build -o ../JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon .
cd ..
```
**Gate:** Binary exists at `JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon`.

### Step 5: Build Swift App
```bash
cd JarvisTelemetry
swift build -c release 2>&1
cd ..
```
**Gate:** Exit code 0, no errors. If errors, fix them before proceeding.

### Step 6: Launch App
```bash
# Kill any existing instance
sudo pkill -f JarvisTelemetry 2>/dev/null
sleep 1
# Launch in background
sudo JarvisTelemetry/.build/release/JarvisTelemetry &
# Wait for preloader to complete
sleep 5
```
**Gate:** Process is running (`pgrep JarvisTelemetry` returns PID).

### Step 7: Capture Screenshot
```bash
screencapture -x /tmp/jarvis-current.png
```
**Gate:** File exists and is > 100KB.

### Step 8: Visual Comparison
- View `/tmp/jarvis-current.png`
- Compare side-by-side against reference images on these 10 dimensions:
  1. Ring density (1–10)
  2. Steel dominance (1–10)
  3. Bezel presence (1–10)
  4. Bloom restraint (1–10)
  5. Arc precision (1–10)
  6. Inner detail density (1–10)
  7. Spoke structure (1–10)
  8. Color balance (1–10)
  9. Furniture completeness (1–10)
  10. Animation quality (1–10, infer from static frame — visible rotation, sweep elements)
- Calculate average score
**Gate:** Average ≥ 9.0 → proceed to Step 12. Average < 9.0 → proceed to Step 9.

### Step 9: Identify Gaps
- For each dimension < 9, document:
  - What the reference shows
  - What the current render shows
  - Which code section in `JarvisHUDView.swift` controls this
  - Specific change needed (add rings, reduce bloom, darken bezel, etc.)
**Gate:** Gap list with specific code changes documented.

### Step 10: Apply Fixes
- Edit `JarvisHUDView.swift` with targeted changes
- Focus on highest-impact gaps first
- Preserve all existing working code — make additive or parameter changes only
**Gate:** File saved, no syntax errors.

### Step 11: Rebuild and Re-verify
- Kill app: `sudo pkill -f JarvisTelemetry`
- Rebuild: `cd JarvisTelemetry && swift build -c release && cd ..`
- Relaunch: `sudo JarvisTelemetry/.build/release/JarvisTelemetry &`
- Wait: `sleep 5`
- Screenshot: `screencapture -x /tmp/jarvis-current.png`
- Return to Step 8
**Gate:** Build succeeds. New screenshot captured.

### Step 12: Final Validation
- Confirm all 10 SC items pass
- Take final screenshot: `screencapture -x /tmp/jarvis-final.png`
- Report final scores on all 10 dimensions
- Report total iteration count
**Gate:** All SC pass. Final screenshot saved.

---

# §9 · Key Source Files Reference

| File | Lines | Purpose |
|---|---|---|
| `JarvisTelemetry/Sources/JarvisTelemetry/JarvisHUDView.swift` | ~1413 | **PRIMARY** — All reactor Canvas rendering, 15+ view structs |
| `JarvisTelemetry/Sources/JarvisTelemetry/JarvisTelemetryApp.swift` | ~20 | @main entry, delegates to AppDelegate |
| `JarvisTelemetry/Sources/JarvisTelemetry/AppDelegate.swift` | ~80 | Borderless NSWindow at desktopWindow level per screen |
| `JarvisTelemetry/Sources/JarvisTelemetry/JarvisRootView.swift` | ~60 | Preloader → HUD transition orchestrator |
| `JarvisTelemetry/Sources/JarvisTelemetry/JarvisPreloader.swift` | ~150 | SceneKit 3.2s cinematic boot sequence |
| `JarvisTelemetry/Sources/JarvisTelemetry/AnimatedCanvasHost.swift` | ~40 | TimelineView wrapper for 60fps phase |
| `JarvisTelemetry/Sources/JarvisTelemetry/TelemetryBridge.swift` | ~100 | Async JSON stream from Go daemon |
| `JarvisTelemetry/Sources/JarvisTelemetry/TelemetryStore.swift` | ~80 | @Published telemetry properties |
| `JarvisTelemetry/Package.swift` | ~27 | SPM manifest (macOS 14+) |
| `mactop/` | ~5000 | Go telemetry daemon (all internal/app/*.go) |

---

# §10 · Visual Reference Quick Guide

What the JARVIS reference images show (extracted from `docs/real-jarvis-01.jpg`, `02.jpg`, `03.jpg`):

1. **Central arc reactor** — large circular HUD dominating center-screen
2. **Dark background** — near-black with subtle hex grid
3. **Concentric rings** — hundreds of thin rings, mostly steel/gray, some cyan
4. **Industrial bezels** — thick dark bands (like machined metal) separating ring zones
5. **Thin data arcs** — colored arcs (cyan, amber) representing live data, very thin
6. **Radial spokes** — fine lines radiating from center through ring zones
7. **Tight glow** — minimal bloom, precision engineering aesthetic
8. **HUD furniture** — corner brackets, text overlays, gauges, panels flanking the reactor
9. **Dense inner core** — the center area is NOT empty — it's packed with fine tick marks and rings
10. **Steel-over-neon** — the overall color impression is dark steel-blue, not bright cyan

BEGIN EXECUTION. DO NOT STOP UNTIL ALL SUCCESS CRITERIA PASS OR 15 ITERATIONS COMPLETE.
P