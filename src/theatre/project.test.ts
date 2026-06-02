import { describe, it, expect, beforeAll } from 'vitest';
import { theatreProject, bootSheet, consoleSheet, types } from './project';

// Guards the hand-authored inline keyframe state in project.ts: if the @theatre/core
// state schema (tracksByObject / trackData) or a prop-path encoding is wrong, the
// sequences silently stop interpolating — these assertions catch that in CI.
describe('Theatre.js project sequences', () => {
  beforeAll(async () => {
    await theatreProject.ready;
  });

  it('boot power-on envelope interpolates over [0, 0.8]', () => {
    const obj = bootSheet.object('boot-overlay', {
      opacity: types.number(0, { range: [0, 1] }),
      translateY: types.number(10, { range: [-100, 100] }),
      scale: types.number(0.99, { range: [0, 2] }),
    });
    const seq = bootSheet.sequence;

    seq.position = 0;
    expect(obj.value.opacity).toBeCloseTo(0, 3);
    expect(obj.value.translateY).toBeCloseTo(10, 2);
    expect(obj.value.scale).toBeCloseTo(0.99, 3);

    seq.position = 0.4;
    expect(obj.value.opacity).toBeGreaterThan(0);
    expect(obj.value.opacity).toBeLessThan(1);

    seq.position = 0.8;
    expect(obj.value.opacity).toBeCloseTo(1, 2);
    expect(obj.value.translateY).toBeCloseTo(0, 2);
    expect(obj.value.scale).toBeCloseTo(1, 3);
  });

  it('console reveal interpolates linesVisible/opacity over [0, 2]', () => {
    const obj = consoleSheet.object('console-lines', {
      linesVisible: types.number(0, { range: [0, 20] }),
      opacity: types.number(0, { range: [0, 1] }),
    });
    const seq = consoleSheet.sequence;

    seq.position = 0;
    expect(obj.value.linesVisible).toBeCloseTo(0, 3);
    expect(obj.value.opacity).toBeCloseTo(0, 3);

    seq.position = 2;
    expect(obj.value.linesVisible).toBeCloseTo(12, 1);
    expect(obj.value.opacity).toBeCloseTo(1, 2);
  });
});
