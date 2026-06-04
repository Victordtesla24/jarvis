import * as THREE from 'three';
import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { EffectComposer, Bloom, DepthOfField, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';
import { easing } from 'maath';
import { HandTrackingState } from '../../types';
import { AgentBus } from '../../services/agentState';

// ── ReactorCore3D ───────────────────────────────────────────────────────────
// A fully PROCEDURAL holographic status reticle, restyled to the "STATUS REALM"
// reference (the crisp monochrome concentric-ring HUD with a faceted wireframe
// sphere): NO particles. Every ring, dot, tick, triangle marker and bracket is
// emissive line/quad geometry so it stays razor-sharp at any zoom. Viewed
// head-on it reads as the flat 2D reticle of the reference still; the wireframe
// sphere + counter-rotating ring families animate it in true 3D.
//
// Material discipline:
//   • GLOW tier  — colour channels > 1, toneMapped:false: only these exceed the
//                  Bloom threshold (1.0), so the bold segmented ring, triangle
//                  markers, major ticks and the small core lip bloom softly.
//   • STRUCTURE  — channels ≤ 1: crisp white-silver hairlines that never bloom
//                  (thin rings, dotted rings, minor ticks) — the mechanical read.
// Palette: cool white / silver-grey on black, with faint red housing accents —
// matched to the reference, and bright enough to sit coherently over the cyan HUD.

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const R = 1.5;                                   // master radius = outer rim

const ICE = new THREE.Color('#EAF6FF');
const RED = new THREE.Color('#FF5A3C');
const hdr = (hex: string, mul: number) => new THREE.Color(hex).multiplyScalar(mul);

const _col = new THREE.Color();
const CA_OFFSET = new THREE.Vector2(0.0005, 0.0008);

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0: number, e1: number, x: number) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

// soft radial gradient sprite (faint core glow bed + agent aura)
function makeRadialTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');           // null under jsdom — guard so tests don't throw
  if (g) {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.92)');
    grd.addColorStop(0.32, 'rgba(190,224,255,0.42)');
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
      // GLOW (bloom)
      coreHot: basic(hdr('#FFFFFF', 3.0)),
      coreRing: basic(hdr('#EAF6FF', 1.5)),
      ringBright: basic(hdr('#EAF6FF', 1.7)),          // bold segmented ring + bright arcs
      tri: basic(hdr('#F0F8FF', 1.5)),                 // index triangle markers
      majorTickBase: basic(new THREE.Color(1, 1, 1)),  // instanceColor-driven
      // STRUCTURE (≤1, crisp, never bloom)
      ringThin: basic(hdr('#CBD9E8', 0.92)),           // crisp white-silver hairline
      ringDim: basic(hdr('#67788A', 0.78)),            // faint grey
      dot: basic(hdr('#D6E6F4', 0.95)),                // dotted rings
      red: basic(hdr('#FF5A3C', 0.85)),                // faint red housing accent
      redBright: basic(hdr('#FF6A4A', 1.3)),           // small red index (blooms faintly)
      tickBase: basic(new THREE.Color(1, 1, 1)),       // instanceColor-driven
      sphere: new THREE.LineBasicMaterial({ color: hdr('#9FB8CC', 0.9), transparent: true, opacity: 0.17, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      // additive glow sprites
      coreGlow: add(hdr('#BFE0FF', 0.95), 0.4, glowTex),
      sweep: add(hdr('#DCEFFF', 2.4), 0),
    };
    return { M, glowTex };
  }, []);
  useEffect(() => () => { Object.values(built.M).forEach((m) => m.dispose()); built.glowTex.dispose(); }, [built]);
  return built;
}
type Mats = ReturnType<typeof useMaterials>['M'];

// ── shared geometries ───────────────────────────────────────────────────────
function useGeometries() {
  const G = useMemo(() => ({
    tickPlane: new THREE.PlaneGeometry(1, 1),
    dot: new THREE.CircleGeometry(1, 10),        // round dot for dotted rings (scaled tiny)
    block: new THREE.PlaneGeometry(0.02, 0.05),  // bracket detail block
  }), []);
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

// instanced ring of small quads/dots — one draw call, parent-group rotated
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

// ── faceted wireframe sphere — the rotating 3D centrepiece (reference dome) ───
// A geodesic icosphere rendered as additive white-silver edges. It spins on two
// axes so the reticle, viewed head-on, gains genuine volumetric rotation.
function WireframeSphere({ radius, mat }: { radius: number; mat: THREE.Material }) {
  const grp = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const ico = new THREE.IcosahedronGeometry(radius, 2);
    const wf = new THREE.WireframeGeometry(ico);
    ico.dispose();
    return wf;
  }, [radius]);
  const lines = useMemo(() => new THREE.LineSegments(geo, mat), [geo, mat]);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    if (grp.current) { grp.current.rotation.y += d * 0.20; grp.current.rotation.x += d * 0.055; }
  });
  return <group ref={grp} position={[0, 0, -0.05]}><primitive object={lines} /></group>;
}

