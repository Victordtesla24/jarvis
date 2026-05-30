// JARVIS floating HUD — preload (isolated bridge).
//
// Two jobs:
//   1. Tell the HUD it is running inside the floating .app so it drops its
//      opaque "void" backdrop and renders fully transparent over the desktop.
//   2. Make the always-on-top overlay click-through everywhere EXCEPT over
//      elements marked [data-interactive] (the command console, toggles, …).
//      We watch pointer movement and ask the main process to capture or
//      release the mouse accordingly.
'use strict';

const { ipcRenderer } = require('electron');

let capturing = false;

function setCapture(shouldCapture) {
  if (shouldCapture === capturing) return;
  capturing = shouldCapture;
  // ignore mouse === NOT capturing
  ipcRenderer.send('set-ignore-mouse', !shouldCapture);
}

function isInteractive(el) {
  return Boolean(el && el.closest && el.closest('[data-interactive]'));
}

window.addEventListener('DOMContentLoaded', () => {
  // Pure see-through overlay: hide the dimmable backdrop used in a browser tab.
  document.body.classList.add('transparent', 'in-app');

  // Default to click-through; capture only when hovering interactive UI.
  document.addEventListener(
    'mousemove',
    (e) => setCapture(isInteractive(document.elementFromPoint(e.clientX, e.clientY))),
    true,
  );
  // If the pointer leaves the window entirely, release capture.
  document.addEventListener('mouseleave', () => setCapture(false), true);
});
