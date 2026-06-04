import React, { useEffect, useState } from 'react';
import { HandTrackingState } from '../../types';
import { HandCtx } from './HudCanvas';
import {
  RadarSweep, WaveformMonitor, SpectrumBars, RadialGauges, NetworkGraph, OrbitalScanner, LoadDistribution,
  EnergyReserves, PowerDistributionGrid, TelemetryMultigraph,
} from './instruments';
import {
  CoreThreads, MemoryAllocation, PowerCell, NetworkUplink, AgentCortex, StorageVault, RenderFps,
} from './telemetryPanels';
import { VersionControlCore, RepositoryMatrix, CommitStream } from './gitPanels';

// ── GestureDeck ──────────────────────────────────────────────────────────────
// The live instrument deck framing the central reactor. Every panel reads the machine's
// real telemetry (battery / cpu cores+load / heap / network / fps / storage) and the
// J.A.R.V.I.S. agent every frame, so the whole dashboard shows real-time stats.
//   • left column (3) + bottom row (4)  — the original instruments
//   • top band (3)                      — the reference video's telemetry panels
//     (0:54–0:59 ENERGY RESERVES, 1:07–1:11 POWER DISTRIBUTION, 1:30–1:32 TELEMETRY
//     MULTIGRAPH), mounted only on wide+tall viewports via .deck-topband
//   • seven new real-telemetry instruments (CPU cores, heap, battery, network, AI agent,
//     storage, render) placed in measured console-free zones.
//
// Layout guarantee: the bottom-right JARVIS console is anchored bottom-6 right-6 with a
// fixed height of min(520px, 70vh) → its box is [vw-404 .. vw-24] × [vh-544 .. vh-24] for
// vh≥760. Every new right-side panel therefore satisfies (right ≤ vw-404) OR (bottom ≤
// vh-544); left-side panels are always console-free. The centred reactor dial and the
// top-right AUX-systems list are likewise cleared. pointer-events:none throughout so the
// deck never blocks the reactor drag/orbit or the console.

interface GestureDeckProps { handTrackingRef: React.MutableRefObject<HandTrackingState>; }

// Live viewport size (jsdom/SSR-safe — starts at 0×0 so unit tests render only the
// always-on panels; real browsers fill it on mount + resize).
function useViewport() {
  const [v, setV] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setV({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);
  return v;
}

const GestureDeck: React.FC<GestureDeckProps> = ({ handTrackingRef }) => {
  const { w, h } = useViewport();
  // console-free placement gates (see header). All derived from the console box above.
  const gRenderFps = w >= 1440 && h >= 760;        // left band, clears bottom row
  const gAgentCortex = w >= 1180 && h >= 920;      // left band, lower slot
  const gNetUplink = w >= 1440 && h >= 960;        // right band, bottom ≤ console top
  const gCoreThreads = w >= 1180 && h >= 1000;     // right edge, above the console
  const gInnerRight = w >= 1720 && h >= 820;       // inner-right column, left of the console
  const gPowerCell = w >= 1560;                    // bottom slot, left of the console
  // Version-control rail — JARVIS's autonomous git faculty. Far-left column (x16–224),
  // below CORE GAUGES (ends ~630) and above the bottom row (top ≈ h−158). This column has
  // no other optional panels, so the rail can never collide with them or the bottom-right
  // console; progressive height gates keep each panel clear of the bottom row.
  const gGitCore = w >= 1440 && h >= 1000;         // hero radial — clears bottom row at h≥1000
  const gGitMatrix = w >= 1440 && h >= 1210;       // repo status cards
  const gGitStream = w >= 1440 && h >= 1380;       // commit/sync trend

  return (
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

        {/* ── new real-telemetry instruments — measured console-free placement ── */}
        {/* left band, below the reference telemetry panels (console is bottom-right) */}
        {gRenderFps && <div className="absolute top-[432px] left-[236px] w-[180px]"><RenderFps /></div>}
        {gAgentCortex && <div className="absolute top-[596px] left-[236px] w-[180px]"><AgentCortex /></div>}
        {/* right band, above the console top (bottom ≤ vh-544) */}
        {gNetUplink && <div className="absolute top-[268px] right-[260px] w-[180px]"><NetworkUplink /></div>}
        {/* right edge, above the console (bottom 442 ≤ console top) */}
        {gCoreThreads && <div className="absolute top-[288px] right-4 w-[208px]"><CoreThreads /></div>}
        {/* inner-right column — entirely left of the console (right ≤ vw-404) */}
        {gInnerRight && (
          <>
            <div className="absolute top-[288px] right-[450px] w-[170px]"><MemoryAllocation /></div>
            <div className="absolute top-[454px] right-[450px] w-[170px]"><StorageVault /></div>
          </>
        )}
        {/* bottom slot between the power trunk and the console (extra-wide only) */}
        {gPowerCell && <div className="absolute left-[992px] bottom-4 w-[150px]"><PowerCell /></div>}

        {/* ── version-control rail — far-left column, always console-free ── */}
        {gGitCore && <div className="absolute left-4 top-[632px] w-[208px]"><VersionControlCore /></div>}
        {gGitMatrix && <div className="absolute left-4 top-[822px] w-[208px]"><RepositoryMatrix /></div>}
        {gGitStream && <div className="absolute left-4 top-[1030px] w-[208px]"><CommitStream /></div>}
      </div>
    </HandCtx.Provider>
  );
};

export default GestureDeck;
