# Corrected Test Suite
## 2 tests per step — grounded in actual committed codebase

> Test A: grep/tsc check — catches false positives (agent claims done, code is absent)
> Test B: visual browser check — catches incomplete or broken implementations
> PASS = both A and B pass independently

---

## Pre-run Baseline

```bash
git stash && git status
tsc --noEmit 2>&1 | grep -c "error TS"
# Expected: 0

# Confirm nothing from plan is present yet:
grep -c "HolographicMaterial" src/components/HolographicEarth.tsx    # expect 0
grep -c "GlitchMode" src/components/HolographicEarth.tsx             # expect 0
grep -c "FrameSVGCorners" src/components/HUDOverlay.tsx              # expect 0
grep -c "DecryptedText" src/components/JarvisConsole.tsx             # expect 0
grep -c "gsap" src/components/HUDOverlay.tsx                         # expect 0
grep -c '"#C9A84C"' src/components/HolographicEarth.tsx              # expect 0
```

Baseline score: 5/10

---

## Step 0 — Baseline Is Clean

### Test 0A
```bash
git stash && git status
# Must: "nothing to commit, working tree clean"

tsc --noEmit 2>&1 | grep -c "error TS"
# Must: 0

npm run build 2>&1 | tail -5
# Must: no errors
```

FAIL signal: Any TypeScript errors on committed state. Report them. Do not proceed.
TRAP: If errors exist only after `git stash` fails (uncommitted edits), run stash manually and retry.

### Test 0B
`npm run dev` — site loads at localhost:5173, globe renders, no browser console errors.

---

## Step 1 — HolographicMaterial Shader on Globe

### Test 1A — Code check (false-positive trap)

```bash
echo "=== Material file downloaded and has GLSL ==="
wc -c src/materials/HolographicMaterial.jsx 2>/dev/null
# Must: > 3000 bytes. If < 1000: CDN redirect — NOT a valid file = FALSE POSITIVE

grep -c "fresnelAmount" src/materials/HolographicMaterial.jsx
# Must: >= 1. If 0: truncated download = FALSE POSITIVE

echo "=== Imported AND used in HolographicEarth ==="
grep -c "HolographicMaterial" src/components/HolographicEarth.tsx
# Must: 2 (import line + JSX tag). If 1: imported but never used.

echo "=== matRef update call in useFrame ==="
grep -c "matRef.current?.update\|matRef.current.update" src/components/HolographicEarth.tsx
# Must: 1. If 0: material is static — scanlines do not animate = FALSE POSITIVE

echo "=== meshPhongMaterial removed from earth mesh ==="
grep -n "meshPhongMaterial" src/components/HolographicEarth.tsx
# Must: 0 results inside <mesh ref={earthRef}>. If present: old material still there.

echo "=== tsc clean ==="
tsc --noEmit 2>&1 | grep -c "error TS"
# Must: 0
```

### Test 1B — Visual

Open localhost:5173. Look at the globe.

PASS when:
- Globe surface has horizontal scanlines scrolling slowly downward
- Globe edge has bright gold/amber Fresnel rim glow
- Globe flickers briefly (1-2 second random signal blink)
- Gold color tone visible (not pure cyan or pure blue)
- Earth texture is still visible through the shader effect

FAIL when:
- Globe is solid black or invisible (hologramOpacity not passed)
- Globe is solid white (hologramBrightness too high — try 0.9)
- Globe looks identical to before, no scanlines (matRef.update() not called)
- Console error: "HolographicMaterial is not a constructor" (wrong import path)

Score: 5/10 → 8/10

---

## Step 2 — ChromaticAberration + Glitch in EffectComposer

### Test 2A — Code check

```bash
echo "=== Both effects imported ==="
grep -c "ChromaticAberration" src/components/HolographicEarth.tsx
# Must: 2 (import + JSX). If 1: imported but not used.

grep -c "GlitchMode.SPORADIC" src/components/HolographicEarth.tsx
# Must: 1. If 0: SPORADIC not set = constant glitch = wrong behavior = FALSE POSITIVE

echo "=== Existing Bloom preserved unchanged ==="
grep -c "luminanceThreshold={0.2}" src/components/HolographicEarth.tsx  # must: 1
grep -c "mipmapBlur" src/components/HolographicEarth.tsx                # must: 1
grep -c "intensity={1.5}" src/components/HolographicEarth.tsx           # must: 1

echo "=== tsc clean ==="
tsc --noEmit 2>&1 | grep -c "error TS"
# Must: 0
```

