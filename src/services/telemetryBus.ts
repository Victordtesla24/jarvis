import { useEffect, useReducer } from 'react';

// ── Telemetry Bus ────────────────────────────────────────────────────────────
// The live link between the OPERATOR'S MACHINE and the dashboard it wears as a
// body. Where AgentBus carries what J.A.R.V.I.S. *is doing*, this bus carries what
// the *laptop* is doing — battery, CPU cores + main-thread load, JS heap, network,
// frame-rate, storage, display, uptime, pointer presence — sourced from real
// Navigator/Performance APIs. The HUD instruments read it every draw frame so the
// whole dashboard shows genuine real-time stats instead of synthetic noise.
//
// Honesty: REAL = cores, heap (Chromium), deviceMemory, battery, network, fps,
// storage, display, gpu, platform, online, visibility, pointer. PROXY/DERIVED =
// `cpuLoad` (render/main-thread-load proxy, NOT OS CPU%) and `perCore` (synthesized
// from the real aggregate load + real core count). Panels label these as estimates.
//
// Pattern mirrors AgentBus (singleton + Set<listener> + window QA seam) so the two
// buses compose identically inside the instrument deck.

export interface TelemetrySnapshot {
  // status
  ready: boolean;          // start() ran and the first slow-tick completed
  uptimeMs: number;        // ms since first start()
  visibility: 'visible' | 'hidden';
  online: boolean;

  // 1. CPU cores (real)
  cores: number;           // navigator.hardwareConcurrency

  // 2. CPU / main-thread load (proxy, 0..1)
  cpuLoad: number;         // render/main-thread-load proxy — NOT OS CPU%
  perCore: number[];       // length === cores, each 0..1 — DERIVED (synthesized)
  jankLoad: number;        // frame-jank component (diagnostic)
  longtaskLoad: number;    // longtask blocking-ratio component (diagnostic)

  // 3. Memory
  heapLoad: number;        // usedJSHeapSize / jsHeapSizeLimit (Chromium)
  heapUsedMB: number;
  heapLimitMB: number;
  deviceMemoryGB: number;
  memorySupported: boolean;

  // 4. Battery
  batteryLevel: number;        // 0..1
  batteryCharging: boolean;
  batteryChargingTime: number; // seconds to full; -1 = unknown
  batteryDischargeTime: number;// seconds to empty; -1 = unknown
  batterySupported: boolean;

  // 5. Network
  effectiveType: string;   // '4g' | '3g' | ...
  downlinkMbps: number;
  rttMs: number;
  saveData: boolean;
  netLoad: number;         // 0..1 normalized link quality (1 = great)
  networkSupported: boolean;

  // 6. FPS + frame time
  fps: number;
  frameMs: number;
  refreshHz: number;
  frameBudgetMs: number;

  // 7. Storage
  storageLoad: number;     // usage / quota
  storageUsageMB: number;
  storageQuotaMB: number;
  storageSupported: boolean;

  // 8. Display
  screenW: number; screenH: number;
  dpr: number;
  colorDepth: number;
  orientation: string;

  // 10. GPU + platform (static)
  gpu: string;
  platform: string;

  // 11. Pointer / operator activity
  pointerActivity: number; // 0..1, decays to 0 over ~2s after last pointermove
}

// Idle defaults — also the jsdom/unsupported fallback. Chosen so a HUD animates
// plausibly even with zero browser support (gauges never flatline).
const state: TelemetrySnapshot = {
  ready: false, uptimeMs: 0, visibility: 'visible', online: true,
  cores: 8,
  cpuLoad: 0.18, perCore: [], jankLoad: 0.18, longtaskLoad: 0,
  heapLoad: 0.34, heapUsedMB: 0, heapLimitMB: 0, deviceMemoryGB: 8, memorySupported: false,
  batteryLevel: 1, batteryCharging: true, batteryChargingTime: 0, batteryDischargeTime: -1, batterySupported: false,
  effectiveType: '4g', downlinkMbps: 10, rttMs: 50, saveData: false, netLoad: 0.85, networkSupported: false,
  fps: 60, frameMs: 1000 / 60, refreshHz: 60, frameBudgetMs: 1000 / 60,
  storageLoad: 0.12, storageUsageMB: 0, storageQuotaMB: 0, storageSupported: false,
  screenW: 1920, screenH: 1080, dpr: 1, colorDepth: 24, orientation: 'landscape-primary',
  gpu: 'UNKNOWN GPU', platform: 'unknown',
  pointerActivity: 0,
};

