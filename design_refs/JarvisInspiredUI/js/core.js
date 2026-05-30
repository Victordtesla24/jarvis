// ==================== VOICE SYNTHESIS ====================
function speak(text) {
    if (!speechEnabled) return;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.pitch = 0.85; u.volume = 0.7;
        // Use saved voice rate from settings
        try {
            const s = JSON.parse(localStorage.getItem('jarvis_settings') || '{}');
            u.rate = s.voiceRate || 1.0;
        } catch { u.rate = 1.0; }
        // Prefer a British/sophisticated voice
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.name.includes('Google UK English Male')) || voices.find(v => v.lang === 'en-GB') || voices[0];
        if (preferred) u.voice = preferred;
        window.speechSynthesis.speak(u);
    }
}

// ==================== TERMINAL BOOT ====================
function runTerminal() {
    const lines = [
        "> BINDING NEURAL INTERFACE...",
        "> QUANTUM CORE: STABLE",
        "> ENCRYPTION: AES-512 ACTIVE",
        "> CONNECTING STARK SAT-NET...",
        "> LOADING THREAT DB v24.7...",
        "> ARMOR SYSTEMS: STANDBY",
        "> HUD OVERLAY: ACTIVE",
        "> J.A.R.V.I.S. FULLY OPERATIONAL",
    ];
    const terminal = $('terminal-boot');
    let delay = 0;
    lines.forEach(line => {
        setTimeout(() => {
            const div = document.createElement('div');
            div.textContent = line;
            terminal.appendChild(div);
            terminal.scrollTop = terminal.scrollHeight;
        }, delay);
        delay += 600 + Math.random() * 400;
    });
}

// ==================== TIME & DATE ====================
function updateTime() {
    const now = new Date();
    const dateStr = now.getDate().toString().padStart(2, '0');
    $('big-date').innerText = dateStr;
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    $('time').innerText = timeStr;
    $('top-time').innerText = timeStr;

    const dd = dateStr, mm = (now.getMonth() + 1).toString().padStart(2, '0'), yyyy = now.getFullYear();
    $('full-date').innerText = `${dd}.${mm}.${yyyy}`;
    $('day').innerText = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

    const hour = now.getHours();
    let greeting = "GOOD EVENING, SIR";
    if (hour >= 5 && hour < 12) greeting = "GOOD MORNING, SIR";
    else if (hour >= 12 && hour < 17) greeting = "GOOD AFTERNOON, SIR";
    $('greeting').innerText = greeting;
}