### Test 2B — Visual

Watch localhost:5173 for 30 seconds.

PASS when:
- Scene is mostly calm (no constant glitch — ratio=0.85 means 85% calm)
- 1-2 brief glitch flashes occur within 30 seconds
- Subtle color fringing at high-contrast edges (ChromaticAberration working)
- Glow halo still present around bright elements (Bloom unchanged)

FAIL when:
- Constant glitch on every frame (GlitchMode.CONSTANT accidentally set)
- No glitch in 30 seconds (delay too high, effect not wired)
- Scene blown out bright white (Bloom threshold changed)
- Console error: "GlitchMode is not defined" (import missing)

Score: 8/10 → 8.5/10

---

## Step 3 — Arwes Intel Panel Frame

### Test 3A — Code check

```bash
echo "=== StrictMode removed from entry point ==="
grep -c "StrictMode" src/main.tsx
# Must: 0. If 1: Arwes will silently fail or throw React double-invoke errors.

echo "=== Arwes animation wired (not just static frame) ==="
grep -c "aaVisibility" src/components/HUDOverlay.tsx
# Must: 1. If 0: FrameSVGCorners present but animation not configured = FALSE POSITIVE

grep -c "FrameSVGCorners" src/components/HUDOverlay.tsx
# Must: 1

grep -c "AnimatorGeneralProvider" src/components/HUDOverlay.tsx
# Must: 1

echo "=== rAF loop still intact ==="
grep -c "requestAnimationFrame" src/components/HUDOverlay.tsx
# Must: >= 1. If 0: agent deleted the canvas render loop = CRITICAL REGRESSION.

echo "=== tsc clean ==="
tsc --noEmit 2>&1 | grep -c "error TS"
# Must: 0
```

### Test 3B — Visual

Test 3B requires a real pinch gesture OR temporarily set `useState(true)` for `showIntelPanel`.

PASS when:
- Intel panel has angular SVG corner brackets that animate/build in on appear
- Brackets appear first, then panel content fades in (Arwes enter sequence)
- Panel still shows Signal%, Azimuth, Elevation
- Hand skeleton still renders on the canvas (rAF loop intact)

FAIL when:
- Panel appears but has plain CSS borders only (Arwes not activating — StrictMode still on)
- Hand skeleton disappeared (rAF loop broken)
- Panel never appears (Animator active prop not wired to showIntelPanel)
- Console error: "@arwes/react" import fails (package not installed)

Score: 8.5/10 → 9/10

---

## Step 4 — SKIPPED (BootSequence unchanged)

```bash
git diff HEAD src/components/BootSequence.tsx | wc -l
# Must: 0 (no diff lines). If > 0: agent touched it = regression risk.
```

No visual test — do not even run the boot sequence to check.

---

## Step 5 — DecryptedText on Completed Console Messages

### Test 5A — Code check

```bash
echo "=== DecryptedText file installed by jsrepo ==="
find src -name "DecryptedText*" 2>/dev/null | head -3
# Must: at least one result

echo "=== Imported and used in JarvisConsole ==="
grep -c "DecryptedText" src/components/JarvisConsole.tsx
# Must: 2 (import + JSX). If 1: imported but not rendered.

echo "=== Streaming guard present (key false-positive trap) ==="
grep -c "e.streaming" src/components/JarvisConsole.tsx
# Must: >= 2. If DecryptedText applied without guard, every new token triggers
# a full re-scramble mid-stream (broken UX). The guard is mandatory.

echo "=== Streaming cursor blink preserved ==="
grep -c "animate-blink" src/components/JarvisConsole.tsx
# Must: 1. If 0: streaming cursor removed = regression.

echo "=== tsc clean ==="
tsc --noEmit 2>&1 | grep -c "error TS"
# Must: 0
```

### Test 5B — Visual

Send a message to JARVIS: type "System status" and press SEND.

PASS when:
- During streaming: text appears as plain character stream + blinking cursor
- After `onDone` fires: text does a brief character-scramble (1-3 seconds), then resolves cleanly
- Scramble moves left-to-right (sequential: true)

FAIL when:
- Text scrambles on every new token (guard missing — re-renders DecryptedText per token)
- Text never scrambles on completion (wrong prop path or component not found)
- Streaming cursor missing during token stream

Score: 9/10 → 9.2/10

---

## Step 6 — Gold Particle Recolor

### Test 6A — Code check

