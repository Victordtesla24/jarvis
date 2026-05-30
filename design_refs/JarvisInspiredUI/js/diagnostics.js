// ==================== NETWORK INTELLIGENCE ====================
const netHistory = new Array(60).fill(0);
const latencyHistory = new Array(60).fill(0);
let realIP = 'unknown', realISP = 'unknown', realRegion = 'unknown', realCoords = 'unknown';

async function fetchNetIntel() {
    try {
        const res = await jarvisFetch('https://ipapi.co/json/');
        const data = await res.json();
        realIP = data.ip || 'N/A';
        realISP = (data.org || 'N/A').substring(0, 18);
        realRegion = `${data.city || ''}, ${data.country_name || ''}`;
        if (realRegion.length > 20) realRegion = realRegion.substring(0, 18) + '..';
        realCoords = `${parseFloat(data.latitude).toFixed(2)}, ${parseFloat(data.longitude).toFixed(2)}`;
        $('ext-ip').textContent = realIP;
        $('isp-name').textContent = realISP;
        $('geo-region').textContent = realRegion;
        $('geo-coords').textContent = realCoords;
        $('dns-status').textContent = 'RESOLVED';
        $('dns-status').style.color = 'var(--green)';
        addLog(`Net Intel: IP ${realIP} | ${realRegion}`, 'success');
    } catch {
        $('ext-ip').textContent = 'OFFLINE';
        $('ext-ip').style.color = 'var(--red)';
        $('dns-status').textContent = 'FAILED';
        $('dns-status').style.color = 'var(--red)';
        addLog('Network intelligence fetch failed', 'error');
    }
}

// Connectivity / latency checker
const healthEndpoints = [
    'https://httpbin.org/get',
    'https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m',
    'https://ipapi.co/json/',
    'https://worldtimeapi.org/api/timezone/Etc/UTC',
];
async function checkConnectivity() {
    let up = 0;
    let totalLatency = 0;
    for (const url of healthEndpoints) {
        try {
            const start = performance.now();
            await jarvisFetch(url, { mode: 'cors', cache: 'no-store' }).then(r => r.ok);
            totalLatency += (performance.now() - start);
            up++;
        } catch { /* endpoint down */ }
    }
    const avgLat = up > 0 ? Math.round(totalLatency / up) : 999;
    $('ping-latency').textContent = `${avgLat} ms`;
    $('ping-latency').style.color = avgLat > 500 ? 'var(--red)' : avgLat > 200 ? 'var(--gold)' : 'var(--green)';
    $('endpoints-up').textContent = `${up}/${healthEndpoints.length}`;
    $('endpoints-up').style.color = up === healthEndpoints.length ? 'var(--green)' : up >= 2 ? 'var(--gold)' : 'var(--red)';

    // Update dot in top bar
    const nd = $('network-dot');
    nd.className = `status-dot ${up === healthEndpoints.length ? 'green' : up >= 2 ? 'gold' : 'red'}`;

    latencyHistory.push(avgLat); latencyHistory.shift();
    addLog(`Connectivity: ${up}/${healthEndpoints.length} endpoints | avg ${avgLat}ms`, up === healthEndpoints.length ? 'success' : 'warn');
}

