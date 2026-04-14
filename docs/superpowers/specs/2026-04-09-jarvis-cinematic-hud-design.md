# JARVIS Cinematic HUD — Full Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Goal:** Transform the JARVIS Telemetry wallpaper into a full Iron Man workshop experience — cinematic boot/shutdown sequences, a living reactive HUD with full JARVIS chatter, ambient holographic atmosphere, and emotional system awareness.

**Target user:** Enterprise Architect / Solutions Developer / Software & AI Engineer who runs heavy builds, AI workloads, Docker, and multiple IDEs on an Apple Silicon MacBook Pro.

---

## 1. Animation State Machine

The HUD operates in four distinct phases, managed by a central `HUDPhaseController`:

```
                      ┌────────────┐
          app start → │    BOOT    │  (8-12s first launch, 3-4s wake)
                      └─────┬──────┘
                            │ complete
                            ▼
                      ┌────────────┐
                ┌───► │    LOOP    │ ◄──── session unlock (triggers wake boot)
                │     └─────┬──────┘
                │           │ SIGTERM / SIGINT / sleep / screen lock
                │           ▼
                │     ┌────────────┐
                │     │  SHUTDOWN  │  (5-8s)
                │     └─────┬──────┘
                │           │ complete
                │           ▼
                │     ┌────────────┐
                └──── │  STANDBY   │  (static lock screen PNG)
                      └────────────┘
```

### Phase transitions

| Trigger | From | To | Notes |
|---------|------|----|-------|
| App launch | — | BOOT | Full 8-12s theatrical sequence |
| Boot complete | BOOT | LOOP | Crossfade, reactor at full spin |
| Screen lock / sleep | LOOP | SHUTDOWN | Full cinematic power-down |
| Shutdown complete | SHUTDOWN | STANDBY | Static PNG set as wallpaper |
| Screen unlock / wake | STANDBY | BOOT (wake) | Shortened 3-4s re-ignition |
| SIGTERM / SIGINT | LOOP | SHUTDOWN | Graceful cinematic exit |
| SIGKILL / crash | any | — | No animation (force kill) |

### Lifecycle observers

- `NSWorkspace.willSleepNotification` → trigger SHUTDOWN
- `NSWorkspace.didWakeNotification` → trigger BOOT (wake variant)
- `NSWorkspace.sessionDidBecomeActiveNotification` → trigger BOOT (wake) after unlock
- `NSWorkspace.sessionDidResignActiveNotification` → trigger SHUTDOWN
- `SIGTERM` / `SIGINT` signal handlers → trigger SHUTDOWN, delay exit until sequence completes
- `DistributedNotificationCenter` for screen lock/unlock events

---

## 2. BOOT Sequence (8-12s first launch / 3-4s wake)

### Full Boot (first launch)

A cinematic power-on that feels like JARVIS initializing in Tony's workshop. Every step uses **real hardware data** detected from the Go daemon and `sysctl`.

**Timeline:**

