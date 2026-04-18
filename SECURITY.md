# Security Policy

## Supported versions

| Version | Status |
|---|---|
| `main` (unreleased) | Supported — security fixes land first |
| `0.1.x` | Supported until next minor release |
| `< 0.1` | Unsupported |

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports.**

Email **sarkar.vikram@gmail.com** with subject `[JARVIS-SECURITY] <short summary>`. Include:

1. Affected component (`mactop` daemon, `JarvisTelemetry` app, build script, etc.).
2. macOS + chip combo where the issue reproduces.
3. Reproduction steps and impact (RCE? privilege escalation? sensor data leak?).
4. Suggested mitigation if you have one.

You will receive an acknowledgement within **72 hours** and a triage decision within **7 days**.

## Scope

| In scope | Out of scope |
|---|---|
| RCE in the Swift app or Go daemon | Issues requiring physical access to an unlocked machine |
| Privilege escalation (the daemon runs unprivileged; only sensor reads use IOKit) | Bugs in macOS itself |
| Data exfiltration of sensor telemetry | Crash reports without proof of exploitability |
| Supply-chain risk in vendored dependencies (`mactop/`, Go modules) | Spam / abuse against the repo or maintainers |
| HTML/JS rendering exploits in `jarvis-full-animation.html` | Cosmetic UI glitches |

## Threat model snapshot

JARVIS runs entirely on-device. There is **no network listener**, **no analytics**, and **no telemetry leaves the host**.

| Surface | Privilege | Mitigations |
|---|---|---|
| `mactop` Go daemon | User; reads IOKit / SMC sensors | Single-binary, no shell-out, all sensor IO via vetted bindings |
| `TelemetryBridge` (Swift) | User | JSON-line protocol, parser is `JSONDecoder` with strict types |
| `WKWebView` running `jarvis-full-animation.html` | User | Local file URL only; no remote loads; JS bridge is one-way (Swift → JS) |
| Wallpaper window | `kCGDesktopWindowLevel`, `ignoresMouseEvents = true` | Cannot intercept input or steal focus |
| Promo-video pipeline | User | Optional; isolated Python venv; no production runtime impact |

## Handling secrets

The repo deliberately gitignores:
- `.env`, `.env.*`
- `tests/api_keys.env`
- `mcp.json`

If you spot a leaked credential in a PR or commit, email the security address above immediately.

## Disclosure

We follow **coordinated disclosure**:

1. Fix is developed in a private branch.
2. Patch is released; CHANGELOG.md credits the reporter (with consent).
3. Public advisory is published 7 days after the patched release.

Thank you for helping keep JARVIS safe.
