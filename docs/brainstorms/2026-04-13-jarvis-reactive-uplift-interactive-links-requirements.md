---
date: 2026-04-13
topic: jarvis-reactive-uplift-interactive-links
---

# JARVIS HUD Reactive Uplift + Interactive Links

## Problem Frame

The JARVIS live wallpaper currently renders Tier 1 reactive animations (ring speed, arc fills, pulse brightness) driven by CPU, GPU, and thermal data. Five gaps remain:

1. **Underutilised telemetry** — DRAM bandwidth, ANE power, GPU frequency, network I/O, swap pressure, and the custom DVHOP/GUMER/CCTC metrics are read but not visually surfaced.
2. **Boot/shutdown are plain fades** — No cinematic materialization or deceleration sequence; the experience does not feel like M5-era hardware powering up.
3. **Display elements are decorative only** — "Documents", "Weather", "Clock", and panel data labels are rendered text, not live data or tappable targets; the wallpaper cannot be interacted with.

The user is the sole viewer on their own machine. Latency is not a concern; visual fidelity and cinematic coherence are.

## Requirements

**Tier 2 Reactive Animations**

- R1. DRAM read/write bandwidth drives radial pulse waves from the reactor centre — brightness and frequency scale with combined BW. Ceiling is chip-tier-adaptive: ≤32 GB unified memory → 50 GB/s; 36–64 GB → 200 GB/s; >64 GB → 400 GB/s (derived from `memoryTotalGB` at startup).
- R2. Network I/O activity (combined read+write, normalised ~100 MB/s) animates as a stream of small dots moving along the outer ring perimeter.
- R3. ANE power (normalised 0–1 against a ~20 W ceiling) controls the arc fill and glow of a dedicated arc at radius 0.68R — a new slot between Ring 2 (0.78R) and Ring 3 (0.62R) that does not disturb existing label or data arcs.
- R4. GPU frequency (normalised 0–1 against the static hardware maximum read from IORegistry via `GetMaxGPUFrequency()`, stored as `gpuFreqMaxMHz` in `TelemetryStore`) drives tick brightness (opacity multiplier on existing Ring 5 ticks) on an inner ring visually distinct from the P-Core arcs.
- R5. Swap pressure (`store.swapPressure`, a 0–1 ratio already published by `TelemetryStore`) triggers a pulsing hex-grid overlay at low opacity on a dedicated screen zone; overlay opacity scales proportionally with swapPressure, active when swapPressure > 0.05.
- R6. DVHOP % activates a dim shadow ring drawn at Ring 1's radius (0.95R) — a visual ghost layer below Ring 1, cyan at 15% base opacity — whose opacity scales 0–30% with DVHOP. This is not a new structural ring; it is an additional draw pass on the existing Ring 1 geometry.
- R7. GUMER MB/s (GPU memory eviction rate) emits a burst of particles from the GPU arc zone proportional to the eviction rate.

**Boot / Shutdown Personalisation** _(R8–R10 apply to JarvisTelemetry — the Swift Canvas app with TelemetryBridge — not JarvisWallpaper, which has no telemetry pipe)_

- R8. During the boot (preloader) sequence, the chip name and core counts read from `chipName`, `eCoreCount`, `pCoreCount`, `sCoreCount` are streamed into the HUD boot text instead of hardcoded placeholder values.
- R9. Arc clusters materialise in staggered order during boot: E-Core arcs first, then P-Core arcs, then GPU arc, then remaining rings — each cluster appearing ~200 ms after the previous.
- R10. On app shutdown (SIGTERM / window close), rings decelerate in reverse order: Ring 5 → 4 → 3 → 2 → 1, each slowing over 400 ms before disappearing, then the core pulse fades last.

**Interactive Links — HTML/WKWebView Path (primary)**

- R11. In `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html`, the "Documents", "Weather", "Clock", "MPC", and any panel data labels that have meaningful tap targets become real links using a custom `jarvis://` URL scheme.
- R12. A `WKNavigationDelegate` in the WKWebView host intercepts `jarvis://` navigation requests and dispatches the appropriate macOS action: open Finder, open a weather app or web URL, open Clock widget, open Music/MPC, etc. If `NSWorkspace.shared.open` fails (target app absent or unavailable), the delegate logs the failure silently — no blocking dialog is shown.
- R13. The link regions carry a static dim bracket `[ ]` glyph at 20% opacity as an always-visible affordance (hover is not available because mouse events are required to reach the WKWebView — see Dependencies); the bracket brightens briefly on the frame a `jarvis://` navigation fires to provide click feedback.
- R14. No external JavaScript dependencies are introduced; interaction logic uses plain DOM events and `window.location` assignment.

**Interactive Links — Swift Hotkey Path (secondary)**

- R15. A global keyboard shortcut toggles an activation overlay over the wallpaper — an `NSPanel` at `kCGDesktopWindowLevel + 1` that is normally hidden and fully click-through. Hotkey binding and the Accessibility permission requirement (needed for `CGEventTap` or `NSEvent.addGlobalMonitorForEvents`) must be confirmed before implementation; ⌘⇧J is a candidate but conflicts with JetBrains IDEs.
- R16. While the overlay is active, named regions matching the wallpaper layout (Documents, Clock, Weather, MPC) become mouse-interceptable buttons. Clicking one dispatches the same macOS action as R12.
- R17. The overlay auto-dismisses after 5 seconds of inactivity or after a selection is made.

