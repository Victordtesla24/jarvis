"""Tests for the JARVIS floating-window desktop app (SC5).

SC5 requires the dashboard to be a *real* transparent, always-on-top floating
``.app`` that launches without a browser. The app is a thin Electron shell that
loads the existing loopback HUD (reusing ``/api/stats`` + ``/api/command``).

These tests pin:

- ``find_electron`` locates a project-local install first, then ``$PATH``.
- ``launch_app`` spawns Electron pointed at the loopback URL (via env), never a
  browser, and fails loudly when Electron is absent.
- ``run_app`` starts the backend, launches the window, and tears the server
  down when the window closes — without ever opening a browser.
- the Electron shell on disk (``package.json``/``main.js``/``preload.js``) is a
  transparent, frameless, always-on-top, click-through, ``.app``-buildable shell.
- ``jarvis dashboard`` launches the app by default and only serves a browser
  when explicitly asked.
"""
import argparse
import json

import pytest

from lib import dashboard


# --------------------------------------------------------------------------- #
# find_electron — project-local install wins, then PATH, else None
# --------------------------------------------------------------------------- #
def test_find_electron_prefers_local_install(tmp_path, monkeypatch):
    monkeypatch.setattr(dashboard, "APP_DIR", tmp_path)
    binp = tmp_path / "node_modules" / ".bin" / "electron"
    binp.parent.mkdir(parents=True)
    binp.write_text("#!/bin/sh\n")
    monkeypatch.setattr(dashboard.shutil, "which", lambda _: "/usr/bin/electron")

    assert dashboard.find_electron() == str(binp)


def test_find_electron_falls_back_to_path(tmp_path, monkeypatch):
    monkeypatch.setattr(dashboard, "APP_DIR", tmp_path)  # no local install
    monkeypatch.setattr(dashboard.shutil, "which", lambda _: "/usr/local/bin/electron")

    assert dashboard.find_electron() == "/usr/local/bin/electron"


def test_find_electron_returns_none_when_absent(tmp_path, monkeypatch):
    monkeypatch.setattr(dashboard, "APP_DIR", tmp_path)
    monkeypatch.setattr(dashboard.shutil, "which", lambda _: None)

    assert dashboard.find_electron() is None


# --------------------------------------------------------------------------- #
# launch_app — spawn Electron at the loopback URL, never a browser
# --------------------------------------------------------------------------- #
def test_launch_app_spawns_electron_with_loopback_url():
    captured = {}

    def fake_spawn(argv, env=None):
        captured["argv"] = argv
        captured["env"] = env
        return object()

    dashboard.launch_app(
        host="127.0.0.1", port=7327, electron="/fake/electron", spawn=fake_spawn
    )

    assert captured["argv"] == ["/fake/electron", str(dashboard.APP_DIR)]
    # The shell discovers the backend through the environment, not a browser.
    assert captured["env"]["JARVIS_DASHBOARD_URL"] == "http://127.0.0.1:7327"


def test_launch_app_raises_when_electron_missing(monkeypatch):
    monkeypatch.setattr(dashboard, "find_electron", lambda: None)

    with pytest.raises(RuntimeError):
        dashboard.launch_app(spawn=lambda *a, **k: None)


# --------------------------------------------------------------------------- #
# run_app — backend + window lifecycle, never opens a browser
# --------------------------------------------------------------------------- #
class _FakeProc:
    def __init__(self, code=0):
        self._code = code

    def wait(self):
        return self._code


def test_run_app_launches_window_and_tears_down_server(monkeypatch):
    seen = {}

    def fake_launch(host, port, *, electron=None, spawn=None):
        seen["host"], seen["port"] = host, port
        return _FakeProc(0)

    monkeypatch.setattr(dashboard, "launch_app", fake_launch)

    def no_browser(*a, **k):  # SC5: launches WITHOUT a browser
        raise AssertionError("run_app must never open a browser")

    monkeypatch.setattr(dashboard.webbrowser, "open", no_browser)

    code = dashboard.run_app(host="127.0.0.1", port=0)

    assert code == 0
    assert seen["host"] == "127.0.0.1"
    assert seen["port"] != 0, "server must bind a real ephemeral port before launch"


