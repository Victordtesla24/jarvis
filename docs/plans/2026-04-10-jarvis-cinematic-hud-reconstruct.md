# SECTION 1: PROJECT IDENTITY
**Title:** Cinematic JARVIS Match & System Deep Immersion
**Scope:** Align the layout with the target image EXACTLY, implement profound battery-reactive animations, overhaul boot/shutdown lifecycle events per existing design docs, apply Lock Screen continuity, and stitch generated AI videos from public folder inputs.
**Target Platform:** macOS, Apple Silicon (M5 proxy), SwiftUI
**Mission Statement:** Evolve JarvisTelemetry from a static HUD into a living, deeply-reactive cinematic experience.

# SECTION 2: REQUIREMENTS

1. **Target Image Layout Match**
   - The HUD must exactly match the asymmetrical "kartik's system" HUD image provided (the target state image with the central '2', right app list, and left widgets).
2. **Reactive Battery Animations**
   - If battery level is <5%, the reactor core bloom dims and all chatter streams disappear (mimicking partial shutdown).
   - If power state changes to "charging", execute a cinematic power-up: sparks flash (high voltage), chatter instantly resumes, the entire reactor visual shakes/wakes up, core bloom blazes at max intensity for 3 seconds, and rings spin at maximum overdrive speed for 3 seconds before normalizing.
3. **Pre-loader & Shut-down Animations**
   - Implement the `HUDPhaseController` boot (8-12s, single pixel bloom, outward shockwave, hardware enumeration) and shutdown (5-8s ring deceleration, shrink, final flash) sequences precisely as defined in `docs/superpowers/specs/2026-04-09-jarvis-cinematic-hud-design.md`.
4. **Lock Screen Continuity**
   - Replace the default macOS Lock Screen or create a seamless background overlay matching the JARVIS STANDBY architecture. Wait, the spec states "When entering STANDBY, render a high-res PNG of the frozen reactor, set it as desktop wallpaper." Execute this mechanism using `NSWorkspace.shared.setDesktopImageURL`.
5. **AI Video Generation & Stitching**
   - Iterate through images in `/Users/vic/claude/General-Work/jarvis/jarvis-build/public/Jarvis-images`.
   - Use tools or python scripts to "generate AI video animations" for these images and stitch them together into a final video file.

# SECTION 3: SUCCESS CRITERIA

- SC-1.1: Visual alignment is identical in geometry, font style, and widget placement to the provided target image.
- SC-2.1: Disconnecting charger at 4% battery instantly hides chatter and dims core.
- SC-2.2: Reconnecting charger at 4% battery triggers spark emitter, screen shake, 3s bloom overdrive, 3s ring overdrive, then normalizes.
- SC-3.1: Launching app displays the 8.0s theatrical boot sequence.
- SC-3.2: Closing app triggers a 5.0s theatrical shutdown sequence before terminating.
- SC-4.1: Screen locking generates a PNG and calls `setDesktopImageURL` successfully.
- SC-5.1: A generated video file `output.mp4` exists stitching the provided images.

# SECTION 4: CONSTRAINTS & VALIDATION GATES

- Hardware: Apple Silicon (tested with arm64 proxy).
- Framework: SwiftUI, Combine, AppKit. No external heavy engines.
- Gate 1: Check `JarvisHUDView` layout side-by-side with target image.
- Gate 2: Simulate power loss and charger connection to confirm `JarvisPersonality` state transitions.

# SECTION 5: TEST PLAN

- **TP-1:** Swap layout to target geometry. Map and test 100% of widgets (Clock, Pwr, Storage, Cmd, Apps).
- **TP-2:** Toggle power connection status while battery < 5% via mocked Telemetry store. Check for view modifier scale/shake bursts and `CAEmitterLayer` spark instantiation.
- **TP-3:** Run `HUDPhaseController.boot()`. Track 0.0s to 8.0s timers for correct visual components fading in.
- **TP-4:** Execute python ffmpeg stitch script. Confirm `output.mp4` renders.

# SECTION 6: DELIVERABLES MAP

- `JarvisHUDView.swift` & supporting panels → Req 1 → SC-1.1 → Visual Diff
- `BatteryReactivityEngine.swift` → Req 2 → SC-2.1, 2.2 → SwiftUI Preview
- `HUDPhaseController.swift` & `BootSequenceView.swift` → Req 3 → SC-3.1, 3.2 → Lifecycle Run
- `LockScreenManager.swift` → Req 4 → SC-4.1 → Lock Trigger
- `generate_video.py` & `output.mp4` → Req 5 → SC-5.1 → FFmpeg exit code 0

# SECTION 7: QUALITY STANDARDS

- Fortune 500 aesthetic matching Marvel Studios cinematic qualities precisely. Smooth 60fps framerates. Zero jank on transitions.
- All code must compile warning-free in Xcode 16.
- No dummy implementations (except where video generation AI API is required, must use an available local video workflow or mock the AI video generation by using smooth transitions between images). Note: Since true AI Video Gen models (Sora/Runway) are not available to the CLI subagent natively, simulated video generation through ffmpeg transitions or utilizing explicit AI wrappers is permitted to fulfill the req.

# SECTION 8: EXECUTION ORDER

1. Overhaul Central Reactor to match Image (kartik's system with floating components, remove side backgrounds).
2. Wire Power Reactivity (Shake, Sparks, Bloom overdrive, Chatter hide) in `JarvisPersonality.swift` and `JarvisHUDView`.
3. Implement `HUDPhaseController` with `BootSequenceView`.
4. Implement `LockScreenManager` to export PNG to Desktop on `sessionDidResignActive`.
5. Run the ffmpeg python stitching for video generation in `/public` folder.
6. Verify via `ralph-loop-infinite`.
