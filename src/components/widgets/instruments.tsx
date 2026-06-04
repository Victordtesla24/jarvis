import React, { useMemo, useRef } from 'react';
import HudCanvas, { DrawFn } from './HudCanvas';
import { moodColor, rgba, follow, RGB, TAU, clamp01, energyOf, glowStroke, plotGrid, baselineDots } from './shared';

// ── The instrument deck ──────────────────────────────────────────────────────
// Ten high-value HUD instruments. Each reads THREE live sources every frame:
//   • the operator's HANDS      (d.sig — gesture signals, idle/null when camera-free)
//   • the J.A.R.V.I.S. agent     (d.a  — mood / intensity / activity / highlight / tps)
//   • the MACHINE's telemetry    (d.tel — battery / cpu cores+load / heap / network / fps / …)
// so every panel shows GENUINE real-time stats (not synthetic noise) while the agent's
// mood only shifts the accent (alert→red, success→green). Cyan holographic identity is
// the bed; non-cyan appears only as discrete events (fault cell, low-battery, offline).
// Re-sourced from the reference reel youtu.be/yXpkIrR81w8 (0:54–0:59 reserves, 1:07–1:11
// power-distribution flow, 1:30–1:32 multi-graph wall).

// per-core load helper: real aggregate cpuLoad spread across real core count (synthesized
// spread, honest aggregate). Falls back to the aggregate when perCore isn't ready.
const coreAt = (tel: { perCore: number[]; cpuLoad: number }, i: number) =>
  tel.perCore.length ? tel.perCore[i % tel.perCore.length] : tel.cpuLoad;

// ── 1. PROXIMITY RADAR — per-core load swept as proximity blips ───────────────
export const RadarSweep: React.FC = () => {
  // 16 ring slots (golden-angle spiral); each maps to a logical core, lit by its load.
  const slots = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    ang: (i * 2.39996) % TAU, r: 0.30 + (i / 16) * 0.62,
  })), []);
  const st = useRef({ sweep: 0, ping: -1, lastPulse: 0, range: 1 });
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const cx = w / 2, cy = h / 2 + 4, R = Math.min(w, h) / 2 - 10;
    const s = st.current;
    // range ring scale follows network latency (worse rtt = tighter usable range)
    s.range = follow(s.range, 0.6 + clamp01(1 - tel.rttMs / 300) * 0.4, 0.05);
    s.sweep = (s.sweep + d.dt * (0.5 + tel.cpuLoad * 1.1 + e * 0.6)) % TAU;  // RPM ∝ cpu load
    if (a.alertPulse !== s.lastPulse) { s.ping = 0; s.lastPulse = a.alertPulse; }

    ctx.shadowBlur = 0; ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, R * k / 3, 0, TAU); ctx.strokeStyle = rgba(c, 0.18); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.strokeStyle = rgba(c, 0.12); ctx.stroke();

    // sweep wedge (trailing conic gradient)
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-s.sweep);
    const grad = ctx.createConicGradient ? ctx.createConicGradient(0, 0, 0) : null;
    if (grad) { grad.addColorStop(0, rgba(c, 0.32)); grad.addColorStop(0.12, rgba(c, 0)); grad.addColorStop(1, rgba(c, 0)); ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); }
    glowStroke(ctx, c, 8, 1.5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R, 0); ctx.stroke();
    ctx.restore(); ctx.shadowBlur = 0;

    // one blip per logical core; brightness = that core's load; sweep re-lights them
    for (let i = 0; i < slots.length && i < tel.cores; i++) {
      const b = slots[i]; const load = coreAt(tel, i);
      const rr = b.r * s.range; if (rr > 1) continue;
      if (!tel.online && i % 3 === 0) continue;             // offline → sparser field
      const ba = (TAU - b.ang) % TAU;
      const da = (s.sweep - ba + TAU) % TAU;
      const lit = Math.max(0, 1 - da / 0.9);
      const bx = cx + Math.cos(b.ang) * R * rr, by = cy + Math.sin(b.ang) * R * rr;
      const on = (0.25 + load * 0.75) * (0.35 + lit * 0.65);
      ctx.beginPath(); ctx.arc(bx, by, 1.3 + load * 2.2 + lit * 1.5, 0, TAU);
      ctx.fillStyle = rgba(c, 0.2 + on * 0.7); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = on * 12; ctx.fill();
    }
    ctx.shadowBlur = 0;

    // ping ring — fired on an agent alert
    if (s.ping >= 0) { s.ping += d.dt * 0.9; const p = s.ping; if (p > 1) s.ping = -1; else { ctx.beginPath(); ctx.arc(cx, cy, R * p, 0, TAU); ctx.strokeStyle = rgba(c, (1 - p) * 0.8); ctx.lineWidth = 2; ctx.shadowColor = rgba(c, 0.8); ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0; } }
  };
  return <HudCanvas title="PROXIMITY RADAR" code="RDR-01" draw={draw} height={150} />;
};

