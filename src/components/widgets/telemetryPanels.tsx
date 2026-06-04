import React, { useRef } from 'react';
import HudCanvas, { DrawFn } from './HudCanvas';
import { moodColor, rgba, follow, RGB, TAU, clamp01, energyOf, glowStroke, plotGrid, baselineDots } from './shared';

// ── Real-telemetry instruments ───────────────────────────────────────────────
// Seven instruments that own the machine-telemetry surface the original ten did not,
// plus a dedicated AI-agent panel. Each reads d.tel (battery / cpu / heap / network /
// fps / storage) and/or d.a (the J.A.R.V.I.S. agent) every frame — genuine real-time
// stats. Same cyan holographic language as the instrument deck; non-cyan only on a real
// event (low battery, offline link, alert). Modelled on the reference reel's element
// library (youtu.be/yXpkIrR81w8): segmented reserve bars, radial gauges, equalizer
// columns, status cards.

const GREEN: RGB = [91, 232, 160];
const RED: RGB = [255, 75, 75];
const fmtMB = (mb: number) => (mb >= 1024 ? (mb / 1024).toFixed(1) + 'G' : Math.round(mb) + 'M');

// ── 11. CORE THREADS — one bar per logical core (real hardwareConcurrency) ────
export const CoreThreads: React.FC = () => {
  const lv = useRef<number[]>(Array(64).fill(0.2));
  const peak = useRef<number[]>(Array(64).fill(0));
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood);
    const n = Math.max(1, Math.min(tel.cores, tel.perCore.length || tel.cores));
    const headY = 12;
    ctx.shadowBlur = 0; ctx.textAlign = 'left'; ctx.font = '8px Orbitron, sans-serif';
    ctx.fillStyle = rgba(c, 0.5); ctx.fillText(`${tel.cores} THREADS`, 2, headY - 2);
    ctx.textAlign = 'right'; ctx.fillStyle = rgba(c, 0.95); ctx.font = '700 10px Orbitron, sans-serif';
    ctx.fillText(Math.round(tel.cpuLoad * 100) + '%', w - 2, headY - 2);
    ctx.textAlign = 'left';
    const top = headY + 4, plotH = h - top - 2;
    const gap = 3, bw = (w - gap * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const target = clamp01(tel.perCore.length ? tel.perCore[i] : tel.cpuLoad);
      lv.current[i] = target > lv.current[i] ? follow(lv.current[i], target, 0.4) : follow(lv.current[i], target, 0.12);
      peak.current[i] = Math.max(peak.current[i] - d.dt * 0.45, lv.current[i]);
      const x = gap + i * (bw + gap), bh = lv.current[i] * plotH;
      // stacked discrete segments (quantized, instrument-grade)
      const segH = 6, segGap = 2, segs = Math.floor(bh / (segH + segGap));
      for (let s = 0; s < segs; s++) {
        const sy = top + plotH - (s + 1) * (segH + segGap) + segGap;
        const al = 0.35 + (s / Math.max(1, plotH / (segH + segGap))) * 0.6;
        ctx.fillStyle = rgba(c, al); ctx.shadowColor = rgba(c, 0.6); ctx.shadowBlur = 4;
        ctx.fillRect(x, sy, bw, segH);
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(c, 0.95); ctx.fillRect(x, top + plotH - peak.current[i] * plotH - 1, bw, 2); // peak cap
    }
  };
  return <HudCanvas title="CORE THREADS" code="CPU-11" draw={draw} height={132} />;
};

