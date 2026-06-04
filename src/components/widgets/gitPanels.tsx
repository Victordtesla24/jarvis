import React, { useRef } from 'react';
import HudCanvas, { DrawFn } from './HudCanvas';
import { moodColor, rgba, follow, RGB, TAU, clamp01, glowStroke, plotGrid, baselineDots, ageShort } from './shared';

// ── Version-control instruments ──────────────────────────────────────────────
// Three panels that surface J.A.R.V.I.S.'s autonomous git faculty in real time —
// each reads d.git (the live GitBus, fed by the host git daemon) every frame, so
// the dashboard reflects the true state of every repository the instant it changes
// (including commits J.A.R.V.I.S. itself makes). Same cyan holographic language as
// the rest of the deck; non-cyan only on a real signal (amber = work at risk, red =
// loss-imminent / dirty-on-protected, green = fully secured). Modelled on the
// reference reel's element library (youtu.be/yXpkIrR81w8): Frame-4 radial progress,
// Frame-2 status cards, Frame-3 circuit-flow + Frame-5 scrolling level graph.

const GREEN: RGB = [91, 232, 160];
const AMBER: RGB = [255, 196, 80];
const RED: RGB = [255, 75, 75];
const riskColor = (r: number): RGB => (r >= 0.66 ? RED : r >= 0.33 ? AMBER : GREEN);
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// Honest "daemon offline" state: a dim frame + caption. Returns true when it drew it,
// so each panel can early-out. Always paints, so the deck never shows a blank tile.
function linkDown(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const dim: RGB = [120, 150, 165];
  ctx.shadowBlur = 0; ctx.strokeStyle = rgba(dim, 0.18); ctx.lineWidth = 1;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  const pulse = 0.35 + 0.25 * Math.sin(t * 2);
  ctx.textAlign = 'center'; ctx.fillStyle = rgba(dim, pulse); ctx.font = '700 10px Orbitron, sans-serif';
  ctx.fillText('VC LINK DOWN', w / 2, h / 2 - 2);
  ctx.fillStyle = rgba(dim, 0.3); ctx.font = '7px Orbitron, sans-serif';
  ctx.fillText('git daemon offline', w / 2, h / 2 + 12);
  ctx.textAlign = 'left';
}

