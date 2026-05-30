// ==================== PARALLAX ====================
document.addEventListener('mousemove', (e) => {
    if (!systemActive) return;
    const layers = qsa('.parallax-layer');
    const x = (e.clientX - innerWidth / 2) / 120;
    const y = (e.clientY - innerHeight / 2) / 120;
    layers.forEach(layer => {
        const speed = parseFloat(layer.getAttribute('data-speed'));
        if (layer.classList.contains('center-panel')) {
            layer.style.transform = `translate(calc(-50% + ${x * speed}px), calc(-50% + ${y * speed}px))`;
        } else if (layer.classList.contains('left-panel')) {
            const base = layer.querySelector('.panel-border');
            layer.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
        } else {
            layer.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
        }
    });
});

// ==================== AUDIO VISUALIZER (ambient) ====================
(function initAudioVis() {
    const canvas = $('audio-canvas');
    const ctx = canvas.getContext('2d');
    const bars = 44;
    let heights = new Array(bars).fill(0);
    let targetHeights = new Array(bars).fill(0);

    // Simulate ambient audio data
    setInterval(() => {
        for (let i = 0; i < bars; i++) {
            targetHeights[i] = Math.random() * 40 + 5;
        }
    }, 150);

    function draw() {
        ctx.clearRect(0, 0, 440, 60);
        const barW = 440 / bars - 2;
        for (let i = 0; i < bars; i++) {
            heights[i] += (targetHeights[i] - heights[i]) * 0.15;
            const h = heights[i];
            const x = i * (barW + 2);
            ctx.fillStyle = `rgba(0,212,255,${0.3 + (h / 60) * 0.4})`;
            ctx.fillRect(x, 60 - h, barW, h);
        }
        requestAnimationFrame(draw);
    }
    draw();
})();

// ==================== PERIODIC GLITCH EFFECT ====================
setInterval(() => {
    if (!systemActive) return;
    const els = qsa('#big-date, #time, .panel-title span');
    const el = els[Math.floor(Math.random() * els.length)];
    el.classList.add('glitch-text');
    setTimeout(() => el.classList.remove('glitch-text'), 150);
}, 6000);

// ==================== PERIODIC TOASTS ====================
setInterval(() => {
    if (!systemActive) return;
    const msgs = [
        ['Satellite realignment complete', 'info'],
        ['Encrypted backup synced', 'info'],
        ['Anomalous RF signal detected — analyzing', 'warn'],
        ['Network throughput optimal', 'info'],
        ['Perimeter breach test — passed', 'info'],
        ['DNS resolution cache refreshed', 'info'],
        ['SSL certificate rotation scheduled', 'info'],
        ['Memory defragmentation cycle complete', 'info'],
        ['Intrusion detection: 0 new events', 'info'],
        ['Process watchdog: all nominal', 'info'],
    ];
    const [text, type] = msgs[Math.floor(Math.random() * msgs.length)];
    showToast(text, type);
}, 15000);

// ==================== MATRIX DIGITAL RAIN ====================
(function initMatrix() {
    const canvas = $('matrix-canvas');
    const ctx = canvas.getContext('2d');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>{}[]|/\\~αβγδεζηθ';
    let columns, drops;
    function resize() {
        canvas.width = innerWidth;
        canvas.height = innerHeight;
        columns = Math.floor(canvas.width / 14);
        drops = new Array(columns).fill(1);
    }
    resize();
    window.addEventListener('resize', resize);
    function draw() {
        ctx.fillStyle = 'rgba(2,6,8,0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#00d4ff';
        ctx.font = '12px Share Tech Mono';
        for (let i = 0; i < drops.length; i++) {
            const char = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(char, i * 14, drops[i] * 14);
            if (drops[i] * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
        requestAnimationFrame(draw);
    }
    draw();
})();

// ==================== HUD MOUSE RETICLE ====================
const reticle = $('hud-reticle');
const reticleCoords = $('reticle-coords');
let reticleX = mouseX, reticleY = mouseY;
document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
function updateReticle() {
    if (systemActive) {
        reticleX += (mouseX - reticleX) * 0.1;
        reticleY += (mouseY - reticleY) * 0.1;
        reticle.style.left = reticleX + 'px';
        reticle.style.top = reticleY + 'px';
        reticleCoords.textContent = `X:${Math.round(reticleX)} Y:${Math.round(reticleY)}`;
        // Update target lock position if active
        if (targetLockActive) {
            const tl = $('target-lock');
            tl.style.left = reticleX + 'px';
            tl.style.top = reticleY + 'px';
        }
    }
    requestAnimationFrame(updateReticle);
}
updateReticle();

// ==================== THEME SYSTEM ====================
const themes = ['default', 'combat', 'stealth', 'custom'];
let currentTheme = 0;
const themeNames = { default: 'STANDARD', combat: 'COMBAT', stealth: 'STEALTH', custom: 'CUSTOM' };

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: h * 360, s, l };
}

function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

