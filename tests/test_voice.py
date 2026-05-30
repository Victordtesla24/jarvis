"""Voice interface — the HUD "- LISTENING -" loop.

JARVIS can be driven by a spoken (or typed) phrase: the HUD posts it to
``/api/voice`` and ``interpret_command`` routes it to a capability + a spoken
reply. These tests pin the two things that matter:

- **Routing is correct:** each phrase maps to the right intent / cockpit action
  and a sensible spoken reply; intent priority is honoured (deep-clean beats the
  generic tidy match, tidy beats engage).
- **Voice is read-only by construction (R15/R18/R19):** a destructive request
  resolves to a dry-run *preview* and an instruction to throw the guarded
  control — it NEVER deletes and NEVER writes the audit log itself. The HTTP
  ``/api/voice`` route validates input and stays loopback-only.

There is no JS test runner in this repo, so — like ``test_hud_fui.py`` — the
front-end half is pinned by asserting the listening loop is present and wired
in the shipped HUD asset.
"""
import json
import threading
import types
import urllib.error
import urllib.request

import pytest

from lib import dashboard


# --------------------------------------------------------------------------- #
# interpret_command — natural-language routing
# --------------------------------------------------------------------------- #
def test_empty_phrase_is_a_polite_miss():
    out = dashboard.interpret_command("   ")
    assert out["ok"] is True
    assert out["intent"] == "unknown"
    assert out["requires_guard"] is False
    assert "didn't catch" in out["speech"].lower()


def test_unknown_phrase_is_handled_not_errored():
    out = dashboard.interpret_command("make me a sandwich")
    assert out["ok"] is True
    assert out["intent"] == "unknown"
    assert out["action"] is None


def test_help_lists_capabilities():
    out = dashboard.interpret_command("what can you do?")
    assert out["intent"] == "help"
    assert out["requires_guard"] is False
    assert "status" in out["speech"].lower()


def test_status_speaks_live_telemetry(monkeypatch):
    monkeypatch.setattr(
        dashboard,
        "collect_stats",
        lambda: {
            "system": {
                "cpu_load_pct": 18.0,
                "ram": {"used_pct": 51.0},
                "disk": {"used_pct": 40.0},
            },
            "audit": {"total_freed_human": "2.9KB"},
        },
    )

    out = dashboard.interpret_command("jarvis, status report")

    assert out["intent"] == "status"
    assert out["action"] == "refresh"
    assert out["requires_guard"] is False
    speech = out["speech"].lower()
    assert "nominal" in speech
    assert "18 percent" in speech and "51 percent" in speech and "40 percent" in speech
    assert "2.9kb" in speech
    # the reply carries fresh telemetry the HUD can paint immediately
    assert out["result"]["system"]["cpu_load_pct"] == 18.0


def test_status_reports_critical_when_a_vital_is_critical(monkeypatch):
    monkeypatch.setattr(
        dashboard,
        "collect_stats",
        lambda: {
            "system": {"cpu_load_pct": 5, "ram": {"used_pct": 5}, "disk": {"used_pct": 95}},
            "audit": {},
        },
    )
    out = dashboard.interpret_command("how are we doing")
    assert "critical" in out["speech"].lower()


def test_status_degrades_when_telemetry_sensor_is_offline(monkeypatch):
    monkeypatch.setattr(dashboard, "collect_stats", lambda: {"system": {"error": "boom"}})
    out = dashboard.interpret_command("status")
    assert out["intent"] == "status"
    assert "degraded" in out["speech"].lower()


# --------------------------------------------------------------------------- #
# the safety contract: voice previews, it never deletes
# --------------------------------------------------------------------------- #
def _no_delete_guard(monkeypatch):
    """Fail loudly if anything tries to delete or audit from a voice command."""
    monkeypatch.setattr(
        dashboard, "log_action",
        lambda **kw: pytest.fail("voice must not write the audit log"),
    )


def test_tidy_request_previews_and_never_deletes(tmp_path, monkeypatch):
    victim = tmp_path / "build.log"
    victim.write_text("x" * 128)
    monkeypatch.setattr(dashboard, "find_cleanup_targets", lambda home: [(str(victim), 128)])
    _no_delete_guard(monkeypatch)

    out = dashboard.interpret_command("jarvis, tidy up the caches")

    assert out["intent"] == "tidy"
    assert out["action"] == "tidy_execute"
    assert out["requires_guard"] is True
    assert out["result"]["mode"] == "preview"
    assert out["result"]["would_free_bytes"] == 128
    assert victim.exists(), "voice tidy must never delete"
    assert "throw the tidy control" in out["speech"].lower()


