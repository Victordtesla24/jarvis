// ==================== J.A.R.V.I.S. ADVANCED COMMANDS v3.0 ====================
// New command set: system diagnostics, real hardware, learning, automation

// ==================== SYSTEM REPORT PANEL ==========
function buildSystemReportPanel(data) {
    const panel = $('system-report-panel');
    if (!panel) return;
    const grid = $('system-report-grid');
    grid.innerHTML = '';

    data.checks.forEach(check => {
        const item = document.createElement('div');
        item.className = 'sys-report-item';
        const statusClass = check.status === 'ok' ? 'sys-ok' : check.status === 'warning' ? 'sys-warn' : check.status === 'critical' ? 'sys-crit' : 'sys-unknown';
        item.innerHTML = '<div class="sys-report-name">' + check.name + '</div>' +
            '<div class="sys-report-status ' + statusClass + '">' + check.status.toUpperCase() + '</div>' +
            '<div class="sys-report-detail">' + check.detail + '</div>';
        grid.appendChild(item);
    });

    $('system-report-summary').textContent =
        'PASSED: ' + data.passed + ' | WARNINGS: ' + data.warnings +
        ' | FAILURES: ' + data.failures + ' | TOTAL: ' + data.total;

    panel.classList.add('show');
}

// Close system report
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = $('system-report-close');
    if (closeBtn) closeBtn.addEventListener('click', () => {
        $('system-report-panel').classList.remove('show');
    });
});