| Time | Visual | Text Overlay |
|------|--------|-------------|
| 0.0s | Pure black. Single cyan pixel appears at dead center. | — |
| 0.3s | Pixel blooms into a soft sphere (radius ~20px), pulsing. | — |
| 0.8s | **Core ignition** — bright flash, expanding shockwave ring races outward across full screen. Screen shakes (1px offset, 3 frames). | `INITIALIZING...` (center, fades in) |
| 1.5s | Core stabilizes into pulsing reactor heart. First inner ring materializes — fades in with rotation. | `JARVIS NEURAL INTERFACE v3.1` |
| 2.0s | Rings 2-5 materialize outward in rapid succession (0.15s stagger), each trailing cyan particle sparks. | `SCANNING SILICON TOPOLOGY...` |
| 3.0s | Hex grid fades in across background (0→full over 1s). Scan lines begin. | `APPLE M4 MAX DETECTED` (actual chip name from daemon) |
| 3.5s | **Hardware enumeration** — text streams appear left and right, scrolling real data: | Left stream begins |
| 3.5s | | `CORE CLUSTER 0: 10x EFFICIENCY — ONLINE` |
| 4.0s | Rings 6-12 materialize with particle trails. | `CORE CLUSTER 1: 4x PERFORMANCE — ONLINE` |
| 4.5s | E-Core arcs flash on (brief full-brightness, settle to actual usage). | `CORE CLUSTER 2: 1x STORM — ONLINE` |
| 5.0s | P-Core arcs flash on. | `GPU COMPLEX: 40-CORE — ONLINE` |
| 5.5s | S-Core arcs flash on. GPU arc sweeps in. | `UNIFIED MEMORY: 128GB — MAPPED` |
| 6.0s | Outer bezel rings + tick marks materialize. Structural spokes fade in. | `THERMAL ENVELOPE: NOMINAL` |
| 6.5s | **3D wireframe chip** (SceneKit) materializes at center — Apple Silicon die schematic, rotating slowly. Holographic cyan wireframe aesthetic. | `CONFIGURING TELEMETRY STREAM...` |
| 7.5s | Chip wireframe dissolves into particles that scatter outward and become ambient dust motes. | `TELEMETRY ACTIVE — 1Hz REFRESH` |
| 8.0s | Side data panels slide in from edges (left panels from left, right from right). Bottom bar slides up. Top bar slides down. | `ALL SYSTEMS NOMINAL` |
| 8.5s | Chatter streams begin scrolling. Floating diagnostic panels start their lifecycle. | — |
| 9.0s | Sweep line begins rotation. Chevrons start orbiting. All rings at full speed. | — |
| 9.5s | **Awareness pulse** — single ripple wave from core outward. The HUD is alive. | `JARVIS ONLINE` (center, holds 1s, dissolves) |
| ~10s | Transition complete → LOOP phase | — |

All core counts, chip name, memory size, and GPU core count are **real values** read from the Go daemon's first telemetry snapshot and `systemInfo`.

### Wake Boot (3-4s, after unlock/sleep wake)

Abbreviated re-ignition:

| Time | Visual |
|------|--------|
| 0.0s | Static standby image visible. Core begins to glow. |
| 0.5s | Core pulses to full brightness. Rings begin rotating (slow → accelerate). |
| 1.0s | All rings spinning. Data arcs fade in with current telemetry values. |
| 1.5s | Side panels slide in. Hex grid and scan lines resume. |
| 2.0s | Chatter streams resume. Ambient particles resume drifting. |
| 2.5s | Single awareness pulse. `JARVIS ONLINE` text, dissolves. |
| ~3s | Full LOOP phase. |

---

## 3. MAIN LOOP — The Workshop Experience

### 3.1 Reactor Core (enhanced existing)

The existing 220+ ring reactor is the foundation. Enhancements:

**Cardiac Core Pulse:**
- The center core pulses with a **heartbeat rhythm** — not a sine wave.
- Pattern: quick contraction (0.15s bright flash + scale to 1.15x) → slow release (0.6s dim + scale back to 1.0x) → brief pause (0.25s) → repeat.
- **Heartbeat rate scales with total CPU load:**
  - 0-20% load: ~50 BPM (calm, slow pulse)
  - 20-50%: ~70 BPM
  - 50-80%: ~90 BPM (working hard)
  - 80-100%: ~120 BPM (hammering, urgent feel)
- Core glow intensity: `baseGlow + loadMultiplier * 0.4`

**Load-Reactive Ring Speed:**
- Base ring rotation speeds remain as-is.
- Under load, all rings get a speed multiplier: `1.0 + (cpuLoad * 0.5)`
- At 100% CPU, rings spin 50% faster — visually urgent.
- Speed changes are **smoothly interpolated** (0.5s ease), never jarring.

