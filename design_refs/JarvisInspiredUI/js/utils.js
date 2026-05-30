// ==================== UTILITIES & SHARED STATE ====================
const $ = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const qsa = sel => document.querySelectorAll(sel);
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let systemActive = false;
let targetLockActive = false;
let speechEnabled = false;
let mouseX = innerWidth / 2, mouseY = innerHeight / 2;

// ==================== UNIFIED FETCH WRAPPER ====================
let _lastFetchToast = 0;
function jarvisFetch(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const fetchOptions = Object.assign({}, options, { signal: controller.signal });
    return fetch(url, fetchOptions).then(response => {
        clearTimeout(timeout);
        return response;
    }).catch(err => {
        clearTimeout(timeout);
        if (typeof addLog === 'function') addLog('Fetch failed: ' + url, 'warn');
        const now = Date.now();
        if (now - _lastFetchToast > 30000) {
            _lastFetchToast = now;
            if (typeof showToast === 'function') showToast('Network request failed — using fallback', 'warn');
        }
        throw err;
    });
}
