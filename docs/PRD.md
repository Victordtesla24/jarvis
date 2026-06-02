# Product Requirements Document — J.A.R.V.I.S. Holographic Interface

**Version:** 1.0.0  
**Last Updated:** 2026-05-30  
**Status:** Shipped

---

## 1. Product Overview

J.A.R.V.I.S. (Just A Rather Very Intelligent System) Holographic Interface is a browser-based, camera-driven augmented-reality experience inspired by the Iron Man HUD. The user's live webcam feed becomes the background canvas; gesture recognition turns both hands into real-time controllers for a 3D holographic Earth, tactical terrain overlay, and a multi-layer sci-fi HUD.

The project is a creative showcase and HCI (human-computer interaction) prototype suitable for:

- Science / technology demonstrations
- Interactive art installations
- Gesture-based UI prototyping research
- Personal portfolio showcases

---

## 2. Goals

| Goal | Description |
|------|-------------|
| Gesture-first control | Every primary interaction is driven by bare-hand gestures — no mouse, keyboard, or touch required |
| Zero-install delivery | Runs entirely in a modern browser; no plugins or native installs needed |
| Immersive aesthetics | Holographic cyan-and-blue colour palette, bloom glow, scanlines, and procedural sounds sell the sci-fi fiction |
| Privacy-by-default | All camera processing is local; no video frames leave the browser |
| Graceful degradation | CDN fallbacks for MediaPipe WASM and remote texture assets; audio requires explicit user interaction per browser policy |

---

## 3. Users

**Primary:** Developers, designers, and tinkerers who want to demo or extend gesture-UI concepts.  
**Secondary:** Audiences at live demos or exhibitions who interact with the running interface.  
**Excluded:** Mobile users (camera-angle and GPU constraints make gesture tracking unreliable on phones).

---

## 4. Feature Specification

### 4.1 Boot Sequence

| Step | UI State | Duration |
|------|----------|----------|
| 0 — Idle | "INITIALIZE J.A.R.V.I.S." button + LOGIN button on a black background with animated rings | Until user click |
| 1 — System Boot | Progress bar at 10%, log line: "Memory allocation check..." | 0 – 800 ms |
| 2 — Neural Network Load | Progress bar at 60%, log line: "Loading MEDIA_PIPE.WASM..." | 800 – 1800 ms |
| 3 — Authentication | Progress bar at 100%, log line: "Access granted" | 1800 – 2500 ms |
| 4 — JARVIS Intro | Full-screen animated concentric rings with JARVIS title and TTS "Hello. I am Jarvis." | 2500 – 5300 ms |
| 5 — Main App | Camera feed active, 3D Earth rendered, HUD overlaid, ambient hum playing | Ongoing |

Sound events fired during boot: `playBlip` (immediate feedback on click), `playBootSequence` (2 s sweep), `speak` ("Hello. I am Jarvis."), `playAmbientHum` (continuous once booted).

### 4.2 Login Modal

A holographic authentication dialog is accessible from the boot screen.

- Trigger: "LOGIN" button (blue holographic style, positioned below the primary "INITIALIZE" button)
- Modal fields: User ID (text), Access Code (password)
- Validation: both fields required; shows "CREDENTIALS REQUIRED" on empty submit
- Actions: ACCESS (submit), CANCEL (dismiss)
- Styling: black background, cyan corner accents, `border-holo-cyan` glow shadow
- Backend: none — the modal is a UI-only prototype; `onLogin` callback prop is available for future integration

### 4.3 Gesture Recognition

**Engine:** MediaPipe Tasks Vision `GestureRecognizer` v0.10.9, running in `VIDEO` mode at up to 60 fps, tracking up to 2 hands simultaneously.

**Model loading strategy:**

1. WASM runtime: jsDelivr CDN → unpkg CDN (fallback)
2. Model weights: bundled `modules/gesture_recognizer.task` (local) → Google Storage CDN (fallback)

**Per-frame output** (normalised screen coordinates, 0–1):

| Signal | Source landmark(s) | Range | Used by |
|--------|--------------------|-------|---------|
| `pinchDistance` | Thumb tip (4), Index tip (8) | 0–~0.3 | Both hands |
| `isPinching` | `pinchDistance < 0.05` | bool | Right hand |
| `expansionFactor` | `pinchDistance` normalised to 0.02–0.18 | 0–1 | Left hand |
| `rotationControl.x` | Middle-finger MCP (9) x position, centred | -1 – 1 | Right hand |
| `rotationControl.y` | Middle-finger MCP (9) y position, centred | -1 – 1 | Right hand |

