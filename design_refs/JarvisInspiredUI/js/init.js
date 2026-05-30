// ==================== EXPANDED COMMANDS ====================
Object.assign(commands, {
    diag: () => { openDiagOverlay(); return 'Opening full diagnostic panel...'; },
    netinfo: () => `IP: ${realIP} | ISP: ${realISP} | ${realRegion} | ${realCoords}`,
    security: () => { runSecurityAudit(); return 'Running security audit...'; },
    integrity: () => {
        const hash = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
        $('integrity-hash').textContent = `SHA-512: ${hash.substring(0, 64)}`;
        addLog('Manual integrity hash generated', 'success');
        return `Hash: ${hash.substring(0, 32)}...`;
    },
    processes: () => {
        updateProcessList();
        return `${processes.length} active processes | Total CPU: ${processes.reduce((a, p) => a + p.cpuBase, 0)}% base`;
    },
    uptime: () => {
        if (!uptimeStart) return 'System not initialized';
        const s = Math.floor((Date.now() - uptimeStart) / 1000);
        return `Uptime: ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
    },
    health: () => { triggerHealthScan(); updateHealthMatrix(); return 'Health matrix refreshed — scanning subsystems...'; },
    autoscan: () => { runAutoDiagCycle(); return 'Triggering manual auto-diagnostic cycle...'; },
    ip: () => realIP,
    reboot: () => { speak('Rebooting all subsystems, Sir.'); location.reload(); return 'REBOOTING...'; },
    help: () => 'Commands: help, helpwalkthrough, status, time, weather, threat, scan, diag, netinfo, security, integrity, processes, uptime, health, autoscan, ip, theme [standard/combat/stealth/custom #hex], globe, lock, hum, surge, device, crypto, clock, export, exportconfig, importconfig, game, settings, notifications, open [site], search [query], calc [expr], timer [sec], memo [save/list/clear], remind [text] in [time], speak [text], reactor, reboot, clear',
    helpwalkthrough: () => { helpWalkthrough(); return 'Initiating full system walkthrough, Sir...'; },
    theme: () => 'Usage: theme standard, theme combat, theme stealth, or theme custom #hexcolor',
    globe: () => `SAT Tracker: 5 satellites online | Globe rotation active`,
    lock: () => {
        targetLockActive = !targetLockActive;
        const tl = $('target-lock');
        if (targetLockActive) { tl.classList.add('active'); tl.style.left = '50%'; tl.style.top = '50%'; addLog('TARGET LOCK ENGAGED', 'warn'); }
        else { tl.classList.remove('active'); addLog('Target lock disengaged', 'info'); }
        return targetLockActive ? 'TARGET LOCK: ENGAGED' : 'Target lock: disengaged';
    },
    hum: () => { startAmbientHum(); return 'Ambient reactor hum activated.'; },
    surge: () => { triggerPowerSurge(); screenShake(); return 'Power surge triggered!'; },
    device: () => { $('device-panel').classList.toggle('show'); return 'Device intelligence panel toggled.'; },
    crypto: () => `BTC: ${$('btc-price').textContent} | ETH: ${$('eth-price').textContent} | SOL: ${$('sol-price').textContent}`,
    clock: () => { $('wclock-panel').classList.toggle('show'); return 'World clock toggled.'; },
    export: () => { exportLog(); return 'System log exported.'; },
    youtube: () => { openURL('https://www.youtube.com', 'YouTube'); return 'Opening YouTube...'; },
    google: () => { openURL('https://www.google.com', 'Google'); return 'Opening Google...'; },
    github: () => { openURL('https://github.com', 'GitHub'); return 'Opening GitHub...'; },
    news: () => { openURL('https://news.google.com', 'Google News'); return 'Opening news...'; },
    maps: () => { openURL('https://www.google.com/maps', 'Google Maps'); return 'Opening maps...'; },
    game: () => { startBotGame(); return 'DEFENSE PROTOCOL: Launching bot elimination sequence...'; },
});

// ==================== SYSTEM INIT EXPANSIONS ====================
// Patch the original init click to also start advanced systems
const origInit = $('init-btn').onclick;
const origClickHandler = $('init-btn').getAttribute('data-inited');
// Add post-init hooks
function startAdvancedSystems() {
    uptimeStart = Date.now();
    setInterval(updateUptime, 1000);

    // Initialize reminder system
    initReminders();

    // Reveal new panels
    setTimeout(() => $('ml-panel').classList.add('show'), 1800);
    setTimeout(() => $('mr-panel').classList.add('show'), 2000);
    setTimeout(() => $('globe-panel').classList.add('show'), 2200);
    setTimeout(() => { $('hud-reticle').classList.add('active'); }, 2500);
    setTimeout(() => startAmbientHum(), 3000);

    // Initial data fetches
    setTimeout(() => fetchNetIntel(), 2500);
    setTimeout(() => checkConnectivity(), 4000);
    setTimeout(() => runSecurityAudit(), 6000);
    setTimeout(() => { updateProcessList(); updateHealthMatrix(); }, 3000);

    // Recurring cycles
    setInterval(() => { if (systemActive) fetchNetIntel(); }, 120000); // IP refresh every 2 min
    setInterval(() => { if (systemActive) checkConnectivity(); }, 30000); // Connectivity every 30s
    setInterval(() => { if (systemActive) runSecurityAudit(); }, 90000); // Security every 90s
    setInterval(() => { if (systemActive) { updateProcessList(); updateHealthMatrix(); } }, 5000);
    setInterval(() => { if (systemActive) runAutoDiagCycle(); }, 45000); // Auto diag every 45s
    setInterval(() => { if (systemActive) triggerHealthScan(); }, 60000); // Health scan animation every 60s
    setInterval(fetchWeather, 300000); // Weather refresh every 5 min

    // New advanced systems
    setTimeout(() => { $('device-panel').classList.add('show'); populateDeviceIntel(); }, 2800);
    setTimeout(() => { $('crypto-ticker').classList.add('show'); fetchCrypto(); }, 3200);
    setTimeout(() => { $('wclock-panel').classList.add('show'); updateWorldClock(); }, 3400);
    setInterval(() => { if (systemActive) fetchCrypto(); }, 120000); // Crypto every 2 min
    setInterval(() => { if (systemActive) updateWorldClock(); }, 1000); // World clock every second
}

// Hook into init button
const _origInitClick = $('init-btn').onclick;
$('init-btn').addEventListener('click', function postInitHook() {
    // Only run once
    this.removeEventListener('click', postInitHook);
    setTimeout(startAdvancedSystems, 800);
});

// ==================== SERVICE WORKER ====================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => {
        addLog('Service Worker registered', 'success');
    }).catch(() => {
        addLog('Service Worker registration failed', 'warn');
    });
    // Listen for offline fallback messages from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'OFFLINE_FALLBACK') {
            showToast('OFFLINE MODE — Using cached data', 'warn');
        }
    });
}

// ==================== SETTINGS PERSISTENCE ====================
const defaultSettings = {
    speech: false,
    theme: 'standard',
    voiceRate: 1.0,
    hum: false,
    proactive: true,
    verbose: false,
    autoscanInterval: 45
};

function loadSettings() {
    try {
        const raw = localStorage.getItem('jarvis_settings');
        if (raw) return Object.assign({}, defaultSettings, JSON.parse(raw));
    } catch { /* ignore */ }
    return Object.assign({}, defaultSettings);
}

function saveSettings(settings) {
    localStorage.setItem('jarvis_settings', JSON.stringify(settings));
}

function applySettings(settings) {
    // Speech
    speechEnabled = settings.speech;
    const stBtn = $('speech-toggle');
    if (stBtn) stBtn.classList.toggle('active', speechEnabled);

    // Theme
    if (settings.theme && settings.theme !== 'standard') {
        setTheme(settings.theme);
    }

    // Learning flags
    if (typeof JarvisLearning !== 'undefined') {
        JarvisLearning.flags.proactiveMode = settings.proactive;
        JarvisLearning.flags.verboseMode = settings.verbose;
    }

    // Sync UI controls
    const setSpeech = $('set-speech');
    const setThemeEl = $('set-theme');
    const setVoiceRate = $('set-voice-rate');
    const setVoiceRateVal = $('set-voice-rate-val');
    const setHum = $('set-hum');
    const setProactive = $('set-proactive');
    const setVerbose = $('set-verbose');
    const setAutoscan = $('set-autoscan');
    const setAutoscanVal = $('set-autoscan-val');

    if (setSpeech) setSpeech.checked = settings.speech;
    if (setThemeEl) setThemeEl.value = settings.theme;
    if (setVoiceRate) { setVoiceRate.value = settings.voiceRate; }
    if (setVoiceRateVal) setVoiceRateVal.textContent = settings.voiceRate;
    if (setHum) setHum.checked = settings.hum;
    if (setProactive) setProactive.checked = settings.proactive;
    if (setVerbose) setVerbose.checked = settings.verbose;
    if (setAutoscan) { setAutoscan.value = settings.autoscanInterval; }
    if (setAutoscanVal) setAutoscanVal.textContent = settings.autoscanInterval + 's';
}

function initSettingsPanel() {
    const settings = loadSettings();
    applySettings(settings);

    // Close button
    const closeBtn = $('settings-close');
    if (closeBtn) closeBtn.addEventListener('click', () => $('settings-panel').classList.remove('show'));

    // Wire up controls
    const setSpeech = $('set-speech');
    if (setSpeech) setSpeech.addEventListener('change', () => {
        const s = loadSettings(); s.speech = setSpeech.checked; saveSettings(s);
        speechEnabled = s.speech;
        $('speech-toggle').classList.toggle('active', speechEnabled);
    });

    const setThemeEl = $('set-theme');
    if (setThemeEl) setThemeEl.addEventListener('change', () => {
        const s = loadSettings(); s.theme = setThemeEl.value; saveSettings(s);
        setTheme(s.theme);
    });

    const setVoiceRate = $('set-voice-rate');
    if (setVoiceRate) setVoiceRate.addEventListener('input', () => {
        const s = loadSettings(); s.voiceRate = parseFloat(setVoiceRate.value); saveSettings(s);
        $('set-voice-rate-val').textContent = s.voiceRate.toFixed(1);
    });

    const setHum = $('set-hum');
    if (setHum) setHum.addEventListener('change', () => {
        const s = loadSettings(); s.hum = setHum.checked; saveSettings(s);
        if (s.hum) startAmbientHum();
    });

    const setProactive = $('set-proactive');
    if (setProactive) setProactive.addEventListener('change', () => {
        const s = loadSettings(); s.proactive = setProactive.checked; saveSettings(s);
        if (typeof JarvisLearning !== 'undefined') JarvisLearning.flags.proactiveMode = s.proactive;
    });

    const setVerbose = $('set-verbose');
    if (setVerbose) setVerbose.addEventListener('change', () => {
        const s = loadSettings(); s.verbose = setVerbose.checked; saveSettings(s);
        if (typeof JarvisLearning !== 'undefined') JarvisLearning.flags.verboseMode = s.verbose;
    });

    const setAutoscan = $('set-autoscan');
    if (setAutoscan) setAutoscan.addEventListener('input', () => {
        const s = loadSettings(); s.autoscanInterval = parseInt(setAutoscan.value); saveSettings(s);
        $('set-autoscan-val').textContent = s.autoscanInterval + 's';
    });
}

// Register settings command
commands.settings = () => {
    $('settings-panel').classList.toggle('show');
    return 'Settings panel toggled.';
};

// Register notifications command
commands.notifications = () => {
    const panel = $('notif-history-panel');
    panel.classList.toggle('show');
    const list = $('notif-history-list');
    list.innerHTML = '';
    const recent = notificationHistory.slice(-10).reverse();
    if (recent.length === 0) {
        list.innerHTML = '<div class="notif-history-item" style="opacity:0.4">No notifications yet.</div>';
        return 'No notifications recorded.';
    }
    recent.forEach(n => {
        const d = new Date(n.time);
        const ts = d.toLocaleTimeString('en-US', { hour12: false });
        const item = document.createElement('div');
        item.className = 'notif-history-item' + (n.type === 'warn' ? ' warn' : n.type === 'error' ? ' error' : '');
        item.innerHTML = '<span class="notif-time">[' + ts + ']</span>' + n.type.toUpperCase() + ': ' + n.text;
        list.appendChild(item);
    });
    const formatted = recent.map(n => {
        const d = new Date(n.time);
        const ts = d.toLocaleTimeString('en-US', { hour12: false });
        return '[' + ts + '] ' + n.type.toUpperCase() + ': ' + n.text;
    }).join(' | ');
    return formatted;
};

// ==================== CONFIG EXPORT & IMPORT ====================
commands.exportconfig = () => {
    const config = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('jarvis_')) {
            config[key] = localStorage.getItem(key);
        }
    }
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jarvis_config_' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    addLog('Configuration exported', 'success');
    showToast('Configuration exported', 'info');
    return 'Configuration exported to file.';
};

commands.importconfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                let imported = 0;
                for (const [key, value] of Object.entries(data)) {
                    if (key.startsWith('jarvis_')) {
                        localStorage.setItem(key, value);
                        imported++;
                    }
                }
                addLog('Configuration imported: ' + imported + ' keys', 'success');
                showToast('Configuration imported — reloading...', 'info');
                setTimeout(() => location.reload(), 2000);
            } catch {
                showToast('Invalid configuration file', 'error');
                addLog('Config import failed — invalid JSON', 'error');
            }
        };
        reader.readAsText(file);
        input.remove();
    });
    document.body.appendChild(input);
    input.click();
    return 'Select a configuration file to import...';
};

// Notification history panel close
const notifHistCloseBtn = $('notif-history-close');
if (notifHistCloseBtn) notifHistCloseBtn.addEventListener('click', () => $('notif-history-panel').classList.remove('show'));

// ==================== CLOSE APP BUTTON ====================
const closeAppBtn = $('close-app-btn');
if (closeAppBtn) {
    closeAppBtn.addEventListener('click', () => {
        if (window.jarvisElectron && window.jarvisElectron.isElectron) {
            speak('Goodbye, Sir. Shutting down.');
            setTimeout(() => window.jarvisElectron.closeApp(), 1500);
        } else {
            showToast('Close the browser tab to exit.', 'info');
        }
    });
}

// ==================== EXIT / QUIT COMMAND ====================
commands.exit = () => {
    if (window.jarvisElectron && window.jarvisElectron.isElectron) {
        speak('Powering down all systems. Goodbye, Sir.');
        addLog('SYSTEM SHUTDOWN INITIATED', 'warn');
        setTimeout(() => window.jarvisElectron.closeApp(), 2000);
        return 'Initiating shutdown sequence...';
    }
    return 'Close the browser tab to exit, Sir.';
};
commands.quit = commands.exit;
commands.close = commands.exit;

// ==================== LAUNCH COMMAND ====================
commands.launch = () => {
    return 'Usage: "open [app name]" — e.g. open notepad, open vscode, open control panel, open chrome, open file explorer, open task manager, open word, open calculator, etc.';
};

// Initialize settings on load
initSettingsPanel();

// ==================== INIT LOOPS ====================
setInterval(updateTime, 1000);
updateTime();
smoothStats();

// Load voices for speech synthesis
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