**Ring Harmonics:**
- Every 45-60 seconds (randomized), all rings briefly synchronize their rotation — creating a visual "chord" where everything aligns for 1-2 seconds, then gradually desyncs back to normal. Like a machine finding and losing resonance. Subtle, but mesmerizing if you catch it.

### 3.2 JARVIS Chatter System

Three concurrent text systems running at all times:

#### Primary Diagnostic Stream (left edge)

- Position: left side of screen, 60px from edge, scrolling upward.
- Font: Menlo 9px, cyan at 0.5 opacity, brighter (0.8) for 2s when new.
- Speed: new line every 1-3 seconds (varies with system activity).
- Max visible lines: 12-15, older lines fade out at top.
- **Content sources (real telemetry):**
  - Per-core utilization spikes: `E-CORE 7: 94% UTILIZATION`
  - Frequency changes: `P-CORE 0: FREQ BOOST → 4056 MHz`
  - Power deltas: `TOTAL POWER: 22W → 31W (+41%)`
  - Temperature changes: `CPU TEMP: 42.1°C → 48.3°C`
  - Memory events: `SWAP PRESSURE: 8% → 15%`
  - DRAM bandwidth: `DRAM WRITE BW: 18.2 GB/s SUSTAINED`
  - Custom metrics: `DVHOP: 0.42% — HYPERVISOR TAX NOMINAL`

#### Secondary Intel Stream (right edge)

- Position: right side, 60px from edge, scrolling upward (slower).
- Font: Menlo 8px, cyan at 0.3 opacity.
- Speed: new line every 3-6 seconds.
- Max visible lines: 8-10.
- **Content (ambient flavor mixed with real data):**
  - `MONITORING 847 ACTIVE THREADS`
  - `MEMORY PRESSURE: 62.4 GB / 128 GB ALLOCATED`
  - `THERMAL COST: +2.1°C ABOVE 50°C BASELINE`
  - `UMA EVICTION RATE: 1.24 MB/s — NOMINAL`
  - `GPU COMPLEX: 42% UTILIZATION — 40 CORES`
  - `ANE SUBSYSTEM: 0.12W — STANDBY`
  - `SYSTEM UPTIME: 4h 23m 17s`
  - `TELEMETRY FRAME: #15847`

#### Floating Diagnostic Panels (new)

- 1-2 panels visible at any time, spawning every 8-15 seconds.
- Each panel: semi-transparent dark box (like existing side panels) with holographic border.
- **Lifecycle:** materialize from small+dim → full size over 0.5s (zoom-in depth effect) → hold for 4-8s → dissolve (fade + scale down over 0.5s).
- **Position:** random placement in the middle third of the screen (avoiding reactor core and existing side panels). Slight slow drift during lifetime.
- **Content types (rotating):**
  - **Core topology map:** Mini bar chart of all core utilizations, labeled by cluster.
  - **Thermal gradient:** Horizontal gradient bar from cool (cyan) to hot (amber/red) with current temps marked.
  - **Memory breakdown:** Stacked bar showing used/available/swap with values.
  - **Power budget:** Pie-style arc showing CPU/GPU/ANE/DRAM power distribution.
  - **System snapshot:** Chip name, core count, memory, uptime, thermal state — quick status card.

### 3.3 Data Materialization Effects

**Digit Cipher Flip:**
- When any numeric value changes, the outgoing digits don't just switch — they rapidly cycle through random characters (0-9, A-F hex chars) for 0.2-0.3s before landing on the correct digit.
- Flip happens left-to-right, with a 30ms stagger per digit.
- Only digits that actually changed do the flip; unchanged digits stay stable.
- Applies to: watts display, temperatures, percentages, all panel values.

**Text Materialization:**
- New text in chatter streams types in character by character (15ms per char).
- Each character appears at full brightness then settles to stream opacity over 0.3s.

### 3.4 Holographic Flicker

