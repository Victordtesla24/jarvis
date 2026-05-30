
import React, { useState, useEffect, useRef } from 'react';
import { JarvisMode, Message } from './types';
import { initializeChat, sendMessageToJarvis, analyzeImage, speakText } from './services/jarvisService';
import { initializeGestureRecognizer, predictGestures } from './services/gestureService';
import ArcReactor from './components/ArcReactor';
import Terminal from './components/Terminal';
import SystemMonitor from './components/SystemMonitor';
import { Camera, Mic, MapPin, Clock, Globe, Volume2, VolumeX, Eye, EyeOff, Radio, Hand, Octagon, Scissors } from 'lucide-react';

// Linear Interpolation for smooth animation
const lerp = (start: number, end: number, factor: number) => {
  return start + (end - start) * factor;
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'PROTOCOL INITIATED. J.A.R.V.I.S. ONLINE.', timestamp: new Date() }
  ]);
  const [mode, setMode] = useState<JarvisMode>(JarvisMode.IDLE);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  
  // Mouse/Hand Position State (for rendering)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const [gestureControlActive, setGestureControlActive] = useState(false);
  const [detectedGesture, setDetectedGesture] = useState<string>('None');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  // Refs for Smoothing and Debouncing
  const targetPos = useRef({ x: 0, y: 0 }); // Where the hand actually is
  const currentPos = useRef({ x: 0, y: 0 }); // Where the cursor is currently (for smoothing)
  const gestureBuffer = useRef<{ name: string; count: number }>({ name: 'None', count: 0 }); // For stabilizing gestures

  useEffect(() => {
    initializeChat();
    // Initialize Gesture Recognizer in background
    initializeGestureRecognizer();
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Camera Logic & Gesture Loop
  useEffect(() => {
    const startCamera = async () => {
      if (cameraActive) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 1280, height: 720 } });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            
            // Start detection loop once video plays
            videoRef.current.onloadeddata = () => {
              predictLoop();
            };
          }
        } catch (err) {
          console.warn("Camera access denied", err);
          setCameraActive(false);
          const errorMsg: Message = { role: 'model', text: 'VISUAL SENSORS OFFLINE. CAMERA ACCESS DENIED.', timestamp: new Date() };
          setMessages(prev => [...prev, errorMsg]);
        }
      } else {
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }
        setGestureControlActive(false);
      }
    };
    startCamera();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [cameraActive]);

  const predictLoop = () => {
    if (videoRef.current && canvasRef.current && cameraActive) {
      const results = predictGestures(videoRef.current);
      
      // 1. Process Raw Data
      processGestureData(results);
      
      // 2. Render Visuals
      drawGestureResults(results);
      
      requestRef.current = requestAnimationFrame(predictLoop);
    }
  };

  const processGestureData = (results: any) => {
    if (results && results.landmarks && results.landmarks.length > 0) {
      setGestureControlActive(true);
      const landmarks = results.landmarks[0];
      
      // Calculate Target Position (Index 9 is Middle Finger MCP - stable center point)
      // Mirror X coordinate because webcam is mirrored
      const rawX = (1 - landmarks[9].x) * 2 - 1; 
      const rawY = (landmarks[9].y * 2 - 1);
      
      targetPos.current = { x: rawX, y: rawY };

      // Process Gesture Stability (Debounce)
      if (results.gestures && results.gestures.length > 0) {
        const topGesture = results.gestures[0][0];
        const name = topGesture.categoryName;
        const score = topGesture.score;

        if (score > 0.6) { // Higher confidence threshold
          if (gestureBuffer.current.name === name) {
            gestureBuffer.current.count++;
          } else {
            gestureBuffer.current = { name: name, count: 1 };
          }
        } else {
           gestureBuffer.current.count = 0; // Reset if low confidence
        }
      } else {
        gestureBuffer.current.count = 0;
      }
      
      // Only switch gesture state if we have 5 consecutive frames (approx 80-100ms)
      // This prevents flickering "None" -> "Open_Palm" -> "None"
      if (gestureBuffer.current.count > 4) {
        setDetectedGesture(gestureBuffer.current.name);
      } else if (gestureBuffer.current.count === 0) {
        setDetectedGesture('None');
      }

    } else {
      setGestureControlActive(false);
      setDetectedGesture('None');
      // If hand lost, slowly drift target back to center or last known?
      // For now, let's keep target where it was or zero it
      // targetPos.current = { x: 0, y: 0 }; 
    }

    // 3. Smooth Interpolation (LERP)
    // Apply smoothing regardless of whether hand is currently detected to avoid snapping
    const smoothFactor = 0.15; // Lower = smoother but more lag, Higher = snappier but jittery
    currentPos.current.x = lerp(currentPos.current.x, targetPos.current.x, smoothFactor);
    currentPos.current.y = lerp(currentPos.current.y, targetPos.current.y, smoothFactor);

    // Update React State for UI rendering
    setMousePos({ ...currentPos.current });
  };

  const drawGestureResults = (results: any) => {
    if (!canvasRef.current || !videoRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Match canvas size to video size
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    if (results && results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];

      // Draw Connectors
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#06b6d4"; // Cyan
      ctx.shadowColor = "#06b6d4";
      ctx.shadowBlur = 10;
      
      // Helper to draw lines
      const drawLine = (startIdx: number, endIdx: number) => {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];
        ctx.beginPath();
        ctx.moveTo(start.x * canvasRef.current!.width, start.y * canvasRef.current!.height);
        ctx.lineTo(end.x * canvasRef.current!.width, end.y * canvasRef.current!.height);
        ctx.stroke();
      };

      // Draw Hand Wireframe
      // Thumb
      drawLine(0, 1); drawLine(1, 2); drawLine(2, 3); drawLine(3, 4);
      // Index
      drawLine(0, 5); drawLine(5, 6); drawLine(6, 7); drawLine(7, 8);
      // Middle
      drawLine(0, 9); drawLine(9, 10); drawLine(10, 11); drawLine(11, 12);
      // Ring
      drawLine(0, 13); drawLine(13, 14); drawLine(14, 15); drawLine(15, 16);
      // Pinky
      drawLine(0, 17); drawLine(17, 18); drawLine(18, 19); drawLine(19, 20);
      // Palm Base
      drawLine(5, 9); drawLine(9, 13); drawLine(13, 17); drawLine(0, 17);

      // Draw Landmarks
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0; // Reset shadow for dots
      for (const landmark of landmarks) {
        ctx.beginPath();
        ctx.arc(landmark.x * canvasRef.current.width, landmark.y * canvasRef.current.height, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  };

  // Fallback Mouse Tracking (only if gesture not active)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (gestureControlActive) return; // Ignore mouse if hand is controlling
      // Normalize mouse position from -1 to 1
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      
      // For mouse, we can update directly, or update target for consistent smoothing
      targetPos.current = { x, y };
      // Force direct update for instant mouse feel if needed, or rely on the loop if we were running it always.
      // Since loop only runs when camera is active, we update state directly here.
      if (!cameraActive) {
         setMousePos({ x, y });
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [gestureControlActive, cameraActive]);

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { role: 'user', text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setMode(JarvisMode.PROCESSING);
    setMessages(prev => [...prev, { role: 'model', text: '', timestamp: new Date() }]);

    let accumulatedText = '';
    try {
      await sendMessageToJarvis(text, (chunkText) => {
        setMessages(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = {
            ...newHistory[newHistory.length - 1],
            text: chunkText
          };
          return newHistory;
        });
        accumulatedText = chunkText;
      });

      if (voiceEnabled && accumulatedText) {
        setMode(JarvisMode.SPEAKING);
        await speakText(accumulatedText);
        setMode(JarvisMode.IDLE);
      } else {
        setMode(JarvisMode.IDLE);
      }
    } catch (error) {
       console.error(error);
       setMode(JarvisMode.IDLE);
    }
  };

  const handleFileUpload = async (file: File) => {
    setMode(JarvisMode.ANALYZING);
    const userMsg: Message = { role: 'user', text: `[ANALYZING TARGET: ${file.name}]`, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1];
      const responseText = await analyzeImage(base64Data);
      
      const aiMsg: Message = { role: 'model', text: responseText, timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
      
      if (voiceEnabled && responseText) {
        setMode(JarvisMode.SPEAKING);
        await speakText(responseText);
      }
      setMode(JarvisMode.IDLE);
    };
    reader.readAsDataURL(file);
  };

  // Compute effectively mode based on gesture override
  const effectiveMode = 
    detectedGesture === 'Open_Palm' ? JarvisMode.ANALYZING : // Expand reactor
    detectedGesture === 'Closed_Fist' ? JarvisMode.IDLE :   // Contract/Calm
    mode;

  // Interaction distance override
  const effectiveDistance = gestureControlActive ? 0 : Math.sqrt(mousePos.x ** 2 + mousePos.y ** 2);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-void text-cyan-400 selection:bg-cyan-500/30 selection:text-white font-rajdhani">
      
      {/* Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {cameraActive ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-30 grayscale contrast-125 transform scale-x-[-1]" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover opacity-60 transform scale-x-[-1]" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-40">
            <div className="text-cyan-900/20 font-hud text-9xl animate-pulse select-none">OFFLINE</div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-80"></div>
        <div className="absolute inset-0 hex-grid opacity-20"></div>
      </div>

      {/* Screen Effects */}
      <div className="scanline"></div>
      <div className="absolute inset-0 border-[20px] border-cyan-500/5 rounded-[3rem] pointer-events-none z-50"></div>

      {/* Gesture Feedback HUD Layer */}
      <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
        
        {/* 1. Floating Hand Tracking Label */}
        {gestureControlActive && (
          <div 
            className="absolute transition-all duration-75 ease-out will-change-transform"
            style={{ 
              // Use mousePos (which is now smoothed) for the UI overlay position
              left: `${(mousePos.x + 1) * 50}%`, 
              top: `${(mousePos.y + 1) * 50}%`,
            }}
          >
             <div className={`
               flex items-center gap-2 ml-6 -mt-6 
               transition-all duration-300 transform
               ${detectedGesture !== 'None' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}
             `}>
                <div className="h-[1px] w-8 bg-fuchsia-500/60"></div>
                <div className="bg-black/80 backdrop-blur border border-fuchsia-500/50 px-3 py-1.5 rounded-br-lg rounded-tl-lg shadow-[0_0_15px_rgba(217,70,239,0.3)] flex items-center gap-2">
                  {detectedGesture === 'Open_Palm' && <Hand size={14} className="text-fuchsia-400" />}
                  {detectedGesture === 'Closed_Fist' && <Octagon size={14} className="text-fuchsia-400" />}
                  {detectedGesture === 'Victory' && <Scissors size={14} className="text-fuchsia-400 rotate-[-90deg]" />}
                  <span className="text-fuchsia-300 font-hud text-[10px] tracking-widest whitespace-nowrap uppercase">
                    {detectedGesture.replace('_', ' ')} DETECTED
                  </span>
                </div>
             </div>
          </div>
        )}

        {/* 2. Static Gesture List (Top Right) */}
        <div className="absolute top-24 right-6 flex flex-col gap-1.5 items-end opacity-80">
          <div className="text-[10px] text-cyan-600 font-mono-tech tracking-widest mb-1 border-b border-cyan-800/30 pb-1">
            GESTURE_LIBRARY.DLL
          </div>
          
          {[
            { id: 'Open_Palm', label: 'ACTIVATE', icon: Hand },
            { id: 'Closed_Fist', label: 'STANDBY', icon: Octagon },
            { id: 'Victory', label: 'CALIBRATE', icon: Scissors }
          ].map(g => (
            <div 
              key={g.id}
              className={`
                flex items-center gap-3 px-3 py-1.5 border-r-2 transition-all duration-300 w-40 justify-end
                ${detectedGesture === g.id 
                  ? 'bg-fuchsia-900/20 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.2)]' 
                  : 'bg-transparent border-cyan-900/30 opacity-40'}
              `}
            >
              <span className={`text-[10px] font-mono-tech tracking-wider ${detectedGesture === g.id ? 'text-fuchsia-300' : 'text-cyan-700'}`}>
                {g.label}
              </span>
              <g.icon 
                size={14} 
                className={`
                  ${detectedGesture === g.id ? 'text-fuchsia-400 animate-pulse' : 'text-cyan-800'}
                  ${g.id === 'Victory' ? '-rotate-90' : ''}
                `} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* Main HUD */}
      <div className="relative z-20 flex flex-col h-full p-4 md:p-8">
        
        {/* Top Header */}
        <div className="flex justify-between items-start mb-4 border-t-2 border-cyan-500/30 pt-2 relative">
          <div className="absolute top-0 left-0 w-32 h-1 bg-cyan-400 shadow-[0_0_10px_#06b6d4]"></div>
          <div className="absolute top-0 right-0 w-32 h-1 bg-cyan-400 shadow-[0_0_10px_#06b6d4]"></div>
          
          <div className="flex flex-col">
            <h1 className="text-4xl font-hud font-bold tracking-[0.2em] text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.8)] italic">
              J.A.R.V.I.S.
            </h1>
            <span className="text-xs text-cyan-600 tracking-[0.4em] font-mono-tech uppercase mt-1">
              System UI v34.5 // <span className="text-yellow-500">MK-85</span>
            </span>
          </div>
          
          <div className="flex items-center space-x-6 text-cyan-300 font-mono-tech text-xs md:text-sm">
             <div className="hidden md:flex items-center gap-2 bg-black/40 px-3 py-1 border border-cyan-900/50 rounded cyber-panel">
               <Globe size={14} className="animate-pulse text-cyan-400" />
               <span>SAT-LINK: <span className="text-green-400">SECURE</span></span>
             </div>
             
             <div className="flex items-center gap-4">
               {gestureControlActive && (
                  <div className="flex items-center gap-2 text-fuchsia-400 animate-pulse border border-fuchsia-500/30 px-2 py-0.5 rounded bg-fuchsia-950/20">
                    <Hand size={14} />
                    <span>GESTURE: ACTIVE</span>
                  </div>
               )}

               <button 
                  onClick={() => setCameraActive(!cameraActive)}
                  className={`flex items-center gap-2 px-3 py-1 border transition-all duration-300 ${cameraActive ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300' : 'border-red-900/50 bg-red-900/10 text-red-700'}`}
               >
                 {cameraActive ? <Eye size={16} /> : <EyeOff size={16} />}
                 <span className="hidden sm:inline">VISUAL</span>
               </button>

               <button 
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`flex items-center gap-2 px-3 py-1 border transition-all duration-300 ${voiceEnabled ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300' : 'border-cyan-900/50 bg-black/40 text-cyan-700'}`}
               >
                 {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                 <span className="hidden sm:inline">AUDIO</span>
               </button>
             </div>
          </div>
        </div>

        {/* Middle Content */}
        <div className="flex-1 flex gap-6 overflow-hidden relative">
          
          {/* Left Panel: System Stats */}
          <div className="hidden lg:flex flex-col w-72 gap-4">
            <div className="bg-black/40 backdrop-blur-md p-1 cyber-panel border-l-4 border-cyan-500/50">
              <div className="bg-cyan-900/10 p-4 h-full">
                <div className="flex justify-between items-center border-b border-cyan-500/20 pb-2 mb-4">
                   <h3 className="text-cyan-400 font-hud text-xs tracking-widest">SYSTEM_DIAGNOSTICS</h3>
                   <Radio size={14} className="text-red-500 animate-pulse" />
                </div>
                <SystemMonitor />
              </div>
            </div>
            
            {/* Audio Viz */}
            <div className="flex-1 bg-black/40 backdrop-blur-md p-1 cyber-panel-reverse border-r-4 border-cyan-500/50 relative overflow-hidden">
               <div className="absolute inset-0 hex-grid opacity-30"></div>
               <div className="relative z-10 flex flex-col justify-end h-full p-4">
                 <div className="flex items-end gap-1 h-32 opacity-80">
                  {[...Array(20)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`flex-1 ${mode === JarvisMode.SPEAKING ? 'bg-cyan-300 shadow-[0_0_10px_#06b6d4]' : 'bg-cyan-900/40'}`}
                      style={{ 
                        height: mode === JarvisMode.SPEAKING ? `${Math.random() * 100}%` : `${Math.random() * 20 + 5}%`,
                        transition: 'height 0.05s ease'
                      }} 
                    />
                  ))}
                 </div>
                 <div className="text-[10px] font-mono-tech text-cyan-600 mt-2 flex justify-between">
                   <span>FREQ: 24.5Ghz</span>
                   <span>DB: -12</span>
                 </div>
               </div>
            </div>
          </div>

          {/* Center: Arc Reactor Hologram */}
          <div className="flex-1 flex flex-col items-center justify-center relative perspective-1000">
             
             {/* Reticle Lines */}
             <div className="absolute inset-0 pointer-events-none">
               <div className="absolute top-1/2 left-10 w-24 h-[1px] bg-cyan-500/30"></div>
               <div className="absolute top-1/2 right-10 w-24 h-[1px] bg-cyan-500/30"></div>
               <div className="absolute top-10 left-1/2 w-[1px] h-24 bg-cyan-500/30"></div>
               <div className="absolute bottom-10 left-1/2 w-[1px] h-24 bg-cyan-500/30"></div>
               
               {/* Corner Brackets */}
               <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-cyan-500/50 rounded-tl-lg"></div>
               <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-cyan-500/50 rounded-tr-lg"></div>
               <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-cyan-500/50 rounded-bl-lg"></div>
               <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-cyan-500/50 rounded-br-lg"></div>
             </div>
             
             {/* The Reactive Component */}
             <div 
               className="transition-transform duration-75 ease-out"
               style={{ 
                 // Use smooth mousePos state
                 transform: `rotateX(${-mousePos.y * 10}deg) rotateY(${mousePos.x * 10}deg) scale(${1 + Math.abs(mousePos.x * 0.05)})` 
               }}
             >
               <ArcReactor 
                 mode={effectiveMode === JarvisMode.SPEAKING ? 'speaking' : effectiveMode === JarvisMode.PROCESSING ? 'processing' : effectiveMode === JarvisMode.ANALYZING ? 'active' : 'idle'} 
                 mouseDistance={effectiveDistance}
               />
             </div>
             
             <div className="mt-12 flex flex-col items-center gap-2">
                {effectiveMode !== JarvisMode.IDLE && (
                   <div className="bg-black/60 px-4 py-1 border border-cyan-500 text-cyan-300 font-mono-tech text-sm tracking-widest animate-pulse cyber-panel">
                     {effectiveMode === JarvisMode.PROCESSING && 'UPLOADING TO MAINFRAME...'}
                     {effectiveMode === JarvisMode.ANALYZING && 'SCANNING VISUAL DATA...'}
                     {effectiveMode === JarvisMode.SPEAKING && 'AUDIO OUTPUT STREAMING...'}
                   </div>
                )}
             </div>
          </div>

          {/* Right Panel: Terminal */}
          <div className="w-full md:w-96 flex flex-col relative z-30">
            <Terminal 
              messages={messages} 
              onSendMessage={handleSendMessage} 
              onFileUpload={handleFileUpload}
              isProcessing={effectiveMode === JarvisMode.PROCESSING || effectiveMode === JarvisMode.ANALYZING}
            />
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="mt-4 pt-2 border-t border-cyan-500/20 flex justify-between items-end text-xs font-mono-tech text-cyan-600/80">
           <div className="flex gap-6">
             <div className="flex flex-col">
               <span className="text-[10px] uppercase">Memory</span>
               <span className="text-cyan-400">64TB / 128TB</span>
             </div>
             <div className="flex flex-col">
               <span className="text-[10px] uppercase">Uptime</span>
               <span className="text-cyan-400">428:12:09</span>
             </div>
             <div className="hidden sm:flex flex-col">
               <span className="text-[10px] uppercase">Location</span>
               <span className="text-cyan-400 flex items-center gap-1"><MapPin size={10}/> MALIBU POINT, 90265</span>
             </div>
           </div>
           
           <div className="text-right">
             <div className="text-cyan-800 text-[10px] tracking-[0.2em] uppercase mb-1">Stark Industries Confidential</div>
             <div className="h-1 w-32 bg-cyan-900/30 rounded-full overflow-hidden ml-auto">
               <div className="h-full bg-cyan-500 animate-pulse w-2/3"></div>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default App;