// ── 18. VERSION CONTROL CORE — preservation-integrity radial gauge ────────────
// The keystone git panel: a radial progress dial whose fill is how SECURED the work
// is (1 − mean loss-risk), ringed by one dot per repo (green→amber→red by risk), with
// a continuous scanner sweep and a "WIP PROTECTED ⟵ age" readout — the live proof the
// daemon is snapshotting. Goes red the moment any repo's work is at imminent risk.
export const VersionControlCore: React.FC = () => {
  const st = useRef({ v: 1, sweep: 0, flash: 0 });
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, git, t } = d;
    if (!git.connected) return linkDown(ctx, w, h, t);
    const c = moodColor(a.mood);
    const s = st.current;
    const sm = git.summary;
    const integrity = clamp01(1 - sm.avgRisk);
    s.v = follow(s.v, integrity, 0.06);
    s.sweep = (s.sweep + d.dt * 0.22) % 1;
    const danger = sm.maxRisk >= 0.66 || sm.protectedDirty > 0;
    const cc: RGB = danger ? RED : integrity > 0.92 ? GREEN : c;

    const cx = w / 2, cy = h / 2 + 6, R = Math.min(w, h) / 2 - 18;
    // outer ring of repo dots — one per watched repo, coloured by its risk
    const reps = git.repos;
    const dotN = Math.min(reps.length, 28);
    for (let i = 0; i < dotN; i++) {
      const ang = -Math.PI / 2 + (i / Math.max(1, dotN)) * TAU;
      const rc = riskColor(reps[i].risk);
      const rr = R + 7;
      const pulse = reps[i].risk >= 0.66 ? 0.5 + 0.5 * Math.sin(t * 6 + i) : 1;
      ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 1.8, 0, TAU);
      ctx.fillStyle = rgba(rc, 0.4 + 0.5 * pulse); ctx.shadowColor = rgba(rc, 0.8); ctx.shadowBlur = 4; ctx.fill();
    }
    ctx.shadowBlur = 0;
    // base track + progress arc (two-tier bloom hero)
    ctx.beginPath(); ctx.arc(cx, cy, R - 4, 0, TAU); ctx.strokeStyle = rgba(c, 0.12); ctx.lineWidth = 3.4; ctx.stroke();
    const a0 = -Math.PI / 2, a1 = a0 + TAU * s.v;
    glowStroke(ctx, cc, 11, 3.4); ctx.beginPath(); ctx.arc(cx, cy, R - 4, a0, a1); ctx.stroke(); ctx.shadowBlur = 0;
    // scanner sweep with comet trail
    const sa = a0 + s.sweep * TAU;
    for (let k = 0; k < 9; k++) { const aa = sa - k * 0.05; ctx.beginPath(); ctx.arc(cx + Math.cos(aa) * (R - 4), cy + Math.sin(aa) * (R - 4), 1.5, 0, TAU); ctx.fillStyle = rgba(c, 0.45 * (1 - k / 9)); ctx.fill(); }
    // centre readout
    ctx.textAlign = 'center';
    ctx.fillStyle = rgba(cc, 0.97); ctx.font = '700 22px Orbitron, sans-serif';
    ctx.fillText(Math.round(s.v * 100) + '%', cx, cy + 2);
    ctx.fillStyle = rgba(c, 0.45); ctx.font = '7px Orbitron, sans-serif'; ctx.fillText('SECURED', cx, cy - 16);
    const snap = sm.lastSnapshotAgeSec;
    ctx.fillStyle = rgba(snap >= 0 && snap < 200 ? GREEN : c, 0.6); ctx.font = '7px Orbitron, sans-serif';
    ctx.fillText(snap >= 0 ? `WIP SAVED ${ageShort(snap)} AGO` : 'NO WIP YET', cx, cy + 15);
    ctx.textAlign = 'left';
    // corner stats
    ctx.shadowBlur = 0; ctx.font = '8px Orbitron, sans-serif';
    ctx.textAlign = 'left'; ctx.fillStyle = rgba(c, 0.55); ctx.fillText(`${sm.repos} REPOS`, 3, 11);
    ctx.textAlign = 'right'; ctx.fillStyle = rgba(sm.atRisk ? AMBER : c, 0.7); ctx.fillText(`${sm.atRisk} AT RISK`, w - 3, 11);
    ctx.textAlign = 'left';
  };
  return <HudCanvas title="VERSION CONTROL CORE" code="GIT-18" draw={draw} height={158} />;
};

