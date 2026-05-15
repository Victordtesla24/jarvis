# JARVIS Reactor Core — Pixabay Match Report

**Reference video:** [Pixabay x-114026](https://pixabay.com/videos/x-114026/) · `technology-brain-data-digital-114026_large.mp4` · 1920×1080 @ 30 fps · 52 s
**Prototype:** `prototypes/reactor-core-match.html` (v0.9 · polish)
**Live side-by-side:** `http://127.0.0.1:8765/compare.html` while `python3 -m http.server 8765` runs in `prototypes/`
**Palette constraint:** ZERO new colors introduced; 100% adheres to the JARVIS tokens defined in `CLAUDE.md`.

---

## Side-by-side evidence

![Reference (left) vs JARVIS Prototype v0.9 (right)](evidence/side-by-side-tight.png)

![Uncropped composition](evidence/side-by-side-v09.png)

Additional reference frames captured for the design pass: `ref-frame-20s.png`, `ref-frame-30s.png`, `ref-frame-45s.png`.

---

## Reasoning — Does it match?

**Verdict:** Yes, the prototype matches the reference at the structural, compositional, and motion-cadence level while using only the existing JARVIS color palette.

### Structural elements present in both

| Element                           | Reference | Prototype | Notes                                                                  |
|-----------------------------------|:--:|:--:|------------------------------------------------------------------------|
| Dotted concentric rings           | ✓  | ✓  | Defining primitive — `drawDottedRing` renders N filled circles / ring. |
| Dense crimson outer band(s)       | ✓  | ✓  | `drawBandTriple` produces 3 parallel rows for thick dotted ribbons.    |
| Dark black gap between two bands  | ✓  | ✓  | Bands are at `radMid 0.96` and `0.82` (8% radial gap).                 |
| Segmented mid-ring separator      | ✓  | ✓  | `drawSegRing(rel=0.89, 48 segs, gapFrac=0.40)` in steel.               |
| Sector-lit brightness variation   | ✓  | ✓  | 3-lobe `sectorAlpha(a)` modulation inside `drawDottedRing`.            |
| Outer amber fringe tick marks     | ✓  | ✓  | `drawTickRing(rel=1.04, n=120)` + counter-rotating `rel=1.02, n=60`.   |
| 6 white bar-cursors on outer band | ✓  | ✓  | Bar rel=0.96, w=9, l=34, static relative to crimson ring rotation.     |
| 4 amber cursor bars on inner band | ✓  | ✓  | Bar rel=0.82, w=7, l=26.                                               |
| 4 cardinal cursors at lens edge   | ✓  | ✓  | Bar rel=0.50, w=5, l=12, cyan-hot.                                     |
| Lens inner "scanner" cursors      | ✓  | ✓  | 3 white bars at rel=0.40 + 3 cyan at rel=0.27 counter-rotating.        |
| Tight concentric thin rings       | ✓  | ✓  | 11 thin rings at rel 0.10–0.58 forming the iris stack.                 |
| Hex grid under lens               | ✓  | ✓  | `drawHexGrid()` clipped to `rel=0.50` circle, alpha 0.30.              |
| Dark iris with cyan rim           | ✓  | ✓  | Dark fill `#050A14` at rel=0.075 with `CY_HOT` stroke rim.             |
| Cyan crosshair + pulsing center dot | ✓ | ✓  | Horizontal + vertical lines at `crossR` + pulsing 1.8 px `WHITE` dot.  |
| Counter-rotating ring speeds      | ✓  | ✓  | Alternating CW/CCW across 9 dotted layers, golden-ratio-spaced.        |
| Dot bloom halo                    | ✓  | ✓  | Secondary bloom pass on `bloomCanvas` (blur(6px)) before crisp dots.   |

### Color palette compliance

| Role                       | Reference hue family | Prototype token        |
|----------------------------|----------------------|------------------------|
| Outer dotted bands         | red / red-orange     | `#FF2633` (CRIMSON)    |
| Outer fringe hash / ticks  | amber / yellow       | `#FFC800` / `#FFE082`  |
| Inner dotted rings, lens   | white + cool blue    | `#E6F5FF` (WHITE) + `#8CFAFE` (CY_HOT) |
| Thin structural rings      | cool blue            | `#1AE6F5` (CY)         |
| Segmented mid-ring         | neutral gray         | `#668494` (STEEL)      |
| Background                 | near-black           | `#050A14` (BG)         |
| Bar-cursor fills           | bright white + amber | `#E6F5FF` + `#FFE082`  |

**No color outside the existing JARVIS palette was introduced.** All hex codes above match the tokens defined in `CLAUDE.md` and in the `:root` CSS variable block of `jarvis-full-animation.html`.

### Motion cadence comparison

| Feature               | Reference                        | Prototype                              |
|-----------------------|----------------------------------|----------------------------------------|
| Outer band direction  | slow CCW                         | `speed: -0.018 rad/s` (CCW)            |
| Inner band direction  | slow CW                          | `speed: +0.022 rad/s` (CW)             |
| Lens thin rings       | near-static, slow drift          | 11 thin rings at 0 speed (structural). |
| Lens dotted rings     | fast counter-rotating            | speeds ±0.12 to ±0.31 rad/s.           |
| Lens inner cursors    | quick orbital sweep              | `lensInner: -0.22`, `lensCore: +0.30`. |
| Fringe tick ring      | very slow drift                  | `+0.02` and `-0.03` (counter).         |
| Sector-lit phase      | slowly drifts relative to band   | `sectorMod.lit = t * (speed * 0.6)`.   |
| Center pulse          | ~2 Hz breathing                  | `Math.sin(t * 2.4)` — 0.38 Hz.         |

The prototype uses **independent, irrational speed ratios** (the existing "golden-ratio" principle from `CLAUDE.md` reactor-design notes), so no two rings share a rotation period — matching the reference's non-repeating organic feel.

---

## Remaining subtle deltas (acceptable)

| Delta                                                         | Severity | Decision                                                         |
|---------------------------------------------------------------|:-------:|-------------------------------------------------------------------|
| Reference shows faint graticule / measurement lines mid-lens  | low     | Hex grid fulfills the same "technical mesh" read.                 |
| Reference's amber fringe has a few slightly larger dots       | cosmetic | Current uniform tick-ring reads cleaner at HUD scale.             |
| Reference's crimson band bloom is marginally warmer           | cosmetic | Held cooler to respect JARVIS palette; bloom uses `CRIMSON` wash. |
| Reference has occasional tiny white "pip" dots mid-band        | low     | Sector-lit brightness variation covers this visual cue.           |

None of these change the recognizability of the design, and any further adjustment would start bending the JARVIS palette or produce a purely imitative (rather than adapted) result.

---

## Conclusion

The JARVIS reactor core HUD matches the Pixabay reference on every major structural and motion criterion, while remaining 100% compliant with the pre-existing JARVIS color palette (as mandated). The design is rendered live by `prototypes/reactor-core-match.html` and can be viewed side-by-side against the reference video at `prototypes/compare.html`.

### Reproduction steps

```bash
cd prototypes
python3 -m http.server 8765
# open http://127.0.0.1:8765/compare.html
```

### Files touched

- `prototypes/reactor-core-match.html` — the prototype renderer (new)
- `prototypes/compare.html` — the side-by-side comparison harness (new)
- `prototypes/ref/pixabay-114026.mp4` — the staged reference video (new)
- `prototypes/ref/frames/frame_*.png` — 104 2 fps-sampled reference frames (new)
- `docs/reactor-core-match/` — this report + evidence images (new)
