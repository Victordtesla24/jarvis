import React, { createContext, useContext, useEffect, useRef } from 'react';
import { HandTrackingState } from '../../types';
import { AgentState } from '../../services/agentState';
import { Telemetry, TelemetrySnapshot } from '../../services/telemetryBus';
import { GitBus, GitSnapshot } from '../../services/gitBus';
import { deriveSignals, agent, HandSignals } from './shared';

// React context carrying the live hand-tracking ref down to every instrument,
// so widgets stay declarative (<RadarSweep/>) with no prop drilling.
export const HandCtx = createContext<React.MutableRefObject<HandTrackingState> | null>(null);
export const useHands = () => useContext(HandCtx);

export interface DrawCtx {
  ctx: CanvasRenderingContext2D;
  t: number;            // seconds since mount
  dt: number;           // seconds since last frame (clamped)
  w: number; h: number;
  sig: HandSignals;     // live gesture signals
  a: AgentState;        // live agent state
  tel: TelemetrySnapshot; // live machine telemetry (battery/cpu/mem/net/fps/…)
  git: GitSnapshot;     // live version-control telemetry (repos/risk/snapshots) — daemon-fed
}
export type DrawFn = (d: DrawCtx) => void;

interface HudCanvasProps {
  title: string;
  code?: string;          // small corner code, e.g. "SYS-04"
  draw: DrawFn;
  className?: string;
  height?: number;
}

// A self-contained instrument frame: titled chrome + a DPR-correct 2D canvas
// driven by one rAF loop that hands the draw fn live gesture + agent signals.
const HudCanvas: React.FC<HudCanvasProps> = ({ title, code, draw, className, height = 150 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handRef = useHands();
  const raf = useRef<number | null>(null);
  const t0 = useRef<number | null>(null);
  const last = useRef(0);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    Telemetry.start(); // idempotent — begins live machine-telemetry sampling once
    GitBus.start();    // idempotent — opens the live version-control link to the daemon
    const loop = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        if (t0.current == null) { t0.current = now; last.current = now; }
        const t = (now - t0.current) / 1000;
        const dt = Math.min(0.05, (now - last.current) / 1000);
        last.current = now;

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cssW = canvas.clientWidth || 240, cssH = canvas.clientHeight || height;
        if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
          canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);
        const sig = handRef ? deriveSignals(handRef.current) : deriveSignals({ leftHand: null, rightHand: null });
        try { drawRef.current({ ctx, t, dt, w: cssW, h: cssH, sig, a: agent(), tel: Telemetry.get(), git: GitBus.get() }); } catch { /* keep the deck alive */ }
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [handRef, height]);

  return (
    <div
      className={`relative pointer-events-none ${className ?? ''}`}
      style={{
        background: 'linear-gradient(150deg, rgba(0,18,28,0.42), rgba(0,8,16,0.32))',
        border: '1px solid rgba(0,240,255,0.22)',
        boxShadow: 'inset 0 0 22px rgba(0,80,120,0.10)',
        backdropFilter: 'blur(2px)',
        clipPath: 'polygon(0 8px, 8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)',
      }}
    >
      <div className="flex items-center justify-between px-2 pt-1.5 pb-0.5">
        <span className="font-display text-[8px] tracking-[0.22em] text-holo-cyan/70">{title}</span>
        {code && <span className="font-mono text-[7px] tracking-[0.15em] text-holo-cyan/35">{code}</span>}
      </div>
      <canvas ref={canvasRef} className="block w-full" style={{ height }} />
      <span className="absolute top-0 right-0 w-3 h-[1px] bg-holo-cyan/50" />
      <span className="absolute top-0 right-0 w-[1px] h-3 bg-holo-cyan/50" />
    </div>
  );
};

export default HudCanvas;
