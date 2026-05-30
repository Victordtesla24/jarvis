import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, extend, type ReactThreeFiber } from '@react-three/fiber';
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
import { HandTrackingState } from '../types';

// ============================================================================
// JARVIS ARC REACTOR — a layered MECHANICAL IRIS rebuilt from the reference
// (design_refs/ref_reactor_closeup.jpg): an outer ring of discrete segment
// blocks with gaps, a ring of larger louver blocks, a dense ring of fine
// turbine teeth, and a faceted geared hub at the centre — all composited in
// true depth with additive/emissive materials under UnrealBloom. A
// GREEN→CYAN→BLUE wash is baked per-instance (left→right), matching the ref.
//
// Live: CPU load drives spin + core brightness. Hands (when present) drive
// yaw/tilt (RIGHT) and zoom/scale + emissive (LEFT); pinch fires a lock pulse.
// No hands / no camera → graceful ambient rotation (never freezes, never
// crashes). Silent, holographic.
// ============================================================================

// Gradient endpoints sampled from the reference: emerald-green on the left edge
// flowing through cyan to a deep electric blue on the right.
const GRAD_LEFT = new THREE.Color('#00ff9c');
const GRAD_MID = new THREE.Color('#00f2ff');
const GRAD_RIGHT = new THREE.Color('#1763ff');
const CYAN = '#00f2ff';

// Sample the green→cyan→blue wash by horizontal position x∈[-R,R] → [0,1].
function gradientAt(x: number, halfSpan: number, out: THREE.Color) {
  const t = THREE.MathUtils.clamp((x / halfSpan) * 0.5 + 0.5, 0, 1);
  if (t < 0.5) out.copy(GRAD_LEFT).lerp(GRAD_MID, t / 0.5);
  else out.copy(GRAD_MID).lerp(GRAD_RIGHT, (t - 0.5) / 0.5);
  return out;
}

