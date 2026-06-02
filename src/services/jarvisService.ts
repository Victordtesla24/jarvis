// Streaming client for the J.A.R.V.I.S. brain (the always-on Docker reasoning core).
// Speaks SSE to /api/jarvis/chat and surfaces tokens, reasoning, status and errors
// as they arrive so the holographic console can render JARVIS thinking in real time.
// It also drives the AgentBus, so the brain's activity and its self-authored UI
// directives manifest across the whole dashboard live.

import { AgentBus } from './agentState';

export interface JarvisMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface JarvisContext {
  [key: string]: string | number;
}

export interface JarvisStreamHandlers {
  onStatus?: (state: string) => void;
  onReasoning?: (text: string) => void;
  onToken?: (text: string) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

const BASE = '/api/jarvis';

export const JarvisService = {
  async health(): Promise<{ status: string; model: string; key_configured: boolean } | null> {
    try {
      const r = await fetch(`${BASE}/health`);
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  },

  // Poll the brain's health on an interval (probes immediately, then every intervalMs).
  // Returns an unsubscribe that stops polling — keeps timer ownership in the service layer.
  subscribeHealth(
    onChange: (health: { status: string; model: string; key_configured: boolean } | null) => void,
    intervalMs = 15000,
  ): () => void {
    let alive = true;
    const probe = async () => {
      const h = await JarvisService.health();
      if (alive) onChange(h);
    };
    void probe();
    const id = setInterval(probe, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  },

  // Stream a JARVIS reply. Returns an AbortController so the caller can cancel.
  chat(
    messages: JarvisMessage[],
    context: JarvisContext,
    handlers: JarvisStreamHandlers,
  ): AbortController {
    const controller = new AbortController();

    (async () => {
      try {
        const resp = await fetch(`${BASE}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, context }),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          handlers.onError?.(`Reasoning core unreachable (HTTP ${resp.status}).`);
          handlers.onDone?.();
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Parse the SSE stream: blocks separated by blank lines, each with
        // an `event:` and a `data:` line.
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sep: number;
          while ((sep = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            let event = 'message';
            let data = '';
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) event = line.slice(6).trim();
              else if (line.startsWith('data:')) data += line.slice(5).trim();
            }
            if (!data) continue;
            let payload: any;
            try {
              payload = JSON.parse(data);
            } catch {
              continue;
            }
            switch (event) {
              case 'status':
                AgentBus.set({ activity: 'thinking' });
                handlers.onStatus?.(payload.state ?? 'thinking');
                break;
              case 'reasoning':
                handlers.onReasoning?.(payload.text ?? '');
                break;
              case 'token':
                if (AgentBus.get().activity !== 'speaking') AgentBus.set({ activity: 'speaking' });
                handlers.onToken?.(payload.text ?? '');
                break;
              case 'ui':
                // The agent manifesting itself on its own body, in real time.
                AgentBus.applyDirective(payload);
                break;
              case 'error':
                AgentBus.set({ mood: 'alert', label: 'CORE FAULT', alertPulse: AgentBus.get().alertPulse + 1 });
                handlers.onError?.(payload.message ?? 'Unknown fault in reasoning core.');
                break;
              case 'done':
                AgentBus.set({ activity: 'idle' });
                handlers.onDone?.();
                break;
            }
          }
        }
        handlers.onDone?.();
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handlers.onError?.('Connection to JARVIS severed.');
          handlers.onDone?.();
        }
      }
    })();

    return controller;
  },
};
