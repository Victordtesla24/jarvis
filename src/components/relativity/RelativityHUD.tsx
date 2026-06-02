import React, { useEffect, useMemo, useState } from 'react';
import { RegionName } from '../../types';
import ReactorCoreHUD from './ReactorCoreHUD';
import { useAgentState } from '../../services/agentState';

// ── HUD Relativity design baseline ──────────────────────────────────────────
// A full-screen, pointer-transparent FUI overlay modelled frame-by-frame on the
// "HUD Relativity" (RenovatioDigital) Iron Man / JARVIS template. Captured motifs:
//   • desaturated cyan thin-linework on near-black navy
//   • coded tick labels (SCR_xx.xxx, *_GRAPH_0x) and dense ticking numerics
//   • sweeping orbit arc with a travelling marker
//   • rotating radial spectrum dial
//   • status-list panels with ONLINE / WARNING / OFFLINE colour-chip badges
//   • vertical equalizer bar-meter columns + a segmented digital clock
//   • green/teal waveform area graphs
//   • A/B/C lettered ring gauges + a large % radial gauge
//   • a row of sub-system ring gauges with green/orange/red status accents
// Status palette: cyan (info) · green (online) · orange (caution) · red (alert).

const C = '#58C6DE';
const CB = '#9BEAF6';
const N = '#DDF6FB';
const DIM = 'rgba(88,198,222,0.30)';
// Holographic palette — unified cyan for animated elements; red kept only for genuine alerts.
const GRN = '#39E1F2'; // "online/active" → bright cyan
const ORG = '#7FD8E8'; // "caution" → mid cyan
const RED = '#FF4B4B'; // reserved for true alerts (offline/critical)
const PANEL = 'rgba(4,16,24,0.55)';

const STATUS = { ONLINE: GRN, NOMINAL: C, ACTIVE: CB, CAUTION: ORG, WARNING: ORG, OFFLINE: RED, ALERT: RED } as const;
type StatusKey = keyof typeof STATUS;

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 0xffffffff);
}

// ── shared atoms ────────────────────────────────────────────────────────────

// Text that decodes from scrambled glyphs into the real string on mount —
// the template's signature label-resolve effect.
const GLYPHS = '0123456789<>/\\[]{}=+*#%';
const DecodeText: React.FC<{ text: string; className?: string; style?: React.CSSProperties; durationMs?: number; delayMs?: number }> = ({
  text, className, style, durationMs = 700, delayMs = 0,
}) => {
  const [out, setOut] = useState('');
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delayMs;
    const tick = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - start) / durationMs));
      const resolved = Math.floor(p * text.length);
      let s = '';
      for (let i = 0; i < text.length; i++) {
        s += i < resolved || text[i] === ' ' ? text[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setOut(s);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setOut(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, durationMs, delayMs]);
  return <span className={className} style={style}>{out || ' '}</span>;
};

// Label + number that counts up from 0 on mount, then settles into live jitter.
const Readout: React.FC<{
  label: string; base: number; decimals?: number; jitter?: number; period?: number; unit?: string; color?: string;
}> = ({ label, base, decimals = 3, jitter = 0.4, period = 900, unit = '', color = N }) => {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1100;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setV(base * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const id = window.setInterval(() => setV(base + (Math.random() - 0.5) * 2 * jitter), period);
    return () => { cancelAnimationFrame(raf); window.clearInterval(id); };
  }, [base, jitter, period]);
  return (
    <div className="hud-mono flex items-baseline gap-2 leading-tight whitespace-nowrap">
      <span style={{ color: DIM }} className="text-[9px] tracking-[0.18em]">{label}</span>
      <span style={{ color }} className="text-[10px] tracking-wider">{v.toFixed(decimals)}{unit}</span>
    </div>
  );
};

const Tick: React.FC<{ children: string; code?: string }> = ({ children, code }) => (
  <div className="flex items-center gap-2">
    <span style={{ background: CB }} className="block w-4 h-[2px]" />
    <DecodeText text={children} className="hud-mono text-[10px] tracking-[0.22em] uppercase" style={{ color: C }} />
    {code && <span style={{ color: DIM }} className="hud-mono text-[9px] tracking-wider">{code}</span>}
  </div>
);