// ==================== REGISTER ADVANCED COMMANDS ==========
Object.assign(commands, {

    // --- Real battery command ---
    battery: () => {
        if (!SystemMonitor.battery.supported) return 'Battery API not available — likely a desktop system, Sir.';
        return SystemMonitor.battery.getReport();
    },

    batterydetail: async () => {
        const report = SystemMonitor.battery.getDetailedReport();
        addLog('Battery detailed report generated', 'info');
        return report;
    },

    // --- Real network deep scan ---
    networkdetail: () => {
        return SystemMonitor.network.getDetailedReport();
    },

    // --- Real memory check ---
    memorycheck: () => {
        return SystemMonitor.memory.getReport();
    },

    memorydetail: () => {
        return SystemMonitor.memory.getDetailedReport();
    },

    // --- Storage analysis ---
    storagecheck: async () => {
        return await SystemMonitor.storage.getReport();
    },

    storagedetail: async () => {
        return await SystemMonitor.storage.getDetailedReport();
    },

    // --- GPU info ---
    gpuinfo: () => {
        return SystemMonitor.gpu.getReport();
    },

    gpudetail: () => {
        return SystemMonitor.gpu.getDetailedReport();
    },

    // --- Performance metrics ---
    perfcheck: () => {
        return SystemMonitor.performance.getReport();
    },

    perfdetail: () => {
        return SystemMonitor.performance.getDetailedReport();
    },

    // --- Permissions audit ---
    permissions: async () => {
        return await SystemMonitor.permissions.getReport();
    },

    // --- Media devices ---
    devices: async () => {
        return await SystemMonitor.media.getReport();
    },

    // --- Full system health check (the king command) ---
    systemcheck: async () => {
        addLog('Full system check initiated...', 'info');
        showToast('Running comprehensive system check...', 'warn');
        const result = await SystemMonitor.fullSystemCheck();
        buildSystemReportPanel(result);
        const status = result.failures > 0 ? 'ISSUES DETECTED' : result.warnings > 0 ? 'WARNINGS' : 'ALL CLEAR';
        addLog('System check complete: ' + status, result.failures > 0 ? 'error' : 'success');
        return 'System Check: ' + result.passed + ' passed, ' + result.warnings + ' warnings, ' + result.failures + ' failures — ' + status;
    },

    // --- What's working / what's not ---
    whatworks: async () => {
        const result = await SystemMonitor.fullSystemCheck();
        const working = result.checks.filter(c => c.status === 'ok').map(c => c.name);
        const issues = result.checks.filter(c => c.status !== 'ok' && c.status !== 'unknown').map(c => c.name + ' (' + c.status + ')');
        const unknown = result.checks.filter(c => c.status === 'unknown').map(c => c.name);
        let response = 'FUNCTIONING: ' + (working.length > 0 ? working.join(', ') : 'None confirmed');
        if (issues.length > 0) response += ' | ISSUES: ' + issues.join(', ');
        if (unknown.length > 0) response += ' | UNAVAILABLE: ' + unknown.join(', ');
        return response;
    },

    // --- User analytics ---
    mystats: () => {
        return JarvisLearning.getUserReport();
    },

    // --- Alias management ---
    alias: () => {
        return 'Usage: alias set [name] [command] | alias remove [name] | alias list';
    },

    // --- Toggle learning flags ---
    verbose: () => {
        JarvisLearning.flags.verboseMode = !JarvisLearning.flags.verboseMode;
        JarvisLearning.flags.quickMode = false;
        JarvisLearning.save();
        return 'Verbose mode: ' + (JarvisLearning.flags.verboseMode ? 'ON — I\'ll give detailed responses' : 'OFF');
    },

    brief: () => {
        JarvisLearning.flags.quickMode = !JarvisLearning.flags.quickMode;
        JarvisLearning.flags.verboseMode = false;
        JarvisLearning.save();
        return 'Brief mode: ' + (JarvisLearning.flags.quickMode ? 'ON — Short and to the point' : 'OFF');
    },

    proactive: () => {
        JarvisLearning.flags.proactiveMode = !JarvisLearning.flags.proactiveMode;
        JarvisLearning.save();
        return 'Proactive suggestions: ' + (JarvisLearning.flags.proactiveMode ? 'ON' : 'OFF');
    },

    // --- Geolocation ---
    locate: async () => {
        showToast('Requesting location...', 'info');
        return await SystemMonitor.geolocation.getReport();
    },

    // --- Tab/window awareness ---
    tabinfo: () => {
        const hidden = document.hidden ? 'HIDDEN' : 'VISIBLE';
        const focused = document.hasFocus() ? 'FOCUSED' : 'NOT FOCUSED';
        return 'Tab: ' + hidden + ' | Focus: ' + focused + ' | Title: ' + document.title;
    },

    // --- Screen info ---
    screeninfo: () => {
        const s = screen;
        const orient = s.orientation ? s.orientation.type : 'unknown';
        return 'Screen: ' + s.width + 'x' + s.height + ' | Available: ' + s.availWidth + 'x' + s.availHeight +
            ' | Orientation: ' + orient + ' | Pixel Ratio: ' + window.devicePixelRatio.toFixed(1) + 'x';
    },

    // --- Clipboard (read if permitted) ---
    clipboard: async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return 'Clipboard is empty.';
            const preview = text.length > 100 ? text.substring(0, 100) + '...' : text;
            return 'Clipboard (' + text.length + ' chars): ' + preview;
        } catch {
            return 'Clipboard access denied. Grant permission to use this feature.';
        }
    },

    // --- Color scheme detection ---
    colorscheme: () => {
        const dark = matchMedia('(prefers-color-scheme: dark)').matches;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const contrast = matchMedia('(prefers-contrast: more)').matches;
        return 'System: ' + (dark ? 'DARK MODE' : 'LIGHT MODE') +
            ' | Motion: ' + (reduced ? 'REDUCED' : 'NORMAL') +
            ' | Contrast: ' + (contrast ? 'HIGH' : 'NORMAL');
    },

    // --- Reset learning data ---
    resetlearning: () => {
        localStorage.removeItem(JarvisLearning.STORAGE_KEY);
        addLog('Learning data reset', 'warn');
        return 'All learning data has been cleared.';
    },

    // --- Comprehensive help for new commands ---
    helpadvanced: () => {
        return 'Advanced: battery, batterydetail, networkdetail, memorycheck, memorydetail, storagecheck, gpuinfo, gpudetail, perfcheck, perfdetail, permissions, devices, systemcheck, whatworks, mystats, alias [set/remove/list], verbose, brief, proactive, locate, tabinfo, screeninfo, clipboard, colorscheme, resetlearning, benchmark, whois [ip], speedtest';
    },
});

