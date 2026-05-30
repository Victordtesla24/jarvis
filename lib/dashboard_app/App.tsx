import React, { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import ReactorCore from './components/ReactorCore';
import HolographicEarth from './components/HolographicEarth';
import JarvisHUD from './components/JarvisHUD';
import JarvisIntro from './components/JarvisIntro';
import VideoFeed from './components/VideoFeed';
import { useStats, pct01 } from './hooks/useStats';
import { HandTrackingState } from './types';

const App: React.FC = () => {
  const [booted, setBooted] = useState(() => {
    try { return new URLSearchParams(window.location.search).has('skipboot'); } catch { return false; }
  });
  const [introActive, setIntroActive] = useState(false);
  const [bootStep, setBootStep] = useState(0);
  // Reactor ↔ holographic-globe centerpiece toggle (top-right control).
  const [globeMode, setGlobeMode] = useState(false);

  // Live JARVIS telemetry (lib/dashboard.py :7327). Polls unconditionally,
  // even during boot, so the reactor is already breathing on reveal.
  const stats = useStats();
  const load = pct01(stats?.system?.cpu_load_pct, 8);

  // Shared MediaPipe hand-tracking state. <VideoFeed> drives the camera +
  // GestureRecognizer and writes the latest two-hand state into this ref every
  // frame; BOTH the reactor and the globe read it in their own useFrame, so the
  // same gesture semantics stay live across the Reactor↔Globe toggle. Camera is
  // OPTIONAL: if getUserMedia is denied the ref simply stays all-null and every
  // consumer falls back to its ambient idle animation (never freezes, no crash).
  const handTrackingRef = useRef<HandTrackingState>({ leftHand: null, rightHand: null });
  const handleTrackingUpdate = useCallback((s: HandTrackingState) => {
    handTrackingRef.current = s;
  }, []);

  // Boot Sequence (SILENT — no TTS/audio anywhere). setTimeout IDs are tracked
  // so we can clear them if the component unmounts or boot is re-triggered.
  const bootTimersRef = useRef<number[]>([]);
  const clearBootTimers = () => {
    bootTimersRef.current.forEach((id) => window.clearTimeout(id));
    bootTimersRef.current = [];
  };
  useEffect(() => clearBootTimers, []);

  const startSystem = () => {
    clearBootTimers();
    setBootStep(1);
    bootTimersRef.current.push(window.setTimeout(() => setBootStep(2), 800));
    bootTimersRef.current.push(window.setTimeout(() => setBootStep(3), 1800));
    bootTimersRef.current.push(window.setTimeout(() => {
      setIntroActive(true);
      bootTimersRef.current.push(window.setTimeout(() => {
        setIntroActive(false);
        setBooted(true);
      }, 2800));
    }, 2500));
  };

  // Boot Screen
  if (!booted && !introActive) {
    return (
      <div className="app-substrate relative w-full h-screen bg-black text-holo-cyan font-mono flex flex-col items-center justify-center overflow-hidden">
        <div className="scanlines opacity-20"></div>
        <div className="absolute w-[600px] h-[600px] border border-gray-800 rounded-full animate-spin-slow opacity-30"></div>
        <div className="absolute w-[400px] h-[400px] border border-dashed border-klein-blue rounded-full animate-spin-reverse-slow opacity-30"></div>

        {bootStep === 0 && (
          <button
            onClick={startSystem}
            className="z-10 group relative px-8 py-4 bg-transparent border border-holo-cyan text-holo-cyan font-display font-bold tracking-[0.3em] text-xl hover:bg-holo-cyan/10 transition-all duration-300 cursor-pointer"
          >
            <div className="absolute inset-0 w-full h-full border border-holo-cyan blur-[2px] opacity-50 group-hover:opacity-100 transition-opacity"></div>
            Initialize J.A.R.V.I.S.
          </button>
        )}

        {bootStep >= 1 && (
          <div className="z-10 flex flex-col items-center gap-4 w-96">
            <div className="text-2xl font-display font-bold jh-holo-flicker">
              {bootStep === 1 && 'Reactor spin-up...'}
              {bootStep === 2 && 'Loading telemetry bus...'}
              {bootStep === 3 && 'Authenticating...'}
            </div>
            <div className="w-full h-1 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-holo-cyan shadow-[0_0_10px_#00F0FF] transition-all duration-1000 ease-out"
                style={{ width: bootStep === 1 ? '10%' : bootStep === 2 ? '60%' : '100%' }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 h-20 overflow-hidden w-full text-center leading-tight">
              {bootStep >= 1 && <div> Arc reactor field... stable</div>}
              {bootStep >= 1 && <div> GPU delegation... assigned</div>}
              {bootStep >= 2 && <div> Telemetry bus /api/stats... linked</div>}
              {bootStep >= 2 && <div> Diagnostics uplink... online</div>}
              {bootStep >= 3 && <div> Biometric handshake... bypassed</div>}
              {bootStep >= 3 && <div className="text-green-500"> Access granted</div>}
            </div>
          </div>
        )}

        <div className="absolute bottom-8 text-[10px] text-gray-600">J.A.R.V.I.S. · PROPRIETARY TECHNOLOGY</div>
      </div>
    );
  }

  // Intro Screen
  if (introActive) {
    return <JarvisIntro />;
  }

  // Main HUD
  return (
    <div className="app-substrate relative w-full h-screen bg-black overflow-hidden animate-flash">
      {/* Camera mirror — dim background layer. Mounted ONCE (camera-driven) and
          left mounted across the Reactor↔Globe toggle so hand tracking never
          re-initialises. If the camera is denied this stays a black element and
          VideoFeed logs once; gestures simply go idle. */}
      <VideoFeed onTrackingUpdate={handleTrackingUpdate} />

      {/* 3D centerpiece — arc reactor, or holographic globe when toggled. Both
          views receive the SAME live handTrackingRef. */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <Canvas
          camera={{ position: [0, 0, 3.5], fov: 55 }}
          gl={{ alpha: true, antialias: false, toneMapping: THREE.NoToneMapping }}
          dpr={[1, 1.25]}
        >
          <Suspense fallback={null}>
            {globeMode
              ? <HolographicEarth handTrackingRef={handTrackingRef} />
              : <ReactorCore load={load} handTrackingRef={handTrackingRef} />}
          </Suspense>
        </Canvas>
      </div>

      {/* Centerpiece toggle (top-right) — Reactor ↔ Holographic globe */}
      <button
        type="button"
        onClick={() => setGlobeMode((g) => !g)}
        className="jh-globe-toggle"
        aria-pressed={globeMode}
      >
        {globeMode ? '◉ REACTOR' : '🜨 GLOBE'}
      </button>

      {/* JARVIS-3.0 desktop HUD (NeoCore-based, real /api/stats) */}
      <JarvisHUD stats={stats} />
    </div>
  );
};

export default App;