// Notched-corner panel frame, the recurring container in the template. Carries the
// Project File.aep chrome: RAMP radial/linear gradient bg, GLOW edge, REPEATER tick-rail,
// and a TRIM-PATHS border draw-on (single bordered rect, clipped to the notch).
const PANEL_CLIP = 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))';
const Panel: React.FC<{
  className?: string; style?: React.CSSProperties; children: React.ReactNode;
  tickRail?: boolean; glow?: boolean; rails?: number;
}> = ({ className = '', style, children, tickRail = true, glow = true, rails = 10 }) => (
  <div
    className={`hud-rel ${className}`}
    style={{
      // RAMP: radial cyan tint (top-left) over a linear navy ramp
      background:
        'radial-gradient(120% 90% at 18% 0%, rgba(88,198,222,0.13), rgba(88,198,222,0.03) 40%, transparent 72%),' +
        'linear-gradient(160deg, rgba(8,26,38,0.66) 0%, rgba(4,14,22,0.62) 60%, rgba(2,9,15,0.7) 100%)',
      border: `1px solid ${DIM}`,
      clipPath: PANEL_CLIP,
      backdropFilter: 'blur(2px)',
      // GLOW: single source — inset edge sheen + soft outer cyan bloom
      boxShadow: glow ? 'inset 0 0 12px rgba(88,198,222,0.09), inset 0 1px 0 rgba(155,234,246,0.14), 0 0 14px rgba(88,198,222,0.09)' : undefined,
      ...style,
    }}
  >
    <span style={{ background: CB }} className="absolute top-0 left-0 w-6 h-[2px]" />
    <div className="absolute left-0 right-0 h-[1px] pointer-events-none"
      style={{ background: `linear-gradient(90deg, transparent, ${CB}, transparent)`, animation: 'hud-sweepdown 6s ease-in-out infinite' }} />

    {/* REPEATER tick-rail down the left edge */}
    {tickRail && (
      <div className="absolute left-0 top-3 bottom-3 w-[6px] pointer-events-none flex flex-col justify-between items-start">
        {Array.from({ length: rails }).map((_, i) => (
          <span key={i} className="block h-[1px]"
            style={{ width: i % 3 === 0 ? 6 : 3, background: i % 3 === 0 ? CB : DIM, opacity: i % 3 === 0 ? 0.9 : 0.55 }} />
        ))}
      </div>
    )}

    {/* TRIM-PATHS border draw-on (clipped to the notch, size-independent via pathLength) */}
    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" style={{ clipPath: PANEL_CLIP }}>
      <rect x="0" y="0" width="100%" height="100%" fill="none" stroke={CB} strokeWidth="1"
        vectorEffect="non-scaling-stroke" pathLength={1000}
        style={{ strokeDasharray: 1000, ['--draw-len' as any]: '1000', animation: 'hud-draw 1.4s ease-out both', filter: `drop-shadow(0 0 2px ${CB})` }} />
    </svg>

    {children}
  </div>
);

// ── telemetry data-viz panels (the video's element library) ─────────────────

// Animated vertical bar chart.
const BarChart: React.FC<{ label: string; code: string; bars?: number; className?: string; style?: React.CSSProperties }> = ({
  label, code, bars = 16, className = '', style,
}) => {
  const [h, setH] = useState<number[]>(() => Array.from({ length: bars }, (_, i) => 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(i))));
  useEffect(() => {
    const id = window.setInterval(() => setH(Array.from({ length: bars }, () => 0.15 + Math.random() * 0.85)), 320);
    return () => window.clearInterval(id);
  }, [bars]);
  return (
    <div className={`absolute hud-rel ${className}`} style={style}>
      <Tick code={code}>{label}</Tick>
      <div className="flex items-end gap-[3px] mt-1" style={{ height: 56 }}>
        {h.map((v, i) => (
          <div key={i} className="flex-1" style={{ height: `${v * 100}%`, background: i % 5 === 0 ? CB : C, opacity: 0.85, transition: 'height .3s ease' }} />
        ))}
      </div>
    </div>
  );
};