// ── constants (single source) ────────────────────────────────────────────────
const SLOW_MS = 500;
const FPS_ALPHA = 0.1;
const JANK_ALPHA = 0.1;
const LT_ALPHA = 0.3;
const CPU_ALPHA = 0.25;
const IDLE_FLOOR = 0.12;
const POINTER_DECAY_MS = 2000;
const POINTER_THROTTLE_MS = 50;
const STORAGE_EVERY_TICKS = 4;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const getRaf = (): ((cb: FrameRequestCallback) => number) =>
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (cb: FrameRequestCallback) => setTimeout(() => cb(now()), 16) as unknown as number;

// ── lifecycle state ──────────────────────────────────────────────────────────
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let started = false;
let t0 = 0;
let rafId = 0;
let slowTimer: ReturnType<typeof setInterval> | null = null;
let longtaskObserver: PerformanceObserver | null = null;
const cleanups: Array<() => void> = [];

// EMA accumulators + windows
let jankEMA = state.jankLoad, longtaskEMA = 0, cpuEMA = state.cpuLoad;
let blockedMsAccum = 0, lastSlowAt = 0, slowTickN = 0;
let refreshDirty = true; const refreshSamples: number[] = [];

// per-core character (seeded once, deterministic — no per-tick alloc)
let coreBias: number[] = [], corePhase: number[] = [];
const hash = (i: number) => { const s = Math.sin(i * 12.9898 + 7.13) * 43758.5453; return s - Math.floor(s); };

// ── static reads (cores / display / gpu / platform / deviceMemory) ───────────
function readStatic() {
  try {
    const nav = navigator as unknown as { hardwareConcurrency?: number; deviceMemory?: number; userAgentData?: { platform?: string }; platform?: string };
    state.cores = Math.max(1, (nav.hardwareConcurrency as number) | 0) || 8;
    state.deviceMemoryGB = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : 8;
    state.platform = nav.userAgentData?.platform || nav.platform || 'unknown';
  } catch { /* defaults hold */ }
  try {
    state.screenW = (typeof screen !== 'undefined' && screen.width) || state.screenW;
    state.screenH = (typeof screen !== 'undefined' && screen.height) || state.screenH;
    state.dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    state.colorDepth = (typeof screen !== 'undefined' && screen.colorDepth) || 24;
    state.orientation = (typeof screen !== 'undefined' && (screen as unknown as { orientation?: { type?: string } }).orientation?.type) || state.orientation;
  } catch { /* defaults hold */ }
  state.gpu = readGpu();
}

