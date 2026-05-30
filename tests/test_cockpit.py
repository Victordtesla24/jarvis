"""SC7 — the cockpit control panel drives every ``/api/command`` action and
guarded controls gate the destructive ones.

Two halves, mirroring how SC5/SC6 are pinned:

- **Backend** (``lib.dashboard`` + ``lib.config``): the command allow-list now
  covers the full R15 cockpit (settings + previews + executes + master engage),
  every destructive action is centrally confirm-gated, and the runtime settings
  persist through a credential-safe ``config.yaml`` writer.
- **Front-end** (``lib/dashboard_web/index.html``, a static asset): a skeuomorphic
  control exists for *every* allow-listed action, and each destructive action is
  wrapped in a physical guard (the cover/lever throw IS the confirm gesture).
"""
import json

import pytest
import yaml

from lib import config, dashboard


# --------------------------------------------------------------------------- #
# config.update_config — credential-safe, allow-listed persistence
# --------------------------------------------------------------------------- #
@pytest.fixture
def tmp_config(tmp_path, monkeypatch):
    """Point the Config singleton at a throwaway YAML with a credential
    placeholder, so writes can be checked without touching the real file."""
    cfg = tmp_path / "config.yaml"
    cfg.write_text(
        "minimax_api_key: \"${MINIMAX_API_KEY}\"\n"
        "safety:\n"
        "  dry_run: false\n"
        "  bloat_min_age_days: 7\n"
        "  idle_cpu_threshold: 80\n"
        "notifications:\n"
        "  enabled: true\n"
    )
    monkeypatch.setattr(config.Config, "CONFIG_PATH", cfg)
    monkeypatch.setattr(config.Config, "_instance", None)
    return cfg


def test_update_config_persists_and_reloads(tmp_config):
    config.update_config({"safety.dry_run": True, "safety.bloat_min_age_days": 30})

    on_disk = yaml.safe_load(tmp_config.read_text())
    assert on_disk["safety"]["dry_run"] is True
    assert on_disk["safety"]["bloat_min_age_days"] == 30
    # The live singleton reflects the change with no daemon restart.
    assert config.get_config().safety["dry_run"] is True
    assert config.get_config().safety["bloat_min_age_days"] == 30


def test_update_config_never_resolves_credentials(tmp_config, monkeypatch):
    # Even with the secret present in the environment, the placeholder must be
    # written back verbatim — a config write may NEVER bake a secret into disk.
    monkeypatch.setenv("MINIMAX_API_KEY", "sk-super-secret-value")

    config.update_config({"notifications.enabled": False})

    text = tmp_config.read_text()
    assert "${MINIMAX_API_KEY}" in text, "credential placeholder must survive"
    assert "sk-super-secret-value" not in text, "secret leaked into config.yaml"


def test_update_config_preserves_comments_and_inline_notes(tmp_path, monkeypatch):
    cfg = tmp_path / "config.yaml"
    cfg.write_text(
        "# JARVIS config — keep me\n"
        "minimax_api_key: \"${MINIMAX_API_KEY}\"\n"
        "\n"
        "safety:\n"
        "  dry_run: false\n"
        "  idle_cpu_threshold: 80      # % CPU idle required\n"
    )
    monkeypatch.setattr(config.Config, "CONFIG_PATH", cfg)
    monkeypatch.setattr(config.Config, "_instance", None)

    config.update_config({"safety.idle_cpu_threshold": 65})

    text = cfg.read_text()
    assert "# JARVIS config — keep me" in text, "comment block was clobbered"
    assert "# % CPU idle required" in text, "inline comment was clobbered"
    assert "idle_cpu_threshold: 65" in text
    assert yaml.safe_load(text)["safety"]["idle_cpu_threshold"] == 65


def test_update_config_inserts_a_new_key_into_its_section(tmp_config):
    # autopilot_armed is not present in the seed config — it must be created.
    config.update_config({"safety.autopilot_armed": False})

    data = yaml.safe_load(tmp_config.read_text())
    assert data["safety"]["autopilot_armed"] is False
    assert data["safety"]["dry_run"] is False  # siblings intact