// ── 12. MEMORY ALLOCATION — JS heap ring gauge (used / limit) ─────────────────
export const MemoryAllocation: React.FC = () => {
  const st = useRef({ v: 0.3, sweep: 0 });
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood);
    const s = st.current;
    s.v = follow(s.v, clamp01(tel.heapLoad), 0.08);
    s.sweep = (s.sweep + d.dt * 0.25) % 1;                                        // constant radar-style sweep
    const cx = w / 2, cy = h / 2 + 4, R = Math.min(w, h) / 2 - 14;
    // outer tick ring (slow counter-rotation for parallax)
    const tickN = 60, rot = -(d.t * 0.05 % 1) * TAU;
    for (let i = 0; i < tickN; i++) { const ta = rot + (i / tickN) * TAU; const long = i % 5 === 0; const r0 = R, r1 = R + (long ? 6 : 3); ctx.beginPath(); ctx.moveTo(cx + Math.cos(ta) * r0, cy + Math.sin(ta) * r0); ctx.lineTo(cx + Math.cos(ta) * r1, cy + Math.sin(ta) * r1); ctx.strokeStyle = rgba(c, long ? 0.4 : 0.18); ctx.lineWidth = 1; ctx.stroke(); }
    // progress arc (the hero) — two-tier bloom
    const a0 = -Math.PI / 2, a1 = a0 + TAU * s.v;
    ctx.beginPath(); ctx.arc(cx, cy, R - 4, 0, TAU); ctx.strokeStyle = rgba(c, 0.14); ctx.lineWidth = 3; ctx.shadowBlur = 0; ctx.stroke();
    glowStroke(ctx, c, 10, 3.2); ctx.beginPath(); ctx.arc(cx, cy, R - 4, a0, a1); ctx.stroke(); ctx.shadowBlur = 0;
    // sweeping dot with comet trail
    const sa = a0 + s.sweep * TAU;
    for (let k = 0; k < 8; k++) { const aa = sa - k * 0.06; ctx.beginPath(); ctx.arc(cx + Math.cos(aa) * (R - 4), cy + Math.sin(aa) * (R - 4), 1.6, 0, TAU); ctx.fillStyle = rgba(c, 0.5 * (1 - k / 8)); ctx.fill(); }
    ctx.beginPath(); ctx.arc(cx + Math.cos(sa) * (R - 4), cy + Math.sin(sa) * (R - 4), 2.2, 0, TAU); ctx.fillStyle = rgba(c, 0.95); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
    // center readout
    ctx.textAlign = 'center'; ctx.fillStyle = rgba(c, 0.96); ctx.font = '700 20px Orbitron, sans-serif';
    ctx.fillText(Math.round(s.v * 100) + '%', cx, cy + 3);
    ctx.fillStyle = rgba(c, 0.5); ctx.font = '7px Orbitron, sans-serif';
    const sub = tel.memorySupported ? `${fmtMB(tel.heapUsedMB)} / ${fmtMB(tel.heapLimitMB)}` : `${tel.deviceMemoryGB}G RAM`;
    ctx.fillText(sub, cx, cy + 16);
    ctx.fillStyle = rgba(c, 0.35); ctx.fillText(tel.memorySupported ? 'JS HEAP' : 'HEAP EST', cx, cy - 14);
    ctx.textAlign = 'left';
  };
  return <HudCanvas title="MEMORY ALLOCATION" code="MEM-12" draw={draw} height={150} />;
};

