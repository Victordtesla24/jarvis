import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import {
  TextureLoader, Texture, Color, Mesh, LineSegments, AdditiveBlending, DoubleSide, FrontSide, BackSide, Group,
  BufferAttribute, BufferGeometry, Vector3, PlaneGeometry, ShaderMaterial, Points as ThreePoints,
} from 'three';
import { Text } from '@react-three/drei';
import { HandTrackingState, RegionName } from '../types';
import { sunDirection, regionForDegrees, fibonacciSphere, orbitalNode } from './holoGlobe';

interface HolographicEarthProps {
  handTrackingRef: React.MutableRefObject<HandTrackingState>;
  setRegion: (region: RegionName) => void;
}

// ── Holographic globe — monochromatic cyan ───────────────────────────────────
// A genuinely HOLOGRAPHIC earth (matched to youtu.be/yXpkIrR81w8 @0:46): glowing
// cyan continent outlines + a cyan particle atmosphere over a translucent dark
// body, framed by counter-rotating cyan arc-rings and a single tilted dotted
// orbital with a travelling node. No photo texture, no off-palette gold/magenta —
// one cyan palette consistent with the rest of the dashboard. The land texture is
// sampled ONLY as a land/ocean mask inside the shader, then re-coloured cyan.

const CYAN = '#00F0FF';
const EARTH_TEX = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg';

