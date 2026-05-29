# JARVIS — Task Board

Tracks work against [PRD.md](PRD.md). Checked = done & verified (tests green +
behavior confirmed). Commit refs in `()`.

- **HEAD:** `d2987cd` · **Tests:** 103 passing · **Daemon:** launchd `com.jarvis.daemon` (running)
- **Updated:** 2026-05-30

---

## ✅ Done

### Core hardening (bug fixes, code review)
- [x] Fix broken macOS notifications — `sound name` clause on its own line was an AppleScript syntax error (`de34323`/baseline)
- [x] Fix disk `used_pct` on APFS — use df Capacity column, not `used/total` (`machine.py`)
- [x] Fix SQLite connection leak — all helpers close via `contextlib.closing` (`database.py`)
- [x] Fix `tidy` reporting/audit — report bytes actually freed; log manual tidy (`cli.py`)
- [x] Fix dead code, lint, unused imports across `lib/` (`de34323`, `e0e4ed6`)
- [x] Fix SSH `exec_command` deadlock — drain stdout/stderr before `recv_exit_status` (`49a93d5`)
- [x] Fix docker prune count, honest pip "updated" count, `llm_brain` non-numeric guard (`e0e4ed6`)
- [x] Fix test suite polluting production `jarvis.log` — `log_dir` param + `conftest.py` root-logger isolation (`e8c23ed`)
- [x] Harden `exec_with_retry` (None client / `retries=0`)

### Operability
- [x] Install + load launchd service; RunAtLoad + KeepAlive; respawn verified
- [x] Route all module logs to `jarvis.log`; verify tidy/health/deep-clean job lifecycle

### Autopilot + safety
- [x] Idle-aware self-healing autopilot (`lib/autopilot.py`) + scheduler wiring (`b0a577f`)
- [x] Guard live tooling in `SKIP_PATTERNS` — `.claude`, `mcp-servers`, editor/agent caches, `claude/` (`1fb284b`)
- [x] Fix missing-comma bug in `SKIP_PATTERNS` that had silently dropped `.ssh` protection
- [x] Verify blast radius 17.4GB→2.8GB, 0 protected dirs at risk; `.env` sha unchanged

### Dashboard (v1 — backend + HUD)
- [x] Telemetry API `/api/stats` (fault-isolated per sensor) + `/api/command` allow-list (`d2987cd`)
- [x] three.js HUD with Iron-Man palette, glass panels, transparency-ready CSS

---

## 🔭 Next — Dashboard → Floating-Window App (active)

> Drive with: `ralphy "$(cat ~/Downloads/jarvis_dashboard_prompt.txt)"`

### P0 — make it a real app (PRD R12, SC5/SC8)
- [x] Add Electron shell (`lib/dashboard_app/`) loading the existing HUD + backend (keeps Python `/api/stats`,`/api/command`)
- [x] Transparent/frameless/always-on-top window: `transparent`, `frame:false`, `backgroundColor:'#00000000'`, `hasShadow:false`, `setAlwaysOnTop('screen-saver')`, `type:'panel'`, `setVisibleOnAllWorkspaces({visibleOnFullScreen:true})` (`main.js`)
- [x] macOS vibrancy `under-window` + `visualEffectState:'active'`; `backgroundThrottling:false`
- [x] Click-through `setIgnoreMouseEvents(true,{forward:true})` — only `[data-interactive]` regions capture mouse (`preload.js`)
- [x] three.js `alpha:true` + `setClearColor(0x000000,0)`; `body.transparent` auto-enabled in-app
- [x] `jarvis dashboard` launches the window (no browser; `--browser` is the web fallback); `npm run dist` packages the `.app`
  - ⏳ Live GUI confirmation pending a desktop session (headless dev box); notarization = SC8 (needs Apple Developer ID)

### P1 — Marvel FUI visuals (PRD R13, SC6)
- [ ] Selective UnrealBloom on glowing lines
- [ ] Holographic Fresnel + scanline material (arc reactor + panels)
- [ ] GPGPU particle "data dust" round the reactor; chromatic aberration on edges
- [ ] Eurostile-Extended (or fallback) + OCR-A/Space-Mono, all-caps; 3 color tiers on `#080D14`
- [ ] GSAP staggered boot (1.2–2.5s), idle breathing, Z-space mouse parallax
- [ ] Hold 60fps with transparency + bloom + live data

### P2 — Command-center UX (PRD R14)
- [ ] Top-left health word NOMINAL/DEGRADED/CRITICAL (5-second test)
- [ ] Per-panel freshness Live/Stale/Offline (no spinners; cached + stale dot)
- [ ] Monitoring view vs control view (mode-switch + ⌘K palette)
- [ ] tabular-nums; value + delta + 60s sparkline; count-up transitions
- [ ] Redundant status encoding (color + shape); ≥4.5:1 on blurred composite; ≤6 cards above fold
- [ ] Motion tiers 100-150/200-300/300-500ms; `prefers-reduced-motion`

### P3 — Cockpit control panel (PRD R15, SC7)
- [ ] Guarded toggle (flip cover) → Autopilot ARM/DISARM
- [ ] Throttle lever (detents) → `safety.bloat_min_age_days`
- [ ] Rotary knob → `safety.idle_cpu_threshold`
- [ ] Illuminated pushbuttons → tidy / docker-prune / deep-clean / refresh
- [ ] Rocker switches → `safety.dry_run`, notify
- [ ] Annunciator lamps → Mac/VPS health (green/amber/red; blink only on CRITICAL)
- [ ] Master ENGAGE lever → boot/wake HUD
- [ ] Switch/cover/lever/knob/button/needle animations (GSAP + spring); Web-Audio click/bleep
- [ ] Guarded switches / lever-throws = confirm gesture for destructive actions (consequence shown on annunciator)

---

## 🧊 Backlog / Known issues

- [ ] **Cleanup scan perf:** `find_cleanup_targets`/`find_bloat` walk all of `$HOME` each run (every 15/30m). Bound with early-exit/`islice` or incremental indexing; log what's skipped.
- [ ] **Config hot-reload:** `get_config_safe()` returns the cached singleton; changes need a daemon restart. Add a reload trigger (or watch `config.yaml`).
- [ ] **VPS state hostname** now correct; consider richer per-VPS metrics (RAM/CPU over SSH).
- [ ] **OS update awareness:** detect (don't auto-apply) pending macOS/VPS OS updates and surface in HUD.
- [ ] **Eurostile licensing:** confirm license or finalize Orbitron/Rajdhani fallback.
- [ ] **Notarization:** requires Apple Developer ID; document local-unsigned path otherwise.
- [ ] **Dashboard auth:** loopback-only today; add a token if ever exposed beyond localhost (should not be).

---

## 🛡️ Invariants (never regress)
- `.env` / credentials never modified, moved, or committed.
- `SKIP_PATTERNS` always protects `.ssh` + live tooling; keep the list comma-correct (no empty `""`, no bare `.`).
- Destructive actions stay confirm/idle/dormancy-gated; loopback-only command API.
- Full test suite green before any commit; daemon restarted + verified after code changes.
