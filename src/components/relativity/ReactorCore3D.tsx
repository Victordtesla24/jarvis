import * as THREE from 'three';
import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { EffectComposer, Bloom, DepthOfField, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';
import { easing } from 'maath';
import { HandTrackingState } from '../../types';
import { AgentBus } from '../../services/agentState';
import { rosetteGeometry, makeRosetteMaterial } from './AtomicOrbitals';

// ── ReactorCore3D ───────────────────────────────────────────────────────────
// A fully PROCEDURAL holographic arc reactor — the consolidation of the
// "JARVIS WELCOME STARTUP" boot reactor and the "HUD Relativity" technical dial,
// matched to the Iron Man movie JARVIS reactor. NO baked images: every ring,
// tooth, tick and marker is emissive geometry so it stays razor-sharp at any
// zoom and resolves in true depth when the core disintegrates.
//
// Material discipline (the whole game):
//   • GLOW tier  — meshBasicMaterial with colour channels > 1, toneMapped:false.
//                  Only these exceed the Bloom luminance threshold (1.0) and so
//                  bloom HARD (core, tooth lips, index marks, containment lip).
//   • STRUCTURE  — channels ≤ 1: crisp cyan hairlines that NEVER bloom
//                  (ring bodies, spokes, minor ticks) — the mechanical credibility.
//
//   • IDLE: layered counter-rotating rings, breathing white-hot core.
//   • BOOT: ring-by-ring ignition → spin-up sweep → settle (≈4.2 s).
//   • SPLIT (hands apart): every ring family slides to its own Z → a real 3D
//     tunnel that recomposes pixel-perfect when the hands close.
//   • The J.A.R.V.I.S. agent drives core energy / spin / mood via AgentBus.

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const R = 1.5;                                   // master radius = containment outer edge

const ICE = new THREE.Color('#EAFBFF');
const CYAN = new THREE.Color('#7DF9FF');
const RED = new THREE.Color('#FF5A3C');
const hdr = (hex: string, mul: number) => new THREE.Color(hex).multiplyScalar(mul);

// module-scope scratch (never allocate in useFrame)
const _col = new THREE.Color();

const CA_OFFSET = new THREE.Vector2(0.0006, 0.0009);

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0: number, e1: number, x: number) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

