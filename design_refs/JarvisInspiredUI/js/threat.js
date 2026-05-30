// ==================== THREAT LEVEL (INTELLIGENT) ====================
// Threat score is calculated from real system signals, not random
let lastThreatLevel = 0;
let threatScore = 0;
let threatFactors = [];

function calculateThreatLevel() {
    let score = 0;
    const factors = [];

    // 1. CPU load (simulated but tracked)
    if (current.cpu > 85) { score += 3; factors.push('CPU CRITICAL >' + Math.round(current.cpu) + '%'); }
    else if (current.cpu > 70) { score += 1; factors.push('CPU HIGH ' + Math.round(current.cpu) + '%'); }

    // 2. GPU temperature
    if (current.gpu > 85) { score += 2; factors.push('GPU OVERHEAT ' + Math.round(current.gpu) + '°C'); }
    else if (current.gpu > 70) { score += 1; factors.push('GPU WARM ' + Math.round(current.gpu) + '°C'); }

    // 3. Connectivity — read from the DOM (set by checkConnectivity)
    const endpointsText = $('endpoints-up') ? $('endpoints-up').textContent : '4/4';
    const endpointsUp = parseInt(endpointsText) || 4;
    if (endpointsUp <= 1) { score += 4; factors.push('NETWORK CRITICAL: ' + endpointsUp + '/4 ENDPOINTS'); }
    else if (endpointsUp <= 2) { score += 2; factors.push('NETWORK DEGRADED: ' + endpointsUp + '/4 ENDPOINTS'); }
    else if (endpointsUp <= 3) { score += 1; factors.push('ENDPOINT DOWN: ' + endpointsUp + '/4'); }

    // 4. Latency
    const latencyText = $('ping-latency') ? $('ping-latency').textContent : '0';
    const latency = parseInt(latencyText) || 0;
    if (latency > 500) { score += 3; factors.push('LATENCY SPIKE: ' + latency + 'ms'); }
    else if (latency > 300) { score += 1; factors.push('LATENCY ELEVATED: ' + latency + 'ms'); }

    // 5. Security audit — count failures/warnings from last scan
    const secDots = qsa('.sec-dot');
    let secFails = 0, secWarns = 0;
    secDots.forEach(d => {
        if (d.classList.contains('fail')) secFails++;
        if (d.classList.contains('warn')) secWarns++;
    });
    if (secFails > 0) { score += 3; factors.push('SECURITY BREACH: ' + secFails + ' FAILURE(S)'); }
    if (secWarns > 0) { score += 1; factors.push('SECURITY ADVISORY: ' + secWarns + ' WARNING(S)'); }

    // 6. Battery
    const batText = $('bat-val') ? $('bat-val').textContent : '100%';
    const batLevel = parseInt(batText) || 100;
    if (batLevel < 10) { score += 3; factors.push('POWER CRITICAL: ' + batLevel + '%'); }
    else if (batLevel < 20) { score += 1; factors.push('POWER LOW: ' + batLevel + '%'); }

    // 7. Health matrix — count critical cells
    const critCells = qsa('.health-cell.crit').length;
    const warnCells = qsa('.health-cell.warn').length;
    if (critCells > 0) { score += 2; factors.push('SUBSYSTEM CRITICAL: ' + critCells + ' MODULE(S)'); }
    if (warnCells > 2) { score += 1; factors.push('SUBSYSTEM WARNINGS: ' + warnCells); }

    // 8. Online status
    if (!navigator.onLine) { score += 4; factors.push('NETWORK OFFLINE'); }

    // 9. Random environmental noise (small jitter to keep it interesting)
    const noise = Math.random();
    if (noise > 0.92) { score += 2; factors.push('ANOMALOUS RF SIGNAL'); }
    else if (noise > 0.85) { score += 1; factors.push('MINOR EM INTERFERENCE'); }

    // Map score to level: 0-1 = MINIMAL, 2-3 = GUARDED, 4-6 = ELEVATED, 7+ = HIGH
    let level;
    if (score >= 7) level = 3;       // HIGH
    else if (score >= 4) level = 2;  // ELEVATED
    else if (score >= 2) level = 1;  // GUARDED
    else level = 0;                  // MINIMAL

    threatScore = score;
    threatFactors = factors;
    return level;
}

setInterval(() => {
    if (!systemActive) return;
    const level = calculateThreatLevel();
    const bars = qsa('.threat-bar');
    const labels = ['MINIMAL', 'GUARDED', 'ELEVATED', 'HIGH'];
    const classes = ['active-green', 'active-green', 'active-gold', 'active-red'];
    bars.forEach((b, i) => {
        b.className = 'threat-bar';
        if (i <= level * 2 + 1) b.classList.add(classes[Math.min(Math.floor(i / 3), 3)] || 'active-green');
    });
    $('threat-label').innerText = `LEVEL: ${labels[level]}`;
    $('threat-label').style.color = level >= 3 ? 'var(--red)' : level >= 2 ? 'var(--gold)' : 'var(--cyan)';

    // Log factors when elevated or higher
    if (level >= 2 && threatFactors.length > 0) {
        addLog(`Threat ${labels[level]} [score:${threatScore}] — ${threatFactors[0]}`, level >= 3 ? 'error' : 'warn');
    }

    // Trigger impact sounds on escalation (commented out)
    // if (level >= 2 && level > lastThreatLevel) {
    //     if (level === 3) {
    //         playThreatImpact('high');
    //     } else if (level === 2) {
    //         playThreatImpact('elevated');
    //     }
    // }
    lastThreatLevel = level;
}, 8000);

