
import React, { useRef, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import HolographicEarth from './components/HolographicEarth';
import HudBackdrop from './components/relativity/HudBackdrop';
import ReactorCore3D from './components/relativity/ReactorCore3D';
import HUDOverlay from './components/HUDOverlay';
import BootSequence from './components/BootSequence';
import JarvisConsole from './components/JarvisConsole';
import GestureDeck from './components/widgets/GestureDeck';
import GestureController from './components/GestureController';
import RelativityHUD from './components/relativity/RelativityHUD';
import HoloGlass from './components/relativity/HoloGlass';
import LoginButton from './components/LoginButton';
import { HandTrackingState, RegionName } from './types';

// The dashboard boots silent and camera-free: the 3D scene runs its cinematic idle drift with
// hand-tracking refs null. Gesture control is strictly opt-in — only when the operator engages
// the GESTURES toggle does GestureController request the webcam and drive handTrackingRef. The
// J.A.R.V.I.S. console talks to the always-on Docker reasoning core over /api/jarvis.

const App: React.FC = () => {
  const handTrackingRef = useRef<HandTrackingState>({
    leftHand: null,
    rightHand: null
  });

  const fakeHandTrackingRef = useRef<HandTrackingState>({
    leftHand: null,
    rightHand: null
  });

  const [currentRegion, setCurrentRegion] = useState<RegionName>(RegionName.ASIA);
  const [booted, setBooted] = useState(false);
  const [bootStarted, setBootStarted] = useState(false);
  const [globeMode, setGlobeMode] = useState(false);
  const [gesturesOn, setGesturesOn] = useState(false);
  const [instrumentsMode, setInstrumentsMode] = useState(true);

  const startSystem = () => setBootStarted(true);

  // Pre-boot: the INITIALIZE gateway (camera-free, silent).
  if (!bootStarted) {
    return (
      <div className="relative w-full h-screen bg-black text-holo-cyan font-mono flex flex-col items-center justify-center overflow-hidden">
        <div className="scanlines opacity-20"></div>

        <div className="absolute w-[600px] h-[600px] border border-gray-800 rounded-full animate-spin-slow opacity-30"></div>
        <div className="absolute w-[400px] h-[400px] border border-dashed border-klein-blue rounded-full animate-spin-reverse-slow opacity-30"></div>

        <div className="z-10 flex flex-col items-center gap-4">
          <button
            onClick={startSystem}
            className="group relative px-8 py-4 bg-transparent border border-holo-cyan text-holo-cyan font-display font-bold tracking-[0.3em] text-xl hover:bg-holo-cyan/10 transition-all duration-300 cursor-pointer"
          >
            <div className="absolute inset-0 w-full h-full border border-holo-cyan blur-[2px] opacity-50 group-hover:opacity-100 transition-opacity"></div>
            INITIALIZE J.A.R.V.I.S.
          </button>
          <LoginButton />
        </div>

        <div className="absolute bottom-8 text-[10px] text-gray-600">STARK INDUSTRIES Proprietary Technology</div>
      </div>
    );
  }

  // Cinematic 14s power-on, then hand off to the live dashboard.
  if (!booted) {
    return <BootSequence onComplete={() => setBooted(true)} />;
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Top-right control cluster */}
      <div className="absolute top-4 right-4 z-50 flex gap-2 pointer-events-auto">
        <button
          onClick={() => setGesturesOn(g => !g)}
          className={`px-4 py-2 bg-transparent border font-display font-bold tracking-[0.2em] text-xs transition-all duration-300 cursor-pointer ${
            gesturesOn
              ? 'border-holo-cyan text-holo-cyan bg-holo-cyan/10'
              : 'border-holo-cyan/40 text-holo-cyan/70 hover:bg-holo-cyan/10'
          }`}
          style={{ backdropFilter: 'blur(4px)' }}
        >
          {gesturesOn ? 'GESTURES ◉' : 'GESTURES ◌'}
        </button>
        {!globeMode && (
          <button
            onClick={() => setInstrumentsMode(m => !m)}
            className={`px-4 py-2 bg-transparent border font-display font-bold tracking-[0.2em] text-xs transition-all duration-300 cursor-pointer ${
              instrumentsMode
                ? 'border-holo-cyan text-holo-cyan bg-holo-cyan/10'
                : 'border-holo-cyan/40 text-holo-cyan/70 hover:bg-holo-cyan/10'
            }`}
            style={{ backdropFilter: 'blur(4px)' }}
          >
            {instrumentsMode ? 'INSTRUMENTS ◉' : 'INSTRUMENTS ◌'}
          </button>
        )}
        <button
          onClick={() => setGlobeMode(g => !g)}
          className="px-4 py-2 bg-transparent border border-holo-cyan text-holo-cyan font-display font-bold tracking-[0.2em] text-xs hover:bg-holo-cyan/10 transition-all duration-300 cursor-pointer"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          {globeMode ? 'REACTOR' : 'GLOBE'}
        </button>
      </div>

      {/* Opt-in gesture control: engages webcam + MediaPipe only while active. */}
      {gesturesOn && <GestureController handTrackingRef={handTrackingRef} />}

      {/* 2. Background layer — flat FUI backdrop (default) or 3D holo-globe */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {globeMode ? (
          <Canvas camera={{ position: [0, 0, 4], fov: 55 }} gl={{ alpha: true, antialias: false }} dpr={[1, 1.5]}>
            <Suspense fallback={null}>
              <HolographicEarth handTrackingRef={fakeHandTrackingRef} setRegion={setCurrentRegion} />
            </Suspense>
          </Canvas>
        ) : (
          <HudBackdrop />
        )}
      </div>

      {/* 2b. 3D reactor-core centrepiece (reactor view) — gesture/drag controlled */}
      {!globeMode && (
        <div className="absolute inset-0 z-[12]" style={{ pointerEvents: 'auto' }}>
          <ReactorCore3D handTrackingRef={handTrackingRef} scale={0.4} />
        </div>
      )}

      {/* 2c. Gesture-driven, AI-modulated instrument deck (reactor view) */}
      {!globeMode && instrumentsMode && <GestureDeck handTrackingRef={handTrackingRef} />}

      {/* 3a. HUD Relativity design-baseline panel layer (reactor view) */}
      {!globeMode && <RelativityHUD currentRegion={currentRegion} minimal={instrumentsMode} />}

      {/* 3a-glass. Curved holographic-glass post layer (CRT curv / Plane Curvature). */}
      <HoloGlass />

      {/* 3b. UI/HUD Layer */}
      <HUDOverlay
        handTrackingRef={handTrackingRef}
        currentRegion={currentRegion}
      />

      {/* 4. J.A.R.V.I.S. comms console — the reasoning core speaks here. */}
      <JarvisConsole currentRegion={currentRegion} />
    </div>
  );
};

export default App;
