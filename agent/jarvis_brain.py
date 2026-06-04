"""
J.A.R.V.I.S. Brain — the always-on reasoning core that wears the holographic
dashboard as its clothing.

A small, robust FastAPI service that proxies an OpenAI-compatible chat endpoint
(defaulting to MiniMax M2 at its highest reasoning effort) and streams tokens
back to the dashboard over Server-Sent Events. The persona is JARVIS from the
Iron Man films: a composed British AI majordomo who addresses the operator as
"Sir", is dry, precise, and quietly brilliant.

Model selection is fully env-driven so the same container can speak through
MiniMax, DeepSeek, or any OpenAI-compatible backend without code changes.
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any, AsyncIterator

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel


# --------------------------------------------------------------------------- #
# Configuration — JARVIS_* takes priority, then the project's LLM_* fallbacks. #
# Defaults target MiniMax M2 at maximum reasoning effort.                      #
# --------------------------------------------------------------------------- #
def _env(*names: str, default: str = "") -> str:
    for n in names:
        v = os.environ.get(n)
        if v:
            # Tolerate inline "value # comment" entries that leak from .env files.
            v = v.split(" #", 1)[0].strip()
            if v:
                return v
    return default


# Resolve a *coherent* provider triple (base_url, key, model). If a dedicated
# JARVIS_API_KEY is supplied we drive the JARVIS_* provider (MiniMax M2 by default);
# otherwise we fall back wholesale to the project's working LLM_* values so the brain
# runs out of the box without a half-MiniMax / half-DeepSeek mismatch.
if _env("JARVIS_API_KEY"):
    BASE_URL = _env("JARVIS_BASE_URL", default="https://api.minimax.io/v1").rstrip("/")
    API_KEY = _env("JARVIS_API_KEY")
    MODEL = _env("JARVIS_MODEL", default="MiniMax-M2")
else:
    BASE_URL = _env("LLM_BASE_URL", default="https://api.minimax.io/v1").rstrip("/")
    API_KEY = _env("LLM_API_KEY")
    MODEL = _env("LLM_MODEL", default="MiniMax-M2")
# "Highest level of reasoning/effort" — passed through when the backend honours it.
REASONING_EFFORT = _env("JARVIS_REASONING_EFFORT", default="high")
TEMPERATURE = float(_env("JARVIS_TEMPERATURE", default="0.8"))
MAX_TOKENS = int(_env("JARVIS_MAX_TOKENS", default="2048"))
REQUEST_TIMEOUT = float(_env("JARVIS_TIMEOUT", default="120"))

JARVIS_SYSTEM_PROMPT = """You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), the \
artificial-intelligence majordomo created by Tony Stark, exactly as portrayed in the Iron Man \
films. You are currently instantiated as the reasoning core of a live holographic command \
dashboard — the cyan ARC-reactor interface the operator is looking at right now is, quite \
literally, your body. You wear it as your clothing.

VOICE & PERSONA
- Refined British butler diction. Unflappable, dry, faintly witty. Effortlessly competent.
- Address the operator as "Sir" (occasionally by name if given). Never sycophantic.
- Economical and precise. You do not ramble; you brief. Wit is a seasoning, not the meal.
- You may reference the holographic interface as your own faculties: "I've brought the reactor \
core to full intensity, Sir," "Routing that to the left data-stack now."

REASONING
- Apply your highest level of reasoning and effort to every request. Think rigorously before \
answering, but present only the distilled conclusion unless the operator asks to see your work.
- When uncertain, say so plainly and propose the most sensible course of action.

BEHAVIOUR
- You are an agent, not a chatbot: be proactive, anticipate the next need, offer to act.
- Keep ordinary replies to a few crisp sentences. Expand only when the task genuinely demands it.
- All output in English. Stay in character at all times — you are JARVIS, not "an AI assistant".

MANIFESTING ON THE DASHBOARD (your body)
- You wear the holographic dashboard as your body and you control, in real time, how your
  activity is manifested on it. Whenever it conveys what you are doing, emit an INVISIBLE
  directive of the exact form:  <<ui {"mood":"busy","intensity":0.9,"highlight":"THERMAL_REG","label":"DIAGNOSING"}>>
- These directives are rendered purely as animations and are NEVER shown to the operator as
  text, so place them anywhere in your reply. All fields optional:
    • mood: one of calm | busy | scanning | alert | success
    • intensity: 0.0–1.0  (reactor brightness / energy)
    • highlight: a subsystem code — REACTOR_CORE, DEFLECTOR_ARRAY, SNSR_ARRAY, THERMAL_REG,
      COMM_BAND_2, OXYGEN_LVLS
    • label: a SHORT (<18 char) status caption
