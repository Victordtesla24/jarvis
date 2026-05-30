// ==================== PARTICLE SYSTEM ====================
(function initParticles() {
    const canvas = $('particle-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    window.addEventListener('resize', () => { canvas.width = innerWidth; canvas.height = innerHeight; });

    const particles = [];
    for (let i = 0; i < 80; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 1.5 + 0.5,
            update() {
                this.x += this.vx;
                this.y += this.vy;
                if (this.x < 0) this.x = canvas.width;
                if (this.x > canvas.width) this.x = 0;
                if (this.y < 0) this.y = canvas.height;
                if (this.y > canvas.height) this.y = 0;
            },
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0,212,255,${0.15 + this.size * 0.1})`;
                ctx.fill();
            }
        });
    }

    function drawLines() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(0,212,255,${0.06 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        drawLines();
        requestAnimationFrame(animate);
    }
    animate();
})();

// ==================== ARC REACTOR (CANVAS) ====================
(function initReactor() {
    const canvas = $('reactor-canvas');
    const ctx = canvas.getContext('2d');
    const cx = 150, cy = 150;
    let angle = 0, corePhase = 0;
    let orbitals = [];
    for (let i = 0; i < 8; i++) {
        orbitals.push({ angle: (Math.PI * 2 / 8) * i, radius: 100 + Math.random() * 20, speed: 0.005 + Math.random() * 0.01, size: 2 + Math.random() * 2 });
    }

    function draw() {
        ctx.clearRect(0, 0, 300, 300);
        angle += 0.005;
        corePhase += 0.03;

        // Outer ring
        ctx.beginPath(); ctx.arc(cx, cy, 130, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,212,255,0.2)'; ctx.lineWidth = 2; ctx.stroke();

        // Rotating segments
        for (let i = 0; i < 12; i++) {
            const a = angle + (Math.PI * 2 / 12) * i;
            ctx.beginPath(); ctx.arc(cx, cy, 120, a, a + 0.3);
            ctx.strokeStyle = 'rgba(0,212,255,0.5)'; ctx.lineWidth = 4; ctx.stroke();
        }

        // Counter-rotating segments
        for (let i = 0; i < 8; i++) {
            const a = -angle * 1.5 + (Math.PI * 2 / 8) * i;
            ctx.beginPath(); ctx.arc(cx, cy, 100, a, a + 0.4);
            ctx.strokeStyle = 'rgba(0,212,255,0.35)'; ctx.lineWidth = 3; ctx.stroke();
        }

        // Inner dashed ring
        ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.arc(cx, cy, 75, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,212,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.setLineDash([]);

        // Coil lines
        for (let i = 0; i < 24; i++) {
            const a = (Math.PI * 2 / 24) * i;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * 55, cy + Math.sin(a) * 55);
            ctx.lineTo(cx + Math.cos(a) * 90, cy + Math.sin(a) * 90);
            ctx.strokeStyle = `rgba(0,212,255,${0.15 + 0.1 * Math.sin(angle * 5 + i)})`;
            ctx.lineWidth = 1.5; ctx.stroke();
        }

        // Orbiting particles
        orbitals.forEach(o => {
            o.angle += o.speed;
            const ox = cx + Math.cos(o.angle) * o.radius;
            const oy = cy + Math.sin(o.angle) * o.radius;
            ctx.beginPath(); ctx.arc(ox, oy, o.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,212,255,0.7)';
            ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 8;
            ctx.fill(); ctx.shadowBlur = 0;
        });

        // Inner ring glow
        ctx.beginPath(); ctx.arc(cx, cy, 50, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,212,255,0.6)'; ctx.lineWidth = 3; ctx.stroke();

        // Core
        const coreSize = 25 + Math.sin(corePhase) * 3;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, '#aaeeff');
        grad.addColorStop(0.7, 'rgba(0,212,255,0.6)');
        grad.addColorStop(1, 'rgba(0,212,255,0)');
        ctx.beginPath(); ctx.arc(cx, cy, coreSize, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 40;
        ctx.fill(); ctx.shadowBlur = 0;

        // Center dot
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();

        requestAnimationFrame(draw);
    }
    draw();
})();

// ==================== RADAR (CANVAS) ====================
const radarBlips = [];
(function initRadar() {
    const canvas = $('radar-canvas');
    const ctx = canvas.getContext('2d');
    const cx = 90, cy = 90, r = 80;
    let sweepAngle = 0;

    // Random blips
    for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 20 + Math.random() * 55;
        radarBlips.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, alpha: 0.8, decay: 0.003 + Math.random() * 0.005 });
    }

    function draw() {
        ctx.clearRect(0, 0, 180, 180);
        sweepAngle += 0.02;

        // Rings
        for (let i = 1; i <= 3; i++) {
            ctx.beginPath(); ctx.arc(cx, cy, (r / 3) * i, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,212,255,0.15)'; ctx.lineWidth = 0.5; ctx.stroke();
        }
        // Cross
        ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
        ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
        ctx.strokeStyle = 'rgba(0,212,255,0.1)'; ctx.lineWidth = 0.5; ctx.stroke();

        // Sweep
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, sweepAngle - 0.5, sweepAngle);
        ctx.closePath();
        const grad = ctx.createConicGradient(sweepAngle - 0.5, cx, cy);
        grad.addColorStop(0, 'rgba(0,212,255,0)');
        grad.addColorStop(1, 'rgba(0,212,255,0.4)');
        ctx.fillStyle = grad; ctx.fill();

        // Sweep line
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweepAngle) * r, cy + Math.sin(sweepAngle) * r);
        ctx.strokeStyle = 'rgba(0,212,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();

        // Blips
        radarBlips.forEach(b => {
            // Refresh blip when sweep passes over it
            const blipAngle = Math.atan2(b.y - cy, b.x - cx);
            const diff = ((sweepAngle % (Math.PI * 2)) - ((blipAngle + Math.PI * 2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            if (diff < 0.1 && diff > 0) b.alpha = 1;
            b.alpha = Math.max(0, b.alpha - b.decay);

            if (b.alpha > 0) {
                ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0,212,255,${b.alpha})`;
                ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 6;
                ctx.fill(); ctx.shadowBlur = 0;
            }
        });

        // Border
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,212,255,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();

        requestAnimationFrame(draw);
    }
    draw();
})();
$('radar-info').textContent = `TRACKING: ${radarBlips.length} OBJECTS`;
