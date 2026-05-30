import React, { useEffect, useMemo, useState } from 'react';
import type { Stats } from '../hooks/useStats';
import NeuralCircle from './neocore/NeuralCircle';
import CommandLog, { LogEntry } from './neocore/CommandLog';
import FlowchartWidget from './neocore/FlowchartWidget';
import '../styles/neocore-vars.css';
import '../styles/neocore.css';
import '../styles/jarvis-hud.css';

const num = (v: any, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const fix = (v: any, d = 0) => num(v, d).toFixed(0);

// JARVIS-3.0 desktop HUD laid out per design_refs/ref_full_layout.jpg.
// Reuses NeoCore components (NeuralCircle, CommandLog, FlowchartWidget) + its
// stylesheet; everything is fed by live /api/stats. Silent, read-only.

// the JARVIS maintenance pipeline, rendered by NeoCore's FlowchartWidget
const PIPELINE = JSON.stringify({
  steps: [
    { id: 'scan', label: 'SCAN' },
    { id: 'analyze', label: 'ANALYZE' },
    { id: 'tidy', label: 'TIDY' },
    { id: 'verify', label: 'VERIFY' },
  ],
  edges: [
    { from: 'scan', to: 'analyze' },
    { from: 'analyze', to: 'tidy' },
    { from: 'tidy', to: 'verify' },
  ],
});

function DataRow({ label, pct, value }: { label: string; pct?: number; value: string }) {
  const p = typeof pct === 'number' ? Math.min(100, Math.max(0, pct)) : undefined;
  const hot = p !== undefined && p > 85 ? 'var(--accent-warning)' : p !== undefined && p > 70 ? '#ffd54a' : 'var(--neon-cyan)';
  return (
    <div className="jh-datarow">
      <span className="jh-dr-label">{label}</span>
      <span className="jh-dr-track">
        {p !== undefined && <i className="jh-dr-fill" style={{ width: `${p}%`, background: hot, boxShadow: `0 0 6px ${hot}` }} />}
      </span>
      <span className="jh-dr-val" style={{ color: hot }}>{value}</span>
    </div>
  );
}

// Radial CPU gauge (270° arc) — supplements the orbital NeuralCircle in the
// STATUS panel. Driven by live CPU load.
function Gauge({ pct }: { pct: number }) {
  const p = Math.min(100, Math.max(0, pct));
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (p / 100) * circ * 0.75; // 270° arc
  const hot = p > 85 ? 'var(--accent-warning)' : p > 70 ? '#ffd54a' : 'var(--neon-cyan)';
  return (
    <div className="jh-gauge">
      <svg viewBox="0 0 140 140" width="120" height="120">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(0,242,255,.12)" strokeWidth="6"
          strokeDasharray={`${circ * 0.75} ${circ}`} transform="rotate(135 70 70)" strokeLinecap="round" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={hot} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} transform="rotate(135 70 70)" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${hot})`, transition: 'stroke-dasharray .6s ease, stroke .6s' }} />
      </svg>
      <div className="jh-gauge-val">
        <b style={{ color: hot }}>{p.toFixed(0)}</b><span>%</span>
        <em>CPU LOAD</em>
      </div>
    </div>
  );
}

function MonitorWave() {
  // SILENT, purely decorative "monitoring" waveform (no microphone, no audio,
  // not telemetry). Heights regenerate every 150ms so the bars animate live.
  const [heights, setHeights] = useState<number[]>(() => [...Array(28)].map(() => 0.3 + Math.random() * 0.7));
  useEffect(() => {
    const id = window.setInterval(() => {
      setHeights([...Array(28)].map(() => 0.3 + Math.random() * 0.7));
    }, 150);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="jh-wave">
      <div className="jh-wave-label">— MONITORING —</div>
      <div className="jh-wave-bars">
        {heights.map((h, i) => (
          <span key={i} style={{ ['--h' as any]: h }} />
        ))}
      </div>
    </div>
  );
}

function DiagnosticsGraph({ cpu, ram }: { cpu: number; ram: number }) {
  const cpuHist = React.useRef<number[]>([]);
  const ramHist = React.useRef<number[]>([]);
  const [, force] = useState(0);
  useEffect(() => {
    const push = (buf: number[], v: number) => { buf.push(v); if (buf.length > 40) buf.shift(); };
    push(cpuHist.current, cpu); push(ramHist.current, ram);
    force((n) => n + 1);
  }, [cpu, ram]);
  const W = 280, H = 70;
  const line = (buf: number[]) => {
    if (buf.length < 2) return '';
    const step = W / 39;
    return buf.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(H - (Math.min(100, Math.max(0, v)) / 100) * H).toFixed(1)}`).join(' ');
  };
  return (
    <div className="glass-panel jh-panel jh-diag">
      <div className="jh-panel-h">DIAGNOSTICS · CPU / MEM</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="jh-diag-svg">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="rgba(0,242,255,.1)" strokeWidth="1" />
        ))}
        <path d={line(ramHist.current)} fill="none" stroke="var(--accent-success)" strokeWidth="1.5" opacity="0.7" />
        <path d={line(cpuHist.current)} fill="none" stroke="var(--neon-cyan)" strokeWidth="1.8" style={{ filter: 'drop-shadow(0 0 4px var(--neon-cyan-glow))' }} />
      </svg>
      <div className="jh-diag-legend"><span style={{ color: 'var(--neon-cyan)' }}>■ CPU {cpu.toFixed(0)}%</span><span style={{ color: 'var(--accent-success)' }}>■ MEM {ram.toFixed(0)}%</span></div>
    </div>
  );
}

