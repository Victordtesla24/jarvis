## AGENT DIRECTIVE

You are implementing a 6-step animation upgrade to the JARVIS Holographic Interface project. You must:

1. Read ALL reference documents listed below before writing a single line of code
2. Implement each step sequentially and verify it before moving to the next
3. Run `npm run lint` and `npm run test` after EVERY step — do not self-approve
4. Commit each step separately with the exact commit message format specified
5. Never introduce: `@ts-ignore`, `eslint-disable`, `any`-casts, placeholders, TODOs, or duplicate files
6. Evidence required for each step: file path + line number of every change, plus stdout of `npm run lint` and `npm run test`

---

## REPOSITORY

```bash
git clone https://github.com/Victordtesla24/jarvis.git
cd jarvis
git checkout real-jarvis
npm install
```

---

## REFERENCE DOCUMENTS  

Read these documents from `/Users/vic/Downloads/jarvis-holographic-1.0.0/docs/jarvis-animation-upgrade/` dir in the below specifiied order before implementing

| # | Document | Purpose |
|---|---|---|
| 1 | `ANIMATION_SPEC.md` | Master spec — all 6 steps, constraints, success criteria |
| 2 | `HOLOGRAPHIC_MATERIAL_REFERENCE.md` | Complete GLSL + TypeScript for HolographicMaterial |
| 3 | `POSTPROCESSING_REFERENCE.md` | EffectComposer setup, bloom emissive config |
| 4 | `THEATRE_JS_SEQUENCE_REFERENCE.md` | Theatre.js project bootstrap + BootSequence + JarvisConsole migration |
| 5 | `GSAP_VFX_SPRING_REFERENCE.md` | GSAP counters, Wawa VFX particles, react-spring physics |
| 6 | `TEST_SUITE.md` | Manual verification criteria per step |

---

## IMPLEMENTATION SEQUENCE

### STEP 1 — HolographicMaterial

**Files to create:**
- `src/materials/HolographicMaterial.tsx` — implement exactly as specified in `HOLOGRAPHIC_MATERIAL_REFERENCE.md`

**Files to edit:**
- `src/components/HolographicEarth.tsx` — replace existing material with `<HolographicMaterial>` per Usage section in `HOLOGRAPHIC_MATERIAL_REFERENCE.md`

**Verify:**
```bash
npm run lint    # must produce zero output
npm run test    # must produce 0 failures
```

**Commit:**
```bash
git add src/materials/HolographicMaterial.tsx src/components/HolographicEarth.tsx
git commit -m "feat(animation): step 1 — HolographicMaterial with Fresnel + scanlines"
```

**Evidence required:** Full stdout of lint and test. Line number of old material replaced in HolographicEarth.tsx.

---

### STEP 2 — Post-Processing Pipeline

**Files to edit:**
- `src/App.tsx` — add EffectComposer per `POSTPROCESSING_REFERENCE.md`
- Mesh files requiring emissive values (per POSTPROCESSING_REFERENCE.md "Making Materials Bloom")

**No new npm installs** — both packages already in package.json.

**Verify:**
```bash
npm run lint
npm run test
```

**Commit:**
```bash
git add src/App.tsx
git commit -m "feat(animation): step 2 — EffectComposer bloom + chromatic aberration + vignette"
```

**Evidence required:** Stdout of lint and test. Lines added to App.tsx (with line numbers).

---

### STEP 3 — Theatre.js Sequences

**Install:**
```bash
npm install @theatre/core @theatre/r3f
npm install --save-dev @theatre/studio
```

**Files to create:**
- `src/theatre/project.ts` — per `THEATRE_JS_SEQUENCE_REFERENCE.md`

**Files to edit:**
- `src/main.tsx` — dev-only studio init
- `src/components/BootSequence.tsx` — migrate setTimeout to Theatre.js
- `src/components/JarvisConsole.tsx` — Theatre.js stagger sequence

**Critical check before committing:**
```bash
grep -n "setTimeout|setInterval" src/components/BootSequence.tsx src/components/JarvisConsole.tsx
# MUST return zero results
```

