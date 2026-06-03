# Corrected Implementation Plan
## J.A.R.V.I.S real-jarvis branch — grounded in actual committed codebase

> Non-negotiable rules:
> 1. Run Step 0 first. Show output. Do not skip.
> 2. Extend existing files only — no deletions, no full rewrites.
> 3. No @ts-ignore, eslint-disable, any casts.
> 4. After each step: `tsc --noEmit 2>&1 | tail -10` must be zero errors before continuing.
> 5. Do not open BootSequence.tsx for any reason.
> 6. All work on real-jarvis branch only.

---

## Step 0 — Baseline (mandatory before any edit)

```bash
git stash          # clear any working-tree edits including previous failed attempts
git status         # must show: nothing to commit, working tree clean
tsc --noEmit 2>&1 | tail -10   # must show zero errors
npm run build 2>&1 | tail -5   # must succeed
```

Paste all four outputs to me. Do not proceed until all pass.

---

## Package Installs (after Step 0 passes, before any source edits)

```bash
npm install @arwes/react@1.0.0-alpha.23 @emotion/react gsap
npx jsrepo add github/davidhdev/react-bits/TextAnimations/DecryptedText

mkdir -p src/materials
curl -L "https://gist.githubusercontent.com/ektogamat/b149d9154f86c128c9fea52c974dda1a/raw/HolographicMaterialVanilla.js" \
  -o src/materials/HolographicMaterial.jsx

wc -c src/materials/HolographicMaterial.jsx
# Must be > 3000 bytes. If < 1000 bytes, the CDN redirected — use fallback:
# curl -L "https://github.com/ektogamat/threejs-holographic-material/raw/main/src/HolographicMaterial.jsx" -o src/materials/HolographicMaterial.jsx

grep -c "fresnelAmount\|scanlineSize\|hologramColor" src/materials/HolographicMaterial.jsx
# Must return 3

tsc --noEmit 2>&1 | tail -10
# Must be zero errors before touching any source file
```

---

## Phase A — Steps 1 + 2 (implement simultaneously)

### Step 1 — Holographic GLSL Shader on Earth Mesh

File: `src/components/HolographicEarth.tsx`

Current: earth mesh uses `<meshPhongMaterial map={colorMap} normalMap={normalMap} specularMap={specularMap} ...>`
Target: replace with HolographicMaterial; pass colorMap as `map` prop to preserve texture.

1. Add import after existing imports:
```tsx
import HolographicMaterial from '../materials/HolographicMaterial'
```

2. Add ref after existing refs inside component:
```tsx
const matRef = useRef<any>(null)
```

3. In the EXISTING useFrame callback, add as first line of its body (before the early-return guard):
```tsx
matRef.current?.update()
```

4. Inside `<mesh ref={earthRef}>`, replace `<meshPhongMaterial .../>` with:
```tsx
<HolographicMaterial
  ref={matRef}
  hologramColor="#C9A84C"
  fresnelAmount={0.45}
  scanlineSize={8}
  signalSpeed={0.45}
  hologramBrightness={1.2}
  enableBlinking={true}
  blinkFresnelOnly={false}
  hologramOpacity={0.9}
  map={colorMap}
/>
```

5. Verify: `tsc --noEmit 2>&1 | tail -10` — zero errors.

Do NOT touch: TerrainModel, Points/PointMaterial particle group, clouds, wireframe, hand-tracking logic.

---

### Step 2 — ChromaticAberration + Glitch inside Existing EffectComposer

File: `src/components/HolographicEarth.tsx`

Current EffectComposer:
```tsx
<EffectComposer enableNormalPass={false}>
  <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.5} radius={0.6} />
</EffectComposer>
```

1. Extend the postprocessing import (do not replace, add to it):
```tsx
// FROM:
import { EffectComposer, Bloom } from '@react-three/postprocessing'
// TO:
import { EffectComposer, Bloom, ChromaticAberration, Glitch } from '@react-three/postprocessing'
```

