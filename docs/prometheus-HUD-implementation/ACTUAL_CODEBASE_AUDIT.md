# Actual Codebase Audit — real-jarvis branch
## Corrected baseline from direct GitHub API file reads

---

## What the agent was WRONG about

| Agent Claim | Reality (from committed file reads) |
|---|---|
| "HolographicMaterial already exists at HolographicEarth.tsx:657" | FALSE. File uses `meshPhongMaterial` with colorMap/normalMap/specularMap. No HolographicMaterial anywhere. |
| "wawa-vfx requires React 19 / fiber 9 / drei 10 — incompatible" | FALSE. Agent invented this constraint. wawa-vfx works with React 18 / fiber 8. |
| "5 TypeScript errors: earthMatRef, normalMap, specularMap" | FALSE. These errors came from the agent's own uncommitted working-tree edits, not from the committed file. |
| "The plan's premise of a clean build baseline is false" | FALSE. Agent read its own half-edited working-tree, not git HEAD. |

### Root cause
The agent reads its own working-tree (including its own previous failed edits) and reports those errors as pre-existing baseline problems. It then refuses to proceed — a self-created deadlock.

### Mandatory Step 0 breaks this pattern
Before touching any file the agent must run:
```bash
git stash
git status
tsc --noEmit 2>&1 | tail -10
```
And paste the output. No exceptions. The agent proceeds only if tsc is clean on committed state.

---

## Confirmed package.json — real-jarvis branch

```
react: 18.3.1 | react-dom: 18.3.1
@react-three/fiber: 8.16.6
@react-three/drei: ^9.122.0
three: 0.164.1
@react-three/postprocessing: 2.16.2
postprocessing: 6.35.4
maath: ^0.10.8
```

NOT in package.json: gsap, @arwes/react, wawa-vfx, CountUp, SplitText, DecryptedText, framer-motion.

This is a VITE project (vite: ^6.2.0). There is NO next.config.js. Do not look for it.

---

## HolographicEarth.tsx — actual committed state

- Globe mesh uses `<meshPhongMaterial>` with colorMap, normalMap, specularMap from useLoader
- Particle field: `<Points>` + `<PointMaterial color="#00F0FF" size={0.015}>`
- EffectComposer: `<Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.5} radius={0.6} />` only
- Contains: hand-tracking region detection, TerrainModel subcomponent, expansion gauge logic

MISSING: holographic GLSL, Fresnel glow, ChromaticAberration, Glitch, gold palette.
Current score: 5/10.

---

## BootSequence.tsx — actual committed state

14-second cinematic — already at Prometheus tier:
- `Reticle`: torus rings, 72 instanced ticks, sweep blade, warp-expand fly-through at 4.5s
- `Plexus`: 230 nodes, fibonacci sphere, line draw-in sorted by distance from centre
- `Ignition`: white core flash + anamorphic streak
- `CameraRig`: dolly z=5 → z=0.6 through reticle
- `Post`: EffectComposer with Bloom (mipmapBlur already set), ChromaticAberration, Vignette
- CSS text chromatic-split glitch at 8.5s, "SYSTEMS ONLINE" at 9.4s

CURRENT SCORE: 9/10. Skip this file entirely. DO NOT TOUCH.

---

## HUDOverlay.tsx — actual committed state

- rAF canvas loop: 21-landmark hand skeleton, joint arcs, connections
- Left hand: circular expansion gauge
- Right hand pinch: intel panel showing Signal%, Azimuth, Elevation from live handTrackingRef
- Signal bar uses `style={{ width: panelData.signal + '%' }}` + CSS `transition-all duration-150`

MISSING: Arwes SVG bracket frame, GSAP-animated bar.
Current score: 6/10.

---

## JarvisConsole.tsx — actual committed state

- Streaming chat with token append, onReasoning sub-channel, onDone handler
- Quick commands, minimise button, live status dot
- Streaming cursor blink (animate-blink class) during active token stream

MISSING: character-scramble reveal on completed responses.
Current score: 5/10.

---

## Corrected step map

| Step | File | Status | Action |
|---|---|---|---|
| 1 | HolographicEarth.tsx | NOT DONE | HolographicMaterial GLSL replaces meshPhongMaterial |
| 2 | HolographicEarth.tsx | NOT DONE | ChromaticAberration + Glitch inside existing EffectComposer |
| 3 | HUDOverlay.tsx + main.tsx | NOT DONE | Arwes FrameSVGCorners on intel panel; remove StrictMode |
| 4 | BootSequence.tsx | SKIP — DO NOT TOUCH | Already 9/10 |
| 5 | JarvisConsole.tsx | NOT DONE | DecryptedText on completed assistant messages only |
| 6 | HolographicEarth.tsx | NOT DONE | Recolor PointMaterial to gold #C9A84C |
| 7 | HUDOverlay.tsx | NOT DONE | GSAP fromTo on signal bar |
