import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Mesh, AdditiveBlending, DoubleSide, Group, BufferAttribute, Vector3, PlaneGeometry, MeshPhongMaterial, DirectionalLight } from 'three';
import { Points, PointMaterial, Text } from '@react-three/drei';
import * as random from 'maath/random/dist/maath-random.esm';
import { HandTrackingState, RegionName } from '../types';
import { SoundService } from '../services/soundService';
import { HolographicMaterial } from '../materials/HolographicMaterial';

interface HolographicEarthProps {
  handTrackingRef: React.MutableRefObject<HandTrackingState>;
  setRegion: (region: RegionName) => void;
}

const DEG = Math.PI / 180;

// Unit direction to the sun in the globe's (world) frame, from real wall-clock time, so
// the day/night terminator on the globe tracks the operator's actual system clock. The
// subsolar point: longitude follows UTC (solar noon at 0° at 12:00 UTC), latitude is the
// seasonal declination from the day-of-year.
function sunDirection(date: Date): Vector3 {
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

// Day/night shader injection for the Earth's phong material: keeps the lit hemisphere
// sun-shaded while the night hemisphere reveals city lights from the night-lights texture.
interface EarthShader {
  uniforms: { [name: string]: { value: unknown } };
  vertexShader: string;
  fragmentShader: string;
}

// --- Tactical Terrain Component (Iron Man HUD Style) ---
const TerrainModel: React.FC<{ 
    expansionRef: React.MutableRefObject<number>;
}> = ({ expansionRef }) => {
    const groupRef = useRef<Group>(null);
    const spinRef = useRef<Group>(null);
    const meshRef = useRef<Mesh>(null);
    const fillMeshRef = useRef<Mesh>(null);
    const markersRef = useRef<Group>(null);
    const ringRef = useRef<Mesh>(null);

    const [terrainData, setTerrainData] = useState<{
        geometry: PlaneGeometry;
        maxHeights: Float32Array;
    } | null>(null);

    // 1. Generate Height Map Data (Procedural Terrain)
    useEffect(() => {
        // CHANGED: Increased size from 6 to 12
        const width = 12;
        const depth = 12;
        const segments = 64; // Increased segments for smoother large map
        
        const geom = new PlaneGeometry(width, depth, segments, segments);
        
        // Safety check for attributes
        if (!geom.attributes.position) {
            console.error("PlaneGeometry attributes missing");
            return;
        }

        const count = geom.attributes.position.count;
        const posArray = geom.attributes.position.array;
        
        // Generate colors based on height for the wireframe
        const colorArray = new Float32Array(count * 3);

        // Simple FBM-like noise function for terrain shape
        const getElevation = (x: number, y: number) => {
            // Main ridge (Frequency adjusted for larger map)
            let z = Math.sin(x * 0.4) * Math.cos(y * 0.4) * 1.5; 
            // Detail noise
            z += Math.sin(x * 1.5 + y * 0.8) * 0.5;
            z += Math.cos(x * 2.0) * 0.2;
            // Valley flattening
            return Math.max(-0.5, z); 
        };

        // Pre-calculate max heights
        const maxHeights = new Float32Array(count);

        for (let i = 0; i < count; i++) {
             const x = posArray[i * 3];
             const y = posArray[i * 3 + 1]; // PlaneGeometry is XY, we rotate it later
             
             // Calculate target height
             const h = getElevation(x, y);
             maxHeights[i] = h > 0 ? h : h * 0.2; // Flatten valleys

             // Color logic: Cyan for peaks, darker blue for lowlands
             const intensity = 0.2 + (h + 1) / 3;
             colorArray[i*3] = 0;   // R
             colorArray[i*3+1] = intensity * 0.8; // G
             colorArray[i*3+2] = intensity * 1.0; // B
        }
        
        geom.setAttribute('color', new BufferAttribute(colorArray, 3));

        setTerrainData({ geometry: geom, maxHeights });
        
        return () => {
            geom.dispose();
        };
    }, []);

    // 2. Target Markers (Floating points above peaks)
    const markers = useMemo(() => {
        const items = [];
        const placeNames = ["SECTOR 7", "ALPHA BASE", "NORTH RIDGE", "OMEGA POINT", "ECHO STATION", "DELTA FORCE", "GRID 9", "ZERO NULL", "CYBER DOCK", "NEON CITY", "LUNA OUTPOST", "SOLAR ARRAY"];
        for(let i=0; i<12; i++) { // Increased marker count slightly
            // CHANGED: Increased spread range to match 12x12 grid (was 4.5)
            const x = (Math.random() - 0.5) * 10.0;
            const z = (Math.random() - 0.5) * 10.0;
            items.push({ 
                position: new Vector3(x, 0, z), 
                label: `TGT-${i}`,
                name: placeNames[Math.floor(Math.random() * placeNames.length)]
            });
        }
        return items;
    }, []);

    useFrame((state) => {
        if (!groupRef.current || !meshRef.current || !fillMeshRef.current || !terrainData) return;
        
        const exp = expansionRef.current;
        const { maxHeights } = terrainData;
        
        // --- TRANSITION LOGIC ---
        // CHANGED: Terrain starts appearing at 0.5 (50%), Fully formed at 1.0
        let progress = (exp - 0.5) / 0.5;
        progress = Math.max(0, Math.min(1, progress));
        
        // Snap to avoid jitter at max
        if (progress > 0.99) progress = 1.0;

        groupRef.current.visible = progress > 0.01;
        if (!groupRef.current.visible) return;

        if (spinRef.current) {
            spinRef.current.rotation.z = -state.clock.elapsedTime * 0.05;
        }

        // --- ANIMATE GEOMETRY ---
        if (meshRef.current.geometry && meshRef.current.geometry.attributes.position) {
            const positionAttribute = meshRef.current.geometry.attributes.position;
            const positions = positionAttribute.array as Float32Array;
            
            for (let i = 0; i < positions.length / 3; i++) {
                // CHANGED: Reduced height multiplier from 2.0 to 0.8 for flatter look
                const targetH = maxHeights[i] * 0.8 * progress; 
                
                const x = positions[i*3];
                const wave = Math.sin(x * 2 + state.clock.elapsedTime * 2) * 0.1 * progress;
                
                const finalH = targetH + wave;

                positions[i*3 + 2] = finalH;
            }
            positionAttribute.needsUpdate = true;
        }

        // --- ANIMATE MARKERS ---
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
                     if (outerRing) {
                         outerRing.rotation.z -= 0.02;
                     }
                     const centerDot = head.children[2];
                     if (centerDot) {
                         const scale = 1 + Math.sin(state.clock.elapsedTime * 8 + idx) * 0.2;
                         centerDot.scale.setScalar(scale);
                     }
                 }
             });
        }

        // Radar Ring Animation
        if (ringRef.current) {
            ringRef.current.scale.setScalar(1 + (state.clock.elapsedTime % 2) * 0.5);
            (ringRef.current.material as any).opacity = 0.5 * (1 - (state.clock.elapsedTime % 2) / 2);
        }
    });

    if (!terrainData) return null;

    return (
        <group ref={groupRef} visible={false}>
             {/* Slanted Tactical View */}
             <group rotation={[-Math.PI / 2.5, 0, 0]} position={[0, -1, 0]}> 
                
                <group ref={spinRef}>
                    {/* Base Grid (Static floor) */}
                    <gridHelper 
                        args={[30, 30, 0x001133, 0x000510]} 
                        position={[0, 0, 0.1]} 
                        rotation={[Math.PI/2, 0, 0]}
                    />

                    {/* Wireframe Terrain */}
                    <mesh ref={meshRef} geometry={terrainData.geometry}>
                        <meshBasicMaterial 
                            vertexColors
                            wireframe
                            transparent 
                            opacity={0.6} 
                            blending={AdditiveBlending}
                        />
                    </mesh>

                    {/* Fill Terrain */}
                    <mesh ref={fillMeshRef} geometry={terrainData.geometry}>
                        <meshBasicMaterial 
                            color="#000000" 
                            transparent 
                            opacity={0.8}
                            side={DoubleSide}
                        />
                    </mesh>

                    {/* Floating Targets */}
                    <group ref={markersRef}>
                        {markers.map((m, i) => (
                            <group key={i} position={[m.position.x, m.position.z, 0]}>
                                {/* Tether */}
                                <mesh position={[0, 0, -1.5]} rotation={[Math.PI/2, 0, 0]}>
                                    <cylinderGeometry args={[0.005, 0.02, 3, 4]} /> 
                                    <meshBasicMaterial 
                                        color="#00F0FF" 
                                        transparent 
                                        opacity={0.3} 
                                        blending={AdditiveBlending} 
                                        depthWrite={false} 
                                    />
                                </mesh>

                                {/* Head */}
                                <group>
                                    <mesh rotation={[0,0, Math.random() * Math.PI]}>
                                        <ringGeometry args={[0.15, 0.16, 32, 1, 0, Math.PI * 1.5]} />
                                        <meshBasicMaterial color="#00F0FF" transparent opacity={0.6} blending={AdditiveBlending} side={DoubleSide} depthWrite={false} />
                                    </mesh>
                                    
                                    <mesh rotation={[0,0,Math.PI/4]}>
                                        <ringGeometry args={[0.08, 0.09, 4]} />
                                        <meshBasicMaterial color="#00F0FF" transparent opacity={0.8} blending={AdditiveBlending} side={DoubleSide} depthWrite={false} />
                                    </mesh>

                                    <mesh>
                                        <circleGeometry args={[0.03, 16]} />
                                        <meshBasicMaterial color="#FF2A2A" transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
                                    </mesh>

                                    <group position={[0.25, 0.05, 0]}>
                                        <mesh position={[-0.1, -0.05, 0]} rotation={[0,0,Math.PI/4]}>
                                            <planeGeometry args={[0.1, 0.01]} />
                                            <meshBasicMaterial color="#00F0FF" opacity={0.5} transparent blending={AdditiveBlending} />
                                        </mesh>
                                        
                                        <mesh position={[0.3, 0, 0]}>
                                            <planeGeometry args={[0.8, 0.16]} />
                                            <meshBasicMaterial color="#000510" transparent opacity={0.8} />
                                        </mesh>
                                        
                                        <Text
                                            position={[0.3, 0, 0.01]}
                                            fontSize={0.08}
                                            color="#00F0FF"
                                            anchorX="center"
                                            anchorY="middle"
                                        >
                                            {m.name}
                                        </Text>
                                    </group>
                                </group>
                            </group>
                        ))}
                    </group>

                    {/* Radar Ring */}
                    <mesh ref={ringRef} position={[0,0,0.2]}>
                        <ringGeometry args={[1.5, 1.55, 64]} />
                        <meshBasicMaterial color="#00F0FF" transparent opacity={0.5} blending={AdditiveBlending} side={DoubleSide} />
                    </mesh>
                </group>
             </group>
        </group>
    );
};