### 4.4 Holographic Earth

Rendered in a full-viewport Three.js canvas via `@react-three/fiber`.

**Layers (inner → outer):**

| Layer | Geometry | Material |
|-------|----------|----------|
| Earth surface | `SphereGeometry` (64 segments) | `MeshPhongMaterial`, 2048-px colour/normal/specular maps, additive blending, blue tint |
| Cloud shell | `SphereGeometry` (r×1.01) | `MeshBasicMaterial`, colour map as cyan overlay, additive blending |
| Wireframe shell | `IcosahedronGeometry` (detail 2) | `MeshBasicMaterial`, klein-blue wireframe, additive blending |
| Particle field | 500 points in sphere (r = 2.2) | `PointMaterial`, cyan, size 0.015 |
| Equatorial ring | `RingGeometry` (r 2.0–2.4, 128 seg) | `MeshBasicMaterial`, cyan, double-sided, additive blending |

**Post-processing:** Bloom (luminance threshold 0.2, mipmap blur, intensity 1.5, radius 0.6).

**Lighting:** Ambient (blue, 0.2 intensity) + cyan point light (10,10,10) + magenta point light (-10,-10,-5).

**Gesture-driven animation:**

- Right hand `rotationControl.x` → Earth yaw speed (default ambient spin 0.0005 rad/frame; gesture maps to ×0.05)
- Right hand `rotationControl.y` → Group pitch speed (×0.05)
- Left hand `expansionFactor` → Smooth zoom (lerp factor 0.08); cloud and wireframe scale with expansion; ring radius and tilt also animated

**Region detection** (based on Earth `rotation.y` modulo 2π):

| Degrees | Region |
|---------|--------|
| 30 – 100 | AMERICAS SECTOR |
| 100 – 190 | PACIFIC MONITORING ZONE |
| 190 – 280 | ASIA WAR ZONE |
| 280 – 330 | AFRICA RESOURCE ZONE |
| All others | EUROPE DEFENSE ZONE |

**Earth → Terrain transition:**

- `expansionFactor` 0.0 – 0.4: Earth fully visible
- 0.4 – 0.6: Earth fades out (opacity 1 → 0)
- 0.5 – 1.0: Tactical terrain fades in (progress 0 → 1)
- Sound: `playMapSwitch` fires once when expansion crosses 0.55

### 4.5 Tactical Terrain (Iron Man HUD Mode)

Procedural terrain rendered as a separate Three.js group that replaces the Earth above 50% expansion.

**Terrain generation (run once on mount):**

- `PlaneGeometry` 12×12 units, 64×64 segments
- Elevation: FBM-like composition of `sin`/`cos` functions; valleys flattened
- Per-vertex colour: cyan peaks, dark-blue lowlands (vertex colours, `MeshBasicMaterial`)
- Fill mesh (black, double-sided) occludes geometry from behind
- Base grid: `gridHelper` 30×30

**Target markers (12 random positions across the 10×10 area):**

Each marker is a Three.js group containing:
- Vertical tether (thin `CylinderGeometry`, cyan, additive blending)
- Billboard head: outer arc ring (partial), inner square ring, red centre dot, label billboard (`Text` from drei)
- Label text: location name chosen from a 12-item pool (SECTOR 7, ALPHA BASE, etc.)
- Animation: outer ring rotates; centre dot pulses; head always faces camera

**Radar ring:** Expanding `RingGeometry` that loops every 2 seconds, fading out.

**Terrain orientation:** Rotated -72° around X axis for a slanted tactical perspective; slowly rotates on Z axis (0.05 rad/s).

### 4.6 HUD Overlay

A full-viewport absolutely-positioned layer (`pointer-events: none`) composed of a 2D canvas and React DOM elements.

**Canvas layer (real-time, `requestAnimationFrame`):**

