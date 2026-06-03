import React, { useMemo, useRef } from 'react';
import HudCanvas, { DrawFn, DrawCtx } from './HudCanvas';
import { moodColor, rgba, follow, RGB } from './shared';

// ── The gesture-driven instrument deck ───────────────────────────────────────
// Six high-value HUD instruments. Each reads the operator's HANDS (d.sig) and the
// J.A.R.V.I.S. agent (d.a) every frame, so they respond to gestures live AND are
// modulated by the AI's mood / intensity / activity / focus. Cyan holographic
// identity preserved; mood only shifts the accent (alert→red, etc.).

const TAU = Math.PI * 2;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
// energy = how "awake" the deck is: agent intensity + a kick while it thinks/speaks
const energyOf = (a: DrawCtx['a']) => clamp01(a.intensity * 0.7 + (a.activity === 'speaking' ? 0.4 : a.activity === 'thinking' ? 0.25 : 0));

// glow stroke helper
function glowStroke(ctx: CanvasRenderingContext2D, c: RGB, blur: number, width: number) {
  ctx.strokeStyle = rgba(c, 1); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = blur; ctx.lineWidth = width;
}

// ── 1. RADAR SWEEP ───────────────────────────────────────────────────────────
export const RadarSweep: React.FC = () => {
  const blips = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    ang: (i * 2.39996) % TAU, r: 0.25 + ((i * 53) % 70) / 100, ph: (i * 0.37) % 1, sz: 1 + (i % 3),
  })), []);
  const st = useRef({ sweep: 0, ping: -1, wasPinch: 0, range: 1 });
  const draw: DrawFn = (d) => {
    const { ctx, w, h, sig, a } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const cx = w / 2, cy = h / 2 + 4, R = Math.min(w, h) / 2 - 10;
    const s = st.current;
    s.range = follow(s.range, 1 - sig.expansion * 0.45, 0.06);   // open palm zooms in
    s.sweep = (s.sweep + d.dt * (0.7 + e * 0.9)) % TAU;
    if (sig.pinch > 0.6 && s.wasPinch < 0.6) s.ping = 0;          // pinch = active ping
    s.wasPinch = sig.pinch;

    // range rings + crosshair
    ctx.shadowBlur = 0; ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, R * k / 3, 0, TAU); ctx.strokeStyle = rgba(c, 0.18); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.strokeStyle = rgba(c, 0.12); ctx.stroke();

    // sweep wedge (trailing gradient)
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-s.sweep);
    const grad = ctx.createConicGradient ? ctx.createConicGradient(0, 0, 0) : null;
    if (grad) { grad.addColorStop(0, rgba(c, 0.32)); grad.addColorStop(0.12, rgba(c, 0.0)); grad.addColorStop(1, rgba(c, 0)); ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); }
    glowStroke(ctx, c, 8, 1.5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R, 0); ctx.stroke();
    ctx.restore(); ctx.shadowBlur = 0;

    // blips light up as the sweep passes; gesture range scales them in/out
    blips.forEach((b) => {
      const rr = b.r / s.range; if (rr > 1) return;
      const ba = (TAU - b.ang) % TAU;
      let da = (s.sweep - ba + TAU) % TAU;          // time since sweep passed
      const lit = Math.max(0, 1 - da / 0.9);
      const bx = cx + Math.cos(b.ang) * R * rr, by = cy + Math.sin(b.ang) * R * rr;
      const on = lit * (0.4 + e * 0.6);
      ctx.beginPath(); ctx.arc(bx, by, b.sz + on * 2, 0, TAU);
      ctx.fillStyle = rgba(c, 0.25 + on * 0.7); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = on * 12; ctx.fill();
    });
    ctx.shadowBlur = 0;

    // pinch ping
    if (s.ping >= 0) { s.ping += d.dt * 0.9; const p = s.ping; if (p > 1) s.ping = -1; else { ctx.beginPath(); ctx.arc(cx, cy, R * p, 0, TAU); ctx.strokeStyle = rgba(c, (1 - p) * 0.8); ctx.lineWidth = 2; ctx.shadowColor = rgba(c, 0.8); ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0; } }
  };
  return <HudCanvas title="PROXIMITY RADAR" code="RDR-01" draw={draw} height={150} />;
};

