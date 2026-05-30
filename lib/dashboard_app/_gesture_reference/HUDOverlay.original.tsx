import React, { useRef, useEffect, useState } from 'react';
import { HandTrackingState, RegionName } from '../types';
import { SoundService } from '../services/soundService';

interface HUDOverlayProps {
  handTrackingRef: React.MutableRefObject<HandTrackingState>;
  currentRegion: RegionName;
}

// --- Sub-Components for Static HUD Elements ---

const CircularGauge = ({ label, value, color = "text-holo-cyan" }: { label: string, value: string, color?: string }) => (
  <div className="relative w-32 h-32 flex items-center justify-center">
    {/* Outer Static Ring */}
    <div className={`absolute inset-0 border-2 ${color} opacity-30 rounded-full border-t-transparent border-l-transparent -rotate-45`}></div>
    {/* Inner Spinning Ring */}
    <div className={`absolute inset-2 border-2 ${color} opacity-60 rounded-full border-b-transparent border-r-transparent animate-spin-slow`}></div>
    {/* Core Value */}
    <div className="flex flex-col items-center">
      <span className={`text-2xl font-display font-bold ${color} drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]`}>{value}</span>
      <span className="text-[8px] uppercase tracking-widest opacity-70">{label}</span>
    </div>
  </div>
);

const FileTreeWidget = () => (
  <div className="flex flex-col gap-1 text-xs font-mono text-holo-cyan opacity-80 mt-4 border-l-2 border-holo-cyan/30 pl-3 py-2 relative">
    {/* Decorator Line Dots */}
    <div className="absolute -left-[5px] top-0 w-2 h-2 bg-holo-cyan rounded-full"></div>
    <div className="absolute -left-[5px] bottom-0 w-2 h-2 bg-holo-cyan rounded-full"></div>
    
    <div className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
      <span className="w-1.5 h-1.5 bg-holo-cyan rounded-full"></span>
      <span>RainMeter</span>
    </div>
    <div className="flex items-center gap-2 pl-4 cursor-pointer hover:text-white transition-colors">
       <span className="text-[8px]">▶</span> Resources
    </div>
    <div className="flex items-center gap-2 pl-8 cursor-pointer hover:text-white transition-colors">
       <span className="text-[8px]">▶</span> Browser
    </div>
    <div className="flex items-center gap-2 pl-8 cursor-pointer hover:text-white transition-colors">
       <span className="text-[8px]">▶</span> Themes
    </div>
    <div className="flex items-center gap-2 mt-2 cursor-pointer hover:text-white transition-colors">
      <span className="w-1.5 h-1.5 bg-alert-red rounded-full animate-pulse"></span>
      <span className="text-alert-red">Emergency</span>
    </div>
  </div>
);

const VisualsFrame = () => (
  <div className="relative w-48 border border-holo-cyan/40 p-1 bg-black/20 backdrop-blur-sm">
    {/* Corner Accents */}
    <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-holo-cyan"></div>
    <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-holo-cyan"></div>
    <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-holo-cyan"></div>
    
    <div className="flex justify-between items-center mb-1 px-1">
       <span className="text-[8px] uppercase text-holo-cyan tracking-widest">Visuals</span>
       <div className="flex gap-0.5">
          <div className="w-1 h-1 bg-holo-cyan"></div>
          <div className="w-1 h-1 bg-holo-cyan/50"></div>
       </div>
    </div>
    {/* Placeholder Image Grid */}
    <div className="h-24 w-full bg-[linear-gradient(45deg,transparent_25%,rgba(0,240,255,0.1)_25%,rgba(0,240,255,0.1)_50%,transparent_50%,transparent_75%,rgba(0,240,255,0.1)_75%,rgba(0,240,255,0.1)_100%)] bg-[length:10px_10px] border border-white/10 flex items-center justify-center">
       <span className="text-[8px] text-white/50 animate-pulse">STANDBY</span>
    </div>
  </div>
);

