import React from 'react';
import type { Stats } from '../hooks/useStats';

// Holographic system-monitor HUD — translucent projected light per HOLOGRAPHIC.md.
// Pure HTML/CSS overlay (self-contained styles) fed by live /api/stats. No audio,
// no notifications, read-only.

const C = '#28e0ff';
const num = (v: any, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const fix = (v: any, d = 0) => num(v, d).toFixed(0);

function Bar({ label, pct, sub }: { label: string; pct: number; sub?: string }) {
  const p = Math.min(100, Math.max(0, pct));
  const hot = p > 85 ? '#ff5a6a' : p > 70 ? '#ffd54a' : C;
  return (
    <div className="jx-row">
      <div className="jx-row-head">
        <span>{label}</span>
        <span style={{ color: hot }}>{p.toFixed(0)}%{sub ? <i className="jx-sub"> {sub}</i> : null}</span>
      </div>
      <div className="jx-bar">
        <div className="jx-bar-fill" style={{ width: `${p}%`, background: `linear-gradient(90deg, ${hot}22, ${hot})`, boxShadow: `0 0 10px ${hot}` }} />
        <div className="jx-bar-ticks" />
      </div>
    </div>
  );
}

function Gauge({ pct }: { pct: number }) {
  const p = Math.min(100, Math.max(0, pct));
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (p / 100) * circ * 0.75; // 270° arc
  const hot = p > 85 ? '#ff5a6a' : p > 70 ? '#ffd54a' : C;
  return (
    <div className="jx-gauge">
      <svg viewBox="0 0 140 140" width="150" height="150">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#0c2a33" strokeWidth="6"
          strokeDasharray={`${circ * 0.75} ${circ}`} transform="rotate(135 70 70)" strokeLinecap="round" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={hot} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} transform="rotate(135 70 70)" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${hot})`, transition: 'stroke-dasharray .6s ease, stroke .6s' }} />
        {[...Array(12)].map((_, i) => {
          const a = (i / 12) * 270 - 135;
          const rad = (a * Math.PI) / 180;
          return <line key={i} x1={70 + Math.cos(rad) * 60} y1={70 + Math.sin(rad) * 60}
            x2={70 + Math.cos(rad) * 64} y2={70 + Math.sin(rad) * 64} stroke="#1c5663" strokeWidth="2" />;
        })}
      </svg>
      <div className="jx-gauge-val">
        <b style={{ color: hot }}>{p.toFixed(0)}</b><span>%</span>
        <em>CPU LOAD</em>
      </div>
    </div>
  );
}

function Panel({ title, children, side }: { title: string; children: React.ReactNode; side?: 'l' | 'r' }) {
  return (
    <div className={`jx-panel jx-${side || 'l'}`}>
      <div className="jx-corner tl" /><div className="jx-corner tr" />
      <div className="jx-corner bl" /><div className="jx-corner br" />
      <div className="jx-panel-title">{title}</div>
      <div className="jx-panel-body">{children}</div>
    </div>
  );
}

export default function TelemetryHUD({ stats }: { stats: Stats }) {
  const sys = stats?.system || {};
  const cpu = num(sys.cpu_load_pct, 0);
  const ram = num(sys.ram?.used_pct, 0);
  const disk = num(sys.disk?.used_pct, 0);
  const docker = stats?.docker || {};
  const brain = stats?.brain || {};
  const machines = stats?.machines || [];
  const audit = stats?.audit || {};
  const settings = stats?.settings || {};
  const recent = stats?.recent || [];
  const offline = stats?._offline;

  return (
    <div className="jx-root">
      <style>{CSS}</style>
      <div className="jx-scan" />
      <div className="jx-grid" />

      {/* Top bar */}
      <div className="jx-top">
        <div className="jx-brand">
          <span className="jx-logo">◢◤</span> SYSTEM<span className="jx-dot">·</span>JARVIS<span className="jx-ver">3.0</span>
        </div>
        <div className="jx-status">
          <span className={`jx-led ${offline ? 'off' : 'on'}`} />
          {offline ? 'TELEMETRY OFFLINE — DEMO' : 'LIVE TELEMETRY'}
          <span className="jx-time">{(stats?.generated_at || '').replace('T', '  ')}</span>
        </div>
      </div>

      {/* Left column */}
      <div className="jx-col jx-left">
        <Panel title="REACTOR · CORE LOAD" side="l">
          <Gauge pct={cpu} />
          <div className="jx-kv"><span>IDLE</span><b>{fix(sys.cpu_idle_pct, 100)}%</b></div>
        </Panel>
        <Panel title="RESOURCE FIELD" side="l">
          <Bar label="MEMORY" pct={ram} sub={`${fix(sys.ram?.used_gb)}/${fix(sys.ram?.total_gb)}G`} />
          <Bar label="DISK" pct={disk} sub={`${fix(sys.disk?.free_gb)}G free`} />
        </Panel>
      </div>

      {/* Right column */}
      <div className="jx-col jx-right">
        <Panel title="NEURAL BRAIN" side="r">
          <div className="jx-kv"><span>STATUS</span><b style={{ color: brain.available ? C : '#ff5a6a' }}>{brain.available ? 'ONLINE' : 'OFFLINE'}</b></div>
          <div className="jx-kv"><span>MODEL</span><b>{brain.model || '—'}</b></div>
          <div className="jx-kv"><span>AUTOPILOT</span><b style={{ color: settings.autopilot_armed ? C : '#888' }}>{settings.autopilot_armed ? 'ARMED' : 'SAFE'}</b></div>
          <div className="jx-kv"><span>MODE</span><b>{settings.dry_run ? 'DRY-RUN' : 'ACTIVE'}</b></div>
        </Panel>
        <Panel title="CONTAINERS" side="r">
          <div className="jx-kv"><span>DOCKER</span><b>{docker.running ? `${num(docker.running_count)} UP` : 'DOWN'}</b></div>
          {(docker.containers || []).slice(0, 3).map((c, i) => (
            <div className="jx-kv sm" key={i}><span>{c.name}</span><b style={{ color: c.state === 'running' ? C : '#888' }}>{c.state}</b></div>
          ))}
          {!(docker.containers || []).length && <div className="jx-kv sm"><span>no containers</span><b>—</b></div>}
        </Panel>
        <Panel title="FLEET" side="r">
          {machines.length ? machines.slice(0, 4).map((m, i) => (
            <div className="jx-machine" key={i}>
              <span className={`jx-led ${m.enabled ? 'on' : 'off'}`} /> {m.name}
              <i>{fix(m.disk_used_pct)}%d · {fix(m.ram_used_pct)}%m</i>
            </div>
          )) : <div className="jx-kv sm"><span>no remote machines</span><b>—</b></div>}
        </Panel>
      </div>

      {/* Bottom ticker */}
      <div className="jx-bottom">
        <div className="jx-bottom-head">ACTIVITY LOG <i>· {num(audit.actions_24h)} actions/24h · {audit.total_freed_human || '0 B'} reclaimed</i></div>
        <div className="jx-ticker">
          {(recent.length ? recent.slice(0, 6) : [{ description: 'Awaiting first maintenance pass…', outcome: 'idle', machine: 'local' }]).map((r: any, i) => (
            <span className="jx-tick" key={i}>
              <em>{(r.machine || 'local').toUpperCase()}</em> {r.action || r.description || '—'}
              {r.freed_human ? <b> +{r.freed_human}</b> : null}
              <i className={`jx-out ${r.outcome === 'success' ? 'ok' : ''}`}>{r.outcome || ''}</i>
            </span>
          ))}
        </div>
      </div>

      {/* Frame brackets */}
      <div className="jx-frame tl" /><div className="jx-frame tr" />
      <div className="jx-frame bl" /><div className="jx-frame br" />
    </div>
  );
}

const CSS = `
.jx-root{position:absolute;inset:0;z-index:20;pointer-events:none;font-family:'Rajdhani','Orbitron',ui-monospace,monospace;color:#bdf3ff;letter-spacing:.06em;overflow:hidden}
.jx-root *{box-sizing:border-box}
.jx-scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0,transparent 2px,rgba(40,224,255,.035) 3px,transparent 4px);mix-blend-mode:screen;animation:jxscan 8s linear infinite}
@keyframes jxscan{to{background-position:0 200px}}
.jx-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(40,224,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(40,224,255,.05) 1px,transparent 1px);background-size:54px 54px;mask-image:radial-gradient(ellipse at center,transparent 30%,#000 80%);opacity:.5}
.jx-top{position:absolute;top:0;left:0;right:0;height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 26px;background:linear-gradient(180deg,rgba(6,20,26,.55),transparent);border-bottom:1px solid rgba(40,224,255,.18)}
.jx-brand{font-family:'Orbitron',sans-serif;font-weight:800;font-size:20px;color:#eafdff;text-shadow:0 0 14px rgba(40,224,255,.6);letter-spacing:.18em}
.jx-logo{color:${C};margin-right:8px;text-shadow:0 0 12px ${C}}
.jx-dot{color:${C};margin:0 4px}
.jx-ver{margin-left:8px;font-size:12px;color:${C};opacity:.8;vertical-align:super}
.jx-status{font-size:11px;display:flex;align-items:center;gap:8px;color:#7fd4e6}
.jx-time{opacity:.6;margin-left:10px;font-variant-numeric:tabular-nums}
.jx-led{width:8px;height:8px;border-radius:50%;display:inline-block;background:${C};box-shadow:0 0 8px ${C};animation:jxpulse 2s ease-in-out infinite}
.jx-led.off{background:#ff5a6a;box-shadow:0 0 8px #ff5a6a}
@keyframes jxpulse{50%{opacity:.35}}
.jx-col{position:absolute;top:74px;bottom:96px;width:300px;display:flex;flex-direction:column;gap:16px}
.jx-left{left:22px}.jx-right{right:22px}
.jx-panel{position:relative;padding:14px 16px;background:rgba(8,26,32,.18);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);border:1px solid rgba(40,224,255,.16);border-radius:3px;box-shadow:inset 0 0 24px rgba(40,224,255,.06),0 0 18px rgba(0,0,0,.3)}
.jx-panel-title{font-size:11px;font-weight:700;letter-spacing:.22em;color:${C};text-shadow:0 0 10px rgba(40,224,255,.5);margin-bottom:10px;opacity:.9}
.jx-corner{position:absolute;width:10px;height:10px;border:1.5px solid ${C};opacity:.7}
.jx-corner.tl{top:-1px;left:-1px;border-right:0;border-bottom:0}
.jx-corner.tr{top:-1px;right:-1px;border-left:0;border-bottom:0}
.jx-corner.bl{bottom:-1px;left:-1px;border-right:0;border-top:0}
.jx-corner.br{bottom:-1px;right:-1px;border-left:0;border-top:0}
.jx-row{margin-bottom:12px}
.jx-row-head{display:flex;justify-content:space-between;font-size:12px;font-weight:600;margin-bottom:5px;color:#d7f6ff}
.jx-sub{font-style:normal;opacity:.5;font-size:10px;margin-left:6px}
.jx-bar{position:relative;height:7px;background:rgba(40,224,255,.08);border:1px solid rgba(40,224,255,.14);border-radius:3px;overflow:hidden}
.jx-bar-fill{height:100%;border-radius:2px;transition:width .6s ease}
.jx-bar-ticks{position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0,transparent 11px,rgba(0,0,0,.5) 12px)}
.jx-gauge{position:relative;display:flex;justify-content:center;margin:2px 0 6px}
.jx-gauge-val{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;line-height:1}
.jx-gauge-val b{font-family:'Orbitron',sans-serif;font-size:34px;text-shadow:0 0 14px currentColor}
.jx-gauge-val span{font-size:13px;opacity:.6}
.jx-gauge-val em{display:block;font-style:normal;font-size:9px;letter-spacing:.2em;color:#7fd4e6;margin-top:3px}
.jx-kv{display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid rgba(40,224,255,.07)}
.jx-kv.sm{font-size:10.5px;opacity:.85}
.jx-kv span{color:#83c6d6}.jx-kv b{color:#eafdff;font-weight:600}
.jx-machine{display:flex;align-items:center;gap:7px;font-size:11.5px;padding:4px 0;color:#d7f6ff}
.jx-machine i{margin-left:auto;font-style:normal;opacity:.55;font-size:10px}
.jx-bottom{position:absolute;left:22px;right:22px;bottom:18px;padding:10px 16px;background:rgba(8,26,32,.18);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);border:1px solid rgba(40,224,255,.16);border-radius:3px}
.jx-bottom-head{font-size:10px;letter-spacing:.2em;color:${C};margin-bottom:6px}
.jx-bottom-head i{font-style:normal;opacity:.55;color:#7fd4e6}
.jx-ticker{display:flex;gap:26px;font-size:11px;white-space:nowrap;overflow:hidden;color:#bfe9f5}
.jx-tick em{font-style:normal;color:${C};opacity:.8;margin-right:6px}
.jx-tick b{color:#7CFFB2}
.jx-out{font-style:normal;margin-left:6px;opacity:.5}
.jx-out.ok{color:#7CFFB2;opacity:.8}
.jx-frame{position:absolute;width:26px;height:26px;border:2px solid rgba(40,224,255,.45)}
.jx-frame.tl{top:12px;left:12px;border-right:0;border-bottom:0}
.jx-frame.tr{top:12px;right:12px;border-left:0;border-bottom:0}
.jx-frame.bl{bottom:12px;left:12px;border-right:0;border-top:0}
.jx-frame.br{bottom:12px;right:12px;border-left:0;border-top:0}
@media (prefers-reduced-motion:reduce){.jx-scan,.jx-led{animation:none}}
`;