def test_deep_clean_request_wins_over_tidy_and_never_deletes(tmp_path, monkeypatch):
    victim = tmp_path / "node_modules"
    victim.mkdir()
    (victim / "f").write_text("y" * 64)
    monkeypatch.setattr(
        dashboard, "find_bloat",
        lambda home, min_age_days=7: [
            types.SimpleNamespace(path=str(victim), size_bytes=64, reclaimable=True)
        ],
    )
    _no_delete_guard(monkeypatch)

    out = dashboard.interpret_command("please run a deep clean")

    assert out["intent"] == "deep_clean"          # 'deep' beats the generic 'clean'
    assert out["action"] == "deep_clean_execute"
    assert out["requires_guard"] is True
    assert out["result"]["mode"] == "preview"
    assert victim.exists(), "voice deep-clean must never delete"


def test_docker_request_previews(monkeypatch):
    monkeypatch.setattr(
        dashboard, "system_prune",
        lambda dry_run=True: [
            types.SimpleNamespace(action="containers", removed=3, space_freed="1.2GB")
        ],
    )
    _no_delete_guard(monkeypatch)

    out = dashboard.interpret_command("prune the docker containers")

    assert out["intent"] == "docker_prune"
    assert out["action"] == "docker_prune_execute"
    assert out["requires_guard"] is True
    assert out["result"]["mode"] == "preview"
    assert "3 reclaimable" in out["speech"]


def test_engage_is_guarded_and_does_not_run(monkeypatch):
    _no_delete_guard(monkeypatch)
    # _engage would call log_action; if voice ran it the guard above would fire.
    out = dashboard.interpret_command("engage full optimization")
    assert out["intent"] == "engage"
    assert out["action"] == "engage"
    assert out["requires_guard"] is True
    assert out["result"] is None
    assert "lever" in out["speech"].lower()


@pytest.mark.parametrize(
    "phrase,armed_word",
    [("arm the autopilot", "arm"), ("disarm autopilot", "disarm"), ("disable autopilot", "disarm")],
)
def test_autopilot_toggle_is_guarded(phrase, armed_word):
    out = dashboard.interpret_command(phrase)
    assert out["intent"] == "set_autopilot"
    assert out["action"] == "set_autopilot"
    assert out["requires_guard"] is True
    assert armed_word in out["speech"].lower()


# --------------------------------------------------------------------------- #
# /api/voice HTTP route
# --------------------------------------------------------------------------- #
@pytest.fixture
def live_server():
    server = dashboard.make_server(host="127.0.0.1", port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address[:2]
    try:
        yield f"http://{host}:{port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _post(url, obj):
    req = urllib.request.Request(
        url, data=json.dumps(obj).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.status, json.loads(resp.read().decode())


def test_voice_route_returns_a_spoken_reply(live_server):
    status, body = _post(live_server + "/api/voice", {"text": "what can you do"})
    assert status == 200
    assert body["ok"] is True
    assert body["intent"] == "help"
    assert body["speech"]


def test_voice_route_rejects_missing_text(live_server):
    with pytest.raises(urllib.error.HTTPError) as exc:
        _post(live_server + "/api/voice", {"nope": 1})
    assert exc.value.code == 400


def test_voice_route_rejects_non_string_text(live_server):
    with pytest.raises(urllib.error.HTTPError) as exc:
        _post(live_server + "/api/voice", {"text": 42})
    assert exc.value.code == 400


# --------------------------------------------------------------------------- #
# front-end: the listening loop is present and wired in the shipped HUD
# --------------------------------------------------------------------------- #
HTML = (dashboard.WEB_DIR / "index.html").read_text()


def test_hud_has_voice_panel_and_listening_indicator():
    assert 'class="panel voice"' in HTML
    assert "LISTENING" in HTML                       # the iconic indicator word
    assert 'id="mic-btn"' in HTML and 'id="voice-reply"' in HTML


def test_hud_voice_panel_is_click_interactive():
    # the floating .app is click-through except over [data-interactive] regions
    assert 'class="panel voice" data-interactive' in HTML


def test_hud_uses_speech_apis_with_a_typed_fallback():
    assert "SpeechRecognition" in HTML and "webkitSpeechRecognition" in HTML
    assert "speechSynthesis" in HTML                 # JARVIS speaks his reply
    assert 'id="voice-input"' in HTML                # graceful fallback when no mic API


def test_hud_voice_posts_to_the_voice_route():
    assert "/api/voice" in HTML