// ==================== WEATHER ====================
function fetchWeather() {
    const lat = 28.2096, lon = 83.9856;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`;
    jarvisFetch(url).then(r => r.json()).then(data => {
        $('temp-big').innerText = `Temperature: ${Math.round(data.current.temperature_2m)}°C.`;
        $('humidity').innerText = ` Humidity: ${data.current.relative_humidity_2m}%.`;
        $('wind-speed').innerText = ` WIND: ${Math.round(data.current.wind_speed_10m)} km/h.`;
        $('weather-desc').innerText = 'STATUS: OPTIMAL';
        addLog('Environment data acquired', 'success');
    }).catch(() => {
        $('weather-desc').innerText = 'STATUS: OFFLINE';
        addLog('Weather API unreachable', 'warn');
    });
}

// ==================== SYSTEM STATS ====================
let targets = { cpu: 22, ram: 45, gpu: 52, net: 80, disk: 30 };
let current = { cpu: 0, ram: 0, gpu: 0, net: 0, disk: 0 };

function smoothStats() {
    for (const key in current) {
        current[key] += (targets[key] - current[key]) * 0.08;
    }
    const cpuV = Math.round(current.cpu);
    $('cpu-val').innerText = `${cpuV}%`;
    $('cpu-bar').style.width = `${current.cpu}%`;
    if (cpuV > 80) $('cpu-val').className = 'stat-value stat-critical';
    else if (cpuV > 60) $('cpu-val').className = 'stat-value stat-warning';
    else $('cpu-val').className = 'stat-value';

    $('ram-val').innerText = `${Math.round(current.ram)}%`;
    $('ram-bar').style.width = `${current.ram}%`;

    $('gpu-val').innerText = `${Math.round(current.gpu)}°C`;
    $('gpu-bar').style.width = `${(current.gpu / 100) * 100}%`;

    $('net-val').innerText = `${Math.round(current.net)} Mbps`;
    $('net-bar').style.width = `${(current.net / 500) * 100}%`;

    $('disk-val').innerText = `${Math.round(current.disk)} MB/s`;
    $('disk-bar').style.width = `${(current.disk / 200) * 100}%`;

    // Reactor output fluctuation
    const output = (3.2 + Math.sin(Date.now() / 2000) * 0.05).toFixed(2);
    $('reactor-output').innerText = `${output} GJ/s`;

    requestAnimationFrame(smoothStats);
}

setInterval(() => { targets.cpu = Math.floor(Math.random() * 40) + 12; }, 2500);
setInterval(() => { targets.ram = Math.floor(Math.random() * 15) + 38; }, 3500);
setInterval(() => { targets.gpu = Math.floor(Math.random() * 20) + 45; }, 4000);
setInterval(() => { targets.net = Math.floor(Math.random() * 300) + 20; }, 2000);
setInterval(() => { targets.disk = Math.floor(Math.random() * 150) + 10; }, 3000);

// ==================== BATTERY ====================
if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
        function updateBat() {
            const level = Math.round(battery.level * 100);
            $('bat-val').innerText = `${level}%`;
            $('bat-bar').style.width = `${level}%`;
            if (battery.charging) {
                $('bat-bar').style.background = 'linear-gradient(90deg,var(--green),#00ffaa)';
                $('bat-bar').style.boxShadow = '0 0 12px var(--green)';
            }
        }
        updateBat();
        battery.addEventListener('levelchange', updateBat);
        battery.addEventListener('chargingchange', updateBat);
    });
}

// ==================== SYSTEM LOG ====================
const logMessages = [
    { text: 'Firewall scan completed — no threats', type: 'info' },
    { text: 'Arc reactor output: nominal', type: 'success' },
    { text: 'Satellite ping: 12ms', type: 'info' },
    { text: 'Memory garbage collection cycle', type: 'info' },
    { text: 'Encrypted channel rotated — AES-512', type: 'success' },
    { text: 'Minor latency spike on node 7', type: 'warn' },
    { text: 'Biometric lock refresh', type: 'info' },
    { text: 'Threat DB signature update', type: 'info' },
    { text: 'Perimeter radar sweep: clear', type: 'success' },
    { text: 'Unauthorized access attempt — blocked', type: 'error' },
    { text: 'Neural net weight adjustment 0.002%', type: 'info' },
    { text: 'Power distribution optimized', type: 'success' },
    { text: 'Quantum entropy pool refreshed', type: 'info' },
    { text: 'Voice pattern bank updated', type: 'success' },
];

function addLog(text, type = 'info') {
    const container = $('log-container');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const now = new Date();
    const ts = now.toLocaleTimeString('en-US', { hour12: false });
    entry.innerHTML = `<span class="log-time">${ts}</span><span class="log-${type}">${text}</span>`;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
    // Limit entries
    while (container.children.length > 50) container.removeChild(container.firstChild);
}

function startSystemLog() {
    setInterval(() => {
        const msg = logMessages[Math.floor(Math.random() * logMessages.length)];
        addLog(msg.text, msg.type);
    }, 3000 + Math.random() * 4000);
}

// ==================== FPS COUNTER ====================
let fpsFrames = 0, fpsLast = performance.now();
function countFps() {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsLast >= 1000) {
        $('top-fps').innerText = `${fpsFrames} FPS`;
        fpsFrames = 0;
        fpsLast = now;
    }
    requestAnimationFrame(countFps);
}
countFps();

// ==================== NOTIFICATION TOASTS ====================
const notificationHistory = [];

function showToast(text, type = 'info') {
    // Record in history
    notificationHistory.push({ text, type, time: new Date().toISOString() });
    if (notificationHistory.length > 50) notificationHistory.shift();

    const container = $('notif-float');
    const toast = document.createElement('div');
    toast.className = `notif-toast ${type === 'warn' ? 'warn' : type === 'error' ? 'error' : ''}`;
    toast.textContent = text;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 5000);
    // Limit to 3
    while (container.children.length > 3) container.removeChild(container.firstChild);
}
