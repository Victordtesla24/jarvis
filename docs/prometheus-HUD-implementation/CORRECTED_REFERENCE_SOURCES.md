# Corrected Reference Sources
## Verified against actual committed codebase — no video references needed

---

## SOURCE 1 — HolographicMaterial GLSL (replaces meshPhongMaterial on Earth)

Primary download:
```bash
mkdir -p src/materials
curl -L "https://gist.githubusercontent.com/ektogamat/b149d9154f86c128c9fea52c974dda1a/raw/HolographicMaterialVanilla.js" \
  -o src/materials/HolographicMaterial.jsx
```

Fallback (if primary returns < 1000 bytes):
```bash
curl -L "https://github.com/ektogamat/threejs-holographic-material/raw/main/src/HolographicMaterial.jsx" \
  -o src/materials/HolographicMaterial.jsx
```

Verify before proceeding:
```bash
wc -c src/materials/HolographicMaterial.jsx          # must be > 3000
grep -c "fresnelAmount" src/materials/HolographicMaterial.jsx  # must be >= 1
```

JSX usage (replaces meshPhongMaterial inside `<mesh ref={earthRef}>`):
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

Props explained:
- `hologramColor="#C9A84C"` — gold to match Prometheus/JARVIS palette (#0A0A0A + #C9A84C)
- `fresnelAmount=0.45` — edge glow intensity (Prometheus bright rim around panels)
- `scanlineSize=8` — horizontal scanline frequency (Prometheus HUD panel lines)
- `signalSpeed=0.45` — scrolling speed of scanlines
- `enableBlinking=true` — random signal dropout flicker (Prometheus hologram instability)
- `map={colorMap}` — preserve earth texture through the shader

Update call inside useFrame (add as first line of existing useFrame body):
```tsx
matRef.current?.update()
```

---

## SOURCE 2 — ChromaticAberration + Glitch (extends existing EffectComposer)

All packages already in package.json (`@react-three/postprocessing@2.16.2`, `postprocessing@6.35.4`).
No new installs needed.

Extend existing import line:
```tsx
// FROM: import { EffectComposer, Bloom } from '@react-three/postprocessing'
// TO:
import { EffectComposer, Bloom, ChromaticAberration, Glitch } from '@react-three/postprocessing'
import { GlitchMode } from 'postprocessing'
```

Add inside existing EffectComposer (after the existing Bloom line):
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

Effect: sporadic glitch flash every 5-10 seconds (ratio=0.85 means 85% probability of being a "calm" frame).
The Bloom props (luminanceThreshold, mipmapBlur, intensity, radius) are unchanged.

---

## SOURCE 3 — Arwes FrameSVGCorners on Intel Panel

Package: `@arwes/react@1.0.0-alpha.23`
Install: `npm install @arwes/react@1.0.0-alpha.23 @emotion/react`

This is a VITE project. Arwes requires React non-StrictMode.
In `src/main.tsx`: replace `<React.StrictMode>` wrapper with `<>`.

Imports for HUDOverlay.tsx:
```tsx
import { Animator, AnimatorGeneralProvider, FrameSVGCorners, Animated, aa, aaVisibility } from '@arwes/react'
import { Global } from '@emotion/react'
import { createAppTheme, createAppStylesBaseline } from '@arwes/react'
```

Visual effect: When the intel panel appears (pinch gesture), animated SVG corner brackets draw in
from corners — matching the Prometheus HUD panel reveal animation (bracket appears, then content fades in).

The `aaVisibility()` ensures the panel is invisible until the Arwes enter animation begins.
The `aa('y', '0.5rem', 0)` adds a subtle upward translate on enter.
`FrameSVGCorners strokeWidth={1.5}` draws the angular SVG bracket decorators.

---

## SOURCE 4 — DecryptedText (character scramble on console messages)

Install via jsrepo (copies component source, no npm package):
```bash
npx jsrepo add github/davidhdev/react-bits/TextAnimations/DecryptedText
```

Check install path:
```bash
find src -name "DecryptedText*" 2>/dev/null
```

Import (adjust path to match find result):
```tsx
import DecryptedText from '../TextAnimations/DecryptedText'
// or: import DecryptedText from './TextAnimations/DecryptedText'
```

Usage — apply ONLY to completed (non-streaming) assistant messages:
```tsx
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
```

Props explained:
- `speed=30` — milliseconds per character iteration
- `maxIterations=6` — each character cycles through 6 random chars before resolving
- `sequential=true` — characters resolve left-to-right (like a decryption reveal)
- `revealDirection="start"` — starts from first character

Visual effect: When a JARVIS response completes streaming, the text does a 1-2 second
character-scramble reveal — matching Prometheus "decrypting" text panels.

---

## SOURCE 5 — GSAP Signal Bar Animation

Install: `npm install gsap`

Import: `import gsap from 'gsap'`

The signal bar in HUDOverlay currently uses CSS `transition-all duration-150` and inline `width` style.
Replace with GSAP `scaleX` animation for dramatic Prometheus-style bar fill.

```tsx
// Ref:
const signalBarRef = useRef<HTMLDivElement>(null)

// Effect (add after existing useEffects):
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

// Bar div replacement:
<div
  ref={signalBarRef}
  className="bg-holo-cyan h-full shadow-[0_0_10px_#00F0FF] relative"
  style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
>
  <div className="absolute top-0 left-0 h-full w-full bg-white/30 animate-[scanline_1s_linear_infinite]" />
</div>
```

The inner `scanline` div stays — it's inside the bar and still works with scaleX transform.
Remove `transition-all duration-150` and `style={{ width: ... }}` from the replaced div.

---

## SOURCE 6 — Gold Particle Recolor (no new packages)

In `src/components/HolographicEarth.tsx`, find `<PointMaterial>` in the particle group.

```tsx
// FROM:
<PointMaterial color="#00F0FF" size={0.015} ... />
// TO:
<PointMaterial color="#C9A84C" size={0.02} ... />
```

Only two values change. All other props (transparent, sizeAttenuation, depthWrite, blending) stay.

Effect: particle field changes from cyan to gold, matching the #C9A84C palette of the
holographic material and the JARVIS color scheme (#0A0A0A + #C9A84C).