2. Add GlitchMode import:
```tsx
import { GlitchMode } from 'postprocessing'
```

3. Check if `import * as THREE from 'three'` already exists in the file. If not, add it.

4. Add inside the existing EffectComposer, after the Bloom line:
```tsx
<ChromaticAberration offset={new THREE.Vector2(0.001, 0.001)} />
<Glitch
  delay={new THREE.Vector2(5, 10)}
  duration={new THREE.Vector2(0.1, 0.2)}
  strength={new THREE.Vector2(0.05, 0.15)}
  mode={GlitchMode.SPORADIC}
  ratio={0.85}
/>
```

5. Verify: `tsc --noEmit 2>&1 | tail -10` — zero errors.

Gate: Both Step 1 and 2 pass tsc before Phase B.

---

## Phase B — Steps 3, 5, 6 (implement simultaneously; Step 4 SKIPPED)

### Step 3 — Arwes FrameSVGCorners on Intel Panel

Files: `src/main.tsx` + `src/components/HUDOverlay.tsx`

This is a VITE project. There is no next.config.js. Do not touch vite.config.ts.

Sub-step 3a — src/main.tsx: remove StrictMode (required by Arwes):
Find: `<React.StrictMode>` ... `</React.StrictMode>`
Replace outer tags with `<>` ... `</>`

Sub-step 3b — src/components/HUDOverlay.tsx:

Add imports:
```tsx
import { Animator, AnimatorGeneralProvider, FrameSVGCorners, Animated, aa, aaVisibility } from '@arwes/react'
import { Global } from '@emotion/react'
import { createAppTheme, createAppStylesBaseline } from '@arwes/react'
```

In the return JSX, find the `{showIntelPanel && (...)}` block.
The outer `<div className="absolute z-40 animate-flash...">` stays.
Wrap the INNER `<div className="bg-black/80 border-l-2...">` with:

```tsx
{showIntelPanel && (
  <div
    className="absolute z-40 animate-flash origin-top-left"
    style={{ left: panelPos.x, top: panelPos.y, width: '300px' }}
  >
    <AnimatorGeneralProvider duration={{ enter: 0.3, exit: 0.2 }}>
      <Global styles={createAppStylesBaseline(createAppTheme()) as any} />
      <Animator active={showIntelPanel}>
        <Animated animated={[aaVisibility(), aa('y', '0.5rem', 0)]} style={{ position: 'relative' }}>
          <Animator><FrameSVGCorners strokeWidth={1.5} /></Animator>

          <div className="bg-black/80 border-l-2 border-alert-red shadow-[0_0_40px_rgba(255,42,42,0.3)] backdrop-blur-xl p-1 rounded-r-lg">
            {/* all existing children UNCHANGED */}
          </div>

        </Animated>
      </Animator>
    </AnimatorGeneralProvider>
    <svg className="absolute -left-4 top-0 w-4 h-full overflow-visible">
        <path d="M 4,0 L 0,10 L 0,150" fill="none" stroke="#FF2A2A" strokeWidth="1" />
    </svg>
  </div>
)}
```

Do NOT touch: canvasRef, rAF loop, renderFrame, hand gauge, anything outside showIntelPanel block.
Verify: `tsc --noEmit 2>&1 | tail -10`

---

### Step 4 — SKIP

BootSequence.tsx is already at 9/10 Prometheus quality with Reticle, Plexus, Ignition, CameraRig,
Bloom + ChromaticAberration + Vignette, and CSS glitch text. DO NOT TOUCH IT.

Confirm: `git diff HEAD src/components/BootSequence.tsx` must return empty.

---

### Step 5 — DecryptedText on Completed Console Messages

File: `src/components/JarvisConsole.tsx`

First, find where jsrepo installed DecryptedText:
```bash
find src -name "DecryptedText*" 2>/dev/null
```

Add import (adjust path based on find result):
```tsx
import DecryptedText from '../TextAnimations/DecryptedText'
```