// ── 2. WAVEFORM MONITOR (oscilloscope) ───────────────────────────────────────
export const WaveformMonitor: React.FC = () => {
  const st = useRef({ amp: 0.4, freq: 2, phase: 0 });
  const draw: DrawFn = (d) => {
    const { ctx, w, h, sig, a } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const s = st.current;
    const speaking = a.activity === 'speaking' ? 1 : 0;
    s.amp = follow(s.amp, 0.25 + sig.expansion * 0.5 + speaking * 0.25, 0.08);
    s.freq = follow(s.freq, 1.5 + (sig.rotY + 1) * 2.5, 0.06);
    s.phase += d.dt * (2 + e * 5 + speaking * 4);
    const midY = h / 2;
    // grid
    ctx.strokeStyle = rgba(c, 0.10); ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += w / 6) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.strokeStyle = rgba(c, 0.18); ctx.stroke();
    // waveform: sum of a carrier + noise, amplitude/freq gesture-driven
    glowStroke(ctx, c, 9, 1.8); ctx.beginPath();
    const A = s.amp * (h / 2 - 6);
    for (let x = 0; x <= w; x += 2) {
      const u = x / w;
      const env = Math.sin(u * Math.PI);                       // taper ends
      const y = midY - env * A * (Math.sin(u * s.freq * TAU + s.phase) * 0.7 + Math.sin(u * s.freq * 2.3 * TAU - s.phase * 1.3) * 0.3 + (speaking ? Math.sin(u * 60 + s.phase * 9) * 0.12 : 0));
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    // scan dot
    const sx = (s.phase * 30) % w;
    ctx.beginPath(); ctx.arc(sx, midY, 2, 0, TAU); ctx.fillStyle = rgba(c, 0.8); ctx.fill();
  };
  return <HudCanvas title="VOICE / WAVEFORM" code="OSC-02" draw={draw} height={132} />;
};

// ── 3. SPECTRUM EQUALIZER ────────────────────────────────────────────────────
export const SpectrumBars: React.FC = () => {
  const N = 28;
  const lv = useRef<number[]>(Array(N).fill(0));
  const peak = useRef<number[]>(Array(N).fill(0));
  const seedRef = useRef<number[]>(Array.from({ length: N }, (_, i) => 0.4 + ((i * 71) % 60) / 100));
  const draw: DrawFn = (d) => {
    const { ctx, w, h, sig, a } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const drive = clamp01(0.25 + e * 0.7 + sig.expansion * 0.4 + (a.activity === 'speaking' ? 0.3 : 0));
    const gap = 2, bw = (w - gap * (N + 1)) / N;
    for (let i = 0; i < N; i++) {
      const band = Math.sin(d.t * (2 + i * 0.18) + i) * 0.5 + 0.5;
      const target = clamp01(band * seedRef.current[i] * drive * 1.4);
      lv.current[i] = follow(lv.current[i], target, 0.25);
      peak.current[i] = Math.max(peak.current[i] - d.dt * 0.5, lv.current[i]);
      const x = gap + i * (bw + gap), bh = lv.current[i] * (h - 8);
      const g = ctx.createLinearGradient(0, h, 0, h - bh);
      g.addColorStop(0, rgba(c, 0.25)); g.addColorStop(1, rgba(c, 0.95));
      ctx.fillStyle = g; ctx.shadowColor = rgba(c, 0.7); ctx.shadowBlur = 6;
      ctx.fillRect(x, h - bh, bw, bh);
      // peak cap
      ctx.shadowBlur = 0; ctx.fillStyle = rgba(c, 0.85);
      ctx.fillRect(x, h - 4 - peak.current[i] * (h - 8), bw, 2);
    }
  };
  return <HudCanvas title="SPECTRUM ANALYSER" code="EQ-03" draw={draw} height={132} />;
};

// ── 4. RADIAL GAUGE CLUSTER ──────────────────────────────────────────────────
export const RadialGauges: React.FC = () => {
  const st = useRef([0.5, 0.5, 0.5]);
  const labels = ['PWR', 'FLUX', 'SYNC'];
  const draw: DrawFn = (d) => {
    const { ctx, w, h, sig, a } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const targets = [clamp01(0.3 + e * 0.6 + a.intensity * 0.1), clamp01(0.5 + (sig.rotX) * 0.5), clamp01(sig.expansion * 0.8 + 0.15)];
    const r = Math.min(h / 2 - 10, w / 6.6);
    for (let i = 0; i < 3; i++) {
      st.current[i] = follow(st.current[i], targets[i], 0.06);
      const v = st.current[i];
      const cx = w * (i + 0.5) / 3, cy = h / 2 + 2;
      const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;           // 270° gauge
      ctx.lineWidth = 3; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.strokeStyle = rgba(c, 0.16); ctx.stroke();
      glowStroke(ctx, c, 8, 3);
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * v); ctx.stroke(); ctx.shadowBlur = 0;
      // ticks
      for (let k = 0; k <= 10; k++) { const ta = a0 + (a1 - a0) * k / 10; const r0 = r + 3, r1 = r + (k % 5 === 0 ? 7 : 4); ctx.beginPath(); ctx.moveTo(cx + Math.cos(ta) * r0, cy + Math.sin(ta) * r0); ctx.lineTo(cx + Math.cos(ta) * r1, cy + Math.sin(ta) * r1); ctx.strokeStyle = rgba(c, 0.3); ctx.lineWidth = 1; ctx.stroke(); }
      // readout
      ctx.fillStyle = rgba(c, 0.95); ctx.font = '700 13px Orbitron, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(Math.round(v * 100)).padStart(2, '0'), cx, cy + 4);
      ctx.fillStyle = rgba(c, 0.5); ctx.font = '7px Orbitron, sans-serif'; ctx.fillText(labels[i], cx, cy + r + 14);
      ctx.textAlign = 'left';
    }
  };
  return <HudCanvas title="CORE GAUGES" code="GAU-04" draw={draw} height={150} />;
};

