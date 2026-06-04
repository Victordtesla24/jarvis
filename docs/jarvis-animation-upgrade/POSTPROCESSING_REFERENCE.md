# Post-Processing Pipeline Reference

> Agent: implement this pipeline in `src/App.tsx`. Both `@react-three/postprocessing` and `postprocessing` are already installed — no new npm installs required for this step.

## Installed Versions (confirmed from package.json)

```
@react-three/postprocessing  2.16.2
postprocessing               6.35.4
```

## EffectComposer Setup in App.tsx

Locate the `<Canvas>` component in `src/App.tsx`. The EffectComposer must be the **last child** inside `<Canvas>`:

```tsx
// src/App.tsx

// ADD these imports at the top:
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Noise,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

// INSIDE <Canvas>, as the last element:
<EffectComposer multisampling={0}>
  <Bloom
    luminanceThreshold={0.9}
    luminanceSmoothing={0.025}
    mipmapBlur
    intensity={1.5}
    radius={0.8}
    blendFunction={BlendFunction.ADD}
  />
  <ChromaticAberration
    offset={[0.0005, 0.0005] as unknown as THREE.Vector2}
    blendFunction={BlendFunction.NORMAL}
    radialModulation={false}
    modulationOffset={0.0}
  />
  <Noise
    opacity={0.04}
    blendFunction={BlendFunction.SOFT_LIGHT}
  />
  <Vignette
    eskil={false}
    offset={0.1}
    darkness={0.9}
    blendFunction={BlendFunction.NORMAL}
  />
</EffectComposer>
```

## Making Materials Bloom

Any mesh that should emit Prometheus-style glow must set emissive values **above 1.0** — this triggers the luminance threshold:

```tsx
// In HolographicEarth.tsx — add emissive to any secondary mesh (grid lines, arcs):
<meshStandardMaterial
  color="#C9A84C"
  emissive="#C9A84C"
  emissiveIntensity={2.5}   // above 1.0 → blooms
  transparent
  opacity={0.8}
/>

// HUD line elements in HUDOverlay.tsx:
<meshStandardMaterial
  color="#4CCAC9"
  emissive="#4CCAC9"
  emissiveIntensity={3.0}
/>
```

## Three.js Import for Vector2

Add at the top of `App.tsx` if not already present:
```tsx
import * as THREE from 'three'
```

## Compatibility Notes

- `multisampling={0}` is required when using `Bloom` with `mipmapBlur` — MSAA conflicts with mipmap bloom
- `BlendFunction` **must** import from `postprocessing` (core), not from `@react-three/postprocessing`
- If the Canvas already has a `gl={{ antialias: false }}` prop, keep it — it's compatible
- Do not add a `<toneMappingExposure>` override; leave tone mapping to the existing renderer config

## Verification

After implementation:
1. Open dev server: `npm run dev`
2. Gold elements (#C9A84C) should glow with soft bloom halo
3. Screen edges show subtle vignette darkening
4. Slight chromatic aberration (colour fringing) visible on bright elements
5. `npm run lint` passes (tsc --noEmit)