function Launcher({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button className="jh-launch" onClick={onClick}>
      <span className="jh-launch-ic">▣</span> {label}
    </button>
  );
}

export default function JarvisHUD({ stats }: { stats: Stats }) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      setClock(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Pointer parallax (PHASE 4A): normalise cursor to [-1,1] and publish as CSS
  // vars; the columns translate ≤6px in opposite directions. Skipped entirely
  // when the user prefers reduced motion.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (e: MouseEvent) => {
      const px = (e.clientX / window.innerWidth) * 2 - 1;
      const py = (e.clientY / window.innerHeight) * 2 - 1;
      const el = rootRef.current;
      if (el) {
        el.style.setProperty('--px', px.toFixed(3));
        el.style.setProperty('--py', py.toFixed(3));
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const sys = stats?.system || {};
  const cpu = num(sys.cpu_load_pct);
  const ram = num(sys.ram?.used_pct);
  const disk = num(sys.disk?.used_pct);
  const docker = stats?.docker || {};
  const brain = stats?.brain || {};
  const machines = stats?.machines || [];
  const audit = stats?.audit || {};
  const settings = stats?.settings || {};
  const offline = stats?._offline;

  const logs: LogEntry[] = useMemo(() => {
    const rec = stats?.recent || [];
    if (!rec.length) return [{ id: 'idle', timestamp: new Date(), message: 'System ready — awaiting maintenance pass' }];
    return rec.slice(0, 10).map((r, i) => ({
      id: i,
      timestamp: r.timestamp ? new Date(r.timestamp) : new Date(),
      message: `${(r.machine || 'local').toUpperCase()} · ${r.action || r.description || '—'}${r.freed_human ? ` (+${r.freed_human})` : ''}`,
    }));
  }, [stats]);

  return (
    <div className="jh-root" ref={rootRef}>
      <div className="jh-scan" />

      {/* ===== Top bar ===== */}
      <div className="jh-top">
        <div className="jh-title">SYSTEM<span>-</span>JARVIS_3.0</div>
        <div className="jh-clock">{clock}</div>
        <div className="jh-top-status">
          <span className={`jh-led ${offline ? 'warn' : ''}`} />
          {offline ? 'TELEMETRY · DEMO' : 'TELEMETRY · LIVE'}
        </div>
      </div>

      {/* ===== Left column ===== */}
      <div className="jh-col jh-left">
        <div className="glass-panel jh-panel">
          <div className="jh-panel-h">STATUS</div>
          <div className="jh-orbital"><NeuralCircle metrics={{ cpu, ram, disk }} /></div>
          <Gauge pct={cpu} />
          <div className="jh-numrow">
            {[fix(cpu), fix(ram), fix(disk), num(docker.running_count), machines.length, num(audit.actions_24h)].map((n, i) => (
              <span key={i}>{n}</span>
            ))}
          </div>
        </div>

        <div className="glass-panel jh-panel jh-rows">
          <DataRow label="CPU_LOAD" pct={cpu} value={`${fix(cpu)}%`} />
          <DataRow label="MEMORY" pct={ram} value={`${fix(ram)}%`} />
          <DataRow label="STORAGE" pct={disk} value={`${fix(disk)}%`} />
          <DataRow label="NEURAL" value={brain.available ? 'ONLINE' : 'OFFLINE'} />
          <DataRow label="DOCKER" value={docker.running ? `${num(docker.running_count)} UP` : 'DOWN'} />
          <DataRow label="AUTOPILOT" value={settings.autopilot_armed ? 'ARMED' : 'SAFE'} />
          {(machines.length ? machines.slice(0, 2) : [{ name: 'NODE', disk_used_pct: undefined } as any]).map((m: any, i: number) => (
            <DataRow key={i} label={(m.name || 'NODE').toUpperCase().slice(0, 9)} pct={num(m.disk_used_pct)} value={`${fix(m.disk_used_pct)}%`} />
          ))}
        </div>

        <div className="glass-panel jh-panel"><MonitorWave /></div>
      </div>

      {/* ===== Right column ===== */}
      <div className="jh-col jh-right">
        <div className="glass-panel jh-panel jh-flow">
          <div className="jh-panel-h">MAINTENANCE PIPELINE</div>
          <FlowchartWidget content={PIPELINE} />
        </div>

        <DiagnosticsGraph cpu={cpu} ram={ram} />

        <div className="jh-logwrap"><CommandLog logs={logs} /></div>

        <div className="glass-panel jh-panel jh-launchers" data-interactive>
          <div className="jh-panel-h">LAUNCH</div>
          <Launcher label="Notepad" onClick={() => window.open('https://keep.google.com', '_blank')} />
          <Launcher label="Todo List" onClick={() => window.open('https://todoist.com', '_blank')} />
          <Launcher label="My Files" onClick={() => window.open('file:///Users/' + ((window as any).__user ?? ''), '_blank')} />
          <Launcher label="Youtube" onClick={() => window.open('https://youtube.com', '_blank')} />
        </div>
      </div>

      {/* ===== Bottom strip ===== */}
      <div className="jh-bottom">
        <span>JARVIS 3.0 · {brain.model || '—'}</span>
        <span>{num(audit.actions_24h)} actions/24h · {audit.total_freed_human || '0 B'} reclaimed</span>
        <span>{stats?.generated_at || ''}</span>
      </div>

      {/* corner brackets */}
      <div className="jh-fr tl" /><div className="jh-fr tr" /><div className="jh-fr bl" /><div className="jh-fr br" />
    </div>
  );
}
