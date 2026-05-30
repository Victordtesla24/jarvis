# JARVIS — MASTER BUILD SPEC v2 (React-Three-Fiber, STATE OF THE ART, combine ALL repos)

Deliver a **state-of-the-art**, cinematic, **holographic** JARVIS desktop HUD. Nothing below
top-end is acceptable. Base stack = **React + Vite + React-Three-Fiber + @react-three/postprocessing**
(the `jarvis-holographic-1.0.0` stack), because that is what maximally reuses the provided repos.

## Base + stack (PIVOT to R3F — this maximizes reuse)
- **Base app:** `design_refs/jarvis-holographic` (React 18 + Vite 6 + three 0.164 + @react-three/fiber + drei + @react-three/postprocessing). Build on it. Translate its Chinese UI → English.
- **Delivery:** `vite build` → static bundle. Serve the built `dist/` from `lib/dashboard.py` (add SPA/static-dir serving) and/or load it in the Electron `.app`. The Python backend (`/api/stats`,`/api/voice`,`/api/command`) is REUSED unchanged — the React app calls it via `fetch`.

## Reuse map (combine — reuse code where stacks match, port where they don't)
| Source (in design_refs/ or tmp clones) | Reuse |
|---|---|
| `jarvis-holographic` (R3F) | BASE: HolographicEarth (R3F three.js centerpiece), HUDOverlay (multi-layer sci-fi HUD: trails/scanlines/gauges/data lists), JarvisIntro (boot + TTS), soundService, gesture/MediaPipe (optional) |
| `NeoCore/src/components` (React) | DynamicWidget, FlowchartWidget, TacticalTerminal, CommandLog, ChatPanel + hud-styles.css — drop in as React components |
| `Jarvis-HUD/components` (React) | ArcReactor, SystemMonitor, Terminal designs + Gemini service idea |
| `JarvisInspiredUI` (vanilla) | panel layout ideas, boot stages, hud-corners, effects CSS — port to React/CSS |
| `tmp/immersive-web-sdk` (three.js) | scene/spin/bloom patterns for the reactor |
| `wip/reactor3d` branch + `reactor_FINAL.png` + `lib/dashboard_web/reactor.mp4` | the arc-reactor look/video centerpiece |
| `tmp/jarvis-mlx` | offline voice/LLM brain (Whisper+Phi3+MeloTTS) — wire later pass |

## The centerpiece (state of the art)
A R3F **arc reactor** (concentric ring stack in true depth, segment-block ring, dense turbine, iris hub — NOT a blob) rendered with **@react-three/postprocessing**: SELECTIVE **Bloom** + **ChromaticAberration** + **Scanline** + **Vignette** (+ optional GodRays/Noise). Holographic Fresnel/scanline **shaderMaterial** on the rings; GPGPU/instanced **particle** field ("data dust"); the `reactor.mp4` as a screen-blended emissive backdrop plane. Keep the holographic **globe** available too (mode toggle). Spin/breathe driven by live CPU load.

## SOTA techniques to use (no shortcuts)
- @react-three/postprocessing EffectComposer (Bloom strength tuned, mipmapBlur), drei `<Float>`/`<Sparkles>`/`useTexture`/`shaderMaterial`, react-spring/GSAP for the boot assembly, layered z-depth + pointer parallax, additive blending, Fresnel rim shaders, scanline/grain, prefers-reduced-motion. Hold 60fps (instancing, frustum, on-demand invalidation).

## Data + functionality (REAL)
Poll `/api/stats` ≤2s → drive every panel/gauge/graph + reactor intensity. Voice via `/api/voice` (read-only interpret_command) + "- LISTENING -" loop. Commands via `/api/command`. Preserve the read-only safety contract.

## HOLOGRAPHIC mandate (design_refs/HOLOGRAPHIC.md)
Every element = translucent projected light (low-alpha glass + blur + glowing edges + parallax + scanlines), never solid. Transparent background (true desktop overlay in the `.app`).

## Bar
Match `ref_full_layout.jpg` + `ref_reactor_closeup.jpg` + `~/Downloads/JARVIS_EXPECTATIONS_4K.mov`, at a quality the user will only accept as STATE OF THE ART. Verify side-by-side (freeze rAF / canvas toDataURL — live animation times out take_screenshot). Build in a git worktree; `npm install && npm run build` must succeed; commit; report screenshot + how to run. Be honest about any gap.
