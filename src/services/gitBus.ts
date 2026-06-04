import { useEffect, useReducer } from 'react';

// ── Git Bus ──────────────────────────────────────────────────────────────────
// The live link between J.A.R.V.I.S.'s autonomous VERSION-CONTROL faculty and the
// dashboard it wears as a body. Where TelemetryBus carries what the *laptop* is
// doing and AgentBus carries what the *brain* is doing, this bus carries the live
// state of every git repository J.A.R.V.I.S. is guarding — branch, ahead/behind,
// uncommitted lines, untracked files, stashes, and how recently each working tree
// was snapshotted into recoverable history.
//
// Source of truth: the host-side git daemon (scripts/git-daemon.mjs), reached over
// Server-Sent Events at `/gitd/stream` (Vite proxies it to 127.0.0.1:7878). The
// daemon continuously snapshots every dirty repo into refs/jarvis-snapshots/* so
// uncommitted work is never unrecoverable — and pushes the resulting metrics here
// in real time, so the HUD reflects reality the instant anything changes (including
// commits J.A.R.V.I.S. itself makes).
//
// Pattern mirrors TelemetryBus + AgentBus exactly (singleton + Set<listener> +
// window QA seam) so all three buses compose identically inside the instrument deck.
// jsdom-safe: with no EventSource (unit tests / SSR) the bus simply stays in its
// disconnected idle state and never opens a socket or throws.

export interface GitRepo {
  name: string;            // repo directory name (display)
  path: string;            // absolute path
  branch: string;          // current branch (or 'DETACHED')
  protected: boolean;      // on a protected branch (main/master/release/*)
  ahead: number;           // commits ahead of upstream (unpushed)
  behind: number;          // commits behind upstream
  staged: number;          // staged file count
  unstaged: number;        // modified-but-unstaged file count
  untracked: number;       // untracked file count (the unrecoverable category)
  added: number;           // +lines in the working tree vs HEAD
  deleted: number;         // -lines in the working tree vs HEAD
  stashes: number;         // stash entries
  dirty: boolean;          // working tree has changes
  risk: number;            // 0..1 composite loss-risk (uncommitted + untracked + unpushed + staleness)
  lastSubject: string;     // last commit subject
  lastAgeSec: number;      // age of last commit (s); -1 unknown
  snapshotAgeSec: number;  // age of most recent jarvis snapshot (s); -1 = none yet
}

export interface GitSummary {
  repos: number;              // total repos watched
  dirty: number;              // repos with uncommitted changes
  atRisk: number;             // repos with risk above the alert threshold
  uncommittedLines: number;   // Σ (added + deleted) across all repos
  untracked: number;          // Σ untracked files
  ahead: number;              // Σ unpushed commits
  behind: number;             // Σ commits behind upstream
  stashes: number;            // Σ stash entries
  snapshots: number;          // total jarvis snapshot refs preserved
  lastSnapshotAgeSec: number; // age of the most recent snapshot anywhere (s); -1 none
  protectedDirty: number;     // repos sitting dirty ON a protected branch (a smell)
  avgRisk: number;            // 0..1 mean loss-risk across all watched repos
  maxRisk: number;            // 0..1 worst single-repo loss-risk
  scanning: boolean;          // daemon is mid-scan
}

export interface GitSnapshot {
  connected: boolean;         // SSE link to the daemon is live
  ts: number;                 // daemon snapshot timestamp (ms)
  version: string;            // daemon version
  repos: GitRepo[];           // per-repo state, daemon-sorted (most at-risk first)
  summary: GitSummary;
}

// Idle defaults — also the jsdom / daemon-offline fallback. A HUD reading this
// renders an honest "link down" state without flatlining or throwing.
const EMPTY_SUMMARY: GitSummary = {
  repos: 0, dirty: 0, atRisk: 0, uncommittedLines: 0, untracked: 0,
  ahead: 0, behind: 0, stashes: 0, snapshots: 0, lastSnapshotAgeSec: -1,
  protectedDirty: 0, avgRisk: 0, maxRisk: 0, scanning: false,
};

const state: GitSnapshot = {
  connected: false,
  ts: 0,
  version: '—',
  repos: [],
  summary: { ...EMPTY_SUMMARY },
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// ── SSE lifecycle ─────────────────────────────────────────────────────────────
// Endpoint is configurable so a production build (no Vite proxy) can point straight
// at the daemon; defaults to the proxied same-origin path used in `npm run dev`.
const STREAM_URL =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_GIT_DAEMON_URL) ||
  '/gitd';

let started = false;
let es: EventSource | null = null;

function applyWire(payload: Partial<GitSnapshot>) {
  state.ts = typeof payload.ts === 'number' ? payload.ts : state.ts;
  state.version = typeof payload.version === 'string' ? payload.version : state.version;
  if (Array.isArray(payload.repos)) state.repos = payload.repos as GitRepo[];
  if (payload.summary) state.summary = { ...EMPTY_SUMMARY, ...payload.summary };
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  // No EventSource (jsdom / unsupported) → remain a quiet, disconnected idle bus.
  if (typeof EventSource === 'undefined') return;
  try {
    es = new EventSource(`${STREAM_URL}/stream`);
    es.addEventListener('open', () => { state.connected = true; emit(); });
    es.addEventListener('git', (ev) => {
      try {
        applyWire(JSON.parse((ev as MessageEvent).data));
        state.connected = true;
        emit();
      } catch { /* ignore a malformed frame */ }
    });
    // EventSource auto-reconnects natively; we only reflect the link state.
    es.addEventListener('error', () => { state.connected = false; emit(); });
  } catch {
    started = false; // allow a later retry
  }
}

function stop() {
  if (!started) return;
  started = false;
  if (es) { try { es.close(); } catch { /* ignore */ } es = null; }
  state.connected = false;
}

export const GitBus = {
  get: (): GitSnapshot => state,
  subscribe(l: () => void): () => void { listeners.add(l); return () => listeners.delete(l); },
  start,
  stop,
  // Dev/QA seam: pin git state for deterministic golden frames, mirroring
  // Telemetry.override (e.g. GitBus.override({ connected: true, summary: {...} })).
  override(patch: Partial<GitSnapshot>) {
    if (typeof patch.connected === 'boolean') state.connected = patch.connected;
    applyWire(patch);
    emit();
  },
};

export function useGit(): GitSnapshot {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => { GitBus.start(); return GitBus.subscribe(force); }, []);
  return state;
}

// QA seam — mirrors AgentBus / Telemetry. Lets a console or headless capture drive the
// version-control side of the dashboard (e.g. GitBus.override({connected:true,...})).
if (typeof window !== 'undefined') (window as unknown as { GitBus: typeof GitBus }).GitBus = GitBus;
