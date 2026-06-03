import { describe, it, expect } from 'vitest';
import { sunDirection, regionForDegrees, fibonacciSphere, orbitalNode } from './holoGlobe';
import { RegionName } from '../types';

describe('holoGlobe helpers', () => {
  it('sunDirection returns a unit vector', () => {
    const v = sunDirection(new Date('2026-06-03T12:00:00Z'));
    expect(v.length()).toBeCloseTo(1, 5);
  });

  it('sunDirection tracks UTC longitude (noon vs midnight point apart)', () => {
    const noon = sunDirection(new Date('2026-06-03T12:00:00Z'));
    const midnight = sunDirection(new Date('2026-06-03T00:00:00Z'));
    // Subsolar point swings to the opposite side of the globe between noon and midnight UTC.
    expect(noon.dot(midnight)).toBeLessThan(0);
  });

  it('regionForDegrees covers the full circle with the documented boundaries', () => {
    expect(regionForDegrees(0)).toBe(RegionName.EUROPE);
    expect(regionForDegrees(60)).toBe(RegionName.AMERICAS);
    expect(regionForDegrees(150)).toBe(RegionName.PACIFIC);
    expect(regionForDegrees(230)).toBe(RegionName.ASIA);
    expect(regionForDegrees(300)).toBe(RegionName.AFRICA);
    // wraps negative / >360 cleanly
    expect(regionForDegrees(-300)).toBe(regionForDegrees(60));
    expect(regionForDegrees(420)).toBe(regionForDegrees(60));
  });

  it('fibonacciSphere lays count points on a shell of the given radius', () => {
    const r = 1.4;
    const pts = fibonacciSphere(500, r, 0);
    expect(pts.length).toBe(500 * 3);
    for (let i = 0; i < 500; i++) {
      const d = Math.hypot(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
      expect(d).toBeCloseTo(r, 4); // no jitter → exactly on the shell
    }
  });

  it('fibonacciSphere jitter stays within the requested band and is deterministic', () => {
    const a = fibonacciSphere(200, 1, 0.2);
    const b = fibonacciSphere(200, 1, 0.2);
    expect(Array.from(a)).toEqual(Array.from(b)); // deterministic
    for (let i = 0; i < 200; i++) {
      const d = Math.hypot(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);
      expect(d).toBeGreaterThanOrEqual(0.8 - 1e-6);
      expect(d).toBeLessThanOrEqual(1.2 + 1e-6);
    }
  });

  it('orbitalNode rides a tilted ellipse (lifts off the equator when tilted)', () => {
    const flat = orbitalNode(Math.PI / 2, 2, 2, 0);
    expect(flat[1]).toBeCloseTo(0, 6);            // no tilt → stays on y=0
    const tilted = orbitalNode(Math.PI / 2, 2, 2, 0.6);
    expect(Math.abs(tilted[1])).toBeGreaterThan(0.1); // tilt lifts the node in Y
    // radius in the orbit plane is preserved
    expect(Math.hypot(tilted[0], tilted[1], tilted[2])).toBeCloseTo(2, 5);
  });
});
