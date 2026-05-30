# JARVIS — Task Board

Tracks [PRD.md](PRD.md). **Active objective: JARVIS_3.0 Desktop HUD** — visual + motion
match to `~/Downloads/JARVIS_EXPECTATIONS_4K.mov` and `design_refs/`. No shortcuts.

- **Updated:** 2026-05-30 · Core agent + daemon + autopilot: delivered (see PRD §1).

---

## 🎯 JARVIS_3.0 build (for ralphy) — match `design_refs/` exactly

Build the live HUD at `lib/dashboard_web/index.html`, served by `lib/dashboard.py`
(`/api/stats`,`/api/command`). Reuse the backend; do NOT regress real-time monitoring.
Read every image in `design_refs/` and compare your output side-by-side; iterate until it matches.

### Reactor centerpiece — match `design_refs/ref_reactor_closeup.jpg` + `reactor_APPROVED.png`
- [ ] Mechanical hub center (concentric rings + iris segments + tiny hot core) — NOT a white blob
- [ ] Segment-block ring (bold rounded-rect dashes)
- [ ] Dense fine radial turbine burst + bright inner rim
- [ ] Multiple concentric tick-mark rings, counter-rotating
- [ ] Boot sequence: assembling rings + gold progress arc + "J.A.R.V.I.S." + "IN PROGRESS"
- [ ] Core/turbine intensity driven by live CPU load
- [ ] (If higher fidelity) composite `design_refs/reactor_gen_*.png` or the Stage-4 reactor video as the core

### Layout & panels — match `design_refs/ref_full_layout.jpg`
- [ ] Header: SYSTEM · JARVIS_3.0 + big center clock + link/node status
- [ ] Left: live STATUS bars (CPU/MEM/DISK), badge readout, orbital radar sweep, PLANET_01..08 animated rows, "– LISTENING –" waveform
- [ ] Center: reactor + command menu (Open Finder/Documents/Downloads/Pictures/APPS)
- [ ] Right: realtime CPU/RAM graphs, vertical level-meter sliders, big numeric readouts, circuit-bus flow diagram, app launchers (Notepad/Todo List/My Files/Youtube)
- [ ] Footer: STARK INDUSTRIES · node · machine tags · FPS

### Real-time monitoring (must be real)
- [ ] Poll `/api/stats` ≤2s → bars, graphs, badges, PLANET rows, reactor intensity
- [ ] Freshness state ACTIVE/STALE/OFFLINE

### Scope this pass (visual match first)
- [ ] Launchers + voice "LISTENING" + command menu = animated UI shells (NOT wired yet)
- [ ] Hold ~60fps; transparent always-on-top `.app`; `jarvis dashboard` launches it (no browser)

### Visual standard
- [ ] Palette cyan #3ff0e0 / electric #28e0ff / hot #eafdff on #03090c; Orbitron + Share Tech Mono + Rajdhani
- [ ] Glow/bloom, scanlines, grid, corner brackets; match frames — no AI-slop, no generic look

**Acceptance:** side-by-side vs `design_refs/` passes (PRD §4 SC-H1..H6).

---

## 🏗️ Design pipeline (owner: orchestrator, feeds ralphy)
- [~] Stage 1 — AI-generate reactor core (OpenRouter i2i; variants in `design_refs/reactor_gen_*.png`)
- [ ] Stage 2 — AI-generate full dashboard design (i2i from clean 4K frames)
- [ ] Stage 3 — Finalize reactor + dashboard design assets (locked targets)
- [ ] Stage 4 — Generate animated videos (MiniMax i2v) → `design_refs/`
- [ ] Stage 5 — ralphy builds HUD to match + validate (this board)

APIs available (use wisely): OpenRouter (Gemini 3 Pro / GPT-5 image), MiniMax (i2v), Gemini, OpenAI.
Build in worktree `wip/jarvis3-hud`. Backend `/api/stats` shape: `system.{cpu_load_pct,ram.used_pct,disk.used_pct}`, `docker.running_count`, `machines[]`, `audit.actions_24h`.

---

## 🛡️ Invariants (never regress)
- Never modify `.env`/credentials. `SKIP_PATTERNS` protects `.ssh`/`.claude`/`mcp-servers`/editor caches.
- Destructive actions stay idle/dormancy/confirm-gated; dashboard loopback-only.
- Full test suite green before commit; daemon restarted + verified after code changes.
