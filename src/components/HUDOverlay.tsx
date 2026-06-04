import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { useSpring as useSpring3, animated as animated3 } from '@react-spring/three';
import { useSpring as useSpringWeb, animated as animatedWeb } from '@react-spring/web';
import { HandTrackingState, RegionName } from '../types';
import gsap from 'gsap';
import { Animator, AnimatorGeneralProvider, FrameCorners, useFrameAssembler } from '@arwes/react';

interface HUDOverlayProps {
  handTrackingRef: React.MutableRefObject<HandTrackingState>;
  currentRegion: RegionName;
}

// ── HUD GPU particle layer ────────────────────────────────────────────────────
// Custom THREE.Points emitters (the project targets React 18 / @react-three/fiber 8,
// with which wawa-vfx is incompatible — it requires React 19 / fiber 9 / drei 10 — so
// these mirror its AmbientDataParticles / HUDActivationBurst API using the same custom
// points pattern as the reactor's StarDust). Palette: gold #C9A84C, cyan #4CCAC9.
const GOLD = new THREE.Color('#C9A84C');
const CYAN = new THREE.Color('#4CCAC9');
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
// deterministic hash-based scatter — procedural placement, not live data
const hash = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Ambient floating data-particles: a slow drift field of fine gold/cyan motes.
const AMBIENT_SETTINGS = { nbParticles: 150 };
export function AmbientDataParticles() {
  const ref = useRef<THREE.Points>(null);
  const { geo, mat } = useMemo(() => {
    const n = AMBIENT_SETTINGS.nbParticles;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (hash(i, 1) - 0.5) * 8;
      pos[i * 3 + 1] = (hash(i, 2) - 0.5) * 6;
      pos[i * 3 + 2] = (hash(i, 3) - 0.5) * 2 - 0.6;
      const c = hash(i, 4) < 0.25 ? CYAN : GOLD;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.045, sizeAttenuation: true, vertexColors: true, transparent: true,
      opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    return { geo, mat };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame((state, dt) => {
    if (!ref.current) return;
    const d = Math.min(dt, 0.05);
    const attr = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] += d * 0.18;                                                  // slow upward drift
      arr[i] += Math.sin(state.clock.elapsedTime * 0.3 + i) * d * 0.04;        // gentle sway
      if (arr[i + 1] > 3) arr[i + 1] = -3;                                     // wrap around
    }
    attr.needsUpdate = true;
    mat.opacity = 0.42 + Math.sin(state.clock.elapsedTime * 0.8) * 0.1;        // breathe
  });
  return <points ref={ref} geometry={geo} material={mat} />;
}

// HUD activation burst: a gold spark that radiates outward and fades on a slow loop.
const BURST_SETTINGS = { nbParticles: 80 };
export function HUDActivationBurst({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  const t0 = useRef(0);
  const dir = useMemo(() => {
    const n = BURST_SETTINGS.nbParticles;
    const d = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * 2.399963;
      d[i * 3] = Math.cos(phi) * r; d[i * 3 + 1] = y; d[i * 3 + 2] = Math.sin(phi) * r;
    }
    return d;
  }, []);
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BURST_SETTINGS.nbParticles * 3), 3));
    const mat = new THREE.PointsMaterial({
      color: GOLD, size: 0.06, sizeAttenuation: true, transparent: true,
      opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    return { geo, mat };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame((state) => {
    const CYCLE = 3.6, DUR = 0.75, MAXR = 1.6;
    if (t0.current === 0) t0.current = state.clock.elapsedTime;
    const phase = (state.clock.elapsedTime - t0.current) % CYCLE;
    const p = clamp01(phase / DUR);
    const ease = 1 - Math.pow(1 - p, 3);
    const attr = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const rr = ease * MAXR;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = dir[i] * rr; arr[i + 1] = dir[i + 1] * rr; arr[i + 2] = dir[i + 2] * rr;
    }
    attr.needsUpdate = true;
    mat.opacity = phase < DUR ? (1 - p) * 0.9 : 0;                            // spark, then dormant to next cycle
  });
  return <points geometry={geo} material={mat} position={position} />;
}

// @react-spring/three (in-Canvas): springs a 3D HUD element in with physical overshoot
// on mount, and scales it back to nothing when hidden — spring-driven mount/unmount.
export function AnimatedHUDPanel({ visible, position, children }: {
  visible: boolean; position: [number, number, number]; children: React.ReactNode;
}) {
  const spring = useSpring3({
    scale: visible ? 1 : 0.001,
    config: { tension: 260, friction: 18, precision: 0.001 },   // low friction → visible overshoot
  });
  return (
    <animated3.group position={position} scale={spring.scale}>
      {children}
    </animated3.group>
  );
}

