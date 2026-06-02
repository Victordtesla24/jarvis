import React from 'react';
import { HandTrackingState } from '../../types';
import { HandCtx } from './HudCanvas';
import { RadarSweep, WaveformMonitor, SpectrumBars, RadialGauges, NetworkGraph, OrbitalScanner } from './instruments';

// ── GestureDeck ──────────────────────────────────────────────────────────────
// Six gesture-driven, AI-modulated instruments in a collision-free L-layout that
// frames the central reactor: a left column (3) and a bottom row (3), clear of the
// top status strip, the AUX-systems list (top-right) and the JARVIS console
// (bottom-right). Provides the live hand-tracking ref to the whole deck via context.
// pointer-events:none so it never blocks the reactor drag/orbit or the console.

interface GestureDeckProps { handTrackingRef: React.MutableRefObject<HandTrackingState>; }

const GestureDeck: React.FC<GestureDeckProps> = ({ handTrackingRef }) => (
  <HandCtx.Provider value={handTrackingRef}>
    <div className="absolute inset-0 z-[15] pointer-events-none">
      {/* left column */}
      <div className="absolute left-4 top-[128px] w-[208px]"><RadarSweep /></div>
      <div className="absolute left-4 top-[294px] w-[208px]"><NetworkGraph /></div>
      <div className="absolute left-4 top-[460px] w-[208px]"><RadialGauges /></div>
      {/* bottom row (left of the console) */}
      <div className="absolute left-4 bottom-4 w-[236px]"><SpectrumBars /></div>
      <div className="absolute left-[256px] bottom-4 w-[256px]"><WaveformMonitor /></div>
      <div className="absolute left-[528px] bottom-4 w-[208px]"><OrbitalScanner /></div>
    </div>
  </HandCtx.Provider>
);

export default GestureDeck;