const ArcReactorWidget = () => (
  <div className="relative w-40 h-40 flex items-center justify-center">
      {/* Outer Thick Ring */}
      <div className="absolute inset-0 border-4 border-holo-cyan/20 rounded-full"></div>
      {/* Middle Rotating Ring */}
      <div className="absolute inset-2 border-[6px] border-transparent border-t-holo-cyan/40 border-l-holo-cyan/40 rounded-full animate-spin-slow"></div>
      {/* Inner Fast Ring */}
      <div className="absolute inset-8 border-2 border-dashed border-white/30 rounded-full animate-spin-reverse-slow"></div>
      {/* Center Core */}
      <div className="absolute w-12 h-12 bg-holo-cyan/10 rounded-full border border-holo-cyan flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)]">
          <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
      </div>
  </div>
);

const FeedList = () => {
    const items = ["gmail", "wikipedia", "da-rainmeter", "lifehacker", "gizmodo", "kotaku", "twitter"];
    return (
        <div className="text-right space-y-1">
            {items.map((item, i) => (
                <div key={item} className="flex items-center justify-end gap-2 text-[10px] font-mono text-holo-cyan/70 hover:text-holo-cyan hover:scale-105 transition-all cursor-pointer group">
                    <span className="uppercase tracking-wider">{item}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${i % 2 === 0 ? 'bg-holo-cyan shadow-[0_0_5px_#00F0FF]' : 'bg-gray-600 group-hover:bg-holo-cyan'}`}></div>
                </div>
            ))}
        </div>
    )
}


const HUDOverlay: React.FC<HUDOverlayProps> = ({ handTrackingRef, currentRegion }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  
  // UI State for Floating Panel
  const [showIntelPanel, setShowIntelPanel] = useState(false);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  
  const [hexDump, setHexDump] = useState<string[]>([]);
  const [time, setTime] = useState('');
  
  const reticleRotationRef = useRef(0);
  const wasPinchingRef = useRef(false);

  // Hex Dump & Time Effect
  useEffect(() => {
    const interval = setInterval(() => {
      const chars = '0123456789ABCDEF';
      const line = '0x' + Array(8).fill(0).map(() => chars[Math.floor(Math.random() * 16)]).join('');
      setHexDump(prev => [line, ...prev.slice(0, 12)]);
    }, 80);
    
    const timeInterval = setInterval(() => {
        const now = new Date();
        setTime(now.toLocaleTimeString('zh-CN', { hour12: false }) + `.${now.getMilliseconds().toString().padStart(3, '0')}`);
    }, 50);

    return () => {
        clearInterval(interval);
        clearInterval(timeInterval);
    }
  }, []);

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
          const label = isRight ? 'ID: 右手-01' : 'ID: 左手-02';
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
          // Map 0-1 to angle
          const startAngle = -Math.PI / 2;
          const endAngle = startAngle + (exp * Math.PI * 2);
          ctx.arc(gaugeX, gaugeY, 40, startAngle, endAngle);
          ctx.strokeStyle = gaugeColor;
          ctx.lineWidth = isMaxed ? 6 : 4; // Thicker when maxed
          if (isMaxed) {
              ctx.shadowColor = '#FF2A2A';
              ctx.shadowBlur = 15;
          } else {
              ctx.shadowBlur = 0;
          }
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset

          // Text
          ctx.fillStyle = gaugeColor;
          ctx.font = isMaxed ? 'bold 14px "Orbitron"' : 'bold 12px "Orbitron"';
          ctx.textAlign = 'center';
          ctx.fillText(isMaxed ? "最大输出" : "解除限制", gaugeX, gaugeY - 10);
          ctx.fillText(`${Math.round(exp * 100)}%`, gaugeX, gaugeY + 15);
          ctx.textAlign = 'left'; // Reset
          
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
        
        // Handle State Transition for Sound
        if (isPinching && !wasPinchingRef.current) {
            SoundService.playLock();
            setShowIntelPanel(true);
        } else if (!isPinching && wasPinchingRef.current) {
            SoundService.playRelease();
            setShowIntelPanel(false);
        }
        wasPinchingRef.current = isPinching;

        // Update Panel Position logic
        if (isPinching) {
            const indexTip = hands.rightHand.landmarks[8];
            const cursorX = (1 - indexTip.x) * canvas.width;
            const cursorY = indexTip.y * canvas.height;
            setPanelPos({ x: cursorX + 50, y: cursorY - 100 });
            
            // Connector Line from Hand to Panel
            ctx.beginPath();
            ctx.moveTo(cursorX, cursorY);
            ctx.lineTo(cursorX + 50, cursorY - 100); // Connects to top-left of where panel div renders
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Draw Pinch Reticle
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
          // If hand lost, hide panel
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
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-20" />
      <div className="vignette"></div>
      <div className="scanlines z-10 opacity-50"></div>

      {/* --- TOP HEADER --- */}
      
      {/* Top Left: System Status */}
      <div className="absolute top-8 left-8 z-30 flex flex-col gap-2 animate-pulse-fast">
        <div className="border-l-4 border-holo-cyan pl-4 bg-black/40 p-2 backdrop-blur-sm rounded-r-lg shadow-[0_0_15px_rgba(0,240,255,0.3)]">
          <h2 className="text-xl font-display font-bold text-white tracking-widest">斯塔克工业</h2>
          <div className="h-[1px] w-32 bg-holo-cyan my-1"></div>
          <div className="text-xs text-holo-blue font-mono opacity-80">MARK VII HUD 固件 V8.0.3</div>
        </div>
        <div className="font-mono text-[10px] text-klein-blue opacity-60 leading-tight h-24 overflow-hidden">
          {hexDump.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      </div>

      {/* Top Right: Title & Clock */}
      <div className="absolute top-8 right-8 z-30 text-right">
        <h1 className="text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-holo-blue drop-shadow-[0_0_15px_rgba(0,240,255,0.9)] tracking-tighter">
          J.A.R.V.I.S.
        </h1>
        <div className="text-2xl font-mono text-holo-cyan mt-[-5px] tracking-widest flex justify-end items-center gap-4">
            <span className="animate-blink text-alert-red text-xs border border-alert-red px-2 py-0.5 rounded bg-alert-red/10">实时画面</span>
            {time}
        </div>
      </div>


      {/* --- LEFT SIDE PANELS --- */}

      {/* Left Panel 1: Power/Storage Gauge */}
      <div className="absolute left-16 top-1/3 transform -translate-y-1/2 z-30 flex flex-col gap-8">
         <CircularGauge label="Primary Storage" value="74%" />
         <CircularGauge label="Power Cells" value="98%" color="text-holo-blue" />
      </div>

      {/* Left Panel 2: File Explorer (Bottom Left) */}
      <div className="absolute bottom-32 left-8 z-30">
           <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Directory</div>
           <FileTreeWidget />
           
           {/* Status Widget below tree */}
           <div className="mt-8 bg-black/60 border-t border-l border-holo-blue p-4 rounded-tr-xl backdrop-blur-md w-64 relative">
                <div className="absolute top-0 right-0 w-2 h-2 bg-holo-cyan shadow-[0_0_10px_#00F0FF]"></div>
                <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-700 pb-1">生物识别输入</div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-holo-cyan text-sm font-bold">左手操控模组</span>
                        <span className={`text-xs px-2 rounded ${handTrackingRef.current.leftHand ? 'bg-holo-cyan text-black' : 'bg-red-900/50 text-red-500'}`}>
                             {handTrackingRef.current.leftHand ? '在线' : '离线'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-holo-cyan text-sm font-bold">右手交互模组</span>
                        <span className={`text-xs px-2 rounded ${handTrackingRef.current.rightHand ? 'bg-holo-cyan text-black' : 'bg-red-900/50 text-red-500'}`}>
                             {handTrackingRef.current.rightHand ? '在线' : '离线'}
                        </span>
                    </div>
                </div>
           </div>
      </div>


      {/* --- RIGHT SIDE PANELS --- */}

      {/* Right Panel 1: Visuals Frame (Top Right, below title) */}
      <div className="absolute right-10 top-40 z-30">
          <VisualsFrame />
      </div>

      {/* Right Panel 2: Arc Reactor / Compass (Middle Right) */}
      <div className="absolute right-16 top-1/2 transform -translate-y-1/2 z-30">
           <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-holo-cyan/70 border-b border-holo-cyan/30 pb-1 w-full text-center">Atmosphere</div>
                <ArcReactorWidget />
                <div className="flex justify-between w-full px-2 text-[8px] font-mono text-holo-cyan/50">
                    <span>O2: 98%</span>
                    <span>TEMP: 24°C</span>
                </div>
           </div>
      </div>

      {/* Right Panel 3: Data Feed (Bottom Right) */}
      <div className="absolute bottom-32 right-8 z-30 flex flex-col items-end gap-2">
           <div className="text-[10px] uppercase tracking-widest text-holo-blue border-b-2 border-holo-blue/30 pb-1 mb-2 pr-4">Communication Feed</div>
           <FeedList />
           <div className="mt-4 w-48 h-1 bg-gray-800 rounded overflow-hidden">
                <div className="h-full bg-holo-cyan/50 animate-pulse w-[60%]"></div>
           </div>
      </div>

      {/* --- INTERACTIVE FLOATING PANEL (PINCH) --- */}
      {showIntelPanel && (
          <div 
            className="absolute z-40 animate-flash origin-top-left"
            style={{ 
                left: panelPos.x,
                top: panelPos.y,
                width: '300px'
            }}
          >
            <div className="bg-black/80 border-l-2 border-alert-red shadow-[0_0_40px_rgba(255,42,42,0.3)] backdrop-blur-xl p-1 rounded-r-lg">
                <div className="flex justify-between items-center bg-gradient-to-r from-alert-red/50 to-transparent p-2 mb-2 border-b border-white/10">
                    <span className="font-display font-bold text-sm tracking-widest text-white">GEO_INTEL_LIVE</span>
                    <div className="w-2 h-2 bg-alert-red rounded-full animate-ping"></div>
                </div>

                <div className="p-4 space-y-4">
                    <div className="flex justify-between items-end">
                        <div className="text-xs text-holo-blue uppercase">目标区域</div>
                        <div className="text-2xl font-display text-white font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
                            {currentRegion}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] uppercase text-gray-400">
                                <span>信号强度</span>
                                <span>98%</span>
                            </div>
                            <div className="w-full bg-gray-900 h-1.5 overflow-hidden rounded-sm">
                                <div className="bg-holo-cyan h-full w-[98%] shadow-[0_0_10px_#00F0FF] relative">
                                    <div className="absolute top-0 left-0 h-full w-full bg-white/30 animate-[scanline_1s_linear_infinite]"></div>
                                </div>
                            </div>
                        </div>
                        
                         <div className="grid grid-cols-2 gap-2 mt-2">
                             <div className="bg-white/5 p-1 text-center border border-white/10">
                                 <div className="text-[8px] text-gray-400">经度</div>
                                 <div className="font-mono text-xs text-holo-cyan">116.4074</div>
                             </div>
                             <div className="bg-white/5 p-1 text-center border border-white/10">
                                 <div className="text-[8px] text-gray-400">纬度</div>
                                 <div className="font-mono text-xs text-holo-cyan">39.9042</div>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
            {/* Decorator Lines */}
            <svg className="absolute -left-4 top-0 w-4 h-full overflow-visible">
                 <path d="M 4,0 L 0,10 L 0,150" fill="none" stroke="#FF2A2A" strokeWidth="1" />
            </svg>
          </div>
      )}
    </div>
  );
};

export default HUDOverlay;