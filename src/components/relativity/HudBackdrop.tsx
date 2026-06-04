import React from 'react';

// ── HUD Backdrop ────────────────────────────────────────────────────────────
// A flat, screen-aligned, near-black backdrop that matches the "HUD Relativity"
// template: a faint perspective floor grid, a few very dim flat panel frames
// (full-screen UI outlines), and slow vertical data streams. No tilted 3D slab,
// no crossing orbit ellipses — the clean FUI panels are the star.

const C = 'rgba(88,198,222,';

// A dim, flat, notched panel outline used purely as background texture.
const GhostPanel: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <div
    className="absolute"
    style={{
      border: `1px solid ${C}0.10)`,
      clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
      ...style,
    }}
  />
);

const HudBackdrop: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 42%, #04121c 0%, #02080e 55%, #000206 100%)' }}>
    {/* dim flat panel frames echoing the template's full-screen UI outlines */}
    <GhostPanel style={{ top: '8%', left: '4%', width: '40%', height: '34%' }} />
    <GhostPanel style={{ top: '6%', right: '4%', width: '30%', height: '46%' }} />
    <GhostPanel style={{ bottom: '7%', left: '6%', width: '26%', height: '30%' }} />
    <GhostPanel style={{ bottom: '6%', right: '5%', width: '34%', height: '38%' }} />
    <GhostPanel style={{ top: '30%', left: '31%', width: '38%', height: '46%' }} />

    {/* faint flat overhead grid */}
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `linear-gradient(${C}0.05) 1px, transparent 1px), linear-gradient(90deg, ${C}0.05) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse at 50% 45%, #000 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 45%, #000 30%, transparent 80%)',
      }}
    />

    {/* perspective floor grid (lower third), like the template's ground plane */}
    <div className="absolute left-0 right-0 bottom-0 h-[42%]" style={{ perspective: '420px', perspectiveOrigin: '50% 0%' }}>
      <div
        className="absolute inset-0"
        style={{
          transform: 'rotateX(64deg)',
          transformOrigin: '50% 0%',
          backgroundImage: `linear-gradient(${C}0.16) 1px, transparent 1px), linear-gradient(90deg, ${C}0.10) 1px, transparent 1px)`,
          backgroundSize: '52px 52px',
          maskImage: 'linear-gradient(to bottom, transparent, #000 40%, #000)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 40%, #000)',
        }}
      />
    </div>

    {/* slow vertical data streams */}
    {[14, 27, 71, 86].map((left, i) => (
      <div
        key={i}
        className="absolute top-0 w-[1px] h-24"
        style={{
          left: `${left}%`,
          background: `linear-gradient(to bottom, transparent, ${C}0.5), transparent)`,
          animation: `hud-scanbar ${7 + i * 1.5}s linear infinite`,
          animationDelay: `${i * 1.3}s`,
        }}
      />
    ))}

    <div className="scanlines opacity-[0.12]" />
    <div className="vignette" />
  </div>
);

export default HudBackdrop;