// ── 19. REPOSITORY MATRIX — per-repo working-tree status cards ─────────────────
// The decision-making panel: one card-row per repo (daemon-sorted most-at-risk first)
// — name · branch · ahead/behind · ±lines · risk bar. Dirty repos carry a pulsing dot;
// dirty-on-protected flags red; the agent can spotlight a repo via its `highlight`.
export const RepositoryMatrix: React.FC = () => {
  const bars = useRef<Record<string, number>>({});
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, git, t } = d;
    if (!git.connected) return linkDown(ctx, w, h, t);
    const c = moodColor(a.mood);
    const sm = git.summary;
    // header
    ctx.shadowBlur = 0; ctx.textAlign = 'left'; ctx.font = '8px Orbitron, sans-serif';
    ctx.fillStyle = rgba(c, 0.55); ctx.fillText('REPOSITORIES', 3, 11);
    ctx.textAlign = 'right'; ctx.fillStyle = rgba(sm.dirty ? AMBER : c, 0.8); ctx.font = '700 9px Orbitron, sans-serif';
    ctx.fillText(`${sm.dirty}/${sm.repos} DIRTY`, w - 3, 11);
    ctx.textAlign = 'left';
    const top = 18, rowH = 19, maxRows = Math.max(1, Math.floor((h - top - 4) / rowH));
    const reps = git.repos.slice(0, maxRows);
    const spot = (a.highlight || '').toUpperCase();
    for (let i = 0; i < reps.length; i++) {
      const r = reps[i], y = top + i * rowH;
      const rc = riskColor(r.risk);
      const focused = !!spot && (r.name.toUpperCase().includes(spot) || spot.includes(r.name.toUpperCase()));
      // row background + focus bracket
      ctx.fillStyle = rgba(rc, focused ? 0.12 : 0.05); ctx.fillRect(0, y, w, rowH - 2);
      if (focused) { ctx.strokeStyle = rgba(c, 0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(0, y + rowH - 2); ctx.stroke(); }
      // dirty pulse dot
      const pulse = r.dirty ? 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)) : 0.3;
      ctx.beginPath(); ctx.arc(6, y + (rowH - 2) / 2, 2.2, 0, TAU);
      ctx.fillStyle = rgba(r.protected && r.dirty ? RED : rc, pulse); ctx.shadowColor = rgba(rc, 0.7); ctx.shadowBlur = r.dirty ? 5 : 0; ctx.fill(); ctx.shadowBlur = 0;
      // name + branch
      ctx.fillStyle = rgba(c, focused ? 0.98 : 0.85); ctx.font = '700 9px Orbitron, sans-serif';
      ctx.fillText(trunc(r.name, 14), 13, y + 9);
      ctx.fillStyle = rgba(r.protected ? RED : c, 0.5); ctx.font = '7px Orbitron, sans-serif';
      ctx.fillText(trunc(r.branch, 16), 13, y + 16);
      // ahead/behind + ±lines (right-aligned cluster)
      ctx.textAlign = 'right';
      const ab = `${r.ahead ? '↑' + r.ahead : ''}${r.behind ? ' ↓' + r.behind : ''}`.trim();
      ctx.fillStyle = rgba(r.ahead ? AMBER : c, 0.7); ctx.font = '7px Orbitron, sans-serif';
      ctx.fillText(ab || '✓ sync', w - 40, y + 9);
      if (r.added || r.deleted) { ctx.fillStyle = rgba(rc, 0.7); ctx.fillText(`+${r.added} −${r.deleted}`, w - 40, y + 16); }
      ctx.textAlign = 'left';
      // risk bar (far right)
      const bx = w - 34, bw = 30, by = y + 4, bh = rowH - 10;
      const key = r.path; bars.current[key] = follow(bars.current[key] ?? 0, r.risk, 0.12);
      ctx.fillStyle = rgba(c, 0.08); ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = rgba(rc, 0.85); ctx.shadowColor = rgba(rc, 0.7); ctx.shadowBlur = 4;
      ctx.fillRect(bx, by, bw * clamp01(bars.current[key]), bh); ctx.shadowBlur = 0;
    }
    if (git.repos.length > reps.length) {
      ctx.fillStyle = rgba(c, 0.4); ctx.font = '7px Orbitron, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(`+${git.repos.length - reps.length} more`, w - 3, h - 3); ctx.textAlign = 'left';
    }
  };
  return <HudCanvas title="REPOSITORY MATRIX" code="GIT-19" draw={draw} height={176} />;
};

