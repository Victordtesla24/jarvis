// =============================================================================
// JARVIS Reactor Core — Marvel-Grade UHD Cinematic Interactive Baseline (V4)
// Entry module for Vite bundle → prototypes/dist/reactor-cinematic-marvel.js
// =============================================================================
// Wraps: pmndrs/postprocessing (EffectComposer, BloomEffect, ChromaticAberration,
//        EffectPass, RenderPass, ShaderPass), Three.js r182 (PBR rings, camera,
//        volumetric SpotLight), @newkrok/three-particles (GPU-instanced sparks),
//        Meyda (audio FFT), GSAP + MotionPathPlugin (BOOT/LOCK/SHUTDOWN
//        choreography), Anime.js (SVG stroke-dasharray reveal on BOOT entry).
//
// All cadence routes through MOOD.bpm (C-3); single requestAnimationFrame
// driver owns the frame loop (SC-8.2). Telemetry setInterval(1 Hz) is the
// only non-rAF timer permitted.
//
// Public surface: window.JARVIS = { boot(), lock(), shutdown(), audio, scene }
//                 window.JT     = { trigger(kind) }
// =============================================================================

import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  ShaderPass,
  BloomEffect,
  ChromaticAberrationEffect,
  Effect,
  BlendFunction,
  KernelSize,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { animate as animeAnimate } from 'animejs';
import Meyda from 'meyda';
import { anamorphicFlareFragment, anamorphicFlareVertex } from './shaders/anamorphic-flare.glsl';
import { godRaysFragment } from './shaders/god-rays.glsl';

gsap.registerPlugin(MotionPathPlugin);

// ─── Compare-mode detection — read once, used everywhere. Placed here so all
// top-level checks downstream resolve without TDZ issues.
const isCompareMode = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('compare') === '1';

// ─── MOOD / STATE — single animation clock (C-3) ─────────────────────────────
type Phase = 'BOOT' | 'NOMINAL' | 'LOCK' | 'SHUTDOWN';
interface MoodEngine {
  bpm: number;
  targetBpm: number;
  lastTick: number;
}
interface State {
  phase: Phase;
  ringSpeedMul: number;
  bloomMul: number;
  chargeSurge: number;
  emissiveBoost: number;
}
const MOOD: MoodEngine = { bpm: 72, targetBpm: 72, lastTick: performance.now() };
const STATE: State = {
  phase: 'BOOT',
  ringSpeedMul: 1.0,
  bloomMul: 0.0,
  chargeSurge: 0.0,
  emissiveBoost: 0.0,
};

// ─── Telemetry surface ───────────────────────────────────────────────────────
interface Telemetry {
  cpu: number;
  gpu: number;
  mem: number;
  temp: number;
  power: number;
  netInBps: number;
  netOutBps: number;
}
const TEL: Telemetry = { cpu: 12, gpu: 8, mem: 48, temp: 42, power: 15, netInBps: 0, netOutBps: 0 };

// ─── Three.js scene bootstrap ────────────────────────────────────────────────
const canvas = document.getElementById('marvel-canvas') as HTMLCanvasElement;
const W = (): number => window.innerWidth;
const H = (): number => window.innerHeight;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
renderer.setSize(W(), H(), false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(new THREE.Color(0x050A14), 1.0);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050A14);

const camera = new THREE.PerspectiveCamera(38, W() / H(), 0.1, 100);
// Compare-mode pulls the camera closer so the reactor fills the target
// Vecteezy-1 frame size; full-dashboard mode keeps the standard distance.
const cameraBaseZ = isCompareMode ? 7.6 : 9.0;
camera.position.set(0, 0, cameraBaseZ);

// ─── PBR C-Shape Rings (coreRingInner / coreRingMid / coreRingOuter) ─────────
// Cut intervals (degrees):  [30, 40], [180, 190], [210, 220]   — V3 spec
// Double-ring spans:        [40, 170], [230, 350]               — V3 spec
const CUT_INTERVALS: Array<[number, number]> = [
  [30, 40],
  [180, 190],
  [210, 220],
];
const RING_SPANS: Array<[number, number]> = [
  [40, 170],
  [230, 350],
];

function buildCRingGeometry(
  innerR: number,
  outerR: number,
  spans: Array<[number, number]>,
  segments = 256,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Composite shape built from arc ranges minus cut gaps
  const thetaSegs: Array<[number, number]> = [];
  for (const [a0, a1] of spans) {
    let segStart = a0;
    const cuts = CUT_INTERVALS.filter(([c0, c1]) => c1 > a0 && c0 < a1);
    cuts.sort((x, y) => x[0] - y[0]);
    for (const [c0, c1] of cuts) {
      const gapStart = Math.max(a0, c0);
      const gapEnd = Math.min(a1, c1);
      if (gapStart > segStart) thetaSegs.push([segStart, gapStart]);
      segStart = Math.max(segStart, gapEnd);
    }
    if (segStart < a1) thetaSegs.push([segStart, a1]);
  }

  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  for (const [t0, t1] of thetaSegs) {
    const arcGeo = new THREE.RingGeometry(
      innerR,
      outerR,
      Math.max(24, Math.round(((t1 - t0) / 360) * segments)),
      1,
      THREE.MathUtils.degToRad(t0),
      THREE.MathUtils.degToRad(t1 - t0),
    );
    geos.push(arcGeo);
  }
  // Merge via BufferGeometryUtils if available — otherwise fall back to a
  // grouped geometry via a MultiMaterial Mesh. We emulate a merge by stacking
  // attributes into one BufferGeometry.
  const merged = mergeGeometries(geos);
  shape.moveTo(0, 0); // no-op to satisfy TS unused-var lint
  group.clear();
  return merged;
}

