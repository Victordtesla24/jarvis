import { describe, it, expect, afterEach } from 'vitest';
import { Telemetry } from './telemetryBus';

// The TelemetryBus is the real machine-telemetry seam (battery / cpu / heap / network /
// fps / storage) the dashboard reads. In jsdom every browser API is absent, so the bus
// must degrade to believable idle defaults without throwing, expose a stable snapshot, and
// let the QA override + subscribe seams drive it (mirroring AgentBus).

afterEach(() => Telemetry.stop());

describe('TelemetryBus', () => {
  it('starts in jsdom without throwing and exposes idle defaults', () => {
    expect(() => Telemetry.start()).not.toThrow();
    const t = Telemetry.get();
    expect(t.cores).toBeGreaterThanOrEqual(1);
    expect(t.fps).toBeGreaterThan(0);
    expect(t.batterySupported).toBe(false);  // no getBattery in jsdom → fallback
    expect(t.cpuLoad).toBeGreaterThanOrEqual(0);
    expect(t.cpuLoad).toBeLessThanOrEqual(1);
  });

  it('allocates a per-core array of real core length after start', () => {
    Telemetry.start();
    const t = Telemetry.get();
    expect(t.perCore.length).toBe(t.cores);
    t.perCore.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); });
  });

  it('get() returns the same object every call (zero per-frame allocation)', () => {
    Telemetry.start();
    expect(Telemetry.get()).toBe(Telemetry.get());
  });

  it('override() patches state and notifies subscribers', () => {
    Telemetry.start();
    let hits = 0;
    const unsub = Telemetry.subscribe(() => { hits += 1; });
    Telemetry.override({ batteryLevel: 0.42, online: false });
    expect(Telemetry.get().batteryLevel).toBeCloseTo(0.42);
    expect(Telemetry.get().online).toBe(false);
    expect(hits).toBeGreaterThan(0);
    unsub();
  });

  it('stop() is idempotent and start() can resume', () => {
    Telemetry.start();
    expect(() => { Telemetry.stop(); Telemetry.stop(); }).not.toThrow();
    expect(() => Telemetry.start()).not.toThrow();
  });
});
