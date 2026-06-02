import { useEffect, useReducer } from 'react';

// ── Agent State Bus ─────────────────────────────────────────────────────────
// The live link between the J.A.R.V.I.S. brain and the dashboard it wears as a
// body. The agent drives this state in real time — both automatically (its
// reasoning/speaking activity) and deliberately (mood / intensity / highlight /
// label directives it emits mid-stream). HUD components subscribe and animate
// accordingly, WITHOUT any change to the baseline design — only parameters move.

export type AgentActivity = 'idle' | 'thinking' | 'speaking';
export type AgentMood = 'calm' | 'busy' | 'scanning' | 'alert' | 'success';

export interface AgentState {
  activity: AgentActivity; // automatic: what the brain is doing right now
  mood: AgentMood;         // agent-authored: how it wants to present
  intensity: number;       // 0..1 reactor energy / brightness
  highlight: string | null;// subsystem code the agent is focused on
  label: string;           // short status caption shown on the HUD
  alertPulse: number;      // bumped to fire a one-shot alert flash
}

const state: AgentState = {
  activity: 'idle',
  mood: 'calm',
  intensity: 0.62,
  highlight: null,
  label: 'STANDBY',
  alertPulse: 0,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const AgentBus = {
  get: (): AgentState => state,
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  set(patch: Partial<AgentState>) {
    Object.assign(state, patch);
    emit();
  },
  // Apply a raw directive object emitted by the brain (already JSON-parsed).
  applyDirective(d: Record<string, unknown>) {
    const patch: Partial<AgentState> = {};
    if (typeof d.mood === 'string' && ['calm', 'busy', 'scanning', 'alert', 'success'].includes(d.mood))
      patch.mood = d.mood as AgentMood;
    if (typeof d.intensity === 'number') patch.intensity = Math.max(0, Math.min(1, d.intensity));
    if ('highlight' in d) patch.highlight = d.highlight ? String(d.highlight).toUpperCase() : null;
    if (typeof d.label === 'string') patch.label = d.label.toUpperCase().slice(0, 20);
    if (patch.mood === 'alert') patch.alertPulse = state.alertPulse + 1;
    AgentBus.set(patch);
  },
};

export function useAgentState(): AgentState {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => AgentBus.subscribe(force), []);
  return state;
}

// Debug/QA seam: expose the bus so the agent's effect on the whole dashboard can be
// driven from the console or an automated visual check (e.g. AgentBus.set({mood:'alert'})).
// Inert in normal use — nothing reads this back; the live wiring is jarvisService→AgentBus.
if (typeof window !== 'undefined') (window as unknown as { AgentBus: typeof AgentBus }).AgentBus = AgentBus;