**Verify:**
```bash
npm run lint
npm run test
```

**Commit:**
```bash
git add src/theatre/ src/main.tsx src/components/BootSequence.tsx src/components/JarvisConsole.tsx
git commit -m "feat(animation): step 3 — Theatre.js keyframed boot sequence + console stagger"
```

**Evidence required:** Grep result (must be empty). Lint + test stdout.

---

### STEP 4 — GSAP Counter Animations

**Install:**
```bash
npm install gsap
```

**Files to edit:**
- `src/components/JarvisConsole.tsx` — GSAP counter + staggered line reveal per `GSAP_VFX_SPRING_REFERENCE.md`

**Critical check:**
```bash
grep -c "gsap.to|gsap.timeline" src/components/JarvisConsole.tsx
grep -c ".kill()" src/components/JarvisConsole.tsx
# Second count must be >= first count
```

**Verify:**
```bash
npm run lint
npm run test
```

**Commit:**
```bash
git add src/components/JarvisConsole.tsx
git commit -m "feat(animation): step 4 — GSAP counter animations + staggered line reveal"
```

**Evidence required:** Both grep counts. Lint + test stdout.

---

### STEP 5 — Wawa VFX Particles

**Install:**
```bash
npm install wawa-vfx
npm install --save-dev r3f-perf
```

**Files to edit:**
- `src/components/HUDOverlay.tsx` — add AmbientDataParticles and HUDActivationBurst per `GSAP_VFX_SPRING_REFERENCE.md`

**Critical check:**
```bash
grep -n "nbParticles" src/components/HUDOverlay.tsx
# All values must be <=200; total across emitters <=500
```

**Verify:**
```bash
npm run lint
npm run test
```

**Commit:**
```bash
git add src/components/HUDOverlay.tsx
git commit -m "feat(animation): step 5 — Wawa VFX gold particle bursts + ambient data particles"
```

**Evidence required:** Grep result with all nbParticles values. Lint + test stdout.

---

### STEP 6 — React-Spring Physics

**Install:**
```bash
npm install @react-spring/three @react-spring/web
```

**Files to edit:**
- `src/components/HUDOverlay.tsx` — AnimatedHUDPanel spring wrapper per `GSAP_VFX_SPRING_REFERENCE.md`

**Critical check:**
```bash
grep -n "react-spring" src/components/HUDOverlay.tsx
# @react-spring/three inside Canvas; @react-spring/web outside Canvas only
```

**Verify:**
```bash
npm run lint
npm run test
npm run build
```

**Commit:**
```bash
git add src/components/HUDOverlay.tsx
git commit -m "feat(animation): step 6 — react-spring physics mount/unmount on HUD panels"
```

**Evidence required:** Grep import scope result. Lint + test + build stdout.

---

## FINAL VERIFICATION

```bash
npm run test
npm run build
git log --oneline -6
```

Expected git log:
```
<hash> feat(animation): step 6 — react-spring physics mount/unmount on HUD panels
<hash> feat(animation): step 5 — Wawa VFX gold particle bursts + ambient data particles
<hash> feat(animation): step 4 — GSAP counter animations + staggered line reveal
<hash> feat(animation): step 3 — Theatre.js keyframed boot sequence + console stagger
<hash> feat(animation): step 2 — EffectComposer bloom + chromatic aberration + vignette
<hash> feat(animation): step 1 — HolographicMaterial with Fresnel + scanlines
```

PASS criteria:
- 0 TypeScript errors
- 0 test failures
- Build succeeds
- 6 commits present
- Animation quality score: 8.5-8.7/10 (up from 4.0)

---

## HARD CONSTRAINTS

Applies to every step. Violation = re-implement:

- No `@ts-ignore`, `eslint-disable`, `any`-casts
- No placeholder comments (TODO, rest of code)
- No dead code
- No replacement files — surgical edits only (except the 2 new files: HolographicMaterial.tsx, project.ts)
- Every useEffect subscription/timeline must return a cleanup function
- npm run lint passes after EVERY step
- Self-approval not accepted — paste real stdout as evidence