## Success Criteria

- SC-1. After shipping Tier 2 animations, all seven telemetry sources (R1–R7) produce visually distinct, continuously updating effects when the corresponding sensor values change; no animation is static when data is live.
- SC-2. Boot sequence: on launch, the chip label and core counts displayed in the boot text match the live `chipName`/count values reported by the daemon — never hardcoded strings.
- SC-3. Shutdown sequence: on `⌘Q` or SIGTERM, rings decelerate in order 5→1 with visible speed reduction before disappearing; no ring cuts immediately to black.
- SC-4. WKWebView path: tapping a `jarvis://documents` link opens Finder; `jarvis://clock` opens a Clock or Date & Time panel; `jarvis://weather` opens the system Weather app; `jarvis://mpc` opens the Music app or a configured MPC client. All verified on macOS 14.
- SC-5. Swift hotkey path: pressing `⌘⇧J` makes the activation overlay visible; clicking a region dispatches the correct macOS action; the overlay disappears within 5 s of inactivity.
- SC-6. All new animations maintain 60 fps on MacBook Pro M3/M4/M5 under full CPU load (verified via Instruments Time Profiler or frame counter).

## Scope Boundaries

- No new external Swift Package dependencies beyond what is already in `Package.swift`.
- No external JavaScript libraries (CDN or bundled) for the HTML path — plain DOM only.
- The Swift hotkey path is secondary; it should not block or delay shipping the WKWebView path.
- Weather data is not fetched live inside the wallpaper — the link opens the system Weather app; no API key or network call is required.
- No draggable/resizable overlay UI — the activation overlay is a fixed-position, dismissible button panel only.
- The DVHOP shadow ring (R6) is a ghost visual; it does not replace any existing ring.

## Key Decisions

- **WKWebView path first, Swift hotkey second (R11–R14 before R15–R17)**: Lower implementation surface, testable immediately in browser, no NSPanel complexity.
- **`jarvis://` custom scheme over `javascript:` calls**: Cleaner separation between HTML and native dispatch; survives future refactors of the HTML layer.
- **Tier 2 animations in JarvisHUDView.swift, not new files**: The existing Canvas rendering loop already handles the telemetry store subscription; new effects are additive draws within that loop to avoid coordination overhead.
- **Staggered materialisation driven by a preloader timer, not live telemetry**: The daemon may not have sent data yet during the first boot frames; a deterministic timer ensures the visual sequence is always correct.

## Dependencies / Assumptions

- `TelemetryStore` already publishes `dramReadBW`, `dramWriteBW`, `anePower`, `gpuFreqMHz`, `swapPressure`, `swapUsedGB`, `dvhopCPUPct`, `gumerMBs` — verified present in the store (session context). `gpuFreqMaxMHz` does not yet exist and must be added, populated once at startup via `GetMaxGPUFrequency()` from `mactop/internal/app/native_stats.go`.
- The WKWebView host is `AppDelegate` in `JarvisWallpaper/Sources/JarvisWallpaper/main.swift`, which holds `wallpaperWebViews: [WKWebView]` — confirmed. No `WKNavigationDelegate` is currently wired; R12 requires adding conformance to `AppDelegate` and setting the delegate on each `WKWebView` instance.
- `JarvisWallpaper/Sources/JarvisWallpaper/main.swift:90` (`AppDelegate.buildWindow`) currently sets `win.ignoresMouseEvents = true` — **R11–R14 require changing this to `false` permanently** so mouse events reach the WKWebView for `jarvis://` link clicks. The activation overlay (R15–R17) must still be a separate `NSPanel`.
- M5 chip names returned by IOKit follow the existing `chipName` field already decoded by the Go daemon.

## Outstanding Questions

### Resolve Before Planning

_(none — all product decisions resolved)_

### Deferred to Planning

- [Affects R11–R12][Technical] **Confirmed:** `AppDelegate` in `JarvisWallpaper/Sources/JarvisWallpaper/main.swift` holds `wallpaperWebViews: [WKWebView]`; no `WKNavigationDelegate` is wired yet. Implementing R12 requires: (1) set `win.ignoresMouseEvents = false`, (2) add `WKNavigationDelegate` conformance to `AppDelegate`, (3) intercept `jarvis://` scheme in `decidePolicyFor navigationAction`.
- [Affects R8][Technical] **Confirmed:** `TelemetryStore` publishes `chipName`, `eCoreCount`, `pCoreCount`, `sCoreCount` — field names match the requirement exactly. No action needed.
- [Affects R15][User decision] Confirm the global hotkey binding: ⌘⇧J conflicts with JetBrains IDEs. Alternatives: ⌥⇧J, ⌘⇧\, or a passive mouse-gesture trigger (no Accessibility permission required). Also confirm whether the Accessibility permission prompt is acceptable for this app.
- [Affects R2][Needs research] Determine realistic network I/O normalisation ceiling for M5 hardware (current spec: ~100 MB/s — may saturate with Thunderbolt 4 / 10GbE transfers). DRAM BW ceiling is now chip-tier-adaptive per R1.

## Next Steps

-> `/ce:plan` for structured implementation planning