// ── 2. VOICE / WAVEFORM — frame-time carrier + agent voice ───────────────────
export const WaveformMonitor: React.FC = () => {
  const st = useRef({ amp: 0.4, freq: 2, phase: 0 });
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const s = st.current;
    const speaking = a.activity === 'speaking' ? 1 : 0;
    s.amp = follow(s.amp, 0.22 + tel.cpuLoad * 0.5 + speaking * 0.25, 0.08);      // amplitude ∝ cpu load
    s.freq = follow(s.freq, 1.2 + clamp01(tel.fps / Math.max(30, tel.refreshHz)) * 4, 0.06); // smoother fps → higher, cleaner carrier
    s.phase += d.dt * (2 + e * 5 + speaking * 4);
    const jank = clamp01((tel.frameBudgetMs ? (tel.frameMs - tel.frameBudgetMs) / tel.frameBudgetMs : 0)); // ragged when frames drop
    const midY = h / 2;
    ctx.strokeStyle = rgba(c, 0.10); ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += w / 6) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.strokeStyle = rgba(c, 0.18); ctx.stroke();
    glowStroke(ctx, c, 9, 1.8); ctx.beginPath();
    const A = s.amp * (h / 2 - 6);
    for (let x = 0; x <= w; x += 2) {
      const u = x / w;
      const env = Math.sin(u * Math.PI);
      const y = midY - env * A * (
        Math.sin(u * s.freq * TAU + s.phase) * 0.7
        + Math.sin(u * s.freq * 2.3 * TAU - s.phase * 1.3) * 0.3
        + (speaking ? Math.sin(u * 60 + s.phase * 9) * 0.12 : 0)
        + jank * Math.sin(u * 110 + s.phase * 13) * 0.18                          // frame-jank ripple
        + tel.pointerActivity * Math.sin(u * 38 - s.phase * 6) * 0.10);           // operator-presence jitter
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    const sx = (s.phase * 30) % w;
    ctx.beginPath(); ctx.arc(sx, midY, 2, 0, TAU); ctx.fillStyle = rgba(c, 0.8); ctx.fill();
  };
  return <HudCanvas title="VOICE / WAVEFORM" code="OSC-02" draw={draw} height={132} />;
};

// ── 3. SPECTRUM ANALYSER — per-core load spectrum ─────────────────────────────
export const SpectrumBars: React.FC = () => {
  const N = 28;
  const lv = useRef<number[]>(Array(N).fill(0));
  const peak = useRef<number[]>(Array(N).fill(0));
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const floor = 0.08 + tel.heapLoad * 0.22;                                     // heap → global gain floor
    const gap = 2, bw = (w - gap * (N + 1)) / N;
    for (let i = 0; i < N; i++) {
      const core = coreAt(tel, Math.floor(i * tel.cores / N));                    // tile N bands across real cores
      const shimmer = Math.sin(d.t * (3 + i * 0.21) + i) * 0.5 + 0.5;            // per-band sub-core detail
      const target = clamp01(floor + core * (0.55 + shimmer * 0.45) + e * 0.15 + (a.activity === 'speaking' && i > N - 6 ? 0.25 : 0));
      // asymmetric VU envelope: fast attack, slow release
      lv.current[i] = target > lv.current[i] ? follow(lv.current[i], target, 0.45) : follow(lv.current[i], target, 0.12);
      peak.current[i] = Math.max(peak.current[i] - d.dt * 0.5, lv.current[i]);   // floating peak-hold cap
      const x = gap + i * (bw + gap), bh = lv.current[i] * (h - 8);
      const g = ctx.createLinearGradient(0, h, 0, h - bh);
      g.addColorStop(0, rgba(c, 0.25)); g.addColorStop(1, rgba(c, 0.95));
      ctx.fillStyle = g; ctx.shadowColor = rgba(c, 0.7); ctx.shadowBlur = 6;
      ctx.fillRect(x, h - bh, bw, bh);
      ctx.shadowBlur = 0; ctx.fillStyle = rgba(c, 0.9);
      ctx.fillRect(x, h - 4 - peak.current[i] * (h - 8), bw, 2);
    }
  };
  return <HudCanvas title="SPECTRUM ANALYSER" code="EQ-03" draw={draw} height={132} />;
};

