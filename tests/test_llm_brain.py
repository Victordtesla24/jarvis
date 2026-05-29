"""Tests for the LLM brain and .env credential loading.

These tests never hit the network — the MiniMax HTTP call is mocked.
"""
import os
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


class TestLoadDotenv:
    """`.env` must populate os.environ and defeat placeholder shell exports."""

    def test_overrides_unresolved_placeholder(self, tmp_path, monkeypatch):
        from lib.config import load_dotenv

        env_file = tmp_path / ".env"
        env_file.write_text("MINIMAX_API_KEY=sk-real-key-value\n")

        # Simulate the broken self-referential shell export.
        monkeypatch.setenv("MINIMAX_API_KEY", "${MINIMAX_API_KEY}")

        loaded = load_dotenv(env_file)
        assert loaded == 1
        assert os.environ["MINIMAX_API_KEY"] == "sk-real-key-value"

    def test_does_not_override_real_value(self, tmp_path, monkeypatch):
        from lib.config import load_dotenv

        env_file = tmp_path / ".env"
        env_file.write_text("MINIMAX_API_KEY=from-dotenv\n")
        monkeypatch.setenv("MINIMAX_API_KEY", "already-real")

        load_dotenv(env_file)
        assert os.environ["MINIMAX_API_KEY"] == "already-real"

    def test_ignores_comments_and_blanks(self, tmp_path, monkeypatch):
        from lib.config import load_dotenv

        env_file = tmp_path / ".env"
        env_file.write_text("# comment\n\nFOO=bar\n")
        monkeypatch.delenv("FOO", raising=False)

        loaded = load_dotenv(env_file)
        assert loaded == 1
        assert os.environ["FOO"] == "bar"

    def test_missing_file_returns_zero(self, tmp_path):
        from lib.config import load_dotenv
        assert load_dotenv(tmp_path / "nope.env") == 0


class TestConfigDefaults:
    """MiniMax endpoint/model defaults must point at the working intl host."""

    def test_minimax_base_url_default(self):
        from lib.config import get_config
        cfg = get_config()
        # The legacy api.minimax.chat host rejects sk- keys; default must be intl.
        assert cfg.minimax_base_url == "https://api.minimaxi.chat/v1"

    def test_minimax_model_default(self):
        from lib.config import get_config
        cfg = get_config()
        assert cfg.minimax_model == "MiniMax-Text-01"


def _make_brain(available=True):
    from lib.llm_brain import LLMBrain
    brain = LLMBrain()
    brain.api_key = "sk-test" if available else ""
    brain._available = available
    brain.base_url = "https://api.minimaxi.chat/v1"
    brain.model = "MiniMax-Text-01"
    return brain


class TestMakeRequest:
    """`_make_request` must respect MiniMax's base_resp.status_code."""

    def test_success(self):
        brain = _make_brain()
        resp = MagicMock()
        resp.raise_for_status.return_value = None
        resp.json.return_value = {
            "choices": [{"message": {"content": "hello"}}],
            "base_resp": {"status_code": 0, "status_msg": "success"},
        }
        with patch("lib.llm_brain.requests.post", return_value=resp):
            assert brain._make_request([{"role": "user", "content": "hi"}]) == "hello"

    def test_logical_error_raises_despite_http_200(self):
        brain = _make_brain()
        resp = MagicMock()
        resp.raise_for_status.return_value = None  # HTTP 200
        resp.json.return_value = {"base_resp": {"status_code": 2049, "status_msg": "invalid api key"}}
        with patch("lib.llm_brain.requests.post", return_value=resp):
            with pytest.raises(RuntimeError, match="2049"):
                brain._make_request([{"role": "user", "content": "hi"}])

    def test_unavailable_raises(self):
        brain = _make_brain(available=False)
        with pytest.raises(RuntimeError, match="not configured"):
            brain._make_request([{"role": "user", "content": "hi"}])


class TestChat:
    def test_chat_unavailable_raises(self):
        brain = _make_brain(available=False)
        with pytest.raises(RuntimeError, match="unavailable"):
            brain.chat("hello")

    def test_chat_includes_system_state(self):
        brain = _make_brain()
        captured = {}

        def fake_request(messages, **kwargs):
            captured["messages"] = messages
            return "answer"

        with patch.object(brain, "_make_request", side_effect=fake_request):
            assert brain.chat("clean up?", system_state={"disk_used_pct": 92}) == "answer"
        assert "92" in captured["messages"][-1]["content"]


class TestDecide:
    def test_api_decide_parses_fenced_json(self):
        brain = _make_brain()
        fenced = '```json\n{"action": "cleanup", "reasoning": "x", "confidence": 0.9, "details": {}}\n```'
        with patch.object(brain, "_make_request", return_value=fenced):
            result = brain.decide("tidy", {"disk_used_pct": 92})
        assert result["action"] == "cleanup"

    def test_decide_falls_back_to_heuristic_on_api_error(self):
        brain = _make_brain()
        with patch.object(brain, "_make_request", side_effect=RuntimeError("boom")):
            result = brain.decide("tidy", {"machine": "mac", "disk_used_pct": 92, "free_gb": 8})
        # Heuristic kicks in: high disk -> cleanup.
        assert result["action"] == "cleanup"
        assert result["details"].get("trigger") == "high_disk"

    def test_heuristic_healthy_system_monitors(self):
        brain = _make_brain(available=False)
        result = brain.decide("tidy", {"machine": "mac", "disk_used_pct": 30, "free_gb": 200})
        assert result["action"] == "monitor"