// ── 13. POWER CELL — battery reserve + charge state ──────────────────────────
export const PowerCell: React.FC = () => {
  const st = useRef({ v: 1 });
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood);
    const s = st.current; s.v = follow(s.v, clamp01(tel.batteryLevel), 0.1);
    const low = s.v < 0.2 && !tel.batteryCharging;
    const cc: RGB = low ? RED : tel.batteryCharging ? GREEN : c;
    // battery body
    const bx = 10, by = 18, bw = w - 30, bh = h - 46;
    ctx.shadowBlur = 0; ctx.strokeStyle = rgba(cc, 0.6); ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = rgba(cc, 0.6); ctx.fillRect(bx + bw, by + bh * 0.3, 4, bh * 0.4);                   // terminal nub
    // segmented charge — sequential fill, leading cell pulses
    const SEG = 12, gap = 3, sw = (bw - 8 - gap * (SEG - 1)) / SEG, lit = Math.round(s.v * SEG);
    for (let i = 0; i < SEG; i++) {
      const on = i < lit, lead = on && i === lit - 1;
      const al = on ? (lead ? 0.55 + 0.45 * Math.sin(d.t * TAU * 1.5) : 0.85) : 0.12;
      ctx.fillStyle = rgba(cc, al); ctx.shadowColor = rgba(cc, 0.8); ctx.shadowBlur = on ? 6 : 0;
      ctx.fillRect(bx + 4 + i * (sw + gap), by + 4, sw, bh - 8);
    }
    ctx.shadowBlur = 0;
    // charging bolt
    if (tel.batteryCharging) { const mx = bx + bw / 2, my = by + bh / 2; ctx.fillStyle = rgba([10, 16, 22], 0.85); ctx.beginPath(); ctx.moveTo(mx + 4, my - 9); ctx.lineTo(mx - 5, my + 1); ctx.lineTo(mx, my + 1); ctx.lineTo(mx - 4, my + 9); ctx.lineTo(mx + 5, my - 1); ctx.lineTo(mx, my - 1); ctx.closePath(); ctx.fill(); ctx.strokeStyle = rgba(GREEN, 0.9); ctx.lineWidth = 1; ctx.stroke(); }
    // readouts
    ctx.textAlign = 'left'; ctx.fillStyle = rgba(cc, 0.96); ctx.font = '700 13px Orbitron, sans-serif';
    ctx.fillText(Math.round(s.v * 100) + '%', bx, h - 6);
    ctx.textAlign = 'right'; ctx.font = '8px Orbitron, sans-serif'; ctx.fillStyle = rgba(cc, 0.6);
    const t = tel.batteryCharging ? tel.batteryChargingTime : tel.batteryDischargeTime;
    const status = !tel.batterySupported ? 'AC POWER' : tel.batteryCharging ? (t > 0 ? `${Math.round(t / 60)}M TO FULL` : 'CHARGING') : (t > 0 ? `${Math.round(t / 60)}M LEFT` : 'ON BATTERY');
    ctx.fillText(status, w - 2, h - 6);
    ctx.textAlign = 'left';
  };
  return <HudCanvas title="POWER CELL" code="BAT-13" draw={draw} height={120} />;
};

// ── 14. NETWORK UPLINK — downlink / rtt / link state ─────────────────────────
export const NetworkUplink: React.FC = () => {
  const hist = useRef<number[]>(Array(40).fill(0.3));
  const acc = useRef(0);
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood);
    const up = tel.online; const cc: RGB = up ? c : RED;
    // scrolling throughput history (downlink normalized)
    acc.current += d.dt;
    while (acc.current > 0.08) { acc.current -= 0.08; hist.current.push(up ? clamp01(tel.downlinkMbps / 10) : 0); hist.current.shift(); }
    // top line: big downlink readout + units
    ctx.shadowBlur = 0; ctx.textAlign = 'left'; ctx.fillStyle = rgba(cc, 0.96); ctx.font = '700 18px Orbitron, sans-serif';
    ctx.fillText(up ? tel.downlinkMbps.toFixed(1) : '—', 4, 22);
    ctx.font = '8px Orbitron, sans-serif'; ctx.fillStyle = rgba(cc, 0.55); ctx.fillText('Mb/s', 4, 33);
    // right: rtt + status chip
    ctx.textAlign = 'right'; ctx.fillStyle = rgba(cc, 0.85); ctx.font = '700 11px Orbitron, sans-serif';
    ctx.fillText(up ? `${Math.round(tel.rttMs)}ms` : 'OFFLINE', w - 4, 16);
    ctx.font = '7px Orbitron, sans-serif'; ctx.fillStyle = rgba(cc, 0.55);
    ctx.fillText((tel.networkSupported ? tel.effectiveType.toUpperCase() : 'LINK') + (tel.saveData ? ' · SAVE' : ''), w - 4, 28);
    ctx.textAlign = 'left';
    // throughput sparkline (area + line) along the lower band
    const top = 42, plotH = h - top - 8, M = hist.current.length;
    const ly = (v: number) => top + (1 - v) * plotH;
    plotGrid(ctx, c, 0, top, w, plotH, 6, 2);                                      // structured plot field
    // corner scale labels (the reference over-labels every graph)
    ctx.shadowBlur = 0; ctx.fillStyle = rgba(c, 0.4); ctx.font = '6px Orbitron, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('0', 2, h - 5); ctx.textAlign = 'right'; ctx.fillText('10M', w - 2, top + 7); ctx.textAlign = 'left';
    const g = ctx.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, rgba(cc, 0.3)); g.addColorStop(1, rgba(cc, 0.02));
    ctx.beginPath(); ctx.moveTo(0, h);
    hist.current.forEach((v, i) => ctx.lineTo((i / (M - 1)) * w, ly(v)));
    ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    glowStroke(ctx, cc, 6, 1.4); ctx.beginPath();
    hist.current.forEach((v, i) => { const x = (i / (M - 1)) * w; i === 0 ? ctx.moveTo(x, ly(v)) : ctx.lineTo(x, ly(v)); });
    ctx.stroke(); ctx.shadowBlur = 0;
    baselineDots(ctx, c, 2, w - 2, h - 3, 12, 1);                                  // baseline tick-dots
    // leading scan dot
    ctx.beginPath(); ctx.arc(w - 1, ly(hist.current[M - 1]), 2, 0, TAU); ctx.fillStyle = rgba(cc, 0.95); ctx.shadowColor = rgba(cc, 0.9); ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0;
  };
  return <HudCanvas title="NETWORK UPLINK" code="NET-14" draw={draw} height={132} />;
};

