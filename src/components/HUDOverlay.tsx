import React, { useRef, useEffect, useState } from 'react';
import { HandTrackingState, RegionName } from '../types';
import { SoundService } from '../services/soundService';

interface HUDOverlayProps {
  handTrackingRef: React.MutableRefObject<HandTrackingState>;
  currentRegion: RegionName;
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

  const reticleRotationRef = useRef(0);
  const wasPinchingRef = useRef(false);

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
            SoundService.playLock();
            setShowIntelPanel(true);
        } else if (!isPinching && wasPinchingRef.current) {
            SoundService.playRelease();
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
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-20" />
      <div className="vignette"></div>
      <div className="scanlines z-10 opacity-50"></div>

      {/* --- INTERACTIVE FLOATING PANEL (PINCH) — wired to live telemetry --- */}
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
                                    className="bg-holo-cyan h-full shadow-[0_0_10px_#00F0FF] relative transition-all duration-150"
                                    style={{ width: `${panelData.signal}%` }}
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
