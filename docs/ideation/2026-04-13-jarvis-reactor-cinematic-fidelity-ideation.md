---
date: 2026-04-13
topic: jarvis-reactor-cinematic-fidelity
focus: uplift HTML prototype (`jarvis-full-animation.html`) to close the reference-image fidelity gap for reactor core + rings
status: active
type: refactor
origin: docs/superpowers/specs/2026-04-09-jarvis-cinematic-hud-design.md
---

# Ideation + Plan: JARVIS Reactor Cinematic Fidelity Uplift (HTML Prototype)

## Overview

Raise the HTML prototype (`jarvis-full-animation.html`, mirrored at `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html`) to match the realistic Iron Man arc reactor aesthetic captured in `public/Jarvis-images/` references. The 2520-line prototype already has a layered multi-canvas architecture, 12-ring HUD, partial blade spokes, and full chatter streams — but the reactor core reads as schematic rather than cinematic. This document merges the `ce:ideate` survivor set (9 ideas from 45 raw candidates) with concrete implementation hooks for each of the prototype's draw functions.

**Target artefact:** `jarvis-full-animation.html` (root, 93 KB, 2520 lines) and its mirrored copy in `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html`. Both files are byte-identical; all edits must be applied to both.

**Non-target:** the Swift `JarvisTelemetry/` native HUD. The same idea set applies there but through different rendering primitives (SwiftUI Canvas + Metal shader + CAEmitterLayer). That Swift implementation is a separate workstream.

## Problem Frame

The HTML prototype visibly diverges from the cinematic reference images across eight specific gaps:

| # | Gap | Reference evidence | Current prototype state |
|---|---|---|---|
| 1 | Flat 2D core → volumetric depth | Eapathy reactor has 3D self-shadowed star-in-box | Flat CSS-blurred radial gradients |
| 2 | Missing radial blade/stator pattern | `real-jarvis-02.jpg` has vertical turbine slats | Only top/bottom *flame spokes*, not full 360° stator |
| 3 | Missing geodesic dome center | Eapathy reactor has triangulated mesh sphere | Flat "2" digit inside an 80-line gauge ring |
| 4 | Outer rings are perfect circles | Eapathy has organic wispy wobble halos | All rings use `ctx.arc()` = perfect circles |
| 5 | Particles emit across entire screen, not rim haze | Eapathy has thick particle collar at rim | `spawnParticles()` fills entire viewport randomly |
| 6 | All layers render at identical perceived depth | References have clear parallax depth cues | ZStack of canvases, zero lateral offset |
| 7 | Pure cyan `#00D4FF` | References lean teal-cyan `≈ #1AE6F0` | Palette is exact `0,212,255` |
| 8 | Rings lack rotational variety | References show counter-rotation and non-repeating | Arbitrary hand-picked speeds, no golden-ratio spacing |

The brief is: close these eight gaps in the HTML prototype while respecting the existing layered-canvas architecture, the 60fps budget, and the "everything is vector, no images" aesthetic.

## Requirements Trace

- **R1.** Reactor core gains volumetric depth — Fresnel-like rim shading + multi-ring temporal parallax pulse stack.
- **R2.** Full 360° radial blade/stator pattern visible inside the inner housing ring, rotating continuously.
- **R3.** Geodesic dome (icosahedron 2D projection) visible at reactor center, rotating, stroked cyan.
- **R4.** Outer 1–2 rings exhibit organic sin-based wobble modulated by simulated CPU load.
- **R5.** Ambient particles cluster into a rim haze collar (~10 px annulus at `R × 0.95–1.05`) with tangential velocity bias.
- **R6.** At least 3 ring groups drift laterally against each other with `breathingPhase`-driven parallax offsets.
- **R7.** Palette shifts from `CY = '0,212,255'` to a teal-cyan (target: `CY = '26,230,245'` or `#1AE6F5`). All CSS variables, JS color constants, and the 2026-04-09 spec's color table updated in lockstep.
- **R8.** Ring rotation speeds retuned to irrational golden-ratio-spaced values with sub-sine jitter.
- **R9.** (Tier B) Raymarched / procedural noise-driven core interior — delivered as a WebGL overlay canvas OR approximated via layered Canvas 2D radial gradients with noise-sampled offsets.
- **R10.** (Tier B) Reactor appears to cast light onto the space beyond the reactor disc — a full-viewport radial falloff that tints the wallpaper background, visually unique to the JARVIS-as-wallpaper paradigm.

## Scope Boundaries

**In scope:**
- All edits to `jarvis-full-animation.html` and its mirrored Resources copy.
- New HTML/JS/CSS modules inside the existing `<script>` block (no new files — the prototype is deliberately single-file).
- Palette, canvas draw functions, particle system reshape, new procedural draw functions for dome and blades, new inner state fields in the `STATE` and `TEL` objects.
- 2026-04-09 spec color table update in `docs/superpowers/specs/2026-04-09-jarvis-cinematic-hud-design.md` for palette consistency.

**Out of scope:**
- The Swift native HUD (`JarvisTelemetry/Sources/JarvisTelemetry/*.swift`). A separate plan will translate the same idea set to Swift+Metal.
- New external image assets (the prototype is vector-only on purpose).
- New font loads (Orbitron, Audiowide, Rajdhani, Share Tech Mono are already available).
- SceneKit/RealityKit usage — prototype is HTML, and even for the Swift workstream SceneKit is quarantined to boot per the institutional learning surfaced in ce:ideate Phase 1.
- Perlin/Simplex noise libraries — institutional preference is sin-based wobble for determinism and CPU cost.

### Deferred to Separate Tasks

- Swift native HUD implementation of the same nine ideas — will be a separate plan in `docs/plans/`.
- AI video generation/stitching for `/public/Jarvis-images/*` → `output.mp4` (already captured in `docs/plans/2026-04-10-jarvis-cinematic-hud-reconstruct.md`).
- Target-image layout match for side-panel asymmetry (already captured in the reconstruct plan).

## Context & Research

### Prototype Architecture (grounding summary from ce:ideate Phase 1)