// ── 15. AGENT CORTEX — the J.A.R.V.I.S. agent's own live telemetry ────────────
// The keystone AI panel: a pulsing neural core whose mode reads the agent's activity
// (idle / reasoning / transmitting), glow = intensity, accent = mood, with a live
// token-rate scroll bar and the agent's status label. Reads d.a exclusively.
export const AgentCortex: React.FC = () => {
  const st = useRef({ ring: 0, pulse: 0, glow: 0.5, lastPulse: 0, flash: 0, tps: 0 });
  const tpsHist = useRef<number[]>(Array(36).fill(0));
  const acc = useRef(0);
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a } = d; const c = moodColor(a.mood); const e = energyOf(a);
    const s = st.current;
    const speaking = a.activity === 'speaking', thinking = a.activity === 'thinking';
    s.ring += d.dt * (thinking ? 1.6 : speaking ? 2.6 : 0.4);                     // spin rate ← activity
    s.glow = follow(s.glow, 0.3 + a.intensity * 0.7, 0.06);
    s.tps = follow(s.tps, a.tps, 0.2);
    if (a.alertPulse !== s.lastPulse) { s.flash = 1; s.lastPulse = a.alertPulse; }
    s.flash = Math.max(0, s.flash - d.dt * 2);
    acc.current += d.dt; while (acc.current > 0.06) { acc.current -= 0.06; tpsHist.current.push(clamp01(a.tps / 40)); tpsHist.current.shift(); }
    const cx = w / 2, cy = h / 2 - 6, R = Math.min(w, h) / 2 - 22;
    // outer reasoning ring — dashed arc segments rotating
    const segN = 12;
    for (let i = 0; i < segN; i++) { const a0 = s.ring + (i / segN) * TAU; const lit = (i % 3 === 0) || thinking; ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + TAU / segN * 0.6); ctx.strokeStyle = rgba(c, lit ? 0.5 + e * 0.4 : 0.16); ctx.lineWidth = lit ? 2 : 1; ctx.shadowColor = rgba(c, 0.8); ctx.shadowBlur = lit ? 6 : 0; ctx.stroke(); }
    ctx.shadowBlur = 0;
    // inner counter-rotating tick ring
    for (let i = 0; i < 24; i++) { const a0 = -s.ring * 0.6 + (i / 24) * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a0) * (R - 8), cy + Math.sin(a0) * (R - 8)); ctx.lineTo(cx + Math.cos(a0) * (R - 12), cy + Math.sin(a0) * (R - 12)); ctx.strokeStyle = rgba(c, 0.22); ctx.lineWidth = 1; ctx.stroke(); }
    // pulsing core
    const beat = speaking ? (0.5 + 0.5 * Math.sin(d.t * TAU * Math.max(1.5, s.tps / 6 + 1.5))) : thinking ? (0.5 + 0.5 * Math.sin(d.t * 3)) : (0.5 + 0.5 * Math.sin(d.t * 1.2));
    const coreR = (R * 0.34) * (0.8 + beat * 0.25) * (0.7 + s.glow * 0.5);
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, coreR + 4);
    g.addColorStop(0, rgba(c, 0.9)); g.addColorStop(0.6, rgba(c, 0.3)); g.addColorStop(1, rgba(c, 0.02));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, coreR + 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, TAU); ctx.strokeStyle = rgba(c, 0.8 + s.flash * 0.2); ctx.lineWidth = 1.5; ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 10 * (0.5 + beat); ctx.stroke(); ctx.shadowBlur = 0;
    if (s.flash > 0.01) { ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, TAU); ctx.strokeStyle = rgba([255, 75, 75], s.flash * 0.8); ctx.lineWidth = 2; ctx.stroke(); }
    // activity label
    const act = thinking ? 'REASONING' : speaking ? 'TRANSMITTING' : 'IDLE';
    ctx.textAlign = 'center'; ctx.fillStyle = rgba(c, 0.55); ctx.font = '7px Orbitron, sans-serif'; ctx.fillText(act, cx, cy + 3);
    // token-rate bar along the bottom
    const by = h - 12, bw = w - 16;
    ctx.textAlign = 'left'; ctx.font = '7px Orbitron, sans-serif'; ctx.fillStyle = rgba(c, 0.5); ctx.fillText('TOK/S', 8, by - 4);
    ctx.textAlign = 'right'; ctx.fillStyle = rgba(c, 0.9); ctx.fillText(String(Math.round(a.tps)), w - 8, by - 4);
    ctx.textAlign = 'left';
    const M = tpsHist.current.length, cw2 = bw / M;
    for (let i = 0; i < M; i++) { const v = tpsHist.current[i]; if (v <= 0) continue; ctx.fillStyle = rgba(c, 0.3 + v * 0.6); ctx.fillRect(8 + i * cw2, by + 6 - v * 6, cw2 - 1, v * 6 + 1); }
  };
  return <HudCanvas title="AGENT CORTEX" code="AI-15" draw={draw} height={150} />;
};

