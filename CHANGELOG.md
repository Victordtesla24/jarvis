# Changelog

All notable changes to JARVIS Telemetry are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `JarvisWallpaper/` — standalone Swift Package wallpaper module with bundled HTML render canvas.
- `JarvisScreenSaver/` — `.saver` bundle wrapping the HUD as a macOS screensaver.
- Promo-video pipeline (`scripts/promo-video/`) — orchestrated capture / VO / music / assembly with `--rough` and `--polish` modes.
- Reactive event dispatch tests, battery monitor replay tests, process lifecycle observer tests.
- `BatteryMonitor.swift` upgraded to push-based polling at 2 Hz with edge-detection.
- `GhostTrailRenderer.swift`, `ReactorParticleEmitter.swift` — particle/trail systems for the boot phase.
- `verify-reactive.sh`, `_paths.sh`, `install.sh`, `com.jarvis.wallpaper.plist` — operational scripts and launchd integration.
- Comprehensive `CONTRIBUTING.md`, `SECURITY.md`, `.editorconfig`, expanded `.gitignore`.

### Changed
- Primary render path is now WKWebView + `jarvis-full-animation.html` (HTML/Canvas engine). The SwiftUI `Canvas`/`TimelineView` HUD remains as a secondary path for compatibility.
- Build wrappers (`build-app.sh`, `start-jarvis.sh`, `stop-jarvis.sh`) are the canonical workflow.
- Promo capture uses native `screencapture -v` instead of `ffmpeg avfoundation`.
- Promo run orchestrator: `sudo` is now optional, audio pipeline pads VO to 120 s with `asplit` ducking.

### Removed
- `JarvisPersonality.swift` — folded into `ChatterEngine` / `SystemMoodEngine`.
- `VideoGenerationPipeline.swift` — superseded by the external `scripts/promo-video/` pipeline.
- `.serena/`, `.superpowers/brainstorm/.../state/server.{log,pid}` — purged from index.

### Fixed
- Promo video audio: VO now pads to full track length, ducked correctly under music bed.
- `JARVIS_PROMO_CAPTURE` env var raises capture window above desktop level deterministically.

## [0.1.0] — 2026-04-09

### Added
- Initial JARVIS Telemetry HUD: SwiftUI `Canvas`-rendered arc reactor wallpaper at 60 fps.
- Go telemetry daemon (`mactop/`) streaming JSON over NSPipe at 1 Hz.
- 220+ concentric reactor rings, three-tier bezel system, 700+ paths/frame.
- Telemetry channels: CPU/GPU/E-core/P-core/S-core usage, power, thermals, DRAM bandwidth, custom DVHOP/GUMER/CCTC metrics.
- Three rendering color zones: cyan (data), amber (P-core), crimson (S-core/thermal).
- Boot, shutdown, lock-screen, standby phase sequences.
- `Package.swift` (SPM) build targeting macOS 15 / Apple Silicon.

[Unreleased]: https://github.com/Victordtesla24/jarvis/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Victordtesla24/jarvis/releases/tag/v0.1.0
