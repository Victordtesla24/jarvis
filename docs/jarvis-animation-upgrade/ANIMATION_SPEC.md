# JARVIS Animation Upgrade — Implementation Specification

> Reference document for Claude Code agent. Read this in full before writing a single line of code.

## Project Identity

- **Repo:** `https://github.com/Victordtesla24/jarvis.git`
- **Branch:** `real-jarvis`
- **Stack:** React 18.3.1, Three.js 0.164.1, `@react-three/fiber` 8.16.6, `@react-three/postprocessing` 2.16.2, `postprocessing` 6.35.4, `maath` 0.10.8, TypeScript 5.8, Vite 6.2, Tailwind 4.3
- **Design system:** `#0A0A0A` background, `#C9A84C` gold accent, Playfair Display + DM Sans typography
- **Style target:** Prometheus 48 HUD — scanline overlays, Fresnel holographic glow, god-ray bloom, animated 2D/3D title reveals, GPU particle bursts, spring-physics HUD mounts

## Existing Components (do NOT replace — extend only)

| File | Role | Extension Point |
|---|---|---|
| `src/components/HolographicEarth.tsx` | Three.js globe with holographic shaders | Apply `HolographicMaterial`, add post-processing bloom |
| `src/components/HUDOverlay.tsx` | 2D HUD panels over canvas | Add scanline CSS + Theatre.js keyframes |
| `src/components/BootSequence.tsx` | Boot animation | Replace manual timers with Theatre.js sequence |
| `src/components/JarvisConsole.tsx` | Console readout | Add GSAP counter animation + spring mount |
| `src/components/GestureController.tsx` | MediaPipe gesture | No animation changes needed |
| `src/App.tsx` | Root layout | Wrap Canvas with EffectComposer |

## Packages to Install (in order)

```bash
# Step 1 — Holographic material (copy file, no npm install needed)
# Source: https://github.com/ektogamat/threejs-holographic-material
# File: src/materials/HolographicMaterial.jsx  (create from repo source)

# Step 2 — Post-processing (already installed — unlock effects)
# @react-three/postprocessing@2.16.2  ✓ already in package.json
# postprocessing@6.35.4               ✓ already in package.json

# Step 3 — Theatre.js animation timeline
npm install @theatre/core @theatre/r3f

# Step 4 — GSAP
npm install gsap

# Step 5 — Wawa VFX particles
npm install wawa-vfx

# Step 6 — react-spring three
npm install @react-spring/three
```

## Implementation Steps

### STEP 1 — HolographicMaterial

**What:** Create `src/materials/HolographicMaterial.tsx` — a GLSL shader material that adds:
- Fresnel rim glow (gold `#C9A84C`)
- Animated scanlines (vertical + horizontal)
- Signal blink / flicker
- Transparency + depth write disabled

**Apply to:** `HolographicEarth.tsx` — replace the existing material on the Earth mesh with `<HolographicMaterial fresnelOpacity={0.5} scanlineSize={8} hologramColor="#C9A84C" />`

**Constraints:**
- TypeScript strict — no `any`
- Export both the material class and an R3F JSX component
- Props interface: `HolographicMaterialProps { hologramColor?: string; fresnelOpacity?: number; fresnelAmount?: number; scanlineSize?: number; signalSpeed?: number; hologramOpacity?: number; enableAdditive?: boolean }`
- `useFrame` drives time uniform — no `setInterval`

**Verification hook:** After implementation, `npm run test` must pass. Manual test: see TEST_SUITE.md Step 1.

---

### STEP 2 — Post-Processing Pipeline

**What:** In `src/App.tsx`, wrap the existing `<Canvas>` content with:

```tsx
import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

// Inside Canvas:
<EffectComposer>
  <Bloom
    luminanceThreshold={0.9}
    luminanceSmoothing={0.025}
    mipmapBlur
    intensity={1.5}
    radius={0.8}
  />
  <ChromaticAberration offset={[0.0005, 0.0005]} blendFunction={BlendFunction.NORMAL} />
  <Noise opacity={0.04} blendFunction={BlendFunction.SOFT_LIGHT} />
  <Vignette eskil={false} offset={0.1} darkness={0.9} />
</EffectComposer>
```

**Gold emissive materials:** Any mesh that should bloom must have `emissive="#C9A84C"` and `emissiveIntensity > 1.0` (values above 1.0 trigger selective bloom via luminance threshold).