// ==================== ALIAS HANDLER ==========
function handleAlias(sub) {
    const parts = sub.trim().split(/\s+/);
    const action = parts[0] ? parts[0].toLowerCase() : '';

    if (action === 'set' && parts.length >= 3) {
        const alias = parts[1];
        const cmd = parts.slice(2).join(' ');
        return JarvisLearning.setAlias(alias, cmd);
    }
    if (action === 'remove' && parts.length >= 2) {
        return JarvisLearning.removeAlias(parts[1]);
    }
    if (action === 'list') {
        return JarvisLearning.listAliases();
    }
    return 'Usage: alias set [name] [command] | alias remove [name] | alias list';
}

// ==================== QUICK BENCHMARK ==========
commands.benchmark = () => {
    const iterations = 500000;
    // Math benchmark
    const mathStart = performance.now();
    let x = 0;
    for (let i = 0; i < iterations; i++) x += Math.sqrt(i) * Math.sin(i);
    const mathTime = (performance.now() - mathStart).toFixed(1);

    // String benchmark
    const strStart = performance.now();
    let s = '';
    for (let i = 0; i < 10000; i++) s += String.fromCharCode(65 + (i % 26));
    const strTime = (performance.now() - strStart).toFixed(1);

    // Array benchmark
    const arrStart = performance.now();
    const arr = [];
    for (let i = 0; i < 50000; i++) arr.push(Math.random());
    arr.sort();
    const arrTime = (performance.now() - arrStart).toFixed(1);

    const total = (parseFloat(mathTime) + parseFloat(strTime) + parseFloat(arrTime)).toFixed(1);
    addLog('Benchmark complete: ' + total + 'ms total', 'success');
    return 'Benchmark — Math: ' + mathTime + 'ms | String: ' + strTime + 'ms | Array Sort: ' + arrTime + 'ms | Total: ' + total + 'ms';
};

// ==================== WHOIS LOOKUP ==========
commands.whois = async () => {
    return 'Usage: whois [IP or domain]. Example: "whois 8.8.8.8"';
};

// ==================== SPEED TEST ==========
commands.speedtest = async () => {
    addLog('Speed test initiated...', 'info');
    showToast('Running speed test...', 'warn');
    try {
        // Download test — fetch a known public resource
        const dlStart = performance.now();
        const response = await jarvisFetch('https://httpbin.org/bytes/102400', { cache: 'no-store' });
        const blob = await response.blob();
        const dlTime = (performance.now() - dlStart) / 1000; // seconds
        const dlSize = blob.size / 1024; // KB
        const dlSpeed = ((dlSize * 8) / dlTime / 1024).toFixed(2); // Mbps

        // Latency test
        const latStart = performance.now();
        await jarvisFetch('https://httpbin.org/get', { cache: 'no-store' });
        const latency = Math.round(performance.now() - latStart);

        addLog('Speed test complete: ' + dlSpeed + ' Mbps down, ' + latency + 'ms latency', 'success');
        return 'Speed Test — Download: ~' + dlSpeed + ' Mbps | Latency: ' + latency + 'ms (Note: browser-based estimate)';
    } catch {
        return 'Speed test failed — network error or endpoint unreachable.';
    }
};

// ==================== UPDATE HELP COMMAND ==========
commands.help = () => {
    return 'Core: help, helpwalkthrough, helpadvanced, status, time, weather, threat, scan, diag, netinfo, security, integrity, processes, uptime, health, autoscan, ip, reboot, clear | ' +
        'System: battery, systemcheck, whatworks, memorycheck, gpuinfo, perfcheck, benchmark, speedtest, permissions, devices, locate, screeninfo, clipboard, colorscheme | ' +
        'Tools: open [site], search [query], calc [expr], timer [sec], memo [save/list/clear], speak [text], theme [standard/combat/stealth/custom #hex], export, exportconfig, importconfig, crypto, clock, globe, game, settings, notifications | ' +
        'AI: mystats, verbose, brief, proactive, alias [set/remove/list], resetlearning';
};

