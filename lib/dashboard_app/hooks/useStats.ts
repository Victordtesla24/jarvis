import { useEffect, useRef, useState } from 'react';

// Live telemetry from the JARVIS backend (lib/dashboard.py · loopback :7327).
// Shape mirrors collect_stats(). Every field is optional/safe: one dead sensor
// must never blank the HUD, and when the backend isn't reachable (e.g. plain
// `vite dev` with no proxy) we degrade to calm idle values instead of throwing.

export interface Stats {
  generated_at?: string;
  system?: {
    disk?: { total_gb?: number; used_gb?: number; free_gb?: number; used_pct?: number };
    ram?: { total_gb?: number; used_gb?: number; used_pct?: number };
    cpu_idle_pct?: number;
    cpu_load_pct?: number;
  };
  docker?: { running?: boolean; running_count?: number; containers?: Array<{ name: string; image: string; state: string; status: string }> };
  brain?: { available?: boolean; model?: string };
  audit?: { total_actions?: number; actions_24h?: number; total_freed_human?: string; by_machine?: Record<string, number> };
  machines?: Array<{ name: string; hostname?: string; enabled?: boolean; disk_used_pct?: number; ram_used_pct?: number; last_updated?: string }>;
  settings?: { dry_run?: boolean; notify?: boolean; dormancy_days?: number; idle_threshold?: number; autopilot_armed?: boolean };
  recent?: Array<{ timestamp?: string; machine?: string; action?: string; freed_human?: string; outcome?: string; description?: string }>;
  _offline?: boolean;
}

// Calm idle fallback so the HUD is alive even with no backend (demo / dev).
const FALLBACK: Stats = {
  system: {
    cpu_load_pct: 8,
    cpu_idle_pct: 92,
    ram: { used_pct: 41, used_gb: 13.1, total_gb: 32 },
    disk: { used_pct: 57, used_gb: 571, free_gb: 429, total_gb: 1000 },
  },
  docker: { running: false, running_count: 0, containers: [] },
  brain: { available: true, model: 'minimax' },
  audit: { total_actions: 0, actions_24h: 0, total_freed_human: '0 B' },
  machines: [],
  settings: { autopilot_armed: true, dry_run: false, idle_threshold: 80, notify: false, dormancy_days: 7 },
  recent: [],
  _offline: true,
};

export function useStats(intervalMs = 2000): Stats {
  const [stats, setStats] = useState<Stats>(FALLBACK);
  const last = useRef<Stats>(FALLBACK);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    const poll = async () => {
      const ctrl = new AbortController();
      const to = window.setTimeout(() => ctrl.abort(), Math.max(1500, intervalMs - 200));
      try {
        const res = await fetch('/api/stats', { cache: 'no-store', signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Stats;
        if (alive) {
          last.current = { ...data, _offline: false };
          setStats(last.current);
        }
      } catch {
        // Keep the last good payload if we ever had one; otherwise stay on FALLBACK.
        if (alive) setStats({ ...last.current, _offline: true });
      } finally {
        window.clearTimeout(to);
        if (alive) timer = window.setTimeout(poll, intervalMs);
      }
    };

    poll();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [intervalMs]);

  return stats;
}

// Convenience: clamp a 0..100 percent to a 0..1 normalized intensity.
export const pct01 = (v: number | undefined, fallback = 0): number =>
  Math.min(1, Math.max(0, (typeof v === 'number' && isFinite(v) ? v : fallback) / 100));