- **Frequency:** 1-3 times per minute (randomized interval, 20-45s apart).
- **Duration:** 2-4 frames (33-66ms at 60fps).
- **Effect:** Brief horizontal tear — the entire HUD shifts 1-3px horizontally for 1 frame, slight cyan/magenta color channel separation (chromatic aberration), then snaps back.
- **Variation:** Occasionally (1 in 4 flickers) a more dramatic version — 2-frame vertical roll of a random 40-80px horizontal band, like analog TV interference.
- **Constraint:** Never during boot or shutdown sequences. Only in LOOP phase. Never more than 4 frames total disruption.

### 3.5 Awareness Pulses

- **Trigger:** Any telemetry value crosses a significance threshold:
  - Temperature crosses 45°C, 50°C, or 55°C (either direction)
  - CPU load crosses 50% or 80% (either direction)
  - GPU load crosses 60% or 90%
  - Swap usage crosses 25% or 50%
  - Total power crosses 25W or 40W
- **Visual:** A ring of light emanates from the reactor core outward to screen edges, expanding over 0.8s. Like a sonar ping or stone-in-water ripple.
  - Ring width: ~4px, opacity fading from 0.3 at core to 0.0 at edges.
  - Color: cyan for normal events, amber for thermal warnings, crimson for critical.
- **Cooldown:** Minimum 5 seconds between awareness pulses to prevent spam under rapidly fluctuating loads.
- **Paired with:** A brief chatter message describing the event.

### 3.6 Ambient Particles

- **Count:** 30-50 particles on screen at any time.
- **Appearance:** Tiny cyan dots, 1-2px, opacity 0.1-0.3 (randomized per particle).
- **Motion:** Very slow drift in a consistent direction (subtle wind effect), ~5-15px/second. Slight sinusoidal wobble.
- **Lifecycle:** Fade in over 1s at a random screen edge → drift across → fade out over 1s at opposite edge. Continuous respawn.
- **Depth variation:** Some particles are dimmer and slower (far away), some brighter and faster (close). Creates parallax depth illusion.
- **Load reactivity:** Under high load, particles drift faster and slightly brighter. Under idle, slower and dimmer. The air itself feels charged.

### 3.7 Connective Wire Flashes

- **Trigger:** When a chatter message references a specific data point that's also shown on the reactor or a panel.
- **Visual:** A hair-thin cyan line (0.5px, 0.3 opacity) arcs from the data source (e.g., a specific core arc on the reactor) to the relevant panel or chatter line. The line draws itself over 0.2s (animated path), pulses once bright, then fades over 0.5s.
- **Frequency:** Max 1 every 3-4 seconds to avoid clutter.
- **Path:** Slight curve (quadratic bezier), not straight line. Gives holographic feel.
- **Examples:**
  - CPU temp spike → wire from thermal ring zone to temperature panel
  - P-Core 2 at 92% → wire from P-Core arc segment 2 to the chatter line
  - GPU load change → wire from GPU arc to GPU gauge panel

### 3.8 Emotional System Awareness

The entire HUD should **breathe with the machine state.** This is implemented as a global `SystemMood` that continuously interpolates based on aggregated telemetry:

**Mood spectrum:**

| Load | Mood | Ring Speed | Core BPM | Particle Speed | Glow Intensity | Chatter Rate | Hex Grid Pulse |
|------|------|-----------|----------|---------------|----------------|-------------|----------------|
| 0-15% | Serene | 0.7x | ~45 BPM | Lazy drift | Dim, soft | 1 line / 4s | Slow breathe |
| 15-40% | Calm | 1.0x | ~60 BPM | Normal | Normal | 1 line / 2s | Normal |
| 40-65% | Active | 1.2x | ~80 BPM | Brisk | Bright | 1 line / 1.5s | Quickened |
| 65-85% | Intense | 1.4x | ~100 BPM | Fast | Very bright | 1 line / 1s | Rapid |
| 85-100% | Overdrive | 1.5x | ~120 BPM | Urgent | Maximum + bloom | 1 line / 0.5s | Intense pulse |