// ── 4. CORE GAUGES — PWR=cpu · FLUX=heap · SYNC=battery (real %) ──────────────
export const RadialGauges: React.FC = () => {
  const st = useRef([0.5, 0.5, 0.5]);
  const labels = ['PWR', 'FLUX', 'SYNC'];
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood);
    const targets = [
      clamp01(tel.cpuLoad + a.intensity * 0.08),   // PWR  → main-thread load
      clamp01(tel.heapLoad),                        // FLUX → JS heap usage
      clamp01(tel.batteryLevel),                    // SYNC → battery charge
    ];
    const r = Math.min(h / 2 - 10, w / 6.6);
    for (let i = 0; i < 3; i++) {
      st.current[i] = follow(st.current[i], targets[i], 0.06);
      const v = st.current[i];
      const cx = w * (i + 0.5) / 3, cy = h / 2 + 2;
      const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
      ctx.lineWidth = 3; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.strokeStyle = rgba(c, 0.16); ctx.stroke();
      glowStroke(ctx, c, 8, 3);
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * v); ctx.stroke(); ctx.shadowBlur = 0;
      for (let k = 0; k <= 10; k++) { const ta = a0 + (a1 - a0) * k / 10; const r0 = r + 3, r1 = r + (k % 5 === 0 ? 7 : 4); ctx.beginPath(); ctx.moveTo(cx + Math.cos(ta) * r0, cy + Math.sin(ta) * r0); ctx.lineTo(cx + Math.cos(ta) * r1, cy + Math.sin(ta) * r1); ctx.strokeStyle = rgba(c, 0.3); ctx.lineWidth = 1; ctx.stroke(); }
      // SYNC charging tick: a small bolt-pip pulses while plugged in
      if (i === 2 && tel.batteryCharging) { const pp = 0.5 + 0.5 * Math.sin(d.t * 6); ctx.fillStyle = rgba(c, 0.5 + pp * 0.5); ctx.beginPath(); ctx.arc(cx, cy - r - 9, 1.6, 0, TAU); ctx.fill(); }
      ctx.fillStyle = rgba(c, 0.95); ctx.font = '700 13px Orbitron, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(Math.round(v * 100)).padStart(2, '0'), cx, cy + 4);
      ctx.fillStyle = rgba(c, 0.5); ctx.font = '7px Orbitron, sans-serif'; ctx.fillText(labels[i], cx, cy + r + 14);
      ctx.textAlign = 'left';
    }
  };
  return <HudCanvas title="CORE GAUGES" code="GAU-04" draw={draw} height={150} />;
};

