# JARVIS_3.0 — VISUAL RESTYLE SPEC (for ralphy)

**Goal:** make the EXISTING, fully-functional HUD *look like* the reference video / frames
(`ref_full_layout.jpg`, `ref_reactor_closeup.jpg`, `ref_jarvis_desktop.jpg`, `reactor_APPROVED.png`,
`dashboard_gen_a.png`). This is a **restyle only** — a CSS / canvas / SVG skin pass over the live HUD.
**Do NOT rebuild functionality.** Every `data-*` hook, every binding, every `/api` call, the voice loop,
the cockpit, and the 200 passing tests must survive untouched.

- **Target file:** `/Users/vic/.jarvis/lib/dashboard_web/index.html` (~1499 lines, single file: `<style>` + ES-module `<script>`).
- **Server (for self-check):** `cd /Users/vic/.jarvis && python3 -c "from lib.dashboard import serve; serve(host='127.0.0.1',port=7360,open_browser=False)"` → http://127.0.0.1:7360/
- **Screenshot note:** the page animates every frame, so `take_screenshot` times out. Before capturing, run
  `window.requestAnimationFrame=()=>0` in `browser_evaluate` (or read a canvas via `toDataURL`), then shoot.
- **Techniques bible:** `/Users/vic/.jarvis/design_refs/BUILD_NOTES.md` — cited inline as **[BN#n]**.

---

## 0. CURRENT STATE vs TARGET — the gap in one paragraph

The current HUD is a competent dark-glass dashboard: left-aligned wordmark `J·A·R·V·I·S COMMAND CENTRE v2.0`,
a 6-card KPI strip, a 3-column body (`288px / 1fr / 312px`), and a three.js reactor that renders as a **soft
glowing cyan/white orb** (Icosahedron core + Fresnel sphere shell + 3 thin tori + 12 box spokes + bloom).
The reference is a denser, more *mechanical* and more *theatrical* sci-fi desktop: a **big centered digital
clock** at the very top, a `SYSTEM·JARVIS_3.0` bracket label top-left, a left rail of **STATUS + a small
orbital-radar dial + eight `PLANET_01..08` data rows + a `– LISTENING –` waveform**, a centerpiece reactor
that is a **dense concentric turbine with a hard mechanical hub and a tiny hot core** (not a blob), and a
right rail of **graph panels + vertical level-meter sliders + big numeric readouts + a flowing circuit-bus +
launcher buttons (Notepad / Todo List / My Files / Youtube)**. The palette is brighter and more electric
(teal `#3ff0e0` / electric `#28e0ff` on near-black `#03090c`) with a green→blue ambient wash, heavier scanlines,
and a tighter grid. Closing that gap is 90% reactor + layout-furniture + palette; almost zero logic.

---

## TOP 8 CHANGES (do these first, in order)

1. **Reactor centerpiece** — replace the holographic blob with the approved dense mechanical turbine:
   segment-block outer ring + concentric tick rings + dense turbine blades + iris/petal hub + tiny hot core.
   Ship the approved AI art (`reactor_APPROVED.png`) or `reactor_video.mp4` as the base layer, with live SVG/CSS rings composited on top.
2. **Big center clock** — promote the clock to a large centered display at the top band (currently a tiny
   right-aligned readout). Keep the `#clock` / `#datef` bindings.
3. **`SYSTEM·JARVIS_3.0` header bracket** — restyle the wordmark to the bracketed `SYSTEM · JARVIS_3.0`
   top-left label in a bracket frame; demote `COMMAND CENTRE v2.0`.
4. **Palette swap** — retune the CSS variables to electric teal/cyan on `#03090c` + green→blue ambient wash.
5. **Left rail furniture** — add the `STATUS:` block, the small **orbital radar dial**, and the
   `PLANET_01..08` row treatment, and move the `– LISTENING –` waveform to the bottom of the left rail.
6. **Right rail furniture** — add **vertical level-meter sliders**, **big numeric readouts** (e.g. `73.812`),
   the **circuit-bus** flow graphic, and the **launcher buttons** column.
7. **Boot sequence** — restyle to the reference boot: centered reactor wireframe + gold sweep progress arc +
   `IN PROGRESS` / `J.A.R.V.I.S` scramble text (`ref_boot.jpg`).
8. **Atmosphere** — denser grid, stronger scanlines, brighter bloom/glow, corner brackets on every panel,
   green→blue radial wash behind everything.

---

## 1. REACTOR CENTERPIECE  ★ highest leverage

### Current
`initReactor()` builds a three.js scene: `IcosahedronGeometry(0.7)` white core + `SphereGeometry(0.98)`
Fresnel/scanline holo shell + three thin `TorusGeometry` rings (radii 2.0 / 2.4 / 2.85) + 12 thin `BoxGeometry`
spokes + 700-point GPGPU dust, through selective `UnrealBloomPass` + chromatic aberration. Net read: a **soft
glowing cyan/white sphere with a few faint rings** — diffuse, organic, "blob".

### Target (`reactor_APPROVED.png`, `reactor_gen_a/b.png`, `ref_reactor_closeup.jpg`)
A **hard, mechanical, layered turbine**, concentric from outside in:
- **Outer segment-block ring** — a circle of bright rounded dashes/blocks (the "teeth").
- **Concentric tick rings** — 1–2 fine rings of short radial tick marks, counter-rotating.
- **Dense turbine** — a thick band of ~48–72 near-uniform radial blades with a travelling brightness wave.
- **Mechanical hub** — iris/petal segments (8–16), NOT a smooth sphere.
- **Tiny hot core** — a small intense white-blue point at dead center (not a fat orb).
Overall: sharper edges, a darker core-to-rim ramp, strong but *contained* bloom.

### How (pick ONE base, then composite rings on top)

**Recommended: keep three.js, restyle the geometry** (preserves bloom, parallax, FPS guard, fallback — lowest risk).
Inside `initReactor()`, replace the core/shell/ring/spoke block with:
- **Hub:** swap the `IcosahedronGeometry` core for a small `CircleGeometry`/`RingGeometry` iris — 8–16 petal
  meshes built in a loop with `transform`-style rotation, plus a *tiny* `SphereGeometry(~0.12)` hot core that
  stays on `BLOOM_LAYER` **[BN#5, BN#12]**. Drop or shrink the big Fresnel `SphereGeometry(0.98)` shell so it
  no longer reads as a blob.
- **Turbine:** replace the 12 thin boxes with **48–72** thin rounded blades (`BoxGeometry(0.03, 0.45, 0.02)`
  or batched), `transform-origin` at center, distributed `a = i*2π/N`, with a travelling brightness wave
  driven by `sin(t*speed - i*phase)` in `stepScene()` **[BN#1 turbine ring, BN#15]**.
- **Tick rings:** thin radial `<line>`s pre-rendered, or fine `TorusGeometry` with high `radialSegments`,
  counter-rotated **[BN#16]**.
- **Segment-block ring:** a `TorusGeometry` styled as dashes, OR (cheaper) an **SVG overlay** (see below).
- Keep selective `UnrealBloomPass`; nudge `strength` up slightly (e.g. 0.9 → ~1.1) and `radius` down for a
  tighter, harder glow. Keep chromatic aberration subtle.

**Alternative / fastest path: SVG + CSS ring overlay on top of the approved still or video.**
The approved art is the exact look the user signed off on — composite the rest as crisp vector on top:
```css
.reactor-wrap{position:relative;}
.reactor-media{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;
  filter:drop-shadow(0 0 40px var(--glow));mix-blend-mode:screen;} /* approved still OR <video> */
#arc-reactor{position:absolute;inset:0;} /* keep three.js OR repurpose for live rings only */
.reactor-rings{position:absolute;inset:0;pointer-events:none;} /* SVG: segment-block + tick rings */
```
- Drop `reactor_APPROVED.png` as `<img class="reactor-media">` (or `<video reactor_video.mp4>` when Stage 4
  lands — see §10). Put the **animated SVG rings** over it:
  - **Segment-block ring:** `<circle>` with `stroke-dasharray:[seg,gap]` + `filter:drop-shadow()` glow,
    slow `rotate` **[BN#17]**.
  - **Tick rings:** `<line>` repeated at `i*360/N`, two layers counter-rotating **[BN#16]**.
- This keeps the centerpiece *exactly* the approved art while the live `#coreval` readout still binds.

### PRESERVE
- `#arc-reactor` canvas id, `#coreval` readout, `.reactor-readout`, and the `reactorPower`/integrity binding
  in `render()` (line ~1159: `reactorPower = clamp(integrity/100, …)` and `$("#coreval").textContent`).
- The WebGL→2D `fallbackReactor()` path and the `degrade()` FPS guard — if you add a video/SVG base, the
  fallback can simply hide the WebGL layer and keep the SVG rings.
- `prefers-reduced-motion`: rings stop spinning, video gets `paused`/poster, hot-core stops pulsing.

---

## 2. LAYOUT — header, clock, rails, footer

### 2a. Big center clock + `SYSTEM·JARVIS_3.0` header
**Current:** `header` is a single flex row; `.mark` (`J·A·R·V·I·S` + `COMMAND CENTRE v2.0`) is left, clock is a
13px right-aligned readout (`.clock` ~90px wide).
**Target:** top band has a **bracketed `SYSTEM · JARVIS_3.0`** label pinned top-left and a **large centered
digital clock** (`23:15:51 PM` style, the visual anchor of the top edge), with `MONITOR/CONTROL`, `⌘K`, conn
dot, and date pushed to the corners.

```css
header{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;}
.mark{justify-self:start;border:1px solid var(--line-strong);padding:4px 12px;border-radius:2px;
  font-size:13px;letter-spacing:.34em;} /* bracket label */
.mark b::before{content:"SYSTEM · ";color:var(--txt-dim);}  /* visual prefix only — keep #clock/#health ids */
.clock{justify-self:center;text-align:center;}
.clock #clock{font-family:var(--font-display);font-size:34px;letter-spacing:.18em;color:var(--cyan);
  text-shadow:0 0 22px var(--glow);}
.clock #datef{letter-spacing:.4em;}
header .modesw,header .conn,header .kbd,#health{justify-self:end;}
```
- Change the `.mark` markup text to `SYSTEM · JARVIS_3.0` (keep the element + `<b>` so any selectors hold);
  demote `COMMAND CENTRE v2.0` to tiny sub or remove.
- Reference clock shows `HH:MM:SS PM`; the JS at line ~644 builds 24h `HH:MM:SS`. If you want the AM/PM look,
  adjust the **string only** in that `setInterval` (do not touch the interval/structure).
- **PRESERVE:** `#clock`, `#datef`, `#health`, `.modesw [data-mode]`, `#open-palette`, `#conn`/`#connlbl`.

### 2b. Three-column proportions
**Current:** `main{grid-template-columns:288px 1fr 312px}`. **Target:** keep three columns but the reference
left/right rails are denser and the center reactor dominates. Widen rails slightly and let the reactor breathe:
```css
main{grid-template-columns:320px 1fr 360px;gap:14px;}
```
Keep `#monitor-aside` / `#control-col` swap (CONTROL mode) exactly as is.

### 2c. KPI strip → keep, restyle
The 6-card KPI strip has no direct reference analog but is good telemetry. Keep it; just reskin to match the
new palette (thinner borders, brighter sparkline strokes, corner ticks). Do **not** remove cards (bindings
`data-kpi/data-val/data-delta/data-spark` feed `setKpi`/`drawSparkline`).

### 2d. Footer
Keep `STARK INDUSTRIES · LOCAL NODE`, `#fps`, `#recent-feed`, transparent toggle, palette link. Reskin to a
thin bracketed strip with a left/right corner rule (reference has a faint baseline bar).

---

## 3. LEFT RAIL — STATUS + orbital radar + PLANET rows + LISTENING wave

The reference left rail (`ref_full_layout.jpg`) reads top→bottom: a `STATUS:` header block, a **small orbital
radar dial**, a strip of small numbers, then **eight `PLANET_01 … PLANET_08` rows** (each a label + a row of
data ticks), and a `– LISTENING –` waveform at the bottom.

Map this onto existing panels (reskin, don't rebuild):
- **`STATUS:` block** → reuse the **Core Vitals** panel header; rename `<h2>` text to `STATUS`. The three
  radial gauges (`#gauge-cpu/ram/disk`) stay — they read as dials, on-brand.
- **Orbital radar dial** → add a *small* new canvas (or SVG) above/inside the STATUS panel. Implement per
  **[BN#19]**: `sweepAngle += dt*speed`; filled arc with radial-gradient trail using
  `globalCompositeOperation:'lighter'`; a few blips with glow. Drive purely off the clock — decorative, no API.
- **`PLANET_01..08` rows** → reskin the **Connected Machines** list rows (`#machines`, rendered in `render()`
  ~line 1186). The renderer emits `.row` items; restyle `.row` to the planet treatment (mono label left,
  data-tick blocks right). If fewer than 8 machines, the existing `no machines` muted state is fine — OR add a
  static decorative `PLANET_0n` scaffold *behind* the live rows (visual only). **Do not change the
  `#machines` innerHTML contract.**
  ```css
  .row .name{font-family:var(--font-mono);letter-spacing:.18em;}
  .row::after{content:"";flex:0 0 70px;height:7px;
    background:repeating-linear-gradient(90deg,var(--cyan) 0 3px,transparent 3px 7px);opacity:.5;}
  ```
- **`– LISTENING –` waveform** → the Voice panel already owns the `– LISTENING –` word (`setVoiceState`
  ~line 1425). Pin the Voice panel to the **bottom of the left rail** and add a live **waveform canvas** under
  the mic. Per **[BN#21]**, use Web Audio `AnalyserNode.getByteTimeDomainData` → canvas polyline when the mic
  stream is live; when idle, render a flat/low decorative sine so the band is always present like the
  reference. Bind the analyser only inside the existing `startListening()` mic path; **never block** the
  text-input fallback.

**PRESERVE:** `#gauge-cpu/ram/disk`, `.gauge-cv` canvases, `#machines` + its `markFresh("machines")`,
`.voice` panel + `#voice-word/#voice-reply/#voice-input/#mic-btn/#voice-form` and the whole voice loop.

---

## 4. RIGHT RAIL — graphs + level-meter sliders + numeric readouts + circuit-bus + launchers

The reference right side (`ref_reactor_closeup.jpg`, `dashboard_gen_a.png`) stacks: a graph panel, a panel of
**vertical level-meter sliders** + big numeric readouts (`73.812`, `73.927`), a **circuit-bus** of flowing
lines into a row of LED blocks, then a column of **launcher buttons** (Notepad / Todo List / My Files / Youtube).

Map onto existing panels:
- **Graphs** → the center already has `#graph` (CPU telemetry). Add the reference's *secondary* graph look to
  the **Neural Core** panel by giving it a small sparkline strip header (decorative) OR keep Neural Core as-is
  and lean on the existing `#graph`. Keep `drawGraph()` untouched.
- **Vertical level-meter sliders** → these are the reference's signature right-panel detail. Add a small
  **decorative VU/level-meter** block (3–4 vertical bars) inside the Neural Core or Docker Bay panel header.
  Animate off CPU/RAM/disk targets already in `gaugeTarget` (read-only) so they move with real telemetry but
  add no new API. Pure CSS bars:
  ```css
  .levels{display:flex;gap:6px;align-items:flex-end;height:54px}
  .levels i{width:8px;background:linear-gradient(0deg,var(--cyan),var(--electric));
    box-shadow:0 0 10px var(--glow);transition:height .3s}
  ```
- **Big numeric readouts** → add two large mono numbers (style only). Bind to existing values for life, e.g.
  reuse `audit.total_actions` and integrity — read from the same objects `render()` already has. Strictly
  additive spans; if you'd rather keep it zero-risk, make them decorative.
- **Circuit-bus** → add an **SVG circuit-board** strip near the bottom of the right rail per **[BN#20]**:
  polylines + animated `stroke-dashoffset` "signal" + `<animateMotion>` dots flowing into a row of small LED
  `<rect>`s. Decorative, compositor-thread, no API.
- **Launcher buttons** (Notepad / Todo List / My Files / Youtube) → the reference's right-edge launcher column.
  These have **no backend** — add them as a small list of styled buttons that open local apps/URLs *only if a
  safe handler exists*; otherwise wire them to the existing `⌘K` palette actions or make them visual. **Do not
  invent destructive backend calls.** Reskin from the `button.cmd` style so they match.

**PRESERVE:** `#graph` + `drawGraph()`, Neural Core ids (`#brain-state/#brain-model/#audit-total/#audit-freed`),
Docker Bay (`#docker` + its `markFresh`), the entire **CONTROL-mode cockpit** (`#control-col`, rack, rockers,
throttle, rotary, annunciator, engage lever, console) and its `data-action` wiring.

---

## 5. PALETTE — electric teal/cyan on near-black

### Current `:root`
```
--cyan:#8BD3FB; --amber:#FBCA03; --red:#AA0505; --ink:#080D14; --green:#46f0a0;
--txt:#CFE9F7; --txt-dim:#7FA8BD;
```

### Target (retune in place — keep variable NAMES so all references resolve)
```css
:root{
  --cyan:#3ff0e0;          /* primary teal (was #8BD3FB) */
  --electric:#28e0ff;      /* NEW: electric blue accent for cores/levels/circuit */
  --amber:#FBCA03;         /* keep gold for boot arc + active/degraded */
  --red:#AA0505;           /* keep critical */
  --ink:#03090c;           /* deeper near-black base (was #080D14) */
  --green:#46f0a0;
  --txt:#d6fbff;           /* brighter primary readout, still ≥4.5:1 on --ink */
  --txt-dim:#6fb9c4;
  --glow:rgba(63,240,224,.55);   /* NEW: shared glow color for drop-shadows */
  --glass:rgba(6,16,20,.46);
  --line:rgba(63,240,224,.20); --line-strong:rgba(63,240,224,.55);
  /* fonts unchanged — see §6 */
}
```
- **Ambient wash** (`#void`): swap the radial gradients to the reference's **green→blue** sweep
  (green pooling lower-left, blue lower-right, faint teal top), brighter than today:
  ```css
  #void{background:
    radial-gradient(120% 90% at 50% -10%, rgba(63,240,224,.12), transparent 55%),
    radial-gradient(90% 90% at 10% 115%, rgba(70,240,160,.10), transparent 60%),   /* green */
    radial-gradient(90% 90% at 92% 115%, rgba(40,120,255,.12), transparent 60%),   /* blue */
    var(--ink);}
  ```
- Sweep hard-coded `#8BD3FB` literals in the **JS canvas** code (gauges, graph, sparklines, fallback reactor —
  e.g. `GAUGE_COLORS`, `SPARK_COLOR`, `drawGraph` strokes, `0x8BD3FB` in three.js) to the new teal/electric.
  Search the file for `8BD3FB` / `0x8BD3FB` and update each to `#3ff0e0` / `0x3ff0e0` (and use `--electric`
  for cores). Keep `#FBCA03` gold where it is.
- **Contrast guard:** verify `--txt` on `--ink` stays ≥4.5:1 (it does at `#d6fbff` on `#03090c`). Don't drop
  text below that.

---

## 6. FONTS

Keep the loaded stack (`Eurostile Extended → Eurostile → Orbitron` display, `Rajdhani` body,
`OCR-A → Space Mono → Share Tech Mono` mono) — it already matches the machine-readout reference feel.
Changes:
- **Clock & big numerics** → display font, large, wide tracking (see §2a, §4).
- **`PLANET_0n`, level labels, readouts** → mono (`--font-mono`), `letter-spacing:.18em`, uppercase.
- Confirm the Google Fonts `<link>` and `importmap` stay intact (they gate the whole render stack).

---

## 7. ATMOSPHERE — grid, scanlines, glow, corner brackets

- **Grid (`#grid`)**: tighten from `46px` to ~`38px` cells, raise opacity slightly; keep the radial mask + drift.
- **Scanlines (`#scan`)**: the reference is more visibly "CRT". Bump density/contrast a touch (e.g. darker line
  every 3px, opacity ~.5 → ~.6). Keep `mix-blend-mode:overlay`.
- **Vignette (`#vignette`)**: keep; maybe deepen for more theatrical falloff.
- **Corner brackets**: panels already get `::before/::after` L-brackets — brighten to `--cyan` and add the
  *other two* corners (top-right + bottom-left) for the full reference frame look:
  ```css
  .panel::before,.panel::after{border-color:var(--cyan);opacity:.85;width:14px;height:14px;}
  /* add two more brackets via a wrapper pseudo or box-shadow corner ticks */
  ```
- **Bloom/glow**: brighter on reactor + level meters + circuit-bus + clock. Use `filter:drop-shadow()` on
  SVG/CSS (compositor) per **[BN#2]**; reserve heavy `shadowBlur`/three.js bloom for the centerpiece only
  **[BN#1, BN#3]**.

---

## 8. BOOT SEQUENCE

### Current `#boot`
Centered `JARVIS` display word + a thin `.bar i` width-load progress bar + scrolling `#bootlines`
(`› initialising stark protocol`, etc.), fades out after ~1.9s.

### Target (`ref_boot.jpg`)
Centered **reactor wireframe** ramping up + a **gold sweep progress arc** + `J.A.R.V.I.S` (dotted) and
`IN PROGRESS` text, with a scramble/typewriter feel.

### How
- Replace the flat `.bar` with an **SVG gold boot arc** per **[BN#18]**:
  `stroke:#C9A227 + filter:drop-shadow(#FFD700)`, animate `stroke-dashoffset` full→0, `transform:rotate(-90deg)`
  so it starts at top; drive duration to ~`load` timing.
  ```css
  #boot .arc circle{stroke:var(--amber);fill:none;stroke-width:4;
    filter:drop-shadow(0 0 8px #FFD700);transform:rotate(-90deg);transform-origin:center;
    stroke-dasharray:var(--circ);stroke-dashoffset:var(--circ);animation:bootarc 1.8s forwards;}
  @keyframes bootarc{to{stroke-dashoffset:0}}
  ```
- Show a faint reactor wireframe behind it (a couple of dashed SVG rings, or render the real reactor early).
- Keep `#bootlines` but restyle to mono and add a `J.A.R.V.I.S` / `IN PROGRESS` heading; an optional
  text-scramble effect (Arwes-style) per **[BN#4]** is a nice-to-have, not required.
- **PRESERVE:** the `#boot` id, the `.gone` fade-out, the `bootMsgs` loop, the `REDUCED ? 400 : 1900` timing,
  and the GSAP `.gsap` staggered reveal that follows. Do not change *when* boot ends (tests/loops may depend
  on the panels appearing).

---

## 9. PRESERVE LIST — do NOT regress (hard constraints)

**Functional foundation that MUST keep working byte-for-byte in behavior:**
- **Voice loop:** `.voice` panel, `setVoiceState()`, `submitVoice()`, `startListening()`, `speak()`, the
  `– LISTENING –` / `PROCESSING…` / `TAP TO SPEAK` states, `#mic-btn`, `#voice-form`, `#voice-input`,
  `#voice-word`, `#voice-reply`, `#voice-transcript`, `#voice-badge`, and the `POST /api/voice` call +
  `requires_guard → setMode('control') + flash` behavior.
- **Cockpit / CONTROL mode:** `#control-col`, `#monitor-aside` swap on `body.mode-control`, the guarded
  toggle, rockers, throttle, rotary, annunciator lamps, ENGAGE lever, `#console`, and **all `data-action`
  values** (`tidy_*`, `docker_prune_*`, `deep_clean_*`, `set_*`, `engage`, `refresh`). The `[data-guarded]`
  cover-gesture flow and `GUARDED` set must be intact.
- **API wiring:** `poll()` → `GET /api/stats` every 2s, `sendCommand()`/`runAction()` → `POST /api/command`,
  `submitVoice()` → `POST /api/voice`. Do not rename endpoints, payload keys, or the `render(stats)` contract.
- **Real-time bindings:** every `data-val`, `data-delta`, `data-spark`, `data-shape`, `data-kpi`, `data-fresh`,
  `data-lamp`, `data-action`, `data-mode` attribute, and ids `#coreval`, `#clock`, `#datef`, `#brain-state`,
  `#brain-model`, `#audit-total`, `#audit-freed`, `#machines`, `#docker`, `#recent-feed`, `#conn`, `#connlbl`,
  `#fps`, the gauge/graph/sparkline canvas ids.
- **Resilience paths:** `fallbackReactor()` (no-WebGL), `degrade()` (FPS guard, `MIN_FPS=48`), the GSAP-absent
  CSS reveal, and the `prefers-reduced-motion` block (must still kill ambient + boot + new reactor spin).
- **`⌘K` palette:** `PALETTE_CMDS`, open/close, arrow-key nav, all `run` handlers.
- **Transparent mode:** `body.transparent #void{opacity:0}` and `#toggle-void` (the floating `.app` depends on
  the transparent background — keep `background:transparent` on `body` and the WebGL `alpha:true` clear).
- **200 tests pass.** After the restyle, run the suite and confirm still-green:
  `cd /Users/vic/.jarvis && python3 -m pytest -q` (use the project's actual test command). The tests likely
  assert on served HTML / element ids — **renaming or removing any of the ids/attributes above will break them.**

**Regression warnings:**
- Don't drop `background:transparent` on `body` or the `renderer.setClearColor(0x000000,0)` — the transparent
  `.app` window goes opaque/black otherwise.
- Don't move heavy `shadowBlur`/bloom into the per-frame Canvas2D paths (gauges/graph/sparklines) — it tanks
  the 60fps budget. Use SVG/CSS `drop-shadow` for new glow **[BN#2, BN#3]**.
- If you add a `<video>` or large images, lazy/decode them and respect `degrade()` + reduced-motion (pause).
- Keep additive DOM **additive**: prefer new wrapper elements / pseudo-elements over re-keying existing nodes,
  so no binding `querySelector` goes null.

---

## 10. OPTIONAL — reactor VIDEO centerpiece (Stage 4, `reactor_video.mp4` may not exist yet)

When `/Users/vic/.jarvis/design_refs/reactor_video.mp4` lands, optionally composite it as the centerpiece base
**in place of / behind** the three.js render:
```html
<div class="reactor-wrap">
  <video id="reactor-video" autoplay muted loop playsinline
         poster="/design_refs/reactor_APPROVED.png"></video>  <!-- src set only if file exists -->
  <canvas id="arc-reactor"></canvas>     <!-- keep: live rings / fallback -->
  <svg class="reactor-rings">…segment-block + tick rings…</svg>
  <div class="reactor-readout">CORE OUTPUT <b id="coreval">--%</b> · STABLE</div>
</div>
```
```css
#reactor-video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;
  mix-blend-mode:screen;filter:drop-shadow(0 0 50px var(--glow));}
```
- Serve the file through the existing static route (it's under `design_refs/`; confirm `dashboard.py` exposes
  it or copy it next to `index.html`/into the web root — **do not change the API routes**).
- Feature-detect: if the video 404s or fails to load, fall back to the `poster` (approved still) and the
  three.js/2D reactor — never leave the centerpiece blank.
- **Pulse the live core:** keep `#coreval`/`reactorPower` driving an overlaid glow opacity so the video-base
  reactor still reacts to integrity. Pause the video under `prefers-reduced-motion`.

---

## 11. SELF-CHECK BEFORE HANDOFF
1. Serve and load http://127.0.0.1:7360/ ; freeze with `window.requestAnimationFrame=()=>0` then screenshot;
   compare side-by-side against `ref_full_layout.jpg` + `reactor_APPROVED.png`.
2. Toggle CONTROL mode, open `⌘K`, tap the mic / type a command → confirm the voice loop + cockpit still work.
3. Confirm transparent mode still goes fully clear.
4. Throttle CPU / open many panels → confirm FPS guard + `degrade()` still hold ≥48fps.
5. Run the test suite → **200 still green.**
6. Verify reduced-motion (`prefers-reduced-motion`) stops the reactor spin, boot arc, and any video.