- **6 canvas layers** stacked by z-index in the CSS: `#hexCanvas (1, 0.15α)` → `#bloomCanvas (2, blur(26px) filter, 0.95α)` → `#mainCanvas (3)` → `#scanCanvas (4, mix-blend-mode: screen)` → `#fxCanvas (8)` → `#grainCanvas (9, mix-blend-mode: overlay, 0.05α)`. Plus `#hud` HTML overlay at z-index 5 and a vignette at z-index 7.
- **Main draw loop** in a single `requestAnimationFrame` chain, dispatches to `drawRings`, `drawCore`, `drawParticles`, `drawSparks`, `drawScanner`, etc.
- **STATE object** at `jarvis-full-animation.html:1392` carries `phase`, `phaseT`, `bloomMul`, `ringSpeedMul`, `overdriveBloom`, `batteryLow`, `charging`, `sparks[]`, `particles[]`, `pulses[]`.
- **TEL object** at `jarvis-full-animation.html:1414` simulates realistic MacBook telemetry (`cpuLoad`, `gpuLoad`, `memUsedGB`, `tempCPU`, `powerW`, `batteryPct`, etc.) with `tickTelemetry()` shifting values each second.
- **12-ring configuration** at `jarvis-full-animation.html:1661` — `RINGS[]` array with `rel`, `type` (`ticks`/`seg`/`dashed`/`solid`), `lw`, `alpha`, `speed`, `segs`, `gap`. `drawRings()` at `:1704` iterates and draws each based on type.
- **Helpers:** `ring()`, `arcStroke()`, `segRing()`, `tickMarks()`, `rectPath()`, `line()`, `fillText()` at `:1543-1612`. `segRing` is the key hook — the new blade/dome functions should follow its signature pattern.
- **`drawCore()` at `:1755`** — already draws bloom radial gradients, top/bottom flame spokes (`topSpokes = 90`), inner gauge ring, and the center "2" digit in Orbitron font. This function is the primary target for the new blade and dome work.
- **Particle system** at `:1888-1911` — `STATE.particles[]` holds up to 38 screen-random motes with random velocities. `drawParticles(dt)` advances them on the `fxCanvas`.
- **Palette constants** at `:1372-1379` (`CY`, `CY_HOT`, `CY_DIM`, `AMBER`, `CRIMSON`, `STEEL`, `WHITE`) plus CSS custom properties at `:9-19`. Any palette shift must touch both JS strings and CSS vars in lockstep.

### Institutional Learnings (from ce:ideate Phase 1)

- **Sin-based wobble preferred over Perlin/Simplex** — the team's prior pattern (`sin(phase * rate + seed * 0.2) * amp`) is stateless, deterministic, cheap, and already used in Swift `ParticleField.swift`. Extend the same idiom to JS rather than importing a noise library.
- **Canvas 2D is adequate at 60fps** for the prototype — the 12-ring draw already sustains 60fps on M1+. New draw calls should stay under ~700 path ops/frame per the 2026-04-09 spec performance budget.
- **`segRing` is the canonical pattern** — new `drawRadialBlades()`, `drawGeodesicDome()`, and `drawWispyRing()` helpers should follow its `(ctx, cx, cy, r, col, lw, ...)` signature for consistency with the existing draw layer.
- **No new external JS dependencies** — the prototype is explicitly single-file, no CDN imports beyond the Google Fonts already in the `<head>`. Anything that requires a numeric library, WebGL helper, or noise package must be either implemented inline or dropped.
- **Bloom canvas uses a CSS filter, not a shader** — `#bloomCanvas { filter: blur(26px); }`. This is how the current bloom is achieved. A WebGL bloom can be added as a new canvas, but the existing CSS bloom should not be removed — it's load-bearing for the ambient glow.
- **Two HTML files to sync** — `jarvis-full-animation.html` (root) and `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html`. They are byte-identical. Every edit must be applied to both, or the JarvisWallpaper app will load a stale copy.

## Key Technical Decisions

1. **Single-file extension, no new modules.** The prototype is deliberately single-file for portability and WKWebView loading. All new draw functions live inside the existing `<script>` block, grouped logically near the existing `drawCore()`.
2. **Canvas 2D over WebGL for Tier A.** Tier A ideas (S1–S7) are achievable with Canvas 2D within the 60fps budget. Tier B ideas (S8, S9) may require WebGL overlay or creative 2D approximation; WebGL is evaluated per-idea.
3. **Sin-based wobble, not Perlin.** R4 (wispy rings) uses `sin(θ*3 + t*0.2) + sin(θ*7 + t*0.35)` form per institutional pattern. Avoids library imports and matches Swift workstream when it catches up.
4. **Palette shift is authoritative.** Teal-cyan `#1AE6F5 (26,230,245)` becomes the new primary. Update CSS `--cy`, JS `CY`, spec color table, and any CLAUDE.md reference in the same commit.
5. **Blade pattern replaces flame spokes at 360°, keeps flame crown as overlay.** The existing top+bottom `topSpokes` flames are load-bearing (they sell the "sun" quality at the reference image). Do not delete them. Add the new full-circle stator as a separate layer inside `drawCore()`.
6. **Geodesic dome replaces the 80-line gauge ring, preserves the center "2" digit.** The flat gauge feels schematic; the dome adds structural depth. The "2" stays as a foreground overlay (the dome frames it).
7. **Rim haze is a reshape of the existing particle system**, not a new system. Change `spawnParticles()` spawn distribution + `drawParticles()` motion physics rather than adding a third particle array.
8. **Tier B (S8, S9) are opt-in via STATE flags.** `STATE.highFidelityCore = false` and `STATE.castsDesktopLight = false` gate the new code. This keeps the prototype portable to low-power WebView contexts and lets reviewers A/B the effects.

## Open Questions

### Resolved During Planning

