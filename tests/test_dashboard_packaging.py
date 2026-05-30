"""Tests for packaging + notarizing the JARVIS floating ``.app`` (SC8).

SC8 requires the dashboard app to be *packaged* (a distributable macOS ``.app``
built by electron-builder with a hardened runtime + entitlements) and
*notarized* (signed with an Apple Developer ID and stapled by Apple's notary
service), and for ``jarvis dashboard`` to launch that window.

Notarization needs an Apple Developer ID, which isn't present on the build box,
so the notarize hook must degrade gracefully: when credentials are absent it
skips notarization and still produces a locally-runnable unsigned ``.app`` (per
the PRD constraint). These tests therefore pin the *configuration* and the
*launcher behaviour* rather than running a live build:

- ``package.json`` declares a hardened-runtime, entitlement-signed, notarizable
  macOS packaging target and depends on ``@electron/notarize``.
- ``build/entitlements.mac.plist`` is a valid hardened-runtime entitlements file.
- ``build/notarize.js`` is a valid afterSign hook that notarizes when Apple
  credentials are set and skips (without failing the build) when they aren't.
- ``find_packaged_app`` locates a built/installed ``.app``'s executable.
- ``launch_app`` prefers the packaged ``.app`` over a dev Electron run.
- ``jarvis dashboard`` launches the window when only the packaged app exists
  (no dev Electron install required).
"""
import argparse
import json
import plistlib
import shutil
import subprocess

import pytest

from lib import dashboard

APP_DIR = dashboard.APP_DIR
BUILD_DIR = APP_DIR / "build"


# --------------------------------------------------------------------------- #
# package.json — packaged, hardened, notarizable macOS build
# --------------------------------------------------------------------------- #
def _build_config() -> dict:
    return json.loads((APP_DIR / "package.json").read_text())["build"]


def test_package_json_packages_a_distributable_mac_target():
    targets = _build_config()["mac"]["target"]
    # A real distributable (not just an unpacked dir) — dmg is the canonical one.
    assert "dmg" in targets, "must build a distributable .dmg"


def test_package_json_enables_hardened_runtime_for_notarization():
    mac = _build_config()["mac"]
    assert mac.get("hardenedRuntime") is True, "notarization requires a hardened runtime"
    assert mac.get("gatekeeperAssess") is False, "skip the local gatekeeper assess step"


def test_package_json_signs_with_entitlements():
    mac = _build_config()["mac"]
    ents = "build/entitlements.mac.plist"
    assert mac.get("entitlements") == ents
    assert mac.get("entitlementsInherit") == ents


def test_package_json_wires_the_notarize_after_sign_hook():
    assert _build_config()["afterSign"] == "build/notarize.js"


def test_package_json_depends_on_electron_notarize():
    pkg = json.loads((APP_DIR / "package.json").read_text())
    assert "@electron/notarize" in pkg.get("devDependencies", {})


def test_product_name_matches_launcher_constant():
    # The Python launcher must look for the same .app name electron-builder emits.
    assert dashboard.APP_PRODUCT_NAME == _build_config()["productName"]


# --------------------------------------------------------------------------- #
# Entitlements — a valid hardened-runtime plist
# --------------------------------------------------------------------------- #
def test_entitlements_is_a_valid_hardened_runtime_plist():
    ents = plistlib.loads((BUILD_DIR / "entitlements.mac.plist").read_bytes())
    # Electron needs JIT under the hardened runtime; the HUD talks to loopback.
    assert ents.get("com.apple.security.cs.allow-jit") is True
    assert ents.get("com.apple.security.network.client") is True