// soft radial gradient sprite (shared by the core glow bed + agent aura)
function makeRadialTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');           // null under jsdom (no 2D backend) — guard so tests don't throw
  if (g) {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.30, 'rgba(150,234,246,0.5)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

// ── material set ────────────────────────────────────────────────────────────
function useMaterials() {
  const built = useMemo(() => {
    const glowTex = makeRadialTexture();
    const basic = (color: THREE.Color, extra: THREE.MeshBasicMaterialParameters = {}) =>
      new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
    const add = (color: THREE.Color, opacity: number, map?: THREE.Texture) =>
      new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const M = {
      // GLOW
      coreHot: basic(hdr('#FFFFFF', 5.2)),
      coreMid: basic(hdr('#DBF8FF', 2.7)),
      coreRing: basic(hdr('#AEEBFF', 2.2)),
      toothLip: basic(hdr('#FFD9A6', 3.0)),              // warm-white coil lip (Stark arc glow) — blooms hard
      index: basic(hdr('#9FF4FF', 2.2)),
      containLip: basic(hdr('#7DF9FF', 1.9)),
      accent: basic(hdr('#7DF9FF', 2.1)),
      warmIndex: basic(hdr('#FFC074', 2.4)),             // warm directional markers (contrast vs cyan dial)
      majorTickBase: basic(new THREE.Color(1, 1, 1)),    // instanceColor-driven
      // STRUCTURE (≤1, crisp, never bloom)
      toothBody: basic(hdr('#3E6E8E', 0.62)),            // steel coil segments — present but recessed; warm lips define each tooth
      innerArc: basic(hdr('#5FD0F0', 0.8)),
      spoke: basic(hdr('#3FB8E6', 0.55)),
      outerArc: basic(hdr('#4FC4E8', 0.68)),
      line: basic(hdr('#39E1F2', 0.85)),
      lineDim: basic(hdr('#58C6DE', 0.5)),
      detailBlock: basic(hdr('#7FE3F2', 0.9)),
      tickBase: basic(new THREE.Color(1, 1, 1)),         // instanceColor-driven
      // additive glow sprites (soft radial — textured so they read round, not square)
      coreGlow: add(hdr('#8FE6FF', 1.25), 0.55, glowTex),
      sweep: add(hdr('#BDEEFF', 2.6), 0),
      shock: new THREE.MeshBasicMaterial({ color: hdr('#7DF9FF', 1.8), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    };
    return { M, glowTex };
  }, []);
  useEffect(() => () => { Object.values(built.M).forEach((m) => m.dispose()); built.glowTex.dispose(); }, [built]);
  return built;
}
type Mats = ReturnType<typeof useMaterials>['M'];

// ── shared geometries ───────────────────────────────────────────────────────
function useGeometries() {
  const G = useMemo(() => {
    // coil tooth: a true radial KEYSTONE wedge of constant ~18° angular width, so the
    // 10 teeth read as distinct segments (~50% fill / 50% gap) at every radius — NOT a
    // solid hub fanning into rays. Half-widths chosen as tan(9°)·r at each end.
    const ri = 0.20 * R, ro = 0.40 * R;
    const wi = 0.047, wo = 0.095;                 // half-widths (tangential) → ~18° tooth at hub & rim
    const sh = new THREE.Shape();
    sh.moveTo(ri, -wi); sh.lineTo(ro, -wo); sh.lineTo(ro, wo); sh.lineTo(ri, wi); sh.closePath();
    const tooth = new THREE.ShapeGeometry(sh);
    return {
      tooth,
      tickPlane: new THREE.PlaneGeometry(1, 1),
    };
  }, []);
  useEffect(() => () => Object.values(G).forEach((g) => g.dispose()), [G]);
  return G;
}
type Geos = ReturnType<typeof useGeometries>;

// ── primitives ──────────────────────────────────────────────────────────────
function Ring({ r, tube = 0.005, mat, seg = 256 }: { r: number; tube?: number; mat: THREE.Material; seg?: number; }) {
  return <mesh material={mat}><torusGeometry args={[r, tube, 12, seg]} /></mesh>;
}
function Arc({ r, tube, mat, arc, start = 0, seg }: { r: number; tube: number; mat: THREE.Material; arc: number; start?: number; seg?: number; }) {
  return <mesh rotation={[0, 0, start]} material={mat}><torusGeometry args={[r, tube, 10, seg ?? Math.max(8, Math.round(arc * 56)), arc]} /></mesh>;
}
// filled equilateral triangle markers at given clock degrees (apex inward)
function TriMarkers({ r, degs, mat, size, inward = true }: { r: number; degs: number[]; mat: THREE.Material; size: number; inward?: boolean; }) {
  return <>{degs.map((deg) => {
    const a = (deg - 90) * DEG;
    return (
      <mesh key={deg} position={[Math.cos(a) * r, Math.sin(a) * r, 0]} rotation={[0, 0, a + (inward ? Math.PI / 2 : -Math.PI / 2)]} material={mat}>
        <circleGeometry args={[size, 3]} />
      </mesh>
    );
  })}</>;
}

// instanced ring of small quads/dots/bars — one draw call, parent-group rotated
function InstancedRing({ count, radius, geo, mat, sx, sy, elongateEvery = 0, elongateScale = 1.8, colorFn }: {
  count: number; radius: number; geo: THREE.BufferGeometry; mat: THREE.Material;
  sx: number; sy: number; elongateEvery?: number; elongateScale?: number;
  colorFn?: (i: number, major: boolean) => THREE.Color;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const dummy = new THREE.Object3D();
    const mats: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const major = elongateEvery > 0 && i % elongateEvery === 0;
      dummy.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      dummy.rotation.set(0, 0, a);
      dummy.scale.set(major ? sx * elongateScale : sx, sy, 1);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
      if (colorFn) cols.push(colorFn(i, major).clone());
    }
    return { mats, cols };
  }, [count, radius, sx, sy, elongateEvery, elongateScale, colorFn]);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    for (let i = 0; i < data.mats.length; i++) m.setMatrixAt(i, data.mats[i]);
    m.instanceMatrix.needsUpdate = true;
    if (data.cols.length) {
      for (let i = 0; i < data.cols.length; i++) m.setColorAt(i, data.cols[i]);
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [data]);
  return <instancedMesh ref={ref} args={[geo, mat, count]} />;
}

// ── split-driven atomic-orbital STAR-DUST field ──────────────────────────────
// A dense (~19k) sunflower rosette of EXTREMELY FINE points — matched to the
// "Atomic Orbitals" reference reel — that blooms out of the core as it disintegrates:
// soft round sub-pixel motes (round-mask + dusty quadratic tip falloff in the shader),
// additive HDR so overlaps sum into a glowing energy mist, a cyan-core→warm-amber-tip
// radius ramp, and a slow precession so the spiral arms turn. Faint at rest, full dome
// at split — the fine dust is the volumetric depth between the separating plates.
function SplitOrbitals({ splitRef, speedRef }: { splitRef: React.MutableRefObject<number>; speedRef: React.MutableRefObject<number>; }) {
  const grp = useRef<THREE.Group>(null);
  const geom = useMemo(() => rosetteGeometry({ rings: 240, arms: 80, precess: 0.121, radius: 1.62, dome: 0.34 }), []); // 19,200 fine points
  const mat = useMemo(() => makeRosetteMaterial({ sizeBase: 0.0024 }), []);
  useEffect(() => () => { mat.dispose(); geom.dispose(); }, [mat, geom]);
  useFrame((state, dt) => {
    const s = splitRef.current, sp = speedRef.current, a0 = AgentBus.get();
    if (grp.current) {
      grp.current.rotation.z += dt * (0.06 + sp * 0.06) * (1 - s * 0.7);   // slow majestic precession
      grp.current.rotation.x = 0.05;                                       // a touch of tilt → reads as a 3D dome
      grp.current.scale.setScalar(0.42 + s * 1.12);
    }
    const u = mat.userData.u;
    u.uTime.value = state.clock.elapsedTime;
    u.uSplit.value = s;
    u.uTurb.value = 0.4 + sp * 0.5;                                        // ordered, gentle — not noisy
    u.uSizeBase.value = 0.0017 + s * 0.0013;                               // sub-pixel star dust
    u.uBright.value = 1.0 + a0.intensity * 0.6;
    // faint dust halo at rest, glowing dome at full split (mood/energy modulated)
    mat.opacity = (0.05 + s * 0.17) * (0.72 + a0.intensity * 0.45);
    if (a0.mood === 'alert') { u.uColorA.value.set('#FFD9CC'); u.uColorB.value.set('#FF4D2E'); }
    else { u.uColorA.value.set('#D6F6FF'); u.uColorB.value.set('#FFC07A'); } // cyan core → warm amber tips
  });
  return <group ref={grp}><points geometry={geom} material={mat} /></group>;
}

// ── ambient star-dust shell — a sparse, ever-present fine-particle nebula that
// frames the reactor with cosmic depth (the faint background motes in the reference).
function StarDust({ splitRef }: { splitRef: React.MutableRefObject<number> }) {
  const grp = useRef<THREE.Group>(null);
  const { geo, mat } = useMemo(() => {
    const N = 1600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // even-ish sphere (fibonacci) within a shell, jittered radius → depth scatter
      const y = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * 2.399963;
      const shell = 1.5 + (((i * 131) % 100) / 100) * 1.7;   // 1.5 … 3.2
      pos[i * 3] = Math.cos(phi) * rad * shell;
      pos[i * 3 + 1] = y * shell;
      pos[i * 3 + 2] = Math.sin(phi) * rad * shell;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: hdr('#BFEFFF', 1.2), size: 0.012, sizeAttenuation: true,
      transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    return { geo, mat };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame((_, dt) => {
    if (grp.current) { grp.current.rotation.y += dt * 0.012; grp.current.rotation.x = 0.1; }
    mat.opacity = 0.16 + splitRef.current * 0.22;   // always faintly present, denser feel on split
  });
  return <group ref={grp}><points geometry={geo} material={mat} /></group>;
}

// ── dotted great-circle orbital guides (the disintegration signature) ────────
// Three thin dotted hoops on near-orthogonal planes form a slowly-tumbling sphere
// wireframe that fades in ONLY as the core separates — the elegant "atomic orbit"
// guide that frames the depth-stack tunnel in the reference reel. At split 0 it is
// fully invisible, so the integrated reactor is untouched.
function OrbitGuides({ splitRef }: { splitRef: React.MutableRefObject<number> }) {
  const grp = useRef<THREE.Group>(null);
  const { geo, mat } = useMemo(() => {
    const N = 180, rr = 1.30 * R;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const a = (i / N) * TAU; pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = Math.sin(a) * rr; pos[i * 3 + 2] = 0; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: hdr('#BFF2FF', 1.05), size: 0.012, sizeAttenuation: true,
      transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    return { geo, mat };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame((_, dt) => {
    const s = splitRef.current;
    // Two faint dotted great-circle ellipses on tilted planes that arc over the dome —
    // restrained guides, NOT a sphere cage. They bloom in only as the core separates.
    mat.opacity = smooth(0.12, 0.58, s) * 0.34;
    if (grp.current) { grp.current.visible = s > 0.015; grp.current.rotation.z += dt * 0.04; grp.current.rotation.x = 0.16; }
  });
  return (
    <group ref={grp}>
      <points geometry={geo} material={mat} rotation={[Math.PI * 0.30, 0, 0]} />
      <points geometry={geo} material={mat} rotation={[Math.PI * 0.30, 0, Math.PI * 0.5]} />
    </group>
  );
}

// ── soft agent aura behind the core (secondary bloom seed) ───────────────────
function AgentAura({ mat, tex }: { mat: THREE.MeshBasicMaterial; tex: THREE.Texture }) {
  const mesh = useRef<THREE.Mesh>(null);
  useEffect(() => { mat.map = tex; mat.needsUpdate = true; }, [mat, tex]);   // shared texture, owned by useMaterials
  useFrame((state) => {
    const a = AgentBus.get(); const t = state.clock.elapsedTime;
    const pulse = a.activity === 'speaking' ? 0.45 + 0.55 * Math.abs(Math.sin(t * 9))
      : a.activity === 'thinking' ? 0.5 + 0.5 * Math.sin(t * 3.4)
        : 0.5 + 0.5 * Math.sin(t * 1.1);
    const active = a.activity !== 'idle' ? 1 : 0;
    mat.opacity = 0.12 + a.intensity * 0.22 + active * 0.18 * pulse;
    mat.color.copy(a.mood === 'alert' ? RED : a.mood === 'success' ? _col.set('#5BE8A0') : _col.set('#39E1F2'));
    if (mesh.current) mesh.current.scale.setScalar(2.2 + pulse * 0.2 + a.intensity * 0.3);
  });
  return (
    <mesh ref={mesh} position={[0, 0, -0.4]} renderOrder={-1} material={mat}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

// ── the reactor face: the procedural L0–L9 ring stack ───────────────────────
// Each "family" is a sub-group that spins at its own rate, slides to its own Z
// on split, and reveals (scales in) on its own beat during boot.
interface Family { restZ: number; splitZ: number; spin: number; order: number; }
// splitZ is a NON-LINEAR "shallow dome" depth ladder matched frame-for-frame to the
// reference reel (youtu.be/8gX5KK4cyPY, 0:04–0:08): the outer ring families
// (containment→spokes) stay CLUSTERED as an anchored rim near z≈0 with small gaps,
// while the inner families lift toward the lens (+Z) with PROGRESSIVELY larger gaps,
// the white-hot core travelling farthest to the near end. Under the steep split-tilt
// this reads as a crisp dome of plates whose nearest (core) element floats above the
// rim — not an evenly-spaced tunnel and not a core that balloons into the lens.
const FAMILIES = {
  containment: { restZ: -0.10, splitZ: -0.16, spin: 0.0, order: 7 } as Family,   // anchored rim — barely moves
  data: { restZ: -0.08, splitZ: -0.04, spin: 0.25, order: 6 } as Family,         // fast CW
  outer: { restZ: -0.06, splitZ: 0.08, spin: -0.055, order: 5 } as Family,       // slow CCW
  spokes: { restZ: -0.04, splitZ: 0.22, spin: 0.0, order: 4 } as Family,
  grad: { restZ: -0.02, splitZ: 0.44, spin: 0.105, order: 3 } as Family,         // CW
  inner: { restZ: 0.00, splitZ: 0.70, spin: -0.16, order: 2 } as Family,         // CCW
  coil: { restZ: 0.04, splitZ: 1.00, spin: 0.0, order: 1 } as Family,
  core: { restZ: 0.07, splitZ: 1.36, spin: 0.0, order: 0 } as Family,            // lifts farthest → near end
};

function ReactorFace({ splitRef, speedRef, M, G }: {
  splitRef: React.MutableRefObject<number>; speedRef: React.MutableRefObject<number>; M: Mats; G: Geos;
}) {
  const refs = {
    containment: useRef<THREE.Group>(null), data: useRef<THREE.Group>(null), outer: useRef<THREE.Group>(null),
    spokes: useRef<THREE.Group>(null), grad: useRef<THREE.Group>(null), inner: useRef<THREE.Group>(null),
    coil: useRef<THREE.Group>(null), core: useRef<THREE.Group>(null),
  };
  const coreHot = useRef<THREE.Mesh>(null);
  const sweep = useRef<THREE.Mesh>(null);
  const shock = useRef<THREE.Mesh>(null);
  const t0 = useRef(-1);

  // instance colours for the two tick rings (major channels >1 bloom; minor ≤1 crisp)
  const minorCol = useMemo(() => hdr('#2E6E96', 1.0), []);
  const majorCol = useMemo(() => hdr('#7DF9FF', 1.35), []);
  const gradColor = useMemo(() => (_: number, major: boolean) => (major ? majorCol : minorCol), [majorCol, minorCol]);
  const dataMinor = useMemo(() => hdr('#244F73', 1.0), []);
  const dataMajor = useMemo(() => hdr('#7FE3F2', 1.15), []);
  const dataColor = useMemo(() => (_: number, major: boolean) => (major ? dataMajor : dataMinor), [dataMajor, dataMinor]);
  const innerTickColor = useMemo(() => () => minorCol, [minorCol]);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05), t = state.clock.elapsedTime;
    if (t0.current < 0) t0.current = t;
    const boot = clamp01((t - t0.current) / 4.2);
    const split = splitRef.current;
    const a = AgentBus.get();
    const speed = speedRef.current;
    const hold = 1 - split * 0.9;                 // spin slows + holds when disintegrated
    const idleGate = smooth(0.58, 1.0, boot);     // idle spin ramps in as boot settles

    for (const key in FAMILIES) {
      const f = FAMILIES[key as keyof typeof FAMILIES];
      const g = refs[key as keyof typeof refs].current;
      if (!g) continue;
      g.rotation.z += d * f.spin * 6 * speed * hold * idleGate;
      g.position.z = f.restZ + f.splitZ * split;
      // boot reveal: families assemble core→out across boot 0.0–0.55, then settle
      const start = (f.order / 8) * 0.42;
      const rev = easeOut(smooth(start, start + 0.20, boot));
      g.scale.setScalar(rev <= 0 ? 0.0001 : rev);
    }

    // white-hot core: ignition overshoot, then breathing pulse driven by agent energy
    if (coreHot.current) {
      const energy = 0.6 + a.intensity * 1.0;
      const breathe = 1 + Math.sin(t * 3.1) * 0.06;
      const ignite = boot < 0.16 ? 1 + (1 - boot / 0.16) * 1.4 : 1;       // flash on ignition
      const flick = 0.97 + 0.03 * Math.sin(t * 40);                        // live-plasma jitter
      const mul = (3.2 + energy * 2.0) * breathe * ignite * flick;
      // pure-white, brightest point in the whole rig (the canonical white-hot centre)
      (M.coreHot as THREE.MeshBasicMaterial).color.copy(a.mood === 'alert' ? RED : ICE).multiplyScalar(mul / 2.3);
      coreHot.current.scale.setScalar((0.9 + energy * 0.18) * breathe);
    }
    // accent / containment colour shifts to red on alert
    (M.accent as THREE.MeshBasicMaterial).color.copy(a.mood === 'alert' ? RED : CYAN).multiplyScalar(a.mood === 'alert' ? 2.4 : 2.1);
    (M.containLip as THREE.MeshBasicMaterial).color.copy(a.mood === 'alert' ? RED : CYAN).multiplyScalar(a.mood === 'alert' ? 2.1 : 1.9);

    // BOOT: spin-up sweep bar (fast → decelerating), fades in/out around boot 0.5–0.92
    if (sweep.current) {
      const p = clamp01((boot - 0.48) / 0.44);
      const ang = -easeOut(p) * TAU * 2.4;
      sweep.current.rotation.z = ang;
      (M.sweep as THREE.MeshBasicMaterial).opacity = Math.sin(clamp01(p) * Math.PI) * 0.85 * (split < 0.2 ? 1 : 0);
    }
    // BOOT: expanding shockwave at ignition
    if (shock.current) {
      const p = clamp01(boot / 0.5);
      const sc = 0.15 + easeOut(p) * 1.7;
      shock.current.scale.setScalar(sc);
      (M.shock as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.6 * (boot < 0.5 ? 1 : 0);
    }
  });

  const coilInner = 0.20 * R;
  return (
    <group>
      {/* L0 — white-hot core cluster */}
      <group ref={refs.core}>
        <mesh material={M.coreGlow} position={[0, 0, -0.02]} renderOrder={-1}><planeGeometry args={[0.78 * R, 0.78 * R]} /></mesh>
        <Ring r={0.165 * R} tube={0.010} mat={M.coreRing} seg={96} />
        <mesh material={M.coreMid}><circleGeometry args={[0.105 * R, 48]} /></mesh>
        <mesh ref={coreHot} material={M.coreHot}><circleGeometry args={[0.052 * R, 36]} /></mesh>
      </group>

      {/* L2 — signature segmented coil / tooth wreath (10 teeth) */}
      <group ref={refs.coil}>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} geometry={G.tooth} material={M.toothBody} rotation={[0, 0, i * (TAU / 10)]} />
        ))}
        {/* bright inner lips — broken ring of 10 hot arc segments, aligned to the ~18° teeth */}
        {Array.from({ length: 10 }, (_, i) => (
          <Arc key={i} r={coilInner} tube={0.012} mat={M.toothLip} arc={(TAU / 10) * 0.5} start={i * (TAU / 10) - (TAU / 10) * 0.25} seg={10} />
        ))}
        <Ring r={0.205 * R} tube={0.004} mat={M.lineDim} seg={160} />
        <Ring r={0.405 * R} tube={0.004} mat={M.line} seg={200} />
      </group>

      {/* L3 — inner mechanical ring: 3 broken arcs + fine inner notches */}
      <group ref={refs.inner}>
        {[0, 1, 2].map((k) => (
          <Arc key={k} r={0.46 * R} tube={0.007} mat={M.innerArc} arc={100 * DEG} start={(k * 120 + 10) * DEG} />
        ))}
        <InstancedRing count={48} radius={0.50 * R} geo={G.tickPlane} mat={M.tickBase} sx={0.022} sy={0.004}
          colorFn={innerTickColor} />
      </group>

      {/* L4 + L5 — index triangles + fine graduation tick ring (rotate together) */}
      <group ref={refs.grad}>
        <TriMarkers r={0.535 * R} degs={[0, 90, 180, 270]} mat={M.warmIndex} size={0.05} />
        <TriMarkers r={0.535 * R} degs={[45, 135, 225, 315]} mat={M.accent} size={0.03} />
        <InstancedRing count={120} radius={0.595 * R} geo={G.tickPlane} mat={M.majorTickBase} sx={0.05} sy={0.006}
          elongateEvery={10} elongateScale={1.9} colorFn={gradColor} />
        <Ring r={0.625 * R} tube={0.0035} mat={M.line} seg={256} />
      </group>

      {/* L6 — radial spokes (6 struts, static) */}
      <group ref={refs.spokes}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = i * (TAU / 6);
          const rMid = 0.67 * R, len = 0.34 * R;
          return <mesh key={i} position={[Math.cos(a) * rMid, Math.sin(a) * rMid, 0]} rotation={[0, 0, a]} material={M.spoke}>
            <planeGeometry args={[len, 0.012]} /></mesh>;
        })}
      </group>

      {/* L7 — outer mechanical ring: 2 broken arcs + 6 detail blocks at spoke ends */}
      <group ref={refs.outer}>
        <Arc r={0.88 * R} tube={0.006} mat={M.outerArc} arc={170 * DEG} start={5 * DEG} />
        <Arc r={0.88 * R} tube={0.006} mat={M.outerArc} arc={170 * DEG} start={185 * DEG} />
        {Array.from({ length: 6 }, (_, i) => {
          const a = i * (TAU / 6);
          return <mesh key={i} position={[Math.cos(a) * 0.88 * R, Math.sin(a) * 0.88 * R, 0]} rotation={[0, 0, a]} material={M.detailBlock}>
            <planeGeometry args={[0.03, 0.05]} /></mesh>;
        })}
      </group>

      {/* L8 — data ring: fine fast-scrolling tick band */}
      <group ref={refs.data}>
        <Ring r={0.935 * R} tube={0.003} mat={M.lineDim} seg={256} />
        <InstancedRing count={90} radius={0.955 * R} geo={G.tickPlane} mat={M.tickBase} sx={0.03} sy={0.004}
          elongateEvery={6} elongateScale={1.7} colorFn={dataColor} />
      </group>

      {/* L9 — outer containment ring: bright defining hoop */}
      <group ref={refs.containment}>
        <Ring r={0.99 * R} tube={0.006} mat={M.containLip} seg={384} />
        <Ring r={0.965 * R} tube={0.0035} mat={M.lineDim} seg={320} />
      </group>

      {/* BOOT — spin-up sweep bar (two opposed blades) */}
      <mesh ref={sweep} material={M.sweep} position={[0, 0, 0.05]}>
        <ringGeometry args={[0.16 * R, 0.99 * R, 64, 1, 0, 0.16]} />
      </mesh>
      {/* BOOT — ignition shockwave */}
      <mesh ref={shock} material={M.shock} position={[0, 0, 0.02]}>
        <ringGeometry args={[0.92, 1.0, 96]} />
      </mesh>
    </group>
  );
}