// ── 5. NEURAL LATTICE — network + agent token flow ───────────────────────────
export const NetworkGraph: React.FC = () => {
  const nodes = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    x: ((i * 0.61803) % 1), y: ((i * 0.41421 + 0.13) % 1), ph: (i * 0.27) % 1, hub: i % 7 === 0,
  })), []);
  const edges = useMemo(() => {
    const es: [number, number][] = [];
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
      if (Math.hypot(dx, dy) < 0.28) es.push([i, j]);
    }
    return es;
  }, [nodes]);
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const thinking = a.activity === 'thinking' ? 1 : 0;
    const link = tel.online ? clamp01(0.2 + tel.netLoad * 0.8) : 0.05;            // offline → near-dead edges
    const flowRate = 0.2 + tel.netLoad * 0.7 + thinking * 0.6 + Math.min(0.8, a.tps / 30); // tokens/sec spawn packets
    const lag = clamp01(tel.rttMs / 300);                                         // higher rtt → packets lag
    const pad = 10, sx = (n: { x: number }) => pad + n.x * (w - 2 * pad), sy = (n: { y: number }) => pad + n.y * (h - 2 * pad);
    edges.forEach(([i, j], k) => {
      const A = nodes[i], B = nodes[j];
      ctx.beginPath(); ctx.moveTo(sx(A), sy(A)); ctx.lineTo(sx(B), sy(B));
      ctx.strokeStyle = rgba(c, 0.06 + link * 0.16); ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.stroke();
      if (tel.online && (thinking || tel.netLoad > 0.2 || a.tps > 0)) {
        const flow = (d.t * flowRate * (1 - lag * 0.5) + k * 0.21) % 1;
        const px = sx(A) + (sx(B) - sx(A)) * flow, py = sy(A) + (sy(B) - sy(A)) * flow;
        ctx.beginPath(); ctx.arc(px, py, 1.5, 0, TAU); ctx.fillStyle = rgba(c, 0.85); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 8; ctx.fill();
      }
    });
    ctx.shadowBlur = 0;
    nodes.forEach((n) => {
      const pulse = 0.5 + 0.5 * Math.sin(d.t * 2 + n.ph * TAU);
      const rr = (n.hub ? 3.2 : 1.8) + pulse * (n.hub ? 1.6 : 0.8) * (0.5 + tel.cpuLoad + e * 0.3); // node pulse ∝ cpu
      ctx.beginPath(); ctx.arc(sx(n), sy(n), rr, 0, TAU);
      ctx.fillStyle = rgba(c, n.hub ? 0.95 : 0.55); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = n.hub ? 10 : 5; ctx.fill();
    });
    ctx.shadowBlur = 0;
  };
  return <HudCanvas title="NEURAL LATTICE" code="NET-05" draw={draw} height={150} />;
};

// ── 6. ORBITAL SCANNER — uptime sweep + subsystem satellites ──────────────────
export const OrbitalScanner: React.FC = () => {
  const st = useRef({ orbit: 0, tilt: 0.5, lock: 0 });
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const s = st.current;
    s.orbit += d.dt * (0.22 + e * 0.4 + tel.cpuLoad * 0.3);                       // sidereal sweep, faster under load
    s.tilt = follow(s.tilt, 0.4 + tel.pointerActivity * 0.4, 0.05);               // operator presence tilts the view
    s.lock = follow(s.lock, a.highlight ? 1 : 0, 0.08);                           // agent focus → target lock
    const cx = w / 2, cy = h / 2 + 2, R = Math.min(w, h) / 2 - 12;
    // planet core — radius breathes with battery charge
    const coreR = R * (0.36 + tel.batteryLevel * 0.10);
    ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, TAU);
    const g = ctx.createRadialGradient(cx - R * 0.15, cy - R * 0.15, 1, cx, cy, R * 0.5);
    g.addColorStop(0, rgba(c, 0.5)); g.addColorStop(1, rgba(c, 0.04)); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, TAU); ctx.strokeStyle = rgba(c, 0.5); ctx.lineWidth = 1; ctx.stroke();
    for (let k = -2; k <= 2; k++) { const yy = cy + k * R * 0.16; const ww = Math.sqrt(Math.max(0, coreR ** 2 - (k * R * 0.16) ** 2)); ctx.beginPath(); ctx.moveTo(cx - ww, yy); ctx.lineTo(cx + ww, yy); ctx.strokeStyle = rgba(c, 0.12); ctx.stroke(); }
    // 3 orbital rings; the outer ring's arc-fill = storage usage
    for (let o = 0; o < 3; o++) {
      const ry = R * (0.7 + o * 0.12) * (0.25 + s.tilt * 0.6);
      const rx = R * (0.7 + o * 0.12);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(s.orbit * (o % 2 ? -1 : 1) * 0.3 + o);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.strokeStyle = rgba(c, 0.18 + e * 0.15); ctx.lineWidth = 1; ctx.stroke();
      if (o === 2) { glowStroke(ctx, c, 6, 2); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + TAU * clamp01(tel.storageLoad)); ctx.stroke(); ctx.shadowBlur = 0; }
      const ang = s.orbit * (1 + o * 0.4) + o * 2;
      const px = Math.cos(ang) * rx, py = Math.sin(ang) * ry;
      ctx.beginPath(); ctx.arc(px, py, 2, 0, TAU); ctx.fillStyle = rgba(c, 0.95); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
      ctx.restore();
    }
    if (s.lock > 0.02) {
      const lr = R * (0.55 - s.lock * 0.1); ctx.strokeStyle = rgba(c, s.lock); ctx.lineWidth = 1.5; ctx.shadowColor = rgba(c, 0.8); ctx.shadowBlur = 8;
      for (let q = 0; q < 4; q++) { const a0 = q * TAU / 4 + s.orbit * 0.5; ctx.beginPath(); ctx.arc(cx, cy, lr, a0 + 0.2, a0 + TAU / 4 - 0.2); ctx.stroke(); }
      ctx.shadowBlur = 0;
    }
  };
  return <HudCanvas title="ORBITAL SCANNER" code="ORB-06" draw={draw} height={150} />;
};