| Element | Description |
|---------|-------------|
| Hand skeleton | Dashed lines connecting 21 MediaPipe landmarks per hand; cyan for right, blue for left |
| Joint dots | 3-px filled circles at each joint; fingertips (4,8,12,16,20) get rotating arc indicators |
| Palm label | "ID: RIGHT-HAND-01" / "ID: LEFT-HAND-02" with rotating partial arc |
| Expansion gauge | Circular arc gauge near left wrist; cyan normally, red + glow at >95%; shows percentage and "MAX OUTPUT" label |
| Pinch reticle | Red circle + dot at thumb/index midpoint when pinching |
| Connector line | Dashed line from pinch point to intelligence panel origin |

**React DOM layer (static/reactive):**

| Widget | Position | Content |
|--------|----------|---------|
| System status | Top-left | "STARK INDUSTRIES", "MARK VII HUD FIRMWARE V8.0.3", scrolling hex dump (80ms interval) |
| Title / clock | Top-right | "J.A.R.V.I.S." gradient text, "LIVE FEED" blink badge, millisecond clock (50ms interval) |
| Circular gauges | Left-centre | Primary Storage 74%, Power Cells 98% (with spinning rings) |
| File tree | Bottom-left | Static directory tree: RainMeter > Resources > Browser/Themes, Emergency node |
| Biometric status | Bottom-left (below tree) | Left/Right hand tracking ONLINE / OFFLINE indicators (live from `handTrackingRef`) |
| Visuals frame | Right (below title) | Placeholder image grid with "STANDBY" label |
| Arc Reactor | Right-centre | Three concentric animated rings simulating a reactor core |
| Communication feed | Bottom-right | Data feed list: gmail, wikipedia, da-rainmeter, lifehacker, gizmodo, kotaku, twitter |

**Intelligence panel (dynamic, pinch-triggered):**

- Appears / disappears on right-hand pinch state transitions (with `playLock` / `playRelease` sounds)
- Floats at index-finger-tip position + (50px, -100px) offset
- Content: current `RegionName`, signal strength bar (98%), longitude / latitude grid (static 116.4074 / 39.9042)
- Visual: black background, red left-border, red ping indicator, flash entrance animation

### 4.7 Visual Effects

| Effect | Implementation |
|--------|---------------|
| Scanlines | CSS `background-size: 100% 4px` repeating gradient, z-index 10 |
| Vignette | CSS `box-shadow: 0 0 150px rgba(0,0,0,0.9) inset` |
| Bloom | `@react-three/postprocessing` `Bloom` effect on the 3D canvas |
| Camera feed | Video element: 40% opacity, 125% contrast, 75% brightness, 30% greyscale, mirrored (`-scale-x-100`) |
| Fonts | Orbitron (display/title), Rajdhani (body/mono) via Google Fonts |
| Tailwind theme | Custom colours: `klein-blue` #002FA7, `holo-cyan` #00F0FF, `holo-blue` #00A3FF, `alert-red` #FF2A2A |

### 4.8 Sound Design

All audio is synthesised in real-time via the Web Audio API (no audio files):

| Sound | Method | Waveform | Duration | Trigger |
|-------|--------|----------|----------|---------|
| UI blip | `playBlip` | Sine 1200→2000 Hz | 50 ms | Boot button click |
| Lock | `playLock` | Square 200→50 Hz | 300 ms | Pinch start |
| Release | `playRelease` | Square 50→150 Hz | 200 ms | Pinch end |
| Servo grain | `playServo(intensity)` | Sawtooth + lowpass, pitch scales with intensity | 100 ms | Expansion change > 0.001 delta |
| Map switch | `playMapSwitch` | Dual: sawtooth bass sweep + sine chirp | 500 ms | Expansion crosses 0.55 |
| Ambient hum | `playAmbientHum` | Sawtooth 40 Hz continuous | ∞ | After boot intro |
| Boot sweep | `playBootSequence` | Sawtooth 50→800 Hz | 2 s | Boot start |
| TTS | `speak(text)` | Web Speech API, British male voice preferred | Variable | Intro screen |

Master gain: 0.15. `AudioContext` initialised on first user interaction (browser autoplay policy).

---

## 5. Technical Architecture