// ── 20. COMMIT STREAM — uncommitted-line history + sync conduit + autosave beat ─
// Frame-3 circuit conduits (flowing dashes whose speed ∝ unpushed throughput) over a
// Frame-5 scrolling area graph of total uncommitted lines, with an autosave-heartbeat
// bar at the foot — the reassuring pulse that every dirty tree is being snapshotted.
export const CommitStream: React.FC = () => {
  const hist = useRef<number[]>(Array(72).fill(0));
  const acc = useRef(0);
  const flow = useRef(0);
  const st = useRef({ lines: 0, lastSnap: -1, beat: 0 });
  const draw: DrawFn = (d) => {
    const { ctx, w, h, a, git, t } = d;
    if (!git.connected) return linkDown(ctx, w, h, t);
    const c = moodColor(a.mood);
    const sm = git.summary;
    const s = st.current;
    s.lines = follow(s.lines, sm.uncommittedLines, 0.1);
    // scrolling history of uncommitted lines (auto-scaled)
    acc.current += d.dt; while (acc.current > 0.08) { acc.current -= 0.08; hist.current.push(sm.uncommittedLines); hist.current.shift(); }
    const peak = Math.max(50, ...hist.current);
    // header readouts
    ctx.shadowBlur = 0; ctx.textAlign = 'left'; ctx.fillStyle = rgba(c, 0.96); ctx.font = '700 17px Orbitron, sans-serif';
    ctx.fillText(String(Math.round(s.lines)), 4, 19);
    ctx.font = '7px Orbitron, sans-serif'; ctx.fillStyle = rgba(c, 0.5); ctx.fillText('UNCOMMITTED Δ', 4, 29);
    ctx.textAlign = 'right'; ctx.font = '700 10px Orbitron, sans-serif';
    ctx.fillStyle = rgba(sm.ahead ? AMBER : c, 0.85); ctx.fillText(sm.ahead ? `↑${sm.ahead} UNPUSHED` : 'IN SYNC', w - 4, 14);
    ctx.fillStyle = rgba(sm.untracked ? AMBER : c, 0.6); ctx.font = '7px Orbitron, sans-serif';
    ctx.fillText(`${sm.untracked} UNTRACKED`, w - 4, 26); ctx.textAlign = 'left';
    // sync conduit — flowing dashes, speed ∝ unpushed work
    flow.current = (flow.current + d.dt * (0.4 + Math.min(2.4, sm.ahead * 0.4))) % 1;
    const cy = 40;
    ctx.setLineDash([6, 6]); ctx.lineDashOffset = -flow.current * 12;
    ctx.strokeStyle = rgba(sm.ahead ? AMBER : c, 0.4); ctx.lineWidth = 1.2; ctx.shadowColor = rgba(c, 0.6); ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.moveTo(2, cy); ctx.lineTo(w - 2, cy); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(c, 0.4); ctx.font = '6px Orbitron, sans-serif'; ctx.fillText('LOCAL', 2, cy - 4);
    ctx.textAlign = 'right'; ctx.fillText('ORIGIN', w - 2, cy - 4); ctx.textAlign = 'left';
    // area graph of uncommitted history
    const top = 48, plotH = h - top - 12, M = hist.current.length;
    const ly = (v: number) => top + (1 - clamp01(v / peak)) * plotH;
    plotGrid(ctx, c, 0, top, w, plotH, 6, 2);
    const g = ctx.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, rgba(c, 0.28)); g.addColorStop(1, rgba(c, 0.02));
    ctx.beginPath(); ctx.moveTo(0, h - 12);
    hist.current.forEach((v, i) => ctx.lineTo((i / (M - 1)) * w, ly(v)));
    ctx.lineTo(w, h - 12); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    glowStroke(ctx, c, 6, 1.4); ctx.beginPath();
    hist.current.forEach((v, i) => { const x = (i / (M - 1)) * w; i === 0 ? ctx.moveTo(x, ly(v)) : ctx.lineTo(x, ly(v)); });
    ctx.stroke(); ctx.shadowBlur = 0;
    baselineDots(ctx, c, 2, w - 2, h - 13, 12, 1);
    // autosave heartbeat bar — flashes when a fresh snapshot lands (age drops)
    const snap = sm.lastSnapshotAgeSec;
    if (snap >= 0 && (s.lastSnap < 0 || snap < s.lastSnap)) s.beat = 1;
    s.lastSnap = snap; s.beat = Math.max(0, s.beat - d.dt * 1.5);
    const fresh = snap >= 0 && snap < 240;
    const bc: RGB = fresh ? GREEN : snap < 0 ? [120, 150, 165] : AMBER;
    const by = h - 9, fillU = snap < 0 ? 0 : clamp01(1 - snap / 300);
    ctx.fillStyle = rgba(bc, 0.1); ctx.fillRect(2, by, w - 4, 5);
    ctx.fillStyle = rgba(bc, 0.55 + s.beat * 0.45); ctx.shadowColor = rgba(bc, 0.8); ctx.shadowBlur = 3 + s.beat * 8;
    ctx.fillRect(2, by, (w - 4) * fillU, 5); ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(bc, 0.7); ctx.font = '6px Orbitron, sans-serif';
    ctx.fillText(`AUTOSAVE · ${sm.snapshots} SNAPSHOTS · ${snap >= 0 ? ageShort(snap) + ' AGO' : 'STANDBY'}`, 3, by - 2);
  };
  return <HudCanvas title="COMMIT STREAM" code="GIT-20" draw={draw} height={150} />;
};
