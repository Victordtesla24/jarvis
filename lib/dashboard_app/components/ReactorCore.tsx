import React, { useMemo, useRef, useState } from 'react';
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
// MOVIE-ACCURATE IRON MAN ARC REACTOR  (10 layers, inside-out per spec)
// Core intensity / spin / swarm speed are driven by CPU load (the telemetry
// analogue of "left hand fully open"). Silent. Holographically projected via Bloom.
// ============================================================================

const CYAN = '#00F0FF';
const Y = new THREE.Vector3(0, 0, 1);

// ---- Layer 0: background energy field (dark plate + faint cyan polar grid) ----
const GridMaterial = shaderMaterial(
  { uTime: 0 },
  /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  /* glsl */ `
    uniform float uTime; varying vec2 vUv;
    void main(){
      vec2 p = (vUv-0.5)*2.0;
      float r = length(p);
      float ang = atan(p.y,p.x);
      float rings = smoothstep(0.04,0.0,abs(fract(r*7.0 - uTime*0.05)-0.5)-0.46);
      float spokes = smoothstep(0.03,0.0,abs(fract(ang/6.2831*36.0)-0.5)-0.47);
      float grid = max(rings*0.5, spokes*0.35) * smoothstep(1.0,0.2,r);
      vec3 base = mix(vec3(0.02,0.04,0.07), vec3(0.0), r);
      vec3 col = base + vec3(0.0,0.55,0.75)*grid;
      float a = (0.55 + grid) * smoothstep(1.0,0.55,r);
      gl_FragColor = vec4(col, a);
    }
  `,
);
const TraceMaterial = shaderMaterial(
  { uTime: 0 },
  /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  /* glsl */ `
    uniform float uTime; varying vec2 vUv;
    void main(){
      vec2 p=(vUv-0.5)*2.0; float r=length(p); float ang=atan(p.y,p.x);
      if(r<0.45||r>1.0){ discard; }
      float spokes = smoothstep(0.02,0.0,abs(fract(ang/6.2831*24.0)-0.5)-0.48);
      float conc   = smoothstep(0.02,0.0,abs(fract(r*9.0)-0.5)-0.47);
      float pulse  = 0.5+0.5*sin(r*18.0 - uTime*3.0);
      float a = (spokes*0.8 + conc*0.5) * (0.4+0.6*pulse);
      gl_FragColor = vec4(vec3(0.2,0.95,1.0), a*0.9);
    }
  `,
);
extend({ GridMaterial, TraceMaterial });