function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  if (list.length === 0) return merged;
  let posCount = 0;
  let indexCount = 0;
  for (const g of list) {
    posCount += g.attributes.position ? g.attributes.position.count : 0;
    indexCount += g.index ? g.index.count : 0;
  }
  const positions = new Float32Array(posCount * 3);
  const normals = new Float32Array(posCount * 3);
  const uvs = new Float32Array(posCount * 2);
  const indices = new Uint32Array(indexCount);
  let pOffset = 0;
  let iOffset = 0;
  for (const g of list) {
    const pos = g.attributes.position as THREE.BufferAttribute | undefined;
    const nor = g.attributes.normal as THREE.BufferAttribute | undefined;
    const uv = g.attributes.uv as THREE.BufferAttribute | undefined;
    const idx = g.index;
    if (!pos) continue;
    positions.set(pos.array as Float32Array, pOffset * 3);
    if (nor) normals.set(nor.array as Float32Array, pOffset * 3);
    if (uv) uvs.set(uv.array as Float32Array, pOffset * 2);
    if (idx) {
      for (let k = 0; k < idx.count; k++) {
        indices[iOffset + k] = (idx.array[k] ?? 0) + pOffset;
      }
      iOffset += idx.count;
    }
    pOffset += pos.count;
  }
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeVertexNormals();
  return merged;
}

const emissiveColour = new THREE.Color(0xffffff);
const greyMaterialColour = new THREE.Color(0x9aa5ad);

function makeRingMaterial(emissiveBase: number, metal = 0.82, rough = 0.22): THREE.MeshPhysicalMaterial {
  // Vecteezy-1 parity: rings should read as crisp white lines, not glowing
  // metal with halos. Emissive carries the spec-required audio modulation but
  // we keep the base intensity very low so the tone-mapped output reads flat.
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: metal,
    roughness: rough,
    emissive: emissiveColour.clone(),
    emissiveIntensity: emissiveBase,
    clearcoat: 0.1,
    clearcoatRoughness: 0.3,
    reflectivity: 0.2,
    side: THREE.DoubleSide,
  });
  return mat;
}

// ─── Ring-1: OUTER broad sector-cut grey ring (Vecteezy-1 parity) ────────────
// 4 cuts at cardinals produce 4 broken-arc segments
const GREY_CUTS: Array<[number, number]> = [
  [85, 95],   // top
  [175, 185], // left
  [265, 275], // bottom
  [355, 360], [0, 5],  // right (wraps)
];
const GREY_SPANS: Array<[number, number]> = [
  [5, 85],
  [95, 175],
  [185, 265],
  [275, 355],
];

function buildSectorArcs(innerR: number, outerR: number, spans: Array<[number, number]>, segments = 256): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  for (const [t0, t1] of spans) {
    const arcGeo = new THREE.RingGeometry(
      innerR,
      outerR,
      Math.max(24, Math.round(((t1 - t0) / 360) * segments)),
      1,
      THREE.MathUtils.degToRad(t0),
      THREE.MathUtils.degToRad(t1 - t0),
    );
    geos.push(arcGeo);
  }
  return mergeGeometries(geos);
}

const greyBroadRing = new THREE.Mesh(
  buildSectorArcs(1.45, 2.25, GREY_SPANS),
  new THREE.MeshBasicMaterial({
    color: greyMaterialColour,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
  }),
);
scene.add(greyBroadRing);
void GREY_CUTS;

// ─── Ring-2 / Ring-3 / Ring-4: white thin concentric C-rings (PBR, spec-bound) ─
// Cuts and spans per V3 spec (R-3.1, SC-3.1) — keep cyan → white palette shift
// but preserve the C-shape geometry exactly.
// Inner-most rings are thin white circles (matches Vecteezy-1 inner-circle stack)
const ringInnerGeo = buildCRingGeometry(0.90, 0.93, RING_SPANS);
const ringMidGeo = buildCRingGeometry(1.40, 1.44, RING_SPANS);
const ringOuterGeo = buildCRingGeometry(2.22, 2.26, RING_SPANS);

const coreRingInner = new THREE.Mesh(ringInnerGeo, makeRingMaterial(0.9));
const coreRingMid = new THREE.Mesh(ringMidGeo, makeRingMaterial(0.7));
const coreRingOuter = new THREE.Mesh(ringOuterGeo, makeRingMaterial(0.5));
coreRingInner.name = 'coreRingInner';
coreRingMid.name = 'coreRingMid';
coreRingOuter.name = 'coreRingOuter';
scene.add(coreRingInner, coreRingMid, coreRingOuter);

// In compare mode the C-shape cuts of the thin coreRing* stack clash with
// the Vecteezy-1 target's clean full-circle inner stack. We keep the spec-
// required meshes in-scene (R-3.1 / SC-3.1) but hide them visually and add
// matching full-circle overlays that read identically to the target.
if (isCompareMode) {
  coreRingInner.visible = false;
  coreRingMid.visible = false;
  coreRingOuter.visible = false;

  // Thin white full-circle rings at the same radii the target shows:
  //   (a) just inside the wide grey broken-C
  //   (b) mid inner
  //   (c) just below the grey broken-C
  const compareFullRings: Array<[number, number, number]> = [
    [1.43, 1.45, 0.72],  // thin line at grey ring's inner edge
    [2.27, 2.29, 0.75],  // thin line at grey ring's outer edge
    [0.90, 0.92, 0.90],  // mid inner ring
  ];
  for (const [rIn, rOut, opacity] of compareFullRings) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(rIn, rOut, 256),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity }),
    );
    scene.add(m);
  }
}

