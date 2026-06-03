import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EnergyReserves, PowerDistributionGrid, TelemetryMultigraph } from './instruments';
import GestureDeck from './GestureDeck';
import { HandTrackingState } from '../../types';

// These lock in the three video-reference dashboard panels rebuilt from
// youtu.be/yXpkIrR81w8 — one per timestamp the brief calls out:
//   • ENERGY RESERVES      @0:54–0:59 — single-colour (cyan) reserve telemetry
//   • POWER DISTRIBUTION    @1:07–1:11 — load-distribution node grid
//   • TELEMETRY MULTIGRAPH  @1:30–1:32 — the remaining wave/levels telemetry
// They are Canvas-2D instruments: jsdom returns no 2D context, so the rAF draw is
// inert by default. A fake 2D context is injected to prove the draw actually paints.

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// A counting no-op 2D context: every method is a tallied no-op, gradients answer
// addColorStop, so any draw routine runs end-to-end without throwing.
function fakeCtx() {
  const calls: Record<string, number> = {};
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = { canvas: {} };
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createConicGradient')
        return () => gradient;
      if (prop === 'measureText') return () => ({ width: 10 });
      return (...args: unknown[]) => { void args; calls[prop] = (calls[prop] ?? 0) + 1; };
    },
    set() { return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

// Drive exactly two animation frames synchronously, then stop (recursion-guarded).
function runFrames() {
  let n = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    n += 1;
    if (n <= 2) cb(n * 16);
    return n;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
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
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as never);
    runFrames();

    render(
      <>
        <EnergyReserves />
        <PowerDistributionGrid />
        <TelemetryMultigraph />
      </>,
    );

    expect(spy).toHaveBeenCalled();
    // The draws stroke/fill shapes — at least one paint primitive must have run.
    const painted = (calls.fillRect ?? 0) + (calls.stroke ?? 0) + (calls.fill ?? 0) + (calls.fillText ?? 0);
    expect(painted).toBeGreaterThan(0);
  });

  it('wires all three panels into the gesture deck', () => {
    const ref: React.MutableRefObject<HandTrackingState> = {
      current: { leftHand: null, rightHand: null },
    };
    render(<GestureDeck handTrackingRef={ref} />);
    expect(screen.getByText('ENERGY RESERVES')).toBeInTheDocument();
    expect(screen.getByText('POWER DISTRIBUTION')).toBeInTheDocument();
    expect(screen.getByText('TELEMETRY MULTIGRAPH')).toBeInTheDocument();
  });
});