// ── post: split-driven DoF + hard selective bloom + subtle CA ────────────────
function Post({ splitRef }: { splitRef: React.MutableRefObject<number> }) {
  const dof = useRef<any>(null);
  useFrame(() => {
    if (dof.current) dof.current.bokehScale = splitRef.current * 2.6;        // razor-sharp head-on; gentle depth-of-field down the dome (hero core stays readable)
  });
  return (
    <EffectComposer multisampling={8} frameBufferType={THREE.HalfFloatType} enableNormalPass={false}>
      <DepthOfField ref={dof} target={[0, 0, 0]} worldFocusRange={3.0} bokehScale={0} height={1024} />
      <Bloom mipmapBlur intensity={1.15} luminanceThreshold={1.0} luminanceSmoothing={0.03} radius={0.85} levels={8} kernelSize={KernelSize.LARGE} />
      <ChromaticAberration offset={CA_OFFSET} radialModulation modulationOffset={0.4} />
      {/* terminal frame-seating vignette — only darkens where geometry reaches the
          edges; the centred reactor + transparent corners stay clean over the dash */}
      <Vignette eskil={false} offset={0.32} darkness={0.72} />
    </EffectComposer>
  );
}

interface ReactorCore3DProps { handTrackingRef: React.MutableRefObject<HandTrackingState>; scale?: number; }