- **Do we add a WebGL canvas for raymarched core?** → Only if Canvas 2D approximation (layered radial gradients + noise-sampled offsets via sine lattices) is visibly insufficient after S6 (Fresnel + multi-ring) lands. Evaluated as part of S8.
- **Should the palette shift apply to CLAUDE.md's Color Palette table?** → Yes. CLAUDE.md is load-bearing documentation per the ce:ideate learnings research — any palette change updates docs in lockstep.
- **Do we keep both HTML files in sync manually or add a build step?** → Manual for now. A future task can add a pre-build hook to copy root → Resources. Out of scope here.
- **How does "reactor lights the wallpaper" translate to HTML?** → Two options evaluated: (a) full-viewport CSS `radial-gradient` on `body::after` with `mix-blend-mode: screen`, scaled to `bloomIntensity`. (b) A transparent-background `radial-gradient` canvas stretched across the full viewport. Option (a) is zero additional canvas cost and is the default; (b) is fallback if blend modes misbehave inside WKWebView.

### Deferred to Implementation

- **Exact blade count, dome vertex subdivision level, wispy ring octave counts, and ring RPM values.** Need to tune visually during iteration; planning guesses are starting points only.
- **Whether to retune `CY_HOT` and `CY_DIM` in addition to `CY`**, or only shift the base tone and let the highlights/dims derive. Likely yes, retune all three in lockstep.
- **How the palette shift interacts with the existing thermal threat escalation mode** (amber/crimson overrides). Needs verification that the threat palette still reads correctly against the new teal base.
- **Whether `ctx.filter = 'blur(Npx)'`** works consistently in WKWebView on macOS for the Fresnel soft rim. Fallback: draw a wider radial gradient instead of relying on canvas-level blur.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Draw stack with uplifts inserted

```
 z=0  #bgGradient        — CSS radial background
 z=1  #hexCanvas         — static hex grid                   [S7 retint]
 z=2  #bloomCanvas       — blur(26px) filter, radial glows   [S6 Fresnel adds here]
 z=3  #mainCanvas        — drawRings → drawCore              [S1, S2, S3, S4, S6 add here]
      │   drawRings(t, alphaMul)
      │     drawOuterBezel
      │     for each RINGS[i]:
      │       ctx.translateBy(±parallax)   [S7 inserts per ring tier]
      │       drawRing(i)                  [S3 wispifies outermost 2]
      │   drawCore(t, alphaMul)
      │     drawHousingRings
      │     drawRadialBladeStator          [S1 — new 360° blade ring]
      │     drawGeodesicDome               [S2 — replaces gauge ring]
      │     drawCenterDigit                [existing]
      │     drawFresnelRimGlow             [S6a — new Fresnel term]
      │     drawMultiRingPulseStack        [S6b — 5 concentric rings]
      │     drawTopBottomFlames            [existing, retained]
 z=4  #scanCanvas        — rotating sweep                    [S7 retint]
 z=5  #hud               — DOM text overlays
 z=7  #vignette          — edge darkening
 z=8  #fxCanvas          — particles + sparks                [S4 reshapes particle spawn]
 z=9  #grainCanvas       — static noise overlay
 body::after             — NEW full-viewport desktop light   [S9 — Tier B]
 #coreGL (new)           — NEW WebGL overlay for raymarch    [S8 — Tier B, optional]
```

### New STATE fields needed

```
STATE.breathingPhase       = 0         // drives S6 multi-ring stagger + S7 parallax
STATE.bladeCount           = 48        // S1 — number of stator blades
STATE.bladeRPM             = 0.08      // S1 — blade rotation rate, golden-ratio-spaced
STATE.domeRotation         = 0         // S2 — icosahedron Y-axis spin
STATE.domeSubdivisions     = 1         // S2 — 12 verts at level 1
STATE.wispyAmplitude       = 1.2       // S3 — radius offset amplitude in px
STATE.highFidelityCore     = false     // S8 — Tier B opt-in
STATE.castsDesktopLight    = true      // S9 — Tier B opt-in (on by default — cheap)
STATE.ringGoldenRatios     = [1.000, 1.618, 2.414]  // S7
```

### New helper signatures

```
drawRadialBlades(ctx, cx, cy, rIn, rOut, n, rotRad, col, alpha)
drawGeodesicDome(ctx, cx, cy, r, rotRad, col, alpha)
drawWispyRing(ctx, cx, cy, baseR, octaves[], t, col, lw)
drawFresnelRimGlow(ctx, cx, cy, r, power, col)
drawMultiRingPulseStack(ctx, cx, cy, rBase, count, t, col)
```

All helpers follow the existing `ring()` / `segRing()` / `tickMarks()` signature pattern.

## Implementation Units

### TIER A — Core Fidelity Uplift

- [ ] **Unit 1: Palette Shift — Teal-Cyan Retint**

**Goal:** Shift the primary cyan from pure `#00D4FF` to teal-cyan `#1AE6F5` across CSS custom properties, JS color constants, and the 2026-04-09 spec color table.

**Requirements:** R7

**Dependencies:** None — lowest-risk change, do first.

**Files:**
- Modify: `jarvis-full-animation.html` (CSS `:root` at `:8-19`, JS constants at `:1372-1379`)
- Modify: `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html` (mirror of above)
- Modify: `docs/superpowers/specs/2026-04-09-jarvis-cinematic-hud-design.md` (Section 8 Color Palette table)
- Modify: `CLAUDE.md` (HUD Color Palette table)

**Approach:**
- CSS: `--cy: #1AE6F5; --cy-hot: #8CFAFE; --cy-dim: #0E90A8`
- JS: `CY = '26,230,245'; CY_HOT = '140,250,254'; CY_DIM = '14,144,168'`
- Spec table: row for `#00D4FF` → replace with `#1AE6F5 / Primary teal-cyan`
- Verify thermal threat escalation (amber/crimson) still reads correctly against new teal base — eyeball the overdrive mode animation.

**Patterns to follow:** N/A (constant tuning only)

**Test scenarios:**
- Happy path: Load prototype in Chrome + Safari + WKWebView — all three show identical teal-cyan base. Reactor core, rings, particles, chatter, side panels all consistently tinted.
- Edge case: Trigger thermal threat state via dev console — amber/crimson escalation still reads as warning, not as a muddy clash with the new base.
- Integration: Side-by-side A/B screenshot against reference image `public/Jarvis-images/Jarvis Rainmeter Circle Animation By Eapathy.png` — primary tone visibly closer.

**Verification:** Screenshot matches Eapathy reference hue (target: within ΔE < 10 against rim particle tint). No broken palettes anywhere in the HUD.