def test_update_config_rejects_unknown_keys(tmp_config):
    with pytest.raises(KeyError):
        config.update_config({"safety.skip_paths": ["/"]})


def test_update_config_type_checks_values(tmp_config):
    with pytest.raises(TypeError):
        config.update_config({"safety.dry_run": "yes"})  # bool expected
    with pytest.raises(TypeError):
        config.update_config({"safety.idle_cpu_threshold": True})  # number expected


# --------------------------------------------------------------------------- #
# dashboard command surface — full allow-list, central confirm gate
# --------------------------------------------------------------------------- #
def test_allow_list_covers_the_full_cockpit():
    for action in (
        "refresh",
        "tidy_preview", "tidy_execute",
        "docker_prune_preview", "docker_prune_execute",
        "deep_clean_preview", "deep_clean_execute",
        "set_dry_run", "set_notify",
        "set_dormancy_days", "set_idle_threshold", "set_autopilot",
        "engage",
    ):
        assert action in dashboard.ALLOWED_ACTIONS, f"missing action {action!r}"


def test_destructive_actions_are_a_subset_of_allowed():
    assert dashboard.DESTRUCTIVE_ACTIONS
    assert set(dashboard.DESTRUCTIVE_ACTIONS) <= set(dashboard.ALLOWED_ACTIONS)
    for guarded in ("tidy_execute", "docker_prune_execute", "deep_clean_execute",
                    "set_autopilot", "engage"):
        assert guarded in dashboard.DESTRUCTIVE_ACTIONS


@pytest.mark.parametrize("action", sorted(dashboard.DESTRUCTIVE_ACTIONS))
def test_every_destructive_action_requires_confirmation(action, monkeypatch):
    # Nothing destructive may run without the guard gesture (params.confirm).
    sentinel = {"ran": False}
    monkeypatch.setattr(dashboard, "_tidy", lambda execute: sentinel.update(ran=True) or {"ok": True})
    monkeypatch.setattr(dashboard, "_docker_prune", lambda execute: sentinel.update(ran=True) or {"ok": True})
    monkeypatch.setattr(dashboard, "_deep_clean", lambda execute: sentinel.update(ran=True) or {"ok": True})
    monkeypatch.setattr(dashboard, "_apply_setting", lambda *a, **k: sentinel.update(ran=True) or {"ok": True})
    monkeypatch.setattr(dashboard, "_engage", lambda: sentinel.update(ran=True) or {"ok": True})

    result = dashboard.run_command_action(action)  # no confirm

    assert result["ok"] is False
    assert "confirm" in result["error"].lower()
    assert sentinel["ran"] is False, "guarded action ran without confirmation"


def test_docker_prune_execute_runs_and_audits(monkeypatch):
    from lib.docker_ops import CleanupResult

    monkeypatch.setattr(
        dashboard, "system_prune",
        lambda dry_run: [CleanupResult("prune_images", 2, "120MB")],
    )
    audits = []
    monkeypatch.setattr(dashboard, "log_action", lambda **kw: audits.append(kw))

    result = dashboard.run_command_action("docker_prune_execute", {"confirm": True})

    assert result["ok"] is True
    assert result["mode"] == "execute"
    assert audits and audits[0]["action_type"] == "docker_prune"


def test_deep_clean_preview_never_deletes(tmp_path, monkeypatch):
    from lib.autopilot import BloatTarget

    victim = tmp_path / "node_modules"
    victim.mkdir()
    monkeypatch.setattr(
        dashboard, "find_bloat",
        lambda home, min_age_days=7: [BloatTarget(str(victim), 500, 30.0, True)],
    )

    result = dashboard.run_command_action("deep_clean_preview")

    assert result["ok"] is True
    assert result["mode"] == "preview"
    assert result["count"] == 1
    assert victim.exists(), "preview must never delete"


def test_set_dry_run_applies_setting(monkeypatch):
    captured = {}
    monkeypatch.setattr(dashboard, "update_config", lambda updates: captured.update(updates) or updates)

    result = dashboard.run_command_action("set_dry_run", {"enabled": True})

    assert result["ok"] is True
    assert captured == {"safety.dry_run": True}


