import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EnergyReserves, PowerDistributionGrid, TelemetryMultigraph } from './instruments';
import {
  CoreThreads, MemoryAllocation, PowerCell, NetworkUplink, AgentCortex, StorageVault, RenderFps,
} from './telemetryPanels';
import GestureDeck from './GestureDeck';
import { HandTrackingState } from '../../types';
import { Telemetry } from '../../services/telemetryBus';

// These lock in the video-reference dashboard panels rebuilt from youtu.be/yXpkIrR81w8 —
// the three the brief calls out by timestamp, PLUS the seven new real-telemetry panels:
//   • ENERGY RESERVES      @0:54–0:59 — single-colour (cyan) reserve telemetry (now battery/mem/disk/cpu)
//   • POWER DISTRIBUTION    @1:07–1:11 — load-distribution node grid (now per-core)
//   • TELEMETRY MULTIGRAPH  @1:30–1:32 — fps + heap scrolling histories
//   • CORE THREADS / MEMORY ALLOCATION / POWER CELL / NETWORK UPLINK / AGENT CORTEX /
//     STORAGE VAULT / RENDER FPS — the machine + AI-agent telemetry instruments.
// They are Canvas-2D instruments: jsdom returns no 2D context, so the rAF draw is inert by
// default. A fake 2D context is injected to prove the draw paints, and to prove panels are
// wired to the live TelemetryBus (an override flows through to the on-screen readout).

afterEach(() => {
  Telemetry.stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// A counting no-op 2D context that also records the text it paints (so we can assert a
// telemetry value reaches the screen). Gradients answer addColorStop; any draw runs through.
function fakeCtx() {
  const calls: Record<string, number> = {};
  const texts: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = { canvas: {} };
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createConicGradient')
        return () => gradient;
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'fillText') return (s: unknown) => { texts.push(String(s)); calls.fillText = (calls.fillText ?? 0) + 1; };
      return (...args: unknown[]) => { void args; calls[prop] = (calls[prop] ?? 0) + 1; };
    },
    set() { return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, texts };
}

// A queue-based requestAnimationFrame fake: every registered loop (the panel draw loops
// AND the TelemetryBus loop) advances one frame per flush round, for `rounds` rounds. Returns
// a flush() to drive frames AFTER render so effects have registered their loops.
function frameDriver(rounds = 4) {
  let queue: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queue.push(cb); return queue.length; });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  return () => {
    for (let r = 0; r < rounds; r++) {
      const batch = queue; queue = [];
      batch.forEach((cb) => cb((r + 1) * 16));
    }
  };
}

describe('video-reference dashboard panels', () => {
  it('renders the ENERGY RESERVES telemetry panel (0:54–0:59)', () => {
    render(<EnergyReserves />);
    expect(screen.getByText('ENERGY RESERVES')).toBeInTheDocument();
  });

  it('renders the POWER DISTRIBUTION grid panel (1:07–1:11)', () => {
    render(<PowerDistributionGrid />);
    expect(screen.getByText('POWER DISTRIBUTION')).toBeInTheDocument();
  });

  it('renders the TELEMETRY MULTIGRAPH panel (1:30–1:32)', () => {
    render(<TelemetryMultigraph />);
    expect(screen.getByText('TELEMETRY MULTIGRAPH')).toBeInTheDocument();
  });

  it('paints every panel to a 2D context without throwing', () => {
    const { ctx, calls } = fakeCtx();
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const flush = frameDriver();

    render(
      <>
        <EnergyReserves />
        <PowerDistributionGrid />
        <TelemetryMultigraph />
      </>,
    );
    flush();

    expect(spy).toHaveBeenCalled();
    const painted = (calls.fillRect ?? 0) + (calls.stroke ?? 0) + (calls.fill ?? 0) + (calls.fillText ?? 0);
    expect(painted).toBeGreaterThan(0);
  });

  it('wires all three panels into the gesture deck', () => {
    const ref: React.MutableRefObject<HandTrackingState> = { current: { leftHand: null, rightHand: null } };
    render(<GestureDeck handTrackingRef={ref} />);
    expect(screen.getByText('ENERGY RESERVES')).toBeInTheDocument();
    expect(screen.getByText('POWER DISTRIBUTION')).toBeInTheDocument();
    expect(screen.getByText('TELEMETRY MULTIGRAPH')).toBeInTheDocument();
  });
});

describe('real-telemetry instruments', () => {
  it('renders all seven machine + agent telemetry panels', () => {
    render(
      <>
        <CoreThreads /><MemoryAllocation /><PowerCell /><NetworkUplink /><AgentCortex /><StorageVault /><RenderFps />
      </>,
    );
    for (const title of ['CORE THREADS', 'MEMORY ALLOCATION', 'POWER CELL', 'NETWORK UPLINK', 'AGENT CORTEX', 'STORAGE VAULT', 'RENDER / FPS'])
      expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('paints every new panel to a 2D context without throwing', () => {
    const { ctx, calls } = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const flush = frameDriver();
    render(
      <>
        <CoreThreads /><MemoryAllocation /><PowerCell /><NetworkUplink /><AgentCortex /><StorageVault /><RenderFps />
      </>,
    );
    flush();
    const painted = (calls.fillRect ?? 0) + (calls.stroke ?? 0) + (calls.fill ?? 0) + (calls.fillText ?? 0);
    expect(painted).toBeGreaterThan(0);
  });

  it('flows live telemetry through to a panel readout (battery → ENERGY RESERVES %)', () => {
    const { ctx, texts } = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const flush = frameDriver(60); // enough frames for the one-pole follower to converge
    Telemetry.start();
    Telemetry.override({ batteryLevel: 0.07, batteryCharging: false });
    render(<EnergyReserves />);
    flush();
    // the BATT row's live readout is the real battery level
    expect(texts.some((s) => s === '07%')).toBe(true);
  });
});