// Arwes animated corner-bracket frame for the intel panel. @arwes/react@1.0.0-alpha.23
// API: FrameCorners draws the angular brackets; useFrameAssembler plays the draw-in
// animation in sync with the nearest <Animator> (active when the panel is pinched open).
// (The plan's FrameSVGCorners/aaVisibility symbols don't exist in this alpha — this is
// the equivalent supported pattern.)
function IntelPanelFrame() {
  const frameRef = useRef<SVGSVGElement>(null);
  useFrameAssembler(frameRef);
  return (
    <FrameCorners
      elementRef={frameRef}
      strokeWidth={1.5}
      cornerLength={18}
      // line = alert-red via currentColor; bg fill forced transparent (panel has its own bg)
      style={{ color: '#FF2A2A', '--arwes-frames-bg-color': 'transparent' } as React.CSSProperties}
    />
  );
}

// Live AR overlay: the hand-skeleton canvas, expansion gauge and pinch reticle are
// all driven directly by the MediaPipe hand-tracking ref. The rich GMC dashboard
// chrome now lives in the 3D HoloDashboard; this layer keeps only live telemetry
// visuals plus a pinch-triggered intel panel wired to real values.

const HUDOverlay: React.FC<HUDOverlayProps> = ({ handTrackingRef, currentRegion }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);

  const [showIntelPanel, setShowIntelPanel] = useState(false);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [panelData, setPanelData] = useState({ signal: 40, az: 0, el: 0 });
  const [hudShown, setHudShown] = useState(false);

  // @react-spring/web (DOM, outside Canvas): the intel panel springs in/out on pinch.
  const panelSpring = useSpringWeb({
    opacity: showIntelPanel ? 1 : 0,
    transform: showIntelPanel ? 'scale(1)' : 'scale(0.86)',
    config: { tension: 300, friction: 22 },
  });

  // Spring the in-Canvas 3D HUD accent in once the overlay mounts (power-on overshoot).
  useEffect(() => {
    const id = requestAnimationFrame(() => setHudShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const reticleRotationRef = useRef(0);
  const wasPinchingRef = useRef(false);
  const signalBarRef = useRef<HTMLDivElement>(null);

  // Live intel-panel values while shown (sampled ~10Hz from real telemetry).
  useEffect(() => {
    if (!showIntelPanel) return;
    const id = window.setInterval(() => {
      const r = handTrackingRef.current.rightHand;
      const l = handTrackingRef.current.leftHand;
      setPanelData({
        signal: Math.round(((l?.expansionFactor ?? 0) * 0.55 + 0.45) * 100),
        az: Math.round((r?.rotationControl.x ?? 0) * 180),
        el: Math.round((r?.rotationControl.y ?? 0) * 90),
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [showIntelPanel, handTrackingRef]);

  // Step 7 — GSAP dramatic signal-bar fill: scaleX 0 → target over 1.5s when the panel
  // opens, replacing the CSS width transition (which would fight GSAP). transformOrigin
  // left makes it fill from the left, Prometheus-style.
  useEffect(() => {
    if (showIntelPanel && signalBarRef.current) {
      gsap.fromTo(
        signalBarRef.current,
        { scaleX: 0 },
        {
          scaleX: panelData.signal / 100,
          duration: 1.5,
          ease: 'power2.out',
          transformOrigin: 'left center',
          overwrite: true,
        },
      );
    }
  }, [showIntelPanel, panelData.signal]);

  // Canvas Drawing Loop (Hand Skeletal & Effects)
  useEffect(() => {
    const renderFrame = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const hands = handTrackingRef.current;

      reticleRotationRef.current += 0.05;

      // --- HAND RENDERING ---
      [hands.leftHand, hands.rightHand].forEach(hand => {
        if (hand) {
          const isRight = hand.handedness === 'Right';
          const mainColor = isRight ? '#00F0FF' : '#00A3FF';

          // Skeleton
          ctx.strokeStyle = mainColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();

          const connections = [[0,1],[1,2],[2,3],[3,4], [0,5],[5,6],[6,7],[7,8], [5,9],[9,10],[10,11],[11,12], [9,13],[13,14],[14,15],[15,16], [13,17],[17,18],[18,19],[19,20], [0,17]];

          connections.forEach(([start, end]) => {
            const p1 = hand.landmarks[start];
            const p2 = hand.landmarks[end];
            ctx.moveTo((1 - p1.x) * canvas.width, p1.y * canvas.height);
            ctx.lineTo((1 - p2.x) * canvas.width, p2.y * canvas.height);
          });
          ctx.stroke();
          ctx.setLineDash([]);

          // Joints
          hand.landmarks.forEach((lm, index) => {
            const x = (1 - lm.x) * canvas.width;
            const y = lm.y * canvas.height;

            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            if ([4, 8, 12, 16, 20].includes(index)) {
                ctx.beginPath();
                ctx.arc(x, y, 8, reticleRotationRef.current, reticleRotationRef.current + Math.PI);
                ctx.strokeStyle = isRight ? '#FF2A2A' : '#00F0FF';
                ctx.stroke();
            }
          });

          // Palm Info
          const palmX = (1 - hand.landmarks[0].x) * canvas.width;
          const palmY = hand.landmarks[0].y * canvas.height;

          ctx.beginPath();
          ctx.arc(palmX, palmY, 20, -reticleRotationRef.current, -reticleRotationRef.current + Math.PI * 1.5);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.stroke();

          ctx.font = '10px Rajdhani';
          ctx.fillStyle = mainColor;
          const label = isRight ? 'ID: RIGHT-HAND-01' : 'ID: LEFT-HAND-02';
          ctx.fillText(label, palmX + 25, palmY);
        }
      });

      // --- LEFT HAND: EXPANSION GAUGE ---
      if (hands.leftHand) {
          const wrist = hands.leftHand.landmarks[0];
          const gaugeX = (1 - wrist.x) * canvas.width - 100;
          const gaugeY = wrist.y * canvas.height;

          const exp = hands.leftHand.expansionFactor;
          const isMaxed = exp > 0.95;
          const gaugeColor = isMaxed ? '#FF2A2A' : '#00F0FF';

          // Gauge Background
          ctx.beginPath();
          ctx.arc(gaugeX, gaugeY, 40, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0, 47, 167, 0.5)';
          ctx.lineWidth = 4;
          ctx.stroke();

          // Active Gauge Value
          ctx.beginPath();
          const startAngle = -Math.PI / 2;
          const endAngle = startAngle + (exp * Math.PI * 2);
          ctx.arc(gaugeX, gaugeY, 40, startAngle, endAngle);
          ctx.strokeStyle = gaugeColor;
          ctx.lineWidth = isMaxed ? 6 : 4;
          if (isMaxed) {
              ctx.shadowColor = '#FF2A2A';
              ctx.shadowBlur = 15;
          } else {
              ctx.shadowBlur = 0;
          }
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Text
          ctx.fillStyle = gaugeColor;
          ctx.font = isMaxed ? 'bold 14px "Orbitron"' : 'bold 12px "Orbitron"';
          ctx.textAlign = 'center';
          ctx.fillText(isMaxed ? "MAX OUTPUT" : "UNLOCK LIMIT", gaugeX, gaugeY - 10);
          ctx.fillText(`${Math.round(exp * 100)}%`, gaugeX, gaugeY + 15);
          ctx.textAlign = 'left';

          // Connecting line
          ctx.beginPath();
          ctx.moveTo((1 - wrist.x) * canvas.width - 25, wrist.y * canvas.height);
          ctx.lineTo(gaugeX + 45, gaugeY);
          ctx.strokeStyle = isMaxed ? 'rgba(255, 42, 42, 0.5)' : 'rgba(0, 240, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
      }

      // --- RIGHT HAND: PINCH TO SHOW INTEL ---
      if (hands.rightHand) {
        const isPinching = hands.rightHand.isPinching;

        if (isPinching && !wasPinchingRef.current) {
            setShowIntelPanel(true);
        } else if (!isPinching && wasPinchingRef.current) {
            setShowIntelPanel(false);
        }
        wasPinchingRef.current = isPinching;

        if (isPinching) {
            const indexTip = hands.rightHand.landmarks[8];
            const cursorX = (1 - indexTip.x) * canvas.width;
            const cursorY = indexTip.y * canvas.height;
            setPanelPos({ x: cursorX + 50, y: cursorY - 100 });

            ctx.beginPath();
            ctx.moveTo(cursorX, cursorY);
            ctx.lineTo(cursorX + 50, cursorY - 100);
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (isPinching) {
             const indexTip = hands.rightHand.landmarks[8];
             const thumbTip = hands.rightHand.landmarks[4];
             const midX = ((1 - indexTip.x) * canvas.width + (1 - thumbTip.x) * canvas.width) / 2;
             const midY = (indexTip.y * canvas.height + thumbTip.y * canvas.height) / 2;

             ctx.beginPath();
             ctx.arc(midX, midY, 15, 0, Math.PI * 2);
             ctx.strokeStyle = '#FF2A2A';
             ctx.lineWidth = 2;
             ctx.stroke();

             ctx.beginPath();
             ctx.arc(midX, midY, 5, 0, Math.PI * 2);
             ctx.fillStyle = '#FF2A2A';
             ctx.fill();
        }
      } else {
          if (showIntelPanel) setShowIntelPanel(false);
          wasPinchingRef.current = false;
      }

      requestRef.current = requestAnimationFrame(renderFrame);
    };

    requestRef.current = requestAnimationFrame(renderFrame);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [handTrackingRef, showIntelPanel]);

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden font-sans text-holo-cyan select-none">
      {/* GPU particle layer — ambient gold/cyan data motes + a looping activation spark */}
      <div className="absolute inset-0 z-[8]" style={{ pointerEvents: 'none' }}>
        <Canvas camera={{ position: [0, 0, 5], fov: 60 }} gl={{ alpha: true, antialias: false }} dpr={[1, 1.5]} style={{ width: '100%', height: '100%' }}>
          <AmbientDataParticles />
          <HUDActivationBurst position={[0, 0, 0]} />
          {/* spring-physics 3D comms reticle, low at frame bottom — springs in on power-on */}
          <AnimatedHUDPanel visible={hudShown} position={[0, -2.4, 0]}>
            <mesh>
              <torusGeometry args={[0.34, 0.008, 10, 80]} />
              <meshBasicMaterial color="#4CCAC9" transparent opacity={0.45} toneMapped={false} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI * 0.15]}>
              <ringGeometry args={[0.4, 0.43, 64, 1, 0, Math.PI * 1.25]} />
              <meshBasicMaterial color="#C9A84C" transparent opacity={0.5} toneMapped={false} />
            </mesh>
          </AnimatedHUDPanel>
        </Canvas>
      </div>
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-20" />
      <div className="vignette"></div>
      <div className="scanlines z-10 opacity-50"></div>

      {/* --- INTERACTIVE FLOATING PANEL (PINCH) — spring mount/unmount via @react-spring/web --- */}
      <animatedWeb.div
            className="absolute z-40 origin-top-left"
            style={{
                left: panelPos.x,
                top: panelPos.y,
                width: '300px',
                opacity: panelSpring.opacity,
                transform: panelSpring.transform,
                pointerEvents: 'none',
            }}
          >
            <AnimatorGeneralProvider duration={{ enter: 0.3, exit: 0.2 }}>
              <Animator active={showIntelPanel}>
                <div style={{ position: 'relative' }}>
                  <IntelPanelFrame />
                  <div className="bg-black/80 border-l-2 border-alert-red shadow-[0_0_40px_rgba(255,42,42,0.3)] backdrop-blur-xl p-1 rounded-r-lg">
                <div className="flex justify-between items-center bg-gradient-to-r from-alert-red/50 to-transparent p-2 mb-2 border-b border-white/10">
                    <span className="font-display font-bold text-sm tracking-widest text-white">GEO_INTEL_LIVE</span>
                    <div className="w-2 h-2 bg-alert-red rounded-full animate-ping"></div>
                </div>

                <div className="p-4 space-y-4">
                    <div className="flex justify-between items-end">
                        <div className="text-xs text-holo-blue uppercase">Target Region</div>
                        <div className="text-2xl font-display text-white font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
                            {currentRegion}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] uppercase text-gray-400">
                                <span>Signal Strength</span>
                                <span>{panelData.signal}%</span>
                            </div>
                            <div className="w-full bg-gray-900 h-1.5 overflow-hidden rounded-sm">
                                <div
                                    ref={signalBarRef}
                                    className="bg-holo-cyan h-full shadow-[0_0_10px_#00F0FF] relative"
                                    style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
                                >
                                    <div className="absolute top-0 left-0 h-full w-full bg-white/30 animate-[scanline_1s_linear_infinite]"></div>
                                </div>
                            </div>
                        </div>

                         <div className="grid grid-cols-2 gap-2 mt-2">
                             <div className="bg-white/5 p-1 text-center border border-white/10">
                                 <div className="text-[8px] text-gray-400">Azimuth</div>
                                 <div className="font-mono text-xs text-holo-cyan">{panelData.az}&deg;</div>
                             </div>
                             <div className="bg-white/5 p-1 text-center border border-white/10">
                                 <div className="text-[8px] text-gray-400">Elevation</div>
                                 <div className="font-mono text-xs text-holo-cyan">{panelData.el}&deg;</div>
                             </div>
                         </div>
                    </div>
                </div>
                  </div>
                </div>
              </Animator>
            </AnimatorGeneralProvider>
            {/* Decorator Lines */}
            <svg className="absolute -left-4 top-0 w-4 h-full overflow-visible">
                 <path d="M 4,0 L 0,10 L 0,150" fill="none" stroke="#FF2A2A" strokeWidth="1" />
            </svg>
      </animatedWeb.div>
    </div>
  );
};

export default HUDOverlay;