// ==================== ADD NL MAP ENTRIES FOR NEW COMMANDS ==========
Object.assign(nlMap, {
    'check battery': 'battery',
    'battery status': 'battery',
    'battery health': 'batterydetail',
    'battery level': 'battery',
    'power status': 'battery',
    'how much battery': 'battery',
    'is it charging': 'battery',
    'am i charging': 'battery',
    'check memory': 'memorycheck',
    'memory usage': 'memorycheck',
    'ram usage': 'memorycheck',
    'how much memory': 'memorycheck',
    'check storage': 'storagecheck',
    'disk space': 'storagecheck',
    'storage usage': 'storagecheck',
    'how much storage': 'storagecheck',
    'gpu info': 'gpuinfo',
    'graphics card': 'gpuinfo',
    'check gpu': 'gpuinfo',
    'what gpu': 'gpuinfo',
    'performance check': 'perfcheck',
    'page speed': 'perfcheck',
    'load time': 'perfcheck',
    'check performance': 'perfcheck',
    'check permissions': 'permissions',
    'permission status': 'permissions',
    'what devices': 'devices',
    'list devices': 'devices',
    'media devices': 'devices',
    'system check': 'systemcheck',
    'full check': 'systemcheck',
    'check everything': 'systemcheck',
    'diagnose system': 'systemcheck',
    'comprehensive scan': 'systemcheck',
    'is everything working': 'whatworks',
    'what is working': 'whatworks',
    'what works': 'whatworks',
    'what is broken': 'whatworks',
    'what is not working': 'whatworks',
    'what\'s broken': 'whatworks',
    'what\'s not working': 'whatworks',
    'my stats': 'mystats',
    'my statistics': 'mystats',
    'user stats': 'mystats',
    'show my data': 'mystats',
    'run benchmark': 'benchmark',
    'speed test': 'speedtest',
    'test speed': 'speedtest',
    'internet speed': 'speedtest',
    'check speed': 'speedtest',
    'where am i': 'locate',
    'my location': 'locate',
    'find me': 'locate',
    'screen info': 'screeninfo',
    'display info': 'screeninfo',
    'what\'s on clipboard': 'clipboard',
    'show clipboard': 'clipboard',
    'paste': 'clipboard',
    'dark mode': 'colorscheme',
    'color scheme': 'colorscheme',
    'advanced help': 'helpadvanced',
    'advanced commands': 'helpadvanced',
    'new commands': 'helpadvanced',
});

// ==================== ADD SUGGESTION MAP ENTRIES ==========
Object.assign(suggestionMap, {
    battery: [
        'Want a detailed battery health report?',
        'Shall I run a full system check?',
    ],
    systemcheck: [
        'Would you like to run a benchmark?',
        'Shall I check the battery separately?',
        'Want to see your usage stats?',
    ],
    memorycheck: [
        'Shall I check the storage as well?',
        'Want to run a full system check?',
    ],
    benchmark: [
        'Want me to run a speed test next?',
        'Shall I check GPU details?',
    ],
    speedtest: [
        'Want to check the network details?',
        'Shall I run a full system diagnosis?',
    ],
    whatworks: [
        'Shall I run a full system check for details?',
        'Want me to check the battery health?',
    ],
});

// NL map entries for new commands
Object.assign(nlMap, {
    'open settings': 'settings',
    'show settings': 'settings',
    'preferences': 'settings',
    'show notifications': 'notifications',
    'notification history': 'notifications',
    'recent notifications': 'notifications',
    'export config': 'exportconfig',
    'export configuration': 'exportconfig',
    'import config': 'importconfig',
    'import configuration': 'importconfig',
    'backup settings': 'exportconfig',
    'restore settings': 'importconfig',
    'close jarvis': 'exit',
    'shut down': 'exit',
    'power off': 'exit',
    'goodbye': 'exit',
    'quit jarvis': 'exit',
    'how to open apps': 'launch',
    'launch app': 'launch',
    'app launcher': 'launch',
});
