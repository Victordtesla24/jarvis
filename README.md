# J.A.R.V.I.S. Holographic Interface

A cinematic, Iron-Man-style holographic command dashboard built with React, TypeScript, and React-Three-Fiber. It features a fully procedural 3D arc-reactor with gesture-driven dis-integration, a deck of six live gesture- and AI-driven instruments, an atomic-orbital star-dust particle field, and a J.A.R.V.I.S. console wired to a streaming reasoning core.

> Tech stack: React 18 · TypeScript · Vite 6 · Three.js / React-Three-Fiber · MediaPipe · Tailwind CSS

## Features

- **Cinematic boot sequence** (`src/components/BootSequence.tsx`) — a 14-second power-on: HUD reticle assembly → camera fly-through → plexus neural-network → reactor-core ignition → "J.A.R.V.I.S." glitch reveal. Skippable, and respects `prefers-reduced-motion`.
- **Procedural 3D arc-reactor** (`src/components/relativity/ReactorCore3D.tsx`) — emissive geometry with two-tier selective bloom. Two-hand gestures (or the mouse wheel) drive a depth-tunnel **dis-integration / re-integration**, with an ultra-fine **atomic-orbital star-dust** field that blooms out of the core.
- **Gesture-driven instrument deck** (`src/components/widgets/`) — six live instruments (Proximity Radar, Neural Lattice, Core Gauges, Spectrum Analyser, Voice/Waveform, Orbital Scanner). Each reads the operator's hands **and** the agent's state every frame. Toggle between the instrument deck and the classic dense HUD.
- **J.A.R.V.I.S. AI console** (`src/components/JarvisConsole.tsx`) — streams tokens/reasoning from a Dockerized reasoning core over `/api/jarvis`, and drives the whole dashboard via a shared `AgentBus` (mood / intensity / activity), so the reactor and instruments react to the AI in real time.
- **Camera-free & silent by default** — gesture tracking (webcam + MediaPipe) is strictly opt-in via the on-screen `GESTURES` toggle.

## Project structure

```
.
├─ index.html                 # Vite entry HTML (loads /src/main.tsx)
├─ src/
│  ├─ main.tsx                # React mount + ?core / ?orbitals lab routes
│  ├─ App.tsx                 # Boot → dashboard state machine + layer composition
│  ├─ index.css               # Tailwind v4 theme + HUD animation primitives
│  ├─ types.ts                # Shared types & enums
│  ├─ assets/                 # Bundled assets (MediaPipe gesture-recognizer model)
│  ├─ components/
│  │  ├─ BootSequence.tsx · HUDOverlay.tsx · JarvisConsole.tsx · GestureController.tsx · …
│  │  ├─ relativity/          # 3D reactor, HUD dial, atomic orbitals, lab views
│  │  └─ widgets/             # The six gesture/AI-driven instruments + deck
│  └─ services/               # agentState (AgentBus), jarvisService, mediapipe, sound
├─ agent/                     # Dockerized reasoning core (Python) served at /api/jarvis
├─ docs/                      # PRD and design docs
├─ scripts/                   # Dev/utility scripts
├─ docker-compose.yml         # Runs the reasoning core
└─ vite.config.ts · tsconfig.json · tailwind.config.js · postcss.config.js
```

## Quick start

**Requirements:** Node.js (LTS) and a modern WebGL2 browser (Chrome/Edge recommended).

```bash
npm install
npm run dev        # dev server on http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build → dist/
npm run preview    # preview the production build
npm test           # vitest unit tests
npm run lint       # tsc --noEmit typecheck
```

**Reasoning core (optional):** the J.A.R.V.I.S. console talks to a Dockerized brain proxied at `/api`. Start it with:

```bash
docker compose up --build
```

Provide provider API keys via a git-ignored `.env.local` (see `agent/` for what the brain expects). The dashboard runs fully without the backend — the console simply reports the core as offline.

## Usage

- Click **INITIALIZE J.A.R.V.I.S.** to run the boot sequence (or **SKIP**).
- **GESTURES** toggle: opt into webcam hand-tracking. Move two hands apart to dis-integrate the reactor, together to re-integrate; hand motion also drives the instrument deck.
- **INSTRUMENTS** toggle: switch between the live instrument deck and the classic dense HUD.
- **GLOBE** toggle: switch the centrepiece between the reactor and the holographic Earth.
- Without a webcam, drag/scroll over the reactor to orbit and dis-integrate it.
- Lab routes for isolated iteration: `?core` (reactor) and `?orbitals` (atomic-orbital field).

## License

MIT — see [LICENSE](LICENSE).