// ---- background holographic energy field (faint polar grid behind) ----
type GridMaterialImpl = THREE.ShaderMaterial & { uTime: number };

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
      // green(left)→blue(right) tint across the field
      vec3 tint = mix(vec3(0.0,0.7,0.45), vec3(0.05,0.35,0.95), vUv.x);
      gl_FragColor = vec4(tint*grid + vec3(0.01,0.04,0.06), a);
    }
  `,
);
extend({ GridMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    gridMaterial: ReactThreeFiber.MaterialNode<GridMaterialImpl, typeof GridMaterial>;
  }
}

function EnergyField() {
  const m = useRef<GridMaterialImpl>(null);
  useFrame((_, dt) => { if (m.current) m.current.uTime += dt; });
  return (
    <mesh position={[0, 0, -0.3]}>
      <circleGeometry args={[2.2, 96]} />
      <gridMaterial ref={m} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

// ---- screen-space green→cyan→blue wash (does NOT rotate with the iris) ------
// The reference HUD is bathed in a left-green → right-blue gradient. A static
// additive plane in front of the reactor applies that directional wash so the
// rotating segments don't average it out to flat cyan.
type WashMaterialImpl = THREE.ShaderMaterial;

const WashMaterial = shaderMaterial(
  {},
  /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  /* glsl */ `
    varying vec2 vUv;
    void main(){
      vec2 p=(vUv-0.5)*2.0; float r=length(p);
      // green(left) → cyan(mid) → blue(right)
      vec3 g=vec3(0.0,1.0,0.55), c=vec3(0.0,0.95,1.0), b=vec3(0.09,0.39,1.0);
      vec3 col = vUv.x<0.5 ? mix(g,c,vUv.x/0.5) : mix(c,b,(vUv.x-0.5)/0.5);
      // strongest over the reactor disc, fading to the edges; additive + low a
      float m = smoothstep(1.15,0.15,r) * 0.42;
      gl_FragColor = vec4(col*m, m);
    }
  `,
);
extend({ WashMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    washMaterial: ReactThreeFiber.MaterialNode<WashMaterialImpl, typeof WashMaterial>;
  }
}

function GradientWash() {
  return (
    <mesh position={[0, 0, 0.12]}>
      <planeGeometry args={[3.6, 2.6]} />
      <washMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

// ---- generic instanced ring of radial blocks (the iris's discrete segments) --
// Each instance is a box positioned at radius `radius`, oriented tangentially,
// with per-instance gradient color baked from its world x. Counter-rotating
// rings read as a mechanical iris. Returns a group whose rotation we animate.
interface SegmentRingProps {
  count: number;
  radius: number;
  blockW: number;     // tangential width
  blockH: number;     // radial length
  thickness: number;  // z depth
  gapFrac?: number;   // fraction of the slot left empty (visual gap)
  opacity?: number;
  z?: number;
}

const SegmentRing = React.forwardRef<THREE.Group, SegmentRingProps>(function SegmentRing(
  { count, radius, blockW, blockH, thickness, gapFrac = 0.35, opacity = 0.9, z = 0 },
  ref,
) {
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  const seed = useMemo(
    () => (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        dummy.position.set(x, y, 0);
        dummy.rotation.set(0, 0, a + Math.PI / 2);
        // shrink tangentially to leave a gap between blocks
        dummy.scale.set(1 - gapFrac, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, gradientAt(x, radius + blockH, tmpColor));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    [count, radius, blockH, gapFrac, dummy, tmpColor],
  );

  return (
    <group ref={ref} position={[0, 0, z]}>
      <instancedMesh ref={seed} args={[undefined, undefined, count]}>
        <boxGeometry args={[blockW, blockH, thickness]} />
        <meshBasicMaterial transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
    </group>
  );
});

// ---- dense turbine-teeth ring (fine radial louvers) ----
function TurbineTeeth({ count = 90, radius = 0.62, len = 0.26, z = 0.02 }: { count?: number; radius?: number; len?: number; z?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const seed = useMemo(
    () => (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        dummy.position.set(x, y, 0);
        dummy.rotation.set(0, 0, a + Math.PI / 2);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, gradientAt(x, radius + len, tmpColor));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    [count, radius, len, dummy, tmpColor],
  );
  useFrame((_, dt) => { if (groupRef.current) groupRef.current.rotation.z += dt * 0.18; });
  return (
    <group ref={groupRef} position={[0, 0, z]}>
      <instancedMesh ref={seed} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.012, len, 0.01]} />
        <meshBasicMaterial transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ---- faceted geared hub at the centre (concentric polygon rings) ----
function GearedHub({ pulseRef }: { pulseRef: React.MutableRefObject<number> }) {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const hex = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((_, dt) => {
    if (ring1.current) ring1.current.rotation.z -= dt * 0.25;
    if (ring2.current) ring2.current.rotation.z += dt * 0.4;
    if (hex.current) hex.current.rotation.z += dt * 0.12;
    // pinch lock pulse decays toward 0; brightens the hex core when fired
    if (coreMat.current) {
      const p = pulseRef.current;
      coreMat.current.opacity = 0.75 + 0.25 * p;
    }
  });
  return (
    <group position={[0, 0, 0.06]}>
      {/* outer geared ring — torus with low segment count reads as facets */}
      <mesh ref={ring1}>
        <torusGeometry args={[0.34, 0.02, 6, 24]} />
        <meshBasicMaterial color={GRAD_MID} transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={ring2}>
        <torusGeometry args={[0.24, 0.016, 6, 18]} />
        <meshBasicMaterial color={GRAD_LEFT} transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* faceted hex core */}
      <mesh ref={hex}>
        <circleGeometry args={[0.16, 6]} />
        <meshBasicMaterial ref={coreMat} color="#dffaff" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.16, 0.18, 6]} />
        <meshBasicMaterial color={GRAD_RIGHT} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---- reactive core glow (the blindingly bright heart) ----
function CoreGlow({ load, emissiveRef }: { load: number; emissiveRef: React.MutableRefObject<number> }) {
  const inner = useRef<THREE.Mesh>(null!);
  const outer = useRef<THREE.Mesh>(null!);
  const innerMat = useRef<THREE.MeshBasicMaterial>(null!);
  const light = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    const t = performance.now() / 1000;
    const osc = 0.5 + 0.5 * Math.sin(t * 3.0);
    const em = emissiveRef.current; // 0..1 from LEFT-hand expansion
    const scl = THREE.MathUtils.lerp(0.92, 1.1, osc) * (1 + load * 0.25 + em * 0.4);
    if (inner.current) inner.current.scale.setScalar(0.1 * scl);
    if (outer.current) outer.current.scale.setScalar(0.26 * scl);
    if (innerMat.current) innerMat.current.opacity = 0.4 + 0.15 * osc + em * 0.3;
    if (light.current) light.current.intensity = THREE.MathUtils.lerp(4, 12, osc) * (0.6 + load + em);
  });
  return (
    <group position={[0, 0, 0.08]}>
      <pointLight ref={light} color={CYAN} distance={5} decay={2} intensity={8} />
      <mesh ref={inner}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial ref={innerMat} color="#eafdff" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={outer}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
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
        (mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.max(0, s.life / s.dur) * Math.PI) * 0.85;
        if (s.life <= 0) mesh.visible = false;
      } else {
        s.next -= dt;
        if (s.next <= 0) {
          const a = Math.random() * Math.PI * 2;
          const r1 = 0.5, r2 = 1.25, mid = (r1 + r2) / 2;
          mesh.position.set(Math.cos(a) * mid, Math.sin(a) * mid, 0.1);
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

// ---- orbiting particle swarm (flat, in the reactor plane) ----
function ParticleSwarm({ spinRef }: { spinRef: React.MutableRefObject<number> }) {
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
  useFrame((_, dt) => { if (pts.current) pts.current.rotation.z += dt * spinRef.current; });
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={500} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.026} color={CYAN} transparent opacity={0.8} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

// ============================================================================
// Reactor — owns the single useFrame that reads the live hand-tracking ref and
// drives the whole assembly (yaw/tilt/zoom/emissive/pulse). Sub-components keep
// their own decorative useFrames for spin; this one applies gesture intent.
// ============================================================================
function Reactor({ load, handTrackingRef }: { load: number; handTrackingRef: React.MutableRefObject<HandTrackingState> }) {
  const assembly = useRef<THREE.Group>(null);  // whole iris — yaw + tilt + zoom
  const outerRing = useRef<THREE.Group>(null);
  const louverRing = useRef<THREE.Group>(null);

  // Smoothed gesture state so motion is fluid even at 30fps hand updates.
  const yaw = useRef(0);
  const pitch = useRef(0);
  const zoom = useRef(1);       // scale multiplier
  const emissive = useRef(0);   // 0..1 — LEFT-hand expansion → core brightness
  const pulse = useRef(0);      // pinch lock pulse, decays to 0
  const spin = useRef(0.3);     // particle/ring base spin, load-reactive

  useFrame((_, dt) => {
    const rightHand = handTrackingRef.current?.rightHand ?? null;
    const leftHand = handTrackingRef.current?.leftHand ?? null;

    // RIGHT hand → yaw (x) + tilt (y). Deadzone avoids jitter; ambient drift
    // continues when no hand is present so the reactor never freezes.
    let yawTarget = 0.12 + load * 0.5; // ambient yaw speed (rad/s)
    let pitchTarget = 0;
    if (rightHand) {
      const { x, y } = rightHand.rotationControl;
      if (Math.abs(x) > 0.1) yawTarget = x * 1.6;       // gesture-driven yaw speed
      pitchTarget = THREE.MathUtils.clamp(-y, -1, 1) * 0.5; // tilt target (rad)
    }
    yaw.current += yawTarget * dt;
    pitch.current = THREE.MathUtils.lerp(pitch.current, pitchTarget, 0.08);

    // LEFT hand → zoom (expansionFactor 0..1) + core emissive. Lerp ~0.08.
    let zoomTarget = 1;
    let emTarget = 0;
    if (leftHand) {
      emTarget = THREE.MathUtils.clamp(leftHand.expansionFactor, 0, 1);
      zoomTarget = 0.85 + emTarget * 0.5; // 0.85x..1.35x
    }
    zoom.current = THREE.MathUtils.lerp(zoom.current, zoomTarget, 0.08);
    emissive.current = THREE.MathUtils.lerp(emissive.current, emTarget, 0.08);

    // Pinch (either hand) → lock pulse accent that decays back to 0.
    const pinching = (rightHand?.isPinching ?? false) || (leftHand?.isPinching ?? false);
    if (pinching) pulse.current = 1;
    else pulse.current = THREE.MathUtils.lerp(pulse.current, 0, 0.06);

    spin.current = 0.2 + load * 0.8 + emissive.current * 0.6;

    // Apply to the assembly: yaw spins the whole iris; tilt leans it in 3D;
    // zoom scales it; pulse adds a brief scale kick.
    if (assembly.current) {
      assembly.current.rotation.z = yaw.current;
      assembly.current.rotation.x = pitch.current;
      const s = zoom.current * (1 + pulse.current * 0.06);
      assembly.current.scale.setScalar(s);
    }
    // Counter-rotate the discrete rings for the mechanical-iris read.
    if (outerRing.current) outerRing.current.rotation.z -= dt * 0.1;
    if (louverRing.current) louverRing.current.rotation.z += dt * 0.14;
  });

  return (
    <group>
      <EnergyField />
      <group ref={assembly}>
        {/* OUTER: ring of fine segment ticks (the dashes in the ref's rim) */}
        <SegmentRing ref={outerRing} count={64} radius={1.34} blockW={0.06} blockH={0.07} thickness={0.02} gapFrac={0.45} opacity={0.85} z={0.0} />
        {/* MID: ring of larger louver blocks with clear gaps */}
        <SegmentRing ref={louverRing} count={28} radius={1.04} blockW={0.12} blockH={0.2} thickness={0.03} gapFrac={0.3} opacity={0.92} z={0.01} />
        {/* INNER dense turbine teeth */}
        <TurbineTeeth count={96} radius={0.62} len={0.28} z={0.02} />
        {/* faceted geared hub */}
        <GearedHub pulseRef={pulse} />
        <CoreGlow load={load} emissiveRef={emissive} />
      </group>
      <EnergyArcs />
      <ParticleSwarm spinRef={spin} />
      {/* directional wash stays screen-fixed (outside the rotating assembly) */}
      <GradientWash />
    </group>
  );
}

export default function ReactorCore({
  load = 0.1,
  handTrackingRef,
}: {
  load?: number;
  handTrackingRef: React.MutableRefObject<HandTrackingState>;
}) {
  const caOffset = useMemo(() => new THREE.Vector2(0.001, 0.0006), []);
  // Defensive fallback ref so the component still renders if mounted without one.
  const fallbackRef = useRef<HandTrackingState>({ leftHand: null, rightHand: null });
  const ref = handTrackingRef ?? fallbackRef;
  return (
    <>
      <ambientLight intensity={0.5} />
      <Reactor load={load} handTrackingRef={ref} />
      <EffectComposer enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
        <Bloom mipmapBlur luminanceThreshold={0.3} intensity={1.05} radius={0.72} levels={7} />
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={caOffset} radialModulation modulationOffset={0.4} />
        <Scanline blendFunction={BlendFunction.OVERLAY} density={1.2} opacity={0.1} />
        <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.025} />
        <Vignette eskil={false} offset={0.2} darkness={0.85} />
      </EffectComposer>
    </>
  );
}