**Complexity:** Low (trivial)

---

- [ ] **Unit 2: Rim Dust Haze Ring (particle reshape)**

**Goal:** Constrain ambient particles to a thick annulus at the reactor rim (≈ `R × 0.95` to `R × 1.15`) with tangential velocity bias, longer lifetime, and a slow radial breathing drift. Closes the "outward explosion → rim halo" gap.

**Requirements:** R5

**Dependencies:** Unit 1 (palette) — particles pick up the new teal tone from CY_HOT.

**Files:**
- Modify: `jarvis-full-animation.html` (spawnParticles at `:1888-1899`, drawParticles at `:1900-1911`)
- Modify: `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html` (mirror)

**Approach:**
- `spawnParticles()`: sample spawn position in annulus via `a = Math.random() * TAU; r = R * (0.95 + Math.random() * 0.20); x = CX + cos(a) * r; y = CY_ + sin(a) * r`.
- Cache each particle's `angle0`, `radius0`, `life`, and `phase` fields.
- `drawParticles(dt)`: update position via `p.angle += tangentialSpeed * dt; p.radius += sin(p.phase + t) * 0.3`; compute new `(x, y)` from updated polar coords.
- Tangential speed: `0.2 + (Math.random() * 0.1)` rad/s. Lifetime: 4–6s fade. Count: keep to ≤ 80 (headroom from the current 38).
- Alpha envelope: fade in 0.5s → hold → fade out 0.5s.

**Patterns to follow:** existing `STATE.particles[]` loop and `fxCtx.arc() + fill` rendering.

**Test scenarios:**
- Happy path: Load prototype — particles visibly cluster at the reactor rim, drifting tangentially. No particles outside the annulus.
- Edge case: Resize window mid-animation — particles recalculate rim radius from `R` and stay clamped.
- Edge case: Load at small window (e.g., 800×600) — rim annulus still looks like a haze collar, not a scatter.
- Integration: Compare against Eapathy reference — the "particle halo around the rim" quality is present.

**Verification:** No particles visible beyond `R × 1.2` or within `R × 0.9`. Particle count stable ≤ 80. 60fps maintained.

**Complexity:** Low

---

- [ ] **Unit 3: Radial Blade Stator Pattern (360° full-circle)**

**Goal:** Add a full 360° radial stator of trapezoidal blade shapes inside the reactor housing ring, rotating slowly, reproducing the Rainmeter reference's turbine-blade-on-end look. Preserves the existing top/bottom flame spokes as the "sun crown" overlay.

**Requirements:** R2

**Dependencies:** Unit 1 (palette) — blades pick up new teal tone.

**Files:**
- Modify: `jarvis-full-animation.html` (new `drawRadialBlades` helper near `:1612`; call added inside `drawCore` at `:1778` between housing rings and flame spokes)
- Modify: `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html` (mirror)

**Approach:**
- New helper: `drawRadialBlades(ctx, cx, cy, rIn, rOut, n, rotRad, col, alpha)`
- For `i` in `0..n`: compute `angle = rotRad + (i/n) * TAU`. Draw a closed `Path` quad with four corners at `(rIn, angle - bladeHalfW/rIn)`, `(rOut, angle - bladeHalfW/rOut)`, `(rOut, angle + bladeHalfW/rOut)`, `(rIn, angle + bladeHalfW/rIn)`. Fill with a linear gradient from hub-bright (alpha 0.9) to rim-dim (alpha 0.2).
- Call from `drawCore`: `drawRadialBlades(ctx, CX, CY_, R * 0.155, R * 0.205, STATE.bladeCount, t * STATE.bladeRPM, CY_HOT, alphaMul * STATE.bloomMul)`.
- Use `ctx.globalCompositeOperation = 'screen'` for brightness-adds-brightness layering (matches the existing flame spoke block at `:1786`).
- `STATE.bladeCount = 48`, `STATE.bladeRPM = 0.08` rad/s (slow, matches golden-ratio ring RPM spacing).
- Modulate individual blade alpha by `0.5 + 0.5 * sin(angle*2 + t*1.3)` for subtle breathing — no two adjacent blades in phase.

**Patterns to follow:** Existing `segRing()` at `:1562` and `drawCore()` flame spokes at `:1786`. The `ctx.globalCompositeOperation = 'screen'` + path-fill pattern is established.

**Test scenarios:**
- Happy path: Load prototype — 48 blades visible inside housing ring, rotating slowly, breathing alpha. Top flame "sun" still visible above.
- Edge case: Test blade count 24, 48, 96 — 48 reads best; document choice.
- Edge case: Test at 60fps — no frame drops with 48 blades + existing flame spokes.
- Integration: Side-by-side against `real-jarvis-02.jpg` — vertical blade pattern now matches reference category.

**Verification:** 48 blades render at 60fps. Reference side-by-side shows matching blade-assembly quality. No conflict with existing flame spoke layer.

**Complexity:** Medium (new helper + gradient composition)

---

- [ ] **Unit 4: Geodesic Dome Center (Canvas 2D icosahedron projection)**

**Goal:** Replace the flat 80-line gauge ring at the reactor center with a rotating 2D projection of an icosahedron, stroked cyan with variable alpha by fake vertex Z-depth. Preserves the center "2" digit as a foreground overlay.

**Requirements:** R3

**Dependencies:** Unit 1 (palette). Independent of Unit 3.

**Files:**
- Modify: `jarvis-full-animation.html` (new `drawGeodesicDome` helper near `:1612`; replace gauge ring at `:1836-1845` with dome call; preserve `:1847-1869` core glow + digit)
- Modify: `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html` (mirror)

**Approach:**
- Precompute 12 icosahedron vertices in 3D at module-init time (constant array). Optional level-1 subdivision to 42 vertices / 80 triangles.
- `drawGeodesicDome(ctx, cx, cy, r, rotRad, col, alpha)`:
  1. Apply Y-axis rotation matrix to each vertex: `x' = x*cos(rotRad) + z*sin(rotRad); z' = -x*sin(rotRad) + z*cos(rotRad); y' = y`
  2. Project to 2D: `screenX = cx + x' * r; screenY = cy + y' * r; depth = z'` (range `[-1, 1]`)
  3. For each edge in the precomputed edge list: stroke from `v_a` to `v_b` with alpha modulated by `((depth_a + depth_b)/2 + 1) / 2` (back edges fade, front edges bright).
