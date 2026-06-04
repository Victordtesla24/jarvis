import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VersionControlCore, RepositoryMatrix, CommitStream } from './gitPanels';
import { GitBus } from '../../services/gitBus';

// The three version-control instruments (GIT-18/19/20) read the live GitBus every
// frame. They must (a) mount their titled chrome, (b) paint an honest "VC LINK DOWN"
// state to a 2D context when the daemon is offline, and (c) flow live git telemetry
// (a GitBus override) through to an on-screen readout — mirroring the telemetry-panel
// suite. jsdom has no 2D context, so a fake one is injected.

afterEach(() => {
  GitBus.override({ connected: false, repos: [], summary: { repos: 0 } as never });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fakeCtx() {
  const calls: Record<string, number> = {};
  const texts: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = { canvas: {} };
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createConicGradient') return () => gradient;
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'fillText') return (s: unknown) => { texts.push(String(s)); calls.fillText = (calls.fillText ?? 0) + 1; };
      return (...args: unknown[]) => { void args; calls[prop] = (calls[prop] ?? 0) + 1; };
    },
    set() { return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, texts };
}

function frameDriver(rounds = 4) {
  let queue: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queue.push(cb); return queue.length; });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  return () => { for (let r = 0; r < rounds; r++) { const batch = queue; queue = []; batch.forEach((cb) => cb((r + 1) * 16)); } };
}

const SAMPLE = {
  connected: true,
  repos: [{
    name: 'jarvis', path: '/x/jarvis', branch: 'real-jarvis', protected: false,
    ahead: 1, behind: 0, staged: 2, unstaged: 3, untracked: 17, added: 608, deleted: 1079,
    stashes: 2, dirty: true, risk: 0.82, lastSubject: 'feat', lastAgeSec: 60, snapshotAgeSec: 5,
  }],
  summary: { repos: 1, dirty: 1, atRisk: 1, uncommittedLines: 1687, untracked: 17, ahead: 1, behind: 0, stashes: 2, snapshots: 3, lastSnapshotAgeSec: 5, protectedDirty: 0, avgRisk: 0.82, maxRisk: 0.82, scanning: false },
};

describe('version-control instruments', () => {
  it('renders all three git panel titles', () => {
    render(<><VersionControlCore /><RepositoryMatrix /><CommitStream /></>);
    for (const t of ['VERSION CONTROL CORE', 'REPOSITORY MATRIX', 'COMMIT STREAM'])
      expect(screen.getByText(t)).toBeInTheDocument();
  });

  it('paints an honest LINK DOWN state when the daemon is offline (no throw)', () => {
    const { ctx, texts } = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const flush = frameDriver();
    GitBus.override({ connected: false, repos: [], summary: { repos: 0 } as never });
    render(<><VersionControlCore /><RepositoryMatrix /><CommitStream /></>);
    flush();
    expect(texts.some((s) => s.includes('VC LINK DOWN'))).toBe(true);
  });

  it('flows live git telemetry through to the panel readouts', () => {
    const { ctx, calls, texts } = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const flush = frameDriver(40);
    GitBus.override(SAMPLE as never);
    render(<><VersionControlCore /><RepositoryMatrix /><CommitStream /></>);
    flush();
    const painted = (calls.fillRect ?? 0) + (calls.stroke ?? 0) + (calls.fill ?? 0) + (calls.fillText ?? 0);
    expect(painted).toBeGreaterThan(0);
    expect(texts.some((s) => s === 'SECURED')).toBe(true);            // VERSION CONTROL CORE is live
    expect(texts.some((s) => s.includes('DIRTY'))).toBe(true);        // REPOSITORY MATRIX header is live
  });
});
