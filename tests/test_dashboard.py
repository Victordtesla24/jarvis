"""Tests for the JARVIS holographic dashboard & command centre.

The dashboard is a local-only (loopback) HTTP server that exposes JARVIS's
live telemetry as JSON and serves a Three.js HUD front-end. These tests pin:

- ``collect_stats`` returns a JSON-serializable telemetry payload and degrades
  gracefully when an individual data source raises.
- ``_audit_summary`` aggregates the real audit-log SQL correctly.
- ``run_command_action`` runs only safe, allow-listed actions; destructive
  cleanup never happens without explicit confirmation.
- the HTTP layer serves the HUD, answers ``/api/stats``/``/api/command``,
  404s unknown paths, and binds to loopback only (never the network).
"""
import json
import threading
import urllib.error
import urllib.request

import pytest

from lib import dashboard


# --------------------------------------------------------------------------- #
# collect_stats
# --------------------------------------------------------------------------- #
def _stub_all_sources(monkeypatch):
    """Point every telemetry source at deterministic, offline stand-ins."""
    from lib.machine import DiskInfo, SystemInfo

    info = SystemInfo(
        disk=DiskInfo(total_gb=1000, used_gb=400, free_gb=600, used_pct=40.0),
        ram_total_gb=32.0,
        ram_used_gb=16.0,
        ram_used_pct=50.0,
        cpu_idle_pct=82.0,
    )
    monkeypatch.setattr(dashboard, "get_system_info", lambda: info)
    monkeypatch.setattr(dashboard, "is_docker_running", lambda: True)
    monkeypatch.setattr(
        dashboard,
        "get_containers",
        lambda: [
            dashboard_container("web", "running"),
            dashboard_container("db", "exited"),
        ],
    )

    class _Brain:
        available = True
        model = "MiniMax-Text-01"

    monkeypatch.setattr(dashboard, "get_llm_brain", lambda: _Brain())
    monkeypatch.setattr(
        dashboard,
        "_audit_summary",
        lambda: {
            "total_actions": 5,
            "actions_24h": 2,
            "total_freed_bytes": 3000,
            "total_freed_human": "2.9KB",
            "by_machine": {"mac": 5},
        },
    )
    monkeypatch.setattr(
        dashboard,
        "get_recent_logs",
        lambda limit=15: [
            {
                "timestamp": "2026-05-30T10:00:00",
                "machine": "mac",
                "action_type": "tidy",
                "bytes_freed": 1000,
                "outcome": "success",
                "description": "cleaned caches",
            }
        ],
    )


def dashboard_container(name, state):
    from lib.docker_ops import DockerContainer

    return DockerContainer(
        id="abc123", name=name, image="img:latest", status="Up 2h", state=state
    )


def test_collect_stats_has_expected_sections(monkeypatch):
    _stub_all_sources(monkeypatch)

    stats = dashboard.collect_stats()

    for key in ("generated_at", "system", "docker", "brain", "audit", "machines"):
        assert key in stats, f"missing section: {key}"

    # Must round-trip through JSON unchanged (the HTTP layer serializes it).
    assert json.loads(json.dumps(stats)) == stats

    assert stats["system"]["disk"]["used_pct"] == 40.0
    assert stats["system"]["cpu_idle_pct"] == 82.0
    assert stats["docker"]["running"] is True
    assert stats["docker"]["running_count"] == 1
    assert stats["brain"]["available"] is True
    assert stats["audit"]["total_actions"] == 5


def test_collect_stats_degrades_when_a_source_raises(monkeypatch):
    _stub_all_sources(monkeypatch)

    def boom():
        raise RuntimeError("sensor offline")

    monkeypatch.setattr(dashboard, "get_system_info", boom)

    stats = dashboard.collect_stats()  # must NOT raise

    assert "error" in stats["system"]
    # A failure in one section must not take down the others.
    assert stats["docker"]["running"] is True
    assert stats["brain"]["available"] is True
    assert json.loads(json.dumps(stats)) == stats


def test_audit_summary_aggregates_from_db(tmp_path, monkeypatch):
    from lib import database

    monkeypatch.setattr(database, "DB_PATH", tmp_path / "memory.db")

    database.log_action(machine="mac", action_type="tidy", description="a", bytes_freed=1000)
    database.log_action(machine="mac", action_type="tidy", description="b", bytes_freed=500)
    database.log_action(machine="vps_main", action_type="health", description="c", bytes_freed=None)

    summary = dashboard._audit_summary()

    assert summary["total_actions"] == 3
    assert summary["total_freed_bytes"] == 1500
    assert summary["by_machine"] == {"mac": 2, "vps_main": 1}


