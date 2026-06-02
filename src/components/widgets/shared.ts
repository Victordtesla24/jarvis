import { HandTrackingState } from '../../types';
import { AgentState, AgentBus } from '../../services/agentState';

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

// smooth one-pole follower (frame-rate tolerant enough for ~60fps HUD widgets)
export function follow(cur: number, target: number, rate: number): number {
  return cur + (target - cur) * rate;
}
