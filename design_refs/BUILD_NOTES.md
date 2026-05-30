# JARVIS_3.0 — Build Notes (techniques + reusable assets)

Distilled from research. Ralphy: use these to hit 60fps + the reference quality. The
reference "JARVIS 3.0" is the **sniperkillerut Rainmeter skin** (DeviantArt) — use the
4K video + `design_refs/` as the visual ground truth.

## Highest-leverage decisions
1. **PixiJS + `@pixi/filter-glow`/bloom for the reactor centerpiece** — NOT Canvas2D `shadowBlur` in the hot loop (CPU-expensive). Hardware glow at 60fps.
2. **SVG `stroke-dasharray` + animated `stroke-dashoffset`** for ALL ring elements: gold boot progress arc, segment-block ring, concentric tick rings. Add `filter: drop-shadow()` for glow. Compositor-thread, free.
3. **Layer-cake / OffscreenCanvas**: draw static layers (background rings, panel frames, circuit board, corner brackets) ONCE; only redraw the animated layer (turbine spin, radar sweep, pulsing glow).
4. **Arwes primitives** (animated frame corners, text-scramble, bleeps) for the panel chrome + boot "system waking" text feel.
5. **Mechanical hub** = supersarkar coil pattern: 8–16 divs/blades, `transform-origin` at center, `rotate()` increments, layered `box-shadow` glow. Iris/petal segments for the hub, tiny hot core — NOT a white blob.

## Per-element techniques
- **Turbine ring:** N rounded-rect blades, `rotate(2π/N)` loop; near-uniform length + travelling brightness wave; PixiJS Graphics batched + GlowFilter.
- **Tick rings:** SVG `<line>` rotated `i*360/N`, or canvas pre-rendered; counter-rotate layers.
- **Segment-block ring:** SVG `<circle>` with `stroke-dasharray:[seg,gap]` + glow.
- **Gold boot arc:** SVG circle, `stroke:#C9A227 + drop-shadow(#FFD700)`, animate `stroke-dashoffset` full→0, `rotate(-90deg)` start-at-top; driven by load %.
- **Orbital radar:** `sweepAngle += dt*speed`; filled arc with radial-gradient trail, `globalCompositeOperation:'lighter'`; blips with glow.
- **Circuit-bus flow:** SVG polylines + animated `stroke-dashoffset` signal; `<animateMotion>` dots.
- **LISTENING waveform:** Web Audio `AnalyserNode.getByteTimeDomainData` → canvas polyline (or polar for circular).

## Reusable assets (copy patterns)
- CSS-Tricks Arc Reactor: https://css-tricks.com/iron-mans-arc-reactor-using-css3-transforms-and-animations/
- CodePen arc reactor (supersarkar): https://codepen.io/supersarkar/pen/QmLEWN
- CodePen J.A.R.V.I.S. elements (samyAp): https://codepen.io/samyAp/pen/LrYZzz
- cursor-hud-themes (arc-reactor.svg + HUD CSS): https://github.com/mhdk1602/cursor-hud-themes
- sci-fi-HUD-FUI-website (panel arch): https://github.com/lee5214/sci-fi-HUD-FUI-website
- PixiJS + pixi-filters: https://github.com/pixijs/pixijs
- Arwes: https://arwes.dev
- SVG circular progress (gold arc): https://codepen.io/motionimaging/pen/LVoyvL
- Animated SVG circuit board: https://codepen.io/PickJBennett/pen/LgjZbE
- JARVIS 3.0 Rainmeter (component inventory): https://www.deviantart.com/sniperkillerut/art/Jarvis-3-0-Rainmeter-362310992

## Performance bar
Many animated panels → 60fps. Prefer SVG/CSS compositor effects + PixiJS WebGL for the
centerpiece; reserve Canvas2D for pre-rendered static blits. Honor `prefers-reduced-motion`.
