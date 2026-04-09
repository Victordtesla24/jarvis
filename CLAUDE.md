# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

JARVIS Telemetry — a cinema-grade macOS HUD that renders a full-screen Iron Man-style arc reactor wallpaper with live Apple Silicon telemetry. Two-process architecture: a Go telemetry daemon (`mactop/`) streams JSON at 1Hz via NSPipe to a SwiftUI frontend (`JarvisTelemetry/`) that renders 700+ vector paths at 60fps using Canvas + TimelineView.

## Build & Run

```bash
# Build Go daemon (must be done first — binary is bundled as a Swift resource)
cd mactop
go build -o ../JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon .

# Build Swift app
cd JarvisTelemetry
swift build -c release

# Run (requires sudo for IOKit/SMC sensor access)
sudo .build/release/JarvisTelemetry
```

## Test & Lint

```bash
# Go tests (table-driven, from mactop/)
cd mactop
make test          # go test -v ./internal/app/...

# Go code quality (must pass before committing)
make sexy          # gofmt, go vet, gocyclo (max 15), ineffassign
```

No Swift tests currently exist.

## Architecture

```
Go Daemon (mactop --headless)
  → 1Hz JSON lines via NSPipe
    → TelemetryBridge (async stream reader, JSON decoder)
      → TelemetryStore (@Published, normalizes to 0.0-1.0)
        → JarvisHUDView (SwiftUI Canvas @ 60fps)
          → AppDelegate (NSWindow @ kCGDesktopWindowLevel, one per screen)
```

**Go daemon** (`mactop/internal/app/`): Reads CPU/GPU/memory/thermal/power sensors via IOKit, SMC (C), and IOReport (Obj-C) bindings. `headless.go` handles JSON output mode for JARVIS. `app.go` is the coordinator. Three custom metrics: DVHOP (VM overhead %), GUMER (GPU memory eviction MB/s), CCTC (thermal cost above 50°C baseline).

**Swift frontend** (`JarvisTelemetry/Sources/JarvisTelemetry/`): Pure vector rendering — no images or textures. `JarvisHUDView.swift` (1400+ lines) contains the reactor canvas and 15+ view structs. `TelemetryBridge.swift` launches the daemon subprocess and streams JSON. `AppDelegate.swift` manages wallpaper-layer windows. `JarvisPreloader.swift` runs a SceneKit boot sequence.

## Go Conventions (from .cursorrules)

- Go 1.21+ features, `gofmt`/`goimports` compliant
- Wrap errors with `fmt.Errorf("%w", err)` or `errors.Join`
- `sync.Mutex` for shared state, `channels` for communication, `context` for cancellation
- Table-driven tests with `t.Parallel()` where safe
- `app.go` delegates to domain-specific modules (metrics, ui, parsing)

## Color Palette (HUD)

| Hex | Role |
|:---:|:---|
| `#00D4FF` | Primary cyan — rings, ticks, data arcs |
| `#FFC800` | Amber — P-Core arcs, bezel accent |
| `#FF2633` | Crimson — S-Core arcs, thermal alerts |
| `#668494` | Steel — structural rings, bezels |
| `#050A14` | Background |

## Key Constraints

- macOS 14+ / Apple Silicon only (M1/M2/M3/M4)
- Swift Package Manager (not Xcode project)
- CGO required (C/Obj-C bindings for IOKit, SMC, IOReport)
- Daemon binary must be rebuilt and placed in `Resources/` before Swift build picks up changes
