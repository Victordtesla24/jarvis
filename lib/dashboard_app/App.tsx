import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import ReactorCore from './components/ReactorCore';
import JarvisHUD from './components/JarvisHUD';
import JarvisIntro from './components/JarvisIntro';
import { useStats, pct01 } from './hooks/useStats';

const App: React.FC = () => {
  const [booted, setBooted] = useState(() => {
    try { return new URLSearchParams(window.location.search).has('skipboot'); } catch { return false; }
  });
  const [introActive, setIntroActive] = useState(false);
  const [bootStep, setBootStep] = useState(0);

  // Live JARVIS telemetry (lib/dashboard.py :7327). Polls unconditionally,
  // even during boot, so the reactor is already breathing on reveal.
  const stats = useStats();
  const load = pct01(stats?.system?.cpu_load_pct, 8);

  // Boot Sequence (SILENT — no TTS/audio anywhere).
  const startSystem = () => {
    setBootStep(1);
    setTimeout(() => setBootStep(2), 800);
    setTimeout(() => setBootStep(3), 1800);
    setTimeout(() => {
      setIntroActive(true);
      setTimeout(() => {
        setIntroActive(false);
        setBooted(true);
      }, 2800);
    }, 2500);
  };

  // Boot Screen
  if (!booted && !introActive) {
    return (
      <div className="relative w-full h-screen bg-black text-holo-cyan font-mono flex flex-col items-center justify-center overflow-hidden">
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
            <div className="text-2xl font-display font-bold animate-pulse">
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

        <div className="absolute bottom-8 text-[10px] text-gray-600">Stark Industries Proprietary Technology</div>
      </div>
    );
  }

  // Intro Screen
  if (introActive) {
    return <JarvisIntro />;
  }

  // Main HUD
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden animate-flash">
      {/* 3D arc-reactor centerpiece */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <Canvas
          camera={{ position: [0, 0, 3.5], fov: 55 }}
          gl={{ alpha: true, antialias: false, toneMapping: THREE.NoToneMapping }}
          dpr={[1, 1.25]}
        >
          <Suspense fallback={null}>
            <ReactorCore load={load} />
          </Suspense>
        </Canvas>
      </div>

      {/* JARVIS-3.0 desktop HUD (NeoCore-based, real /api/stats) */}
      <JarvisHUD stats={stats} />
    </div>
  );
};

export default App;