- Rotation source: `STATE.domeRotation = t * 0.3 + STATE.breathingPhase * 0.15` so dome breathes with reactor.
- Precomputed vertex list: standard icosahedron `(±1, ±φ, 0)` + permutations, normalized, where `φ = (1 + √5) / 2 ≈ 1.618`.
- Edge list: 30 edges for level-0 icosahedron.
- Face list (for optional triangle fills): 20 faces.
- Size: `r = R * 0.11` (slightly larger than the old gauge ring at `R * 0.10`).
- Foreground digit "2" stays at the old position (`:1864-1868`), drawn after the dome — dome frames the digit.

**Patterns to follow:** `ring()`, `line()` helpers at `:1543`, `:1593`. Constant-time draw loop; no per-frame allocation.

**Test scenarios:**
- Happy path: Load prototype — 12-vertex icosahedron visible at reactor center, rotating, stroked cyan. Center "2" digit still readable in front.
- Edge case: Rotation rate verification — 1 full revolution every ~20 seconds at `bloomMul = 1`, slower at `bloomMul < 1`.
- Edge case: Small R (narrow window) — dome visible, not overlapped by inner gauge labels.
- Integration: Side-by-side against `Jarvis Rainmeter Circle Animation By Eapathy.png` — triangulated mesh quality matches.

**Verification:** Dome renders 12 vertices + 30 edges cleanly. Depth-modulated alpha produces perceptible front/back distinction. No flicker when rotating. 60fps maintained.

**Complexity:** Medium (new helper + rotation math + edge list)

---

- [ ] **Unit 5: Sin-Modulated Wispy Outer Rings**

**Goal:** Replace the outermost 2 rings (currently `ctx.arc()` perfect circles) with parametric paths sampled at 96 points, each radius offset by a sum of 2–3 low-frequency sines. Wobble amplitude modulated by `TEL.cpuLoad` so the rings "breathe" with system stress.

**Requirements:** R4

**Dependencies:** Unit 1 (palette).

**Files:**
- Modify: `jarvis-full-animation.html` (new `drawWispyRing` helper near `:1612`; `drawRings` at `:1704` dispatches wispy path for `i ∈ {0, 1}` — the outermost `rel: 0.99` and `rel: 0.91` rings)
- Modify: `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html` (mirror)

**Approach:**
- New helper: `drawWispyRing(ctx, cx, cy, baseR, octaves, t, col, lw)` where `octaves = [{freq: 7, amp: 1.2}, {freq: 13, amp: 0.6}, {freq: 23, amp: 0.3}]`.
- Sample 96 points around `TAU`. For each `θ`, compute `rOffset = Σ octaves.map(o => sin(θ * o.freq + t * o.freq * 0.03) * o.amp * (1 + TEL.cpuLoad))`.
- Final radius: `baseR + rOffset`. Build a single closed `Path` and stroke it.
- Apply only to the outermost 2 rings to preserve the "inner rings read as precise instruments" convention.
- Cost: 96 × 3 sine evaluations × 2 rings = 576 ops/frame. Well under budget.
- Wobble amplitude sensitive to `STATE.wispyAmplitude` (default 1.2 px) so implementer can tune.

**Patterns to follow:** Existing `ring()` helper at `:1543` — wispy version is a drop-in replacement for specific ring indices. The existing `drawRings` dispatch at `:1717–1747` already branches by ring type; add a new `'wispy'` type or dispatch based on `i`.

**Test scenarios:**
- Happy path: Load prototype — outermost 2 rings are visibly organic, wobbling. Inner rings remain perfect circles.
- Edge case: Trigger high CPU load state (`TEL.cpuLoad = 0.95`) — wobble amplitude visibly increases.
- Edge case: At `TEL.cpuLoad = 0` — wobble is very subtle but non-zero.
- Edge case: Octave frequency collision — verify coprime choices (7, 13, 23 are all prime → non-repeating) avoid static patterns.
- Integration: Side-by-side against Eapathy reference — the wispy halo quality is present.

**Verification:** 96 points × 3 octaves × 2 rings = 576 sine calls/frame, no frame drop. Visible wobble at all load levels. Inner rings untouched.

**Complexity:** Medium

---

- [ ] **Unit 6: Volumetric Core Depth — Fresnel Rim Glow + Multi-Ring Pulse Stack**

**Goal:** Add two compounding depth cues to the reactor core: (a) a Fresnel-like rim glow using layered radial gradients to simulate `pow(1 - dot(N, V), 3)` spherical shading; (b) a 5-ring concentric pulse stack at the core center, each ring phase-offset by 0.35s, reading as temporal parallax depth.

**Requirements:** R1

**Dependencies:** Unit 1 (palette), Unit 3 (blades so Fresnel reads on the blade housing), Unit 4 (dome so pulse stack frames the dome).

**Files:**
- Modify: `jarvis-full-animation.html` (new `drawFresnelRimGlow` and `drawMultiRingPulseStack` helpers; calls added inside `drawCore` at `:1778–1784`)
- Modify: `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html` (mirror)

**Approach:**

**(a) Fresnel rim glow** — approximated in Canvas 2D:
- `createRadialGradient(cx, cy, rInner, cx, cy, rOuter)` where `rInner = R * 0.19`, `rOuter = R * 0.23`.
- Color stops: `0.00 → rgba(CY, 0); 0.70 → rgba(CY, 0); 0.90 → rgba(CY_HOT, 0.85); 1.00 → rgba(WHITE, 0.95)`.
- Draw as `fillRect(CX-R, CY_-R, R*2, R*2)` clipped to the core disc via `ctx.save(); ctx.beginPath(); ctx.arc(CX, CY_, rOuter, 0, TAU); ctx.clip()`.
- Effect: bright wet rim at the boundary between housing and bloom, darker interior. Reads as spherical bulge.