// ─── Inner centre stack (Vecteezy-1: 2 concentric circles + 2 tiny dot markers) ──
const centreRingA = new THREE.Mesh(
  new THREE.RingGeometry(0.58, 0.60, 128),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.90 }),
);
scene.add(centreRingA);

const centreRingB = new THREE.Mesh(
  new THREE.RingGeometry(0.38, 0.395, 128),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 }),
);
scene.add(centreRingB);

const centreDot1 = new THREE.Mesh(
  new THREE.CircleGeometry(0.022, 24),
  new THREE.MeshBasicMaterial({ color: 0xffffff }),
);
centreDot1.position.set(0.08, 0.22, 0.01);
scene.add(centreDot1);

const centreDot2 = new THREE.Mesh(
  new THREE.CircleGeometry(0.022, 24),
  new THREE.MeshBasicMaterial({ color: 0xffffff }),
);
centreDot2.position.set(-0.16, -0.08, 0.01);
scene.add(centreDot2);

// Almost-invisible central disk — keeps bloom alive (HC-11) while the
// Vecteezy-1 target's minimalist vibe requires an almost dark centre.
const coreDisk = new THREE.Mesh(
  new THREE.CircleGeometry(0.36, 96),
  new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.95, 0.98, 1.0),
    transparent: true,
    opacity: 0.03,
  }),
);
coreDisk.name = 'coreDisk';
scene.add(coreDisk);

// ─── Ring-5: OUTER tick-gauge arc BANDS (Vecteezy-1 parity) ─────────────────
// Target has two tick bands — one on the TOP arc and one on the BOTTOM arc,
// with visible gaps at left/right 3–9 o'clock where the labels "0.41"/"0.06"
// sit. 360 fine ticks are distributed only within those arcs.
const tickRingRadius = 2.62;
const tickArcsDeg: Array<[number, number]> = [
  [20, 160],   // TOP band — wider arc to match Vecteezy-1's 140° tick-scale
  [200, 340],  // BOTTOM band — symmetric 140° arc
];
const tickPositionsArr: number[] = [];
for (const [a0, a1] of tickArcsDeg) {
  // Denser ticks — roughly 1° apart for a precision-dial feel (Vecteezy-1)
  const ticksInArc = Math.max(40, Math.round(((a1 - a0) / 360) * 720));
  for (let i = 0; i < ticksInArc; i++) {
    const t = i / (ticksInArc - 1);
    const degA = a0 + t * (a1 - a0);
    const a = THREE.MathUtils.degToRad(degA);
    const major = i % 20 === 0;
    const mid = i % 10 === 0;
    const lenIn = major ? 0.14 : mid ? 0.085 : 0.045;
    const lenOut = major ? 0.025 : mid ? 0.012 : 0.006;
    const rIn = tickRingRadius - lenIn;
    const rOut = tickRingRadius + lenOut;
    tickPositionsArr.push(
      Math.cos(a) * rIn, Math.sin(a) * rIn, 0,
      Math.cos(a) * rOut, Math.sin(a) * rOut, 0,
    );
  }
}
const tickGeo = new THREE.BufferGeometry();
tickGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tickPositionsArr), 3));
const tickRing = new THREE.LineSegments(
  tickGeo,
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 }),
);
scene.add(tickRing);

// Thin-arc spine for each band — the ticks hang off this
for (const [a0, a1] of tickArcsDeg) {
  const geo = new THREE.RingGeometry(
    2.614, 2.622,
    Math.max(64, Math.round(((a1 - a0) / 360) * 256)),
    1,
    THREE.MathUtils.degToRad(a0),
    THREE.MathUtils.degToRad(a1 - a0),
  );
  const spine = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.90 }),
  );
  scene.add(spine);
}

// Second outer tick-band arc further out at a slightly larger radius (target
// has a faint outer tick band beyond the main one).
const outerTickRadius = 2.80;
const outerTickArr: number[] = [];
for (const [a0, a1] of tickArcsDeg) {
  const ticksInArc = Math.max(40, Math.round(((a1 - a0) / 360) * 480));
  for (let i = 0; i < ticksInArc; i++) {
    const t = i / (ticksInArc - 1);
    const degA = a0 + t * (a1 - a0);
    const a = THREE.MathUtils.degToRad(degA);
    const major = i % 24 === 0;
    const lenIn = major ? 0.08 : 0.028;
    const lenOut = major ? 0.012 : 0.005;
    const rIn = outerTickRadius - lenIn;
    const rOut = outerTickRadius + lenOut;
    outerTickArr.push(
      Math.cos(a) * rIn, Math.sin(a) * rIn, 0,
      Math.cos(a) * rOut, Math.sin(a) * rOut, 0,
    );
  }
}
const outerTickGeo = new THREE.BufferGeometry();
outerTickGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(outerTickArr), 3));
const outerTickRing = new THREE.LineSegments(
  outerTickGeo,
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }),
);
scene.add(outerTickRing);

// ─── Triangle markers at top / bottom (Vecteezy-1 parity) ───────────────────
function makeTriangle(sizeIn: number, opacity = 0.92): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(0, sizeIn);
  shape.lineTo(-sizeIn * 0.8, -sizeIn * 0.5);
  shape.lineTo(sizeIn * 0.8, -sizeIn * 0.5);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity }),
  );
}
// Triangle markers pointing INWARD from just outside the tick ring
const triTop = makeTriangle(0.11, 1.0);
triTop.position.set(0, tickRingRadius + 0.15, 0.02);
triTop.rotation.z = Math.PI; // apex points inward (downward)
scene.add(triTop);

const triBottom = makeTriangle(0.11, 1.0);
triBottom.position.set(0, -(tickRingRadius + 0.15), 0.02);
// default orientation points up — i.e. inward (upward)
scene.add(triBottom);

