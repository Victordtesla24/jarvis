// JARVIS floating HUD — Electron main process.
//
// A real transparent, frameless, always-on-top desktop window that floats over
// the desktop like the Iron-Man HUD and loads the existing Python loopback
// dashboard (/api/stats + /api/command). No browser is involved.
//
// The window is click-through by default so the desktop stays usable; the
// preload re-enables mouse capture only while the pointer is over a
// [data-interactive] region (see preload.js).
'use strict';

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const HUD_URL = process.env.JARVIS_DASHBOARD_URL || 'http://127.0.0.1:7327';

let win = null;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    // --- transparent floating overlay -------------------------------------
    transparent: true,
    frame: false,
    backgroundColor: '#00000000', // fully transparent — see the desktop through it
    hasShadow: false,
    resizable: true,
    minimizable: true,
    movable: true,
    skipTaskbar: true,
    fullscreenable: false,
    type: 'panel', // NSPanel: floats without stealing focus from other apps
    // --- macOS holographic frosting (secondary to pure transparency) ------
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // keep 60fps when not focused
    },
  });

  // Float above everything, including other apps' full-screen spaces.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Click-through by default; the desktop behind the HUD stays usable.
  // `forward: true` still lets the renderer observe move events so the preload
  // can detect when the pointer enters an interactive region.
  win.setIgnoreMouseEvents(true, { forward: true });

  // The preload toggles capture as the pointer moves on/off [data-interactive].
  ipcMain.on('set-ignore-mouse', (_event, ignore) => {
    if (!win || win.isDestroyed()) return;
    win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
  });

  loadHud();

  win.on('closed', () => {
    win = null;
  });
}

function loadHud() {
  win.loadURL(HUD_URL).catch(() => {
    // The Python backend may still be coming up; retry shortly.
    setTimeout(loadHud, 600);
  });
}

// Retry if the backend isn't ready the instant the window opens.
app.on('web-contents-created', (_e, contents) => {
  contents.on('did-fail-load', () => {
    if (win && !win.isDestroyed()) setTimeout(loadHud, 600);
  });
});

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