**(b) Multi-ring pulse stack:**
- 5 concentric rings at base radii `R * 0.08, 0.10, 0.12, 0.14, 0.16`.
- Each ring has a scale animation: `scale[i] = 1.0 + 0.15 * sin(t * 1.4 + i * 0.7)`.
- Each ring has opacity: `alpha[i] = 0.35 + 0.35 * cos(t * 1.4 + i * 0.7)` (anti-phase with scale for pulse depth cue).
- Draw with `ring(ctx, CX, CY_, baseR * scale[i], rgba(CY_HOT, alpha[i] * alphaMul), 1.5)` inside `drawCore`.
- The eye integrates the lag between the 5 rings as depth, reading the stack as a volumetric tunnel.

**Patterns to follow:** Existing radial gradient composition at `:1763-1776` (solar flare + bg wash). The `ring()` helper at `:1543`.

**Test scenarios:**
- Happy path: Fresnel rim visible as a bright ring at the core boundary. Pulse stack visibly depth-parallax breathes.
- Edge case: Alpha clamping — verify no alpha exceeds 1.0 at rim intersection point.
- Edge case: 60fps budget — adding 5 concentric rings × 60fps = 300 ring draws/s. Well under Canvas budget.
- Integration: Side-by-side against Eapathy reference — the spherical bulge quality + temporal depth is present.

**Verification:** Reactor core visibly has volumetric depth vs. flat gradient baseline. 60fps maintained.

**Complexity:** Medium

---

- [ ] **Unit 7: Parallax + Differential Ring Choreography**

**Goal:** Two related tweaks to `drawRings` + `STATE`: (a) apply lateral translation to each ring group using `sin(breathingPhase) * depth` where depth varies per ring tier; (b) retune the `RINGS[]` speed values to golden-ratio-spaced irrationals with a sub-sine jitter on `STATE.ringSpeedMul`.

**Requirements:** R6, R8

**Dependencies:** None (independent of core units).

**Files:**
- Modify: `jarvis-full-animation.html` (`RINGS[]` array at `:1661`; `drawRings` at `:1704` inserts `ctx.translate(x, 0)` per group; `STATE` at `:1392` adds `breathingPhase` and `ringGoldenRatios`; main loop advances `STATE.breathingPhase += dt * 0.25`)
- Modify: `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html` (mirror)

**Approach:**

**(a) Parallax:**
- Add `STATE.breathingPhase = 0` and advance in main loop: `STATE.breathingPhase += dt * 0.25` (one full breath every 25s).
- In `drawRings`, partition `RINGS[]` into 3 tiers: `outer = 0..3`, `mid = 4..7`, `inner = 8..11`.
- Before drawing each tier: `const depth = [2, 5, 8][tierIndex]; const xOff = Math.sin(STATE.breathingPhase) * depth; ctx.save(); ctx.translate(xOff, 0);` then draw, then `ctx.restore()`.
- Max lateral offset: 8px. Barely perceptible but the brain integrates it as depth.
- Keep core (`drawCore`) fixed — only rings drift. Otherwise the reactor center feels unstable.

**(b) Golden-ratio ring RPMs:**
- Retune the `speed` field in `RINGS[]` to follow `±baseSpeed * (1.000, 1.618, 2.414, 3.883, ...)` pattern. Alternate signs for counter-rotation.
- Example for 12 rings: `speeds = [0.012, -0.019, 0.031, -0.050, 0.081, -0.131, 0.212, -0.343, 0.555, -0.898, 1.453, -2.351]` (Fibonacci-like progression).
- Add sub-sine jitter: `effectiveSpeed = r.speed * (1 + 0.03 * sin(t * 0.13))` — tiny wobble prevents rigid machine feel.

**Patterns to follow:** Existing `ctx.save() / translate / restore` pattern at `:1740-1745` (dashed ring rotation). Golden ratio φ = `(1 + Math.sqrt(5)) / 2`.

**Test scenarios:**
- Happy path: Rings visibly drift laterally against each other with breathing phase. Ring groups rotate at different rates, never synchronize.
- Edge case: Verify reactor center (core, blades, dome, digit) stays stationary.
- Edge case: 30s observation — no two rings ever line up visually (golden-ratio guarantee).
- Edge case: Breathing phase at `0, π/2, π, 3π/2` — parallax offset direction flips correctly.
- Integration: Compare against Rainmeter references — multi-speed counter-rotation quality matches.

**Verification:** Rings visibly stratified by depth. Rotation pattern is non-repeating over 30s observation window. Core is stable.

**Complexity:** Low-Medium

---

### TIER B — Bold Plays

- [ ] **Unit 8: Raymarched Plasma Core (WebGL overlay — opt-in)**

**Goal:** Add a new WebGL canvas at z-index 2.5 (between bloom and main) that runs a raymarched volumetric plasma shader when `STATE.highFidelityCore === true`. Feeds `TEL.cpuLoad` and `TEL.powerW` as shader uniforms. Fallback: if WebGL context creation fails, gracefully no-op and let S6 (Fresnel + pulse stack) carry the depth cue.

**Requirements:** R9

**Dependencies:** Unit 6 (Fresnel + pulse stack) — S8 is an enhancement on top, not a replacement. Defer until after Tier A is complete.

**Files:**
- Modify: `jarvis-full-animation.html` (add `<canvas id="glCoreCanvas">` at z-index 2.5 in CSS; new `initWebGLCore()`, `drawWebGLCore(t)`, GLSL shader strings; optional `STATE.highFidelityCore` flag and toggle handler)
- Modify: `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html` (mirror)

**Approach:**
- New canvas `#glCoreCanvas` positioned at z-index 2.5 (between bloom and main), same dimensions as other canvases, transparent background.
- Fragment shader (inline GLSL string): raymarch through a 3D curl-noise density field over a unit sphere, ~24 steps/pixel.
  - Density function: `density(pos, t) = fbm(pos + time_offset) * load_scale`
  - Emission accumulation: `emit += density * exp(-dist_from_center) * flare_boost`
  - Output color: teal-cyan (matches Unit 1 palette) with brightness driven by emission integral.