// ── 16. STORAGE VAULT — origin storage usage (used / quota) ───────────────────
export const StorageVault: React.FC = () => {
  const st = useRef({ v: 0.12 });
  const ROWS = 2, SEG = 16;
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood);
    const s = st.current; s.v = follow(s.v, clamp01(tel.storageLoad), 0.08);
    ctx.shadowBlur = 0; ctx.textAlign = 'left'; ctx.font = '8px Orbitron, sans-serif'; ctx.fillStyle = rgba(c, 0.5);
    ctx.fillText('USED', 2, 12);
    ctx.textAlign = 'right'; ctx.fillStyle = rgba(c, 0.95); ctx.font = '700 11px Orbitron, sans-serif';
    ctx.fillText(Math.round(s.v * 100) + '%', w - 2, 12);
    ctx.textAlign = 'left';
    // two rows of block segments forming a "disc" fill (sequential)
    const total = ROWS * SEG, lit = Math.round(s.v * total);
    const top = 20, rowH = (h - top - 16) / ROWS, gap = 3;
    const sw = (w - 4 - gap * (SEG - 1)) / SEG;
    for (let r = 0; r < ROWS; r++) {
      for (let i = 0; i < SEG; i++) {
        const idx = r * SEG + i, on = idx < lit, lead = on && idx === lit - 1;
        const al = on ? (lead ? 0.55 + 0.45 * Math.sin(d.t * TAU * 1.5) : 0.8) : 0.12;
        ctx.fillStyle = rgba(c, al); ctx.shadowColor = rgba(c, 0.7); ctx.shadowBlur = on ? 4 : 0;
        ctx.fillRect(2 + i * (sw + gap), top + r * rowH, sw, rowH - gap);
      }
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(c, 0.6); ctx.font = '8px Orbitron, sans-serif'; ctx.textAlign = 'left';
    const free = tel.storageSupported ? `${fmtMB(Math.max(0, tel.storageQuotaMB - tel.storageUsageMB))}B FREE` : 'ORIGIN QUOTA';
    ctx.fillText(free, 2, h - 4);
    ctx.textAlign = 'right'; ctx.fillStyle = rgba(c, 0.4);
    ctx.fillText(tel.storageSupported ? fmtMB(tel.storageQuotaMB) + 'B' : 'EST', w - 2, h - 4);
    ctx.textAlign = 'left';
  };
  return <HudCanvas title="STORAGE VAULT" code="STO-16" draw={draw} height={120} />;
};

