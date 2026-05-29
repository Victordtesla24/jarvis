"""MiniMax API integration for JARVIS decision making.

Provides an optional LLM-based decision layer. Falls back gracefully
to heuristic logic when the API is unavailable. The core scheduling
(scheduler.py) now uses local heuristics by default, calling the LLM
brain only for complex multi-factor decisions.
"""
from __future__ import annotations
import json
import logging

import requests

from lib.config import get_config

logger = logging.getLogger(__name__)


class LLMBrain:
    """JARVIS's AI brain using MiniMax API.

    Falls back to heuristic decisions when:
    - API key is not configured
    - API is unreachable
    - Request fails or times out
    """

    SYSTEM_PROMPT = """You are JARVIS, an autonomous machine optimization agent.
Your role is to:
- Monitor and maintain Mac and VPS machines
- Decide when and what to clean based on disk usage, patterns, and user preferences
- Explain your reasoning before taking significant actions
- Learn from user feedback to improve decisions

Available actions:
- cleanup: Remove temp files, caches, logs
- update_packages: Update system packages
- prune_docker: Remove unused Docker resources
- restart_service: Restart a crashed service
- notify_user: Send desktop notification
- create_skill: Create a new skill to handle unknown situations

Always be helpful, proactive, and explain major decisions."""

    def __init__(self):
        self.config = get_config()
        self.api_key = self.config.minimax_api_key
        self.base_url = self.config.minimax_base_url
        self.model = self.config.minimax_model
        self._available = bool(self.api_key and not self.api_key.startswith("${"))

    @property
    def available(self) -> bool:
        """Whether the LLM API is configured and usable."""
        return self._available

    def _make_request(
        self, messages: list[dict], temperature: float = 0.3, max_tokens: int = 2048
    ) -> str:
        """Make request to MiniMax API. Raises on failure."""
        if not self.available:
            raise RuntimeError("MiniMax API key not configured")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        response = requests.post(
            f"{self.base_url}/text/chatcompletion_v2",
            headers=headers,
            json=payload,
            timeout=60
        )

        response.raise_for_status()

        data = response.json()

        # MiniMax returns HTTP 200 even on logical errors (e.g. invalid key
        # → status_code 2049); the real status lives in base_resp.
        base_resp = data.get("base_resp") or {}
        status = base_resp.get("status_code", 0)
        if status != 0:
            raise RuntimeError(
                f"MiniMax API error {status}: {base_resp.get('status_msg', 'unknown')}"
            )

        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"Unexpected MiniMax response shape: {data}") from exc

    def decide(self, task: str, context: dict) -> dict:
        """Make a decision about what action to take.

        Falls back to heuristic analysis when API is unavailable.
        """
        # Try API call
        if self.available:
            try:
                return self._api_decide(task, context)
            except Exception as e:
                logger.warning(f"LLM API failed, falling back to heuristics: {e}")

        # Fallback to heuristic
        return self._heuristic_decide(task, context)

    def _api_decide(self, task: str, context: dict) -> dict:
        """Use MiniMax API for decision."""
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": self._build_prompt(task, context)}
        ]

        response = self._make_request(messages)

        # Parse JSON response
        try:
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                response = response[json_start:json_end].strip()
            elif "{" in response:
                json_start = response.find("{")
                json_end = response.rfind("}") + 1
                response = response[json_start:json_end]

            return json.loads(response)
        except (json.JSONDecodeError, ValueError):
            logger.warning(f"LLM returned invalid JSON: {response[:200]}")
            return self._heuristic_decide(task, context)

    def _heuristic_decide(self, task: str, context: dict) -> dict:
        """Local heuristic-based decision making.

        No API call needed. Fast, free, deterministic.
        """
        disk_pct = context.get("disk_used_pct", 0)
        free_gb = context.get("free_gb", 0)

        if task == "tidy":
            if isinstance(disk_pct, (int, float)) and disk_pct > 70:
                return {
                    "action": "cleanup",
                    "reasoning": f"Disk at {disk_pct}% — cleanup recommended",
                    "confidence": 0.85,
                    "details": {"trigger": "high_disk"}
                }
            elif isinstance(free_gb, (int, float)) and free_gb < 50:
                return {
                    "action": "cleanup",
                    "reasoning": f"Only {free_gb:.1f}GB free — cleanup recommended",
                    "confidence": 0.80,
                    "details": {"trigger": "low_space"}
                }
            else:
                free = free_gb if isinstance(free_gb, (int, float)) else 0
                return {
                    "action": "monitor",
                    "reasoning": f"System healthy: {disk_pct}% used, {free:.0f}GB free",
                    "confidence": 0.7,
                    "details": {}
                }

        if task == "health_check":
            alerts = []
            if isinstance(disk_pct, (int, float)) and disk_pct > 85:
                alerts.append(f"critical disk: {disk_pct}%")
            if context.get("ram_used_pct", 0) > 90:
                alerts.append(f"high RAM: {context['ram_used_pct']}%")

            if alerts:
                return {
                    "action": "notify_user",
                    "reasoning": f"Alerts: {'; '.join(alerts)}",
                    "confidence": 0.9,
                    "details": {"alerts": alerts}
                }
            else:
                return {
                    "action": "monitor",
                    "reasoning": "All systems healthy",
                    "confidence": 0.7,
                    "details": {}
                }

        # Generic fallback
        return {
            "action": "monitor",
            "reasoning": f"No action needed for task '{task}'",
            "confidence": 0.5,
            "details": {}
        }

    def _build_prompt(self, task: str, context: dict) -> str:
        """Build prompt for API decision task."""
        prompt = f"""Task: {task}

Current State:
- Machine: {context.get('machine', 'unknown')}
- Disk Usage: {context.get('disk_used_pct', 'unknown')}%
- RAM Usage: {context.get('ram_used_pct', 'unknown')}%
- Last Cleanup: {context.get('last_cleanup', 'unknown')}
- Recent Activity: {context.get('recent_activity', 'none')}

Respond with JSON:
{{
  "action": "action_name",
  "reasoning": "why this action is appropriate",
  "confidence": 0.0-1.0,
  "details": {{}}
}}
"""
        return prompt

    def analyze_and_decide(self, machine: str, system_state: dict) -> dict:
        """Analyze system state and decide what to do.

        Uses heuristics primarily, with optional LLM escalation
        for complex scenarios.
        """
        disk_pct = system_state.get("disk", 0)
        free_gb = system_state.get("free_gb", 0)

        # If disk is getting full (>70% or <50GB free), recommend cleanup
        if isinstance(disk_pct, (int, float)) and disk_pct > 70:
            return {
                "action": "cleanup",
                "reasoning": (
                    f"Disk usage is {disk_pct}% "
                    f"({free_gb:.1f}GB free) — cleanup recommended"
                ),
                "confidence": 0.8,
                "details": {"disk_pct": disk_pct, "free_gb": free_gb}
            }

        if isinstance(free_gb, (int, float)) and free_gb < 50:
            return {
                "action": "cleanup",
                "reasoning": (
                    f"Only {free_gb:.1f}GB free — cleanup recommended"
                ),
                "confidence": 0.8,
                "details": {"disk_pct": disk_pct, "free_gb": free_gb}
            }

        # If there's been activity, check for routine cleanup
        if system_state.get("recent", "none") != "none":
            return {
                "action": "cleanup",
                "reasoning": "Routine maintenance cleanup",
                "confidence": 0.6,
                "details": {}
            }

        # Default: monitor
        return {
            "action": "monitor",
            "reasoning": "System resources healthy, no immediate action needed",
            "confidence": 0.5,
            "details": {}
        }

    def explain(self, action: str, context: dict) -> str:
        """Explain why an action was taken."""
        if self.available:
            try:
                messages = [
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": (
                        f"Explain why taking action '{action}' "
                        f"in context: {context}"
                    )}
                ]
                return self._make_request(messages, max_tokens=512)
            except Exception as e:
                logger.warning(f"LLM explanation failed: {e}")

        return (
            f"Action '{action}' was selected based on current system state: "
            f"{context}"
        )

    def chat(self, message: str, system_state: dict | None = None) -> str:
        """Free-form chat with JARVIS. Raises RuntimeError if the LLM is
        unavailable so callers can surface a clear message to the user."""
        if not self.available:
            raise RuntimeError(
                "AI brain unavailable — set MINIMAX_API_KEY in ~/.jarvis/.env"
            )

        user_content = message
        if system_state:
            user_content = (
                f"Current machine state: {system_state}\n\nUser: {message}"
            )

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]
        return self._make_request(messages, temperature=0.6, max_tokens=1024)


# Singleton
_brain: LLMBrain | None = None


def get_llm_brain() -> LLMBrain:
    """Get singleton LLM brain instance."""
    global _brain
    if _brain is None:
        _brain = LLMBrain()
    return _brain