```
index.html          Tailwind CDN, Google Fonts, import-map (esm.sh CDNs), Vite entry
index.tsx           React 18 root mount

App.tsx             Boot-state machine + layer compositor
├── VideoFeed.tsx           Camera → MediaPipe → HandTrackingState (via ref)
├── Canvas (R3F)
│   └── HolographicEarth.tsx    Three.js Earth + TerrainModel, reads handTrackingRef
└── HUDOverlay.tsx          Canvas skeleton + React DOM HUD, reads handTrackingRef
    └── LoginButton.tsx     Authentication modal (UI only)

services/
  mediapipeService.ts       Singleton GestureRecognizer with CDN fallbacks
  soundService.ts           Singleton WebAudio context + all synth methods

modules/
  gesture_recognizer.task   Bundled MediaPipe model (WASM weights)

types.ts            Landmark, HandInteractionData, HandTrackingState, RegionName, PanelPosition
```

**State strategy:** Hand tracking data flows via a `useRef` (not `useState`) to avoid triggering React re-renders at 60 fps. The ref is read directly by Three.js `useFrame` callbacks and the canvas `requestAnimationFrame` loop.

**Rendering layers (z-index order):**

| Layer | Tech | z-index |
|-------|------|---------|
| Camera video | HTML `<video>` | 0 (base) |
| 3D scene | Three.js Canvas (R3F) | 10 |
| Scanlines / vignette | CSS pseudo-elements | 5–10 |
| HUD canvas (skeletons) | 2D Canvas | 20 |
| HUD DOM widgets | React DOM | 30 |
| Intelligence panel | React DOM (conditional) | 40 |

---

## 6. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Frame rate | ≥ 30 fps gesture tracking; ≥ 60 fps 3D render on discrete GPU |
| First paint | Boot screen < 1 s on a warm cache |
| MediaPipe init | < 5 s on a 10 Mbps connection (WASM ~2 MB) |
| Privacy | Zero network egress of camera frames |
| Bundle size | Three.js and MediaPipe are CDN-loaded; Vite build output covers only app code |
| TypeScript | Strict mode; `tsc --noEmit` must pass with zero errors |
| Test coverage | All previously-Chinese source files verified CJK-free; key English UI strings asserted |

---

## 7. Browser & Environment Requirements

| Requirement | Detail |
|-------------|--------|
| Browser | Chrome 110+ or Edge 110+ (WebGL2, WebAudio, SpeechSynthesis, MediaDevices) |
| Camera | Front-facing webcam; ideal 1280×720 |
| Permissions | `camera` (declared in `metadata.json`) |
| HTTPS | Required in production for `getUserMedia` (localhost exempt) |
| GPU | WebGL2 with GPU delegate for MediaPipe recommended; CPU fallback not implemented |
| Node.js | LTS (≥ 18) for local development only |

---

## 8. Development & Build

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server at `http://localhost:3000` (host `0.0.0.0`) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve production build locally |
| `npm test` | Vitest test suite (`vitest run`) |
| `npm run lint` | TypeScript type-check (`tsc --noEmit`) |

Tailwind is injected via CDN in `index.html`; for production or offline use, replace with a PostCSS + Tailwind CLI integration.

---

## 9. Deployment

- **Target:** Any static hosting (Vercel, Netlify, GitHub Pages, S3 + CloudFront)
- **Output:** `dist/` directory
- **CDN considerations:** MediaPipe WASM files and Three.js texture assets are fetched from external CDNs at runtime; ensure CORS headers permit cross-origin requests if proxying through a custom CDN
- **Environment variables:** `GEMINI_API_KEY` can be set in `.env.local`; Vite injects it via `import.meta.env`. Currently unused — reserved for future Gemini API integration

---

## 10. Known Limitations & Future Work

| Item | Notes |
|------|-------|
| Login has no backend | The authentication modal is a UI prototype; credentials are not validated or stored |
| Coordinates are hardcoded | Intelligence panel shows static `116.4074 / 39.9042` (Beijing); should derive from Earth rotation |
| HUD data is static | Storage %, power cells, O₂, temperature, and communication feeds are decorative constants |
| No mobile support | Touch / small-screen gesture tracking is not implemented |
| TTS voice availability | British male voice fallback depends on OS-installed voices; quality varies by platform |
| Gemini API stub | `GEMINI_API_KEY` env var is wired in Vite config but nothing calls it yet |
| Single-user only | No multi-user or networked state sharing |
| Accessibility | Interface is purely visual/gestural; no keyboard navigation or screen-reader support |