// ── 7. LOAD DISTRIBUTION — per-core power trunk (1:07–1:11 reel) ──────────────
// A bundle of cyan conduit lines that pinch through a central bus then fan out to the
// grid nodes, with energy packets travelling the active conduits. Each lane carries one
// logical core's load; a near-idle core's lane browns out. Throughput ∝ that core's load.
export const LoadDistribution: React.FC = () => {
  const N = 5;
  const lanes = useMemo(() => Array.from({ length: N }, (_, i) => ({
    y: (i + 0.5) / N, ph: (i * 0.37) % 1,
  })), []);
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood);
    const cx = w / 2, midPinch = h * 0.5, busHalf = h * 0.13;
    const alertLane = a.mood === 'alert' ? (a.alertPulse % N) : -1;               // alert browns out one lane
    ctx.shadowBlur = 0; ctx.strokeStyle = rgba(c, 0.5); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, midPinch - busHalf); ctx.lineTo(cx, midPinch + busHalf); ctx.stroke();
    for (const side of [-1, 1]) {
      lanes.forEach((ln, i) => {
        const coreIdx = side < 0 ? i : i + N;
        const load = coreAt(tel, coreIdx);
        const live = load > 0.14 && i !== alertLane;                             // parked/near-idle core → dead lane
        const yEdge = 8 + ln.y * (h - 16);
        const yBus = midPinch + (i - (N - 1) / 2) * (busHalf * 1.6 / N);
        const xEdge = side < 0 ? 2 : w - 2;
        const xKnee = cx + side * w * 0.18;
        ctx.beginPath();
        ctx.moveTo(xEdge, yEdge); ctx.lineTo(xKnee, yEdge); ctx.lineTo(cx, yBus);
        ctx.strokeStyle = rgba(c, live ? 0.18 + load * 0.4 : 0.07);
        ctx.lineWidth = live ? 1 + load * 0.8 : 1; ctx.shadowBlur = 0; ctx.stroke();
        // grid-node terminal block at the edge
        ctx.strokeStyle = rgba(c, live ? 0.4 : 0.15); ctx.lineWidth = 1;
        ctx.strokeRect(side < 0 ? 1 : w - 11, yEdge - 4, 10, 8);
        if (!live) return;
        // travelling packet — speed ∝ core load, accelerates through the dense bus
        const seg1 = Math.abs(xKnee - xEdge) / (Math.abs(xKnee - xEdge) + Math.hypot(cx - xKnee, yBus - yEdge));
        const p = (d.t * (0.4 + load * 1.2) + ln.ph) % 1;
        let px: number, py: number;
        if (p < seg1) { const u = p / seg1; px = xEdge + (xKnee - xEdge) * u; py = yEdge; }
        else { const u = (p - seg1) / (1 - seg1); px = xKnee + (cx - xKnee) * u; py = yEdge + (yBus - yEdge) * u; }
        ctx.beginPath(); ctx.arc(px, py, 1.5 + load * 1.6, 0, TAU);
        ctx.fillStyle = rgba(c, 0.9); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
      });
    }
    // central bus node glows with heap pressure
    const busGlow = 2.5 + tel.heapLoad * 4;
    ctx.beginPath(); ctx.arc(cx, midPinch, busGlow, 0, TAU);
    ctx.fillStyle = rgba(c, 0.95); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 8 + tel.heapLoad * 10; ctx.fill(); ctx.shadowBlur = 0;
  };
  return <HudCanvas title="LOAD DISTRIBUTION" code="PWR-07" draw={draw} height={150} />;
};

