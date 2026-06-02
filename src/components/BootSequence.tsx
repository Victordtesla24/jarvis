import * as THREE from 'three';
import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';
import { bootSheet, types } from '../theatre/project';

// ── BootSequence ─────────────────────────────────────────────────────────────
// A 14-second cinematic JARVIS power-on, storyboard-matched to the reference reel
// (youtu.be/mSBn5UU6Y38, 0:00–0:13):
//   0.5–4.5s  concentric HUD reticle assembles (rings fade/scale, arcs wipe, ticks),
//             then spins up.
//   4.5–5.5s  camera flies THROUGH the reticle (dolly + warp-expand).
//   5.5–7.5s  a plexus neural-network of nodes + lines draws in from the centre.
//   7.5–8.5s  the reactor core ignites — white flash + anamorphic lens streak,
//             bloom blown out, plexus consumed.
//   8.5–10s   "J.A.R.V.I.S." resolves out of digital glitch (chromatic split).
//   10–12.5s  the name holds, stable and glowing.
//   12.5–14s  fade to black → onComplete() hands off to the live dashboard.
// Skippable (button / click) for accessibility. Same material discipline as the
// reactor: HDR half-float buffer + hard selective bloom on emissive>1, crisp ≤1.

const TAU = Math.PI * 2;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOutCubic = (x: number) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(x)));
const hdr = (hex: string, m: number) => new THREE.Color(hex).multiplyScalar(m);

export const BOOT_DURATION = 14.0;
// phase boundaries (seconds)
const P = { reticleIn: 0.5, reticleSet: 2.0, flyStart: 4.5, flyEnd: 5.5, plexIn: 5.5, plexFull: 7.2, igniteStart: 7.5, ignitePeak: 7.85, igniteEnd: 8.6 };

const GLOW = hdr('#7FE9FF', 2.4);
const GLOW_HOT = hdr('#FFFFFF', 4.2);
const DIM = new THREE.Color('#0D254C');

// Theatre.js power-on envelope for the whole boot frame (keyframed in src/theatre/project.ts).
// Defined at module scope so it survives component remounts — Theatre objects are singletons.
const bootObj = bootSheet.object('boot-overlay', {
  opacity: types.number(0, { range: [0, 1] }),
  translateY: types.number(10, { range: [-100, 100] }),
  scale: types.number(0.99, { range: [0, 2] }),
});

function radialTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.28, 'rgba(150,233,255,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