// ── soft agent aura behind the core (faint, mood-reactive bloom seed) ────────
function AgentAura({ mat, tex }: { mat: THREE.MeshBasicMaterial; tex: THREE.Texture }) {
  const mesh = useRef<THREE.Mesh>(null);
  useEffect(() => { mat.map = tex; mat.needsUpdate = true; }, [mat, tex]);
  useFrame((state) => {
    const a = AgentBus.get(); const t = state.clock.elapsedTime;
    const pulse = a.activity === 'speaking' ? 0.45 + 0.55 * Math.abs(Math.sin(t * 9))
      : a.activity === 'thinking' ? 0.5 + 0.5 * Math.sin(t * 3.4)
        : 0.5 + 0.5 * Math.sin(t * 1.1);
    const active = a.activity !== 'idle' ? 1 : 0;
    mat.opacity = 0.08 + a.intensity * 0.16 + active * 0.14 * pulse;
    mat.color.copy(a.mood === 'alert' ? RED : a.mood === 'success' ? _col.set('#5BE8A0') : _col.set('#9FD8F0'));
    if (mesh.current) mesh.current.scale.setScalar(1.4 + pulse * 0.16 + a.intensity * 0.24);
  });
  return (
    <mesh ref={mesh} position={[0, 0, -0.4]} renderOrder={-1} material={mat}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

// ── the reticle: concentric ring families, each spinning at its own rate ─────
interface Family { restZ: number; splitZ: number; spin: number; order: number; }
// splitZ keeps an OPTIONAL depth ladder (wheel-driven) for a disintegrate tunnel;
// at rest (split 0) every family sits near z≈0 → the flat reference reticle.
const FAMILIES = {
  containment: { restZ: -0.10, splitZ: -0.16, spin: 0.016, order: 7 } as Family,  // outer rings + dotted ring
  data: { restZ: -0.08, splitZ: 0.02, spin: -0.05, order: 6 } as Family,          // dotted data ring (CCW)
  outer: { restZ: -0.05, splitZ: 0.16, spin: 0.038, order: 5 } as Family,         // bold segmented ring + triangles (CW)
  sphere: { restZ: -0.02, splitZ: 0.36, spin: 0.0, order: 4 } as Family,          // wireframe sphere
  grad: { restZ: 0.00, splitZ: 0.54, spin: -0.07, order: 3 } as Family,           // fine graduation dial (CCW)
  inner: { restZ: 0.02, splitZ: 0.78, spin: 0.10, order: 2 } as Family,           // inner rings + dial (CW)
  core: { restZ: 0.05, splitZ: 1.14, spin: 0.0, order: 1 } as Family,             // centre cluster
};

function ReactorFace({ splitRef, speedRef, M, G }: {
  splitRef: React.MutableRefObject<number>; speedRef: React.MutableRefObject<number>; M: Mats; G: Geos;
}) {
  const refs = {
    containment: useRef<THREE.Group>(null), data: useRef<THREE.Group>(null), outer: useRef<THREE.Group>(null),
    sphere: useRef<THREE.Group>(null), grad: useRef<THREE.Group>(null), inner: useRef<THREE.Group>(null),
    core: useRef<THREE.Group>(null),
  };
  const coreHot = useRef<THREE.Mesh>(null);
  const sweep = useRef<THREE.Mesh>(null);
  const t0 = useRef(-1);

  // instance colours (major channels >1 bloom; minor ≤1 crisp)
  const tickMinor = useMemo(() => hdr('#7C8E9C', 0.9), []);
  const tickMajor = useMemo(() => hdr('#EAF6FF', 1.3), []);
  const gradColor = useMemo(() => (_: number, major: boolean) => (major ? tickMajor : tickMinor), [tickMajor, tickMinor]);
  const innerTickColor = useMemo(() => () => tickMinor, [tickMinor]);
  const coreTick = useMemo(() => hdr('#B8C8D6', 1.0), []);
  const coreTickColor = useMemo(() => () => coreTick, [coreTick]);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05), t = state.clock.elapsedTime;
    if (t0.current < 0) t0.current = t;
    const boot = clamp01((t - t0.current) / 4.0);
    const split = splitRef.current;
    const a = AgentBus.get();
    const speed = speedRef.current;
    const hold = 1 - split * 0.9;
    const idleGate = smooth(0.55, 1.0, boot);

    for (const key in FAMILIES) {
      const f = FAMILIES[key as keyof typeof FAMILIES];
      const g = refs[key as keyof typeof refs].current;
      if (!g) continue;
      g.rotation.z += d * f.spin * 6 * speed * hold * idleGate;
      g.position.z = f.restZ + f.splitZ * split;
      // boot reveal: families assemble core→out across boot 0.0–0.55, then settle
      const start = (f.order / 7) * 0.42;
      const rev = easeOut(smooth(start, start + 0.20, boot));
      g.scale.setScalar(rev <= 0 ? 0.0001 : rev);
    }

    // small white core: gentle ignition flash then breathing pulse (restrained — a
    // bright point, not a blooming sun, matching the reference's tiny centre).
    if (coreHot.current) {
      const energy = 0.5 + a.intensity * 0.8;
      const breathe = 1 + Math.sin(t * 3.0) * 0.07;
      const ignite = boot < 0.16 ? 1 + (1 - boot / 0.16) * 1.2 : 1;
      const mul = (2.4 + energy * 1.2) * breathe * ignite;
      (M.coreHot as THREE.MeshBasicMaterial).color.copy(a.mood === 'alert' ? RED : ICE).multiplyScalar(mul / 2.6);
      coreHot.current.scale.setScalar((0.85 + energy * 0.18) * breathe);
    }

    // BOOT: spin-up sweep blade (fast → decelerating), fades in/out around boot 0.5–0.92
    if (sweep.current) {
      const p = clamp01((boot - 0.46) / 0.46);
      sweep.current.rotation.z = -easeOut(p) * TAU * 2.4;
      (M.sweep as THREE.MeshBasicMaterial).opacity = Math.sin(clamp01(p) * Math.PI) * 0.8 * (split < 0.2 ? 1 : 0);
    }
  });

  return (
    <group>
      {/* L0 — centre cluster: faint glow, fine tick dial, rings, white core dot, red housing hex */}
      <group ref={refs.core}>
        <mesh material={M.coreGlow} position={[0, 0, -0.02]} renderOrder={-1}><planeGeometry args={[0.40 * R, 0.40 * R]} /></mesh>
        <Ring r={0.155 * R} tube={0.004} mat={M.red} seg={6} />
        <InstancedRing count={60} radius={0.118 * R} geo={G.dot} mat={M.tickBase} sx={0.006} sy={0.006} colorFn={coreTickColor} />
        <Ring r={0.088 * R} tube={0.0035} mat={M.ringThin} seg={96} />
        <Ring r={0.050 * R} tube={0.007} mat={M.coreRing} seg={64} />
        <mesh ref={coreHot} material={M.coreHot}><circleGeometry args={[0.024 * R, 32]} /></mesh>
      </group>

      {/* L2 — inner concentric rings + broken bright arcs + fine tick band */}
      <group ref={refs.inner}>
        <Ring r={0.20 * R} tube={0.0035} mat={M.ringThin} seg={160} />
        <Ring r={0.265 * R} tube={0.0035} mat={M.ringDim} seg={160} />
        {[0, 1, 2].map((k) => (
          <Arc key={k} r={0.305 * R} tube={0.006} mat={M.ringBright} arc={66 * DEG} start={(k * 120 + 16) * DEG} />
        ))}
        <InstancedRing count={84} radius={0.235 * R} geo={G.tickPlane} mat={M.tickBase} sx={0.016} sy={0.004} colorFn={innerTickColor} />
      </group>

      {/* L3 — fine graduation dial (the radial-tick ring) */}
      <group ref={refs.grad}>
        <Ring r={0.40 * R} tube={0.003} mat={M.ringThin} seg={256} />
        <InstancedRing count={120} radius={0.44 * R} geo={G.tickPlane} mat={M.majorTickBase} sx={0.05} sy={0.006}
          elongateEvery={10} elongateScale={1.9} colorFn={gradColor} />
        <Ring r={0.478 * R} tube={0.0035} mat={M.ringThin} seg={256} />
      </group>

      {/* L4 — faceted wireframe sphere (rotates in 3D) */}
      <group ref={refs.sphere}>
        <WireframeSphere radius={0.60 * R} mat={M.sphere} />
      </group>

      {/* L5 — bold segmented ring + bracket blocks + left/right index triangles */}
      <group ref={refs.outer}>
        {[0, 1, 2, 3].map((k) => (
          <Arc key={k} r={0.70 * R} tube={0.016} mat={M.ringBright} arc={60 * DEG} start={(k * 90 + 15) * DEG} />
        ))}
        {Array.from({ length: 4 }, (_, i) => {
          const a = i * (TAU / 4) + (45 * DEG);
          return <mesh key={i} position={[Math.cos(a) * 0.70 * R, Math.sin(a) * 0.70 * R, 0]} rotation={[0, 0, a]} material={M.ringBright} geometry={G.block} />;
        })}
        <TriMarkers r={0.625 * R} degs={[90, 270]} mat={M.tri} size={0.055} />
        {/* faint red directional accents echoing the reference housing */}
        <TriMarkers r={0.625 * R} degs={[0, 180]} mat={M.red} size={0.03} />
      </group>

      {/* L6 — dotted data ring (fast, CCW) */}
      <group ref={refs.data}>
        <Ring r={0.80 * R} tube={0.003} mat={M.ringDim} seg={256} />
        <InstancedRing count={96} radius={0.835 * R} geo={G.dot} mat={M.dot} sx={0.0075} sy={0.0075} />
      </group>

      {/* L7 — outer thin rings + dotted perimeter + top/bottom index triangles */}
      <group ref={refs.containment}>
        <Ring r={0.99 * R} tube={0.004} mat={M.ringThin} seg={384} />
        <Ring r={0.955 * R} tube={0.0025} mat={M.ringDim} seg={320} />
        <InstancedRing count={150} radius={0.915 * R} geo={G.dot} mat={M.dot} sx={0.006} sy={0.006} />
        <TriMarkers r={0.99 * R} degs={[0, 180]} mat={M.tri} size={0.04} />
      </group>

      {/* BOOT — spin-up sweep blade */}
      <mesh ref={sweep} material={M.sweep} position={[0, 0, 0.05]}>
        <ringGeometry args={[0.16 * R, 0.99 * R, 64, 1, 0, 0.16]} />
      </mesh>
    </group>
  );
}

