import React from 'react';

interface ArcReactorProps {
  mode: 'idle' | 'processing' | 'active' | 'warning' | 'speaking';
  mouseDistance?: number;
}

const ArcReactor: React.FC<ArcReactorProps> = ({ mode, mouseDistance = 1 }) => {
  // Determine if the user is "interacting" (mouse close to center)
  const isInteracting = mouseDistance < 0.3;
  const scale = isInteracting ? 1.2 : 1;
  const speedMultiplier = isInteracting ? 0.2 : 1;

  const getColor = () => {
    switch (mode) {
      case 'warning': return 'text-red-500 shadow-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]';
      case 'processing': return 'text-fuchsia-400 shadow-fuchsia-400 drop-shadow-[0_0_15px_rgba(192,132,252,0.8)]';
      case 'active': return 'text-cyan-300 shadow-cyan-300 drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]';
      case 'speaking': return 'text-white shadow-cyan-200 drop-shadow-[0_0_20px_rgba(255,255,255,0.9)]';
      default: return 'text-cyan-500 shadow-cyan-500 drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]';
    }
  };

  const colorClass = getColor();
  const strokeColor = mode === 'warning' ? '#ef4444' : mode === 'processing' ? '#e879f9' : mode === 'speaking' ? '#ffffff' : '#06b6d4';
  const pulseClass = mode === 'speaking' ? 'animate-pulse duration-75' : 'animate-pulse';
  const secondaryColor = mode === 'processing' ? '#86198f' : '#155e75';

  return (
    <div 
      className={`relative flex items-center justify-center w-80 h-80 transition-all duration-700 ease-out`}
      style={{ transform: `scale(${scale})` }}
    >
      {/* Outer Ring - Dashed */}
      <div 
        className={`absolute w-full h-full border-[1px] border-dashed rounded-full opacity-30 ${colorClass.split(' ')[0]}`}
        style={{ animation: `spin-slow ${20 * speedMultiplier}s linear infinite` }}
      ></div>
      
      {/* Middle Tech Ring */}
      <div 
        className={`absolute w-64 h-64 border-[4px] border-transparent border-t-${mode === 'warning' ? 'red' : 'cyan'}-500/40 border-b-${mode === 'warning' ? 'red' : 'cyan'}-500/40 rounded-full opacity-60 ${colorClass.split(' ')[0]}`}
        style={{ animation: `spin-reverse-slow ${15 * speedMultiplier}s linear infinite` }}
      ></div>

      {/* Decorative Rotating Segments (The "Gears") */}
      <div 
         className={`absolute w-72 h-72 rounded-full border border-transparent border-l-2 border-r-2 ${colorClass.split(' ')[0]} opacity-40`}
         style={{ animation: `spin-slow ${10 * speedMultiplier}s linear infinite` }}
      ></div>
      
      {/* Inner Core SVG */}
      <div className="relative z-10 filter drop-shadow-lg">
        <svg width="140" height="140" viewBox="0 0 100 100" className={`${pulseClass} ${colorClass.split(' ')[0]} overflow-visible`}>
          {/* Central Triangle/Geometry */}
          <path d="M50 15 L85 75 L15 75 Z" stroke={strokeColor} strokeWidth="0.5" fill="none" className="animate-pulse" opacity="0.5" />
          <circle cx="50" cy="50" r="35" stroke={strokeColor} strokeWidth="3" fill="none" strokeDasharray="10 5" opacity="0.8" className="animate-spin-slow" style={{ transformOrigin: 'center' }}/>
          <circle cx="50" cy="50" r="25" stroke={secondaryColor} strokeWidth="1" fill="none" opacity="0.6" />
          <circle cx="50" cy="50" r="8" fill={strokeColor} fillOpacity="0.9" />
          
          {/* Crosshairs */}
          <line x1="50" y1="0" x2="50" y2="100" stroke={strokeColor} strokeWidth="0.5" opacity="0.3" />
          <line x1="0" y1="50" x2="100" y2="50" stroke={strokeColor} strokeWidth="0.5" opacity="0.3" />
        </svg>
      </div>

      {/* Holographic Projection Layers (Only visible when interacting or active) */}
      {(isInteracting || mode !== 'idle') && (
        <>
          <div className="absolute w-96 h-96 rounded-full border border-cyan-500/10 animate-ping opacity-20"></div>
          <div className="absolute w-[110%] h-[110%] rounded-full border border-dashed border-cyan-500/20 animate-spin-slow opacity-10"></div>
        </>
      )}
      
      {/* Speaking Ping */}
      {mode === 'speaking' && (
         <div className="absolute w-full h-full rounded-full border-8 border-white opacity-10 animate-ping"></div>
      )}
    </div>
  );
};

export default ArcReactor;