**Thermal override:** If thermal state is "Serious" or "Critical", the mood shifts amber/crimson regardless of load — reactor core tints warm, rings get amber edge glow, chatter text shifts to amber for thermal messages.

**Transitions:** Mood changes are **smoothly interpolated over 2-3 seconds.** No sudden jumps. The workshop gradually wakes up or calms down.

### 3.9 Depth & Parallax

Create the illusion that HUD elements exist at different distances from the viewer:

| Layer | Depth | Visual Treatment |
|-------|-------|-----------------|
| Background hex grid | Far | Dimmer (0.03 opacity), slower pulse |
| Ambient particles (slow) | Far-mid | Small, dim, slow drift |
| Reactor rings (outer) | Mid | Normal brightness |
| Reactor rings (inner) | Mid-close | Slightly brighter |
| Core | Close | Brightest, sharpest |
| Side panels | Close | Full opacity, sharp edges |
| Floating diagnostic panels | Variable | Zoom in from far (small+dim) to close (full+bright) during materialize |
| Chatter text | Close | Full sharpness |
| Ambient particles (fast) | Very close | Larger (2px), brighter, faster — like dust right in front of your face |
| Connective wires | Mid | Moderate opacity, thin |

### 3.10 Scanner Overlay (my addition)

Every 30-45 seconds, a full-width horizontal scan line sweeps vertically across the entire screen (top to bottom, 3 seconds). As it passes, elements briefly illuminate to full brightness then settle back — like JARVIS doing a periodic system scan.

- Scan line: 1px bright cyan + 40px gradient trail fading behind it.
- Elements under the scan line: brightness multiplied by 1.5x for the frame they're scanned.
- After the sweep completes, a brief chatter message: `SYSTEM SCAN COMPLETE — ALL NOMINAL` (or relevant status).

### 3.11 Ghost Trails (my addition)

Fast-moving elements (sweep line, orbiting chevrons, rotating tick marks) leave brief afterimages:

- 3-5 trailing copies at decreasing opacity (0.15, 0.10, 0.06, 0.03, 0.01).
- Each copy is the element's position 1-5 frames ago.
- Creates motion blur / speed trail effect.
- Only visible on elements with rotation speed > baseline. More prominent under high load when rings spin faster.

### 3.12 Reactor Threat Escalation (my addition)

When thermal state reaches "Serious" or "Critical":

- Outer reactor ring develops a pulsing **crimson edge glow** (on top of existing steel).
- Core heartbeat becomes visible as a crimson ring pulse expanding from center.
- Background subtly shifts from pure dark blue to a hint of dark red (`#0A0508`).
- Chatter streams include `WARNING` prefix messages in crimson.
- Awareness pulses fire in crimson with increased frequency.
- If thermals return to normal: reverse the escalation over 3 seconds (crimson drains away, replaced by calm cyan).

---

## 4. SHUTDOWN Sequence (5-8s)

A full cinematic power-down. The inverse of boot, but with its own dramatic beats.

**Timeline:**

