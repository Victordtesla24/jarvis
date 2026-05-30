// ==================== BOT SHOOTER GAME ENGINE ====================
(function initBotShooter() {
    const overlay = $('game-overlay');
    const gc = $('game-canvas');
    const gctx = gc.getContext('2d');
    const scoreEl = $('game-score');
    const waveEl = $('game-wave');
    const killsEl = $('game-kills');
    const hpEl = $('game-hp');
    const hpBar = $('game-hp-bar');
    const msgEl = $('game-msg');

    let gameActive = false, gameOver = false;
    let gScore = 0, gWave = 1, gKills = 0, gHP = 100;
    let bots = [], bullets = [], explosions = [], damageFlashes = [];
    let crosshair = { x: 0, y: 0 };
    let spawnTimer = 0, waveKillTarget = 0, waveKills = 0;
    let lastFrame = 0;

    function resizeGameCanvas() {
        gc.width = window.innerWidth;
        gc.height = window.innerHeight;
    }

    // --- Sound effects via Web Audio API ---
    function playShootSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const t = ctx.currentTime;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(1200, t);
            o.frequency.exponentialRampToValueAtTime(100, t + 0.15);
            g.gain.setValueAtTime(0.15, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            o.connect(g); g.connect(ctx.destination);
            o.start(t); o.stop(t + 0.2);
            const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
            const ns = ctx.createBufferSource(); ns.buffer = buf;
            const ng = ctx.createGain(); ng.gain.setValueAtTime(0.1, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            ns.connect(ng); ng.connect(ctx.destination); ns.start(t);
            setTimeout(() => ctx.close(), 300);
        } catch (e) { }
    }

    function playExplosionSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const t = ctx.currentTime;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(100, t);
            o.frequency.exponentialRampToValueAtTime(20, t + 0.4);
            g.gain.setValueAtTime(0.3, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            o.connect(g); g.connect(ctx.destination);
            o.start(t); o.stop(t + 0.4);
            const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
            const ns = ctx.createBufferSource(); ns.buffer = buf;
            const ng = ctx.createGain(); ng.gain.setValueAtTime(0.2, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 2000;
            ns.connect(filt); filt.connect(ng); ng.connect(ctx.destination); ns.start(t);
            setTimeout(() => ctx.close(), 500);
        } catch (e) { }
    }

    function playHitSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const t = ctx.currentTime;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'square';
            o.frequency.setValueAtTime(200, t);
            o.frequency.exponentialRampToValueAtTime(80, t + 0.15);
            g.gain.setValueAtTime(0.12, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            o.connect(g); g.connect(ctx.destination);
            o.start(t); o.stop(t + 0.15);
            setTimeout(() => ctx.close(), 250);
        } catch (e) { }
    }

    function playGameOverSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const t = ctx.currentTime;
            [400, 350, 300, 200].forEach((f, i) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'sine';
                o.frequency.value = f;
                g.gain.setValueAtTime(0.12, t + i * 0.3);
                g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.3 + 0.28);
                o.connect(g); g.connect(ctx.destination);
                o.start(t + i * 0.3); o.stop(t + i * 0.3 + 0.3);
            });
            setTimeout(() => ctx.close(), 1500);
        } catch (e) { }
    }

    // --- Bot class ---
    class Bot {
        constructor(wave) {
            this.size = 20 + Math.random() * 15;
            this.hp = 1 + Math.floor(wave / 3);
            this.maxHp = this.hp;
            this.speed = 0.5 + Math.random() * 1.0 + wave * 0.1;
            this.points = 10 * this.hp;
            this.angle = 0;
            this.pulsePhase = Math.random() * Math.PI * 2;
            const side = Math.floor(Math.random() * 4);
            if (side === 0) { this.x = Math.random() * gc.width; this.y = -this.size; }
            else if (side === 1) { this.x = gc.width + this.size; this.y = Math.random() * gc.height; }
            else if (side === 2) { this.x = Math.random() * gc.width; this.y = gc.height + this.size; }
            else { this.x = -this.size; this.y = Math.random() * gc.height; }
            const tx = gc.width * (0.2 + Math.random() * 0.6);
            const ty = gc.height * (0.2 + Math.random() * 0.6);
            const a = Math.atan2(ty - this.y, tx - this.x);
            this.vx = Math.cos(a) * this.speed;
            this.vy = Math.sin(a) * this.speed;
            this.canShoot = wave >= 3;
            this.shootTimer = 2 + Math.random() * 3;
            this.alive = true;
            this.flashTimer = 0;
            this.type = wave >= 5 && Math.random() > 0.7 ? 'heavy' : 'standard';
            if (this.type === 'heavy') { this.size *= 1.4; this.hp += 2; this.maxHp = this.hp; this.speed *= 0.7; this.points *= 2; }
        }

        update(dt) {
            this.x += this.vx * dt * 60;
            this.y += this.vy * dt * 60;
            this.angle += 0.02 * dt * 60;
            this.pulsePhase += 0.05 * dt * 60;
            if (this.flashTimer > 0) this.flashTimer -= dt;
            if (Math.random() < 0.005) {
                this.vx += (Math.random() - 0.5) * 0.5;
                this.vy += (Math.random() - 0.5) * 0.5;
            }
            if (this.x < -50 || this.x > gc.width + 50 || this.y < -50 || this.y > gc.height + 50) {
                const cx = gc.width / 2, cy = gc.height / 2;
                const a = Math.atan2(cy - this.y, cx - this.x);
                this.vx = Math.cos(a) * this.speed;
                this.vy = Math.sin(a) * this.speed;
            }
            if (this.canShoot) {
                this.shootTimer -= dt;
                if (this.shootTimer <= 0) {
                    this.shootTimer = 2 + Math.random() * 4;
                    const a = Math.atan2(gc.height / 2 - this.y, gc.width / 2 - this.x);
                    bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, enemy: true, life: 3 });
                }
            }
        }

        draw(ctx) {
            const pulse = 0.8 + Math.sin(this.pulsePhase) * 0.2;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            const color = this.type === 'heavy' ? '#ff003c' : '#ff6600';
            const glow = this.flashTimer > 0 ? '#ffffff' : color;

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i - Math.PI / 2;
                const r = this.size * pulse;
                const px = Math.cos(a) * r, py = Math.sin(a) * r;
                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.strokeStyle = glow;
            ctx.lineWidth = 2;
            ctx.shadowColor = glow;
            ctx.shadowBlur = 15;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.globalAlpha = 0.6 * pulse;
            ctx.fill();
            ctx.globalAlpha = 1;

            if (this.hp < this.maxHp) {
                ctx.rotate(-this.angle);
                const bw = this.size * 1.5;
                ctx.fillStyle = 'rgba(255,0,0,0.3)';
                ctx.fillRect(-bw / 2, -this.size - 12, bw, 4);
                ctx.fillStyle = '#ff003c';
                ctx.fillRect(-bw / 2, -this.size - 12, bw * (this.hp / this.maxHp), 4);
            }

            ctx.restore();
        }
    }

    // --- Explosion particles ---
    function spawnExplosion(x, y, color) {
        for (let i = 0; i < 20; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 1 + Math.random() * 4;
            explosions.push({
                x, y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: 0.5 + Math.random() * 0.5,
                maxLife: 0.5 + Math.random() * 0.5,
                size: 2 + Math.random() * 4,
                color: color || '#ff6600'
            });
        }
    }

    // --- Repulsor beam trail ---
    let beamTrails = [];

    // --- Start game ---
    window.startBotGame = function () {
        resizeGameCanvas();
        overlay.classList.add('active');
        gameActive = true;
        gameOver = false;
        gScore = 0; gWave = 1; gKills = 0; gHP = 100;
        bots = []; bullets = []; explosions = []; beamTrails = []; damageFlashes = [];
        spawnTimer = 0;
        waveKillTarget = 5;
        waveKills = 0;
        lastFrame = performance.now();
        updateGameHUD();
        showGameMsg('DEFENSE PROTOCOL ACTIVE', 2000);
        speak('Defense protocol engaged. Eliminate all hostiles, Sir.');
        addLog('BOT SHOOTER: Game started — Wave 1', 'warn');
        requestAnimationFrame(gameLoop);
    };

    function stopGame() {
        gameActive = false;
        overlay.classList.remove('active');
        addLog(`BOT SHOOTER: Game ended — Score: ${gScore}, Kills: ${gKills}, Wave: ${gWave}`, 'info');
    }

    function updateGameHUD() {
        scoreEl.textContent = gScore;
        waveEl.textContent = gWave;
        killsEl.textContent = gKills;
        hpEl.textContent = gHP + '%';
        hpBar.style.width = gHP + '%';
        const cls = gHP <= 25 ? 'critical' : gHP <= 50 ? 'low' : '';
        hpEl.className = 'game-hud-value health ' + cls;
        hpBar.className = 'game-health-fill ' + cls;
    }

    function showGameMsg(text, duration) {
        msgEl.textContent = text;
        msgEl.classList.add('show');
        setTimeout(() => msgEl.classList.remove('show'), duration || 2000);
    }

    // --- Click to shoot ---
    gc.addEventListener('mousemove', (e) => { crosshair.x = e.clientX; crosshair.y = e.clientY; });

    gc.addEventListener('click', (e) => {
        if (!gameActive || gameOver) return;
        const tx = e.clientX, ty = e.clientY;
        const sx = gc.width / 2, sy = gc.height - 40;
        const a = Math.atan2(ty - sy, tx - sx);
        bullets.push({
            x: sx, y: sy,
            vx: Math.cos(a) * 12,
            vy: Math.sin(a) * 12,
            enemy: false,
            life: 1.5
        });
        beamTrails.push({ sx, sy, ex: tx, ey: ty, life: 0.15 });
        playShootSound();
    });

    // ESC to exit
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && gameActive) {
            e.stopPropagation();
            stopGame();
            speak('Defense protocol disengaged.');
        }
        if (e.key === 'r' && gameActive && gameOver) {
            startBotGame();
        }
    });

    // --- Game loop ---
    function gameLoop(ts) {
        if (!gameActive) return;
        const dt = Math.min((ts - lastFrame) / 1000, 0.05);
        lastFrame = ts;

        gctx.clearRect(0, 0, gc.width, gc.height);
        drawGameGrid();

        if (!gameOver) {
            spawnTimer -= dt;
            if (spawnTimer <= 0 && bots.length < 8 + gWave * 2) {
                bots.push(new Bot(gWave));
                spawnTimer = Math.max(0.5, 2.5 - gWave * 0.15);
            }

            bots.forEach(b => b.update(dt));

            bullets.forEach(b => {
                b.x += b.vx * dt * 60;
                b.y += b.vy * dt * 60;
                b.life -= dt;
            });

            bullets.filter(b => !b.enemy).forEach(b => {
                bots.forEach(bot => {
                    if (!bot.alive) return;
                    const dx = b.x - bot.x, dy = b.y - bot.y;
                    if (Math.sqrt(dx * dx + dy * dy) < bot.size) {
                        bot.hp--;
                        bot.flashTimer = 0.1;
                        b.life = 0;
                        if (bot.hp <= 0) {
                            bot.alive = false;
                            gScore += bot.points;
                            gKills++;
                            waveKills++;
                            spawnExplosion(bot.x, bot.y, bot.type === 'heavy' ? '#ff003c' : '#ff6600');
                            playExplosionSound();
                        } else {
                            playHitSound();
                        }
                    }
                });
            });

            const px = gc.width / 2, py = gc.height / 2;
            bullets.filter(b => b.enemy).forEach(b => {
                const dx = b.x - px, dy = b.y - py;
                if (Math.sqrt(dx * dx + dy * dy) < 40) {
                    b.life = 0;
                    gHP = Math.max(0, gHP - (5 + Math.floor(gWave / 2)));
                    damageFlashes.push({ life: 0.3 });
                    playHitSound();
                    if (gHP <= 0) {
                        gameOver = true;
                        showGameMsg('SHIELD BREACH — SYSTEM FAILURE', 4000);
                        playGameOverSound();
                        speak(`Defense protocol failed. Final score: ${gScore}. ${gKills} hostiles eliminated. Press R to retry.`);
                    }
                }
            });

            bots = bots.filter(b => b.alive);
            bullets = bullets.filter(b => b.life > 0);

            if (waveKills >= waveKillTarget) {
                gWave++;
                waveKills = 0;
                waveKillTarget = 5 + gWave * 2;
                showGameMsg(`WAVE ${gWave}`, 1500);
                speak(`Wave ${gWave} incoming.`);
                gHP = Math.min(100, gHP + 15);
            }
        }

        explosions.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.96; p.vy *= 0.96;
            p.life -= dt;
        });
        explosions = explosions.filter(p => p.life > 0);

        beamTrails.forEach(b => b.life -= dt);
        beamTrails = beamTrails.filter(b => b.life > 0);

        damageFlashes.forEach(f => f.life -= dt);
        damageFlashes = damageFlashes.filter(f => f.life > 0);

        // --- DRAW ---
        beamTrails.forEach(b => {
            const alpha = b.life / 0.15;
            gctx.save();
            gctx.globalAlpha = alpha;
            const grad = gctx.createLinearGradient(b.sx, b.sy, b.ex, b.ey);
            grad.addColorStop(0, 'rgba(0, 212, 255, 0.8)');
            grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
            grad.addColorStop(1, 'rgba(0, 212, 255, 0.3)');
            gctx.strokeStyle = grad;
            gctx.lineWidth = 3;
            gctx.shadowColor = '#00d4ff';
            gctx.shadowBlur = 20;
            gctx.beginPath();
            gctx.moveTo(b.sx, b.sy);
            gctx.lineTo(b.ex, b.ey);
            gctx.stroke();
            gctx.strokeStyle = 'rgba(255,255,255,0.9)';
            gctx.lineWidth = 1;
            gctx.stroke();
            gctx.restore();
        });

        bots.forEach(b => b.draw(gctx));

        bullets.forEach(b => {
            gctx.save();
            if (b.enemy) {
                gctx.fillStyle = '#ff003c';
                gctx.shadowColor = '#ff003c';
            } else {
                gctx.fillStyle = '#00d4ff';
                gctx.shadowColor = '#00d4ff';
            }
            gctx.shadowBlur = 10;
            gctx.beginPath();
            gctx.arc(b.x, b.y, b.enemy ? 4 : 5, 0, Math.PI * 2);
            gctx.fill();
            gctx.restore();
        });

        explosions.forEach(p => {
            gctx.save();
            gctx.globalAlpha = p.life / p.maxLife;
            gctx.fillStyle = p.color;
            gctx.shadowColor = p.color;
            gctx.shadowBlur = 10;
            gctx.beginPath();
            gctx.arc(p.x, p.y, p.size * (1 - p.life / p.maxLife) + p.size, 0, Math.PI * 2);
            gctx.fill();
            gctx.restore();
        });

        drawPlayerIndicator();
        drawCrosshair();

        if (damageFlashes.length > 0) {
            gctx.save();
            gctx.fillStyle = 'rgba(255, 0, 60, 0.15)';
            gctx.fillRect(0, 0, gc.width, gc.height);
            gctx.restore();
        }

        if (gameOver) {
            gctx.save();
            gctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            gctx.fillRect(0, 0, gc.width, gc.height);
            gctx.fillStyle = '#ff003c';
            gctx.font = '16px Orbitron';
            gctx.textAlign = 'center';
            gctx.shadowColor = '#ff003c';
            gctx.shadowBlur = 20;
            gctx.fillText(`SCORE: ${gScore}  |  KILLS: ${gKills}  |  WAVE: ${gWave}`, gc.width / 2, gc.height / 2 + 50);
            gctx.fillStyle = 'rgba(255,255,255,0.4)';
            gctx.font = '12px Orbitron';
            gctx.fillText('PRESS R TO RETRY  |  ESC TO EXIT', gc.width / 2, gc.height / 2 + 80);
            gctx.restore();
        }

        updateGameHUD();
        requestAnimationFrame(gameLoop);
    }

    function drawGameGrid() {
        gctx.save();
        gctx.strokeStyle = 'rgba(0, 212, 255, 0.04)';
        gctx.lineWidth = 0.5;
        const spacing = 60;
        for (let x = 0; x < gc.width; x += spacing) {
            gctx.beginPath(); gctx.moveTo(x, 0); gctx.lineTo(x, gc.height); gctx.stroke();
        }
        for (let y = 0; y < gc.height; y += spacing) {
            gctx.beginPath(); gctx.moveTo(0, y); gctx.lineTo(gc.width, y); gctx.stroke();
        }
        gctx.restore();
    }

    function drawPlayerIndicator() {
        const x = gc.width / 2, y = gc.height - 40;
        gctx.save();
        const grad = gctx.createRadialGradient(x, y, 0, x, y, 30);
        grad.addColorStop(0, 'rgba(0, 212, 255, 0.4)');
        grad.addColorStop(1, 'rgba(0, 212, 255, 0)');
        gctx.fillStyle = grad;
        gctx.beginPath();
        gctx.arc(x, y, 30, 0, Math.PI * 2);
        gctx.fill();
        gctx.beginPath();
        gctx.moveTo(x, y - 18);
        gctx.lineTo(x - 12, y + 8);
        gctx.lineTo(x + 12, y + 8);
        gctx.closePath();
        gctx.strokeStyle = '#00d4ff';
        gctx.lineWidth = 2;
        gctx.shadowColor = '#00d4ff';
        gctx.shadowBlur = 15;
        gctx.stroke();
        gctx.beginPath();
        gctx.arc(x, y, 5, 0, Math.PI * 2);
        gctx.fillStyle = '#ffffff';
        gctx.fill();
        gctx.restore();
    }

    function drawCrosshair() {
        const cx = crosshair.x, cy = crosshair.y;
        gctx.save();
        gctx.strokeStyle = 'rgba(0, 212, 255, 0.7)';
        gctx.lineWidth = 1;
        gctx.shadowColor = '#00d4ff';
        gctx.shadowBlur = 10;
        gctx.beginPath();
        gctx.arc(cx, cy, 18, 0, Math.PI * 2);
        gctx.stroke();
        gctx.beginPath();
        gctx.arc(cx, cy, 2, 0, Math.PI * 2);
        gctx.fillStyle = '#00d4ff';
        gctx.fill();
        const gap = 8, len = 14;
        gctx.beginPath();
        gctx.moveTo(cx - len, cy); gctx.lineTo(cx - gap, cy);
        gctx.moveTo(cx + gap, cy); gctx.lineTo(cx + len, cy);
        gctx.moveTo(cx, cy - len); gctx.lineTo(cx, cy - gap);
        gctx.moveTo(cx, cy + gap); gctx.lineTo(cx, cy + len);
        gctx.stroke();
        gctx.restore();
    }

    window.addEventListener('resize', () => { if (gameActive) resizeGameCanvas(); });
})();