**Constraints:**
- Do not add a second EffectComposer if one already exists — extend the existing one
- `BlendFunction` import comes from `postprocessing` (already installed), not from `@react-three/postprocessing`

---

### STEP 3 — Theatre.js Sequenced Animations

**What:** Replace manual `setTimeout` / `setInterval` chains in `BootSequence.tsx` and `JarvisConsole.tsx` with Theatre.js keyframed sequences.

**Setup:**
```tsx
// src/theatre/project.ts
import { getProject } from '@theatre/core'
export const project = getProject('JARVIS')
export const bootSheet = project.sheet('BootSequence')
export const consoleSheet = project.sheet('JarvisConsole')
```

**Apply in BootSequence.tsx:**
- Create a Theatre.js object per animated element (opacity, translateY, scale)
- Use `sheet.sequence.play({ iterationCount: 1, range: [0, 4] })` on component mount
- All timing must come from Theatre.js — zero `setTimeout` survivors

**Apply in JarvisConsole.tsx:**
- Animate console line appearance with `sequenceLength` controlled stagger
- Use `onValuesChange` to drive React state (not direct DOM manipulation)

**Constraints:**
- `@theatre/studio` is devDependency only — wrap in `if (import.meta.env.DEV)` guard
- No `.json` project state files committed — use `getProject('JARVIS', { state: {} })`

---

### STEP 4 — GSAP Counter Animations

**What:** In `JarvisConsole.tsx`, animate numeric readouts (CPU%, memory, uptime counters) using GSAP.

```tsx
import gsap from 'gsap'

// In useEffect:
gsap.to(counterRef.current, {
  textContent: targetValue,
  duration: 2,
  ease: 'power2.out',
  snap: { textContent: 1 },
  onUpdate() { counterRef.current!.textContent = Math.round(Number(counterRef.current!.textContent)).toString() }
})
```

**Constraints:**
- Cleanup: return `() => { tl.kill() }` from every useEffect that creates a GSAP timeline
- No GSAP plugins that require a license (ScrollTrigger is fine; DrawSVG/MorphSVG are not)

---

### STEP 5 — Wawa VFX Particle Bursts

**What:** Add GPU particle systems to `HUDOverlay.tsx` for:
- HUD element activation sparks (small burst, gold `#C9A84C`)
- Ambient floating data-particles around the globe

```tsx
import { VFXParticles, VFXEmitter } from 'wawa-vfx'

// Inside Canvas (not in EffectComposer):
<VFXParticles name="hud-sparks" settings={{ nbParticles: 200, renderMode: 'billboard' }}>
  <VFXEmitter emitter="hud-sparks" settings={{ duration: 0.3, nbParticles: 50, spawnMode: 'burst' }} />
</VFXParticles>
```

**Constraints:**
- Cap `nbParticles` at 500 total across all emitters (perf budget)
- Colour must be `#C9A84C` gold or `#4CCAC9` complementary cyan — no white defaults

---

### STEP 6 — React-Spring HUD Mount Physics

**What:** In `HUDOverlay.tsx`, wrap each HUD panel mount/unmount with `react-spring`:

```tsx
import { useSpring, animated } from '@react-spring/three'

const springProps = useSpring({
  scale: visible ? 1 : 0,
  opacity: visible ? 1 : 0,
  config: { tension: 280, friction: 60 }
})
```

**Constraints:**
- Use `@react-spring/three` (not `@react-spring/web`) inside the R3F Canvas
- Use `@react-spring/web` for any DOM-side HUD panels outside the Canvas

---

## Hard Constraints (apply to all steps)

1. No `@ts-ignore`, `eslint-disable`, `any`-casts, or type suppressions
2. No placeholder comments: `// TODO`, `// rest of code`, `// implement later`
3. No `Math.random()` presented as live data
4. Surgical edits — extend existing files; do not create replacement files
5. Every `useEffect` with subscriptions, GSAP timelines, or Theatre.js sequences must return a cleanup function
6. `npm run lint` (tsc --noEmit) must pass after each step
7. `npm run test` must pass after each step
8. Commit each step separately: `git commit -m "feat(animation): step N — <description>"`

## Success Criteria

| Metric | Baseline | Target |
|---|---|---|
| Animation quality score (subjective 1-10) | 4/10 | 8.5/10 |
| Holographic Fresnel visible on globe | No | Yes |
| Post-processing bloom active | No | Yes |
| Boot sequence uses keyframes | No | Yes |
| Particle system active | No | Yes |
| TypeScript errors | 0 | 0 |
| Test suite pass rate | 100% | 100% |
