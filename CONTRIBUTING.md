# Contributing to JARVIS Telemetry

Thanks for your interest in JARVIS — a cinema-grade desktop HUD for Apple Silicon. This document covers everything you need to land a contribution cleanly.

## Quick links

| What | Where |
|---|---|
| Architecture overview | [README.md › Architecture](README.md#-architecture) |
| Build & run | [README.md › Build](README.md#-build--run) |
| Project conventions | [CLAUDE.md](CLAUDE.md) |
| Security policy | [SECURITY.md](SECURITY.md) |
| Release notes | [CHANGELOG.md](CHANGELOG.md) |

## Ground rules

1. **macOS 15+ / Apple Silicon only.** No Intel, no Linux, no Windows. Hardware-specific code paths everywhere.
2. **Do not break the wallpaper layer.** The HUD lives at `kCGDesktopWindowLevel` and must remain interaction-transparent.
3. **No proprietary assets.** Inspiration is welcome; copying Marvel artwork is not.
4. **One concern per PR.** Visual tweak, telemetry channel, daemon refactor — keep them separate.

## Local setup

```bash
# 1. Clone
git clone https://github.com/Victordtesla24/jarvis.git jarvis-build
cd jarvis-build

# 2. Build the Go telemetry daemon (CGO required)
cd mactop && go build -o ../JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon . && cd ..

# 3. Build & launch
./build-app.sh
./start-jarvis.sh

# 4. Stop cleanly
./stop-jarvis.sh
```

## Code style

| Language | Tooling | Notes |
|---|---|---|
| Swift  | `swift-format` (default config) | 4-space indent, 120-char lines |
| Go     | `gofmt`, `goimports`, `go vet`, `gocyclo ≤ 15`, `ineffassign` — run `make sexy` from `mactop/` | Wrap errors with `fmt.Errorf("%w", err)` |
| Python | PEP 8 via `ruff`/`black` | Pipeline scripts only (`scripts/promo-video/`) |
| Shell  | POSIX-compatible `bash`, `set -euo pipefail` | All scripts must be idempotent |

`.editorconfig` enforces the basics across editors.

## Tests

```bash
# Go — table-driven, parallel-safe
cd mactop && make test

# Swift
cd JarvisTelemetry && swift test

# Python pipeline
python3 -m pytest scripts/promo-video/tests/
```

A PR that adds behaviour without a test is not ready.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]
[optional footer]
```

Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `chore`, `test`, `build`, `ci`.
Scopes used in this repo: `daemon`, `hud`, `bridge`, `boot`, `shutdown`, `lock`, `battery`, `promo-video`, `scripts`, `docs`.

Examples:
```
feat(hud): add E-Core arc with 84R radius
fix(daemon): handle SMC sensor timeout under thermal throttle
docs(readme): document JarvisWallpaper module
```

## Pull request checklist

- [ ] Targets `main`, branch named `<type>/<short-slug>`
- [ ] All tests pass locally (`make test`, `swift test`, `pytest`)
- [ ] No new lints (`make sexy` is clean)
- [ ] No tracked artefacts (`.log`, `.bak`, `.build/`, `.venv/`, `node_modules/`, generated media)
- [ ] No secrets committed (check `.env`, API keys, `mcp.json`)
- [ ] README/CHANGELOG updated for user-visible changes
- [ ] Single concern, ≤ 400 changed lines preferred

## Directory rules of engagement

| Path | Touch with care |
|---|---|
| `JarvisTelemetry/Sources/` | Main HUD; AppDelegate is large by design |
| `JarvisWallpaper/` | Standalone wallpaper companion module |
| `JarvisScreenSaver/` | Screensaver wrapper around the HUD |
| `mactop/` | Vendored Go daemon — upstream is `context-labs/mactop` |
| `scripts/promo-video/` | Marketing/demo pipeline; not in the runtime |
| `jarvis-full-animation.html` | Primary render canvas — extreme caution |

## Filing issues

Open an issue with:
- macOS version + Apple Silicon chip (`sysctl hw.model` and `sysctl machdep.cpu.brand_string`)
- Build commit (`git rev-parse --short HEAD`)
- Reproduction steps
- Console output from `start-jarvis.sh` (no secrets, no full session logs)

## Releasing

Releases are cut from tagged commits on `main`. Each release updates [CHANGELOG.md](CHANGELOG.md) following [Keep a Changelog](https://keepachangelog.com/) format.

---

*"Welcome to the team. Try not to crash anything important."* — JARVIS