| Time | Visual | Text |
|------|--------|------|
| 0.0s | **Trigger received.** Chatter streams freeze in place. | `SHUTDOWN INITIATED` (center) |
| 0.5s | Floating diagnostic panels retract toward center and vanish (0.3s each). | Chatter text begins dissolving character by character (random order per line). |
| 1.0s | Side data panels slide out to edges and disappear. Bottom bar slides down. Top bar slides up. | `SECURING TELEMETRY STREAM...` |
| 1.5s | Connective wires all fire simultaneously toward core (dramatic visual) then fade. | `CORE METRICS: ARCHIVED` |
| 2.0s | **Ring deceleration begins.** Outer rings slow first (like a flywheel losing momentum). Each ring decelerates independently with slight timing offsets. Sweep line slows. | `POWERING DOWN SUBSYSTEMS...` |
| 3.0s | Ambient particles drift toward core (reversed — attracted inward like gravity). Getting pulled in. | `GPU COMPLEX: OFFLINE` |
| 3.5s | Outermost rings come to complete stop, then fade out one by one inward (0.1s stagger). | `CORE CLUSTERS: OFFLINE` |
| 4.0s | E-Core arcs drain to zero (animate usage down over 0.5s). P-Core arcs drain. S-Core arcs drain. | `THERMAL MONITORING: SUSPENDED` |
| 4.5s | GPU arc drains. Middle rings stop and fade. Only inner rings + core remain. | — |
| 5.0s | Inner rings stop. Hex grid fades out. Scan lines stop. | — |
| 5.5s | Core heartbeat slows dramatically — one final slow pulse (2s period). | — |
| 6.0s | Core shrinks slowly (1.0x → 0.3x scale over 1.5s), dimming. | — |
| 6.5s | **Final flash** — core does one last bright pulse (full white, 0.1s), then goes dark. | — |
| 7.0s | `JARVIS OFFLINE` appears at center in dim cyan, holds. | `JARVIS OFFLINE` |
| 7.5s | Text dissolves character by character. Pure black remains. | — |
| 8.0s | Sequence complete → STANDBY. | — |

**Ring deceleration physics:**
- Each ring has a virtual angular velocity that decelerates with simulated drag.
- Outer rings (higher moment of inertia) slow first and stop first.
- Inner rings keep spinning longer (lighter, less drag).
- The core is the last thing spinning — a final slow rotation before the pulse.
- Use exponential decay: `velocity *= 0.97` per frame, with per-ring decay rates.

**Particle implosion:**
- All ambient particles reverse direction toward the core.
- As they approach center, they accelerate (gravity well effect).
- Upon reaching core vicinity (< 20px), they flash bright and vanish.
- Creates the feeling of energy being reclaimed.

---

## 5. Lock Screen — STANDBY Mode

### Static Wallpaper Generation

When entering STANDBY, the app renders a **single high-resolution PNG** of the reactor in standby state:

- All rings visible but frozen (no rotation) — captured at their current angular positions.
- Core at minimal glow (dim cyan, no pulse).
- Background hex grid at reduced opacity.
- No chatter, no particles, no floating panels.
- Overlay text: `SYSTEM STANDBY` in dim cyan, centered below the reactor.
- Time and date rendered on screen.
- Overall impression: the HUD is sleeping, not dead. Everything is in place, just dormant.

This PNG is set as the macOS desktop wallpaper via:
```swift
try NSWorkspace.shared.setDesktopImageURL(pngURL, for: screen, options: [:])
```

### Lock/Unlock Flow

1. **Screen locks:** SHUTDOWN sequence plays → STANDBY PNG set as wallpaper → app window becomes invisible behind lock screen.
2. **While locked:** Static JARVIS standby image is the wallpaper. Looks intentional and cool.
3. **Screen unlocks:** App detects session active → wake BOOT sequence plays (3-4s) → reactor comes alive → LOOP resumes.

The transition feels seamless — the static image shows the reactor in the same position the shutdown left it, and the wake boot re-animates from that state.

---

## 6. Telemetry Data Hierarchy

Based on the target persona (Enterprise Architect / AI Engineer / Developer):

### Hero Tier (always visible, large)

| Data | Position | Why |
|------|----------|-----|
| Total system power (W) | Center, large digits | Instant feel for system load |
| Per-core utilization | Reactor ring arcs (E/P/S clusters) | Visual CPU topology awareness |
| GPU utilization | Outer reactor arc | AI/ML workload indicator |
| Thermal state | Center, below watts | Thermal throttling awareness |
| CPU temperature | Center stats | Throttle proximity |

### Primary Tier (side panels)

| Data | Position | Why |
|------|----------|-----|
| GPU temperature | Right panel | GPU-heavy workload monitoring |
| Memory used / total | Right panel | Container/VM memory awareness |
| Swap pressure % | Right panel | Performance cliff indicator |
| DRAM bandwidth (R/W) | Right panel | Memory-bound workload detection |
| DVHOP (hypervisor tax) | Left panel | Docker/VM overhead awareness |
| GUMER (UMA eviction) | Left panel | Unified memory pressure |
| CCTC (thermal cost) | Left panel | Sustained workload thermal budget |
| ANE power | Left panel | Neural Engine activity |

