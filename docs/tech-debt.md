# Technical Debt — deferred items from CE review 20260418-002604-4561b873

## R-67 — AppDelegate.swift split (advisory)

**Status:** deferred to follow-up iteration.
**Current:** `JarvisTelemetry/Sources/JarvisTelemetry/AppDelegate.swift` is ~1,230 lines and concentrates:
- WKWebView wallpaper-window setup + lifecycle
- telemetry injection (full-daemon payload, battery, reactive thresholds)
- lock-screen animation loop (snapshot + wallpaper-rotation trick)
- signal handling (SIGTERM/SIGINT + shutdown latch)
- test/trigger observers (DEBUG-only + production togglePanel/shutdown)
- promo-capture window-level restoration (R-54)

**Proposed split (for a future PR):**
- `AppDelegate.swift` — application lifecycle, signal handling, observer registration (≤400 lines)
- `WallpaperWindowController.swift` — NSWindow / WKWebView construction and per-screen ownership
- `TelemetryInjector.swift` — JSON payload assembly + `evaluateJavaScript` bridge
- `LockScreenAnimator.swift` — 0.3 s wallpaper rotation loop, snapshot pipeline
- `TriggerObserver.swift` — DistributedNotificationCenter bindings (DEBUG vs production)
- `PromoCaptureMode.swift` — JARVIS_PROMO_CAPTURE handling incl. atexit/signal hooks

**Why deferred:** the spec (§2 R-67) flags this as advisory, noting “do not refactor this iteration; document in docs/tech-debt.md as deferred.” Splitting now would expand the review-resolution diff well beyond the 55 named files and risk introducing integration regressions outside the review scope.

**Ownership:** whoever next touches AppDelegate.swift should pick at least one of the proposed extractions above and land it as an isolated refactor PR.
