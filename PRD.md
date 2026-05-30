# JARVIS — Product Requirements Document

> Autonomous, self-correcting machine-optimization agent for macOS + VPS.
> "JARVIS from Iron Man" — takes initiative, fixes what it finds, keeps every
> machine 100% optimal. Idle time = sleep.

- **Owner:** vic
- **Status:** Active — core agent operational; dashboard evolving to a floating-window app
- **Last updated:** 2026-05-30
- **Repo:** `~/.jarvis/` (git-tracked; `.env` and runtime artifacts gitignored)
- **Current HEAD:** `d2987cd`

---

## 1. Vision

A single always-on agent that keeps the Mac and all VPS machines continuously
optimal — reclaiming wasted space/RAM, updating software, monitoring health, and
self-correcting — without the user having to ask, check, or approve routine work.
The agent is observable and controllable through a cinematic, Iron-Man-grade
floating HUD. It is aggressive about optimization but never destroys data,
credentials, or actively-used tooling.

**Principles**
1. **Initiative over prompting** — detect and fix; create tasks/config as needed instead of stalling on a question.
2. **Idle time = sleep** — disruptive work runs only when the machine is idle.
3. **Safe by construction** — credentials and live tooling are never touched; destructive actions are gated.
4. **Observable** — every action is audit-logged and visible in the HUD.
5. **Degrade gracefully** — one failing sensor/host never takes down the agent.

---

## 2. Current State (delivered)

| Capability | Module | Notes |
|---|---|---|
| Background daemon | `lib/daemon.py` | launchd `com.jarvis.daemon`, RunAtLoad + KeepAlive; logs all modules to `logs/jarvis.log` |
| Scheduler | `lib/scheduler.py` | APScheduler jobs: tidy (15m), autopilot (30m), health (60m), deep_clean (00:00), db_cleanup (30d) |
| Idle-aware autopilot | `lib/autopilot.py` | Reclaims dormant regenerable bloat; double-gated (idle ≥80% CPU + dormant ≥7d); capped 50/run |
| Cleanup engine | `lib/cleanup.py` | Pattern scan + dry-run-safe delete; `SKIP_PATTERNS` protects credentials & live tooling |
| Telemetry / system | `lib/machine.py` | Disk (APFS-correct via df Capacity), RAM, CPU idle |
| VPS access | `lib/ssh_manager.py` | paramiko; retry w/ backoff; drains streams before exit status (no deadlock) |
| Docker ops | `lib/docker_ops.py` | container/image prune with real removed-count parsing |
| Package updates | `lib/package_managers.py` | Homebrew/pip/npm (Mac); apt over SSH (VPS) |
| Memory / audit DB | `lib/database.py` | SQLite; connections always closed; audit_log, machine_state, task_history |
| LLM brain (optional) | `lib/llm_brain.py` | MiniMax; graceful heuristic fallback |
| Notifications | `lib/notifier.py` | macOS `osascript` (fixed sound-clause syntax) |
| CLI | `lib/cli.py` | `status`, `stats`, `log`, `tidy`, `ask`, `dashboard` |
| Dashboard backend | `lib/dashboard.py` | Loopback HTTP `/api/stats` + `/api/command` allow-list (stdlib only) |
| HUD (transparency-ready) | `lib/dashboard_web/index.html` | three.js arc reactor, Iron-Man palette, glass panels |
| Test suite | `tests/` | 88 tests passing |

**Machines:** `mac` (local), `vps_main` (187.77.12.13, enabled), `vps_hostinger` (disabled).

---

## 3. Requirements

### 3.1 Core agent & daemon
- R1. Runs persistently as a launchd service; auto-starts at login; auto-restarts if killed.
- R2. All module activity (scheduler/cleanup/ssh) is captured in `logs/jarvis.log`.
- R3. Survives transient failures of any single sensor, host, or job without crashing.

### 3.2 Cleanup & autopilot
- R4. Continuously reclaim regenerable space-eaters (caches, `__pycache__`, logs, `node_modules`, `dist`/`build`/`target`, framework caches) from Mac and VPS.
- R5. **Idle-gated:** reclamation runs only when the machine is idle (CPU idle ≥ `safety.idle_cpu_threshold`).
- R6. **Dormancy-gated:** only directories untouched ≥ `safety.bloat_min_age_days` are reclaimed.
- R7. Everything reclaimed must be regenerable (reinstall/rebuild/refetch).

### 3.3 Monitoring & health
- R8. Track disk %, RAM %, CPU, Docker, and VPS reachability for every machine.
- R9. Alert on critical thresholds (low disk, high RAM, host unreachable).
- R10. Persist machine state + an audit trail of every action.

### 3.4 Software currency
- R11. Keep apps/packages current automatically — Homebrew/pip/npm on Mac, apt on VPS — without the user checking. (OS-level updates: see Out of Scope.)