// ==================== CRITICAL ALERT SYSTEM ====================
// When threat goes HIGH, trigger shake + surge + impact sound (sounds commented out)
setInterval(() => {
    if (!systemActive) return;
    const label = $('threat-label');
    if (label && label.textContent.includes('HIGH')) {
        screenShake();
        triggerPowerSurge();
        // playThreatImpact('high');
        showToast('THREAT LEVEL ELEVATED — ACTIVATING COUNTERMEASURES', 'error');
    }
}, 9000);

// ==================== THREAT IMPACT SOUND ENGINE (DISABLED) ====================
// Synthesized collision/alarm sounds using Web Audio API -- no external files
/* --- Threat sounds commented out ---*/
function playThreatImpact(severity) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const now = ctx.currentTime;

        if (severity === 'high') {
            // --- HIGH THREAT: heavy collision impact + alarm siren ---

            // Layer 1: Deep sub-bass impact (the "hit")
            const impactOsc = ctx.createOscillator();
            const impactGain = ctx.createGain();
            impactOsc.type = 'sine';
            impactOsc.frequency.setValueAtTime(80, now);
            impactOsc.frequency.exponentialRampToValueAtTime(20, now + 0.4);
            impactGain.gain.setValueAtTime(0.5, now);
            impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            impactOsc.connect(impactGain);
            impactGain.connect(ctx.destination);
            impactOsc.start(now);
            impactOsc.stop(now + 0.5);

            // Layer 2: Noise burst (the "crash/crunch")
            const bufferSize = ctx.sampleRate * 0.3;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            }
            const noiseSource = ctx.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.35, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(3000, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.3);
            noiseSource.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noiseSource.start(now);

            // Layer 3: Alarm siren sweep (two-tone)
            const sirenOsc = ctx.createOscillator();
            const sirenGain = ctx.createGain();
            sirenOsc.type = 'square';
            sirenGain.gain.setValueAtTime(0, now + 0.3);
            sirenGain.gain.linearRampToValueAtTime(0.08, now + 0.5);
            sirenGain.gain.setValueAtTime(0.08, now + 1.8);
            sirenGain.gain.linearRampToValueAtTime(0, now + 2.0);
            // Two-tone siren pattern
            for (let t = 0; t < 4; t++) {
                sirenOsc.frequency.setValueAtTime(800, now + 0.3 + t * 0.4);
                sirenOsc.frequency.setValueAtTime(600, now + 0.5 + t * 0.4);
            }
            sirenOsc.connect(sirenGain);
            sirenGain.connect(ctx.destination);
            sirenOsc.start(now + 0.3);
            sirenOsc.stop(now + 2.0);

            // Layer 4: Metal clang resonance
            const clangOsc = ctx.createOscillator();
            const clangGain = ctx.createGain();
            clangOsc.type = 'triangle';
            clangOsc.frequency.setValueAtTime(440, now);
            clangOsc.frequency.exponentialRampToValueAtTime(120, now + 0.6);
            clangGain.gain.setValueAtTime(0.2, now);
            clangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            clangOsc.connect(clangGain);
            clangGain.connect(ctx.destination);
            clangOsc.start(now);
            clangOsc.stop(now + 0.6);

            // Clean up audio context after sounds finish
            setTimeout(() => ctx.close(), 2500);

        } else if (severity === 'elevated') {
            // --- ELEVATED: lighter warning "pulse" ---

            // Short descending tone
            const warnOsc = ctx.createOscillator();
            const warnGain = ctx.createGain();
            warnOsc.type = 'sine';
            warnOsc.frequency.setValueAtTime(600, now);
            warnOsc.frequency.exponentialRampToValueAtTime(300, now + 0.25);
            warnGain.gain.setValueAtTime(0.15, now);
            warnGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            warnOsc.connect(warnGain);
            warnGain.connect(ctx.destination);
            warnOsc.start(now);
            warnOsc.stop(now + 0.3);

            // Second pulse
            const warn2 = ctx.createOscillator();
            const warn2Gain = ctx.createGain();
            warn2.type = 'sine';
            warn2.frequency.setValueAtTime(500, now + 0.35);
            warn2.frequency.exponentialRampToValueAtTime(250, now + 0.6);
            warn2Gain.gain.setValueAtTime(0.12, now + 0.35);
            warn2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            warn2.connect(warn2Gain);
            warn2Gain.connect(ctx.destination);
            warn2.start(now + 0.35);
            warn2.stop(now + 0.6);

            setTimeout(() => ctx.close(), 1000);
        }
    } catch (e) { }
}
