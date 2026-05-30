// ==================== BOOT SEQUENCE ====================
const bootStages = [
    { text: "[OK] Kernel v7.4.1 loaded", delay: 400 },
    { text: "[OK] Quantum encryption handshake", delay: 600 },
    { text: "[OK] Neural network calibration", delay: 500 },
    { text: "[OK] Stark Industries satellite uplink", delay: 700 },
    { text: "[OK] Biometric authentication passed", delay: 400 },
    { text: "[!!] Minor latency on node 7 — compensating", delay: 800, warn: true },
    { text: "[OK] Arc reactor interface synced", delay: 500 },
    { text: "[OK] Threat assessment module online", delay: 600 },
    { text: "[OK] Voice recognition calibrated", delay: 400 },
    { text: "[OK] HUD subsystems initialized", delay: 500 },
    { text: "[OK] J.A.R.V.I.S. MARK VII — READY", delay: 300 },
];

let bootIndex = 0, bootProgress = 0;
function runBoot() {
    if (bootIndex >= bootStages.length) {
        $('init-btn').classList.add('ready');
        return;
    }
    const stage = bootStages[bootIndex];
    bootProgress = ((bootIndex + 1) / bootStages.length) * 100;
    $('boot-bar').style.width = bootProgress + '%';

    const line = document.createElement('div');
    line.className = 'boot-stage-line' + (stage.warn ? ' error' : '');
    line.textContent = stage.text;
    $('boot-stages').appendChild(line);
    requestAnimationFrame(() => line.classList.add('visible'));
    $('boot-stages').scrollTop = $('boot-stages').scrollHeight;

    bootIndex++;
    setTimeout(runBoot, stage.delay);
}
setTimeout(runBoot, 1800);

// ==================== SYSTEM INIT ====================
$('init-btn').addEventListener('click', function () {
    if (!this.classList.contains('ready')) return;
    systemActive = true;

    // Fade out boot screen
    $('init-screen').style.transition = 'opacity 0.8s';
    $('init-screen').style.opacity = '0';
    setTimeout(() => $('init-screen').style.display = 'none', 800);

    $('power-up-sound').play().catch(() => { });
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { });

    // Staggered panel reveals
    setTimeout(() => $('top-bar').classList.add('show'), 200);
    setTimeout(() => { $('left-panel').classList.add('show'); }, 400);
    setTimeout(() => { $('right-panel').classList.add('show'); }, 600);
    setTimeout(() => { $('center-panel').classList.add('show'); }, 800);
    setTimeout(() => { $('bl-panel').classList.add('show'); }, 1000);
    setTimeout(() => { $('br-panel').classList.add('show'); }, 1200);
    setTimeout(() => { $('command-bar').classList.add('show'); $('key-hint').classList.add('show'); }, 1400);
    setTimeout(() => qsa('.hud-corner').forEach(c => c.classList.add('show')), 300);
    setTimeout(() => $('audio-canvas').classList.add('show'), 1600);

    // Generate threat bars
    const threatContainer = $('threat-bars');
    for (let i = 0; i < 10; i++) {
        const bar = document.createElement('div');
        bar.className = 'threat-bar';
        if (i < 2) bar.classList.add('active-green');
        threatContainer.appendChild(bar);
    }

    fetchWeather();
    runTerminal();
    startSystemLog();

    // Voice greeting
    setTimeout(() => {
        const hour = new Date().getHours();
        let g = "Good evening, Sir. All systems are online and operating within normal parameters.";
        if (hour >= 5 && hour < 12) g = "Good morning, Sir. All systems initialized. Ready for your command.";
        else if (hour >= 12 && hour < 17) g = "Good afternoon, Sir. Systems nominal. Awaiting instructions.";
        speak(g);
        showToast(g, 'info');
    }, 1500);
});