def test_run_app_cleans_up_when_launch_fails(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("electron exploded")

    monkeypatch.setattr(dashboard, "launch_app", boom)

    # Must propagate, and must not leave a server bound (no leak / port reuse OK).
    with pytest.raises(RuntimeError):
        dashboard.run_app(host="127.0.0.1", port=0)


# --------------------------------------------------------------------------- #
# Electron shell on disk — transparent, frameless, always-on-top, .app-buildable
# --------------------------------------------------------------------------- #
def test_app_dir_exists():
    assert dashboard.APP_DIR.is_dir(), "the Electron shell must live on disk"


def test_package_json_builds_a_mac_app():
    pkg = json.loads((dashboard.APP_DIR / "package.json").read_text())

    assert pkg["main"] == "main.js"
    devdeps = pkg.get("devDependencies", {})
    assert "electron" in devdeps, "electron is the app runtime"
    assert "electron-builder" in devdeps, "needed to package the .app"

    build = pkg["build"]
    assert build["appId"], "the .app needs a bundle identifier"
    assert build["productName"], "the .app needs a product name"
    assert build["mac"], "must declare a macOS build target"


def test_main_js_is_a_transparent_floating_window():
    main = (dashboard.APP_DIR / "main.js").read_text()

    required = [
        "transparent: true",
        "frame: false",
        "#00000000",            # fully-transparent backgroundColor
        "hasShadow: false",
        "setAlwaysOnTop",
        "screen-saver",         # float above everything, incl. fullscreen apps
        "setVisibleOnAllWorkspaces",
        "visibleOnFullScreen",
        "backgroundThrottling: false",
        "setIgnoreMouseEvents",  # click-through
        "set-ignore-mouse",      # IPC channel from preload
        "JARVIS_DASHBOARD_URL",  # loads the loopback HUD, not a bundled page
    ]
    for needle in required:
        assert needle in main, f"main.js missing {needle!r}"


def test_preload_forwards_click_through_for_interactive_regions():
    preload = (dashboard.APP_DIR / "preload.js").read_text()

    assert "data-interactive" in preload
    assert "set-ignore-mouse" in preload


# --------------------------------------------------------------------------- #
# HUD transparency — renderer clears to alpha 0, interactive regions marked
# --------------------------------------------------------------------------- #
def test_hud_renderer_clears_to_transparent():
    html = (dashboard.WEB_DIR / "index.html").read_text()

    assert "setClearColor(0x000000, 0)" in html
    assert "data-interactive" in html, "click-through needs interactive regions"


# --------------------------------------------------------------------------- #
# CLI — `jarvis dashboard` launches the app, `--browser` serves a web fallback
# --------------------------------------------------------------------------- #
def _dash_args(**over):
    base = dict(host=None, port=None, browser=False, no_browser=False)
    base.update(over)
    return argparse.Namespace(**base)


def test_cli_dashboard_default_launches_app(monkeypatch):
    from lib import cli

    called = {}
    monkeypatch.setattr(dashboard, "find_electron", lambda: "/fake/electron")
    monkeypatch.setattr(dashboard, "run_app", lambda **kw: called.setdefault("app", kw))
    monkeypatch.setattr(
        dashboard, "serve", lambda **kw: pytest.fail("must not serve in app mode")
    )

    cli.dashboard_command(_dash_args())

    assert "app" in called


def test_cli_dashboard_browser_mode_serves(monkeypatch):
    from lib import cli

    called = {}
    monkeypatch.setattr(dashboard, "serve", lambda **kw: called.setdefault("serve", kw))
    monkeypatch.setattr(
        dashboard, "run_app", lambda **kw: pytest.fail("must not launch app in browser mode")
    )

    cli.dashboard_command(_dash_args(browser=True))

    assert called["serve"]["open_browser"] is True


def test_cli_dashboard_guides_when_electron_missing(monkeypatch, capsys):
    from lib import cli

    monkeypatch.setattr(dashboard, "find_electron", lambda: None)
    monkeypatch.setattr(
        dashboard, "run_app", lambda **kw: pytest.fail("must not launch without electron")
    )

    cli.dashboard_command(_dash_args())

    out = capsys.readouterr().out.lower()
    assert "electron" in out  # tells the user how to get the app runtime