// ── concentric HUD reticle that assembles, spins, then warps past the lens ───
function Reticle() {
  const grp = useRef<THREE.Group>(null);
  const sweep = useRef<THREE.Mesh>(null);
  const mats = useMemo(() => ({
    faint: new THREE.MeshBasicMaterial({ color: DIM.clone().multiplyScalar(1.4), transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    ring: new THREE.MeshBasicMaterial({ color: hdr('#39E1F2', 0.9), transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    hot: new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    sweep: new THREE.MeshBasicMaterial({ color: hdr('#BDEEFF', 2.6), transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    tick: new THREE.MeshBasicMaterial({ color: hdr('#7DF9FF', 1.3), toneMapped: false }),
  }), []);
  const tickGeo = useMemo(() => new THREE.PlaneGeometry(0.03, 0.012), []);
  const ticks = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ticks.current; if (!m) return; const d = new THREE.Object3D();
    const N = 72;
    for (let i = 0; i < N; i++) { const a = (i / N) * TAU; d.position.set(Math.cos(a) * 1.46, Math.sin(a) * 1.46, 0); d.rotation.set(0, 0, a); d.scale.setScalar(i % 6 === 0 ? 1.8 : 1); d.updateMatrix(); m.setMatrixAt(i, d.matrix); }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  useEffect(() => () => { Object.values(mats).forEach((m) => m.dispose()); tickGeo.dispose(); }, [mats, tickGeo]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const inP = easeOutCubic(seg(t, P.reticleIn, P.reticleSet));
    const fly = easeInOutCubic(seg(t, P.flyStart, P.flyEnd));
    if (grp.current) {
      const g = grp.current;
      g.visible = t < P.flyEnd + 0.2;
      // assemble: scale 0.86→1, then warp-expand on fly-through
      g.scale.setScalar((0.86 + 0.14 * inP) * (1 + fly * 3.2));
      g.position.z = fly * 5.2;                         // rush toward/over the lens
      const spin = easeOutCubic(seg(t, P.reticleSet, 4.2));
      g.rotation.z += 0.004 + spin * 0.02;
    }
    const o = inP * (1 - fly);
    mats.faint.opacity = 0.5 * o; mats.ring.opacity = 0.95 * o; mats.hot.opacity = 0.9 * o;
    (mats.tick as THREE.MeshBasicMaterial).opacity = o; mats.tick.transparent = true;
    // spin-up sweep blade
    if (sweep.current) {
      const p = seg(t, P.reticleIn + 0.3, P.flyStart);
      sweep.current.rotation.z = -easeOutCubic(p) * TAU * 2.6;
      mats.sweep.opacity = Math.sin(clamp01(p) * Math.PI) * 0.8 * (1 - fly);
    }
  });

  const ringTube = 0.006;
  return (
    <group ref={grp}>
      <mesh material={mats.faint}><torusGeometry args={[1.55, 0.004, 10, 220]} /></mesh>
      <mesh material={mats.ring}><torusGeometry args={[1.3, ringTube, 12, 200]} /></mesh>
      {/* bright arc segments on the mid ring */}
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} material={mats.hot} rotation={[0, 0, k * (TAU / 4) + 0.2]}>
          <torusGeometry args={[1.12, 0.012, 10, 48, TAU * 0.16]} />
        </mesh>
      ))}
      <mesh material={mats.ring}><torusGeometry args={[0.95, 0.004, 10, 160]} /></mesh>
      <instancedMesh ref={ticks} args={[tickGeo, mats.tick, 72]} />
      <mesh material={mats.hot}><torusGeometry args={[0.62, 0.014, 12, 120]} /></mesh>
      <mesh material={mats.hot}><torusGeometry args={[0.34, 0.01, 12, 96]} /></mesh>
      {/* spin-up sweep */}
      <mesh ref={sweep} material={mats.sweep}>
        <ringGeometry args={[0.3, 1.3, 64, 1, 0, 0.18]} />
      </mesh>
    </group>
  );
}

// ── plexus neural-network: nodes (points) + lines that draw in from centre ───
function Plexus() {
  const grp = useRef<THREE.Group>(null);
  const { nodeGeo, nodeMat, lineGeo, lineMat, lineCount } = useMemo(() => {
    const N = 230;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) {
      // fibonacci-ish sphere with jitter, radius spread
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * 2.399963;
      const rad = 0.4 + Math.pow((i * 9301 % 233) / 233, 0.5) * 1.55;
      pts.push(new THREE.Vector3(Math.cos(phi) * r * rad, y * rad * 0.9, Math.sin(phi) * r * rad));
    }
    const npos = new Float32Array(N * 3);
    pts.forEach((p, i) => { npos[i * 3] = p.x; npos[i * 3 + 1] = p.y; npos[i * 3 + 2] = p.z; });
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(npos, 3));
    const nodeMat = new THREE.PointsMaterial({ color: hdr('#9FEFFF', 1.4), size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    // build line segments between near neighbours, ordered by distance-from-centre so they draw outward
    const segs: [THREE.Vector3, THREE.Vector3, number][] = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const d = pts[i].distanceTo(pts[j]);
      if (d < 0.62) { const mid = (pts[i].length() + pts[j].length()) * 0.5; segs.push([pts[i], pts[j], mid]); }
    }
    segs.sort((a, b) => a[2] - b[2]);
    const lpos = new Float32Array(segs.length * 6);
    segs.forEach(([a, b], i) => { lpos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6); });
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    lineGeo.setDrawRange(0, 0);
    const lineMat = new THREE.LineBasicMaterial({ color: hdr('#39C8E8', 1.1), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    return { nodeGeo, nodeMat, lineGeo, lineMat, lineCount: segs.length };
  }, []);
  const lines = useMemo(() => new THREE.LineSegments(lineGeo, lineMat), [lineGeo, lineMat]);
  useEffect(() => () => { nodeGeo.dispose(); nodeMat.dispose(); lineGeo.dispose(); lineMat.dispose(); }, [nodeGeo, nodeMat, lineGeo, lineMat]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const grow = easeOutCubic(seg(t, P.plexIn, P.plexFull));
    const fade = 1 - easeOutExpo(seg(t, P.igniteStart, P.ignitePeak));
    const vis = t > P.plexIn - 0.1 && t < P.igniteEnd;
    if (grp.current) {
      grp.current.visible = vis;
      grp.current.scale.setScalar(0.2 + grow * 1.0);
      grp.current.rotation.y += 0.0025;
      grp.current.rotation.x = 0.12;
    }
    nodeMat.opacity = grow * 0.95 * fade;
    lineMat.opacity = grow * 0.5 * fade;
    lineGeo.setDrawRange(0, Math.floor(lineCount * 2 * easeOutCubic(seg(t, P.plexIn + 0.2, P.plexFull + 0.2))));
  });
  return (
    <group ref={grp} visible={false}>
      <points geometry={nodeGeo} material={nodeMat} />
      <primitive object={lines} />
    </group>
  );
}

