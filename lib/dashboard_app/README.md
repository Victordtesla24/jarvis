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
launches Electron pointed at it. Closing the window stops the backend.

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

## Package the `.app`

```sh
npm run dist       # → dist/mac/JARVIS.app
```

Notarization (an Apple Developer ID + `notarize` config) is tracked separately
as **SC8**; without it the `.app` runs locally unsigned.
