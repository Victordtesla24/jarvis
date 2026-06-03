import React from 'react';
import { HandTrackingState } from '../../types';
import { HandCtx } from './HudCanvas';
import {
  RadarSweep, WaveformMonitor, SpectrumBars, RadialGauges, NetworkGraph, OrbitalScanner, LoadDistribution,
  EnergyReserves, PowerDistributionGrid, TelemetryMultigraph,
} from './instruments';

// ── GestureDeck ──────────────────────────────────────────────────────────────
// Gesture-driven, AI-modulated instruments in a collision-free layout framing the
// central reactor: a left column (3), a bottom row (4) and a top band (3). The top
// band rebuilds the three panels the reference video (youtu.be/yXpkIrR81w8) shows at
// 0:54–0:59 (ENERGY RESERVES), 1:07–1:11 (POWER DISTRIBUTION) and 1:30–1:32
// (TELEMETRY MULTIGRAPH); it only mounts on wide + tall viewports so it stays clear
// of the top status strip, the AUX-systems list and the centred reactor dial.
// Provides the live hand-tracking ref via context; pointer-events:none throughout so
// it never blocks the reactor drag/orbit or the console.

interface GestureDeckProps { handTrackingRef: React.MutableRefObject<HandTrackingState>; }

const GestureDeck: React.FC<GestureDeckProps> = ({ handTrackingRef }) => (
  <HandCtx.Provider value={handTrackingRef}>
    <div className="absolute inset-0 z-[15] pointer-events-none">
      {/* top band — the reference video's telemetry panels (wide + tall viewports
          only, so they never overlap the clock strip, AUX list or reactor dial) */}
      <div className="deck-topband">
        <div className="absolute top-[104px] left-[236px] w-[180px]"><EnergyReserves /></div>
        <div className="absolute top-[104px] right-[260px] w-[180px]"><PowerDistributionGrid /></div>
        <div className="absolute top-[268px] left-[236px] w-[180px]"><TelemetryMultigraph /></div>
      </div>
      {/* left column */}
      <div className="absolute left-4 top-[128px] w-[208px]"><RadarSweep /></div>
      <div className="absolute left-4 top-[294px] w-[208px]"><NetworkGraph /></div>
      <div className="absolute left-4 top-[460px] w-[208px]"><RadialGauges /></div>
      {/* bottom row (left of the console) */}
      <div className="absolute left-4 bottom-4 w-[236px]"><SpectrumBars /></div>
      <div className="absolute left-[256px] bottom-4 w-[256px]"><WaveformMonitor /></div>
      <div className="absolute left-[528px] bottom-4 w-[208px]"><OrbitalScanner /></div>
      {/* power-trunk flow, filling the gap before the console (wide viewports only,
          so it never collides with the bottom-right JARVIS console) */}
      <div className="hidden min-[1180px]:block absolute left-[744px] bottom-4 w-[224px]"><LoadDistribution /></div>
    </div>
  </HandCtx.Provider>
);

export default GestureDeck;