# --------------------------------------------------------------------------- #
# notarize.js — afterSign hook that degrades without Apple credentials
# --------------------------------------------------------------------------- #
def test_notarize_hook_is_syntactically_valid_js():
    node = shutil.which("node")
    if not node:  # pragma: no cover - node not present in this environment
        pytest.skip("node not available to syntax-check the hook")
    proc = subprocess.run(
        [node, "--check", str(BUILD_DIR / "notarize.js")],
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr


def test_notarize_hook_skips_when_credentials_absent():
    src = (BUILD_DIR / "notarize.js").read_text()
    assert "@electron/notarize" in src
    assert "APPLE_ID" in src and "APPLE_TEAM_ID" in src
    # A guard that returns early (skips) when the Apple credentials aren't set.
    assert "Skipping notarization" in src


# --------------------------------------------------------------------------- #
# find_packaged_app — locate a built/installed .app's executable
# --------------------------------------------------------------------------- #
def test_find_packaged_app_locates_built_app(tmp_path, monkeypatch):
    monkeypatch.setattr(dashboard, "APP_DIR", tmp_path)
    exe = tmp_path / "dist" / "mac" / "JARVIS.app" / "Contents" / "MacOS" / "JARVIS"
    exe.parent.mkdir(parents=True)
    exe.write_text("#!/bin/sh\n")

    assert dashboard.find_packaged_app() == str(exe)


def test_find_packaged_app_returns_none_when_unbuilt(tmp_path, monkeypatch):
    monkeypatch.setattr(dashboard, "APP_DIR", tmp_path)  # no dist/ built
    # Don't let a real /Applications/JARVIS.app (if any) leak into this test.
    monkeypatch.setattr(dashboard, "_INSTALLED_APP_ROOTS", ())

    assert dashboard.find_packaged_app() is None


# --------------------------------------------------------------------------- #
# launch_app — prefer the packaged .app, fall back to dev Electron
# --------------------------------------------------------------------------- #
def test_launch_app_prefers_packaged_app(monkeypatch):
    captured = {}

    def fake_spawn(argv, env=None):
        captured["argv"] = argv
        captured["env"] = env
        return object()

    exe = "/Applications/JARVIS.app/Contents/MacOS/JARVIS"
    monkeypatch.setattr(dashboard, "find_packaged_app", lambda: exe)
    monkeypatch.setattr(
        dashboard, "find_electron", lambda: pytest.fail("must not use dev Electron")
    )

    dashboard.launch_app(host="127.0.0.1", port=7327, spawn=fake_spawn)

    assert captured["argv"] == [exe]  # spawn the packaged binary directly
    assert captured["env"]["JARVIS_DASHBOARD_URL"] == "http://127.0.0.1:7327"


def test_launch_app_falls_back_to_dev_electron(monkeypatch):
    captured = {}

    def fake_spawn(argv, env=None):
        captured["argv"] = argv
        return object()

    monkeypatch.setattr(dashboard, "find_packaged_app", lambda: None)
    monkeypatch.setattr(dashboard, "find_electron", lambda: "/usr/bin/electron")

    dashboard.launch_app(host="127.0.0.1", port=7327, spawn=fake_spawn)

    assert captured["argv"] == ["/usr/bin/electron", str(dashboard.APP_DIR)]


# --------------------------------------------------------------------------- #
# CLI — the packaged app alone is enough to launch (no dev Electron needed)
# --------------------------------------------------------------------------- #
def _dash_args(**over):
    base = dict(host=None, port=None, browser=False, no_browser=False)
    base.update(over)
    return argparse.Namespace(**base)


def test_cli_dashboard_launches_packaged_app_without_dev_electron(monkeypatch):
    from lib import cli

    called = {}
    monkeypatch.setattr(dashboard, "find_electron", lambda: None)
    monkeypatch.setattr(
        dashboard, "find_packaged_app", lambda: "/Applications/JARVIS.app/Contents/MacOS/JARVIS"
    )
    monkeypatch.setattr(dashboard, "run_app", lambda **kw: called.setdefault("app", kw))

    cli.dashboard_command(_dash_args())

    assert "app" in called, "a packaged .app should launch even without dev Electron"