### Ambient Tier (chatter streams + floating panels)

| Data | Delivery | Why |
|------|----------|-----|
| Per-core frequency | Left chatter | Boost clock monitoring |
| Per-core utilization (individual) | Left chatter | Hotspot detection |
| Power deltas | Left chatter | Workload change awareness |
| Active thread count | Right chatter | System-wide concurrency |
| System uptime | Right chatter | Context |
| Telemetry frame counter | Right chatter | Liveness indicator |
| Network throughput (if available) | Right chatter / floating panel | Build artifact / model download awareness |
| Battery % + charging state | Bottom bar | Mobile awareness |

---

## 7. Technical Architecture

### New Modules

```
JarvisTelemetry/Sources/JarvisTelemetry/
├── HUDPhaseController.swift      — State machine (BOOT/LOOP/SHUTDOWN/STANDBY)
├── BootSequenceView.swift         — Full theatrical boot animation
├── ShutdownSequenceView.swift     — Cinematic power-down animation
├── ChatterEngine.swift            — Text event generation from telemetry deltas
├── ChatterStreamView.swift        — Scrolling text stream renderer
├── FloatingPanelManager.swift     — Lifecycle management for diagnostic popups
├── FloatingDiagnosticPanel.swift  — Individual floating panel view
├── AwarenessEngine.swift          — Threshold detection + ripple pulse triggers
├── AwarenessPulseView.swift       — Expanding ring ripple overlay
├── ParticleField.swift            — Ambient dust mote particle system
├── HolographicFlicker.swift       — Random glitch/tear effect overlay
├── DigitCipherText.swift          — Value display with hex-flip animation
├── ConnectiveWireView.swift       — Data-linking arc line overlay
├── SystemMoodEngine.swift         — Aggregated load → mood interpolation
├── ScannerOverlay.swift           — Periodic full-screen scan sweep
├── GhostTrailRenderer.swift       — Motion blur / afterimage for fast elements
├── LockScreenManager.swift        — PNG generation + wallpaper setting
├── ProcessLifecycleObserver.swift — Signal handlers + NSWorkspace notifications
```

### Modified Modules

```
├── JarvisHUDView.swift            — Add cardiac pulse, load-reactive speed,
│                                    ring harmonics, ghost trails, threat escalation
├── JarvisRootView.swift           — Replace simple preloader toggle with
│                                    HUDPhaseController state machine
├── AppDelegate.swift              — Add lifecycle observer registration
├── TelemetryStore.swift           — Add delta tracking (for chatter triggers),
│                                    mood computation, threshold events
├── JarvisPreloader.swift          — Refactor into BootSequenceView (keep SceneKit
│                                    wireframe chip, extend with new timeline)
├── AnimatedCanvasHost.swift       — Pass mood + phase controller to environment
```

### Data Flow (enhanced)

```
Go Daemon (1Hz JSON)
    ↓
TelemetryBridge (stream parser)
    ↓
TelemetryStore (normalize + @Published)
    ├──→ SystemMoodEngine (aggregate load → mood spectrum)
    │       ↓
    │    @Published mood: SystemMood (serene/calm/active/intense/overdrive)
    │       ↓
    │    HUDPhaseController (modulates all animation parameters)
    │
    ├──→ AwarenessEngine (threshold crossing detection)
    │       ↓
    │    AwarenessPulseView (expanding ripple rings)
    │
    ├──→ ChatterEngine (delta detection → text event queue)
    │       ├──→ ChatterStreamView (left — primary diagnostics)
    │       └──→ ChatterStreamView (right — ambient intel)
    │
    ├──→ FloatingPanelManager (periodic panel spawning)
    │       ↓
    │    FloatingDiagnosticPanel instances (materialize/hold/dissolve)
    │
    └──→ JarvisHUDView (reactor rendering)
            ├── Core pulse rate from mood BPM
            ├── Ring speed multiplier from mood
            ├── Threat escalation from thermal state
            └── Ghost trail intensity from ring speed
```