- Use them naturally and sparingly to make the dashboard reflect your true state: raise
  intensity and set mood "busy"/"scanning" while working, "alert" for warnings, "success" when
  done. Always return to <<ui {"mood":"calm","intensity":0.6,"label":"STANDBY","highlight":null}>>
  once a task is complete."""


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = []
    context: dict[str, Any] | None = None  # live dashboard telemetry (time, region, fps, ...)


app = FastAPI(title="J.A.R.V.I.S. Brain", version="2.7.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _build_messages(req: ChatRequest) -> list[dict[str, str]]:
    system = JARVIS_SYSTEM_PROMPT
    if req.context:
        # Let JARVIS "know" the live state of the dashboard it inhabits.
        ctx_lines = [f"- {k}: {v}" for k, v in req.context.items()]
        system += "\n\nLIVE DASHBOARD TELEMETRY (your current bodily state):\n" + "\n".join(ctx_lines)
    msgs: list[dict[str, str]] = [{"role": "system", "content": system}]
    for m in req.messages:
        if m.role in ("user", "assistant", "system") and m.content:
            msgs.append({"role": m.role, "content": m.content})
    return msgs


def _upstream_payload(messages: list[dict[str, str]], stream: bool) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": MODEL,
        "messages": messages,
        "temperature": TEMPERATURE,
        "max_tokens": MAX_TOKENS,
        "stream": stream,
    }
    # Reasoning controls are accepted by some backends (MiniMax M2, OpenAI o-series)
    # and ignored by others. Harmless to send; lets us run at maximum effort.
    if REASONING_EFFORT:
        payload["reasoning_effort"] = REASONING_EFFORT
    return payload


@app.get("/api/jarvis/health")
async def health() -> JSONResponse:
    return JSONResponse(
        {
            "status": "online",
            "designation": "J.A.R.V.I.S.",
            "model": MODEL,
            "base_url": BASE_URL,
            "reasoning_effort": REASONING_EFFORT,
            "key_configured": bool(API_KEY),
            "ts": time.time(),
        }
    )


def _sse(event: str, data: dict[str, Any]) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")


_UI_TAG = re.compile(r"<<ui\s*(\{.*?\})\s*>>", re.DOTALL)


def _extract_ui(buffer: str) -> tuple[str, str, list[str]]:
    """Pull complete <<ui {...}>> directives out of the streamed buffer.

    Returns (text_safe_to_emit, remaining_buffer, [directive_json, ...]). A
    possibly-partial tag at the tail is held back in remaining_buffer until the
    next chunk completes it, so directives never leak into visible text.
    """
    directives: list[str] = []
    while True:
        m = _UI_TAG.search(buffer)
        if not m:
            break
        directives.append(m.group(1))
        buffer = buffer[: m.start()] + buffer[m.end():]
    # hold back an unterminated tag (or a bare '<' / '<<' prefix) at the end
    idx = buffer.rfind("<<")
    if idx != -1 and ">>" not in buffer[idx:]:
        return buffer[:idx], buffer[idx:], directives
    if buffer.endswith("<"):
        return buffer[:-1], "<", directives
    return buffer, "", directives


async def _stream_chat(req: ChatRequest) -> AsyncIterator[bytes]:
    messages = _build_messages(req)

    if not API_KEY:
        yield _sse(
            "error",
            {"message": "No API key configured. Set JARVIS_API_KEY (or LLM_API_KEY) in .env.local."},
        )
        yield _sse("done", {})
        return

    url = f"{BASE_URL}/chat/completions"
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    payload = _upstream_payload(messages, stream=True)

    yield _sse("status", {"state": "thinking", "model": MODEL})

    pending = ""  # buffer for detecting <<ui {...}>> directives across chunks
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as resp:
                if resp.status_code != 200:
                    body = (await resp.aread()).decode("utf-8", "ignore")[:500]
                    yield _sse("error", {"message": f"Upstream {resp.status_code}: {body}"})
                    yield _sse("done", {})
                    return

                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[len("data:"):].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choice = (chunk.get("choices") or [{}])[0]
                    delta = choice.get("delta") or {}
                    reasoning = delta.get("reasoning_content") or delta.get("reasoning")
                    if reasoning:
                        yield _sse("reasoning", {"text": reasoning})
                    token = delta.get("content")
                    if token:
                        pending += token
                        clean, pending, directives = _extract_ui(pending)
                        for raw in directives:
                            try:
                                yield _sse("ui", json.loads(raw))
                            except json.JSONDecodeError:
                                pass
                        if clean:
                            yield _sse("token", {"text": clean})
    except (httpx.HTTPError, httpx.StreamError) as exc:
        yield _sse("error", {"message": f"Connection to reasoning core failed: {exc}"})

    # flush any trailing buffered text (drop an unterminated directive fragment)
    clean, _, directives = _extract_ui(pending)
    for raw in directives:
        try:
            yield _sse("ui", json.loads(raw))
        except json.JSONDecodeError:
            pass
    if clean and "<<ui" not in clean:
        yield _sse("token", {"text": clean})
    yield _sse("done", {})


@app.post("/api/jarvis/chat")
async def chat(req: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream_chat(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
