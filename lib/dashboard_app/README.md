# JARVIS Dashboard — Floating `.app`

A thin [Electron](https://www.electronjs.org/) shell that renders the JARVIS HUD
as a **real transparent, frameless, always-on-top floating window** over the
desktop — no browser. It loads the existing Python loopback backend
(`/api/stats` + `/api/command`); it bundles no HTML of its own.

## Run

```sh
cd lib/dashboard_app
npm install        # one-time: pulls Electron + electron-builder
```

Then, from the repo root:

```sh
jarvis dashboard            # backend + floating .app (default)
jarvis dashboard --browser  # same HUD in a web browser (headless/quick-look)
```

`jarvis dashboard` starts the loopback backend, sets `JARVIS_DASHBOARD_URL`, and
launches the window pointed at it. It prefers a **packaged `.app`** (built into
`dist/mac*/JARVIS.app` or installed in `/Applications`) and falls back to a dev
Electron run of this directory. Closing the window stops the backend.

## Window behaviour (`main.js`)

- `transparent: true` + `backgroundColor: '#00000000'` + `hasShadow: false` —
  pure see-through overlay (the three.js renderer also clears to alpha 0).
- `frame: false`, `type: 'panel'` — frameless NSPanel that floats without
  stealing focus.
- `setAlwaysOnTop(true, 'screen-saver')` + `setVisibleOnAllWorkspaces(true,
  { visibleOnFullScreen: true })` — stays above everything, including other
  apps' full-screen spaces.
- `backgroundThrottling: false` — holds 60fps when unfocused.
- **Click-through:** the window starts with `setIgnoreMouseEvents(true,
  { forward: true })`; `preload.js` re-captures the mouse only while the pointer
  is over a `[data-interactive]` region, so the desktop behind stays usable.

## Package + notarize the `.app` (SC8)

```sh
npm run dist       # → dist/JARVIS-*.dmg  +  dist/mac*/JARVIS.app
```

`npm run dist` builds a distributable `.dmg` and a `.app` with a **hardened
runtime** + signed entitlements (`build/entitlements.mac.plist`) — the
prerequisites for notarization.

The `afterSign` hook (`build/notarize.js`) notarizes the signed `.app` with
Apple's notary service when an Apple Developer ID is present in the environment:

```sh
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"   # app-specific password
export APPLE_TEAM_ID="XXXXXXXXXX"
npm run dist       # signs, notarizes, and staples the .app
```

Without those credentials the hook **skips notarization** (with a warning) and
the build still produces a `.app` that runs locally unsigned — matching the PRD
constraint for boxes that have no Developer ID.
