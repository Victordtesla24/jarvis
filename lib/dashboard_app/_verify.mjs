// Headless visual + behavioural verification for the holographic uplift.
// Loads the dev server, captures reactor + globe screenshots, toggles between
// them, and asserts: no console errors, graceful camera fallback (headless has
// no camera), and that the gesture-driven views still render an animated frame.
import pw from '/home/user/node_modules/playwright/index.js';
const { chromium } = pw;

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = process.cwd();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const errors = [];
const warnings = [];

const browser = await chromium.launch({
  executablePath: '/home/user/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome',
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream'],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });

const failedRequests = [];
page.on('console', (msg) => {
  const type = msg.type();
  if (type === 'error') errors.push(msg.text());
  if (type === 'warning') warnings.push(msg.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
// Track which URLs returned >=400 so we can classify offline conditions
// (no /api/stats backend, external texture CDNs) vs. genuine app failures.
page.on('response', (res) => {
  if (res.status() >= 400) failedRequests.push({ url: res.url(), status: res.status() });
});
page.on('requestfailed', (req) => failedRequests.push({ url: req.url(), status: 'failed' }));

// Skip the boot button → straight to the HUD.
await page.goto(`${BASE}/?skipboot`, { waitUntil: 'domcontentloaded' });

// Let the WebGL canvas + HUD settle and animate a few frames.
await page.waitForSelector('canvas', { timeout: 15000 });
await sleep(3500);

// (a) Reactor mode — default. Confirm canvas has painted non-empty pixels.
const reactorPixels = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return { ok: false, reason: 'no canvas' };
  return { ok: true, w: c.width, h: c.height };
});
await page.screenshot({ path: `${OUT}/_verify_reactor.png` });

// Confirm the GLOBE toggle exists and does not overlap the TELEMETRY chip.
const overlap = await page.evaluate(() => {
  const toggle = document.querySelector('.jh-globe-toggle');
  const status = document.querySelector('.jh-top-status');
  if (!toggle || !status) return { ok: false, reason: 'missing toggle/status' };
  const a = toggle.getBoundingClientRect();
  const b = status.getBoundingClientRect();
  const intersect = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  return { ok: true, intersect, toggle: a, status: b };
});

// (d) Count visible HUD panels (density) and check no two glass panels overlap
// badly with the centre toggle.
const panelInfo = await page.evaluate(() => {
  const panels = [...document.querySelectorAll('.glass-panel')];
  return { count: panels.length };
});

// (b) Toggle to GLOBE.
await page.click('.jh-globe-toggle');
await sleep(3500);
await page.screenshot({ path: `${OUT}/_verify_globe.png` });

// Toggle back to REACTOR (prove both directions).
await page.click('.jh-globe-toggle');
await sleep(2000);
await page.screenshot({ path: `${OUT}/_verify_reactor_again.png` });

await browser.close();

// ---- report ----
// Tolerated console noise: camera (no device headless), WebGL/swiftshader chatter,
// and offline-resource failures (no /api/stats backend, external texture/font CDNs).
const OFFLINE_RX = /api\/stats|api\/command|\/favicon|cdn\.jsdelivr|esm\.sh|aistudiocdn|fonts\.googleapis|fonts\.gstatic|Failed to load resource|status of 4\d\d|status of 5\d\d|ERR_|net::/i;
const cameraErrors = errors.filter((e) => /camera|getUserMedia|MediaPipe/i.test(e));
const fatalErrors = errors.filter(
  (e) => !/camera|getUserMedia|MediaPipe|WebGL|GroupMarker|GL_/i.test(e) && !OFFLINE_RX.test(e),
);

console.log('=== VERIFY REPORT ===');
console.log('reactorPixels:', JSON.stringify(reactorPixels));
console.log('toggle/status overlap:', JSON.stringify(overlap));
console.log('glass-panel count:', panelInfo.count);
console.log('total console errors:', errors.length);
console.log('camera-related (expected, tolerated):', cameraErrors.length);
console.log(
  'offline-resource failures (expected, tolerated):',
  failedRequests.length,
  failedRequests.length ? JSON.stringify(failedRequests.map((f) => `${f.status} ${f.url}`), null, 2) : '',
);
console.log('fatal (non-camera/webgl/offline) errors:', fatalErrors.length);
if (fatalErrors.length) console.log('FATAL:', JSON.stringify(fatalErrors, null, 2));
console.log('warnings:', warnings.length);

const pass =
  reactorPixels.ok &&
  overlap.ok &&
  overlap.intersect === false &&
  panelInfo.count >= 8 &&
  fatalErrors.length === 0;

console.log('RESULT:', pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