function BackgroundField() {
  const m = useRef<any>(null);
  useFrame((_, dt) => { if (m.current) m.current.uTime += dt; });
  return (
    <mesh position={[0, 0, -0.2]}>
      <circleGeometry args={[2.0, 96]} />
      {/* @ts-ignore */}
      <gridMaterial ref={m} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

function CircuitTraces() {
  const m = useRef<any>(null);
  useFrame((_, dt) => { if (m.current) m.current.uTime += dt; });
  return (
    <mesh position={[0, 0, 0.02]}>
      <circleGeometry args={[1.2, 96]} />
      {/* @ts-ignore */}
      <traceMaterial ref={m} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

// triangle vertices (one pointing up), radius `rad`
const triVerts = (rad: number) =>
  [0, 1, 2].map((i) => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
    return new THREE.Vector2(Math.cos(a) * rad, Math.sin(a) * rad);
  });

// rounded equilateral triangle with concave (inward-bowed) edges as a Shape
function concaveTriangle(pts: THREE.Vector2[], bow: number) {
  const s = new THREE.Shape();
  s.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < 3; i++) {
    const a = pts[i], b = pts[(i + 1) % 3];
    const mid = a.clone().add(b).multiplyScalar(0.5).multiplyScalar(bow); // pull toward centre
    s.quadraticCurveTo(mid.x, mid.y, b.x, b.y);
  }
  return s;
}

// ---- Layer 1: outer triangular mounting frame (+ bolts) ----
function TriangularFrame() {
  const geo = useMemo(() => {
    const shape = concaveTriangle(triVerts(1.8), 0.8);
    const hole = concaveTriangle(triVerts(1.5), 0.8);
    shape.holes.push(new THREE.Path(hole.getPoints(48)));
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, steps: 1,
    });
    g.center();
    return g;
  }, []);
  const bolts = useMemo(() => triVerts(1.78), []);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#1a1a2e" metalness={0.92} roughness={0.38} emissive="#13b6da" emissiveIntensity={0.55} />
      </mesh>
      {bolts.map((v, i) => (
        <mesh key={i} position={[v.x, v.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.2, 20]} />
          <meshStandardMaterial color="#2a2f3e" metalness={0.95} roughness={0.25} emissive="#0a8ca8" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ---- Layer 2: three S-curved support arms ----
function SupportArms() {
  const curves = useMemo(
    () =>
      triVerts(1.74).map((p) => {
        const v = new THREE.Vector3(p.x, p.y, 0);
        const a = Math.atan2(p.y, p.x) + 0.22;
        const r = new THREE.Vector3(Math.cos(a) * 1.18, Math.sin(a) * 1.18, 0);
        const dir = r.clone().sub(v);
        const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
        const c1 = v.clone().lerp(r, 0.34).add(perp.clone().multiplyScalar(0.2));
        const c2 = v.clone().lerp(r, 0.68).add(perp.clone().multiplyScalar(-0.2));
        return new THREE.CubicBezierCurve3(v, c1, c2, r);
      }),
    [],
  );
  return (
    <group>
      {curves.map((c, i) => (
        <mesh key={i}>
          <tubeGeometry args={[c, 40, 0.052, 12, false]} />
          <meshStandardMaterial color="#b6c1d0" metalness={0.85} roughness={0.28} emissive="#0a8ca8" emissiveIntensity={0.45} />
        </mesh>
      ))}
    </group>
  );
}

// ---- Layer 3: primary outer ring + 12 rivets ----
function PrimaryRing() {
  const rivets = useMemo(() => [...Array(12)].map((_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0);
  }), []);
  return (
    <group>
      <mesh>
        <torusGeometry args={[1.2, 0.07, 20, 96]} />
        <meshStandardMaterial color="#23283a" metalness={0.88} roughness={0.32} emissive="#0a8ca8" emissiveIntensity={0.55} />
      </mesh>
      {rivets.map((v, i) => (
        <mesh key={i} position={[v.x, v.y, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.06, 12]} />
          <meshStandardMaterial color="#3a4254" metalness={0.95} roughness={0.2} emissive="#0a8ca8" emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// ---- Layer 4: electromagnetic copper coil array (rotates) ----
function CoilArray({ spin }: { spin: number }) {
  const g = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { if (g.current) g.current.rotation.z += dt * spin * 0.6; });
  const coils = useMemo(() => [...Array(10)].map((_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return { a, x: Math.cos(a) * 0.9, y: Math.sin(a) * 0.9 };
  }), []);
  return (
    <group ref={g}>
      {coils.map((c, i) => (
        <group key={i} position={[c.x, c.y, 0]} rotation={[0, Math.PI / 2, c.a]}>
          {/* coil body */}
          <mesh>
            <torusGeometry args={[0.075, 0.05, 14, 28]} />
            <meshStandardMaterial color="#E8A840" metalness={0.95} roughness={0.15} emissive="#442200" emissiveIntensity={0.8} />
          </mesh>
          {/* wire wraps */}
          {[-0.03, 0, 0.03].map((o, j) => (
            <mesh key={j} position={[0, 0, 0]}>
              <torusGeometry args={[0.075, 0.014, 8, 24, Math.PI * 1.6]} />
              <meshStandardMaterial color="#ffce7a" metalness={0.9} roughness={0.2} emissive="#5a2e00" emissiveIntensity={0.6} />
            </mesh>
          ))}
        </group>
      ))}
      {/* radial copper arms to the outer ring */}
      {coils.map((c, i) => (
        <mesh key={`a${i}`} position={[Math.cos(c.a) * 1.03, Math.sin(c.a) * 1.03, 0]} rotation={[0, 0, c.a - Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, 0.26, 8]} />
          <meshStandardMaterial color="#E8A840" metalness={0.95} roughness={0.18} emissive="#442200" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ---- Layer 5: inner glow ring ----
function InnerGlowRing() {
  return (
    <mesh>
      <torusGeometry args={[0.55, 0.025, 16, 80]} />
      <meshBasicMaterial color={CYAN} toneMapped={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// ---- Layer 6: pulsating core ----
function Core({ load }: { load: number }) {
  const inner = useRef<THREE.Mesh>(null!);
  const innerMat = useRef<THREE.MeshStandardMaterial>(null!);
  const light = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    const t = performance.now() / 1000;
    const osc = 0.5 + 0.5 * Math.sin(t * 3.0);
    const inten = THREE.MathUtils.lerp(2.5, 5.0, osc) * (0.7 + load * 0.6);
    const scl = THREE.MathUtils.lerp(0.92, 1.08, osc);
    if (innerMat.current) innerMat.current.emissiveIntensity = inten;
    if (inner.current) inner.current.scale.setScalar(scl);
    if (light.current) light.current.intensity = THREE.MathUtils.lerp(6, 16, osc) * (0.6 + load);
  });
  return (
    <group>
      <pointLight ref={light} color={CYAN} distance={6} decay={2} intensity={10} />
      <mesh ref={inner}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial ref={innerMat} color="#ffffff" emissive={CYAN} emissiveIntensity={3.5} metalness={0.1} roughness={0.25} toneMapped={false} />
      </mesh>
      {/* outer transparent glow */}
      <mesh>
        <sphereGeometry args={[0.34, 24, 24]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---- Layer 8: occasional energy arcs between inner & outer ring ----
function EnergyArcs() {
  const meshes = useRef<THREE.Mesh[]>([]);
  const state = useRef([...Array(3)].map(() => ({ life: 0, dur: 1, next: 1 + Math.random() * 4 })));
  useFrame((_, dt) => {
    state.current.forEach((s, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      if (s.life > 0) {
        s.life -= dt;
        const k = Math.max(0, s.life / s.dur);
        (mesh.material as THREE.Material as any).opacity = Math.sin(k * Math.PI) * 0.9;
        if (s.life <= 0) mesh.visible = false;
      } else {
        s.next -= dt;
        if (s.next <= 0) {
          const a = Math.random() * Math.PI * 2;
          const r1 = 0.55, r2 = 1.2, mid = (r1 + r2) / 2;
          mesh.position.set(Math.cos(a) * mid, Math.sin(a) * mid, 0.06);
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
          <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
          <meshBasicMaterial color="#ccffff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---- Layer 9: outer holographic data ring (4 segments + data dots) ----
function DataRing() {
  const g = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { if (g.current) g.current.rotation.z += dt * 0.08; });
  const dots = useMemo(() => [...Array(48)].map((_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0);
  }), []);
  return (
    <group ref={g}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
          <torusGeometry args={[2.2, 0.008, 8, 48, Math.PI * 0.42]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
      {dots.map((v, i) => (
        <mesh key={`d${i}`} position={[v.x, v.y, 0]}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---- Layer 10: orbiting particle swarm (flat toroidal) ----
function ParticleSwarm({ spin }: { spin: number }) {
  const pts = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const n = 500, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = 1.25 + Math.random() * 0.8;
      p[i * 3] = Math.cos(a) * rad;
      p[i * 3 + 1] = Math.sin(a) * rad;
      p[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
    }
    return p;
  }, []);
  useFrame((_, dt) => { if (pts.current) pts.current.rotation.z += dt * (0.15 + spin * 0.7); });
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={500} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color={CYAN} transparent opacity={0.85} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

function Reactor({ load }: { load: number }) {
  const root = useRef<THREE.Group>(null!);
  const spin = 0.25 + load * 0.9;
  useFrame(() => {
    // gentle breath of the whole assembly
    const t = performance.now() / 1000;
    if (root.current) root.current.rotation.z = Math.sin(t * 0.3) * 0.02;
  });
  return (
    <group ref={root}>
      <BackgroundField />
      <TriangularFrame />
      <SupportArms />
      <PrimaryRing />
      <CircuitTraces />
      <CoilArray spin={spin} />
      <InnerGlowRing />
      <EnergyArcs />
      <Core load={load} />
      <DataRing />
      <ParticleSwarm spin={spin} />
    </group>
  );
}

export default function ReactorCore({ load = 0.1 }: { load?: number }) {
  const caOffset = useMemo(() => new THREE.Vector2(0.0011, 0.0007), []);
  return (
    <>
      {/* lighting for the metallic frame / copper coils */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 4, 5]} intensity={2.4} color="#cfe9ff" />
      <directionalLight position={[-4, -2, 2]} intensity={0.8} color="#1a6c8c" />

      <Reactor load={load} />

      <EffectComposer disableNormalPass frameBufferType={THREE.HalfFloatType}>
        <Bloom mipmapBlur luminanceThreshold={0.15} intensity={2.5} radius={0.8} levels={8} />
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={caOffset} radialModulation modulationOffset={0.4} />
        <Scanline blendFunction={BlendFunction.OVERLAY} density={1.2} opacity={0.1} />
        <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.025} />
        <Vignette eskil={false} offset={0.18} darkness={0.92} />
      </EffectComposer>
    </>
  );
}