// ── 8. ENERGY RESERVES — real machine reserves (0:54–0:59 reel) ──────────────
// The reference's stacked single-colour reserve rows: a segmented square-block bar that
// fills to a live % readout. Here the four rows are REAL reserves — battery, memory free,
// storage free, CPU headroom — each segmented bar + live % is the genuine machine figure.
export const EnergyReserves: React.FC = () => {
  const SEG = 15;
  const lv = useRef<number[]>([0.5, 0.5, 0.5, 0.5]);
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood);
    // [label, value 0..1, low-is-bad?] — value is the real reserve level
    const rows: [string, number, boolean][] = [
      ['BATT', clamp01(tel.batteryLevel), true],
      ['MEM', clamp01(1 - tel.heapLoad), true],
      ['DISK', clamp01(1 - tel.storageLoad), true],
      ['CPU', clamp01(1 - tel.cpuLoad), true],
    ];
    const rowH = h / rows.length;
    const labelW = 40, valW = 32;
    const barX = labelW + 4, barW = w - barX - valW - 2;
    const gap = 2, sw = (barW - gap * (SEG - 1)) / SEG;
    rows.forEach(([name, value, lowBad], r) => {
      lv.current[r] = follow(lv.current[r], value, 0.12);
      const v = lv.current[r];
      const low = lowBad && v < 0.2;
      const rc: RGB = low ? [255, 75, 75] : (r === 0 && tel.batteryCharging ? [91, 232, 160] : c); // low = red, charging batt = green
      const cy = r * rowH + rowH / 2;
      ctx.shadowBlur = 0; ctx.fillStyle = rgba(c, 0.55); ctx.font = '8px Orbitron, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(name, 0, cy + 3);
      const lit = Math.round(v * SEG);
      for (let s = 0; s < SEG; s++) {
        const x = barX + s * (sw + gap), on = s < lit;
        const lead = on && s === lit - 1;                                        // leading filled cell pulses (charge sweep)
        const al = on ? (lead ? 0.6 + 0.4 * Math.sin(d.t * TAU * 1.5) : 0.85) : 0.14;
        ctx.fillStyle = rgba(rc, al);
        ctx.shadowColor = rgba(rc, 0.8); ctx.shadowBlur = on ? 5 : 0;
        ctx.fillRect(x, cy - rowH * 0.2, sw, rowH * 0.4);
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(rc, 0.95); ctx.font = '700 10px Orbitron, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(v * 100)).padStart(2, '0') + '%', w, cy + 3);
    });
    ctx.textAlign = 'left';
  };
  return <HudCanvas title="ENERGY RESERVES" code="RSV-08" draw={draw} height={120} />;
};

// ── 9. POWER DISTRIBUTION — per-core node grid (1:07–1:11 reel) ──────────────
// The POWER_DISTRIBUTION / GRD node matrix: a grid of live signed node values. Each Nk
// cell is a logical CPU core's load expressed as a signed deviation from the mean; cores
// the machine does not expose read N/A ✕. A scan highlight rakes the rows.
export const PowerDistributionGrid: React.FC = () => {
  const COLS = 2, ROWS = 4, N = COLS * ROWS;
  const vals = useRef<number[]>(Array(N).fill(0));
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const padX = 3, padY = 11, gx = 6, gy = 5;
    const cw = (w - padX * 2 - gx * (COLS - 1)) / COLS;
    const ch = (h - padY - gy * (ROWS - 1)) / ROWS;
    const scanRow = Math.floor((d.t * (0.8 + e)) % ROWS);
    for (let i = 0; i < N; i++) {
      const col = i % COLS, row = Math.floor(i / COLS);
      const x = padX + col * (cw + gx), y = padY + row * (ch + gy);
      const na = i >= tel.cores;                                                  // core the machine doesn't expose
      const hot = row === scanRow && !na;
      ctx.shadowBlur = 0; ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(c, na ? 0.16 : hot ? 0.6 : 0.3);
      ctx.strokeRect(x, y, cw, ch);
      ctx.fillStyle = rgba(c, 0.45); ctx.font = '7px Orbitron, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('N' + (i + 1), x + 4, y + 10);
      if (na) {
        const mx = x + cw / 2, my = y + ch * 0.62, s = Math.min(cw, ch) * 0.16;
        ctx.strokeStyle = rgba(c, 0.28 + 0.18 * Math.sin(d.t * 4 + i)); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(mx - s, my - s); ctx.lineTo(mx + s, my + s); ctx.moveTo(mx + s, my - s); ctx.lineTo(mx - s, my + s); ctx.stroke();
        ctx.fillStyle = rgba(c, 0.3); ctx.font = '7px Orbitron, sans-serif'; ctx.textAlign = 'right';
        ctx.fillText('N/A', x + cw - 4, y + 10);
      } else {
        const signed = (coreAt(tel, i) - tel.cpuLoad) * 40;                       // signed deviation from mean load
        vals.current[i] = follow(vals.current[i], signed, 0.1);
        ctx.fillStyle = rgba(c, hot ? 0.98 : 0.85);
        ctx.shadowColor = rgba(c, 0.8); ctx.shadowBlur = hot ? 6 : 0;
        ctx.font = '700 13px Orbitron, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(vals.current[i].toFixed(1), x + cw / 2, y + ch * 0.72);
        ctx.shadowBlur = 0;
      }
    }
    ctx.textAlign = 'left';
  };
  return <HudCanvas title="POWER DISTRIBUTION" code="GRD-09" draw={draw} height={120} />;
};

