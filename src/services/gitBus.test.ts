import { describe, it, expect, afterEach } from 'vitest';
import { GitBus } from './gitBus';

// GitBus is the version-control seam (repos / risk / snapshots) the dashboard reads,
// fed by the host git daemon over SSE. In jsdom there is no EventSource, so the bus
// must stay a quiet, disconnected idle bus (never opening a socket or throwing) while
// still exposing a stable snapshot and the QA override + subscribe seams — mirroring
// TelemetryBus / AgentBus exactly.

afterEach(() => GitBus.stop());

describe('GitBus', () => {
  it('starts in jsdom without throwing and exposes a disconnected idle snapshot', () => {
    expect(() => GitBus.start()).not.toThrow();
    const g = GitBus.get();
    expect(g.connected).toBe(false);           // no EventSource in jsdom → never connects
    expect(g.repos).toEqual([]);
    expect(g.summary.repos).toBe(0);
    expect(g.summary.avgRisk).toBe(0);
    expect(g.summary.lastSnapshotAgeSec).toBe(-1);
  });

  it('get() returns the same object every call (zero per-frame allocation)', () => {
    expect(GitBus.get()).toBe(GitBus.get());
  });

  it('override() patches state and notifies subscribers', () => {
    let hits = 0;
    const unsub = GitBus.subscribe(() => { hits += 1; });
    GitBus.override({
      connected: true,
      repos: [{
        name: 'jarvis', path: '/x/jarvis', branch: 'real-jarvis', protected: false,
        ahead: 1, behind: 0, staged: 2, unstaged: 3, untracked: 17, added: 608, deleted: 1079,
        stashes: 2, dirty: true, risk: 0.8, lastSubject: 'feat', lastAgeSec: 60, snapshotAgeSec: 5,
      }],
      summary: { repos: 1, dirty: 1, atRisk: 1, uncommittedLines: 1687, untracked: 17, ahead: 1, behind: 0, stashes: 2, snapshots: 3, lastSnapshotAgeSec: 5, protectedDirty: 0, avgRisk: 0.8, maxRisk: 0.8, scanning: false },
    });
    expect(GitBus.get().connected).toBe(true);
    expect(GitBus.get().repos[0].name).toBe('jarvis');
    expect(GitBus.get().summary.uncommittedLines).toBe(1687);
    expect(hits).toBeGreaterThan(0);
    unsub();
  });

  it('stop() is idempotent and start() can resume', () => {
    GitBus.start();
    expect(() => { GitBus.stop(); GitBus.stop(); }).not.toThrow();
    expect(() => GitBus.start()).not.toThrow();
  });
});