const ReactorCore3D: React.FC<ReactorCore3DProps> = ({ handTrackingRef, scale = 1.15 }) => {
  const splitRef = useRef(0);
  return (
    <Canvas
      camera={{ position: [0, 0, 4.4], fov: 42, near: 0.1, far: 50 }}
      gl={{ alpha: true, antialias: false, powerPreference: 'high-performance', stencil: false }}
      dpr={[1, 2.5]}
      flat
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <fog attach="fog" args={['#02060b', 6.5, 16]} />
      <Suspense fallback={null}>
        <Assembly handTrackingRef={handTrackingRef} scale={scale} splitRef={splitRef} />
        <Post splitRef={splitRef} />
      </Suspense>
    </Canvas>
  );
};

export default ReactorCore3D;

// ── controller: gestures, drag/orbit, split, dolly, camera parallax ─────────
// Publishes its live split value to the shared splitRef so <Post> can drive DoF.
function Assembly({ handTrackingRef, scale, splitRef }: {
  handTrackingRef: React.MutableRefObject<HandTrackingState>; scale: number; splitRef: React.MutableRefObject<number>;
}) {
  const grp = useRef<THREE.Group>(null);
  const speedRef = useRef(1);
  const splitTarget = useRef(0);
  const rot = useRef({ x: 0.04, y: 0 });
  const drag = useRef<{ active: boolean; x: number; y: number } | null>(null);
  const { M, glowTex } = useMaterials();
  const G = useGeometries();
  const auraMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  useEffect(() => () => auraMat.dispose(), [auraMat]);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    const s = handTrackingRef.current;
    const right = s.rightHand, left = s.leftHand;
    const a = AgentBus.get();

    let target = splitTarget.current;
    if (left?.landmarks?.length && right?.landmarks?.length) {
      const lw = left.landmarks[0], rw = right.landmarks[0];
      const dd = Math.hypot(lw.x - rw.x, lw.y - rw.y);
      target = clamp01((dd - 0.16) / 0.46);
    } else if (left) {
      target = Math.max(0.1, left.expansionFactor);
    }
    // QA hook (inert in production): automated visual verification can pin the split
    // by setting window.__JARVIS_SPLIT__ to a 0–1 number; cleared by deleting it.
    const dbg = (globalThis as any).__JARVIS_SPLIT__;
    if (typeof dbg === 'number') target = clamp01(dbg);
    splitTarget.current = target;            // keep wheel + gesture on one source of truth
    easing.damp(splitRef, 'current', target, 0.18, d);

    const sp = splitRef.current;
    if (right) {
      rot.current.y = right.rotationControl.x * Math.PI;
      rot.current.x = 0.04 - sp * 1.16 + right.rotationControl.y * Math.PI * 0.4 * (1 - sp);
    } else if (!drag.current?.active) {
      const px = state.pointer.x, py = state.pointer.y;
      const k = 1 - sp;
      // The disintegration is sold by DEPTH, not zoom: as the plates slide apart the
      // assembly tilts to a steep oblique so we look down the separating tunnel, then a
      // slow azimuth orbit makes the layered stack read as true 3D. Both terms scale
      // with split and vanish at 0, so the integrated reactor recomposes pixel-perfect.
      // tilt to a steep ~68° oblique (reference peaks ~65–70°). The MINUS sign opens the
      // dome up/away from the lens so the structural containment rim is the nearest/largest
      // ring and the white-hot core recedes small to the far end — exactly as in the
      // reference reel. Azimuth orbit + slow yaw drift give the compound-rotation PARALLAX
      // that sells true depth. Resting tilt (0.04) is unchanged so the integrated face is intact.
      // Idle is no longer dead-flat: a gentle oblique tilt + slow azimuth sway makes the
      // Z-layered ring families parallax against each other so the integrated face reads as
      // genuine 3D. Both idle terms scale with k=(1-split) so they vanish into the steep
      // disintegration tilt, keeping the split choreography frame-for-frame intact.
      const t = state.clock.elapsedTime;
      const idleTilt = 0.14 + Math.sin(t * 0.17) * 0.045;
      const idleOrbit = Math.sin(t * 0.11) * 0.20;
      const tilt = idleTilt * k - sp * 1.16 + (-py) * 0.12 * k;
      const orbit = idleOrbit * k + sp * 0.36 + Math.sin(t * 0.13) * 0.22 * sp + px * 0.18 * k;
      rot.current.x += (tilt - rot.current.x) * Math.min(1, d * 2.5);
      rot.current.y += (orbit - rot.current.y) * Math.min(1, d * 2.5);
    }
    if (grp.current) {
      easing.damp(grp.current.rotation, 'y', rot.current.y, 0.25, d);
      easing.damp(grp.current.rotation, 'x', rot.current.x, 0.25, d);
      // barely any grow — per the reference the camera does NOT dolly; the apparent size
      // change is the perspective foreshortening of the tilt + the depth ladder opening.
      grp.current.scale.setScalar(scale * (1 + sp * 0.20));
    }
    const ts = a.activity === 'thinking' ? 2.1 : a.activity === 'speaking' ? 1.5 : 1;
    easing.damp(speedRef, 'current', ts, 0.4, d);
  });

  const onDown = (e: ThreeEvent<PointerEvent>) => { drag.current = { active: true, x: e.clientX, y: e.clientY }; };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current?.active) return;
    rot.current.y += (e.clientX - drag.current.x) * 0.006;
    rot.current.x += (e.clientY - drag.current.y) * 0.006;
    drag.current.x = e.clientX; drag.current.y = e.clientY;
  };
  const onUp = () => { if (drag.current) drag.current.active = false; };
  const onWheel = (e: ThreeEvent<WheelEvent>) => {
    splitTarget.current = clamp01(splitTarget.current + (e.deltaY > 0 ? 0.12 : -0.12));
  };

  return (
    <group>
      <mesh onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerOut={onUp} onWheel={onWheel} position={[0, 0, 1.8]}>
        <planeGeometry args={[16, 10]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <group ref={grp} scale={scale}>
        <AgentAura mat={auraMat} tex={glowTex} />
        <StarDust splitRef={splitRef} />
        <SplitOrbitals splitRef={splitRef} speedRef={speedRef} />
        <OrbitGuides splitRef={splitRef} />
        <ReactorFace splitRef={splitRef} speedRef={speedRef} M={M} G={G} />
      </group>
    </group>
  );
}
