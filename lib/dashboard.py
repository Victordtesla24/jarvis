"""JARVIS holographic dashboard & command centre.

A local-only (loopback) HTTP server that exposes JARVIS's live telemetry as
JSON and serves a Three.js heads-up display styled after the Stark / Iron Man
command consoles. It runs entirely on the Python standard library — no extra
runtime dependencies — and the control surface is a tight allow-list so the
browser can never ask JARVIS to do anything destructive without explicit
confirmation.

Design notes:
- Binds to 127.0.0.1 by default. This server can trigger cleanup actions, so
  it must never be exposed to the network.
- Every telemetry source is wrapped so one failing sensor degrades to an
  ``{"error": ...}`` stub instead of taking the whole payload down.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import threading
import webbrowser
from contextlib import closing
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from lib.cleanup import (
    create_cleanup_plan,
    execute_cleanup,
    find_cleanup_targets,
    format_size,
)
from lib.config import get_config
from lib.database import get_connection, get_machine_state, get_recent_logs, log_action
from lib.docker_ops import get_containers, is_docker_running, system_prune
from lib.llm_brain import get_llm_brain
from lib.machine import get_system_info

logger = logging.getLogger(__name__)

WEB_DIR = Path(__file__).resolve().parent / "dashboard_web"
APP_DIR = Path(__file__).resolve().parent / "dashboard_app"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 7327  # J-A-R-V on the dialpad

MAX_TIDY_TARGETS = 50
RECENT_LOG_LIMIT = 15
MAX_BODY_BYTES = 64 * 1024

ALLOWED_ACTIONS = ("refresh", "tidy_preview", "tidy_execute", "docker_prune_preview")


# --------------------------------------------------------------------------- #
# Telemetry sections (each isolated so one failure can't sink the payload)
# --------------------------------------------------------------------------- #
def _system_section() -> dict:
    info = get_system_info()
    return {
        "disk": {
            "total_gb": info.disk.total_gb,
            "used_gb": info.disk.used_gb,
            "free_gb": info.disk.free_gb,
            "used_pct": info.disk.used_pct,
        },
        "ram": {
            "total_gb": info.ram_total_gb,
            "used_gb": info.ram_used_gb,
            "used_pct": info.ram_used_pct,
        },
        "cpu_idle_pct": info.cpu_idle_pct,
        "cpu_load_pct": round(100 - info.cpu_idle_pct, 1),
    }


def _docker_section() -> dict:
    if not is_docker_running():
        return {"running": False, "running_count": 0, "containers": []}
    containers = get_containers()
    return {
        "running": True,
        "running_count": sum(1 for c in containers if c.state == "running"),
        "containers": [
            {"name": c.name, "image": c.image, "state": c.state, "status": c.status}
            for c in containers
        ],
    }


def _brain_section() -> dict:
    brain = get_llm_brain()
    return {"available": bool(brain.available), "model": getattr(brain, "model", "")}


def _audit_summary() -> dict:
    with closing(get_connection()) as conn:
        total = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
        last_24h = conn.execute(
            "SELECT COUNT(*) FROM audit_log "
            "WHERE timestamp > datetime('now', '-24 hours')"
        ).fetchone()[0]
        freed = conn.execute("SELECT SUM(bytes_freed) FROM audit_log").fetchone()[0] or 0
        by_machine = {
            row[0]: row[1]
            for row in conn.execute(
                "SELECT machine, COUNT(*) FROM audit_log GROUP BY machine"
            ).fetchall()
        }
    freed = int(freed)
    return {
        "total_actions": total,
        "actions_24h": last_24h,
        "total_freed_bytes": freed,
        "total_freed_human": format_size(freed),
        "by_machine": by_machine,
    }


def _machines_section() -> list:
    config = get_config()
    machines = []
    for name, conf in config.machines.items():
        state = get_machine_state(name) or {}
        machines.append(
            {
                "name": name,
                "hostname": conf.get("hostname", ""),
                "enabled": bool(conf.get("enabled", False)),
                "disk_used_pct": state.get("disk_used_pct"),
                "ram_used_pct": state.get("ram_used_pct"),
                "last_updated": state.get("last_updated"),
            }
        )
    return machines


def _recent_section() -> list:
    out = []
    for row in get_recent_logs(limit=RECENT_LOG_LIMIT):
        freed = row.get("bytes_freed") or 0
        out.append(
            {
                "timestamp": row.get("timestamp"),
                "machine": row.get("machine"),
                "action": row.get("action_type"),
                "bytes_freed": freed,
                "freed_human": format_size(freed),
                "outcome": row.get("outcome"),
                "description": row.get("description"),
            }
        )
    return out


def _safe(section):
    """Run a telemetry section, degrading exceptions to an error stub."""
    try:
        return section()
    except Exception as exc:  # one sensor failing must not blank the HUD
        logger.warning("dashboard section %s failed: %s", getattr(section, "__name__", section), exc)
        return {"error": str(exc)}


def collect_stats() -> dict:
    """Gather a JSON-serializable snapshot of JARVIS's live state."""
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "system": _safe(_system_section),
        "docker": _safe(_docker_section),
        "brain": _safe(_brain_section),
        "audit": _safe(_audit_summary),
        "machines": _safe(_machines_section),
        "recent": _safe(_recent_section),
    }


