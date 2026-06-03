import React, { useEffect, useMemo, useState } from 'react';

// ── Reactor Core HUD ────────────────────────────────────────────────────────
// A faithful synthesis of the "HUD Relativity" core dials at 1:15, 1:20 and 1:36,
// built as the dashboard centrepiece. Outer-to-inner:
//   • node-studded outer ring (slow rotation) with faint partial outer arcs
//   • four cardinal connector arms to labelled LOC_F.xx nodes (static, readable)
//   • a dense rotating technical field: tick ring, radial spokes, registration marks
//   • a green ANALYSIS progress arc along the left perimeter + count-up percentage
//   • broken arcs wrapping a dark central hub, rotating in opposition
//   • a luminous pulsing core + ONLINE badge and X·Y crosshair
// Cyan/white structure with green accents; pointer-transparent, centred.

const C = '#58C6DE';
const CB = '#9BEAF6';
const WHT = '#DCEFF6';
const GRN = '#39E1F2'; // holographic cyan accent (unified palette)
const DIM = 'rgba(120,200,222,0.22)';
const FAINT = 'rgba(120,200,222,0.10)';

const SIZE = 560;
const O = SIZE / 2;

// point at radius r, deg measured clockwise from 12 o'clock
function pt(r: number, deg: number): [number, number] {
  const a = (deg - 90) * (Math.PI / 180);
  return [O + Math.cos(a) * r, O + Math.sin(a) * r];
}
const P = (r: number, deg: number) => pt(r, deg).map((n) => n.toFixed(1)).join(',');

// annular sector between two clock-degrees — used to build the rotating radar sweep
function sector(rIn: number, rOut: number, d0: number, d1: number): string {
  const [x0i, y0i] = pt(rIn, d0);
  const [x0o, y0o] = pt(rOut, d0);
  const [x1o, y1o] = pt(rOut, d1);
  const [x1i, y1i] = pt(rIn, d1);
  return `M ${x0i},${y0i} L ${x0o},${y0o} A ${rOut} ${rOut} 0 0 1 ${x1o},${y1o} L ${x1i},${y1i} A ${rIn} ${rIn} 0 0 0 ${x0i},${y0i} Z`;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 0xffffffff);
}

function useCountUp(target: number, durationMs = 2000, decimals = 1) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v.toFixed(decimals);
}

const CARDINALS = [
  { deg: 0, label: 'LOC_F.83' },
  { deg: 90, label: 'LOC_F.85' },
  { deg: 180, label: 'LOC_F.80' },
  { deg: 270, label: 'LOC_F.81' },
];