// ── 17. RENDER / FPS — real frame-rate history + budget redline ──────────────
export const RenderFps: React.FC = () => {
  const hist = useRef<number[]>(Array(72).fill(60));
  const acc = useRef(0);
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, tel } = d; const c = moodColor(a.mood);
    acc.current += d.dt; while (acc.current > 0.05) { acc.current -= 0.05; hist.current.push(tel.fps); hist.current.shift(); }
    const cap = Math.max(tel.refreshHz, 60);
    const headY = 14;
    ctx.shadowBlur = 0; ctx.textAlign = 'left'; ctx.font = '700 16px Orbitron, sans-serif';
    const good = tel.fps >= cap * 0.85; ctx.fillStyle = rgba(good ? c : RED, 0.96);
    ctx.fillText(Math.round(tel.fps) + '', 4, headY + 4);
    ctx.font = '8px Orbitron, sans-serif'; ctx.fillStyle = rgba(c, 0.5); ctx.fillText('FPS', 40, headY + 4);
    ctx.textAlign = 'right'; ctx.fillStyle = rgba(c, 0.6); ctx.font = '8px Orbitron, sans-serif';
    ctx.fillText(`${tel.frameMs.toFixed(1)}ms · ${cap}Hz`, w - 2, headY + 2);
    ctx.textAlign = 'left';
    // plot fps history; baseline at refresh cap, redline marks the budget
    const top = headY + 8, plotH = h - top - 8, M = hist.current.length;
    const ly = (fps: number) => top + (1 - clamp01(fps / cap)) * plotH;
    plotGrid(ctx, c, 0, top, w, plotH, 6, 2);                                      // structured plot field
    ctx.strokeStyle = rgba(c, 0.12); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(w, top); ctx.stroke();
    ctx.fillStyle = rgba(c, 0.4); ctx.font = '6px Orbitron, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(String(cap), w - 2, top + 7); ctx.fillText('0', w - 2, h - 5); ctx.textAlign = 'left';
    // redline at 85% of refresh (frame-budget threshold)
    ctx.strokeStyle = rgba([255, 75, 75], 0.3); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(0, ly(cap * 0.85)); ctx.lineTo(w, ly(cap * 0.85)); ctx.stroke(); ctx.setLineDash([]);
    const g = ctx.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, rgba(c, 0.28)); g.addColorStop(1, rgba(c, 0.02));
    ctx.beginPath(); ctx.moveTo(0, h);
    hist.current.forEach((v, i) => ctx.lineTo((i / (M - 1)) * w, ly(v)));
    ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    glowStroke(ctx, c, 7, 1.5); ctx.beginPath();
    hist.current.forEach((v, i) => { const x = (i / (M - 1)) * w; i === 0 ? ctx.moveTo(x, ly(v)) : ctx.lineTo(x, ly(v)); });
    ctx.stroke(); ctx.shadowBlur = 0;
    baselineDots(ctx, c, 2, w - 2, h - 3, 12, 1);                                  // baseline tick-dots
    ctx.beginPath(); ctx.arc(w - 1, ly(hist.current[M - 1]), 2, 0, TAU); ctx.fillStyle = rgba(c, 0.95); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0;
  };
  return <HudCanvas title="RENDER / FPS" code="FPS-17" draw={draw} height={120} />;
};