# --------------------------------------------------------------------------- #
# Command centre — a tight allow-list of safe control actions
# --------------------------------------------------------------------------- #
def _tidy(execute: bool) -> dict:
    targets = list(find_cleanup_targets(str(Path.home())))[:MAX_TIDY_TARGETS]
    paths = [p for p, _ in targets]
    plan = create_cleanup_plan("mac", paths, "Dashboard tidy")
    results = execute_cleanup(plan, dry_run=not execute)
    freed = sum(r.size_bytes for r in results if r.success)

    if execute:
        succeeded = sum(1 for r in results if r.success)
        log_action(
            machine="mac",
            action_type="tidy",
            description=f"Dashboard cleanup: {succeeded} items",
            files_affected=paths[:20],
            bytes_freed=freed,
            outcome="success" if succeeded == len(results) else "partial",
            llm_reasoning="Triggered from the JARVIS dashboard command centre",
        )

    return {
        "ok": True,
        "mode": "execute" if execute else "preview",
        "count": len(results),
        "would_free_bytes": freed,
        "would_free_human": format_size(freed),
        "sample": paths[:10],
    }


def _docker_prune_preview() -> dict:
    results = system_prune(dry_run=True)
    return {
        "ok": True,
        "mode": "preview",
        "results": [
            {"action": r.action, "removed": r.removed, "detail": r.space_freed}
            for r in results
        ],
    }


def run_command_action(action: str, params: dict | None = None) -> dict:
    """Execute one allow-listed command. Never runs arbitrary input."""
    params = params or {}

    if action == "refresh":
        return {"ok": True, "stats": collect_stats()}
    if action == "tidy_preview":
        return _tidy(execute=False)
    if action == "tidy_execute":
        if not params.get("confirm"):
            return {
                "ok": False,
                "error": "tidy_execute requires confirm=true",
                "actions": list(ALLOWED_ACTIONS),
            }
        return _tidy(execute=True)
    if action == "docker_prune_preview":
        return _docker_prune_preview()

    return {
        "ok": False,
        "error": f"unknown action: {action!r}",
        "actions": list(ALLOWED_ACTIONS),
    }


# --------------------------------------------------------------------------- #
# HTTP layer
# --------------------------------------------------------------------------- #
_CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
}


def _content_type(name: str) -> str:
    return _CONTENT_TYPES.get(Path(name).suffix, "application/octet-stream")


def _safe_asset_name(path: str) -> str | None:
    """Map a URL path to a flat filename inside WEB_DIR, blocking traversal."""
    name = path.lstrip("/")
    if not name or "/" in name or ".." in name:
        return None
    return name