// Glowing cyan continents from a land/ocean mask, brighter on the sun-facing
// hemisphere (live system clock) with a faint latitude shimmer + a fresnel rim.
function makeContinentMaterial(map: Texture): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: FrontSide,
    toneMapped: false,
    uniforms: {
      map: { value: map },
      uColor: { value: new Color(CYAN) },
      uSunDir: { value: new Vector3(1, 0, 0) },
      uOpacity: { value: 1 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map;
      uniform vec3 uColor;
      uniform vec3 uSunDir;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        vec3 t = texture2D(map, vUv).rgb;
        // land sits warm/green over the blue oceans → r,g dominate b on continents
        float land = smoothstep(0.02, 0.17, (t.r + t.g) * 0.5 - t.b * 0.85 + 0.02);
        float fres = pow(1.0 - max(dot(normalize(vViewNormal), normalize(vViewDir)), 0.0), 2.2);
        float day = clamp(dot(normalize(vWorldNormal), normalize(uSunDir)) * 0.5 + 0.5, 0.16, 1.0);
        float scan = 0.86 + 0.14 * sin(vUv.y * 190.0 + uTime * 1.4);
        float intensity = land * (0.45 + 0.8 * day) * scan + fres * 0.7;
        float alpha = clamp(land * (0.5 + 0.5 * day) + fres * 0.42, 0.0, 1.0) * uOpacity;
        gl_FragColor = vec4(uColor * intensity, alpha);
      }`,
  });
}

// Latitude/longitude wireframe sphere as line segments (cyan grid lines).
function makeLatLonGeometry(latBands: number, lonBands: number, radius: number): BufferGeometry {
  const pts: number[] = [];
  const seg = 64;
  for (let i = 1; i < latBands; i++) {
    const phi = (i / latBands) * Math.PI;            // 0..π
    const y = Math.cos(phi) * radius, rr = Math.sin(phi) * radius;
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
      pts.push(Math.cos(a0) * rr, y, Math.sin(a0) * rr, Math.cos(a1) * rr, y, Math.sin(a1) * rr);
    }
  }
  for (let j = 0; j < lonBands; j++) {
    const theta = (j / lonBands) * Math.PI * 2;
    for (let s = 0; s < seg; s++) {
      const p0 = (s / seg) * Math.PI, p1 = ((s + 1) / seg) * Math.PI;
      const y0 = Math.cos(p0) * radius, r0 = Math.sin(p0) * radius;
      const y1 = Math.cos(p1) * radius, r1 = Math.sin(p1) * radius;
      pts.push(Math.cos(theta) * r0, y0, Math.sin(theta) * r0, Math.cos(theta) * r1, y1, Math.sin(theta) * r1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  return g;
}

// Dotted orbital path (a tilted ring of fine cyan points the node rides around).
function makeOrbitGeometry(count: number, radius: number): BufferGeometry {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * radius;
    pos[i * 3 + 1] = 0;
    pos[i * 3 + 2] = Math.sin(a) * radius;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  return g;
}

// ── Tactical Terrain (Iron Man HUD Style) — revealed as the operator zooms in ──
const TerrainModel: React.FC<{ expansionRef: React.MutableRefObject<number> }> = ({ expansionRef }) => {
  const groupRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const fillMeshRef = useRef<Mesh>(null);
  const markersRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);

  const [terrainData, setTerrainData] = useState<{ geometry: PlaneGeometry; maxHeights: Float32Array } | null>(null);

  useEffect(() => {
    const width = 12, depth = 12, segments = 64;
    const geom = new PlaneGeometry(width, depth, segments, segments);
    if (!geom.attributes.position) return;
    const count = geom.attributes.position.count;
    const posArray = geom.attributes.position.array;
    const colorArray = new Float32Array(count * 3);
    const getElevation = (x: number, y: number) => {
      let z = Math.sin(x * 0.4) * Math.cos(y * 0.4) * 1.5;
      z += Math.sin(x * 1.5 + y * 0.8) * 0.5;
      z += Math.cos(x * 2.0) * 0.2;
      return Math.max(-0.5, z);
    };
    const maxHeights = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = posArray[i * 3];
      const y = posArray[i * 3 + 1];
      const h = getElevation(x, y);
      maxHeights[i] = h > 0 ? h : h * 0.2;
      const intensity = 0.2 + (h + 1) / 3;
      colorArray[i * 3] = 0;
      colorArray[i * 3 + 1] = intensity * 0.85;
      colorArray[i * 3 + 2] = intensity * 1.0;
    }
    geom.setAttribute('color', new BufferAttribute(colorArray, 3));
    setTerrainData({ geometry: geom, maxHeights });
    return () => { geom.dispose(); };
  }, []);

  const markers = useMemo(() => {
    const items = [];
    const placeNames = ['SECTOR 7', 'ALPHA BASE', 'NORTH RIDGE', 'OMEGA POINT', 'ECHO STATION', 'DELTA FORCE', 'GRID 9', 'ZERO NULL', 'CYBER DOCK', 'NEON CITY', 'LUNA OUTPOST', 'SOLAR ARRAY'];
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() - 0.5) * 10.0;
      const z = (Math.random() - 0.5) * 10.0;
      items.push({ position: new Vector3(x, 0, z), label: `TGT-${i}`, name: placeNames[Math.floor(Math.random() * placeNames.length)] });
    }
    return items;
  }, []);

  useFrame((state) => {
    if (!groupRef.current || !meshRef.current || !fillMeshRef.current || !terrainData) return;
    const exp = expansionRef.current;
    const { maxHeights } = terrainData;
    let progress = (exp - 0.5) / 0.5;
    progress = Math.max(0, Math.min(1, progress));
    if (progress > 0.99) progress = 1.0;
    groupRef.current.visible = progress > 0.01;
    if (!groupRef.current.visible) return;
    if (spinRef.current) spinRef.current.rotation.z = -state.clock.elapsedTime * 0.05;
    if (meshRef.current.geometry && meshRef.current.geometry.attributes.position) {
      const positionAttribute = meshRef.current.geometry.attributes.position;
      const positions = positionAttribute.array as Float32Array;
      for (let i = 0; i < positions.length / 3; i++) {
        const targetH = maxHeights[i] * 0.8 * progress;
        const x = positions[i * 3];
        const wave = Math.sin(x * 2 + state.clock.elapsedTime * 2) * 0.1 * progress;
        positions[i * 3 + 2] = targetH + wave;
      }
      positionAttribute.needsUpdate = true;
    }
    if (markersRef.current) {
      markersRef.current.children.forEach((child, idx) => {
        const m = markers[idx];
        if (!m) return;
        const currentHeight = 0.5 + progress * 1.5;
        child.position.set(m.position.x, m.position.z, currentHeight);
        const head = child.children[1] as Group;
        if (head) {
          head.lookAt(state.camera.position);
          const outerRing = head.children[0];
          if (outerRing) outerRing.rotation.z -= 0.02;
          const centerDot = head.children[2];
          if (centerDot) centerDot.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 8 + idx) * 0.2);
        }
      });
    }
    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + (state.clock.elapsedTime % 2) * 0.5);
      (ringRef.current.material as { opacity: number }).opacity = 0.5 * (1 - (state.clock.elapsedTime % 2) / 2);
    }
  });

  if (!terrainData) return null;

  return (
    <group ref={groupRef} visible={false}>
      <group rotation={[-Math.PI / 2.5, 0, 0]} position={[0, -1, 0]}>
        <group ref={spinRef}>
          <gridHelper args={[30, 30, 0x0a3a55, 0x041a28]} position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh ref={meshRef} geometry={terrainData.geometry}>
            <meshBasicMaterial vertexColors wireframe transparent opacity={0.6} blending={AdditiveBlending} />
          </mesh>
          <mesh ref={fillMeshRef} geometry={terrainData.geometry}>
            <meshBasicMaterial color="#000000" transparent opacity={0.8} side={DoubleSide} />
          </mesh>
          <group ref={markersRef}>
            {markers.map((m, i) => (
              <group key={i} position={[m.position.x, m.position.z, 0]}>
                <mesh position={[0, 0, -1.5]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.005, 0.02, 3, 4]} />
                  <meshBasicMaterial color={CYAN} transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} />
                </mesh>
                <group>
                  <mesh rotation={[0, 0, Math.random() * Math.PI]}>
                    <ringGeometry args={[0.15, 0.16, 32, 1, 0, Math.PI * 1.5]} />
                    <meshBasicMaterial color={CYAN} transparent opacity={0.6} blending={AdditiveBlending} side={DoubleSide} depthWrite={false} />
                  </mesh>
                  <mesh rotation={[0, 0, Math.PI / 4]}>
                    <ringGeometry args={[0.08, 0.09, 4]} />
                    <meshBasicMaterial color={CYAN} transparent opacity={0.8} blending={AdditiveBlending} side={DoubleSide} depthWrite={false} />
                  </mesh>
                  <mesh>
                    <circleGeometry args={[0.03, 16]} />
                    <meshBasicMaterial color={CYAN} transparent opacity={0.95} blending={AdditiveBlending} depthWrite={false} />
                  </mesh>
                  <group position={[0.25, 0.05, 0]}>
                    <mesh position={[-0.1, -0.05, 0]} rotation={[0, 0, Math.PI / 4]}>
                      <planeGeometry args={[0.1, 0.01]} />
                      <meshBasicMaterial color={CYAN} opacity={0.5} transparent blending={AdditiveBlending} />
                    </mesh>
                    <mesh position={[0.3, 0, 0]}>
                      <planeGeometry args={[0.8, 0.16]} />
                      <meshBasicMaterial color="#000510" transparent opacity={0.8} />
                    </mesh>
                    <Text position={[0.3, 0, 0.01]} fontSize={0.08} color={CYAN} anchorX="center" anchorY="middle">{m.name}</Text>
                  </group>
                </group>
              </group>
            ))}
          </group>
          <mesh ref={ringRef} position={[0, 0, 0.2]}>
            <ringGeometry args={[1.5, 1.55, 64]} />
            <meshBasicMaterial color={CYAN} transparent opacity={0.5} blending={AdditiveBlending} side={DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

const ARC_RINGS = [
  { r: 1.32, tube: 0.006, arc: Math.PI * 1.35, tilt: 0.0, spin: 0.05 },
  { r: 1.5, tube: 0.005, arc: Math.PI * 0.85, tilt: 0.5, spin: -0.035 },
  { r: 1.68, tube: 0.004, arc: Math.PI * 1.15, tilt: -0.4, spin: 0.025 },
];

const HolographicEarth: React.FC<HolographicEarthProps> = ({ handTrackingRef, setRegion }) => {
  const earthGroupRef = useRef<Group>(null);   // whole assembly (faded on zoom)
  const spinRef = useRef<Group>(null);          // globe body + continents + grid (spins)
  const gridRef = useRef<LineSegments>(null);
  const atmosRef = useRef<ThreePoints>(null);
  const ringsRef = useRef<Group>(null);
  const orbitRef = useRef<Group>(null);
  const nodeRef = useRef<Mesh>(null);

  const smoothExpansionRef = useRef(0);
  const wasTerrainModeRef = useRef(false);

  const continentMatRef = useRef<ShaderMaterial | null>(null);
  const sunDirRef = useRef<Vector3>(sunDirection(new Date()));
  const sunFrame = useRef(0);

  // Continents are sampled from the earth land texture but recoloured pure cyan in-shader.
  const colorMap = useLoader(TextureLoader, EARTH_TEX);
  const continentMat = useMemo(() => makeContinentMaterial(colorMap), [colorMap]);
  useEffect(() => { continentMatRef.current = continentMat; return () => continentMat.dispose(); }, [continentMat]);

  const gridGeo = useMemo(() => makeLatLonGeometry(12, 18, 1.01), []);
  const atmosGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(fibonacciSphere(2200, 1.06, 0.05), 3));
    return g;
  }, []);
  const orbitGeo = useMemo(() => makeOrbitGeometry(160, 1.46), []);
  useEffect(() => () => { gridGeo.dispose(); atmosGeo.dispose(); orbitGeo.dispose(); }, [gridGeo, atmosGeo, orbitGeo]);

  useFrame((state, delta) => {
    if (!spinRef.current || !earthGroupRef.current) return;

    // Live day/night: advance the subsolar point from the system clock (throttled).
    sunFrame.current = (sunFrame.current + 1) % 90;
    if (sunFrame.current === 0) sunDirRef.current = sunDirection(new Date());
    if (continentMatRef.current) {
      continentMatRef.current.uniforms.uSunDir.value.copy(sunDirRef.current);
      continentMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }

    const leftHand = handTrackingRef.current.leftHand;
    const rightHand = handTrackingRef.current.rightHand;

    // Right hand spins the globe; default is a slow ambient drift.
    let speedX = 0.0009;
    if (rightHand) {
      const { x, y } = rightHand.rotationControl;
      if (Math.abs(x) > 0.1) speedX = x * 0.05;
      if (Math.abs(y) > 0.1) earthGroupRef.current.rotation.x += y * 0.04;
    }
    spinRef.current.rotation.y += speedX;
    if (gridRef.current) gridRef.current.rotation.y -= speedX * 0.4;     // counter-rotating grid

    // Left hand expands → tactical-terrain transition (unchanged choreography).
    let targetExpansion = 0;
    if (leftHand) {
      targetExpansion = leftHand.expansionFactor;
    }
    smoothExpansionRef.current += (targetExpansion - smoothExpansionRef.current) * 0.08;
    const exp = smoothExpansionRef.current;

    let earthOpacity = 1;
    if (exp > 0.4) earthOpacity = Math.max(0, Math.min(1, 1 - (exp - 0.4) / 0.2));
    earthGroupRef.current.visible = earthOpacity > 0.01;
    if (continentMatRef.current) continentMatRef.current.uniforms.uOpacity.value = earthOpacity;

    if (exp > 0.55) {
      wasTerrainModeRef.current = true;
    } else {
      wasTerrainModeRef.current = false;
    }

    if (earthGroupRef.current.visible) {
      const t = state.clock.elapsedTime;
      // counter-rotating arc-rings frame the globe
      if (ringsRef.current) {
        ringsRef.current.children.forEach((child, i) => {
          const cfg = ARC_RINGS[i];
          if (cfg) child.rotation.z += cfg.spin * delta * 4;
        });
        ringsRef.current.rotation.x = 0.32 + Math.sin(t * 0.15) * 0.05;
      }
      // satellite node rides the tilted dotted orbital
      if (orbitRef.current) orbitRef.current.rotation.y += delta * 0.05;
      if (nodeRef.current) {
        const [nx, ny, nz] = orbitalNode(t * 0.55, 1.46, 1.46, 0.62);
        nodeRef.current.position.set(nx, ny, nz);
      }
      if (atmosRef.current) atmosRef.current.rotation.y += delta * 0.02;

      const deg = (spinRef.current.rotation.y * 180) / Math.PI;
      setRegion(regionForDegrees(deg));
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <group ref={earthGroupRef} scale={1.4}>
        {/* spinning globe: translucent body + cyan continents + lat/lon grid */}
        <group ref={spinRef}>
          {/* dark translucent body — occludes the far hemisphere so continents read as a solid hologram */}
          <mesh renderOrder={0}>
            <sphereGeometry args={[0.99, 64, 64]} />
            <meshBasicMaterial color="#04161e" transparent opacity={0.5} side={FrontSide} />
          </mesh>
          {/* inner back-shell for subtle depth */}
          <mesh>
            <sphereGeometry args={[0.985, 48, 48]} />
            <meshBasicMaterial color="#0a3550" transparent opacity={0.12} side={BackSide} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* glowing cyan continents */}
          <mesh renderOrder={1} material={continentMat}>
            <sphereGeometry args={[1.0, 96, 96]} />
          </mesh>
          {/* lat/long wireframe */}
          <lineSegments ref={gridRef} geometry={gridGeo} renderOrder={1}>
            <lineBasicMaterial color={CYAN} transparent opacity={0.12} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </lineSegments>
        </group>

        {/* cyan particle atmosphere */}
        <points ref={atmosRef} geometry={atmosGeo}>
          <pointsMaterial color={CYAN} size={0.012} sizeAttenuation transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </points>

        {/* counter-rotating cyan arc-rings */}
        <group ref={ringsRef}>
          {ARC_RINGS.map((cfg, i) => (
            <mesh key={i} rotation={[cfg.tilt, 0, 0]}>
              <torusGeometry args={[cfg.r, cfg.tube, 8, 180, cfg.arc]} />
              <meshBasicMaterial color={CYAN} transparent opacity={0.45} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
          ))}
          {/* equator hoop */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.18, 0.004, 8, 220]} />
            <meshBasicMaterial color={CYAN} transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>

        {/* tilted dotted orbital + travelling node */}
        <group ref={orbitRef} rotation={[0.62, 0, 0]}>
          <points geometry={orbitGeo}>
            <pointsMaterial color={CYAN} size={0.02} sizeAttenuation transparent opacity={0.7} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
          </points>
        </group>
        <mesh ref={nodeRef}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshBasicMaterial color="#BDF6FF" toneMapped={false} />
        </mesh>

        {/* cyan technical callout */}
        <Text position={[-1.75, 0.55, 0]} fontSize={0.12} color={CYAN} anchorX="left" anchorY="middle" outlineWidth={0} fillOpacity={0.85}>
          ORBITAL SCAN
        </Text>
      </group>

      <TerrainModel expansionRef={smoothExpansionRef} />

      <ambientLight intensity={0.4} color={CYAN} />
    </group>
  );
};

export default HolographicEarth;