// Sparklines
function drawSparkline(canvasId, data, maxVal, color = '0,212,255') {
    const canvas = $(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = 60;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width, h = canvas.height;
    const step = w / (data.length - 1);
    const max = maxVal || Math.max(...data, 1);

    // Fill area
    ctx.beginPath();
    ctx.moveTo(0, h);
    data.forEach((v, i) => ctx.lineTo(i * step, h - (v / max) * (h - 4)));
    ctx.lineTo(w, h); ctx.closePath();
    ctx.fillStyle = `rgba(${color},0.08)`; ctx.fill();

    // Line
    ctx.beginPath();
    data.forEach((v, i) => {
        const x = i * step, y = h - (v / max) * (h - 4);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = `rgba(${color},0.6)`; ctx.lineWidth = 1.5; ctx.stroke();

    // Latest value dot
    const last = data[data.length - 1];
    const lx = (data.length - 1) * step, ly = h - (last / max) * (h - 4);
    ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color},1)`; ctx.fill();
}

setInterval(() => {
    if (!systemActive) return;
    netHistory.push(Math.round(current.net)); netHistory.shift();
    drawSparkline('net-sparkline', netHistory, 500, '0,212,255');
    drawSparkline('latency-sparkline', latencyHistory, 600, '255,170,0');
}, 1000);

// ==================== SECURITY AUDIT ====================
const secChecks = ['sec-firewall', 'sec-ssl', 'sec-ports', 'sec-intrusion', 'sec-malware', 'sec-integrity'];
const secNames = ['Firewall', 'SSL/TLS', 'Port Scan', 'IDS', 'Malware DB', 'Data Integrity'];

async function runSecurityAudit() {
    addLog('Security audit initiated', 'info');
    for (let i = 0; i < secChecks.length; i++) {
        const el = $(secChecks[i]);
        el.className = 'sec-dot scanning';
        await sleep(600 + Math.random() * 800);
        // 90% pass, 8% warn, 2% fail
        const r = Math.random();
        if (r < 0.02) {
            el.className = 'sec-dot fail';
            addLog(`SECURITY: ${secNames[i]} — ALERT`, 'error');
        } else if (r < 0.10) {
            el.className = 'sec-dot warn';
            addLog(`SECURITY: ${secNames[i]} — advisory`, 'warn');
        } else {
            el.className = 'sec-dot ok';
        }
    }
    addLog('Security audit complete — system secure', 'success');
    // Generate fake integrity hash
    const hash = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
    $('integrity-hash').textContent = `SHA-512: ${hash.substring(0, 64)}`;
}

// ==================== PROCESS MONITOR ====================
const processes = [
    { name: 'jarvis_core.exe', cpuBase: 8, memBase: 320 },
    { name: 'neural_net.dll', cpuBase: 12, memBase: 890 },
    { name: 'arc_reactor_if', cpuBase: 3, memBase: 64 },
    { name: 'threat_engine', cpuBase: 5, memBase: 210 },
    { name: 'sat_uplink', cpuBase: 2, memBase: 48 },
    { name: 'encrypt_daemon', cpuBase: 4, memBase: 128 },
    { name: 'hud_render', cpuBase: 15, memBase: 450 },
    { name: 'voice_synth', cpuBase: 6, memBase: 180 },
    { name: 'radar_proc', cpuBase: 3, memBase: 96 },
    { name: 'integrity_chk', cpuBase: 1, memBase: 32 },
    { name: 'firewall_svc', cpuBase: 2, memBase: 56 },
    { name: 'data_stream', cpuBase: 7, memBase: 260 },
];

function updateProcessList() {
    const container = $('proc-list');
    container.innerHTML = '';
    // Header
    const header = document.createElement('div');
    header.className = 'proc-row';
    header.innerHTML = '<span class="proc-name" style="opacity:0.4">NAME</span><span class="proc-cpu" style="opacity:0.4">CPU</span><span class="proc-mem" style="opacity:0.4">MEM</span>';
    container.appendChild(header);

    processes.forEach(p => {
        const cpu = Math.max(0.1, p.cpuBase + (Math.random() - 0.5) * p.cpuBase * 0.6).toFixed(1);
        const mem = Math.round(p.memBase + (Math.random() - 0.5) * p.memBase * 0.2);
        const row = document.createElement('div');
        row.className = 'proc-row';
        const cpuColor = cpu > 15 ? 'var(--gold)' : 'var(--green)';
        row.innerHTML = `<span class="proc-name">${p.name}</span><span class="proc-cpu" style="color:${cpuColor}">${cpu}%</span><span class="proc-mem">${mem}M</span>`;
        container.appendChild(row);
    });
}

// ==================== HEALTH MATRIX ====================
const subsystems = [
    'CORE', 'NET', 'CRPT', 'THRT', 'SAT', 'HUD', 'VOIC', 'RADR',
    'STRG', 'PWR', 'COOL', 'SENS', 'AUTH', 'SCAN', 'SYNC', 'INTG'
];

function updateHealthMatrix() {
    const container = $('health-matrix');
    container.innerHTML = '';
    subsystems.forEach(name => {
        const cell = document.createElement('div');
        cell.className = 'health-cell';
        const r = Math.random();
        if (r < 0.03) { cell.classList.add('crit'); }
        else if (r < 0.10) { cell.classList.add('warn'); }
        else { cell.classList.add('ok'); }
        cell.textContent = name;
        container.appendChild(cell);
    });
}

// ==================== CIRCULAR GAUGES ====================
function drawGauge(canvasId, value, max, color) {
    const canvas = $(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 25, cy = 25, r = 20;
    ctx.clearRect(0, 0, 50, 50);

    // Background arc
    ctx.beginPath(); ctx.arc(cx, cy, r, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.strokeStyle = 'rgba(0,212,255,0.1)'; ctx.lineWidth = 4; ctx.stroke();

    // Value arc
    const pct = Math.min(value / max, 1);
    const endAngle = 0.75 * Math.PI + pct * 1.5 * Math.PI;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0.75 * Math.PI, endAngle);
    ctx.strokeStyle = color; ctx.lineWidth = 4;
    ctx.shadowColor = color; ctx.shadowBlur = 6;
    ctx.stroke(); ctx.shadowBlur = 0;

    // Center text
    ctx.fillStyle = '#fff'; ctx.font = '9px Share Tech Mono';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(value), cx, cy);
}

setInterval(() => {
    if (!systemActive) return;
    drawGauge('gauge-cpu', current.cpu, 100, current.cpu > 70 ? '#ff003c' : current.cpu > 50 ? '#ffaa00' : '#00ffcc');
    drawGauge('gauge-ram', current.ram, 100, current.ram > 80 ? '#ff003c' : '#00d4ff');
    drawGauge('gauge-temp', current.gpu, 100, current.gpu > 75 ? '#ff003c' : current.gpu > 60 ? '#ffaa00' : '#00ffcc');
}, 500);

// ==================== UPTIME COUNTER ====================
let uptimeStart = null;
function updateUptime() {
    if (!uptimeStart) return;
    const elapsed = Math.floor((Date.now() - uptimeStart) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    $('up-h').textContent = h.toString().padStart(2, '0');
    $('up-m').textContent = m.toString().padStart(2, '0');
    $('up-s').textContent = s.toString().padStart(2, '0');
}

// ==================== FULL DIAGNOSTIC SCAN ====================
const diagModules = [
    { name: 'CORE KERNEL', id: 'dg-kern' },
    { name: 'NEURAL NET', id: 'dg-nn' },
    { name: 'ARC REACTOR', id: 'dg-arc' },
    { name: 'ENCRYPTION', id: 'dg-enc' },
    { name: 'FIREWALL', id: 'dg-fw' },
    { name: 'SAT LINK', id: 'dg-sat' },
    { name: 'RADAR SYS', id: 'dg-rad' },
    { name: 'VOICE AI', id: 'dg-voice' },
    { name: 'DATA INTEG', id: 'dg-data' },
    { name: 'THREAT DB', id: 'dg-threat' },
    { name: 'HUD ENGINE', id: 'dg-hud' },
    { name: 'BIOMETRICS', id: 'dg-bio' },
];

function openDiagOverlay() {
    const overlay = $('diag-overlay');
    const grid = $('diag-grid');
    grid.innerHTML = '';
    diagModules.forEach(mod => {
        const cell = document.createElement('div');
        cell.className = 'diag-cell';
        cell.id = mod.id;
        cell.innerHTML = `<div class="diag-cell-label">${mod.name}</div><div class="diag-cell-value">PENDING</div><div class="scan-bar"></div>`;
        grid.appendChild(cell);
    });
    $('diag-progress').textContent = 'INITIALIZING SCAN...';
    overlay.classList.add('active');
    runDiagnosticScan();
}

async function runDiagnosticScan() {
    const total = diagModules.length;
    for (let i = 0; i < total; i++) {
        const cell = $(diagModules[i].id);
        cell.className = 'diag-cell scanning';
        cell.querySelector('.diag-cell-value').textContent = 'SCANNING...';
        $('diag-progress').textContent = `SCANNING ${diagModules[i].name}... (${i + 1}/${total})`;

        await sleep(800 + Math.random() * 600);

        const r = Math.random();
        if (r < 0.03) {
            cell.className = 'diag-cell fail';
            cell.querySelector('.diag-cell-value').textContent = 'CRITICAL';
            cell.querySelector('.diag-cell-value').style.color = 'var(--red)';
            addLog(`DIAG: ${diagModules[i].name} — CRITICAL FAILURE`, 'error');
        } else if (r < 0.12) {
            cell.className = 'diag-cell warn';
            cell.querySelector('.diag-cell-value').textContent = 'ADVISORY';
            cell.querySelector('.diag-cell-value').style.color = 'var(--gold)';
            addLog(`DIAG: ${diagModules[i].name} — advisory`, 'warn');
        } else {
            cell.className = 'diag-cell pass';
            cell.querySelector('.diag-cell-value').textContent = 'NOMINAL';
            cell.querySelector('.diag-cell-value').style.color = 'var(--green)';
        }
    }
    $('diag-progress').textContent = `SCAN COMPLETE — ${total} MODULES CHECKED`;
    addLog(`Full diagnostic complete: ${total} modules scanned`, 'success');
    speak('Diagnostic scan complete, Sir. All results are on screen.');
}

$('diag-close').addEventListener('click', () => {
    $('diag-overlay').classList.remove('active');
});

// ==================== AUTOMATED DIAGNOSTIC CYCLES ====================
// JARVIS runs these checks automatically in the background
let diagCycleCount = 0;
const autoDiagChecks = [
    { name: 'Memory Leak Scanner', fn: () => { const leak = Math.random() < 0.05; addLog(`Mem leak scan: ${leak ? 'LEAK DETECTED in neural_net.dll' : 'clean'}`, leak ? 'warn' : 'success'); return !leak; } },
    { name: 'Process Watchdog', fn: () => { const dead = Math.random() < 0.03; addLog(`Process watchdog: ${dead ? 'zombie process killed (PID ' + Math.floor(Math.random() * 9999) + ')' : 'all healthy'}`, dead ? 'warn' : 'info'); return !dead; } },
    { name: 'Disk Health (S.M.A.R.T.)', fn: () => { const bad = Math.random() < 0.02; addLog(`S.M.A.R.T. check: ${bad ? 'sector reallocation warning' : 'all drives nominal'}`, bad ? 'warn' : 'success'); return !bad; } },
    { name: 'Certificate Expiry', fn: () => { const days = Math.floor(Math.random() * 90) + 10; addLog(`SSL cert expires in ${days} days`, days < 30 ? 'warn' : 'info'); return days >= 30; } },
    { name: 'Entropy Pool', fn: () => { const entropy = Math.floor(Math.random() * 1000) + 3000; addLog(`Entropy pool: ${entropy} bits available`, entropy < 3200 ? 'warn' : 'success'); return entropy >= 3200; } },
    { name: 'DNS Resolution', fn: () => { const ms = Math.floor(Math.random() * 50) + 5; addLog(`DNS resolution: ${ms}ms avg`, ms > 40 ? 'warn' : 'info'); return ms <= 40; } },
    { name: 'Thermal Throttle Check', fn: () => { const throttle = current.gpu > 80; addLog(`Thermal: ${throttle ? 'THROTTLING ACTIVE' : 'within limits (' + Math.round(current.gpu) + '°C)'}`, throttle ? 'error' : 'success'); return !throttle; } },
    { name: 'Network Packet Loss', fn: () => { const loss = (Math.random() * 2).toFixed(1); addLog(`Packet loss: ${loss}%`, loss > 1 ? 'warn' : 'info'); return loss <= 1; } },
    { name: 'Authentication Token Refresh', fn: () => { addLog('Auth token rotated — SHA256 verified', 'success'); return true; } },
    { name: 'Backup Verification', fn: () => { const ok = Math.random() < 0.95; addLog(`Backup integrity: ${ok ? 'verified' : 'MISMATCH — re-syncing'}`, ok ? 'success' : 'error'); return ok; } },
];

async function runAutoDiagCycle() {
    if (!systemActive) return;
    diagCycleCount++;
    const indicator = $('scan-indicator');
    indicator.classList.add('active');

    // Pick 3-4 random checks each cycle
    const shuffled = [...autoDiagChecks].sort(() => Math.random() - 0.5);
    const batch = shuffled.slice(0, 3 + Math.floor(Math.random() * 2));

    addLog(`--- Auto-diagnostic cycle #${diagCycleCount} ---`, 'info');
    for (const check of batch) {
        $('scan-indicator-text').textContent = check.name.toUpperCase() + '...';
        await sleep(1200 + Math.random() * 800);
        check.fn();
    }

    // Also refresh process list, health matrix, gauges
    updateProcessList();
    updateHealthMatrix();

    indicator.classList.remove('active');
    addLog(`Auto-diagnostic cycle #${diagCycleCount} complete (${batch.length} checks)`, 'success');
}

// ==================== HEALTH SCANNING ANIMATION ====================
function triggerHealthScan() {
    const cells = qsa('.health-cell');
    cells.forEach((cell, i) => {
        setTimeout(() => {
            cell.classList.add('scanning-cell');
            setTimeout(() => cell.classList.remove('scanning-cell'), 1500);
        }, i * 100);
    });
}