class DashboardHandler(BaseHTTPRequestHandler):
    server_version = "JARVIS-HUD/1.0"

    def _send(self, status: int, body, content_type: str) -> None:
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _send_json(self, status: int, obj) -> None:
        self._send(status, json.dumps(obj), "application/json; charset=utf-8")

    def _serve_asset(self, name: str) -> None:
        try:
            data = (WEB_DIR / name).read_bytes()
        except OSError:
            self._send_json(404, {"error": "not found"})
            return
        self._send(200, data, _content_type(name))

    def do_GET(self) -> None:  # noqa: N802 (stdlib naming)
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            self._serve_asset("index.html")
        elif path == "/api/stats":
            self._send_json(200, collect_stats())
        else:
            name = _safe_asset_name(path)
            if name and (WEB_DIR / name).is_file():
                self._serve_asset(name)
            else:
                self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path.split("?", 1)[0] != "/api/command":
            self._send_json(404, {"error": "not found"})
            return

        length = int(self.headers.get("Content-Length", 0) or 0)
        if length > MAX_BODY_BYTES:
            self._send_json(413, {"error": "payload too large"})
            return

        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw or b"{}")
        except (ValueError, TypeError):
            self._send_json(400, {"error": "invalid JSON"})
            return

        if not isinstance(payload, dict):
            self._send_json(400, {"error": "expected a JSON object"})
            return

        result = run_command_action(payload.get("action"), payload.get("params"))
        self._send_json(200 if result.get("ok") else 400, result)

    def log_message(self, *args) -> None:  # silence default stderr access log
        pass


def make_server(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> ThreadingHTTPServer:
    """Build (but do not start) the dashboard HTTP server."""
    return ThreadingHTTPServer((host, port), DashboardHandler)


def serve(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT, open_browser: bool = True) -> None:
    """Run the dashboard server until interrupted (browser / headless mode)."""
    server = make_server(host, port)
    bound_host, bound_port = server.server_address[:2]
    url = f"http://{bound_host}:{bound_port}"
    print(f"JARVIS dashboard online at {url}  —  Ctrl-C to disengage")

    if open_browser:
        try:
            webbrowser.open(url)
        except Exception:  # pragma: no cover - environment dependent
            pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:  # pragma: no cover - interactive
        print("\nJARVIS dashboard offline.")
    finally:
        server.shutdown()
        server.server_close()


# --------------------------------------------------------------------------- #
# Floating-window desktop app — a transparent, always-on-top Electron shell
# that loads this loopback HUD (SC5). No browser involved.
# --------------------------------------------------------------------------- #
def find_electron() -> str | None:
    """Locate an Electron binary: project-local install first, then ``$PATH``."""
    local = APP_DIR / "node_modules" / ".bin" / "electron"
    if local.exists():
        return str(local)
    return shutil.which("electron")


def launch_app(
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_PORT,
    *,
    electron: str | None = None,
    spawn=subprocess.Popen,
):
    """Spawn the Electron HUD shell pointed at the loopback backend.

    The window discovers the backend through ``JARVIS_DASHBOARD_URL`` so no
    browser is ever opened. Raises ``RuntimeError`` if Electron is unavailable.
    """
    electron = electron or find_electron()
    if not electron:
        raise RuntimeError(
            "Electron not found. Install the app shell with "
            "`cd lib/dashboard_app && npm install`, or run `jarvis dashboard --browser`."
        )
    env = dict(os.environ, JARVIS_DASHBOARD_URL=f"http://{host}:{port}")
    return spawn([electron, str(APP_DIR)], env=env)


def run_app(
    host: str = DEFAULT_HOST, port: int = DEFAULT_PORT, *, electron: str | None = None
) -> int:
    """Start the loopback backend and float the ``.app`` over the desktop.

    Blocks until the window closes, then tears the backend down. Returns the
    Electron exit code.
    """
    server = make_server(host, port)
    bound_host, bound_port = server.server_address[:2]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        proc = launch_app(bound_host, bound_port, electron=electron)
    except Exception:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
        raise
    try:
        return proc.wait()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
