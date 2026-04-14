# Reconstructed System Prompt: JARVIS Telemetry Final Visuals & Personality System

## §1 · Project Identity
**Title:** JARVIS Telemetry Final Visuals & Living Entity Implementation
**Scope:** Enhance the native MacOS Swift application to become a fully reactive "living being" (personality system) and ensure the final visual layout matches the specific provided Iron Man target reference image, verified through automated screenshot and logging telemetry checks.
**Target Platform:** macOS Sonoma+ (Apple Silicon arm64 natively), Swift, SwiftUI, AppKit, Combine.
**Mission Statement:** Create a cinema-grade, emotionally-present Iron Man HUD that reacts to M-series hardware telemetry with absolute pixel-perfection mapped against the target state.

## §2 · Requirements
1. **Environment Setup**
   1.1. Configure all requested testing tools (mactop, macmon).
   1.2. Prepare project for building on Apple Silicon.
2. **Personality State Machine (JarvisPersonality.swift)**
   2.1. Implement `JarvisPersonalityState` enum ordered by priority: `powerCritical > critical > powerLow > strained > attentive > nominal`.
   2.2. Implement reactive transitions with 0.8s crossfade (`.easeInOut`).
   2.3. Log all state transitions to `~/Library/Logs/JarvisTelemetry/personality.log`.
   2.4. Trigger `attentive` if idle > 5 mins (animation: rings pulse, reverse scan, scan-line reverse).
   2.5. Trigger `strained` if CPU > 80% or thermal `.serious`.
   2.6. Trigger `critical` if CPU > 95% or thermal `.critical`.
   2.7. Trigger `powerLow` if Battery < 20% & not charging.
   2.8. Trigger `powerCritical` if Battery < 5% & not charging.
   2.9. Combine these triggers into a 1s interval polling system interacting with `TelemetryStore`.
3. **Full Manual UI/UX Test with Visual Evidence (Phase 1)**
   3.1. Evaluate TC-01: Central Arc-Reactor Ring System matches.
   3.2. Evaluate TC-02: CPU Performance Panel.
   3.3. Evaluate TC-03: GPU Telemetry Panel.
   3.4. Evaluate TC-04: Memory & ANE Panel.
   3.5. Evaluate TC-05: Network Activity Panel.
   3.6. Evaluate TC-06: Battery & Thermal Panel.
4. **Telemetry Data Authenticity Audit (Phase 2)**
   4.1. Run bash commands to extract ground-truth values.
   4.2. Verify displayed HUD values fall within ±5% tolerance.
5. **Visual Layout Redesign (Ralph Loop Target)**
   5.1. Reproduce the target state (second image) exactly, transforming the current layout into the highly asymmetrical Iron Man layout with gauges on the sides and top right.
6. **Performance Validation (Phase 5)**
   6.1. Maintain 60fps Lock.
   6.2. Evaluate latency under 600ms.
   6.3. Reaction time under 1200ms for powerCritical state.

## §3 · Success Criteria
- **SC-1:** `JarvisPersonality.swift` compiles and handles state changes deterministically based on real-time Combine telemetry.
- **SC-2:** Log written reliably to `~/Library/Logs/JarvisTelemetry/personality.log`.
- **SC-3:** The `tests/evidence/telemetry-audit.md` contains accurate comparisons.
- **SC-4:** The final rendered SwiftUI HUD strongly resembles the target image structure (side panels, detailed ring typography).

## §4 · Constraints & Validation Gates
- **Constraint 1:** No mock data. All data must read from IOKit, SMC, Mach, AppKit.
- **Gate 1:** Code must compile successfully (`swift build --disable-sandbox`).
- **Gate 2:** Personality system must respond physically in the view.

## §5 · Test Plan
- Scenario A: Battery drops below 5% -> Triggers Power Critical UI, flickers rings.
- Scenario B: CPU spikes > 95% -> Emits sparks, red glow, "SYSTEMS OVERLOADED".
- Scenario C: Idle > 300s -> Reverse ring scan, pulse glow.

## §6 · Deliverables Map
- `JarvisPersonality.swift` -> Requirement 2 -> SC-1, SC-2 -> Code inspection & compilation.
- Target Layout in `JarvisHUDView.swift` -> Requirement 5 -> SC-4 -> Visual screenshot match.
- `telemetry-audit.md` -> Requirement 4 -> SC-3 -> Markdown validation.

## §7 · Quality Standards
- No placeholders whatsoever.
- Strict SwiftUI best practices with high-performance `Canvas`.
- UI structure aligns to standard Apple ecosystem conventions.

## §8 · Execution Order
1. Scaffold `JarvisPersonality.swift` and integrate into the Application tree.
2. Refactor `JarvisHUDView.swift` and related views to match the new asynchronous Iron Man target layout.
3. Hook up state transitions to visual rendering.
4. Test and capture layout matches.
