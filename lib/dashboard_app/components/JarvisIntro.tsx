
import React from 'react';

const JarvisIntro: React.FC = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black overflow-hidden">
      {/* Radial Gradient Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#002FA7]/30 via-black to-black"></div>
      
      {/* Central Composition */}
      <div className="relative flex items-center justify-center w-[600px] h-[600px]">
        
        {/* 1. Outer Thick Ring (Segmented) */}
        <div className="absolute inset-0 rounded-full border-[1px] border-holo-cyan/20 animate-spin-slow"></div>
        <div className="absolute inset-2 rounded-full border-t-[2px] border-b-[2px] border-l-transparent border-r-transparent border-holo-cyan/40 rotate-45 animate-spin-slow"></div>
        
        {/* 2. Middle Detailed Ring */}
        <div className="absolute inset-12 rounded-full border border-holo-cyan/30 border-dashed animate-spin-reverse-slow"></div>
        <div className="absolute inset-16 rounded-full border-2 border-t-holo-cyan/60 border-r-transparent border-b-holo-cyan/60 border-l-transparent animate-[spin_3s_linear_infinite]"></div>
        
        {/* 3. Inner Glow Ring */}
        <div className="absolute inset-24 rounded-full border-4 border-holo-cyan/10 animate-pulse shadow-[0_0_30px_rgba(0,240,255,0.2)]"></div>
        
        {/* 4. Core Text Container */}
        <div className="relative z-10 flex flex-col items-center justify-center transform transition-all duration-1000 scale-100">
            {/* Main Title */}
            <h1 className="jh-holo-flicker text-8xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-holo-cyan tracking-[0.15em] drop-shadow-[0_0_25px_rgba(0,240,255,0.8)] scale-y-90">
                JARVIS
            </h1>
            
            {/* Horizontal Glitch Line */}
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-holo-cyan/50 blur-[1px] animate-pulse"></div>
            
            {/* Subtitle */}
            <div className="mt-6 flex flex-col items-center gap-2">
                <div className="h-[1px] w-32 bg-holo-cyan/50"></div>
                <div className="text-2xl font-sans font-bold text-white tracking-[0.5em] drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                    SYSTEMS ONLINE — INITIALIZING
                </div>
                <div className="h-[1px] w-32 bg-holo-cyan/50"></div>
            </div>
        </div>

        {/* Particles/Dust overlay */}
        <div className="absolute inset-0 animate-pulse opacity-20"></div>
      </div>
    </div>
  );
};

export default JarvisIntro;