// ── 5. NEURAL NETWORK GRAPH ──────────────────────────────────────────────────
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
  const st = useRef({ open: 0 });
  const draw: DrawFn = (d) => {
    const { ctx, w, h, sig, a } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const thinking = a.activity === 'thinking' ? 1 : 0;
    st.current.open = follow(st.current.open, 0.5 + sig.spread * 0.5, 0.05);
    const pad = 10, sx = (n: { x: number }) => pad + n.x * (w - 2 * pad), sy = (n: { y: number }) => pad + n.y * (h - 2 * pad);
    // edges with travelling packets when the agent thinks
    edges.forEach(([i, j], k) => {
      const A = nodes[i], B = nodes[j];
      ctx.beginPath(); ctx.moveTo(sx(A), sy(A)); ctx.lineTo(sx(B), sy(B));
      ctx.strokeStyle = rgba(c, 0.10 + e * 0.12); ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.stroke();
      const flow = (d.t * (0.3 + thinking * 0.8) + k * 0.21) % 1;
      if (thinking || e > 0.5) {
        const px = sx(A) + (sx(B) - sx(A)) * flow, py = sy(A) + (sy(B) - sy(A)) * flow;
        ctx.beginPath(); ctx.arc(px, py, 1.5, 0, TAU); ctx.fillStyle = rgba(c, 0.8 * (thinking ? 1 : 0.5)); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 8; ctx.fill();
      }
    });
    ctx.shadowBlur = 0;
    // nodes pulse
    nodes.forEach((n) => {
      const pulse = 0.5 + 0.5 * Math.sin(d.t * 2 + n.ph * TAU);
      const rr = (n.hub ? 3.2 : 1.8) + pulse * (n.hub ? 1.6 : 0.8) * (0.5 + e);
      ctx.beginPath(); ctx.arc(sx(n), sy(n), rr, 0, TAU);
      ctx.fillStyle = rgba(c, n.hub ? 0.95 : 0.55); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = n.hub ? 10 : 5; ctx.fill();
    });
    ctx.shadowBlur = 0;
  };
  return <HudCanvas title="NEURAL LATTICE" code="NET-05" draw={draw} height={150} />;
};

// ── 7. LOAD DISTRIBUTION (power trunk) ───────────────────────────────────────
// The reference's POWER_DISTRIBUTION flow (youtu.be/yXpkIrR81w8 @1:07–1:11): a bundle
// of cyan trunk-lines that pinch through a central bus then fan out to the grid nodes,
// with energy packets travelling the active conduits. Throughput follows the agent's
// energy + the operator's open-palm expansion; a node browns out (dims) on alert.
export const LoadDistribution: React.FC = () => {
  const N = 5; // conduits per side
  const lanes = useMemo(() => Array.from({ length: N }, (_, i) => ({
    y: (i + 0.5) / N,                       // 0..1 vertical lane
    ph: (i * 0.37) % 1,                     // packet phase offset
    speed: 0.6 + ((i * 53) % 50) / 100,     // per-lane packet speed
    live: i % 4 !== 2,                      // one lane idle (a "N/A" grid node)
  })), []);
  const draw: DrawFn = (d) => {
    const { ctx, w, h, sig, a } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const flow = clamp01(0.3 + e * 0.7 + sig.expansion * 0.4);
    const cx = w / 2, midPinch = h * 0.5, busHalf = h * 0.13;
    // central bus bracket
    ctx.shadowBlur = 0; ctx.strokeStyle = rgba(c, 0.5); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, midPinch - busHalf); ctx.lineTo(cx, midPinch + busHalf); ctx.stroke();
    for (const side of [-1, 1]) {
      lanes.forEach((ln, i) => {
        const yEdge = 8 + ln.y * (h - 16);
        const yBus = midPinch + (i - (N - 1) / 2) * (busHalf * 1.6 / N);
        const xEdge = side < 0 ? 2 : w - 2;
        const xKnee = cx + side * w * 0.18;     // where the lane bends toward the bus
        // conduit: edge → knee (flat) → bus (pinched)
        ctx.beginPath();
        ctx.moveTo(xEdge, yEdge); ctx.lineTo(xKnee, yEdge); ctx.lineTo(cx, yBus);
        ctx.strokeStyle = rgba(c, ln.live ? 0.22 + flow * 0.25 : 0.08);
        ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.stroke();
        if (!ln.live) return;
        // travelling packet (edge → bus on one side, bus → edge on the other)
        const p = (d.t * ln.speed * (0.4 + flow) + ln.ph) % 1;
        const seg1 = Math.abs(xKnee - xEdge) / (Math.abs(xKnee - xEdge) + Math.hypot(cx - xKnee, yBus - yEdge));
        let px: number, py: number;
        if (p < seg1) { const u = p / seg1; px = xEdge + (xKnee - xEdge) * u; py = yEdge; }
        else { const u = (p - seg1) / (1 - seg1); px = xKnee + (cx - xKnee) * u; py = yEdge + (yBus - yEdge) * u; }
        ctx.beginPath(); ctx.arc(px, py, 1.6 + flow, 0, TAU);
        ctx.fillStyle = rgba(c, 0.85); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
        // grid-node terminal block at the edge
        ctx.strokeStyle = rgba(c, 0.4); ctx.lineWidth = 1;
        ctx.strokeRect(side < 0 ? 1 : w - 11, yEdge - 4, 10, 8);
      });
    }
    // central bus glow node
    ctx.beginPath(); ctx.arc(cx, midPinch, 2.5 + flow * 2, 0, TAU);
    ctx.fillStyle = rgba(c, 0.95); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 10 + flow * 8; ctx.fill(); ctx.shadowBlur = 0;
  };
  return <HudCanvas title="LOAD DISTRIBUTION" code="PWR-07" draw={draw} height={150} />;
};