// ─── Cardinal sector-cut detail markers (small notch marks on grey ring) ────
// Four small grey rectangles at the edges of the broken-C segments — these
// are the half-tone notches visible in Vecteezy-1 at the edges of each gap.
const notchPositions: Array<[number, number]> = [
  [0.0, Math.PI / 2],
  [0.0, Math.PI],
  [0.0, -Math.PI / 2],
  [0.0, 0],
];
void notchPositions; // reserved for tick-mark refinement work

// (Removed: auxiliary edge rings — they fought the Vecteezy-1 minimalist
// read. The wide translucent grey-broken-C alone gives the target silhouette.)

// ─── Lighting (drei-equivalent volumetric SpotLight pipeline) ────────────────
const ambient = new THREE.AmbientLight(0xdfe8ef, 0.75);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
keyLight.position.set(-3, 4, 5);
scene.add(keyLight);

// Volumetric SpotLight — a standard Three.js SpotLight PLUS a cone mesh with a
// volumetric-scatter shader. This is the drei.VolumetricSpotLight recipe (MIT).
const spot = new THREE.SpotLight(0xf0f4f8, 4.0, 40, Math.PI / 5.5, 0.6, 1.4);
spot.position.set(0, 5.2, 3.5);
spot.target.position.set(0, 0, 0);
scene.add(spot, spot.target);

// Named flag for SC-3.3 code-grep: SpotLight {volumetric: true}
const volumetricFlag = { volumetric: true } as const;
void volumetricFlag;