### 3.5 Dashboard & Command Centre  *(active work)*
- R12. **Floating-window desktop app, NOT a web page.** Transparent, frameless, always-on-top Electron `.app` that floats over the desktop like the Iron-Man HUD; reuses the existing Python telemetry/command backend.
- R13. **Marvel/Iron-Man FUI bar:** 3 semantic color tiers (cyan `#8BD3FB` ambient / amber `#FBCA03` active / red `#AA0505` critical) on `#080D14`; Eurostile-Extended + OCR-A/Space-Mono; selective bloom, holographic Fresnel+scanline material, GPGPU "data dust", chromatic aberration; GSAP staggered boot, idle breathing, Z-space parallax.
- R14. **Command-center UX:** 5-second health word (NOMINAL/DEGRADED/CRITICAL); per-panel freshness (Live/Stale/Offline, no spinners); monitoring view separated from controls via mode-switch + ⌘K palette; tabular-nums; value+delta+sparkline; ≤6 cards above the fold; redundant (color+shape) status; ≥4.5:1 contrast on the blurred composite; `prefers-reduced-motion`.
- R15. **Cockpit control panel:** skeuomorphic, fully-animated controls wired to `/api/command` + `/api/stats` — guarded toggle (autopilot ARM/DISARM), throttle lever (dormancy days), rotary knob (idle threshold), illuminated pushbuttons (tidy/prune/deep-clean/refresh), rocker switches (dry-run/notify), annunciator lamps (Mac/VPS health), master ENGAGE lever. Guarded switches / lever-throws ARE the confirm gesture for destructive actions.

### 3.6 Safety & guardrails *(non-negotiable)*
- R16. **Never** delete, move, overwrite, or expose credentials/secrets. `~/.jarvis/.env` and any key/token are untouchable.
- R17. `SKIP_PATTERNS` protects live tooling: `.jarvis`, `.claude`, `mcp-servers`, `.cursor`, `.hermes`, `.codex`, `.gemini`, `.minimax*`, `.antigravity`, `.sub-agents`, `claude/`, `.ssh`, `.config`, `.local`, `.kube`, `.docker`, `Library/…`.
- R18. `safety.dry_run` previews without deleting; destructive actions are confirm-gated.
- R19. The dashboard backend binds loopback-only and exposes a fixed action allow-list (never arbitrary commands).

### 3.7 Notifications
- R20. Surface significant events (large reclamations, alerts, update summaries) via macOS notifications, throttled by `min_significance_mb`.

### 3.8 Non-functional
- R21. **Reliability:** no resource leaks; bounded retries; deterministic heuristics (LLM optional).
- R22. **Performance:** scheduled scans must not degrade an active machine; HUD holds 60fps with transparency + bloom + live data.
- R23. **Dependencies:** backend stays stdlib-only where practical; HUD app deps are isolated to the Electron shell.
- R24. **Observability:** every action audit-logged; daemon state inspectable via `launchctl` and the CLI.

---

## 4. Success Criteria (binary)

- [x] SC1. Daemon runs as launchd service, auto-restarts, logs job lifecycle — **met** (pid live, KeepAlive verified).
- [x] SC2. Autopilot reclaims dormant bloat only when idle, never touches protected tooling — **met** (guard verified: 17.4GB→2.8GB, 0 protected dirs).
- [x] SC3. `.env`/credentials never modified by any operation — **met** (sha unchanged across all runs).
- [x] SC4. Full test suite green — **met** (88 passing).
- [x] SC5. Dashboard is a real transparent, always-on-top floating **`.app`** (launches without a browser).
- [x] SC6. HUD meets the Marvel FUI + command-center UX bar (R13/R14) and holds 60fps.
- [ ] SC7. Cockpit control panel drives all `/api/command` actions; guarded controls gate destructive ones.
- [ ] SC8. App packaged + notarized; `jarvis dashboard` launches the window.

---

## 5. Out of Scope / Constraints

- macOS **OS-version** upgrades are *not* auto-applied (require user auth / reboots); app/package updates are.
- VPS cleanup is conservative and targeted (no broad `rm` on remote hosts).
- Eurostile Extended is a licensed font — use Orbitron/Rajdhani as the bundled fallback if no license.
- Notarization requires an Apple Developer ID; absent that, the `.app` runs locally unsigned.
- No network exposure of the dashboard; loopback only.

---

## 6. References (design research)

- Electron transparent overlay: `jeromeetienne/electron-threejs-example`; macOS window flags (`visualEffectState:'active'`, `setAlwaysOnTop('screen-saver')`).
- HUD effects: `VisualSource/selectiveUnrealBloomPass`, `ektogamat/threejs-vanilla-holographic-material`, `pmndrs/postprocessing`, `leeoniya/uPlot`.
- FUI design language: Jayse Hansen / Perception / Cantina Creative; HUDS+GUIS; scifiinterfaces.com.
- Dashboard UX: Grafana best-practices, NN/g animation timing, IBM Carbon dark tokens, Smashing Mag real-time dashboard patterns.