// Scrolling area + line graph (LEVEL / PROCESS graph).
const AreaGraph: React.FC<{ label: string; code: string; width?: number; smooth?: boolean; className?: string; style?: React.CSSProperties }> = ({
  label, code, width = 220, smooth = true, className = '', style,
}) => {
  const N = 28, H = 56;
  const [data, setData] = useState<number[]>(() => Array.from({ length: N }, (_, i) => 0.5 + 0.35 * Math.sin(i / 2.5)));
  useEffect(() => {
    const id = window.setInterval(() => setData((d) => {
      const next = Math.max(0.08, Math.min(0.95, d[d.length - 1] + (Math.random() - 0.5) * 0.4));
      return [...d.slice(1), next];
    }), 420);
    return () => window.clearInterval(id);
  }, []);
  const step = width / (N - 1);
  const line = data.map((v, i) => `${(i * step).toFixed(1)},${((1 - v) * H).toFixed(1)}`).join(smooth ? ' ' : ' ');
  return (
    <div className={`absolute hud-rel ${className}`} style={style}>
      <Tick code={code}>{label}</Tick>
      <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} className="mt-1">
        <polygon points={`0,${H} ${line} ${width},${H}`} fill={C} opacity="0.12" />
        <polyline points={line} fill="none" stroke={CB} strokeWidth="1.3" />
        <circle cx={width} cy={(1 - data[data.length - 1]) * H} r="2.5" fill={CB} style={{ filter: `drop-shadow(0 0 4px ${CB})` }} />
      </svg>
    </div>
  );
};