# --------------------------------------------------------------------------- #
# run_command_action — safe, allow-listed control surface
# --------------------------------------------------------------------------- #
def test_unknown_action_is_rejected():
    result = dashboard.run_command_action("rm -rf /")

    assert result["ok"] is False
    assert "actions" in result  # surfaces the allow-list to the caller


def test_refresh_returns_fresh_stats(monkeypatch):
    monkeypatch.setattr(dashboard, "collect_stats", lambda: {"system": {"ok": 1}})

    result = dashboard.run_command_action("refresh")

    assert result["ok"] is True
    assert result["stats"] == {"system": {"ok": 1}}


def test_tidy_preview_never_deletes(tmp_path, monkeypatch):
    victim = tmp_path / "build.log"
    victim.write_text("x" * 100)

    monkeypatch.setattr(
        dashboard, "find_cleanup_targets", lambda home: [(str(victim), 100)]
    )

    result = dashboard.run_command_action("tidy_preview")

    assert result["ok"] is True
    assert result["mode"] == "preview"
    assert result["count"] == 1
    assert result["would_free_bytes"] == 100
    assert victim.exists(), "preview must never delete files"


def test_tidy_execute_requires_confirmation(tmp_path, monkeypatch):
    victim = tmp_path / "build.log"
    victim.write_text("x" * 100)

    monkeypatch.setattr(
        dashboard, "find_cleanup_targets", lambda home: [(str(victim), 100)]
    )
    monkeypatch.setattr(dashboard, "log_action", lambda **kw: None)

    result = dashboard.run_command_action("tidy_execute")  # no confirm

    assert result["ok"] is False
    assert victim.exists(), "execute without confirmation must not delete"


def test_tidy_execute_with_confirmation_deletes_and_audits(tmp_path, monkeypatch):
    victim = tmp_path / "build.log"
    victim.write_text("x" * 100)

    monkeypatch.setattr(
        dashboard, "find_cleanup_targets", lambda home: [(str(victim), 100)]
    )
    audits = []
    monkeypatch.setattr(dashboard, "log_action", lambda **kw: audits.append(kw))

    result = dashboard.run_command_action("tidy_execute", {"confirm": True})

    assert result["ok"] is True
    assert result["mode"] == "execute"
    assert not victim.exists(), "confirmed execute must delete the target"
    assert audits and audits[0]["action_type"] == "tidy"


# --------------------------------------------------------------------------- #
# HTTP layer
# --------------------------------------------------------------------------- #
@pytest.fixture
def live_server(monkeypatch):
    """A real dashboard server on an ephemeral loopback port."""
    monkeypatch.setattr(
        dashboard, "collect_stats", lambda: {"system": {"cpu_idle_pct": 90}}
    )
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


def _get(url):
    with urllib.request.urlopen(url, timeout=5) as resp:
        return resp.status, resp.headers.get("Content-Type", ""), resp.read().decode()


def test_server_binds_loopback_only():
    server = dashboard.make_server(host="127.0.0.1", port=0)
    try:
        assert server.server_address[0] == "127.0.0.1"
    finally:
        server.server_close()


def test_http_serves_hud_html(live_server):
    status, ctype, body = _get(live_server + "/")

    assert status == 200
    assert "text/html" in ctype
    # The HUD must actually be a Three.js arc-reactor dashboard that polls the API.
    for marker in ("JARVIS", "arc-reactor", "three", "gauge", "/api/stats"):
        assert marker in body, f"HUD missing {marker!r}"


def test_http_stats_endpoint_returns_json(live_server):
    status, ctype, body = _get(live_server + "/api/stats")

    assert status == 200
    assert "application/json" in ctype
    assert json.loads(body)["system"]["cpu_idle_pct"] == 90


def test_http_unknown_path_404(live_server):
    with pytest.raises(urllib.error.HTTPError) as exc:
        _get(live_server + "/secrets")
    assert exc.value.code == 404


def test_http_post_refresh_command(live_server, monkeypatch):
    payload = json.dumps({"action": "refresh"}).encode()
    req = urllib.request.Request(
        live_server + "/api/command", data=payload, method="POST"
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        body = json.loads(resp.read().decode())
    assert resp.status == 200
    assert body["ok"] is True


def test_http_post_unknown_command_is_rejected(live_server):
    payload = json.dumps({"action": "wipe_disk"}).encode()
    req = urllib.request.Request(
        live_server + "/api/command", data=payload, method="POST"
    )
    with pytest.raises(urllib.error.HTTPError) as exc:
        urllib.request.urlopen(req, timeout=5)
    assert exc.value.code == 400


def test_web_dir_index_exists_on_disk():
    # The served HUD is a real asset on disk, not an inline string.
    assert (dashboard.WEB_DIR / "index.html").is_file()
