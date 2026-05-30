import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Scanline,
  Vignette,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

// ============================================================================
// JARVIS ARC REACTOR  —  APPROVED asset (design_refs/reactor.mp4) as the
// centerpiece, with telemetry-reactive POLISH layers composited on top:
// reactive core glow, orbital particle swarm, segmented data ring, energy arcs,
// holographic energy field. Driven by live CPU load. Silent, holographic.
// ============================================================================

const CYAN = '#00F0FF';

// ---- background holographic energy field (faint cyan polar grid behind) ----
const GridMaterial = shaderMaterial(
  { uTime: 0 },
  /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  /* glsl */ `
    uniform float uTime; varying vec2 vUv;
    void main(){
      vec2 p=(vUv-0.5)*2.0; float r=length(p); float ang=atan(p.y,p.x);
      float rings = smoothstep(0.04,0.0,abs(fract(r*7.0 - uTime*0.05)-0.5)-0.46);
      float spokes= smoothstep(0.03,0.0,abs(fract(ang/6.2831*36.0)-0.5)-0.47);
      float grid = max(rings*0.5, spokes*0.35) * smoothstep(1.0,0.2,r);
      float a = (0.28 + grid) * smoothstep(1.0,0.45,r);
      gl_FragColor = vec4(vec3(0.0,0.55,0.75)*grid + vec3(0.01,0.04,0.06), a);
    }
  `,
);
extend({ GridMaterial });

function EnergyField() {
  const m = useRef<any>(null);
  useFrame((_, dt) => { if (m.current) m.current.uTime += dt; });
  return (
    <mesh position={[0, 0, -0.25]}>
      <circleGeometry args={[2.1, 96]} />
      {/* @ts-ignore */}
      <gridMaterial ref={m} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

// ---- APPROVED reactor video as the centerpiece (additive => black bg drops out) ----
function VideoReactor({ load }: { load: number }) {
  const video = useMemo(() => {
    const v = document.createElement('video');
    v.src = '/reactor.mp4';
    v.loop = true;
    v.muted = true; // silent
    v.playsInline = true;
    v.crossOrigin = 'anonymous';
    v.play().catch(() => {});
    return v;
  }, []);
  const tex = useMemo(() => {
    const t = new THREE.VideoTexture(video);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [video]);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(() => {
    const t = performance.now() / 1000;
    // breathe the reactor brightness with load + a slow pulse
    if (mat.current) mat.current.opacity = 0.92 + 0.08 * Math.sin(t * 2.0) + load * 0.15;
  });
  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[3.5, 3.5]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={1} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

// ---- reactive core glow over the video centre (the "blindingly bright" heart) ----
function CoreGlow({ load }: { load: number }) {
  const inner = useRef<THREE.Mesh>(null!);
  const outer = useRef<THREE.Mesh>(null!);
  const innerMat = useRef<THREE.MeshBasicMaterial>(null!);
  const light = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    const t = performance.now() / 1000;
    const osc = 0.5 + 0.5 * Math.sin(t * 3.0);
    const scl = THREE.MathUtils.lerp(0.92, 1.1, osc) * (1 + load * 0.25);
    if (inner.current) inner.current.scale.setScalar(0.09 * scl);
    if (outer.current) outer.current.scale.setScalar(0.2 * scl);
    if (innerMat.current) innerMat.current.opacity = 0.55 + 0.2 * osc;
    if (light.current) light.current.intensity = THREE.MathUtils.lerp(4, 12, osc) * (0.6 + load);
  });
  return (
    <group position={[0, 0, 0.05]}>
      <pointLight ref={light} color={CYAN} distance={5} decay={2} intensity={8} />
      <mesh ref={inner}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial ref={innerMat} color="#eafdff" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={outer}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---- occasional energy arcs jumping across the reactor ----
function EnergyArcs() {
  const meshes = useRef<THREE.Mesh[]>([]);
  const state = useRef([...Array(3)].map(() => ({ life: 0, dur: 1, next: 1 + Math.random() * 4 })));
  useFrame((_, dt) => {
    state.current.forEach((s, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      if (s.life > 0) {
        s.life -= dt;
        (mesh.material as any).opacity = Math.sin(Math.max(0, s.life / s.dur) * Math.PI) * 0.85;
        if (s.life <= 0) mesh.visible = false;
      } else {
        s.next -= dt;
        if (s.next <= 0) {
          const a = Math.random() * Math.PI * 2;
          const r1 = 0.5, r2 = 1.25, mid = (r1 + r2) / 2;
          mesh.position.set(Math.cos(a) * mid, Math.sin(a) * mid, 0.08);
          mesh.rotation.set(0, 0, a - Math.PI / 2);
          mesh.scale.set(1, (r2 - r1) * (0.8 + Math.random() * 0.4), 1);
          mesh.visible = true;
          s.dur = 0.5 + Math.random() * 1.0; s.life = s.dur; s.next = 3 + Math.random() * 4;
        }
      }
    });
  });
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { if (m) meshes.current[i] = m; }} visible={false}>
          <cylinderGeometry args={[0.01, 0.01, 1, 6]} />
          <meshBasicMaterial color="#ccffff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---- outer holographic data ring (4 segments + data dots), slow rotate ----
function DataRing() {
  const g = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { if (g.current) g.current.rotation.z += dt * 0.08; });
  const dots = useMemo(() => [...Array(56)].map((_, i) => {
    const a = (i / 56) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * 1.75, Math.sin(a) * 1.75, 0);
  }), []);
  return (
    <group ref={g} position={[0, 0, 0.02]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
          <torusGeometry args={[1.75, 0.006, 8, 64, Math.PI * 0.42]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
      {dots.map((v, i) => (
        <mesh key={`d${i}`} position={[v.x, v.y, 0]}>
          <sphereGeometry args={[0.011, 6, 6]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---- orbiting particle swarm (flat, in the reactor plane) ----
function ParticleSwarm({ spin }: { spin: number }) {
  const pts = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const n = 500, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = 1.2 + Math.random() * 0.85;
      p[i * 3] = Math.cos(a) * rad;
      p[i * 3 + 1] = Math.sin(a) * rad;
      p[i * 3 + 2] = (Math.random() - 0.5) * 0.14;
    }
    return p;
  }, []);
  useFrame((_, dt) => { if (pts.current) pts.current.rotation.z += dt * (0.12 + spin * 0.6); });
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={500} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.028} color={CYAN} transparent opacity={0.8} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

function Reactor({ load }: { load: number }) {
  const spin = 0.2 + load * 0.8;
  return (
    <group>
      <EnergyField />
      <VideoReactor load={load} />
      <DataRing />
      <EnergyArcs />
      <CoreGlow load={load} />
      <ParticleSwarm spin={spin} />
    </group>
  );
}

export default function ReactorCore({ load = 0.1 }: { load?: number }) {
  const caOffset = useMemo(() => new THREE.Vector2(0.001, 0.0006), []);
  return (
    <>
      <ambientLight intensity={0.5} />
      <Reactor load={load} />
      <EffectComposer disableNormalPass frameBufferType={THREE.HalfFloatType}>
        <Bloom mipmapBlur luminanceThreshold={0.28} intensity={1.0} radius={0.7} levels={7} />
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={caOffset} radialModulation modulationOffset={0.4} />
        <Scanline blendFunction={BlendFunction.OVERLAY} density={1.2} opacity={0.1} />
        <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.025} />
        <Vignette eskil={false} offset={0.2} darkness={0.85} />
      </EffectComposer>
    </>
  );
}