const ReactorCoreHUD: React.FC = () => {
  const pct = useCountUp(61.5);

  // outer ring node dots
  const nodes = useMemo(() => {
    const rnd = lcg(11);
    return Array.from({ length: 32 }, (_, i) => ({ deg: (i / 32) * 360, big: i % 8 === 0, r: 250 + (rnd() - 0.5) * 4 }));
  }, []);
  // scattered registration marks (technical detail field)
  const marks = useMemo(() => {
    const rnd = lcg(73);
    return Array.from({ length: 26 }, () => {
      const deg = rnd() * 360;
      const r = 104 + rnd() * 120;
      const sq = rnd() > 0.55;
      return { ...{ x: 0, y: 0 }, deg, r, sq, s: 2 + rnd() * 2 };
    });
  }, []);
  // radial spokes
  const spokes = Array.from({ length: 24 }, (_, i) => (i / 24) * 360);
  // tick ring
  const ticks = Array.from({ length: 90 }, (_, i) => (i / 90) * 360);

  // green progress arc along the left perimeter (deg 200 → 320, clockwise)
  const gpR = 256;
  const [gs, ge] = [200, 320];
  const gArc = `M ${P(gpR, gs)} A ${gpR} ${gpR} 0 0 1 ${P(gpR, ge)}`;
  const gLen = (Math.PI / 180) * (ge - gs) * gpR;

  return (
    <div className="absolute inset-0 z-[15] pointer-events-none flex items-center justify-center select-none">
      <div className="relative rc-reveal" data-testid="rc-dial" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="overflow-visible relative">
          <defs>
            <radialGradient id="rcGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="22%" stopColor={CB} stopOpacity="0.55" />
              <stop offset="60%" stopColor={C} stopOpacity="0.16" />
              <stop offset="100%" stopColor={C} stopOpacity="0" />
            </radialGradient>
            {/* radar-sweep fade: transparent at the core, brighter toward the rim */}
            <radialGradient id="rcSweep" gradientUnits="userSpaceOnUse" cx={O} cy={O} r="232">
              <stop offset="30%" stopColor={CB} stopOpacity="0" />
              <stop offset="100%" stopColor={CB} stopOpacity="0.5" />
            </radialGradient>
          </defs>

          {/* faint partial outer arcs (decorative, from the 1:36 frame) */}
          <path d={`M ${P(272, 300)} A 272 272 0 0 1 ${P(272, 350)}`} fill="none" stroke={FAINT} strokeWidth="6" />
          <path d={`M ${P(272, 60)} A 272 272 0 0 1 ${P(272, 130)}`} fill="none" stroke={FAINT} strokeWidth="6" />

          {/* outer node ring (slow rotation) — frames the reactor from OUTSIDE */}
          <g style={{ transformOrigin: `${O}px ${O}px`, animation: 'hud-spin 110s linear infinite' }}>
            <circle cx={O} cy={O} r="250" fill="none" stroke={C} strokeWidth="1" opacity="0.55" />
            {nodes.map((n, i) => {
              const [x, y] = pt(n.r, n.deg);
              return <circle key={i} cx={x} cy={y} r={n.big ? 3.2 : 1.6} fill={n.big ? CB : WHT}
                opacity={n.big ? 0.95 : 0.6}
                style={n.big ? { animation: 'hud-blip 4s ease-in-out infinite', animationDelay: `${i * 0.2}s` } : undefined} />;
            })}
          </g>

          {/* short cardinal registration ticks OUTSIDE the reactor (don't cross the centre) */}
          {CARDINALS.map(({ deg, label }) => {
            const [x1, y1] = pt(236, deg);
            const [x2, y2] = pt(250, deg);
            const [lx, ly] = pt(262, deg);
            return (
              <g key={deg}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={CB} strokeWidth="1.4" opacity="0.7" />
                <text x={lx} y={ly} fill={DIM} className="hud-mono" fontSize="8" letterSpacing="1"
                  textAnchor={deg === 270 ? 'end' : deg === 90 ? 'start' : 'middle'}
                  dominantBaseline={deg === 180 ? 'hanging' : 'auto'}>{label}</text>
              </g>
            );
          })}

          {/* dense technical field — radial spokes + registration marks (rotates CCW).
              Realises the "dense rotating technical field" this dial is built around,
              kept in the r150–230 band so the centre stays open for the live 3D core. */}
          <g data-testid="rc-tech-field" className="rc-field-ccw" style={{ transformOrigin: `${O}px ${O}px` }}>
            <circle cx={O} cy={O} r="150" fill="none" stroke={FAINT} strokeWidth="1" />
            <circle cx={O} cy={O} r="112" fill="none" stroke={FAINT} strokeWidth="1" strokeDasharray="2 5" />
            {spokes.map((deg, i) => {
              const [x1, y1] = pt(150, deg);
              const [x2, y2] = pt(228, deg);
              const major = i % 4 === 0;
              return <line key={`sp${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={major ? C : DIM} strokeWidth={major ? 1 : 0.6} opacity={major ? 0.5 : 0.3} />;
            })}
            {marks.map((m, i) => {
              const [x, y] = pt(m.r, m.deg);
              return m.sq
                ? <rect key={`mk${i}`} x={x - m.s / 2} y={y - m.s / 2} width={m.s} height={m.s} fill="none" stroke={DIM} strokeWidth="0.7" />
                : <circle key={`mk${i}`} cx={x} cy={y} r={m.s / 2} fill={DIM} />;
            })}
          </g>

          {/* graduation tick ring (rotates CW → counter-rotation against the field) */}
          <g data-testid="rc-tick-ring" className="rc-field-cw" style={{ transformOrigin: `${O}px ${O}px` }}>
            {ticks.map((deg, i) => {
              const major = i % 10 === 0;
              const [x1, y1] = pt(232, deg);
              const [x2, y2] = pt(major ? 244 : 238, deg);
              return <line key={`tk${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={major ? CB : DIM} strokeWidth={major ? 1.2 : 0.6} opacity={major ? 0.85 : 0.45} />;
            })}
          </g>

          {/* green ANALYSIS progress arc + tip (draws on once) */}
          <path d={gArc} fill="none" stroke={GRN} strokeWidth="3.5" strokeLinecap="round"
            style={{ ['--draw-len' as any]: `${gLen}`, strokeDasharray: gLen, animation: 'hud-draw 2s ease-out both', filter: `drop-shadow(0 0 5px ${GRN})` }} />
          {(() => { const [tx, ty] = pt(gpR, gs); return <circle cx={tx} cy={ty} r="4.5" fill={GRN} style={{ filter: `drop-shadow(0 0 7px ${GRN})`, animation: 'hud-pulse 1.5s ease-in-out infinite' }} />; })()}

          {/* rotating radar SCAN SWEEP — the template's signature dial motion (1:15 radar
              sweep): a bright wedge with a fading trail that continuously rakes the open
              core, additive-light so the live 3D core still reads through it. */}
          <g data-testid="rc-scan-sweep" className="rc-sweep" style={{ transformOrigin: `${O}px ${O}px` }}>
            <path d={sector(92, 232, -14, 0)} fill="url(#rcSweep)" opacity="0.85" />
            <path d={sector(92, 232, -34, -14)} fill="url(#rcSweep)" opacity="0.45" />
            <path d={sector(92, 232, -60, -34)} fill="url(#rcSweep)" opacity="0.18" />
            {(() => { const [x1, y1] = pt(92, 0); const [x2, y2] = pt(232, 0); return (
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={CB} strokeWidth="2" opacity="0.9" style={{ filter: `drop-shadow(0 0 5px ${CB})` }} />
            ); })()}
          </g>

          {/* centre is intentionally open — the live 3D ring-gyroscope core shows through here */}
        </svg>

        {/* ONLINE badge + X·Y crosshair (top-left) */}
        <div className="absolute hud-mono flex items-center gap-1.5" style={{ left: 70, top: 96 }}>
          <span style={{ color: WHT, fontSize: 11 }}>⊹</span>
          <span style={{ color: '#04101a', background: GRN, fontSize: 8, letterSpacing: 1.5 }} className="px-1.5 py-[1px]">ONLINE</span>
        </div>

        {/* ANALYSIS percentage (lower-left, follows the green arc) */}
        <div className="absolute" style={{ left: 18, bottom: 80, transform: 'rotate(-58deg)', transformOrigin: 'left bottom' }}>
          <div className="hud-mono" style={{ color: GRN, fontSize: 8, letterSpacing: 2 }}>ANALYSIS IN PROGRESS</div>
        </div>
        <div className="absolute" style={{ left: 30, bottom: 30 }}>
          <span className="font-display font-bold" style={{ color: GRN, fontSize: 22, textShadow: `0 0 10px ${GRN}` }}>{pct}%</span>
        </div>

        {/* caption */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center" style={{ bottom: -26 }}>
          <div className="hud-mono text-[10px] tracking-[0.4em]" style={{ color: C }}>REACTOR CORE</div>
        </div>
      </div>
    </div>
  );
};

export default ReactorCoreHUD;