// ── post: split-driven DoF + soft selective bloom + subtle CA ────────────────
function Post({ splitRef }: { splitRef: React.MutableRefObject<number> }) {
  const dof = useRef<any>(null);
  useFrame(() => {
    if (dof.current) dof.current.bokehScale = splitRef.current * 2.6;
  });
  return (
    <EffectComposer multisampling={8} frameBufferType={THREE.HalfFloatType} enableNormalPass={false}>
      <DepthOfField ref={dof} target={[0, 0, 0]} worldFocusRange={3.0} bokehScale={0} height={1024} />
      <Bloom mipmapBlur intensity={0.9} luminanceThreshold={1.0} luminanceSmoothing={0.04} radius={0.8} levels={7} kernelSize={KernelSize.LARGE} />
      <ChromaticAberration offset={CA_OFFSET} radialModulation modulationOffset={0.45} />
      <Vignette eskil={false} offset={0.32} darkness={0.7} />
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

// ── controller: drag/orbit, optional wheel-split, gentle face-on parallax ────
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
    // QA hook (inert in production): pin the split via window.__JARVIS_SPLIT__ (0–1).
    const dbg = (globalThis as any).__JARVIS_SPLIT__;
    if (typeof dbg === 'number') target = clamp01(dbg);
    splitTarget.current = target;
    easing.damp(splitRef, 'current', target, 0.18, d);

    const sp = splitRef.current;
    if (right) {
      rot.current.y = right.rotationControl.x * Math.PI;
      rot.current.x = 0.04 - sp * 1.16 + right.rotationControl.y * Math.PI * 0.4 * (1 - sp);
    } else if (!drag.current?.active) {
      // Read mostly face-on like the reference still; the wireframe sphere + ring
      // counter-rotation supply the 3D motion. A whisper of tilt/azimuth + pointer
      // parallax keeps the Z-layered families reading as genuine depth. On wheel-split
      // the assembly tilts to a steep oblique so we look down the separating tunnel.
      const k = 1 - sp;
      const px = state.pointer.x, py = state.pointer.y;
      const t = state.clock.elapsedTime;
      const idleTilt = 0.06 + Math.sin(t * 0.17) * 0.03;
      const idleOrbit = Math.sin(t * 0.12) * 0.10;
      const tilt = idleTilt * k - sp * 1.16 + (-py) * 0.10 * k;
      const orbit = idleOrbit * k + sp * 0.36 + Math.sin(t * 0.13) * 0.22 * sp + px * 0.14 * k;
      rot.current.x += (tilt - rot.current.x) * Math.min(1, d * 2.5);
      rot.current.y += (orbit - rot.current.y) * Math.min(1, d * 2.5);
    }
    if (grp.current) {
      easing.damp(grp.current.rotation, 'y', rot.current.y, 0.25, d);
      easing.damp(grp.current.rotation, 'x', rot.current.x, 0.25, d);
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
        <ReactorFace splitRef={splitRef} speedRef={speedRef} M={M} G={G} />
      </group>
    </group>
  );
}
