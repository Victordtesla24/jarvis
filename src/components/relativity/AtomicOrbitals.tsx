import * as THREE from 'three';
import React, { useEffect, useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

// ── Atomic Orbitals (Frank Braker recreation) ───────────────────────────────
// A 3D sea-urchin of fine, curved radial spines whose directions are spread by
// the golden angle (sunflower) so they form spiral-arm "petals", with a bright
// nucleus and additive glow. Built standalone to match the reference, then
// overlaid behind the reactor core.

// Concentric rings of points, each rotated by `precess` → spiral-arm petals
// (a spirograph rosette); a shallow z-dome adds 3D depth. Shared by the
// standalone lab and the reactor's split animation.
export function rosetteGeometry({ rings = 95, arms = 36, precess = 0.135, radius = 1.55, dome = 0.4 } = {}): THREE.BufferGeometry {
  const TAU = Math.PI * 2;
  const N = rings * arms;
  const pos = new Float32Array(N * 3);
  const life = new Float32Array(N); // color-over-life age (0 inner/young → 1 outer/old)
  const seed = new Float32Array(N); // stable per-vertex hash for shimmer/turbulence phase
  let idx = 0;
  for (let k = 0; k < rings; k++) {
    const fk = k / (rings - 1);
    const rr = 0.05 + fk * radius;
    const z = -dome * rr * rr * 0.5;
    for (let j = 0; j < arms; j++) {
      const ang = j * (TAU / arms) + k * precess;
      pos[idx * 3] = Math.cos(ang) * rr;
      pos[idx * 3 + 1] = Math.sin(ang) * rr;
      pos[idx * 3 + 2] = z;
      life[idx] = fk;
      seed[idx] = ((Math.sin(k * 12.9898 + j * 78.233) * 43758.5453) % 1 + 1) % 1;
      idx++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  return g;
}

// ── Trapcode-FORM-style rosette material ────────────────────────────────────
// Patches PointsMaterial via onBeforeCompile to add (HUD.aep "Custom Turbulence")
// organic curl drift, (FORM "Color over Life") per-arm brightness/size fade and an
// ice→holo-cyan colour ramp, and (FORM additive + Glow) per-vertex shimmer.
// Cyan-only; alert is a uniform swap, not a code path. Shared by lab + reactor.
export interface RosetteUniforms {
  uTime: { value: number }; uSplit: { value: number };
  uColorA: { value: THREE.Color }; uColorB: { value: THREE.Color };
  uBright: { value: number }; uSizeBase: { value: number }; uTurb: { value: number };
}

export type RosetteMaterial = THREE.PointsMaterial & { userData: { u: RosetteUniforms } };

let __rosetteId = 0; // per-instance program cache key (avoids shared-program clobber)

export function makeRosetteMaterial(opts?: { sizeBase?: number }): RosetteMaterial {
  const sizeBase = opts?.sizeBase ?? 0.006;
  const m = new THREE.PointsMaterial({
    size: sizeBase, transparent: true, sizeAttenuation: true,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const u: RosetteUniforms = {
    uTime: { value: 0 }, uSplit: { value: 0 },
    uColorA: { value: new THREE.Color('#EAFBFF') }, uColorB: { value: new THREE.Color('#33D6F2') },
    uBright: { value: 1.1 }, uSizeBase: { value: sizeBase }, uTurb: { value: 1 },
  };
  (m.userData as { u: RosetteUniforms }).u = u;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader =
      'attribute float aLife;\nattribute float aSeed;\nuniform float uTime;\nuniform float uSplit;\nuniform float uSizeBase;\nuniform float uTurb;\nvarying float vLife;\nvarying float vSeed;\n' +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vLife = aLife; vSeed = aSeed;
        float ph = aSeed * 6.2831853;
        float amp = uTurb * (0.012 + aLife * 0.05) * (0.25 + uSplit);
        float fx = uTime * 0.6 + transformed.y * 3.1 + ph;
        float fy = uTime * 0.55 + transformed.x * 3.1 + ph;
        transformed.x += sin(fx) * amp - transformed.y * 0.06 * amp;
        transformed.y += cos(fy) * amp + transformed.x * 0.06 * amp;
        transformed.z += sin(uTime * 0.4 + ph) * amp * 0.5;`);
    shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = uSizeBase * (1.6 - aLife);');
    shader.fragmentShader =
      'uniform vec3 uColorA;\nuniform vec3 uColorB;\nuniform float uBright;\nuniform float uTime;\nvarying float vLife;\nvarying float vSeed;\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float shim = 0.65 + 0.35 * sin(uTime * 2.2 + vSeed * 6.2831853);
        // dusty tip falloff (quadratic) so spine ends dissolve into fine star-dust
        float lifeFade = 1.0 - vLife * vLife * 0.55;
        vec3 col = mix(uColorA, uColorB, vLife);
        diffuseColor.rgb *= col * uBright * lifeFade * shim;
        // soft ROUND mote instead of a hard square point — the core of the star-dust look
        float dd = length(gl_PointCoord - 0.5);
        diffuseColor.a *= smoothstep(0.5, 0.06, dd) * lifeFade;`);
  };
  const id = ++__rosetteId;
  m.customProgramCacheKey = () => 'rosette-turb-' + id;
  return m as RosetteMaterial;
}

// ── fine round, twinkling MOTE field (shared star-dust / core-spark material) ─
// A depth-scattered cloud of soft ROUND motes that each scintillate on their own
// phase — the cyan "energy dust" that frames the reactor and overlays its face
// (matched to the generative-particle reference, youtu.be/XcIPaKHC2Wg). The plain
// PointsMaterial it replaces drew HARD SQUARE points; these are round, breathing
// and monochromatic-cyan. Pure data + an onBeforeCompile PointsMaterial (no per-
// frame allocation), additive HDR so dense overlaps sum into a glowing mist.

// Even-ish shell of points (golden-angle fibonacci) with a jittered radius band
// and a stable per-point hash for the twinkle/size variation. Deterministic.
export function starfieldGeometry({ count = 1600, inner = 1.5, outer = 3.2 } = {}): THREE.BufferGeometry {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const span = outer - inner;
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;          // -1..1
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * 2.399963;                                // golden angle
    const shell = inner + (((i * 131) % 100) / 100) * span;  // jittered depth band
    pos[i * 3] = Math.cos(phi) * rad * shell;
    pos[i * 3 + 1] = y * shell;
    pos[i * 3 + 2] = Math.sin(phi) * rad * shell;
    seed[i] = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  return g;
}

// Flat-ish disc of fine sparks hugging the reactor face (thin Z), for the
// front-on core overlay. Same aSeed convention as starfieldGeometry.
export function coreSparkGeometry({ count = 900, inner = 0.16, outer = 0.88, thickness = 0.12 } = {}): THREE.BufferGeometry {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const span = outer - inner;
  for (let i = 0; i < count; i++) {
    const a = i * 2.399963;
    const rr = inner + Math.pow(((i * 97) % 100) / 100, 0.7) * span;   // denser toward the core
    pos[i * 3] = Math.cos(a) * rr;
    pos[i * 3 + 1] = Math.sin(a) * rr;
    pos[i * 3 + 2] = ((((i * 53) % 100) / 100) - 0.5) * thickness;
    seed[i] = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  return g;
}

export interface MoteUniforms {
  uTime: { value: number }; uColor: { value: THREE.Color };
  uSizeBase: { value: number }; uTwinkle: { value: number }; uDrift: { value: number };
}
export type MoteMaterial = THREE.PointsMaterial & { userData: { u: MoteUniforms } };
let __moteId = 0; // per-instance program cache key (avoids shared-program clobber)

export function makeMoteMaterial(opts?: { sizeBase?: number; color?: string; bright?: number }): MoteMaterial {
  const sizeBase = opts?.sizeBase ?? 0.02;
  const m = new THREE.PointsMaterial({
    size: sizeBase, transparent: true, sizeAttenuation: true,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const u: MoteUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(opts?.color ?? '#BFEFFF').multiplyScalar(opts?.bright ?? 1.3) },
    uSizeBase: { value: sizeBase }, uTwinkle: { value: 1 }, uDrift: { value: 0 },
  };
  (m.userData as { u: MoteUniforms }).u = u;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader =
      'attribute float aSeed;\nuniform float uTime;\nuniform float uSizeBase;\nuniform float uDrift;\nvarying float vSeed;\n' +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vSeed = aSeed;
        float ph = aSeed * 6.2831853;
        // gentle per-mote parallax drift so the cloud breathes (no hard motion)
        transformed.x += sin(uTime * 0.18 + ph) * uDrift;
        transformed.y += cos(uTime * 0.15 + ph * 1.3) * uDrift;
        transformed.z += sin(uTime * 0.12 + ph * 0.7) * uDrift * 0.6;`);
    // per-mote size variation: a few motes read as brighter "embers"
    shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;',
      'gl_PointSize = uSizeBase * (0.5 + aSeed * 1.8);');
    shader.fragmentShader =
      'uniform vec3 uColor;\nuniform float uTime;\nuniform float uTwinkle;\nvarying float vSeed;\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        // independent scintillation: each mote twinkles on its own rate + phase,
        // pumping the brightest embers in and out of the bloom threshold.
        float tw = 0.4 + 0.6 * sin(uTime * (1.4 + vSeed * 3.2) + vSeed * 6.2831853);
        tw = mix(1.0, tw, uTwinkle);
        diffuseColor.rgb *= uColor * (0.7 + vSeed * 0.9) * tw;
        // soft ROUND mote — kill the hard square point
        float dd = length(gl_PointCoord - 0.5);
        diffuseColor.a *= smoothstep(0.5, 0.05, dd);`);
  };
  const id = ++__moteId;
  m.customProgramCacheKey = () => 'mote-twinkle-' + id;
  return m as MoteMaterial;
}

export function OrbitalSpines({ rings = 130, arms = 42, precess = 0.135, radius = 1.55, dome = 0.4, size = 0.006 }: {
  rings?: number; arms?: number; precess?: number; radius?: number; dome?: number; size?: number;
}) {
  const grp = useRef<THREE.Group>(null);
  const geom = useMemo(() => rosetteGeometry({ rings, arms, precess, radius, dome }), [rings, arms, precess, radius, dome]);
  const mat = useMemo(() => makeRosetteMaterial({ sizeBase: size }), [size]);
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame((state, dt) => {
    if (grp.current) { grp.current.rotation.z += dt * 0.10; grp.current.rotation.x = 0.22; }
    const u = mat.userData.u;
    u.uTime.value = state.clock.elapsedTime;
    u.uSplit.value = 1; // lab shows full turbulence (no split gesture)
    u.uBright.value = 1.1; u.uTurb.value = 1;
    mat.opacity = 0.9;
  });

  return (
    <group ref={grp}>
      <points geometry={geom} material={mat} />
    </group>
  );
}

function Nucleus() {
  const glow = useRef<THREE.Mesh>(null);
  useFrame((s) => { if (glow.current) glow.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 3) * 0.18); });
  return (
    <group>
      <mesh><sphereGeometry args={[0.05, 24, 24]} /><meshBasicMaterial color="#FFFFFF" toneMapped={false} /></mesh>
      <mesh ref={glow}><sphereGeometry args={[0.12, 20, 20]} />
        <meshBasicMaterial color="#9FECFF" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
    </group>
  );
}

const AtomicOrbitals: React.FC = () => (
  <Canvas camera={{ position: [0, 0, 3.6], fov: 46 }} gl={{ alpha: true, antialias: true }} dpr={[1, 2]}
    style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}>
    <Suspense fallback={null}>
      <OrbitalSpines />
      <Nucleus />
      <EffectComposer enableNormalPass={false}>
        <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.15} luminanceSmoothing={0.4} radius={0.7} />
      </EffectComposer>
    </Suspense>
  </Canvas>
);

export default AtomicOrbitals;