// ── 6. ORBITAL SCANNER (targeting) ───────────────────────────────────────────
export const OrbitalScanner: React.FC = () => {
  const st = useRef({ orbit: 0, tilt: 0.5, lock: 0 });
  const draw: DrawFn = (d) => {
    const { ctx, w, h, sig, a } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const s = st.current;
    s.orbit += d.dt * (0.3 + e * 0.5) + sig.rotX * d.dt * 2;
    s.tilt = follow(s.tilt, 0.25 + sig.rotY * 0.4 + 0.4, 0.05);
    s.lock = follow(s.lock, a.highlight ? 1 : (sig.pinch > 0.6 ? 1 : 0), 0.08);
    const cx = w / 2, cy = h / 2 + 2, R = Math.min(w, h) / 2 - 12;
    // planet core
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.42, 0, TAU);
    const g = ctx.createRadialGradient(cx - R * 0.15, cy - R * 0.15, 1, cx, cy, R * 0.5);
    g.addColorStop(0, rgba(c, 0.5)); g.addColorStop(1, rgba(c, 0.04)); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.42, 0, TAU); ctx.strokeStyle = rgba(c, 0.5); ctx.lineWidth = 1; ctx.stroke();
    // latitude scan lines
    for (let k = -2; k <= 2; k++) { const yy = cy + k * R * 0.16; const ww = Math.sqrt(Math.max(0, (R * 0.42) ** 2 - (k * R * 0.16) ** 2)); ctx.beginPath(); ctx.moveTo(cx - ww, yy); ctx.lineTo(cx + ww, yy); ctx.strokeStyle = rgba(c, 0.12); ctx.stroke(); }
    // 3 orbital ellipses (tilted)
    for (let o = 0; o < 3; o++) {
      const ry = R * (0.7 + o * 0.12) * (0.25 + s.tilt * 0.6);
      const rx = R * (0.7 + o * 0.12);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(s.orbit * (o % 2 ? -1 : 1) * 0.3 + o);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.strokeStyle = rgba(c, 0.22 + e * 0.15); ctx.lineWidth = 1; ctx.stroke();
      // travelling satellite
      const ang = s.orbit * (1 + o * 0.4) + o * 2;
      const px = Math.cos(ang) * rx, py = Math.sin(ang) * ry;
      ctx.beginPath(); ctx.arc(px, py, 2, 0, TAU); ctx.fillStyle = rgba(c, 0.95); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
      ctx.restore();
    }
    // target lock reticle
    if (s.lock > 0.02) {
      const lr = R * (0.55 - s.lock * 0.1); ctx.strokeStyle = rgba(c, s.lock); ctx.lineWidth = 1.5; ctx.shadowColor = rgba(c, 0.8); ctx.shadowBlur = 8;
      for (let q = 0; q < 4; q++) { const a0 = q * TAU / 4 + s.orbit * 0.5; ctx.beginPath(); ctx.arc(cx, cy, lr, a0 + 0.2, a0 + TAU / 4 - 0.2); ctx.stroke(); }
      ctx.shadowBlur = 0;
    }
  };
  return <HudCanvas title="ORBITAL SCANNER" code="ORB-06" draw={draw} height={150} />;
};
