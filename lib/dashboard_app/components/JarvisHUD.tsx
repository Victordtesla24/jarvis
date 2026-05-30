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

function MonitorWave() {
  // SILENT visual "monitoring" waveform (no microphone, no audio)
  const bars = useMemo(() => [...Array(28)].map((_, i) => ({ d: (i % 7) * 0.09, h: 0.3 + ((i * 37) % 70) / 100 })), []);
  return (
    <div className="jh-wave">
      <div className="jh-wave-label">— MONITORING —</div>
      <div className="jh-wave-bars">
        {bars.map((b, i) => (
          <span key={i} style={{ animationDelay: `${b.d}s`, ['--h' as any]: b.h }} />
        ))}
      </div>
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
    <div className="jh-root">
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

        <div className="jh-logwrap"><CommandLog logs={logs} /></div>

        <div className="glass-panel jh-panel jh-launchers">
          <div className="jh-panel-h">LAUNCH</div>
          <Launcher label="Notepad" onClick={() => window.open('https://keep.google.com', '_blank')} />
          <Launcher label="Todo List" onClick={() => window.open('https://todoist.com', '_blank')} />
          <Launcher label="My Files" onClick={() => window.open('file:///Users/' + (window as any).__user || 'file:///', '_blank')} />
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
