// JARVIS floating desktop HUD — transparent, frameless, always-on-top Electron
// shell that loads the loopback dashboard (served by lib/dashboard.py). The
// backend URL arrives via JARVIS_DASHBOARD_URL (set by dashboard.py launch_app);
// the React app talks to /api/stats same-origin. No browser, no audio.

const { app, BrowserWindow, globalShortcut, screen } = require('electron');

// Transparent compositing hints (helps on some GPUs/macOS).
app.commandLine.appendSwitch('enable-transparent-visuals');

const BACKEND = process.env.JARVIS_DASHBOARD_URL || 'http://127.0.0.1:7327';
// ?skipboot lands straight on the HUD (the floating overlay shouldn't need a click)
const HUD_URL = `${BACKEND}/?skipboot`;

let win = null;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
    fullscreenable: true,
    skipTaskbar: false,
    title: 'J.A.R.V.I.S.',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // keep the reactor animating when unfocused
    },
  });

  // float above normal windows, follow across spaces
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadURL(HUD_URL);

  // Make the substrate truly transparent so the desktop shows through the HUD.
  win.webContents.on('did-finish-load', () => {
    win.webContents.insertCSS(
      'html,body,#root,.app-substrate{background:transparent !important;background-color:transparent !important}'
    );
    // Self-terminating validation capture (inert unless JARVIS_CAPTURE is set):
    // grabs the rendered HUD to a PNG, then quits — used to verify the window
    // renders without leaving a window open on the desktop.
    if (process.env.JARVIS_CAPTURE) {
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage();
          require('fs').writeFileSync(process.env.JARVIS_CAPTURE, img.toPNG());
        } catch (_) { /* ignore */ }
        app.quit();
      }, 6000);
    }
  });

  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  createWindow();

  // Esc quits; Cmd/Ctrl+Shift+H toggles click-through so the HUD can become a
  // pure overlay you click past, or interactive again.
  let clickThrough = false;
  globalShortcut.register('Escape', () => app.quit());
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (!win) return;
    clickThrough = !clickThrough;
    win.setIgnoreMouseEvents(clickThrough, { forward: true });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