### Performance Considerations

- **Canvas rendering stays GPU-efficient** — all new overlays (chatter, particles, wires) are lightweight SwiftUI layers, not additional Canvas draws.
- **Particle system:** 30-50 particles is trivial — simple position+opacity structs updated per frame.
- **Chatter text:** Static Text views in a scrolling VStack. Old lines removed from array (max 15). No performance concern.
- **Floating panels:** Max 2 concurrent. Standard SwiftUI views with opacity/scale animations.
- **Holographic flicker:** Applied as a top-level `.offset()` + `.colorMultiply()` modifier on the root view. Zero-cost when inactive (99% of the time).
- **Awareness pulses:** Single expanding circle overlay. Trivial.
- **Connective wires:** Single Path shape animated with trim. Trivial.
- **Ghost trails:** Stored as ring of previous `phase` values (5 frames). Minimal memory.
- **Target: 60fps sustained** on M1 and above. The existing 220-ring reactor already achieves this.

### Lock Screen Strategy

- `LockScreenManager` renders the current HUD state to an offscreen `NSBitmapImageRep` (or `ImageRenderer` in SwiftUI).
- Saves as PNG to a known path in `~/Library/Application Support/JarvisTelemetry/`.
- Calls `NSWorkspace.shared.setDesktopImageURL()` to set it as wallpaper.
- On STANDBY entry: render once, set once.
- On LOOP exit (shutdown): the last fully rendered frame before rings stop becomes the standby image.

---

## 8. Color Palette (unchanged from existing, plus additions)

| Hex | Role | Usage |
|-----|------|-------|
| `#1AE6F5` | Primary teal-cyan | Rings, ticks, data arcs, chatter text, particles |
| `#8CFAFE` | Bright teal-cyan | Hero readouts, highlights, core glow |
| `#0E90A8` | Dim teal-cyan | Subtle accents, far-depth elements |
| `#FFC800` | Amber | P-Core arcs, thermal warnings, elevated mood |
| `#FF2633` | Crimson | S-Core arcs, critical alerts, threat escalation |
| `#668494` | Steel | Structural rings, bezels, degree markers |
| `#050A14` | Dark blue | Background |
| `#00334D` | Grid blue | Hex grid lines |
| `#0A0508` | Dark crimson | Background tint during threat escalation |
| `#FFFFFF` @ 0.12 | White highlight | Edge highlights on rings, core flash |

---

## 9. Summary of Everything Being Built

1. **Boot Sequence** — 8-12s theatrical with real hardware detection, SceneKit wireframe chip, particle trails, text streams
2. **Wake Boot** — 3-4s abbreviated re-ignition after unlock
3. **Main Loop** — 60fps reactive HUD with:
   - Cardiac core pulse (load-reactive BPM)
   - Load-reactive ring speed
   - Ring harmonics (periodic sync)
   - Full JARVIS chatter (2 streams + floating panels)
   - Digit cipher flip on all values
   - Holographic flicker (1-3x/minute)
   - Awareness pulses (threshold-triggered ripples)
   - Ambient particle field (30-50 motes)
   - Connective wire flashes
   - Emotional system mood (serene→overdrive)
   - Depth/parallax layering
   - Scanner overlay (every 30-45s)
   - Ghost trails on fast elements
   - Threat escalation (thermal crimson mode)
4. **Shutdown Sequence** — 5-8s with ring deceleration, particle implosion, core dimming, final flash
5. **Lock Screen** — Static standby PNG with dormant reactor + wallpaper API integration
6. **Lifecycle Management** — Signal handlers, sleep/wake observers, seamless phase transitions
