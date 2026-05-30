# JARVIS — MASTER BUILD SPEC (state-of-the-art three.js HUD, combine ALL repos)

Deliver a state-of-the-art, cinematic, **holographic** JARVIS desktop HUD built on **three.js**,
combining ideas + reusing assets from every provided repo. No excuses, no "good enough".

## Hard architecture (one coherent stack — do NOT add React/Vite/Electron build)
The HUD is **vanilla HTML/CSS/JS + three.js (CDN importmap)**, served by the existing
`lib/dashboard.py` static server to the transparent Electron `.app`. The React/TS repos are
**design references to PORT to vanilla**, not to import. Keep the working backend + tests.

- **WebGL layer (three.js):** a full-bleed `<canvas>` holographic scene = the 3D **arc-reactor centerpiece** (concentric ring stack in depth, segment-block ring, dense turbine, iris hub — NOT a blob) + **UnrealBloom** + ambient holographic lighting + the green→blue volumetric wash + depth/parallax. Optionally the `reactor.mp4` as a screen-blended emissive backdrop. Spin/bloom techniques from `immersive-web-sdk`. Start from the existing 3D reactor on branch `wip/reactor3d` (85421ef) and elevate it.
- **DOM/CSS HUD overlay (on top of the canvas):** the panels — reuse `design_refs/JarvisInspiredUI` layout/CSS wholesale (left/right/mid/bottom panels, boot sequence, hud-corners, parallax). Port the **advanced dynamic widgets** from `design_refs/NeoCore/src/components` (DynamicWidget, FlowchartWidget, TacticalTerminal, CommandLog, ChatPanel) + `design_refs/Jarvis-HUD/components` (SystemMonitor, Terminal, ArcReactor) + their CSS into vanilla. These are the live, real-time panels.
- **Holographic mandate:** `design_refs/HOLOGRAPHIC.md` — every element translucent projected light, never solid.

## Reuse map (combine ideas, reuse what you can)
| Source | Reuse |
|---|---|
| `$CLAUDE_JOB_DIR/tmp/immersive-web-sdk` (cloned) | three.js scene/spin/bloom patterns for the reactor |
| `wip/reactor3d` branch | the in-progress 3D three.js reactor — build on it |
| `design_refs/JarvisInspiredUI` | full panel layout, boot, hud-corners, parallax, effects CSS (drop-in vanilla) |
| `design_refs/NeoCore/src` | advanced dynamic-widget designs + hud-styles.css (port to vanilla) |
| `design_refs/Jarvis-HUD` | ArcReactor/SystemMonitor/Terminal designs + gesture idea + Gemini service (port; optional) |
| `design_refs/reactor_FINAL.png`, `lib/dashboard_web/reactor.mp4` | reactor look + cinematic video |
| `jarvis-mlx` (cloned) | offline voice/LLM brain (Whisper+Phi3+MeloTTS) — wire in a later pass |

## Data + functionality (real)
- Poll `/api/stats` ≤2s → drive every panel/gauge/graph + reactor intensity (system.cpu_load_pct, ram.used_pct, disk.used_pct, docker.running_count, machines[], audit.actions_24h).
- Voice via existing `/api/voice` (interpret_command, read-only safety) + the "- LISTENING -" loop; commands via `/api/command`. PRESERVE these + cockpit + ⌘K + transparent `.app`.
- Keep the test suite GREEN (adapt for new DOM ids).

## Visual bar
Match `design_refs/ref_full_layout.jpg` + `ref_reactor_closeup.jpg` + `~/Downloads/JARVIS_EXPECTATIONS_4K.mov`. Palette cyan `#3ff0e0`/electric `#28e0ff`/hot `#eafdff` on `#03090c`. 60fps. Cinematic, holographic, every panel alive + data-driven. Verify side-by-side (freeze rAF or canvas toDataURL — live animation makes take_screenshot time out). No placeholder, no AI-slop.

Deliver in a git worktree off `main`; commit; report final screenshot path + view command + preservation confirmation.
