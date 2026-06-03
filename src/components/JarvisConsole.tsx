import React, { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { JarvisService, JarvisMessage } from '../services/jarvisService';
import { consoleSheet, types } from '../theatre/project';
import { RegionName } from '../types';
import DecryptedText from '../TextAnimations/DecryptedText';

// GSAP numeric ease — counts a readout up from `from` to `to` once. Returns the tween
// so the caller can kill it on cleanup.
function animateCounter(el: HTMLElement, from: number, to: number, duration = 2.0): gsap.core.Tween {
  const obj = { value: from };
  return gsap.to(obj, {
    value: to,
    duration,
    ease: 'power2.out',
    onUpdate() {
      el.textContent = Math.round(obj.value).toString();
    },
  });
}

// Theatre.js console reveal — fades the panel in and staggers its opening lines
// (keyframed in src/theatre/project.ts). Module scope so it survives remounts.
const consoleObj = consoleSheet.object('console-lines', {
  linesVisible: types.number(0, { range: [0, 20] }),
  opacity: types.number(0, { range: [0, 1] }),
});

// J.A.R.V.I.S. Console — the holographic comms surface the reasoning core speaks
// through. The Docker brain "wears" this panel: tokens stream in live, reasoning
// shimmers as a faint sub-channel, and live dashboard telemetry is fed to the core
// each turn so JARVIS is always aware of the state of the body it inhabits.

interface JarvisConsoleProps {
  currentRegion: RegionName;
}

interface LogEntry {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
}

const GREETING =
  'Systems online, Sir. Reactor core stable, holographic emitters calibrated. How may I assist?';

const QUICK_COMMANDS = [
  'System status report',
  'Analyse the current sector',
  'Run a diagnostic',
  'What can you do?',
];

const JarvisConsole: React.FC<JarvisConsoleProps> = ({ currentRegion }) => {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState('');
  const [log, setLog] = useState<LogEntry[]>([
    { id: 0, role: 'assistant', text: GREETING },
  ]);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'speaking'>('idle');
  const [reasoning, setReasoning] = useState('');
  const [online, setOnline] = useState<boolean | null>(null);
  const [model, setModel] = useState('MiniMax-M2');
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const [containerOpacity, setContainerOpacity] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const idRef = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef<HTMLSpanElement>(null);
  const loadRef = useRef<HTMLSpanElement>(null);
  const latRef = useRef<HTMLSpanElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);

  // Probe the brain on mount (and periodically) for the status light. The polling
  // interval lives in JarvisService, so this component holds no timers of its own.
  useEffect(() => {
    return JarvisService.subscribeHealth((h) => {
      setOnline(!!h && h.key_configured);
      if (h?.model) setModel(h.model);
    });
  }, []);

  // Theatre.js mount reveal: fade the console in and stagger its opening lines.
  useEffect(() => {
    const unsub = consoleObj.onValuesChange(({ linesVisible, opacity }) => {
      setVisibleLineCount(Math.round(linesVisible));
      setContainerOpacity(opacity);
    });
    consoleSheet.sequence.play({ iterationCount: 1, range: [0, 2] }).then((completed) => {
      if (completed) setRevealed(true);
    });
    return () => {
      unsub();
      consoleSheet.sequence.pause();
    };
  }, []);

  // GSAP: count the calibration readouts up once and stagger the quick-command chips in.
  useEffect(() => {
    const tweens: gsap.core.Tween[] = [];
    if (syncRef.current) tweens.push(animateCounter(syncRef.current, 0, 100, 2.2));
    if (loadRef.current) tweens.push(animateCounter(loadRef.current, 0, 87, 2.6));
    if (latRef.current) tweens.push(animateCounter(latRef.current, 0, 12, 1.8));

    let tl: gsap.core.Timeline | null = null;
    const chips = quickRef.current?.querySelectorAll('.quick-cmd');
    if (chips && chips.length) {
      tl = gsap.timeline();
      tl.fromTo(
        chips,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.3, stagger: 0.08, ease: 'power2.out' },
      );
    }

    return () => {
      tweens.forEach((t) => t.kill());
      if (tl) tl.kill();
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log, reasoning]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const liveContext = useCallback(() => {
    const d = new Date();
    return {
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`,
      active_sector: String(currentRegion),
      reactor_status: 'STABLE',
      threat_level: 'NOMINAL',
    };
  }, [currentRegion]);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || status !== 'idle') return;

      const userEntry: LogEntry = { id: idRef.current++, role: 'user', text };
      const assistantId = idRef.current++;

      // Build conversation history from the existing log (+ the new user line).
      const history: JarvisMessage[] = [...log, userEntry].map((e) => ({
        role: e.role,
        content: e.text,
      }));

      setLog((l) => [
        ...l,
        userEntry,
        { id: assistantId, role: 'assistant', text: '', streaming: true },
      ]);
      setInput('');
      setReasoning('');
      setStatus('thinking');

      abortRef.current = JarvisService.chat(history, liveContext(), {
        onStatus: () => setStatus('thinking'),
        onReasoning: (t) => setReasoning((r) => (r + t).slice(-400)),
        onToken: (t) => {
          setStatus('speaking');
          setLog((l) =>
            l.map((e) => (e.id === assistantId ? { ...e, text: e.text + t } : e)),
          );
        },
        onError: (msg) => {
          setLog((l) =>
            l.map((e) =>
              e.id === assistantId
                ? { ...e, text: e.text || `⚠ ${msg}`, streaming: false }
                : e,
            ),
          );
        },
        onDone: () => {
          setStatus('idle');
          setReasoning('');
          setLog((l) =>
            l.map((e) =>
              e.id === assistantId
                ? {
                    ...e,
                    streaming: false,
                    text: e.text || '⚠ The reasoning core returned no response, Sir.',
                  }
                : e,
            ),
          );
        },
      });
    },
    [log, status, liveContext],
  );

  const statusColor =
    online === null ? '#888' : online ? '#00F0FF' : '#FF2A2A';
  const statusLabel =
    status === 'thinking'
      ? 'REASONING'
      : status === 'speaking'
        ? 'TRANSMITTING'
        : online === false
          ? 'OFFLINE'
          : online === null
            ? 'LINKING'
            : 'STANDBY';

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-6 right-6 z-50 pointer-events-auto flex items-center gap-2 px-4 py-2 bg-black/60 border border-holo-cyan/70 text-holo-cyan font-display text-xs tracking-[0.25em] hover:bg-holo-cyan/10 transition-all"
        style={{ backdropFilter: 'blur(6px)', boxShadow: '0 0 18px rgba(0,240,255,0.35)' }}
      >
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: statusColor }} />
        J.A.R.V.I.S.
      </button>
    );
  }

  // During the Theatre reveal, stagger the opening lines in; once complete, show all.
  const shownLog = revealed ? log : log.slice(0, visibleLineCount);

  return (
    <div
      className="absolute bottom-6 right-6 z-50 pointer-events-auto w-[380px] max-w-[92vw] font-sans text-holo-cyan flex flex-col"
      style={{
        height: 'min(520px, 70vh)',
        opacity: containerOpacity,
        background: 'linear-gradient(160deg, rgba(0,18,28,0.82), rgba(0,8,16,0.92))',
        border: '1px solid rgba(0,240,255,0.45)',
        boxShadow: '0 0 40px rgba(0,240,255,0.18), inset 0 0 30px rgba(0,80,120,0.12)',
        backdropFilter: 'blur(8px)',
        clipPath:
          'polygon(0 14px, 14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)',
      }}
    >
      {/* corner ticks */}
      <span className="absolute top-0 right-0 w-4 h-[1px] bg-holo-cyan/70" />
      <span className="absolute top-0 right-0 w-[1px] h-4 bg-holo-cyan/70" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-holo-cyan/25">
        <div className="flex items-center gap-3">
          <div className="relative w-7 h-7 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-holo-cyan/60 animate-spin-slow" />
            <span
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ background: statusColor, boxShadow: `0 0 10px ${statusColor}` }}
            />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold tracking-[0.3em] text-sm">J.A.R.V.I.S.</div>
            <div className="text-[9px] tracking-[0.2em] text-holo-cyan/50">{model}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] tracking-[0.25em]" style={{ color: statusColor }}>
            {statusLabel}
          </span>
          <button
            onClick={() => setOpen(false)}
            className="text-holo-cyan/60 hover:text-holo-cyan text-lg leading-none"
            aria-label="Minimise"
          >
            ⌄
          </button>
        </div>
      </div>

      {/* Calibration telemetry — GSAP counts these up once on mount. */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-holo-cyan/10 text-[9px] tracking-[0.18em] text-holo-cyan/55 font-display">
        <span>NEURAL SYNC <span ref={syncRef} className="text-holo-cyan/90">0</span>%</span>
        <span>CORE LOAD <span ref={loadRef} className="text-holo-cyan/90">0</span>%</span>
        <span>LATENCY <span ref={latRef} className="text-holo-cyan/90">0</span>MS</span>
      </div>

      {/* Reasoning sub-channel (faint, only while thinking) */}
      {reasoning && (
        <div className="px-4 py-1 text-[9px] tracking-wide text-holo-blue/50 italic truncate border-b border-holo-cyan/10">
          ⟳ {reasoning}
        </div>
      )}

      {/* Message log */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
        {shownLog.map((e) =>
          e.role === 'user' ? (
            <div key={e.id} className="flex justify-end">
              <div className="max-w-[85%] px-3 py-1.5 text-right text-holo-cyan/90 border-r-2 border-holo-cyan/60 bg-holo-cyan/5">
                {e.text}
              </div>
            </div>
          ) : (
            <div key={e.id} className="flex gap-2">
              <span className="text-holo-cyan/40 select-none mt-[2px] text-xs">▸</span>
              <div className="max-w-[88%] text-holo-cyan/95 leading-snug">
                {e.streaming ? (
                  e.text
                ) : (
                  <DecryptedText
                    text={e.text || ''}
                    speed={30}
                    maxIterations={6}
                    sequential={true}
                    revealDirection="start"
                    animateOn="view"
                    className="text-holo-cyan/95 leading-snug font-sans text-sm"
                  />
                )}
                {e.streaming && (
                  <span className="inline-block w-2 h-3.5 ml-0.5 align-middle bg-holo-cyan animate-blink" />
                )}
              </div>
            </div>
          ),
        )}
        <div ref={logEndRef} />
      </div>

      {/* Quick commands */}
      <div ref={quickRef} className="px-3 pb-2 flex flex-wrap gap-1.5">
        {QUICK_COMMANDS.map((c) => (
          <button
            key={c}
            onClick={() => send(c)}
            disabled={status !== 'idle'}
            className="quick-cmd text-[9px] tracking-wide px-2 py-1 border border-holo-cyan/25 text-holo-cyan/70 hover:border-holo-cyan/70 hover:text-holo-cyan disabled:opacity-40 transition-all"
          >
            {c}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 px-3 py-3 border-t border-holo-cyan/25"
      >
        <span className="text-holo-cyan/50 text-xs select-none">›</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={status === 'idle' ? 'Speak to JARVIS…' : 'JARVIS is responding…'}
          disabled={status !== 'idle'}
          className="flex-1 bg-transparent outline-none text-sm text-holo-cyan placeholder-holo-cyan/30 tracking-wide disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status !== 'idle' || !input.trim()}
          className="font-display text-[10px] tracking-[0.2em] px-3 py-1 border border-holo-cyan/50 text-holo-cyan hover:bg-holo-cyan/10 disabled:opacity-30 transition-all"
        >
          SEND
        </button>
      </form>
    </div>
  );
};

export default JarvisConsole;