```bash
echo "=== Gold color in PointMaterial ==="
grep -n '"#C9A84C"' src/components/HolographicEarth.tsx
# Must: at least 1 result near PointMaterial

echo "=== Old cyan NOT in PointMaterial ==="
grep -n '"#00F0FF"' src/components/HolographicEarth.tsx
# Check the result line number. If it shows a PointMaterial line: cyan not replaced.

echo "=== Size increased ==="
grep -c "size={0.02}" src/components/HolographicEarth.tsx
# Must: 1

tsc --noEmit 2>&1 | grep -c "error TS"
# Must: 0
```

### Test 6B — Visual

Look at the particle field around the globe.

PASS when:
- Particles are gold/amber, not cyan
- Particles are slightly larger than before
- Particles still orbit/rotate as before (only color + size changed)

FAIL when:
- Particles still cyan (wrong property or wrong component)
- Particles invisible (color format error)

Score: 9.2/10 → 9.4/10

---

## Step 7 — GSAP Signal Bar

### Test 7A — Code check

```bash
echo "=== gsap in package.json ==="
grep -c '"gsap"' package.json
# Must: 1

echo "=== gsap.fromTo called (not just imported) ==="
grep -c "gsap.fromTo" src/components/HUDOverlay.tsx
# Must: 1. If 0: GSAP installed but never called = FALSE POSITIVE.

echo "=== signalBarRef declared and applied ==="
grep -c "signalBarRef" src/components/HUDOverlay.tsx
# Must: >= 2 (declaration + ref={} prop)

echo "=== CSS transition removed (would conflict with GSAP) ==="
grep -c "transition-all duration-150" src/components/HUDOverlay.tsx
# Must: 0. If 1: CSS fights GSAP = janky animation.

echo "=== transformOrigin set correctly ==="
grep -c "left center" src/components/HUDOverlay.tsx
# Must: >= 1 (bar fills from left — Prometheus style)

tsc --noEmit 2>&1 | grep -c "error TS"
# Must: 0
```

### Test 7B — Visual

Trigger the intel panel (pinch or temporarily set showIntelPanel=true).

PASS when:
- Signal bar animates from 0% to target over ~1.5 seconds
- Fill direction is left-to-right
- Bar color/glow unchanged from original (still cyan glow)

FAIL when:
- Bar jumps to full width instantly (GSAP not running — overwrite not working or ref not set)
- Bar stays at width=0 (scaleX stuck — dependency array wrong)
- Bar fills right-to-left (transformOrigin misconfigured)
- Scanline animation inside bar broken (inner div affected by transform)

Score: 9.4/10 → 9.6/10

---

## Final Acceptance Check

```bash
tsc --noEmit 2>&1 | tail -10          # must: zero errors
npm run build 2>&1 | tail -10         # must: clean build

# Confirm all symbols present:
grep -c "HolographicMaterial" src/components/HolographicEarth.tsx   # 2
grep -c "matRef.current?.update" src/components/HolographicEarth.tsx # 1
grep -c "GlitchMode.SPORADIC" src/components/HolographicEarth.tsx    # 1
grep -c "FrameSVGCorners" src/components/HUDOverlay.tsx              # 1
grep -c "aaVisibility" src/components/HUDOverlay.tsx                 # 1
grep -c "DecryptedText" src/components/JarvisConsole.tsx             # 2
grep -c "gsap.fromTo" src/components/HUDOverlay.tsx                  # 1
grep -c '"#C9A84C"' src/components/HolographicEarth.tsx              # 1
grep -c "StrictMode" src/main.tsx                                     # 0
git diff HEAD src/components/BootSequence.tsx | wc -l               # 0
```

Score table:

| Step | Effect | Score Before | Score After | Delta |
|---|---|---|---|---|
| Baseline | — | 5/10 | 5/10 | — |
| 1 | Holographic scanline + Fresnel | 5/10 | 8/10 | +3.0 |
| 2 | ChromaticAberration + Glitch | 8/10 | 8.5/10 | +0.5 |
| 3 | Arwes intel panel frame | 8.5/10 | 9.0/10 | +0.5 |
| 4 | Boot sequence | 9.0/10 | 9.0/10 | 0 (skipped) |
| 5 | Console DecryptedText | 9.0/10 | 9.2/10 | +0.2 |
| 6 | Gold particles | 9.2/10 | 9.4/10 | +0.2 |
| 7 | GSAP signal bar | 9.4/10 | 9.6/10 | +0.2 |

If final score is below 8.0/10: Step 1 (holographic shader) failed or matRef.update() is missing.
That single step accounts for 3 points — it is the highest-impact implementation in the plan.