In log.map(), find the assistant message block:
```tsx
<div className="max-w-[88%] text-holo-cyan/95 leading-snug">
  {e.text}
  {e.streaming && (
    <span className="inline-block w-2 h-3.5 ml-0.5 align-middle bg-holo-cyan animate-blink" />
  )}
</div>
```

Replace only `{e.text}` — leave streaming check and cursor span untouched:
```tsx
<div className="max-w-[88%] text-holo-cyan/95 leading-snug">
  {e.streaming ? e.text : (
    <DecryptedText
      text={e.text || ''}
      speed={30}
      maxIterations={6}
      sequential={true}
      revealDirection="start"
      className="text-holo-cyan/95 leading-snug font-sans text-sm"
    />
  )}
  {e.streaming && (
    <span className="inline-block w-2 h-3.5 ml-0.5 align-middle bg-holo-cyan animate-blink" />
  )}
</div>
```

Verify: `tsc --noEmit 2>&1 | tail -10`

---

### Step 6 — Gold Particle Recolor

File: `src/components/HolographicEarth.tsx`

Find the `<PointMaterial>` inside the particle group:
```tsx
<PointMaterial color="#00F0FF" size={0.015} ...>
```

Change two values only:
- `color="#00F0FF"` → `color="#C9A84C"`
- `size={0.015}` → `size={0.02}`

All other PointMaterial props stay unchanged.
Verify: `tsc --noEmit 2>&1 | tail -10`

Gate: Steps 3, 5, 6 all pass tsc before Phase C.

---

## Phase C — Step 7

### Step 7 — GSAP Signal Bar Animation

File: `src/components/HUDOverlay.tsx`

1. Add import: `import gsap from 'gsap'`

2. Add ref inside component after existing refs:
```tsx
const signalBarRef = useRef<HTMLDivElement>(null)
```

3. Add useEffect (after existing useEffects):
```tsx
useEffect(() => {
  if (showIntelPanel && signalBarRef.current) {
    gsap.fromTo(
      signalBarRef.current,
      { scaleX: 0 },
      {
        scaleX: panelData.signal / 100,
        duration: 1.5,
        ease: 'power2.out',
        transformOrigin: 'left center',
        overwrite: true,
      }
    )
  }
}, [showIntelPanel, panelData.signal])
```

4. Find the signal bar div:
```tsx
<div
    className="bg-holo-cyan h-full shadow-[0_0_10px_#00F0FF] relative transition-all duration-150"
    style={{ width: `${panelData.signal}%` }}
>
```

Replace with (remove CSS transition, remove width style, add ref and transform):
```tsx
<div
    ref={signalBarRef}
    className="bg-holo-cyan h-full shadow-[0_0_10px_#00F0FF] relative"
    style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
>
```

Verify: `tsc --noEmit 2>&1 | tail -10`

---

## Final Completion Checklist

Run each command and confirm:

```bash
tsc --noEmit 2>&1 | tail -10
npm run build 2>&1 | tail -10

grep -c "HolographicMaterial" src/components/HolographicEarth.tsx        # expect 2
grep -c "matRef.current" src/components/HolographicEarth.tsx             # expect 2
grep -c "GlitchMode.SPORADIC" src/components/HolographicEarth.tsx        # expect 1
grep -c "ChromaticAberration" src/components/HolographicEarth.tsx        # expect 2
grep -c "AnimatorGeneralProvider" src/components/HUDOverlay.tsx          # expect 1
grep -c "FrameSVGCorners" src/components/HUDOverlay.tsx                  # expect 1
grep -c "DecryptedText" src/components/JarvisConsole.tsx                 # expect 2
grep -c "gsap.fromTo" src/components/HUDOverlay.tsx                      # expect 1
grep -c '"#C9A84C"' src/components/HolographicEarth.tsx                  # expect 1
grep -c "StrictMode" src/main.tsx                                         # expect 0
git diff HEAD src/components/BootSequence.tsx | wc -l                    # expect 0
```

Score target: 9.6/10 with clean tsc + build.
