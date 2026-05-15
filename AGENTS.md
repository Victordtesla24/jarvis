# AGENTS.md — JARVIS Telemetry

Cinema-grade macOS HUD — Iron Man arc reactor wallpaper with live Apple Silicon telemetry.
Read `CLAUDE.md` for full detail.

**Requires:** macOS 15+ (Sequoia), Apple Silicon (M1/M2/M3/M4), CGO enabled.

---

## Build & Run

```bash
./build-app.sh      # full .app bundle (canonical workflow)
./start-jarvis.sh   # launch
./stop-jarvis.sh    # graceful shutdown (6s animation then exit)
```

---

## Manual Rebuild Order — Go First, Always

The Go daemon binary must exist in `Resources/` before Swift will compile:

```bash
# Step 1 — build Go daemon
cd mactop
go build -o ../JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon .

# Step 2 — build Swift app
cd JarvisTelemetry
swift build -c release
```

Running `swift build` without first rebuilding the Go binary embeds a stale or missing daemon.

---

## Test & Lint

```bash
cd mactop && make test     # go test -v ./internal/app/...
cd mactop && make sexy     # gofmt + go vet + gocyclo (max 15) + ineffassign — must pass before commit
cd JarvisTelemetry && swift test
python3 -m pytest scripts/promo-video/tests/
```

`make sexy` is the pre-commit gate. Cyclomatic complexity max is 15.

---

## Architecture

```
Go Daemon (mactop --headless)
  → 1Hz JSON via NSPipe
    → TelemetryBridge (Swift, async stream reader)
      → AppDelegate.injectFullTelemetry (@MainActor)
        → WKWebView.evaluateJavaScript → updateTelemetry() in jarvis-full-animation.html
          → Canvas engine at 60fps on desktop wallpaper layer
```

- Primary render path: `jarvis-full-animation.html` via WKWebView (700+ vector paths)
- Secondary: `JarvisHUDView.swift` (SwiftUI Canvas) — kept for compatibility, not the live render path
- `AppDelegate.swift` is 1200+ lines — central coordinator, do not split without understanding window/signal/battery event handling

---

## Go Conventions

- `fmt.Errorf("%w", err)` or `errors.Join` for error wrapping
- `sync.Mutex` for shared state, channels for communication, context for cancellation
- Table-driven tests with `t.Parallel()`
- Build system: Swift Package Manager only (no Xcode project file)

---

## HUD Color Palette

| Hex | Role |
|---|---|
| `#1AE6F5` | Primary teal-cyan — rings, ticks, data arcs |
| `#FFC800` | Amber — P-Core arcs, bezel accent |
| `#FF2633` | Crimson — S-Core arcs, thermal alerts |
| `#668494` | Steel — structural rings |
| `#050A14` | Background |