function readGpu(): string {
  try {
    if (typeof document === 'undefined') return 'UNKNOWN GPU';
    const cvs = document.createElement('canvas');
    const gl = (cvs.getContext('webgl') || cvs.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'UNKNOWN GPU';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter((ext as { UNMASKED_RENDERER_WEBGL: number }).UNMASKED_RENDERER_WEBGL) : null;
    (gl.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null)?.loseContext?.();
    return (r && String(r)) || 'UNKNOWN GPU';
  } catch { return 'UNKNOWN GPU'; }
}

// ── battery (async, degrades silently) ───────────────────────────────────────
function wireBattery() {
  const nav = navigator as unknown as { getBattery?: () => Promise<BatteryLike> };
  if (typeof nav.getBattery !== 'function') return;
  nav.getBattery().then((b) => {
    const sync = () => {
      state.batterySupported = true;
      state.batteryLevel = clamp01(b.level);
      state.batteryCharging = !!b.charging;
      state.batteryChargingTime = Number.isFinite(b.chargingTime) ? b.chargingTime : -1;
      state.batteryDischargeTime = Number.isFinite(b.dischargingTime) ? b.dischargingTime : -1;
      emit();
    };
    (['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange'] as const).forEach((ev) => {
      b.addEventListener(ev, sync); cleanups.push(() => b.removeEventListener(ev, sync));
    });
    sync();
  }).catch(() => { /* keep idle-charging fallback */ });
}
interface BatteryLike {
  level: number; charging: boolean; chargingTime: number; dischargingTime: number;
  addEventListener(t: string, l: () => void): void; removeEventListener(t: string, l: () => void): void;
}

// ── network ──────────────────────────────────────────────────────────────────
interface ConnectionLike {
  effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean;
  addEventListener(t: string, l: () => void): void; removeEventListener(t: string, l: () => void): void;
}
function wireNetwork() {
  const nav = navigator as unknown as { connection?: ConnectionLike; mozConnection?: ConnectionLike; webkitConnection?: ConnectionLike };
  const c = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (!c) return;
  const sync = () => {
    state.networkSupported = true;
    state.effectiveType = c.effectiveType ?? 'unknown';
    state.downlinkMbps = typeof c.downlink === 'number' ? c.downlink : state.downlinkMbps;
    state.rttMs = typeof c.rtt === 'number' ? c.rtt : state.rttMs;
    state.saveData = !!c.saveData;
    const dl = clamp01(state.downlinkMbps / 10);
    const lat = clamp01(1 - state.rttMs / 300);
    state.netLoad = clamp01(0.6 * dl + 0.4 * lat);
    emit();
  };
  c.addEventListener('change', sync); cleanups.push(() => c.removeEventListener('change', sync));
  sync();
}
function wireOnline() {
  if (typeof window === 'undefined') return;
  const on = () => { state.online = true; emit(); };
  const off = () => { state.online = false; emit(); };
  state.online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  window.addEventListener('online', on); window.addEventListener('offline', off);
  cleanups.push(() => { window.removeEventListener('online', on); window.removeEventListener('offline', off); });
}

// ── visibility / orientation ─────────────────────────────────────────────────
function wireVisibility() {
  if (typeof document === 'undefined') return;
  const sync = () => {
    state.visibility = document.visibilityState === 'hidden' ? 'hidden' : 'visible';
    if (state.visibility === 'visible') refreshDirty = true;
    emit();
  };
  document.addEventListener('visibilitychange', sync); cleanups.push(() => document.removeEventListener('visibilitychange', sync));
  sync();
}
function wireOrientation() {
  const o = (typeof screen !== 'undefined' && (screen as unknown as { orientation?: { type?: string; addEventListener?: (t: string, l: () => void) => void; removeEventListener?: (t: string, l: () => void) => void } }).orientation) || null;
  if (!o?.addEventListener) return;
  const sync = () => { state.orientation = o.type ?? state.orientation; state.dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || state.dpr; };
  o.addEventListener('change', sync); cleanups.push(() => o.removeEventListener?.('change', sync));
}

// ── pointer presence ─────────────────────────────────────────────────────────
function wirePointer() {
  if (typeof window === 'undefined') return;
  let lastMove = 0;
  const onMove = () => { const t = now(); if (t - lastMove < POINTER_THROTTLE_MS) return; lastMove = t; state.pointerActivity = 1; };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('mousemove', onMove, { passive: true });
  cleanups.push(() => { window.removeEventListener('pointermove', onMove); window.removeEventListener('mousemove', onMove); });
}

// ── longtask blocking ratio ──────────────────────────────────────────────────
function wireLongtasks() {
  try {
    const supported = typeof PerformanceObserver !== 'undefined'
      && (PerformanceObserver as unknown as { supportedEntryTypes?: string[] }).supportedEntryTypes?.includes('longtask');
    if (!supported) return;
    longtaskObserver = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) blockedMsAccum += e.duration;
    });
    longtaskObserver.observe({ entryTypes: ['longtask'] });
  } catch { /* Safari throws on unknown entryType */ }
}

// ── rAF loop: fps / frameMs / jank / uptime / pointer decay ──────────────────
function startRaf() {
  const raf = getRaf();
  let last = now();
  const loop = (t: number) => {
    const dt = t - last; last = t;
    if (dt > 0 && dt < 1000 && state.visibility === 'visible') {
      const instFps = 1000 / dt;
      state.fps = state.fps + FPS_ALPHA * (instFps - state.fps);
      state.frameMs = state.frameMs + FPS_ALPHA * (dt - state.frameMs);
      if (refreshDirty && refreshSamples.length < 120) refreshSamples.push(instFps);
      const over = clamp01((dt - state.frameBudgetMs) / state.frameBudgetMs);
      jankEMA = jankEMA + JANK_ALPHA * (over - jankEMA);
      state.jankLoad = jankEMA;
      state.pointerActivity = Math.max(0, state.pointerActivity - dt / POINTER_DECAY_MS);
    }
    state.uptimeMs = t - t0;
    rafId = raf(loop);
  };
  rafId = raf(loop);
}

// settle refreshHz from the 95th-pctile of early instFps samples, snap to a common rate
function settleRefresh() {
  if (!refreshDirty || refreshSamples.length < 30) return;
  const sorted = refreshSamples.slice().sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const common = [60, 75, 90, 120, 144, 165, 240];
  let best = 60, bestD = Infinity;
  for (const c of common) { const d = Math.abs(c - p95); if (d < bestD) { bestD = d; best = c; } }
  state.refreshHz = best; state.frameBudgetMs = 1000 / best;
  refreshDirty = false; refreshSamples.length = 0;
}

