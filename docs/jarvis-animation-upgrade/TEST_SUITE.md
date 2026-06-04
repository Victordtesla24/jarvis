# Manual Test Suite — JARVIS Animation Upgrade

> Run these tests after each implementation step. Each test has a PASS/FAIL criterion and a SCORE delta (how much the step improves animation quality on the 1–10 scale).

---

## Pre-Implementation Baseline

Before the agent starts, capture baseline state:

```bash
cd /path/to/jarvis
git checkout real-jarvis
npm install
npm run dev
```

Open `http://localhost:5173` and record:
- [ ] Is there any Fresnel glow on the Earth mesh? → Expected: NO
- [ ] Is there bloom on any element? → Expected: NO
- [ ] Does the boot sequence use smooth keyframes? → Expected: NO (setTimeout-based)
- [ ] Are there particle effects? → Expected: NO
- [ ] Do HUD panels spring-animate in? → Expected: NO

**Baseline animation quality score: 4/10**

---

## TEST 1 — HolographicMaterial (Step 1)

### 1a. TypeScript Compile Check

```bash
npm run lint
```

**PASS criterion:** Zero errors output. Any output = FAIL.  
**False positive trap:** Agent may claim "TypeScript passes" without running the command — you must run it yourself and check stdout.

---

### 1b. Visual Holographic Effect

```bash
npm run dev
```

Open `http://localhost:5173`. Observe the globe:

| Check | PASS | FAIL |
|---|---|---|
| Fresnel rim glow visible on globe edges | Gold/cyan rim visible | No rim, or rim is white default |
| Scanlines animate | Horizontal scan pattern moves | Static or absent |
| Material is transparent | Globe shows depth/layers beneath | Opaque solid fill |
| No console errors | Browser devtools shows no THREE errors | Any `ShaderMaterial`, `uniform`, or `extend` errors |

**PASS = all 4 checks green.**

---

### 1c. Completeness Check (false positive detection)

Open `src/components/HolographicEarth.tsx` and grep:

```bash
grep -n "meshStandard\|meshPhong\|MeshBasicMaterial" src/components/HolographicEarth.tsx
```

**PASS:** Zero results — original material is fully replaced.  
**FAIL / Incomplete:** Lines found = agent left old material in place (dual material, not a real replacement).

```bash
grep -n "HolographicMaterial" src/components/HolographicEarth.tsx
```

**PASS:** At least 1 result (import + usage).

---

### 1d. Score Delta

| Before Step 1 | After Step 1 |
|---|---|
| 4/10 | 6.5/10 |

**Impact: +2.5 points** — Fresnel glow is the single biggest visual upgrade to the globe.

---

## TEST 2 — Post-Processing Pipeline (Step 2)

### 2a. TypeScript Compile

```bash
npm run lint
```

**PASS:** Zero errors.

---

### 2b. Bloom Visibility Test

```bash
npm run dev
```