const HolographicEarth: React.FC<HolographicEarthProps> = ({ handTrackingRef, setRegion }) => {
  const earthGroupRef = useRef<Group>(null);
  const earthRef = useRef<Mesh>(null);
  const holoShellRef = useRef<Mesh>(null);
  const cloudsRef = useRef<Mesh>(null);
  const wireframeRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);
  const particlesRef = useRef<any>(null);
  
  const smoothExpansionRef = useRef(0);
  const wasTerrainModeRef = useRef(false);

  // Day/night: sun light + shader uniform tracked from the live system clock.
  const earthMatRef = useRef<MeshPhongMaterial>(null);
  const sunLightRef = useRef<DirectionalLight>(null);
  const sunUniformRef = useRef<{ value: Vector3 } | null>(null);
  const sunDirRef = useRef<Vector3>(sunDirection(new Date()));
  const sunFrame = useRef(0);

  // Load Color, Normal, and Specular maps for realistic texture
  const [colorMap, normalMap, specularMap, nightMap] = useLoader(TextureLoader, [
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_lights_2048.png'
  ]);
  
  const satelliteData = useMemo(() => {
     try {
         return random.inSphere(new Float32Array(1500), { radius: 2.2 }) as Float32Array;
     } catch (e) {
         return new Float32Array(1500);
     }
  }, []);

  // Inject day/night into the Earth's phong material: city lights emerge on the night
  // hemisphere (sun-direction masked), the lit hemisphere stays sun-shaded.
  useEffect(() => {
    const mat = earthMatRef.current;
    if (!mat) return;
    mat.onBeforeCompile = (shader: EarthShader) => {
      shader.uniforms.uSunDir = { value: sunDirRef.current };
      shader.uniforms.uNightTex = { value: nightMap };
      shader.uniforms.uNightStrength = { value: 2.4 };
      sunUniformRef.current = shader.uniforms.uSunDir as { value: Vector3 };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldNrmDN;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vWorldNrmDN = normalize(mat3(modelMatrix) * objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSunDir;\nuniform sampler2D uNightTex;\nuniform float uNightStrength;\nvarying vec3 vWorldNrmDN;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  float dnDot = dot(normalize(vWorldNrmDN), normalize(uSunDir));\n  float nightAmt = smoothstep(0.12, -0.22, dnDot);\n  totalEmissiveRadiance += texture2D(uNightTex, vMapUv).rgb * nightAmt * uNightStrength;');
    };
    mat.needsUpdate = true;
  }, [nightMap]);

  useFrame((state, delta) => {
    if (!earthRef.current || !earthGroupRef.current) return;

    // Advance the day/night terminator from the live system clock (throttled recompute).
    sunFrame.current = (sunFrame.current + 1) % 90;
    if (sunFrame.current === 0) sunDirRef.current = sunDirection(new Date());
    if (sunUniformRef.current) sunUniformRef.current.value.copy(sunDirRef.current);
    if (sunLightRef.current) sunLightRef.current.position.copy(sunDirRef.current).multiplyScalar(10);

    const leftHand = handTrackingRef.current.leftHand;
    const rightHand = handTrackingRef.current.rightHand;
    let targetExpansion = 0;

    // 1. 360 Rotation & Scrolling Control (Right Hand)
    let currentSpeedX = 0.0005; // Default ambient spin
    let currentSpeedY = 0;
    
    if (rightHand) {
        const { x, y } = rightHand.rotationControl;
        
        // X-Axis Control (Spinning Left/Right)
        if (Math.abs(x) > 0.1) {
            currentSpeedX = x * 0.05;
        }
        
        // Y-Axis Control (Tilting/Scrolling Up/Down)
        // We apply this to the entire group for a tumbling effect
        if (Math.abs(y) > 0.1) {
            currentSpeedY = y * 0.05;
        }
    }
    
    // Apply Spin (Y-axis) to individual components to maintain opposing wireframe rotation
    earthRef.current.rotation.y += currentSpeedX;
    if (cloudsRef.current) cloudsRef.current.rotation.y += currentSpeedX * 1.1;
    // Wireframe rotates counter to earth for tech effect
    if (wireframeRef.current) wireframeRef.current.rotation.y -= (currentSpeedX * 0.5);
    
    // Apply Tilt (X-axis) to the container group
    earthGroupRef.current.rotation.x += currentSpeedY;


    // 2. Expansion/Zoom Control (Left Hand)
    if (leftHand) {
      targetExpansion = leftHand.expansionFactor;

      const movementDelta = Math.abs(targetExpansion - smoothExpansionRef.current);
      if (movementDelta > 0.002) {
          SoundService.playServo(movementDelta);
      }
    }

    smoothExpansionRef.current += (targetExpansion - smoothExpansionRef.current) * 0.08;
    const exp = smoothExpansionRef.current;

    // --- VISIBILITY & TRANSITION CONTROL ---
    
    // CHANGED: Earth starts fading earlier (0.4) to separate from Terrain (0.5+)
    // Fade out range: 0.4 to 0.6
    let earthOpacity = 1;
    if (exp > 0.4) {
        earthOpacity = 1 - ((exp - 0.4) / 0.2); 
        earthOpacity = Math.max(0, Math.min(1, earthOpacity));
    }
    
    earthGroupRef.current.visible = earthOpacity > 0.01;

    if (earthGroupRef.current.visible) {
        if (earthRef.current.material) (earthRef.current.material as any).opacity = 0.9 * earthOpacity;
        if (cloudsRef.current?.material) (cloudsRef.current.material as any).opacity = 0.15 * earthOpacity;
        if (wireframeRef.current?.material) (wireframeRef.current.material as any).opacity = 0.2 * earthOpacity;
        if (ringRef.current?.material) (ringRef.current.material as any).opacity = 0.1 * earthOpacity;
        if (particlesRef.current) particlesRef.current.visible = earthOpacity > 0.5;
    }

    // CHANGED: Adjusted sound trigger to match new 50% threshold
    if (exp > 0.55) {
        if (!wasTerrainModeRef.current) {
            SoundService.playMapSwitch();
            wasTerrainModeRef.current = true;
        }
    } else {
        wasTerrainModeRef.current = false;
    }

    // --- Earth Animations (Only if visible) ---
    if (earthGroupRef.current.visible) {
        const baseScale = 1.5;
        const coreScale = baseScale * (1 - Math.max(0, exp - 0.3) * 0.5);
        earthRef.current.scale.set(coreScale, coreScale, coreScale);
        // Keep the additive holographic Fresnel shell hugging the textured globe.
        if (holoShellRef.current) holoShellRef.current.scale.setScalar(coreScale * 1.03);

        const cloudScale = baseScale * 1.02 + (exp * 1.0); 
        if (cloudsRef.current) {
            cloudsRef.current.scale.set(cloudScale, cloudScale, cloudScale);
            // Cloud rotation handled above in shared block
            cloudsRef.current.rotation.y += (exp * 0.01);
        }

        const wireScale = baseScale * 1.2 + (exp * 2.0);
        if (wireframeRef.current) {
            wireframeRef.current.scale.set(wireScale, wireScale, wireScale);
             // Wireframe rotation handled above in shared block
             wireframeRef.current.rotation.y -= (exp * 0.02);
        }

        if (ringRef.current) {
            ringRef.current.scale.set(1 + exp, 1 + exp, 1 + exp);
            ringRef.current.rotation.z -= currentSpeedX * 1.5;
            ringRef.current.rotation.x = (Math.PI / 2) + (Math.sin(state.clock.elapsedTime * 0.2) * 0.1) + (exp * 0.5);
        }

        if (particlesRef.current) {
            particlesRef.current.rotation.y += 0.001;
            particlesRef.current.scale.set(1 + exp * 1.5, 1 + exp * 1.5, 1 + exp * 1.5);
        }

        const rotationY = earthRef.current.rotation.y % (Math.PI * 2);
        const normalizedRotation = rotationY < 0 ? rotationY + Math.PI * 2 : rotationY;
        const degrees = (normalizedRotation * 180) / Math.PI;
        
        if (degrees > 30 && degrees < 100) setRegion(RegionName.AMERICAS);
        else if (degrees >= 100 && degrees < 190) setRegion(RegionName.PACIFIC);
        else if (degrees >= 190 && degrees < 280) setRegion(RegionName.ASIA);
        else if (degrees >= 280 && degrees < 330) setRegion(RegionName.AFRICA);
        else setRegion(RegionName.EUROPE);
    }
  });

  return (
    // Post-processing (bloom + chromatic aberration + grain + vignette) is owned by the
    // App-level globe Canvas composer so the whole scene shares one pipeline — see App.tsx.
    <group position={[0, 0, 0]}>
        {/* EARTH GROUP */}
        <group ref={earthGroupRef}>
            <mesh ref={earthRef}>
                <sphereGeometry args={[1, 64, 64]} />
                <meshPhongMaterial
                    ref={earthMatRef}
                    map={colorMap}
                    normalMap={normalMap}
                    specularMap={specularMap}
                    color="#2b6fb0"
                    emissive="#001133"
                    emissiveMap={colorMap} // faint continent self-glow; day/night added via shader
                    emissiveIntensity={0.3}
                    specular="#223a55"
                    shininess={18}
                    transparent={true}
                    opacity={0.95}
                    blending={AdditiveBlending}
                />
            </mesh>

            {/* Additive holographic Fresnel shell — gold Stark-HUD rim glow + animated
                scanlines layered over the textured globe (textured Earth preserved). */}
            <mesh ref={holoShellRef}>
                <sphereGeometry args={[1, 64, 64]} />
                <HolographicMaterial
                    hologramColor="#C9A84C"
                    fresnelOpacity={0.6}
                    fresnelAmount={0.5}
                    scanlineSize={10}
                    signalSpeed={0.4}
                    hologramOpacity={0.95}
                />
            </mesh>

            <mesh ref={cloudsRef}>
                <sphereGeometry args={[1.01, 64, 64]} />
                <meshBasicMaterial 
                    map={colorMap}
                    color="#00F0FF"
                    transparent
                    opacity={0.2}
                    blending={AdditiveBlending}
                />
            </mesh>

            <mesh ref={wireframeRef}>
                <icosahedronGeometry args={[1, 2]} />
                <meshBasicMaterial 
                    color="#002FA7" 
                    wireframe 
                    transparent 
                    opacity={0.2} 
                    blending={AdditiveBlending}
                />
            </mesh>

            <group ref={particlesRef} rotation={[0,0,Math.PI/4]}>
                <Points positions={satelliteData} stride={3} frustumCulled={false}>
                    <PointMaterial
                        transparent
                        color="#00F0FF"
                        size={0.015}
                        sizeAttenuation={true}
                        depthWrite={false}
                        blending={AdditiveBlending}
                    />
                </Points>
            </group>

            <mesh ref={ringRef} rotation={[Math.PI / 2.3, 0, 0]}>
                <ringGeometry args={[2.0, 2.4, 128]} />
                <meshBasicMaterial 
                    color="#00F0FF" 
                    side={DoubleSide} 
                    transparent 
                    opacity={0.1} 
                    blending={AdditiveBlending}
                />
            </mesh>
        </group>
        
        {/* TERRAIN MODEL OVERLAY */}
        <TerrainModel expansionRef={smoothExpansionRef} />
        
        {/* Warm directional sun — its position is driven by the live system clock so the
            globe carries a real day/night terminator (city lights bloom on the night side). */}
        <directionalLight ref={sunLightRef} color="#fff4e0" intensity={2.4} />
        <ambientLight intensity={0.12} color="#002FA7" />
        <pointLight position={[10, 10, 10]} intensity={2} color="#00F0FF" />
        <pointLight position={[-10, -10, -5]} intensity={1} color="#FF00FF" />
    </group>
  );
};

export default HolographicEarth;