- Uniforms: `u_time`, `u_load (TEL.cpuLoad)`, `u_flare (delta of powerW)`, `u_breathing (STATE.breathingPhase)`, `u_resolution`.
- Vertex shader: standard fullscreen triangle.
- Graceful fallback: wrap `canvas.getContext('webgl')` in try/catch; if null, hide canvas and log warning.
- Performance gate: measure frame time, auto-disable if > 18ms for 3 consecutive frames.
- `STATE.highFidelityCore` default: `false`. Toggle via dev console or query param `?hifi=1`.

**Patterns to follow:** No existing WebGL in prototype — this is greenfield within the HTML codebase. GLSL fbm + curl-noise are well-documented; inline the shader, no external imports.

**Test scenarios:**
- Happy path: With `?hifi=1` query param, WebGL canvas visible, plasma core visibly roiling with turbulence. Frame rate ≥ 60fps on M1+.
- Edge case: WebGL context creation fails (e.g., WKWebView disables WebGL) — canvas hidden, no error, rest of HUD works.
- Edge case: Frame time exceeds 18ms for 3 frames — auto-disable triggered, canvas hides, HUD continues.
- Edge case: `hifi=0` (default) — new canvas completely absent, no perf cost.
- Integration: Side-by-side against Eapathy reference at `?hifi=1` — volumetric turbulence quality matches or exceeds reference.

**Verification:** Opt-in fidelity mode works on M1+. Default mode has zero new overhead. Fallback is graceful.

**Complexity:** High

---

- [ ] **Unit 9: Reactor Illuminates the Desktop (full-viewport light cast)**

**Goal:** Simulate the reactor casting cyan light onto the broader screen/desktop context via a full-viewport `body::after` pseudo-element with a large radial cyan gradient and `mix-blend-mode: screen`. Intensity driven by `STATE.bloomMul`. Unique to the JARVIS-as-wallpaper paradigm — no reference image shows this because no reference was a real desktop.

**Requirements:** R10

**Dependencies:** Unit 1 (palette) so the cast matches the base tone.

**Files:**
- Modify: `jarvis-full-animation.html` (add `body::after` CSS rule; inline style updater in `tickTelemetry()` that sets `document.body.style.setProperty('--desktop-light-opacity', STATE.bloomMul)`)
- Modify: `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html` (mirror)

**Approach:**
- CSS:
  ```
  body::after {
    content: '';
    position: fixed; inset: 0;
    pointer-events: none;
    z-index: 10;
    background: radial-gradient(ellipse at center, rgba(26, 230, 245, 0.08) 0%, rgba(26, 230, 245, 0) 60%);
    mix-blend-mode: screen;
    opacity: var(--desktop-light-opacity, 0.85);
  }
  ```
- Radius of the gradient extends beyond the reactor disc to cover ~60% of viewport.
- Opacity lerped from `STATE.bloomMul` each frame (or at 10Hz to avoid layout thrash).
- When running inside JarvisWallpaper WKWebView with the window set to `kCGDesktopWindowLevel`, the screen blend composites against the actual desktop pixels below — user's desktop icons get rim-lit by the reactor in real time.
- When running as a plain file in Chrome (dev mode), the blend composites against the CSS bg-gradient — still visible as a subtle "glow fills the room" effect.

**Patterns to follow:** Existing `#vignette` CSS pseudo-overlay at `:51-54` — same layer-stack placement, same pointer-events-none pattern. The vignette uses radial-gradient for edge darkening; this unit uses the inverse for edge brightening.

**Test scenarios:**
- Happy path (WKWebView): Loaded inside JarvisWallpaper app — desktop icons visibly cast cyan rim light from the reactor direction.
- Happy path (Chrome dev): Loaded as `file://` in Chrome — cyan glow fills the entire viewport, brightest at center.
- Edge case: Disable via `STATE.castsDesktopLight = false` and `:root { --desktop-light-opacity: 0 }` — effect completely vanishes.
- Edge case: `mix-blend-mode: screen` unsupported in some WebView — fallback to `globalCompositeOperation` on a canvas layer (deferred to implementation).
- Integration: Screenshot comparison with and without — demonstrably lights the environment.

**Verification:** Effect visible and proportional to `bloomMul`. Zero impact on frame rate (pure CSS). Opt-out works cleanly.

**Complexity:** Medium (WKWebView compositor interaction is the unknown)

---

## Rejection Summary

| # | Rejected Idea | Reason |
|---|---|---|
| R1 | SceneKit real 3D geodesic dome | Institutional constraint — SceneKit quarantined to boot phase. HTML has no equivalent; Canvas projection used instead (Unit 4). |
| R2 | Replace 1776-line HUD Canvas with single raymarched SDF Metal scene | Not applicable to HTML; hybrid stack is deliberate; covered by Unit 8 at prototype scale. |
| R3 | Unified GPU fluid simulation driving all visuals | Too ambitious; speculative perf; no equivalent in HTML short of full WebGPU rewrite. |
| R4 | HDR bloom via Karis downsample chain | Requires multi-pass rendering; WebGL overlay Unit 8 captures the enhancement more narrowly. |
| R5 | 5k–50k GPU compute particles | No WebGPU compute in the prototype; violates ≤ 80 particle budget; Unit 2 captures the rim-haze intent. |
| R6 | Audio-reactive dome displacement via FFT | Niche — adds `AudioWorklet` dependency; not reference-grounded; defer as post-1.0 flourish. |
| R7 | Bokeh depth-of-field pass | Would blur the HUD text readouts; prototype must read as sharp UI. |
| R8 | Perlin/Simplex noise rings | Reframed into sin-based Unit 5 per institutional preference. |
| R9 | Tier-based parallax with per-tier blur | Per-tier `ctx.filter = blur(Npx)` risks 60fps budget in Canvas 2D; simpler translate-only Unit 7 wins. |
| R10 | Radial tick density bump with length noise | Current density is deliberate; low fidelity-gap fit. |
| R11 | Hex capacitor cells between dome and blades | Duplicates Unit 4 (dome) visual real estate. |
| R12 | Chromatic aberration channel split | Marginal value in Canvas 2D without per-pixel shader access; superseded by Unit 8 if WebGL lands. |
| R13 | Activate dead `bloom_fragment.metal` stub | Swift-only — doesn't apply to HTML prototype. |
| R14 | 3rd CAEmitterCell for ion drift | No CAEmitterLayer in HTML; Unit 2 tangential bias captures the ion-drift feel. |
| R15 | Anisotropic streak particle sprites | Defer as polish on Unit 2 — replace `fxCtx.arc` with `fxCtx.ellipse()` + rotation if wanted. |
| R16 | Magnetic confinement flux line rendering | Cool but requires shader math; subsumed by Unit 8 curl-noise if enabled. |
| R17 | Heat shimmer screen-space refraction | Requires backbuffer read / WebGL render-to-texture; defer. |
| R18 | Mie/Rayleigh atmospheric scattering halo | Marginal visual delta vs current CSS `filter: blur(26px)` bloom for effort. |
| R19 | Kelvin-Helmholtz instability ripples at ring interfaces | Physics niche; subsumed by Unit 8. |
| R20 | Lightning-arc electrical discharges on flare spikes | Valuable but additive; defer to post-Unit-3 polish. |
| R21 | Gravitational lensing refraction ring | Requires backbuffer read; marginal value. |
| R22 | Anisotropic specular stator BRDF | Polish note for Unit 3 — `createLinearGradient` along blade tangent could approximate. |
| R23 | SDF tori containment rings | Subsumed by Unit 8. |
| R24 | Shader shockwave via `extra.z` free uniform slot | Swift-only leverage play; irrelevant to HTML. |
| R25 | `SceneKit` quarantine rules | Not applicable to HTML prototype context. |