def test_set_dormancy_days_validates_range(monkeypatch):
    monkeypatch.setattr(dashboard, "update_config", lambda updates: updates)

    assert dashboard.run_command_action("set_dormancy_days", {"days": 14})["ok"] is True
    bad = dashboard.run_command_action("set_dormancy_days", {"days": -5})
    assert bad["ok"] is False


def test_set_idle_threshold_validates_range(monkeypatch):
    monkeypatch.setattr(dashboard, "update_config", lambda updates: updates)

    assert dashboard.run_command_action("set_idle_threshold", {"percent": 75})["ok"] is True
    assert dashboard.run_command_action("set_idle_threshold", {"percent": 150})["ok"] is False


def test_set_autopilot_is_guarded_but_applies_when_confirmed(monkeypatch):
    captured = {}
    monkeypatch.setattr(dashboard, "update_config", lambda updates: captured.update(updates) or updates)

    # disarm still needs the guard gesture (it is a guarded toggle)
    assert dashboard.run_command_action("set_autopilot", {"armed": False})["ok"] is False
    result = dashboard.run_command_action("set_autopilot", {"armed": True, "confirm": True})
    assert result["ok"] is True
    assert captured == {"safety.autopilot_armed": True}


def test_engage_runs_the_full_sweep_only_when_confirmed(monkeypatch):
    calls = []
    monkeypatch.setattr(dashboard, "_tidy", lambda execute: calls.append(("tidy", execute)) or {"ok": True, "would_free_bytes": 1})
    monkeypatch.setattr(dashboard, "_docker_prune", lambda execute: calls.append(("docker", execute)) or {"ok": True})
    monkeypatch.setattr(dashboard, "_deep_clean", lambda execute: calls.append(("deep", execute)) or {"ok": True, "would_free_bytes": 2})

    assert dashboard.run_command_action("engage")["ok"] is False  # no confirm → nothing
    assert calls == []

    result = dashboard.run_command_action("engage", {"confirm": True})
    assert result["ok"] is True
    assert ("tidy", True) in calls and ("docker", True) in calls and ("deep", True) in calls


def test_settings_section_exposes_live_control_state(monkeypatch):
    stats = dashboard.collect_stats()
    assert "settings" in stats
    for key in ("dry_run", "notify", "dormancy_days", "idle_threshold", "autopilot_armed"):
        assert key in stats["settings"], f"missing settings field {key}"
    assert json.loads(json.dumps(stats["settings"])) == stats["settings"]


# --------------------------------------------------------------------------- #
# front-end cockpit — a control for every action; guards on destructive ones
# --------------------------------------------------------------------------- #
HTML = (dashboard.WEB_DIR / "index.html").read_text()
LOW = HTML.lower()


@pytest.mark.parametrize("action", sorted(dashboard.ALLOWED_ACTIONS))
def test_cockpit_has_a_control_for_every_action(action):
    assert f'data-action="{action}"' in HTML, f"no cockpit control drives {action!r}"


@pytest.mark.parametrize("action", sorted(dashboard.DESTRUCTIVE_ACTIONS))
def test_destructive_controls_are_guarded(action):
    # The destructive control and its guard marker sit on the same element so
    # the cover/lever throw is structurally the confirm gesture (R15).
    assert (
        f'data-action="{action}" data-guarded' in HTML
        or f'data-guarded data-action="{action}"' in HTML
    ), f"destructive action {action!r} is not behind a guard"


def test_cockpit_has_the_skeuomorphic_control_family():
    # R15's named controls must all be present in the panel.
    for marker in ("guarded toggle", "throttle", "rotary", "rocker",
                   "annunciator", "engage"):
        assert marker in LOW, f"missing cockpit control: {marker}"


def test_guarded_controls_send_confirmation_from_the_cover_gesture():
    # The JS arms a guarded control via its cover, then fires with confirm:true.
    assert "data-guarded" in HTML
    assert "armed" in LOW
    assert "confirm: true" in HTML or "confirm:true" in HTML


def test_cockpit_initialises_controls_from_live_settings():
    # Controls reflect real state pulled from /api/stats (settings section).
    assert "settings" in LOW