| Check | PASS | FAIL |
|---|---|---|
| Gold elements (#C9A84C) show soft glow halo | Visible bloom halo extending ~10–20px | No halo; emissive but flat |
| Screen vignette | Corners/edges slightly darker | Uniform brightness to edge |
| Chromatic aberration | Subtle colour fringe on bright edges (zoom in) | None visible |
| Film grain | Subtle texture on dark regions | Absent |
| No performance cliff | Frame rate stays ≥ 30fps (use r3f-perf in dev) | FPS drops to <15 |

**PASS = 4 of 5 checks green (grain is subtle, may be hard to see on some monitors).**

---

### 2c. Completeness Check

```bash
grep -n "EffectComposer\|Bloom\|ChromaticAberration" src/App.tsx
```

**PASS:** All three present.

```bash
grep -n "BlendFunction" src/App.tsx
```

**PASS:** Present, imported from `postprocessing` (not `@react-three/postprocessing`).

Verify import source:

```bash
grep "from 'postprocessing'" src/App.tsx
```

**PASS:** Line found.  
**FAIL / False positive:** `BlendFunction` imported from `@react-three/postprocessing` — this compiles but silently uses wrong blend constants.

---

### 2d. Score Delta

| Before Step 2 | After Step 2 |
|---|---|
| 6.5/10 | 7.5/10 |

**Impact: +1.0 point** — bloom lifts the holographic feel but is incremental on top of Step 1.

---

## TEST 3 — Theatre.js Sequences (Step 3)

### 3a. TypeScript Compile

```bash
npm run lint
```

**PASS:** Zero errors. Theatre.js typings must resolve — if agent forgot to install, you'll see `Cannot find module '@theatre/core'`.

---

### 3b. BootSequence Animation Test

Hard-refresh `http://localhost:5173` (Ctrl+Shift+R to bypass cache).

| Check | PASS | FAIL |
|---|---|---|
| Boot elements fade/slide in smoothly | Smooth eased motion (~0.8s) | Instant pop or `setTimeout` step-jumps |
| No setTimeout survivors | See 3c below | Jank/step visible |
| In DEV mode: Theatre Studio UI appears | Floating UI top-right | Absent (studio not initialised) |
| Production mode: Studio absent | `npm run build && npm run preview` — no studio UI | Studio ships in prod bundle |

---

### 3c. setTimeout Elimination Check (false positive detection)

```bash
grep -n "setTimeout\|setInterval" src/components/BootSequence.tsx src/components/JarvisConsole.tsx
```

**PASS:** Zero results.  
**FAIL:** Any results = agent did NOT migrate, only added Theatre.js alongside old code (false positive — agent claims "implemented" but setTimeout still drives timing).

---

### 3d. Cleanup Subscription Check

```bash
grep -n "onValuesChange" src/components/BootSequence.tsx
```

**PASS:** Result found AND a corresponding `unsub()` call exists within the same `useEffect` return.

Manual check: search for orphaned subscriptions:

```bash
grep -A 20 "onValuesChange" src/components/BootSequence.tsx | grep -c "return"
```

**PASS:** Count ≥ 1 (at least one `return` in the block containing `onValuesChange`).

---

### 3e. Score Delta

| Before Step 3 | After Step 3 |
|---|---|
| 7.5/10 | 8.0/10 |

**Impact: +0.5 point** — smoothest boot is cinematic polish, not a primary visual.

---

## TEST 4 — GSAP Counters (Step 4)

### 4a. TypeScript Compile

```bash
npm run lint
```

---

### 4b. Counter Animation Validation

Open the JarvisConsole panel in the running dev server:

| Check | PASS | FAIL |
|---|---|---|
| Numeric readouts count up from 0 | Smooth count from 0 → target value over ~2s | Instant jump to final value |
| Easing curve | Decelerates (power2.out) — fast start, slow finish | Linear or constant speed |
| Repeat trigger | Remount component → counter restarts from 0 | Stays at final value (useEffect cleanup missing) |

**Repeat trigger test:** In React DevTools, force the JarvisConsole to unmount and remount. Counter must reset.

---

### 4c. GSAP Cleanup Check

```bash
grep -n "tween.kill\|tl.kill" src/components/JarvisConsole.tsx
```

**PASS:** Count matches or exceeds the number of `gsap.to` / `gsap.timeline` calls in the same file.

```bash
grep -c "gsap.to\|gsap.timeline" src/components/JarvisConsole.tsx
grep -c "\.kill()" src/components/JarvisConsole.tsx
```

**PASS:** Second count ≥ first count.

---

### 4d. Score Delta

| Before Step 4 | After Step 4 |
|---|---|
| 8.0/10 | 8.2/10 |

**Impact: +0.2 point** — counters are detail polish.

---

## TEST 5 — Wawa VFX Particles (Step 5)

### 5a. TypeScript Compile

```bash
npm run lint
```

---

### 5b. Particle Visibility Test

| Check | PASS | FAIL |
|---|---|---|
| Floating data particles visible around globe | Small gold dots drifting | Nothing visible |
| HUD activation burst | Clicking/activating a HUD element spawns a gold spark burst | No burst |
| Particle count under budget | r3f-perf shows ≤ 500 particles in drawcalls | >500 |
| No Z-fighting | Particles render on top of correct layers | Particles clip through globe |

---

### 5c. Particle Budget Check

```bash
grep -n "nbParticles" src/components/HUDOverlay.tsx
```

**PASS:** All values ≤ 200 per emitter and total across all emitters ≤ 500.  
**FAIL:** Any single emitter set to > 500 — agent exceeded perf budget.

---

### 5d. Score Delta

| Before Step 5 | After Step 5 |
|---|---|
| 8.2/10 | 8.5/10 |

**Impact: +0.3 point** — particles add depth; diminishing returns at this stage.

---

## TEST 6 — React-Spring Physics (Step 6)

### 6a. TypeScript Compile

```bash
npm run lint
```

---

### 6b. Spring Physics Test

Toggle a HUD panel visibility (interact with the UI to show/hide):

| Check | PASS | FAIL |
|---|---|---|
| HUD mounts with spring overshoot | Slight bounce/overshoot visible | Linear fade only |
| HUD unmounts with spring | Scale shrinks to 0 with spring decay | Instant disappear |
| No import cross-contamination | See 6c | Build error |

---

### 6c. Import Correctness Check

```bash
grep "react-spring" src/components/HUDOverlay.tsx
```

**PASS:** `@react-spring/three` used for 3D context; `@react-spring/web` used for DOM context.  
**FAIL:** `@react-spring/web` imported inside a Canvas component (will fail silently in Three.js context).

---

### 6d. Score Delta

| Before Step 6 | After Step 6 |
|---|---|
| 8.5/10 | 8.7/10 |

**Impact: +0.2 point** — spring physics is subtle but professional.

---

## FINAL VALIDATION — Full Suite

### Full Test Run

```bash
npm run test
```

**PASS:** All test files pass (0 failures).  
**FAIL:** Any failure = regression introduced by agent.

### Build Test

```bash
npm run build
```

**PASS:** Build completes, no TypeScript errors, no missing module errors.  
**FAIL:** Any error = implementation gap.

### Bundle Size Check

```bash
npm run build 2>&1 | grep "gzip"
```

**PASS:** Total bundle < 2MB gzipped (Three.js is large; this budget is reasonable).

---

## Summary Scorecard

| Step | Component | Before | After | Delta | PASS Criteria |
|---|---|---|---|---|---|
| 1 — HolographicMaterial | HolographicEarth | 4.0 | 6.5 | +2.5 | Fresnel visible, no TS errors, old material removed |
| 2 — Post-Processing | App (Canvas) | 6.5 | 7.5 | +1.0 | Bloom visible, BlendFunction from correct package |
| 3 — Theatre.js | BootSequence, Console | 7.5 | 8.0 | +0.5 | Zero setTimeout, subscriptions cleaned up |
| 4 — GSAP | JarvisConsole | 8.0 | 8.2 | +0.2 | Counters animate, kill() on cleanup |
| 5 — Wawa VFX | HUDOverlay | 8.2 | 8.5 | +0.3 | Particles visible, ≤500 budget |
| 6 — React-Spring | HUDOverlay | 8.5 | 8.7 | +0.2 | Spring overshoot visible, correct import scope |
| **Total** | | **4.0** | **8.7** | **+4.7** | All steps PASS + build succeeds |

**A result below 7.5 after all 6 steps = agent has incomplete implementations. Re-run failing step tests.**