function applyCustomTheme(hex) {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const docStyle = document.documentElement.style;
    docStyle.setProperty('--cyan', hex);
    docStyle.setProperty('--cyan-dim', `rgba(${rgb.r},${rgb.g},${rgb.b},0.3)`);
    docStyle.setProperty('--cyan-glow', `rgba(${rgb.r},${rgb.g},${rgb.b},0.6)`);
    docStyle.setProperty('--green', hslToHex(hsl.h + 120, hsl.s, hsl.l));
    docStyle.setProperty('--gold', hslToHex(hsl.h - 60, hsl.s, hsl.l));
}

function clearCustomThemeVars() {
    const docStyle = document.documentElement.style;
    ['--cyan', '--cyan-dim', '--cyan-glow', '--green', '--gold'].forEach(v => docStyle.removeProperty(v));
}

function setTheme(name) {
    const t = (name || '').toLowerCase().trim();
    // Handle "custom #hex" syntax
    let customHex = null;
    if (t.startsWith('custom')) {
        const hexMatch = t.match(/#([0-9a-f]{3,6})/i);
        if (hexMatch) {
            customHex = '#' + hexMatch[1];
        } else if (t === 'custom') {
            // Restore saved custom theme
            customHex = localStorage.getItem('jarvis_custom_theme');
            if (!customHex) return null;
        } else {
            return null;
        }
    }
    const resolvedName = customHex ? 'custom' : (t === 'standard' ? 'default' : t);
    const idx = themes.indexOf(resolvedName);
    if (idx === -1) return null;
    document.body.classList.remove('theme-combat', 'theme-stealth', 'theme-custom');
    clearCustomThemeVars();
    currentTheme = idx;
    const theme = themes[currentTheme];
    if (theme === 'custom' && customHex) {
        document.body.classList.add('theme-custom');
        applyCustomTheme(customHex);
        localStorage.setItem('jarvis_custom_theme', customHex);
    } else if (theme !== 'default') {
        document.body.classList.add('theme-' + theme);
    }
    const indicator = $('theme-indicator');
    const displayName = theme === 'custom' ? `CUSTOM (${customHex})` : themeNames[theme];
    indicator.textContent = `MODE: ${displayName}`;
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 2500);
    addLog(`HUD mode switched: ${displayName}`, 'info');
    speak(`${themeNames[theme]} mode activated.`);
    showToast(`HUD Mode: ${displayName}`, theme === 'combat' ? 'error' : 'info');
    triggerPowerSurge();
    return displayName;
}
function cycleTheme() {
    let nextIdx = (currentTheme + 1) % themes.length;
    // Skip custom in cycle unless it's saved
    if (themes[nextIdx] === 'custom' && !localStorage.getItem('jarvis_custom_theme')) {
        nextIdx = (nextIdx + 1) % themes.length;
    }
    const next = themes[nextIdx];
    setTheme(next === 'default' ? 'standard' : next);
}

// Restore custom theme on load
(function restoreCustomTheme() {
    const savedHex = localStorage.getItem('jarvis_custom_theme');
    const savedSettings = localStorage.getItem('jarvis_settings');
    if (savedSettings) {
        try {
            const s = JSON.parse(savedSettings);
            if (s.theme === 'custom' && savedHex) {
                document.body.classList.add('theme-custom');
                applyCustomTheme(savedHex);
                currentTheme = themes.indexOf('custom');
            }
        } catch { /* ignore */ }
    }
})();

