import { Vector3 } from 'three';
import { RegionName } from '../types';

// ── Pure helpers for the holographic globe ───────────────────────────────────
// Kept free of any R3F/WebGL so they unit-test under jsdom. The visual component
// (HolographicEarth.tsx) imports these; the rendering is verified via screenshots.

const DEG = Math.PI / 180;

// Unit direction to the sun in the globe's (world) frame, from real wall-clock time, so
// the lit hemisphere of the cyan hologram tracks the operator's actual system clock.
// Subsolar point: longitude follows UTC (solar noon at 0° at 12:00 UTC), latitude is the
// seasonal declination from the day-of-year.
export function sunDirection(date: Date): Vector3 {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000);
  const decl = -23.44 * Math.cos((360 / 365) * (dayOfYear + 10) * DEG);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const sunLon = -15 * (utcHours - 12);
  const latR = decl * DEG, lonR = sunLon * DEG;
  return new Vector3(
    Math.cos(latR) * Math.cos(lonR),
    Math.sin(latR),
    -Math.cos(latR) * Math.sin(lonR),
  ).normalize();
}

// Map the globe's spin (Y-rotation, degrees) to the labelled region under the lens.
// Extracted from the inline cascade so the boundaries can be locked in a test.
export function regionForDegrees(deg: number): RegionName {
  const d = ((deg % 360) + 360) % 360;
  if (d > 30 && d < 100) return RegionName.AMERICAS;
  if (d >= 100 && d < 190) return RegionName.PACIFIC;
  if (d >= 190 && d < 280) return RegionName.ASIA;
  if (d >= 280 && d < 330) return RegionName.AFRICA;
  return RegionName.EUROPE;
}

// Even-ish points on a sphere SHELL via the Fibonacci lattice, with a deterministic
// (index-derived) radial jitter so the cyan particle atmosphere has depth scatter but
// stays stable across renders/tests. Returns a flat [x,y,z,...] Float32Array.
export function fibonacciSphere(count: number, radius: number, jitter = 0): Float32Array {
  const pos = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;          // 1 … -1
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const r = radius * (1 + (((i * 131) % 100) / 100 - 0.5) * 2 * jitter);
    pos[i * 3] = Math.cos(theta) * rad * r;
    pos[i * 3 + 1] = y * r;
    pos[i * 3 + 2] = Math.sin(theta) * rad * r;
  }
  return pos;
}

// Position of the satellite node riding a tilted orbital ellipse, parameterised by the
// angle theta. tiltX rotates the orbit plane about X so it arcs over the dome (matching
// the reference's slanted orbital path).
export function orbitalNode(theta: number, rx: number, rz: number, tiltX: number): [number, number, number] {
  const x = Math.cos(theta) * rx;
  const zFlat = Math.sin(theta) * rz;
  // rotate (0, 0, zFlat) by tiltX about the X axis → lifts the far/near arc off the equator
  const y = -Math.sin(tiltX) * zFlat;
  const z = Math.cos(tiltX) * zFlat;
  return [x, y, z];
}