## System-Wide Impact

- **Interaction graph:** New draw functions plug into the existing main loop via `drawRings` and `drawCore` call sites. No new `requestAnimationFrame` chains — adds to existing loop. `STATE.breathingPhase` is advanced in the existing `dt` update step.
- **Error propagation:** Canvas 2D errors are synchronous and will crash the draw loop if uncaught. Unit 8 (WebGL) is the only unit with asynchronous/non-deterministic failure modes (context creation) — wrap in try/catch with graceful degradation.
- **State lifecycle risks:** Particles in Unit 2 must be re-seeded on window resize (existing pattern handles this via `resize()` → `initGrain()` analogue; extend to reseed particles).
- **API surface parity:** `jarvis-full-animation.html` and `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html` must stay byte-identical. Every edit in one must be mirrored. Consider a post-plan followup to add a build hook.
- **Unchanged invariants:**
  - HUD text overlays (`#hud` DOM elements) remain untouched.
  - Chatter streams, floating panels, scanner sweep, boot/shutdown sequences unchanged.
  - The 12-ring `RINGS[]` topology preserved — only outermost 2 get wispified (Unit 5), speeds retuned (Unit 7), and parallax translated (Unit 7). Ring count stays 12.
  - Existing top/bottom flame spokes (`topSpokes = 90`) preserved — they are load-bearing for the "sun crown" quality.
  - Center "2" digit (`STATE.coreNumber`) preserved in foreground.
  - Boot/shutdown visibility fade logic (`ringVisibility()`, `ringRadiusMul()`) preserved.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| 60fps budget exceeded when all 9 units land simultaneously | Profile after each unit lands; if Tier A alone exceeds budget, scope-reduce blade count in Unit 3 from 48 → 24 and wispy ring octaves in Unit 5 from 3 → 2. Unit 8 WebGL gated by `?hifi=1` opt-in. |
| `ctx.filter = blur(Npx)` inconsistent in WKWebView | Fall back to multi-pass radial gradients for Unit 6 Fresnel rim (already the primary approach — filter was noted as fallback, not required). |
| Palette shift (Unit 1) breaks thermal threat escalation reading | Test overdrive/threat mode explicitly after Unit 1 lands; if amber/crimson clash with new teal base, retune the threat amber tone in the same pass. |
| WebGL context creation fails in WKWebView (Unit 8) | Graceful no-op; `STATE.highFidelityCore = false` default means the feature is opt-in and never required. |
| Two HTML files drift out of sync | Apply every edit to both files in the same change. Add a sync verification step to the CI or preflight checks as a future task. |
| Unit dependencies create bottleneck — Unit 6 depends on Units 3+4 | Units 1, 2, 5, 7 are independent and can land first in any order. Then 3, 4, 6 in that order. Then 8, 9 as opt-ins. |

## Sources & References

- **Origin document (reference aesthetic):** `docs/superpowers/specs/2026-04-09-jarvis-cinematic-hud-design.md`
- **Related ideation session:** This document itself — `ce:ideate` Phase 2 produced 45 raw candidates from 4 parallel agents; Phase 3 filtered to 9 survivors; Phase 4 mapped survivors to HTML prototype hooks (this doc).
- **Reference images (ground truth):** `public/Jarvis-images/real-jarvis-01.jpg`, `real-jarvis-02.jpg`, `real-jarvis-03.jpg`, `Jarvis Rainmeter Circle Animation By Eapathy.png`, `Jarvis-1.png`, `Jarvis-2.png`
- **Prototype source:** `jarvis-full-animation.html` (2520 lines) and its mirror `JarvisWallpaper/Sources/JarvisWallpaper/Resources/jarvis-reactor.html`
- **Parallel Swift workstream (for symmetry):** `JarvisTelemetry/Sources/JarvisTelemetry/JarvisHUDView.swift` (1776 lines), `CoreReactorMetalView.swift` (284 lines Metal), `CorePulseRingView.swift` (184 lines), `ReactorParticleEmitter.swift` (178 lines), `ReactorAnimationController.swift` (905 lines)
- **Related existing plans:**
  - `docs/plans/2026-04-10-jarvis-cinematic-hud-reconstruct.md` (broader scope including battery reactivity, AI video stitching)
  - `docs/plans/2026-04-09-001-feat-jarvis-hud-visual-fidelity-plan.md`
  - `docs/superpowers/plans/2026-04-09-jarvis-cinematic-hud-plan.md`

## Session Log

- **2026-04-13:** Initial ideation — 45 raw candidates generated across 4 frames (cinematic fidelity / physical realism / assumption-breaking / leverage-compounding). 9 survived Phase 3 filtering. Translated to HTML prototype uplift plan (this document). 7 Tier A core units + 2 Tier B bold units. Rejection table lists all 25 cut ideas with reasons.