// ── reactor-core ignition: white core + anamorphic horizontal streak ─────────
function Ignition({ bloomRef }: { bloomRef: React.MutableRefObject<number> }) {
  const core = useRef<THREE.Mesh>(null);
  const streak = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => radialTexture(), []);
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, color: GLOW_HOT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), [tex]);
  const streakMat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, color: hdr('#BDEFFF', 3.0), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), [tex]);
  useEffect(() => () => { tex.dispose(); coreMat.dispose(); streakMat.dispose(); }, [tex, coreMat, streakMat]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const up = easeOutExpo(seg(t, P.igniteStart, P.ignitePeak));
    const down = easeOutCubic(seg(t, P.ignitePeak, P.igniteEnd));
    const e = up * (1 - down);
    if (core.current) { core.current.scale.setScalar(0.2 + e * 3.4); }
    if (streak.current) { streak.current.scale.set(2 + e * 26, 0.5 + e * 1.4, 1); }
    coreMat.opacity = e; streakMat.opacity = e * 0.85;
    bloomRef.current = e;                                  // drive post bloom blow-out
  });
  return (
    <group position={[0, 0, 0.2]}>
      <mesh ref={streak} material={streakMat}><planeGeometry args={[1, 1]} /></mesh>
      <mesh ref={core} material={coreMat}><planeGeometry args={[1, 1]} /></mesh>
    </group>
  );
}

function CameraRig() {
  const { camera } = useThree();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const fly = easeInOutCubic(seg(t, P.flyStart, P.flyEnd));
    camera.position.z = 5 - fly * 4.4;                    // push through the reticle
    camera.position.x = Math.sin(t * 0.25) * 0.06 * (1 - fly);
    camera.position.y = Math.cos(t * 0.2) * 0.04 * (1 - fly);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Post({ bloomRef }: { bloomRef: React.MutableRefObject<number> }) {
  const bloom = useRef<any>(null);
  const ca = useRef<any>(null);
  const caOff = useMemo(() => new THREE.Vector2(0.0006, 0.0009), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (bloom.current) bloom.current.intensity = 1.1 + bloomRef.current * 3.4;
    // chromatic split spikes during the ignition + the text glitch window
    const glitch = bloomRef.current * 0.004 + seg(t, 8.5, 9.2) * (1 - seg(t, 9.2, 10)) * 0.003;
    if (ca.current?.offset) ca.current.offset.set(caOff.x + glitch, caOff.y + glitch);
  });
  return (
    <EffectComposer multisampling={4} frameBufferType={THREE.HalfFloatType} enableNormalPass={false}>
      <Bloom ref={bloom} mipmapBlur intensity={1.1} luminanceThreshold={0.85} luminanceSmoothing={0.05} radius={0.82} levels={8} kernelSize={KernelSize.LARGE} />
      <ChromaticAberration ref={ca} offset={caOff} radialModulation modulationOffset={0.4} />
      <Vignette eskil={false} offset={0.28} darkness={0.86} />
    </EffectComposer>
  );
}

interface BootSequenceProps { onComplete: () => void; }

