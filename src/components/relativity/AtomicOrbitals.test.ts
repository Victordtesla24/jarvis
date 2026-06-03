import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { rosetteGeometry, starfieldGeometry, coreSparkGeometry, makeMoteMaterial } from './AtomicOrbitals';

describe('particle geometry helpers', () => {
  it('rosetteGeometry lays rings×arms points with life/seed attributes', () => {
    const g = rosetteGeometry({ rings: 20, arms: 12 });
    expect(g.getAttribute('position').count).toBe(20 * 12);
    const life = g.getAttribute('aLife');
    const seed = g.getAttribute('aSeed');
    expect(life.count).toBe(20 * 12);
    expect(seed.count).toBe(20 * 12);
    for (let i = 0; i < life.count; i++) {
      expect(life.getX(i)).toBeGreaterThanOrEqual(0);
      expect(life.getX(i)).toBeLessThanOrEqual(1);
      expect(seed.getX(i)).toBeGreaterThanOrEqual(0);
      expect(seed.getX(i)).toBeLessThan(1);
    }
  });

  it('starfieldGeometry scatters motes within the requested depth shell', () => {
    const inner = 1.5, outer = 3.3, count = 500;
    const g = starfieldGeometry({ count, inner, outer });
    const pos = g.getAttribute('position');
    const seed = g.getAttribute('aSeed');
    expect(pos.count).toBe(count);
    expect(seed.count).toBe(count);
    for (let i = 0; i < count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
      expect(r).toBeGreaterThanOrEqual(inner - 1e-4);
      expect(r).toBeLessThanOrEqual(outer + 1e-4);
      expect(seed.getX(i)).toBeGreaterThanOrEqual(0);
      expect(seed.getX(i)).toBeLessThan(1);
    }
  });

  it('starfieldGeometry is deterministic (stable across calls)', () => {
    const a = starfieldGeometry({ count: 128 });
    const b = starfieldGeometry({ count: 128 });
    expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
  });

  it('coreSparkGeometry hugs the core face as a thin disc', () => {
    const inner = 0.16, outer = 0.9, thickness = 0.12, count = 400;
    const g = coreSparkGeometry({ count, inner, outer, thickness });
    const pos = g.getAttribute('position');
    expect(pos.count).toBe(count);
    for (let i = 0; i < count; i++) {
      const planar = Math.hypot(pos.getX(i), pos.getY(i));   // radius in the face plane
      expect(planar).toBeGreaterThanOrEqual(inner - 1e-4);
      expect(planar).toBeLessThanOrEqual(outer + 1e-4);
      expect(Math.abs(pos.getZ(i))).toBeLessThanOrEqual(thickness / 2 + 1e-4); // thin in Z
    }
  });
});

describe('makeMoteMaterial', () => {
  it('builds an additive, transparent, round-mote points material with HDR uniforms', () => {
    const m = makeMoteMaterial({ sizeBase: 0.02, color: '#FFFFFF', bright: 2 });
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.blending).toBe(THREE.AdditiveBlending);
    expect(m.toneMapped).toBe(false);
    const u = m.userData.u;
    expect(u.uSizeBase.value).toBe(0.02);
    // bright > 1 pushes channels above the bloom threshold so the brightest motes glow
    expect(u.uColor.value.r).toBeCloseTo(2, 5);
    m.dispose();
  });

  it('gives each material a distinct program cache key (no shared-program clobber)', () => {
    const a = makeMoteMaterial();
    const b = makeMoteMaterial();
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
    a.dispose(); b.dispose();
  });
});