// DNA-analysis bar matrix: rows of small varying-height bars.
const BarMatrix: React.FC<{ label: string; code: string; rows?: number; cols?: number; className?: string; style?: React.CSSProperties }> = ({
  label, code, rows = 3, cols = 28, className = '', style,
}) => {
  const [grid, setGrid] = useState<number[][]>(() =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0.3 + Math.random() * 0.6)));
  useEffect(() => {
    const id = window.setInterval(() =>
      setGrid(Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0.15 + Math.random() * 0.85))), 360);
    return () => window.clearInterval(id);
  }, [rows, cols]);
  return (
    <div className={`absolute hud-rel ${className}`} style={style}>
      <Tick code={code}>{label}</Tick>
      <div className="mt-1 space-y-1">
        {grid.map((row, r) => (
          <div key={r} className="flex items-end gap-[2px]" style={{ height: 16 }}>
            {row.map((v, c) => (
              <div key={c} className="flex-1" style={{ height: `${v * 100}%`, background: (r + c) % 7 === 0 ? CB : C, opacity: 0.7, transition: 'height .35s ease' }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// Telemetry table: rows of label · value% · mini bar.
const DataTable: React.FC<{ label: string; code: string; rows: string[]; className?: string; style?: React.CSSProperties }> = ({
  label, code, rows, className = '', style,
}) => {
  const [vals, setVals] = useState<number[]>(() => rows.map(() => 40 + Math.random() * 50));
  useEffect(() => {
    const id = window.setInterval(() => setVals(rows.map((_, i) => Math.max(12, Math.min(99, vals[i] + (Math.random() - 0.5) * 18)))), 1500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Panel rails={6} className={`absolute pl-4 pr-3 pt-2 pb-2 ${className}`} style={{ width: 224, ...style }}>
      <Tick code={code}>{label}</Tick>
      <div className="mt-1.5 space-y-1">
        {rows.map((name, i) => (
          <div key={name} className="flex items-center gap-2">
            <span className="hud-mono text-[9px] tracking-wider w-20 truncate" style={{ color: DIM }}>{name}</span>
            <div className="flex-1 h-[3px] bg-white/5">
              <div className="h-full" style={{ width: `${vals[i]}%`, background: CB, transition: 'width 1.2s ease', boxShadow: `0 0 4px ${CB}` }} />
            </div>
            <span className="hud-mono text-[9px]" style={{ color: N }}>{vals[i].toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </Panel>
  );
};

// Command list: rows of CMD code · cyan value badge.
const CommandList: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => {
  const items = useMemo(() => ([
    ['EXEC_VECTOR', 'X.30'], ['SYNC_RELAY', '1.32'], ['PURGE_CACHE', '2.20'], ['ALIGN_GYRO', '0.84'],
  ]), []);
  return (
    <div className={`absolute hud-rel ${className}`} style={{ width: 190, ...style }}>
      <Tick code="LOG_07">Commands</Tick>
      <div className="mt-1.5 space-y-1">
        {items.map(([name, val]) => (
          <div key={name} className="flex items-center justify-between">
            <span className="hud-mono text-[9px] tracking-wider" style={{ color: C }}>{name}</span>
            <span className="hud-mono text-[8px] px-1.5 py-[1px]" style={{ color: '#04101a', background: CB }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Power-distribution value boxes.
const ValueBoxes: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => {
  const [vals, setVals] = useState<number[]>([3.4, -8.0, 0.7, 4.8]);
  useEffect(() => {
    const id = window.setInterval(() => setVals((v) => v.map((x) => x + (Math.random() - 0.5) * 0.6)), 900);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className={`absolute hud-rel ${className}`} style={style}>
      <Tick code="PWR_DIST">Power Dist</Tick>
      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
        {vals.map((v, i) => (
          <div key={i} className="flex items-center gap-1.5 px-1.5 py-0.5" style={{ border: `1px solid ${DIM}` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: CB, animation: 'hud-pulse 2s ease-in-out infinite', animationDelay: `${i * 0.3}s` }} />
            <span className="hud-mono text-[10px]" style={{ color: N }}>{v.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── panels ──────────────────────────────────────────────────────────────────

// Top-left: sweeping "PLANETARY ORBIT" arc with a marker riding the path.
const OrbitArcPanel: React.FC = () => (
  <div className="absolute top-14 left-6 hud-rel" style={{ width: 360 }}>
    <Tick code="SCR_25.394">Planetary Orbit</Tick>
    <svg viewBox="0 0 360 200" width="360" height="200" className="mt-1 overflow-visible">
      <g stroke={DIM} strokeWidth="0.5" opacity="0.5">
        {Array.from({ length: 5 }).map((_, i) => <line key={`h${i}`} x1="0" y1={i * 40} x2="360" y2={i * 40} />)}
        {Array.from({ length: 9 }).map((_, i) => <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="200" />)}
      </g>
      <path id="orbitPath" d="M8,190 C70,60 230,28 352,90" fill="none" stroke={C} strokeWidth="1.4"
        style={{ ['--draw-len' as any]: '470', strokeDasharray: 470, animation: 'hud-draw 1.7s ease-out both' }} />
      <path d="M8,190 C70,60 230,28 352,90" fill="none" stroke={CB} strokeWidth="1" strokeDasharray="3 7" opacity="0.7"
        style={{ animation: 'hud-dash 30s linear infinite' }} />
      <circle r="4" fill={CB} style={{ filter: `drop-shadow(0 0 6px ${CB})` }}>
        <animateMotion dur="7s" repeatCount="indefinite" rotate="auto"><mpath href="#orbitPath" /></animateMotion>
      </circle>
    </svg>
    <div className="mt-1 space-y-0.5">
      <Readout label="DECAY RATE" base={0.5} decimals={2} jitter={0.05} unit="%" />
      <Readout label="ORBITAL SCAN" base={26.756} jitter={0.6} />
      <Readout label="TTL" base={984.87} decimals={2} jitter={1.2} period={1100} />
    </div>
  </div>
);

const CoordColumn: React.FC = () => (
  <div className="absolute top-[345px] left-6 space-y-0.5 hud-rel" style={{ animationDelay: '0.15s' }}>
    <Tick code="35.131">Display · Source</Tick>
    <div className="mt-1 space-y-0.5">
      <Readout label="X" base={37.291} period={700} />
      <Readout label="Y" base={38.936} period={760} />
      <Readout label="Z" base={21.362} period={820} />
      <div className="flex gap-1.5 mt-1">
        <span className="hud-mono text-[9px] px-1.5 py-0.5" style={{ color: '#04101a', background: GRN }}>X.13</span>
        <span className="hud-mono text-[9px] px-1.5 py-0.5" style={{ color: '#04101a', background: GRN }}>Y.20</span>
      </div>
    </div>
  </div>
);

// Bottom-left: rotating radial spectrum dial.
const RadialSpectrumPanel: React.FC = () => {
  const bars = useMemo(() => {
    const rnd = lcg(42);
    return Array.from({ length: 64 }, (_, i) => ({ a: (i / 64) * Math.PI * 2, len: 16 + rnd() * 40, bright: rnd() > 0.82 }));
  }, []);
  const cx = 78, cy = 78;
  return (
    <div className="absolute bottom-10 left-6 hud-rel" style={{ animationDelay: '0.3s' }}>
      <Tick code="SCR_48.196">Spectrum</Tick>
      <svg viewBox="0 0 156 156" width="150" height="150" className="mt-1">
        <circle cx={cx} cy={cy} r="68" fill="none" stroke={DIM} strokeWidth="0.6" />
        <circle cx={cx} cy={cy} r="56" fill="none" stroke={DIM} strokeWidth="0.6" strokeDasharray="2 4" />
        <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'hud-spin 48s linear infinite' }}>
          {bars.map((b, i) => (
            <line key={i}
              x1={cx + Math.cos(b.a) * 20} y1={cy + Math.sin(b.a) * 20}
              x2={cx + Math.cos(b.a) * (20 + b.len)} y2={cy + Math.sin(b.a) * (20 + b.len)}
              stroke={b.bright ? CB : C} strokeWidth={b.bright ? 1.3 : 0.8} opacity={b.bright ? 0.95 : 0.5} />
          ))}
        </g>
        <circle cx={cx} cy={cy} r="13" fill="none" stroke={CB} strokeWidth="1" />
        <circle cx={cx} cy={cy} r="3" fill={CB} style={{ animation: 'hud-pulse 2s ease-in-out infinite' }} />
      </svg>
    </div>
  );
};

// Top-centre: segmented digital clock + equalizer bars + status banner.
const SegDigit: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = N }) => (
  <span className="hud-mono px-2 py-0.5 text-[15px] tracking-widest"
    style={{ color, border: `1px solid ${DIM}`, background: 'rgba(4,16,24,0.6)' }}>{children}</span>
);

const Equalizer: React.FC<{ bars?: number; color?: string }> = ({ bars = 14, color = C }) => {
  const [h, setH] = useState<number[]>(() => Array.from({ length: bars }, () => 0.4));
  useEffect(() => {
    const id = window.setInterval(() => setH(Array.from({ length: bars }, () => 0.15 + Math.random() * 0.85)), 180);
    return () => window.clearInterval(id);
  }, [bars]);
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 28 }}>
      {h.map((v, i) => (
        <div key={i} style={{ width: 3, height: `${v * 100}%`, background: color, opacity: 0.85, transition: 'height .18s ease' }} />
      ))}
    </div>
  );
};

const TopStrip: React.FC = () => {
  const [clock, setClock] = useState('00:00:00');
  const [ms, setMs] = useState('000');
  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      setClock(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`);
      setMs(String(d.getMilliseconds()).padStart(3, '0'));
    }, 60);
    return () => window.clearInterval(id);
  }, []);
  const [hh, mm, ss] = clock.split(':');
  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 hud-rel">
      <div className="flex items-center gap-1.5">
        <Equalizer bars={10} color={C} />
        <SegDigit>{hh}</SegDigit><SegDigit>{mm}</SegDigit><SegDigit>{ss}</SegDigit>
        <SegDigit color={CB}>.{ms}</SegDigit>
        <Equalizer bars={10} color={C} />
      </div>
      <AgentStatusLine />
    </div>
  );
};

// Live agent status line — driven by the brain in real time (AgentBus).
const AgentStatusLine: React.FC = () => {
  const a = useAgentState();
  const dot = a.mood === 'alert' ? RED : GRN;
  const activity =
    a.activity === 'thinking' ? 'REASONING' : a.activity === 'speaking' ? 'TRANSMITTING' : 'NOMINAL';
  return (
    <div className="hud-mono text-[9px] tracking-[0.4em] flex items-center gap-2" style={{ color: dot }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot, animation: 'hud-pulse 1.6s ease-in-out infinite' }} />
      JARVIS · {a.label} · {activity}
    </div>
  );
};

// Top-right (below the control buttons): AUX SYSTEMS status list with chips.
const StatusRow: React.FC<{ name: string; status: StatusKey }> = ({ name, status }) => (
  <div className="flex items-center justify-between gap-3 py-[3px]">
    <span className="hud-mono text-[9px] tracking-wider" style={{ color: C }}>{name}</span>
    <span className="hud-mono text-[8px] tracking-[0.15em] px-1.5 py-[1px]"
      style={{ color: STATUS[status], border: `1px solid ${STATUS[status]}`,
        animation: status === 'OFFLINE' || status === 'WARNING' ? 'hud-blip 2.4s ease-in-out infinite' : undefined }}>
      {status}
    </span>
  </div>
);

const StatusListPanel: React.FC = () => (
  <Panel rails={12} className="absolute top-20 right-6 pl-4 pr-3 py-2.5" style={{ width: 230 }}>
    <Tick code="SEC_28">Aux Systems</Tick>
    <div className="mt-2 divide-y" style={{ borderColor: DIM }}>
      <StatusRow name="REACTOR_CORE" status="ONLINE" />
      <StatusRow name="DEFLECTOR_ARRAY" status="NOMINAL" />
      <StatusRow name="SNSR_ARRAY" status="ACTIVE" />
      <StatusRow name="THERMAL_REG" status="WARNING" />
      <StatusRow name="COMM_BAND_2" status="OFFLINE" />
      <StatusRow name="OXYGEN_LVLS" status="ONLINE" />
    </div>
  </Panel>
);

// Right-mid: A/B/C lettered ring gauges (orange / green / cyan).
const LetterGauge: React.FC<{ letter: string; color: string; pct: number; delay: number }> = ({ letter, color, pct, delay }) => {
  const r = 18, circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 46 46" width="50" height="50">
      <circle cx="23" cy="23" r={r} fill="none" stroke={DIM} strokeWidth="2" />
      <circle cx="23" cy="23" r={r} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * circ} ${circ}`} transform="rotate(-90 23 23)"
        style={{ ['--draw-len' as any]: `${(pct / 100) * circ}`, animation: 'hud-draw 1.6s ease-out both', filter: `drop-shadow(0 0 3px ${color})` }} />
      <circle cx="23" cy="23" r="12" fill="none" stroke={DIM} strokeWidth="0.6"
        style={{ transformOrigin: '23px 23px', animation: `hud-spin ${6 + delay}s linear infinite` }} strokeDasharray="2 3" />
      <text x="23" y="27" textAnchor="middle" className="hud-mono" fontSize="13" fill={color}>{letter}</text>
    </svg>
  );
};

const ABCGauges: React.FC = () => (
  <div className="absolute right-8 top-[330px] flex flex-col items-end gap-1 hud-rel">
    <Tick code="GRAPH_05">Stats</Tick>
    <div className="flex gap-2 mt-1">
      <LetterGauge letter="A" color={ORG} pct={62} delay={0} />
      <LetterGauge letter="B" color={GRN} pct={84} delay={1} />
      <LetterGauge letter="C" color={C} pct={47} delay={2} />
    </div>
  </div>
);

// Bottom-centre-left: green waveform area graph with a sweeping scan line.
const WaveformPanel: React.FC = () => {
  const pts = useMemo(() => {
    const rnd = lcg(99);
    return Array.from({ length: 40 }, (_, i) => `${i * 6},${30 - Math.sin(i / 3) * 12 - rnd() * 6}`).join(' ');
  }, []);
  const area = useMemo(() => {
    const rnd = lcg(99);
    const top = Array.from({ length: 40 }, (_, i) => `${i * 6},${30 - Math.sin(i / 3) * 12 - rnd() * 6}`).join(' ');
    return `0,60 ${top} 234,60`;
  }, []);
  return (
    <div className="absolute bottom-12 left-[210px] hud-rel" style={{ width: 240 }}>
      <Tick code="GRAPH_03">Wave Spec</Tick>
      <svg viewBox="0 0 234 64" width="234" height="64" className="mt-1 overflow-hidden">
        <polygon points={area} fill={GRN} opacity="0.12" />
        <polyline points={pts} fill="none" stroke={GRN} strokeWidth="1.2" />
        <line x1="0" y1="0" x2="0" y2="64" stroke={CB} strokeWidth="1" opacity="0.7"
          style={{ animation: 'hud-scanx 4s linear infinite' }} />
      </svg>
    </div>
  );
};

// One sub-system ring gauge.
const RingGauge: React.FC<{ label: string; pct: number; color: string; delay: number }> = ({ label, pct, color, delay }) => {
  const r = 16, circ = 2 * Math.PI * r;
  const [p, setP] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setP(pct), 60); // draw on from zero
    const id = window.setInterval(() => setP(Math.max(8, Math.min(98, pct + (Math.random() - 0.5) * 14))), 1400);
    return () => { window.clearTimeout(t); window.clearInterval(id); };
  }, [pct]);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 40 40" width="44" height="44">
        <circle cx="20" cy="20" r={r} fill="none" stroke={DIM} strokeWidth="2" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round"
          strokeDasharray={`${(p / 100) * circ} ${circ}`} transform="rotate(-90 20 20)"
          style={{ transition: 'stroke-dasharray 1.2s ease', filter: `drop-shadow(0 0 3px ${color})` }} />
        <circle cx="20" cy="20" r="3" fill={color} style={{ animation: 'hud-pulse 2.4s ease-in-out infinite', animationDelay: `${delay}s` }} />
      </svg>
      <span style={{ color: DIM }} className="hud-mono text-[8px] tracking-[0.15em]">{label}</span>
    </div>
  );
};

const SubSysGauges: React.FC = () => (
  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hud-rel">
    <div className="mb-1 flex justify-center"><Tick code="SCR_10.011">Sub-Sys Stats</Tick></div>
    <div className="flex gap-4">
      <RingGauge label="CORE" pct={88} color={GRN} delay={0} />
      <RingGauge label="PWR" pct={72} color={C} delay={0.3} />
      <RingGauge label="FLUX" pct={64} color={C} delay={0.6} />
      <RingGauge label="THRM" pct={41} color={ORG} delay={0.9} />
      <RingGauge label="COMM" pct={28} color={RED} delay={1.2} />
    </div>
  </div>
);

const CornerFrame: React.FC = () => {
  const bracket = (pos: string, rot: number) => (
    <svg className={`absolute ${pos}`} width="48" height="48" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M2,18 L2,2 L18,2" fill="none" stroke={C} strokeWidth="1.4" />
      <path d="M2,30 L2,40" fill="none" stroke={CB} strokeWidth="2" />
    </svg>
  );
  return (
    <>{bracket('top-3 left-3', 0)}{bracket('top-3 right-3', 90)}{bracket('bottom-3 right-3', 180)}{bracket('bottom-3 left-3', 270)}</>
  );
};

// Center-left: connector-node constellation (HUD.aep shape-layers linked by position
// expressions). Nodes drift, near-neighbour links form/break, blips travel active edges.
const NodeMeshPanel: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => {
  const W = 228, H = 150;
  const NODES = useMemo(() => {
    const rnd = lcg(2025);
    return Array.from({ length: 11 }, (_, i) => ({
      bx: 16 + rnd() * (W - 32), by: 24 + rnd() * (H - 40),
      ax: 4 + rnd() * 6, ay: 3 + rnd() * 5,
      sx: 0.6 + rnd() * 0.8, sy: 0.5 + rnd() * 0.9,
      ph: rnd() * Math.PI * 2, big: i % 4 === 0,
    }));
  }, []);
  const EDGES = useMemo(() => {
    const rnd = lcg(777); const es: { a: number; b: number; per: number; off: number; speed: number }[] = [];
    for (let a = 0; a < NODES.length; a++) for (let b = a + 1; b < NODES.length; b++) {
      const dx = NODES[a].bx - NODES[b].bx, dy = NODES[a].by - NODES[b].by;
      if (Math.hypot(dx, dy) < 96) es.push({ a, b, per: 2.4 + rnd() * 3.5, off: rnd(), speed: 0.5 + rnd() * 1.1 });
    }
    return es.slice(0, 16);
  }, [NODES]);
  const [t, setT] = useState(0);
  useEffect(() => { const id = window.setInterval(() => setT((x) => x + 0.075), 75); return () => window.clearInterval(id); }, []);
  const pos = (n: typeof NODES[number]) => [n.bx + Math.sin(t * n.sx + n.ph) * n.ax, n.by + Math.cos(t * n.sy + n.ph) * n.ay] as const;
  return (
    <div className={`absolute hud-rel ${className}`} style={style}>
      <Tick code="NET_07">Node Mesh</Tick>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="mt-1 overflow-visible">
        {EDGES.map((e, i) => {
          const [x1, y1] = pos(NODES[e.a]); const [x2, y2] = pos(NODES[e.b]);
          const g = 0.5 + 0.5 * Math.sin(t * 0.6 / e.per + e.off * 6.283);
          if (g <= 0.45) return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={DIM} strokeWidth="0.4" opacity={0.12} />;
          const bp = (t * e.speed * 0.18 + e.off) % 1;
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C} strokeWidth="0.7" opacity={0.25 + g * 0.5} />
              {g > 0.7 && <circle cx={x1 + (x2 - x1) * bp} cy={y1 + (y2 - y1) * bp} r="1.6" fill={CB} style={{ filter: `drop-shadow(0 0 3px ${CB})` }} />}
            </g>
          );
        })}
        {NODES.map((n, i) => { const [x, y] = pos(n); return (
          <g key={i}>
            {n.big && <circle cx={x} cy={y} r="5.5" fill="none" stroke={DIM} strokeWidth="0.6" />}
            <circle cx={x} cy={y} r={n.big ? 2.6 : 1.4} fill={n.big ? CB : C} opacity={n.big ? 0.95 : 0.7}
              style={n.big ? { filter: `drop-shadow(0 0 4px ${CB})` } : undefined} />
          </g>); })}
      </svg>
      <div className="mt-1 space-y-0.5">
        <Readout label="LINKS" base={EDGES.length} decimals={0} jitter={1.5} period={1300} />
        <Readout label="LATENCY" base={12.408} jitter={0.8} period={820} unit="ms" color={CB} />
      </div>
    </div>
  );
};

interface RelativityHUDProps { currentRegion: RegionName; minimal?: boolean; }

// `minimal` is set in INSTRUMENTS mode: the dense static telemetry panels step aside
// so the live gesture-driven instrument deck owns the left column + bottom row, while
// the frame, clock/agent strip and AUX-systems list stay for continuity. The classic
// dense dashboard is one toggle away (minimal=false renders the full HUD untouched).
const RelativityHUD: React.FC<RelativityHUDProps> = ({ minimal = false }) => (
  <div className="absolute inset-0 z-20 pointer-events-none select-none" style={{ color: C }}>
    {/* flat HUD-Relativity dial frame around the live 3D ring-gyroscope core */}
    <ReactorCoreHUD />
    <CornerFrame />
    <TopStrip />
    <StatusListPanel />

    {!minimal && (
      <>
        <OrbitArcPanel />
        <CoordColumn />
        <ValueBoxes className="left-6" style={{ top: 510, animationDelay: '0.2s' }} />
        <RadialSpectrumPanel />
        <WaveformPanel />
        <ABCGauges />
        <SubSysGauges />

        {/* center-left wedge — connector-node constellation (HUD.aep). Hidden on narrow
            viewports so it never collides with the centred reactor dial. */}
        <NodeMeshPanel className="hidden min-[1560px]:block top-[372px]" style={{ left: 404, animationDelay: '0.35s' }} />

        {/* top band telemetry */}
        <BarChart label="Process Load" code="GRAPH_01" className="top-28" style={{ left: 440, animationDelay: '0.2s', width: 150 }} />
        <AreaGraph label="Level.0 Graph" code="GRAPH_04" width={220} className="top-28" style={{ right: 300, animationDelay: '0.3s' }} />
        <DataTable label="Telemetry Data" code="DAT_19" rows={['CORE_TEMP', 'FLUX_RATE', 'SHLD_INT', 'PWR_DRAW']} className="top-[215px]" style={{ right: 300, animationDelay: '0.45s' }} />

        {/* bottom band telemetry */}
        <BarMatrix label="DNA Analysis" code="MDL_3.0" className="bottom-28" style={{ left: 490, animationDelay: '0.25s', width: 220 }} />
        <AreaGraph label="Process Graph" code="GRAPH_06" width={200} smooth className="bottom-28" style={{ left: 740, animationDelay: '0.4s' }} />
        <CommandList className="bottom-28" style={{ right: 440, animationDelay: '0.5s' }} />
      </>
    )}
    <div className="absolute left-0 right-0 h-[2px]" style={{ top: 0, background: `linear-gradient(90deg, transparent, ${CB}, transparent)`, opacity: 0.5, animation: 'hud-scanbar 9s ease-in-out infinite' }} />
  </div>
);

export default RelativityHUD;