// ── slow tick: memory / storage / longtask normalize / per-core / cpuLoad ────
function sampleMemory() {
  const m = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  state.memorySupported = !!(m && typeof m.usedJSHeapSize === 'number');
  if (state.memorySupported && m) {
    // how full the live allocated heap is (used / currently-allocated) — a dynamic,
    // meaningful signal, vs used/jsHeapSizeLimit which sits near 0 against the multi-GB cap.
    state.heapLoad = clamp01(m.usedJSHeapSize / Math.max(1, m.totalJSHeapSize));
    state.heapUsedMB = m.usedJSHeapSize / 1048576;
    state.heapLimitMB = m.totalJSHeapSize / 1048576; // the gauge denominator: allocated total
  } else {
    state.heapLoad = clamp01(0.3 + 0.06 * Math.sin(state.uptimeMs / 9000));
  }
}
function sampleStorage() {
  const s = (navigator as unknown as { storage?: { estimate?: () => Promise<{ usage?: number; quota?: number }> } }).storage;
  if (!s || typeof s.estimate !== 'function') return;
  s.estimate().then((e) => {
    state.storageSupported = true;
    const usage = e.usage ?? 0, quota = e.quota ?? 0;
    state.storageUsageMB = usage / 1048576;
    state.storageQuotaMB = quota / 1048576;
    if (quota > 0) state.storageLoad = clamp01(usage / quota);
  }).catch(() => { /* keep fallback */ });
}
function updatePerCore(nowMs: number) {
  if (state.perCore.length !== state.cores) state.perCore = new Array(state.cores).fill(state.cpuLoad);
  const base = state.cpuLoad;
  let sum = 0;
  for (let i = 0; i < state.perCore.length; i++) {
    const drift = 0.06 * Math.sin(nowMs / 4000 + corePhase[i]);
    const v = clamp01(base + coreBias[i] + drift);
    state.perCore[i] = v; sum += v;
  }
  const mean = sum / state.perCore.length || 1;
  const k = base / mean;
  for (let i = 0; i < state.perCore.length; i++) state.perCore[i] = clamp01(state.perCore[i] * k);
}
function slowTick() {
  const t = now();
  const windowMs = lastSlowAt ? t - lastSlowAt : SLOW_MS;
  lastSlowAt = t;
  // longtask → blocking ratio
  const ratio = clamp01(blockedMsAccum / Math.max(1, windowMs));
  longtaskEMA = longtaskEMA + LT_ALPHA * (ratio - longtaskEMA);
  state.longtaskLoad = longtaskEMA;
  blockedMsAccum = 0;
  // combine into cpuLoad
  const raw = Math.max(state.jankLoad, state.longtaskLoad * 0.9 + state.jankLoad * 0.1);
  cpuEMA = cpuEMA + CPU_ALPHA * (raw - cpuEMA);
  state.cpuLoad = clamp01(IDLE_FLOOR + (1 - IDLE_FLOOR) * cpuEMA);

  sampleMemory();
  if (slowTickN % STORAGE_EVERY_TICKS === 0) sampleStorage();
  settleRefresh();
  updatePerCore(t);

  slowTickN++;
  state.ready = true;
  emit();
}

// ── public lifecycle ─────────────────────────────────────────────────────────
function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  t0 = now();
  // seed per-core character once
  coreBias = Array.from({ length: 64 }, (_, i) => (hash(i) - 0.5) * 0.24);
  corePhase = Array.from({ length: 64 }, (_, i) => hash(i + 100) * Math.PI * 2);
  readStatic();
  state.perCore = new Array(state.cores).fill(state.cpuLoad);
  wireBattery(); wireNetwork(); wireOnline(); wireVisibility(); wireOrientation(); wirePointer(); wireLongtasks();
  startRaf();
  slowTimer = setInterval(slowTick, SLOW_MS);
  slowTick();
}

function stop() {
  if (!started) return; started = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  if (slowTimer) { clearInterval(slowTimer); slowTimer = null; }
  if (longtaskObserver) { longtaskObserver.disconnect(); longtaskObserver = null; }
  cleanups.splice(0).forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

export const Telemetry = {
  get: (): TelemetrySnapshot => state,
  subscribe(l: () => void): () => void { listeners.add(l); return () => listeners.delete(l); },
  start,
  stop,
  // Dev/QA seam: pin metrics for deterministic golden frames (e.g. Telemetry.override({batteryLevel:0.1})).
  override(patch: Partial<TelemetrySnapshot>) { Object.assign(state, patch); emit(); },
};

export function useTelemetry(): TelemetrySnapshot {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => { Telemetry.start(); return Telemetry.subscribe(force); }, []);
  return state;
}

// QA seam — mirrors AgentBus (agentState.ts). Inert in normal use; lets a console or
// headless capture drive the machine-telemetry side of the dashboard.
if (typeof window !== 'undefined') (window as unknown as { Telemetry: typeof Telemetry }).Telemetry = Telemetry;
