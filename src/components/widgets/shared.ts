import { HandTrackingState } from '../../types';
import { AgentState, AgentBus } from '../../services/agentState';
import { Telemetry, TelemetrySnapshot } from '../../services/telemetryBus';
import { GitBus, GitSnapshot } from '../../services/gitBus';

// ── Shared helpers for the gesture-driven instrument deck ────────────────────
// Every widget is a lightweight Canvas-2D instrument (kept off the WebGL context
// budget — the reactor + globe own that) that reads two live signals each frame:
//   • the operator's HANDS  (deriveSignals → expansion / spread / rotation / pinch)
//   • the J.A.R.V.I.S. agent (AgentBus → mood / intensity / activity / highlight)
// so the whole dashboard breathes with the user's gestures AND the AI's state.

export interface HandSignals {
  present: boolean;     // any hand tracked
  expansion: number;    // 0..1 mean fingertip spread of tracked hands
  spread: number;       // 0..1 two-hand separation (same metric the reactor uses)
  rotX: number;         // -1..1 primary-hand joystick X
  rotY: number;         // -1..1 primary-hand joystick Y
  pinch: number;        // 0..1 (1 = pinching)
  handX: number;        // 0..1 primary hand screen position (mirrored)
  handY: number;
}

export function deriveSignals(s: HandTrackingState): HandSignals {
  const l = s.leftHand, r = s.rightHand;
  const hands = [l, r].filter(Boolean) as NonNullable<typeof l>[];
  const present = hands.length > 0;
  const expansion = present ? hands.reduce((a, h) => a + h.expansionFactor, 0) / hands.length : 0;
  let spread = 0;
  if (l?.landmarks?.length && r?.landmarks?.length) {
    const lw = l.landmarks[0], rw = r.landmarks[0];
    const dd = Math.hypot(lw.x - rw.x, lw.y - rw.y);
    spread = Math.max(0, Math.min(1, (dd - 0.16) / 0.46));
  }
  const primary = r ?? l;
  return {
    present,
    expansion,
    spread,
    rotX: primary?.rotationControl.x ?? 0,
    rotY: primary?.rotationControl.y ?? 0,
    pinch: primary?.isPinching ? 1 : (primary?.pinchDistance != null ? 1 - Math.min(1, primary.pinchDistance) : 0),
    handX: primary ? 1 - primary.landmarks[0].x : 0.5,
    handY: primary ? primary.landmarks[0].y : 0.5,
  };
}

// mood → primary accent (rgb tuple so callers can build rgba() with any alpha)
export type RGB = [number, number, number];
export function moodColor(mood: AgentState['mood']): RGB {
  switch (mood) {
    case 'alert': return [255, 42, 42];
    case 'success': return [91, 232, 160];
    case 'scanning': return [25, 227, 194];
    case 'busy': return [0, 163, 255];
    default: return [0, 240, 255]; // calm — holo cyan
  }
}
export const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function agent(): AgentState { return AgentBus.get(); }
export function telemetry(): TelemetrySnapshot { return Telemetry.get(); }
export function gitState(): GitSnapshot { return GitBus.get(); }

// compact relative-age formatter for git readouts: 8 → "8s", 95 → "1m", 7200 → "2h".
export function ageShort(sec: number): string {
  if (sec < 0) return '—';
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}

// smooth one-pole follower (frame-rate tolerant enough for ~60fps HUD widgets)
export function follow(cur: number, target: number, rate: number): number {
  return cur + (target - cur) * rate;
}

// ── shared drawing / signal helpers (used by every instrument) ───────────────
export const TAU = Math.PI * 2;
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// energy = how "awake" the deck is: agent intensity + a kick while it thinks/speaks,
// plus a small lift from live token throughput (real AI telemetry).
export function energyOf(a: AgentState): number {
  const act = a.activity === 'speaking' ? 0.4 : a.activity === 'thinking' ? 0.25 : 0;
  return clamp01(a.intensity * 0.7 + act + Math.min(0.2, (a.tps ?? 0) / 120));
}

// configure a glowing stroke (single shadow pass)
export function glowStroke(ctx: CanvasRenderingContext2D, c: RGB, blur: number, width: number) {
  ctx.strokeStyle = rgba(c, 1); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = blur; ctx.lineWidth = width;
}

// two-tier bloom: a wide soft pass behind a crisp core pass (the "expensive" glow tell).
// `path` is replayed twice; never apply this to text.
export function bloom(ctx: CanvasRenderingContext2D, c: RGB, core: number, path: () => void) {
  ctx.lineWidth = core * 4; ctx.strokeStyle = rgba(c, 0.14); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = core * 6;
  path(); ctx.stroke();
  ctx.lineWidth = core; ctx.strokeStyle = rgba(c, 1); ctx.shadowBlur = 0;
  path(); ctx.stroke();
}

// A faint plot micro-grid behind graph data (the reference's per-panel structure).
export function plotGrid(ctx: CanvasRenderingContext2D, c: RGB, x: number, y: number, w: number, h: number, cols = 6, rows = 3) {
  ctx.shadowBlur = 0; ctx.lineWidth = 1; ctx.strokeStyle = rgba(c, 0.06);
  for (let i = 1; i < cols; i++) { const gx = x + (w * i) / cols; ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
  for (let i = 1; i < rows; i++) { const gy = y + (h * i) / rows; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }
}

// A row of evenly-spaced baseline tick-dots (the LEVELS/PROCESS graph signature). The dot
// nearest `peakU` (0..1 along the axis) brightens, the way the reference marks the live peak.
export function baselineDots(ctx: CanvasRenderingContext2D, c: RGB, x0: number, x1: number, y: number, n = 12, peakU = -1) {
  ctx.shadowBlur = 0;
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) : 0;
    const near = peakU >= 0 && Math.abs(u - peakU) < 0.5 / n;
    ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * u, y, near ? 1.8 : 1.1, 0, TAU);
    ctx.fillStyle = rgba(c, near ? 0.9 : 0.4); ctx.fill();
  }
}