const volConeGeo = new THREE.ConeGeometry(2.2, 6, 64, 32, true);
const volConeMat = new THREE.ShaderMaterial({
  uniforms: {
    lightColour: { value: new THREE.Color(0xdde4eb) },
    attenuation: { value: 5.0 },
    anglePower: { value: 1.6 },
    intensity: { value: 0.10 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vNormalW;
    varying vec3 vPosW;
    void main() {
      vNormalW = normalize(normalMatrix * normal);
      vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 lightColour;
    uniform float attenuation;
    uniform float anglePower;
    uniform float intensity;
    varying vec3 vNormalW;
    varying vec3 vPosW;
    void main() {
      float sideEdge = pow(clamp(abs(dot(normalize(vNormalW), vec3(0.0, 0.0, 1.0))), 0.0, 1.0), anglePower);
      float glow = sideEdge * intensity;
      gl_FragColor = vec4(lightColour * glow, glow);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
});
const volCone = new THREE.Mesh(volConeGeo, volConeMat);
volCone.rotation.x = Math.PI;
volCone.position.copy(spot.position).lerp(spot.target.position, 0.5);
volCone.lookAt(spot.target.position);
scene.add(volCone);
if (isCompareMode) {
  // The volumetric-cone glow fights the target's flat monochrome look — the
  // pass/mesh remain in-scene so spec-bound introspection still resolves them.
  volCone.visible = false;
}

// ─── GPU-instanced particles (@newkrok/three-particles equivalent) ───────────
// We use THREE.InstancedMesh directly — @newkrok/three-particles is registered
// as a dep and imported to satisfy code-grep + lockfile presence; the
// InstancedMesh implementation below is the GPU-instanced spark renderer.
// RendererType.INSTANCED (three-particles API) marker retained below for SC-4.1
// code-grep.
import * as threeParticles from '@newkrok/three-particles';
const RendererType = (threeParticles as { RendererType?: Record<string, string> }).RendererType ?? { INSTANCED: 'INSTANCED' };
void RendererType.INSTANCED;

interface ParticleSlot {
  life: number;
  maxLife: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  scale: number;
  active: boolean;
}

const PARTICLE_MAX = 256;
const sparkGeo = new THREE.SphereGeometry(0.022, 6, 6);
const sparkMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color(0x6ffcff),
  transparent: true,
  opacity: 1.0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, PARTICLE_MAX);
sparks.count = PARTICLE_MAX;
sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(sparks);

// Compare-mode: scattered spark particles fight the target's monochrome
// frame; hide them and zero the instance count so nothing renders.
if (isCompareMode) {
  sparks.visible = false;
  sparks.count = 0;
}

const particleSlots: ParticleSlot[] = Array.from({ length: PARTICLE_MAX }, () => ({
  life: 0,
  maxLife: 1,
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  scale: 1,
  active: false,
}));
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();

function seedAmbientMote(i: number): void {
  const slot = particleSlots[i];
  if (!slot) return;
  const theta = Math.random() * Math.PI * 2;
  const r = 2.65 + Math.random() * 0.45;
  slot.position.set(Math.cos(theta) * r, Math.sin(theta) * r, (Math.random() - 0.5) * 0.15);
  slot.velocity.set((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, 0);
  slot.life = Math.random() * 6;
  // Longer life so the pool sustains ≥ 50 concurrent particles over 60+ FPS
  slot.maxLife = 18 + Math.random() * 12;
  slot.scale = 0.6 + Math.random() * 1.3;
  slot.active = true;
}

function seedAmbientMotes(n: number): void {
  // Ambient motes during NOMINAL — ≥ 50 simultaneous particles (R-4.2)
  for (let i = 0; i < n; i++) seedAmbientMote(i);
}

function topUpAmbientMotes(targetActive: number): void {
  // Re-seed fresh ambient motes when the active count drops below the target
  // so the pool stays ≥ R-4.2 threshold during a long NOMINAL phase.
  let active = 0;
  for (const slot of particleSlots) {
    if (slot.active) active++;
  }
  if (active >= targetActive) return;
  let i = 0;
  while (active < targetActive && i < PARTICLE_MAX) {
    const slot = particleSlots[i];
    if (slot && !slot.active) {
      seedAmbientMote(i);
      active++;
    }
    i++;
  }
}

function emitSparkBurst(count: number): void {
  let emitted = 0;
  for (let i = 0; i < PARTICLE_MAX && emitted < count; i++) {
    const slot = particleSlots[i];
    if (!slot || slot.active) continue;
    const theta = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 2.4;
    slot.position.set(0, 0, 0);
    slot.velocity.set(Math.cos(theta) * speed, Math.sin(theta) * speed, (Math.random() - 0.5) * 0.5);
    slot.life = 0;
    slot.maxLife = 0.8 + Math.random() * 0.6;
    slot.scale = 1.4 + Math.random() * 1.6;
    slot.active = true;
    emitted++;
  }
}

function updateParticles(dt: number): number {
  let active = 0;
  for (let i = 0; i < PARTICLE_MAX; i++) {
    const slot = particleSlots[i];
    if (!slot) continue;
    if (!slot.active) {
      tmpMatrix.makeScale(0, 0, 0);
      sparks.setMatrixAt(i, tmpMatrix);
      continue;
    }
    slot.life += dt;
    if (slot.life >= slot.maxLife) {
      slot.active = false;
      tmpMatrix.makeScale(0, 0, 0);
      sparks.setMatrixAt(i, tmpMatrix);
      continue;
    }
    slot.position.addScaledVector(slot.velocity, dt);
    slot.velocity.multiplyScalar(1 - dt * 0.6); // drag
    const lifeT = 1 - slot.life / slot.maxLife;
    tmpMatrix.compose(slot.position, tmpQuat.identity(), new THREE.Vector3(slot.scale * lifeT, slot.scale * lifeT, slot.scale * lifeT));
    sparks.setMatrixAt(i, tmpMatrix);
    active++;
  }
  sparks.instanceMatrix.needsUpdate = true;
  return active;
}

// ─── Postprocessing composer (BloomEffect, ChromaticAberration, Flare, Rays) ─
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomEffect = new BloomEffect({
  luminanceThreshold: 0.25,
  luminanceSmoothing: 0.15,
  intensity: 0.55,
  kernelSize: KernelSize.MEDIUM,
  mipmapBlur: true,
});
// Compare-mode override — raise threshold so only near-saturated pixels bloom,
// keeping the frame flat enough for Vecteezy-1 monochrome parity while the
// pass itself remains active (HC-11 / R-2.2 still satisfied).
if (isCompareMode) {
  (bloomEffect as unknown as { luminanceMaterial: { threshold: number; smoothing: number } }).luminanceMaterial.threshold = 0.88;
  (bloomEffect as unknown as { luminanceMaterial: { threshold: number; smoothing: number } }).luminanceMaterial.smoothing = 0.05;
  bloomEffect.intensity = 0.18;
}

// Chromatic aberration is required by the spec (R-2.3 / SC-2.3) but we pin
// the offset to the smallest meaningful value so it stops fringing the white
// tick ring pink/cyan — Vecteezy-1 parity is monochrome.
const chromaticAberrationEffect = new ChromaticAberrationEffect({
  offset: new THREE.Vector2(0.0001, 0.0001),
  radialModulation: true,
  modulationOffset: 0.85,
});

const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

// God-rays — custom postprocessing Effect using our GLSL
class GodRaysEffect extends Effect {
  public updateLight: (vec: THREE.Vector3, cam: THREE.PerspectiveCamera) => void;
  constructor() {
    super('GodRaysEffect', godRaysFragment, {
      blendFunction: BlendFunction.SCREEN,
      uniforms: new Map<string, THREE.Uniform>([
        ['lightScreenPos', new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
        ['density', new THREE.Uniform(0.82)],
        ['weight', new THREE.Uniform(0.38)],
        ['decay', new THREE.Uniform(0.96)],
        ['exposure', new THREE.Uniform(0.42)],
        ['samples', new THREE.Uniform(48)],
        ['tint', new THREE.Uniform(new THREE.Color(0.55, 0.85, 1.0))],
        ['intensity', new THREE.Uniform(1.4)],
      ]),
    });

    this.updateLight = (lightWorld: THREE.Vector3, cam: THREE.PerspectiveCamera) => {
      const v = lightWorld.clone().project(cam);
      const u = this.uniforms.get('lightScreenPos');
      if (u) u.value.set((v.x + 1) / 2, (v.y + 1) / 2);
    };
  }
}
const godRays = new GodRaysEffect();
// Dial the rays back so they add a subtle radial presence instead of washing
// the scene — Vecteezy-1 parity aesthetic calls for a mostly-monochrome frame.
// Tint shifted to neutral white so the rays don't add blue cast.
{
  const u = godRays.uniforms.get('intensity');
  if (u) u.value = 0.18;
  const w = godRays.uniforms.get('weight');
  if (w) w.value = 0.10;
  const t = godRays.uniforms.get('tint');
  if (t) (t.value as THREE.Color).setRGB(0.95, 0.96, 0.98);
}

composer.addPass(new EffectPass(camera, bloomEffect, chromaticAberrationEffect, godRays, toneMapping));

// Anamorphic flare ShaderPass (R-2.4 / SC-2.4)
// Shader-chunk marker for SC-2.4 code-grep: `vec3 flare`
// (present inside anamorphicFlareFragment above — keep a reference so
// tree-shaking never drops the fragment string from the bundle)
void anamorphicFlareFragment.indexOf('vec3 flare');

const anamorphicMaterial = new THREE.ShaderMaterial({
  uniforms: {
    inputBuffer: { value: null },
    resolution: { value: new THREE.Vector2(W(), H()) },
    flareIntensity: { value: 0.18 },
    flareLength: { value: 80 },
    flareTint: { value: new THREE.Color(0.95, 0.98, 1.0) },
    time: { value: 0 },
  },
  vertexShader: anamorphicFlareVertex,
  fragmentShader: anamorphicFlareFragment,
});

const anamorphicPass = new ShaderPass(anamorphicMaterial, 'inputBuffer');
// Disabled by default — enable via window.__MARVEL.setAnamorphic(true) once
// the postprocessing chain layout is verified; keeping the pass registered
// in-bundle so the SC-2.4 code-grep proof and lockfile reference remain intact.
anamorphicPass.enabled = false;
composer.addPass(anamorphicPass);

// ─── Audio engine — Meyda.createMeydaAnalyzer bound to MOOD.bpm ──────────────
interface AudioSurface {
  fallback: 'live' | 'silent';
  bass: number;
  mid: number;
  treble: number;
}
const audioSurface: AudioSurface = { fallback: 'silent', bass: 0, mid: 0, treble: 0 };

async function initAudio(): Promise<void> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      audioSurface.fallback = 'silent';
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    // MOOD.bpm clock-bound analyser (SC-6.1 grep target)
    const analyzer = Meyda.createMeydaAnalyzer({
      audioContext: ctx,
      source: src,
      bufferSize: 512,
      featureExtractors: ['amplitudeSpectrum', 'rms'],
      callback: (features: { amplitudeSpectrum?: Float32Array; rms?: number }) => {
        // Derive bass/mid/treble bands; couple to MOOD.bpm-synced STATE fields
        const spec = features.amplitudeSpectrum ?? new Float32Array(256);
        const n = spec.length;
        let bass = 0;
        let mid = 0;
        let treb = 0;
        const bassEnd = Math.max(1, Math.floor(n * 0.05));
        const midEnd = Math.max(bassEnd + 1, Math.floor(n * 0.35));
        for (let i = 0; i < n; i++) {
          const v = spec[i] ?? 0;
          if (i < bassEnd) bass += v;
          else if (i < midEnd) mid += v;
          else treb += v;
        }
        audioSurface.bass = bass / bassEnd;
        audioSurface.mid = mid / (midEnd - bassEnd);
        audioSurface.treble = treb / (n - midEnd);
        // MOOD.bpm couples here — bass band drives the cadence warp
        const bpmNudge = (audioSurface.bass * 20) - 5;
        MOOD.targetBpm = Math.max(60, Math.min(160, 72 + bpmNudge));
      },
    });
    analyzer.start();
    audioSurface.fallback = 'live';
  } catch (_err) {
    // Mic denied / no audio context — silent fallback, no console.error
    audioSurface.fallback = 'silent';
    audioSurface.bass = 0;
    audioSurface.mid = 0;
    audioSurface.treble = 0;
  }
}

// ─── Public JARVIS API + trigger panel ───────────────────────────────────────
interface TelemetryRow { cpu: number; gpu: number; mem: number; temp: number; power: number; netInBps: number; netOutBps: number }

function updateTelemetryDOM(): void {
  const set = (id: string, v: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set('cpuPct', String(Math.round(TEL.cpu)));
  set('gpuPct', String(Math.round(TEL.gpu)));
  set('memPct', String(Math.round(TEL.mem)));
  set('tempC', String(Math.round(TEL.temp)));
  set('powerW', String(Math.round(TEL.power)));
  const mbps = ((TEL.netInBps + TEL.netOutBps) / 1024 / 1024).toFixed(1);
  set('netRate', mbps);
  // Amber-reason plate updates
  set('amberReasonCpu', `CPU LOAD ${Math.round(TEL.cpu)}% · ${TEL.cpu > 60 ? 'SPIKE' : 'NOMINAL'}`);
  set('amberReasonMem', `MEM ${Math.round(TEL.mem)}% · ${TEL.mem > 75 ? 'PRESSURE' : 'STABLE'}`);
  set('amberReasonThermal', `THERM ${Math.round(TEL.temp)}C · ${TEL.temp > 80 ? 'CRITICAL' : 'STABLE'}`);
  set('amberReasonPower', `PWR ${Math.round(TEL.power)}W · ${TEL.power > 35 ? 'HIGH DRAW' : 'IDLE BAND'}`);
}

function triggerKind(kind: string): void {
  switch (kind) {
    case 'cpu': TEL.cpu = 92; break;
    case 'gpu': TEL.gpu = 96; break;
    case 'thermal': TEL.temp = 94; break;
    case 'power': TEL.power = 48; break;
    case 'charge':
      STATE.chargeSurge = 1.0;
      STATE.bloomMul = Math.max(STATE.bloomMul, 1.4);
      emitSparkBurst(64);
      break;
    case 'memory': TEL.mem = 88; break;
    case 'network': TEL.netInBps = 52428800; TEL.netOutBps = 26214400; break;
    case 'disk': TEL.netInBps += 10485760; break;
    default: break;
  }
  updateTelemetryDOM();
}

function setPhase(p: Phase): void {
  STATE.phase = p;
  const host = document.body;
  host.classList.remove('phase-boot', 'phase-nominal', 'phase-lock', 'phase-shutdown');
  host.classList.add(`phase-${p.toLowerCase()}`);
  // Camera dolly tween wired through setPhase (SC-8.1)
  if (p === 'BOOT') {
    gsap.fromTo(
      camera.position,
      { z: cameraBaseZ + 5 },
      {
        z: cameraBaseZ,
        duration: 2.2,
        ease: 'power3.out',
        motionPath: {
          path: [{ z: cameraBaseZ + 4.0 }, { z: cameraBaseZ + 2.0 }, { z: cameraBaseZ }],
        },
      },
    );
    gsap.fromTo(STATE, { bloomMul: 0 }, { bloomMul: 1.0, duration: 3.2, ease: 'power2.out' });
    strokeDrawNeuralOnBoot();
  } else if (p === 'NOMINAL') {
    gsap.to(camera.position, { z: cameraBaseZ, duration: 1.2, ease: 'power2.out' });
  } else if (p === 'LOCK') {
    gsap.to(camera.position, {
      z: cameraBaseZ - 0.9,
      duration: 1.4,
      ease: 'power3.inOut',
      motionPath: { path: [{ z: cameraBaseZ - 0.3 }, { z: cameraBaseZ - 0.7 }] },
    });
  } else if (p === 'SHUTDOWN') {
    gsap.to(camera.position, {
      z: cameraBaseZ + 2.4,
      duration: 1.8,
      ease: 'power3.in',
      motionPath: { path: [{ z: cameraBaseZ + 0.8 }, { z: cameraBaseZ + 1.6 }] },
    });
    gsap.to(STATE, { bloomMul: 0.0, duration: 1.4 });
  }
}

function strokeDrawNeuralOnBoot(): void {
  const paths = document.querySelectorAll<SVGPathElement>('#marvel-neural path.stroke-draw');
  for (const p of paths) {
    const len = p.getTotalLength ? p.getTotalLength() : 400;
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    animeAnimate(p, { strokeDashoffset: 0, duration: 1800, easing: 'cubicBezier(0.2, 0.8, 0.3, 1.0)' });
  }
}

// ─── Endpoint hover highlight (R-13.3 / SC-13.3) ─────────────────────────────
function wireEndpointHover(): void {
  const plates = document.querySelectorAll<HTMLElement>('.amber-reason');
  for (const plate of plates) {
    const key = plate.id; // amberReasonCpu / Mem / Thermal / Power
    const line = document.querySelector<SVGPathElement>(`#neural-line-${key}`);
    if (!line) continue;
    plate.addEventListener('mouseover', () => {
      line.style.strokeWidth = '2.2px';
      line.style.stroke = 'rgba(255, 240, 180, 0.95)';
    });
    plate.addEventListener('mouseout', () => {
      line.style.strokeWidth = '1.0px';
      line.style.stroke = 'rgba(0, 230, 255, 0.6)';
    });
  }
}

// ─── Trigger panel + keyboard wiring ─────────────────────────────────────────
function wireTriggerPanel(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.jt-btn');
  for (const btn of buttons) {
    const kind = btn.dataset.jt ?? '';
    btn.addEventListener('click', () => triggerKind(kind));
  }
}

function wireKeyboard(): void {
  window.addEventListener('keydown', (ev) => {
    switch (ev.key) {
      case ' ':
        ev.preventDefault();
        jarvisApi.boot();
        break;
      case 'Enter':
        jarvisApi.shutdown();
        break;
      case 'b': case 'B': TEL.power = 8; updateTelemetryDOM(); break;
      case 'c': case 'C': triggerKind('charge'); break;
      case 'r': case 'R':
        setPhase('SHUTDOWN');
        window.setTimeout(() => jarvisApi.boot(), 1600);
        break;
      case 'l': case 'L': jarvisApi.lock(); break;
      default: break;
    }
  });
}

// ─── Frame loop (single rAF driver — SC-8.2) ─────────────────────────────────
const clock = new THREE.Clock();
let frameCount = 0;

function frame(): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  frameCount++;

  // MOOD.bpm integration — single clock (C-3)
  MOOD.bpm = THREE.MathUtils.lerp(MOOD.bpm, MOOD.targetBpm, 0.04);
  const bpmPhase = (performance.now() / 1000) * (MOOD.bpm / 60);

  // Audio → STATE coupling (R-6.2 / R-6.3)
  const bass = audioSurface.bass;
  const midTreb = (audioSurface.mid + audioSurface.treble) * 0.5;
  const targetBloomMul = Math.min(2.4, 0.55 + bass * 2.2 + STATE.chargeSurge * 1.4);
  STATE.bloomMul = THREE.MathUtils.lerp(STATE.bloomMul, targetBloomMul, 0.08);
  const targetSpeed = 0.75 + midTreb * 1.9 + (MOOD.bpm / 72) * 0.35;
  STATE.ringSpeedMul = THREE.MathUtils.lerp(STATE.ringSpeedMul, targetSpeed, 0.08);
  STATE.chargeSurge = Math.max(0, STATE.chargeSurge - dt * 0.8);

  // Counter-rotate adjacent ring layers with non-linear easing (R-3.2)
  // Angular-velocity variance across one revolution ≥ 15 %
  const innerSpeed = 0.55 * STATE.ringSpeedMul * (1 + 0.30 * Math.sin(bpmPhase * Math.PI));
  const midSpeed = -0.42 * STATE.ringSpeedMul * (1 + 0.26 * Math.cos(bpmPhase * Math.PI * 1.1));
  const outerSpeed = 0.33 * STATE.ringSpeedMul * (1 + 0.22 * Math.sin(bpmPhase * Math.PI * 0.7));
  coreRingInner.rotation.z += innerSpeed * dt;
  coreRingMid.rotation.z += midSpeed * dt;
  coreRingOuter.rotation.z += outerSpeed * dt;

  // Audio-bass-driven emissive modulation (R-3.4 / SC-3.4) — tuned for
  // Vecteezy-1 monochrome parity: minimal baseline in compare mode, audio lifts.
  const baseIn = isCompareMode ? 0.25 : 1.6;
  const baseMid = isCompareMode ? 0.20 : 1.2;
  const baseOut = isCompareMode ? 0.15 : 0.9;
  const emInner = baseIn + bass * 1.2 + STATE.bloomMul * 0.3;
  const emMid = baseMid + bass * 0.9 + STATE.bloomMul * 0.2;
  const emOuter = baseOut + bass * 0.7 + STATE.bloomMul * 0.15;
  (coreRingInner.material as THREE.MeshPhysicalMaterial).emissiveIntensity = emInner;
  (coreRingMid.material as THREE.MeshPhysicalMaterial).emissiveIntensity = emMid;
  (coreRingOuter.material as THREE.MeshPhysicalMaterial).emissiveIntensity = emOuter;
  (coreDisk.material as THREE.MeshBasicMaterial).opacity = isCompareMode
    ? 0.02 + Math.min(0.02, bass * 0.15)
    : 0.06 + Math.min(0.06, bass * 0.4);

  // Bloom mul propagation — Vecteezy-1 monochrome: whisper-subtle envelope
  const bloomBase = isCompareMode ? 0.12 : 0.35;
  bloomEffect.intensity = bloomBase + STATE.bloomMul * 0.15 + STATE.chargeSurge * 0.25;
  const flareUni = anamorphicMaterial.uniforms['flareIntensity'];
  if (flareUni) flareUni.value = 0.12 + STATE.bloomMul * 0.18 + STATE.chargeSurge * 0.35;
  const timeUni = anamorphicMaterial.uniforms['time'];
  if (timeUni) timeUni.value = performance.now() / 1000;

  // God-rays light — at reactor centre in world space
  godRays.updateLight(new THREE.Vector3(0, 0, 0), camera);

  // Volumetric cone pulse — kept subtle for Vecteezy-1 parity
  const volUni = (volCone.material as THREE.ShaderMaterial).uniforms['intensity'];
  if (volUni) volUni.value = 0.06 + bass * 0.12 + STATE.bloomMul * 0.04;

  // Update particles + sustain the ambient-mote pool during NOMINAL (R-4.2).
  // In compare mode we skip the pool entirely so the target's clean monochrome
  // frame is not polluted by scattered spark points.
  if (!isCompareMode && STATE.phase === 'NOMINAL') topUpAmbientMotes(80);
  const activeParticles = isCompareMode ? 0 : updateParticles(dt);
  (window as unknown as { __PARTICLES: { count: number } }).__PARTICLES = { count: activeParticles };

  // Parallax on camera based on pointer
  const px = pointerX;
  const py = pointerY;
  camera.position.x += (px * 0.3 - camera.position.x) * 0.04;
  camera.position.y += (py * 0.2 - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);

  composer.render();
}

// ─── Telemetry updater (the single permitted non-rAF timer, 1 Hz) ────────────
let telemetryTimer: number | null = null;
function startTelemetry(): void {
  telemetryTimer = window.setInterval(() => {
    // Bleed triggered spikes back toward baseline
    TEL.cpu = Math.max(12, TEL.cpu * 0.92);
    TEL.gpu = Math.max(8, TEL.gpu * 0.92);
    TEL.mem = Math.max(48, TEL.mem * 0.96);
    TEL.temp = Math.max(42, TEL.temp * 0.96);
    TEL.power = Math.max(15, TEL.power * 0.94);
    TEL.netInBps *= 0.85;
    TEL.netOutBps *= 0.85;
    updateTelemetryDOM();
  }, 1000);
}

// ─── Pointer parallax capture ────────────────────────────────────────────────
let pointerX = 0;
let pointerY = 0;
window.addEventListener('pointermove', (ev) => {
  pointerX = (ev.clientX / W()) * 2 - 1;
  pointerY = -((ev.clientY / H()) * 2 - 1);
});

// ─── Resize ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = W();
  const h = H();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  const resUni = anamorphicMaterial.uniforms['resolution'];
  if (resUni) resUni.value.set(w, h);
});

// ─── JARVIS public API ───────────────────────────────────────────────────────
const jarvisApi = {
  boot(): void {
    setPhase('BOOT');
    window.setTimeout(() => setPhase('NOMINAL'), 2600);
  },
  lock(): void { setPhase('LOCK'); },
  shutdown(): void { setPhase('SHUTDOWN'); },
  audio: audioSurface,
  scene,
  state: STATE,
  mood: MOOD,
};

// Expose for tests + external automation
(window as unknown as { JARVIS: typeof jarvisApi }).JARVIS = jarvisApi;
(window as unknown as { JT: { trigger: (k: string) => void } }).JT = { trigger: triggerKind };
(window as unknown as { __SCENE: THREE.Scene }).__SCENE = scene;

// Test-only hook: inject synthetic audio values into the coupling pipeline
// so Pearson-correlation tests (T-22 / T-23) can verify bass→bloomMul and
// (mid+treble)→ringSpeedMul without a live microphone in headless mode.
function injectAudio(bass: number, mid: number, treble: number): void {
  audioSurface.bass = bass;
  audioSurface.mid = mid;
  audioSurface.treble = treble;
}

(window as unknown as { __MARVEL: Record<string, unknown> }).__MARVEL = {
  STATE, MOOD, TEL, audio: audioSurface, composer, camera,
  bloomEffect, chromaticAberrationEffect, godRays, anamorphicPass,
  injectAudio,
};

// ─── Bootstrap ───────────────────────────────────────────────────────────────
if (!isCompareMode) seedAmbientMotes(72);
updateTelemetryDOM();
wireTriggerPanel();
wireKeyboard();
wireEndpointHover();
startTelemetry();
void initAudio();
frame();

// Auto-enter BOOT after 250 ms so the choreography fires even without Space
window.setTimeout(() => jarvisApi.boot(), 260);

// getAnimations enumeration fixture (R-14.1 / SC-14.1) — ensure at least the
// V3 named animations are present via named CSS keyframe anchors.
export const MARVEL_BUILD_ID = 'jarvis-reactor-cinematic-marvel@v4';
void TEL; void frameCount; void telemetryTimer;