// ── 10. TELEMETRY MULTIGRAPH — real FPS history + heap history (1:30–1:32) ────
// The reference multi-graph wall: a scrolling wave-spec line above a breathing levels
// area-fill. Here the top line is the real frame-rate history and the bottom area is the
// real JS-heap history; both scroll right→left at a fixed cadence.
export const TelemetryMultigraph: React.FC = () => {
  const M = 64;
  const wave = useRef<number[]>(Array(M).fill(0.9));
  const lvl = useRef<number[]>(Array(M).fill(0.3));
  const acc = useRef(0);
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood);
    acc.current += d.dt;
    while (acc.current > 0.05) {
      acc.current -= 0.05;
      wave.current.push(clamp01(tel.fps / Math.max(30, tel.refreshHz)));          // real fps history (1 = at refresh)
      wave.current.shift();
      lvl.current.push(clamp01(tel.heapLoad));                                     // real heap history
      lvl.current.shift();
    }
    const split = h * 0.5;
    plotGrid(ctx, c, 0, 0, w, split, 6, 2);                                       // faint structure behind the data
    ctx.shadowBlur = 0; ctx.strokeStyle = rgba(c, 0.12); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, split); ctx.lineTo(w, split); ctx.stroke();
    // corner readouts (the reference over-labels every graph) — current fps / peak heap
    ctx.fillStyle = rgba(c, 0.5); ctx.font = '7px Orbitron, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('FPS ' + Math.round(tel.fps), 2, 9);
    ctx.textAlign = 'right'; ctx.fillText('HEAP ' + Math.round(tel.heapLoad * 100), w - 2, 9); ctx.textAlign = 'left';
    glowStroke(ctx, c, 7, 1.5); ctx.beginPath();
    wave.current.forEach((v, i) => { const x = (i / (M - 1)) * w, y = 4 + (1 - v) * (split - 8); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke(); ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(0, split, 0, h);
    g.addColorStop(0, rgba(c, 0.32)); g.addColorStop(1, rgba(c, 0.03));
    const ly = (v: number) => split + 4 + (1 - v) * (h - split - 8);
    ctx.beginPath(); ctx.moveTo(0, h);
    lvl.current.forEach((v, i) => ctx.lineTo((i / (M - 1)) * w, ly(v)));
    ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = rgba(c, 0.7); ctx.lineWidth = 1; ctx.beginPath();
    lvl.current.forEach((v, i) => { const x = (i / (M - 1)) * w; i === 0 ? ctx.moveTo(x, ly(v)) : ctx.lineTo(x, ly(v)); });
    ctx.stroke();
    baselineDots(ctx, c, 2, w - 2, h - 3, 12, 1);                                  // LEVELS-graph baseline ticks
    const lastY = 4 + (1 - wave.current[M - 1]) * (split - 8);
    ctx.beginPath(); ctx.arc(w - 1, lastY, 2, 0, TAU);
    ctx.fillStyle = rgba(c, 0.95); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
  };
  return <HudCanvas title="TELEMETRY MULTIGRAPH" code="GPH-10" draw={draw} height={120} />;
};