const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const doneRef = useRef(false);
  const bootFrameRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const arcL = useRef<HTMLDivElement>(null);
  const arcR = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const finish = () => { if (!doneRef.current) { doneRef.current = true; onComplete(); } };

  useEffect(() => {
    // Theatre.js power-on envelope drives the whole boot frame's fade/scale-in.
    const unsubBoot = bootObj.onValuesChange(({ opacity, translateY, scale }) => {
      const el = bootFrameRef.current;
      if (!el) return;
      el.style.opacity = String(opacity);
      el.style.transform = `translateY(${translateY}px) scale(${scale})`;
    });
    const seq = bootSheet.sequence;

    if (reduced) {
      // Reduced motion: play the brief envelope, then hand off — no manual timers.
      seq.play({ iterationCount: 1, range: [0, 0.6] }).then((completed) => {
        if (completed) finish();
      });
      return () => { unsubBoot(); seq.pause(); };
    }

    seq.play({ iterationCount: 1, range: [0, 0.8] });

    const start = performance.now();
    let raf = 0;
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      // text reveal 8.5→10 (glitch handled by CSS), hold to 12.5, fade 12.5→14
      const titleOpacity = t < 8.5 ? 0 : 1;
      if (titleRef.current) {
        titleRef.current.style.opacity = String(titleOpacity);
        // resolve from glitchy cyan/white to stable blue across 8.5→10.5
        const resolve = clamp01((t - 8.5) / 2);
        const split = (1 - resolve) * 6;
        titleRef.current.style.color = resolve > 0.85 ? '#2D64A5' : '#EAFBFF';
        titleRef.current.style.textShadow =
          `${-split}px 0 rgba(255,40,60,${0.6 * (1 - resolve)}), ${split}px 0 rgba(0,210,255,${0.6 * (1 - resolve)}), 0 0 ${18 + 30 * resolve}px rgba(96,213,247,${0.55 + 0.3 * resolve})`;
      }
      if (subRef.current) subRef.current.style.opacity = String(clamp01((t - 9.4) / 0.8) * (t < 12.5 ? 1 : 0));
      const arcE = clamp01((t - 8.5) / 0.5) * (1 - clamp01((t - 10.4) / 0.8));
      if (arcL.current) arcL.current.style.opacity = String(arcE);
      if (arcR.current) arcR.current.style.opacity = String(arcE);
      if (fadeRef.current) fadeRef.current.style.opacity = String(clamp01((t - 12.5) / 1.5));
      if (t >= BOOT_DURATION) { finish(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { unsubBoot(); seq.pause(); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div
      className="absolute inset-0 z-[100] bg-black overflow-hidden select-none"
      style={{ background: '#020A19', cursor: 'pointer' }}
      onClick={finish}
      role="button"
      aria-label="Skip JARVIS boot sequence"
    >
      {/* Theatre.js-driven power-on frame: the scene fades/scales in together at boot. */}
      <div
        ref={bootFrameRef}
        className="absolute inset-0"
        style={{ opacity: 0, transform: 'translateY(10px) scale(0.99)', willChange: 'opacity, transform' }}
      >
      {!reduced && (
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 50 }}
          gl={{ alpha: false, antialias: false, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
          flat
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <color attach="background" args={['#020A19']} />
          <fog attach="fog" args={['#020A19', 4, 13]} />
          <Suspense fallback={null}>
            <CameraRig />
            <Reticle />
            <Plexus />
            <BloomDriven />
          </Suspense>
        </Canvas>
      )}

      {/* J.A.R.V.I.S. title overlay (resolves out of glitch, then holds) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div
          ref={titleRef}
          className="font-display font-black"
          style={{ opacity: 0, fontSize: 'clamp(48px, 11vw, 168px)', letterSpacing: '0.16em', lineHeight: 1, color: '#EAFBFF', willChange: 'opacity, text-shadow', animation: 'boot-textglitch 1.6s ease-out 8.5s both' }}
        >
          J.A.R.V.I.S.
        </div>
        <div
          ref={subRef}
          className="font-sans text-white/90"
          style={{ opacity: 0, marginTop: 'clamp(12px,2vw,28px)', fontSize: 'clamp(10px,1.1vw,16px)', letterSpacing: '0.5em', fontWeight: 700, textShadow: '0 0 12px rgba(96,213,247,0.6)' }}
        >
          SYSTEMS ONLINE
        </div>
        {/* flanking energy arcs */}
        <div ref={arcL} style={arcStyle('left')} />
        <div ref={arcR} style={arcStyle('right')} />
      </div>

      <div className="scanlines opacity-25" />
      <div ref={fadeRef} className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: 0 }} />
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); finish(); }}
        className="absolute bottom-6 right-8 z-[110] pointer-events-auto font-display text-[10px] tracking-[0.3em] text-holo-cyan/60 hover:text-holo-cyan border border-holo-cyan/30 hover:border-holo-cyan/70 px-3 py-1.5 transition-all"
      >
        SKIP ▸
      </button>
    </div>
  );
};

function arcStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    [side]: 'clamp(8%, 18vw, 30%)' as any,
    width: 'clamp(40px,5vw,90px)', height: 'clamp(160px,26vw,360px)', opacity: 0,
    border: '2px solid rgba(96,213,247,0.75)',
    borderRadius: side === 'left' ? '100% 0 0 100% / 50% 0 0 50%' : '0 100% 100% 0 / 0 50% 50% 0',
    borderRightColor: side === 'left' ? 'transparent' : undefined,
    borderLeftColor: side === 'right' ? 'transparent' : undefined,
    boxShadow: '0 0 22px rgba(96,213,247,0.5)', filter: 'blur(0.4px)', willChange: 'opacity, transform',
  };
}

// small wrapper so <Ignition> and <Post> share one bloom-drive ref inside the Canvas
function BloomDriven() {
  const bloomRef = useRef(0);
  return (<><Ignition bloomRef={bloomRef} /><Post bloomRef={bloomRef} /></>);
}

export default BootSequence;
