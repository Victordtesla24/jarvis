# JARVIS Animation Stack — Dependency Manifest

Locked dual-ecosystem dependency stack for the JARVIS Cinematic Animation pipeline.
Python dependencies are pinned via `uv.lock`; JavaScript dependencies are pinned via `js/package-lock.json`.

Generated: 2026-04-19

---

## Python Ecosystem (`uv` / `uv.lock`)

| Package | Version | Ecosystem | Cinematic Role |
|---|---|---|---|
| [playwright](https://github.com/microsoft/playwright-python) | 1.58.0 | Python / `uv` | Headless Chromium automation — drives E2E cinema smoke tests |
| [numpy](https://github.com/numpy/numpy) | 2.4.4 | Python / `uv` | Numerical arrays — bloom ROI pixel analysis, frame processing |
| [Pillow](https://github.com/python-pillow/Pillow) | 12.2.0 | Python / `uv` | Image I/O — screenshot loading and pixel assertion |
| [pytest](https://github.com/pytest-dev/pytest) | 9.0.3 | Python / `uv` | Test runner — executes all cinema pipeline smoke tests |
| [ffmpeg-python](https://github.com/kkroening/ffmpeg-python) | 0.2.0 | Python / `uv` | GIF/video frame extraction — JARVIS.gif proof capture |

---

## JavaScript Ecosystem (`npm` / `js/package-lock.json`)

| Package | Version | Ecosystem | Cinematic Role |
|---|---|---|---|
| [three](https://github.com/mrdoob/three.js) | 0.184.0 | npm | Core 3-D WebGL renderer — scene graph, materials, cameras for reactor animations |
| [postprocessing](https://github.com/pmndrs/postprocessing) | 6.39.1 | npm | Bloom, god-rays, depth-of-field post-processing passes over Three.js render |
| [gsap](https://github.com/greensock/GSAP) | 3.15.0 | npm | High-performance JavaScript tweening — animates HUD elements, ring rotations |
| [animejs](https://github.com/juliangarnier/anime) | 4.3.6 | npm | Timeline-based SVG motion-path animation — arc sweeps, particle paths |
| [ogl](https://github.com/oframe/ogl) | 1.0.11 | npm | Minimal WebGL library — lightweight raw-GL reactor geometry primitives |
| [regl](https://github.com/regl-project/regl) | 2.1.1 | npm | Functional GLSL wrapper — god-rays volumetric-light GLSL shader pipeline |
| [meyda](https://github.com/meyda/meyda) | 5.6.3 | npm | Real-time audio feature extraction (FFT, RMS) — audio-reactive reactor animations |
| [@tsparticles/engine](https://github.com/tsparticles/tsparticles) | 3.9.1 | npm | Particle engine core — arc reactor plasma particle VFX system |
| [tsparticles](https://github.com/tsparticles/tsparticles) | 3.9.1 | npm | Full tsParticles bundle — preset loaders for reactor energy particle effects |
| [pixi.js](https://github.com/pixijs/pixijs) | 8.18.1 | npm | 2-D WebGL renderer — UI overlay glyphs, data-readout HUD compositing |
| [motion](https://github.com/motiondivision/motion) | 12.38.0 | npm | Motion One animation library — declarative CSS-properties animation on HUD elements |
| [vite](https://github.com/vitejs/vite) | 8.0.8 | npm (dev) | ESM build bundler — bundles all animation libs into `prototypes/dist/` for browser consumption |

---

## System Prerequisites

| Tool | Required | Role |
|---|---|---|
| `uv` | ≥ 0.6.0 | Python package manager and virtual-env orchestrator |
| Python | 3.12+ | Runtime for playwright, numpy, Pillow, pytest, ffmpeg-python |
| Node.js | 20 LTS+ | Runtime for all JavaScript smoke tests and Vite builds |
| `npm` | 10+ | JavaScript package manager (lockfile: `js/package-lock.json`) |
| `ffmpeg` | 7+ | System video/GIF codec used by ffmpeg-python for frame extraction |

---

## License Notes

All packages above are MIT, Apache-2.0, or BSD licensed.
No LGPL-2.1 or incompatibly-licensed packages from `Jarvis-Desktop` are vendored (HC-8 compliant).