// ==================== 3D WIREFRAME GLOBE ====================
(function initGlobe() {
    const canvas = $('globe-canvas');
    const ctx = canvas.getContext('2d');
    const cx = 75, cy = 75, r = 60;
    let rotY = 0;

    const satellites = [
        { lat: 28, lon: 84, name: 'BASE' },
        { lat: 40, lon: -74, name: 'NYC' },
        { lat: 51, lon: 0, name: 'LDN' },
        { lat: 35, lon: 139, name: 'TKY' },
        { lat: -33, lon: 151, name: 'SYD' },
    ];

    function project(lat, lon) {
        const phi = lat * Math.PI / 180;
        const theta = (lon + rotY) * Math.PI / 180;
        const x = r * Math.cos(phi) * Math.sin(theta);
        const y = r * Math.sin(phi);
        const z = r * Math.cos(phi) * Math.cos(theta);
        const scale = 200 / (200 + z);
        return { x: cx + x * scale, y: cy - y * scale, z, visible: z > -20 };
    }

    function draw() {
        ctx.clearRect(0, 0, 150, 150);
        rotY += 0.3;

        // Latitude lines
        for (let lat = -60; lat <= 60; lat += 30) {
            ctx.beginPath();
            let first = true;
            for (let lon = 0; lon <= 360; lon += 5) {
                const p = project(lat, lon);
                if (p.visible) { if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y); }
                else first = true;
            }
            ctx.strokeStyle = 'rgba(0,212,255,0.18)'; ctx.lineWidth = 0.5; ctx.stroke();
        }

        // Longitude lines
        for (let lon = 0; lon < 360; lon += 30) {
            ctx.beginPath();
            let first = true;
            for (let lat = -90; lat <= 90; lat += 5) {
                const p = project(lat, lon);
                if (p.visible) { if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y); }
                else first = true;
            }
            ctx.strokeStyle = 'rgba(0,212,255,0.12)'; ctx.lineWidth = 0.5; ctx.stroke();
        }

        // Equator (brighter)
        ctx.beginPath();
        let first = true;
        for (let lon = 0; lon <= 360; lon += 3) {
            const p = project(0, lon);
            if (p.visible) { if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y); }
            else first = true;
        }
        ctx.strokeStyle = 'rgba(0,212,255,0.45)'; ctx.lineWidth = 1; ctx.stroke();

        // Satellites
        satellites.forEach((s, i) => {
            const p = project(s.lat, s.lon);
            if (p.visible && p.z > 0) {
                const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400 + i * 1.2);
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2 + pulse, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0,255,204,${0.4 + pulse * 0.6})`;
                ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 8;
                ctx.fill(); ctx.shadowBlur = 0;
                // Label
                ctx.fillStyle = `rgba(0,255,204,${0.3 + pulse * 0.3})`;
                ctx.font = '6px Share Tech Mono';
                ctx.fillText(s.name, p.x + 5, p.y - 4);
            }
        });

        // Connection lines between visible satellites
        ctx.setLineDash([2, 4]);
        for (let i = 0; i < satellites.length; i++) {
            for (let j = i + 1; j < satellites.length; j++) {
                const a = project(satellites[i].lat, satellites[i].lon);
                const b = project(satellites[j].lat, satellites[j].lon);
                if (a.visible && b.visible && a.z > 0 && b.z > 0) {
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = 'rgba(0,255,204,0.1)'; ctx.lineWidth = 0.5; ctx.stroke();
                }
            }
        }
        ctx.setLineDash([]);

        // Outer glow ring
        ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,212,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();

        requestAnimationFrame(draw);
    }
    draw();
})();

// ==================== SCREEN SHAKE ====================
function screenShake() {
    document.body.classList.add('shaking');
    setTimeout(() => document.body.classList.remove('shaking'), 400);
}

// ==================== POWER SURGE ====================
function triggerPowerSurge() {
    const overlay = $('power-surge');
    overlay.classList.remove('active');
    void overlay.offsetWidth; // force reflow
    overlay.classList.add('active');
    setTimeout(() => overlay.classList.remove('active'), 350);
}

// Random power surges
setInterval(() => {
    if (!systemActive) return;
    if (Math.random() < 0.25) {
        triggerPowerSurge();
        addLog('Power fluctuation — compensating', 'warn');
    }
}, 35000);

// ==================== FLOATING DATA STREAMS ====================
function createDataStream() {
    if (!systemActive) return;
    const container = $('data-streams');
    if (container.children.length > 15) return;
    const stream = document.createElement('div');
    stream.className = 'data-stream';
    stream.style.left = Math.random() * 100 + '%';
    const duration = 15 + Math.random() * 25;
    stream.style.animationDuration = duration + 's';
    const types = [
        () => Array.from({ length: 30 }, () => Math.random().toString(16).substring(2, 4)).join(' '),
        () => Array.from({ length: 20 }, () => String.fromCharCode(33 + Math.floor(Math.random() * 93))).join(''),
        () => ('10110100 01001010 11100010 00101100 ').repeat(4),
    ];
    stream.textContent = types[Math.floor(Math.random() * types.length)]();
    container.appendChild(stream);
    setTimeout(() => stream.remove(), duration * 1000);
}
setInterval(createDataStream, 4000);

// ==================== AMBIENT REACTOR HUM (Web Audio API) ====================
let audioCtx = null, hummingActive = false;
function startAmbientHum() {
    if (hummingActive) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine'; osc1.frequency.value = 60; gain1.gain.value = 0.015;
        osc1.connect(gain1); gain1.connect(audioCtx.destination); osc1.start();
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine'; osc2.frequency.value = 120; gain2.gain.value = 0.006;
        osc2.connect(gain2); gain2.connect(audioCtx.destination); osc2.start();
        hummingActive = true;
        addLog('Ambient reactor hum initialized', 'success');
    } catch (e) { /* Audio not supported */ }
}

// ==================== KONAMI CODE EASTER EGG ====================
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;
document.addEventListener('keydown', (e) => {
    if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            konamiIndex = 0;
            document.body.style.setProperty('--cyan', '#ffd700');
            document.body.style.setProperty('--cyan-dim', 'rgba(255,215,0,0.3)');
            document.body.style.setProperty('--cyan-glow', 'rgba(255,215,0,0.6)');
            speak('Cheat code activated. Welcome to the gold edition, Sir.');
            showToast('STARK GOLD EDITION UNLOCKED', 'warn');
            addLog('<<< KONAMI CODE ACTIVATED >>>', 'success');
            screenShake();
            triggerPowerSurge();
            setTimeout(() => {
                document.body.style.removeProperty('--cyan');
                document.body.style.removeProperty('--cyan-dim');
                document.body.style.removeProperty('--cyan-glow');
                if (themes[currentTheme] !== 'default') document.body.classList.add('theme-' + themes[currentTheme]);
            }, 10000);
        }
    } else { konamiIndex = 0; }
});
