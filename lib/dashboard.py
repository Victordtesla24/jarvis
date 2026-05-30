"""JARVIS holographic dashboard & command centre.

A local-only (loopback) HTTP server that exposes JARVIS's live telemetry as
JSON and serves a Three.js heads-up display styled after an Iron-Man-style
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

from lib.autopilot import find_bloat
from lib.cleanup import (
    create_cleanup_plan,
    execute_cleanup,
    find_cleanup_targets,
    format_size,
)
from lib.config import get_config, update_config
from lib.database import get_connection, get_machine_state, get_recent_logs, log_action
from lib.docker_ops import get_containers, is_docker_running, system_prune
from lib.llm_brain import get_llm_brain
from lib.machine import get_system_info

logger = logging.getLogger(__name__)

WEB_DIR = Path(__file__).resolve().parent / "dashboard_web"
APP_DIR = Path(__file__).resolve().parent / "dashboard_app"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 7327  # J-A-R-V on the dialpad

# Bundle name electron-builder emits (must match package.json build.productName).
APP_PRODUCT_NAME = "JARVIS"
# Where a packaged .app may be installed system-wide (vs. freshly built in dist/).
_INSTALLED_APP_ROOTS = (Path("/Applications"),)

MAX_TIDY_TARGETS = 50
MAX_DEEP_CLEAN_TARGETS = 50
RECENT_LOG_LIMIT = 15
MAX_BODY_BYTES = 64 * 1024

# The cockpit control panel (R15) drives this full allow-list. Settings persist
# tunables; *_preview actions are read-only; *_execute / engage are destructive.
ALLOWED_ACTIONS = (
    "refresh",
    "tidy_preview", "tidy_execute",
    "docker_prune_preview", "docker_prune_execute",
    "deep_clean_preview", "deep_clean_execute",
    "set_dry_run", "set_notify",
    "set_dormancy_days", "set_idle_threshold", "set_autopilot",
    "engage",
)

# Actions that delete data or authorise autonomous deletion. Each is gated
# behind a guarded control whose cover/lever throw supplies ``params.confirm`` —
# the guard gesture IS the confirmation (R15).
DESTRUCTIVE_ACTIONS = frozenset({
    "tidy_execute",
    "docker_prune_execute",
    "deep_clean_execute",
    "set_autopilot",
    "engage",
})


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


def _settings_section() -> dict:
    """Live positions for the cockpit's tunable controls (so toggles, the
    throttle lever and the rotary knob boot into their real state)."""
    config = get_config()
    safety = config.safety
    return {
        "dry_run": bool(safety.get("dry_run", False)),
        "notify": bool(config.notifications.get("enabled", True)),
        "dormancy_days": safety.get("bloat_min_age_days", 7),
        "idle_threshold": safety.get("idle_cpu_threshold", 80),
        "autopilot_armed": bool(safety.get("autopilot_armed", True)),
    }


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
        "settings": _safe(_settings_section),
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


def _docker_prune(execute: bool) -> dict:
    results = system_prune(dry_run=not execute)
    removed = sum(r.removed for r in results)
    if execute:
        log_action(
            machine="mac",
            action_type="docker_prune",
            description=f"Dashboard docker prune: {removed} item(s) removed",
            outcome="success",
            llm_reasoning="Triggered from the JARVIS cockpit control panel",
        )
    return {
        "ok": True,
        "mode": "execute" if execute else "preview",
        "results": [
            {"action": r.action, "removed": r.removed, "detail": r.space_freed}
            for r in results
        ],
    }


def _deep_clean(execute: bool) -> dict:
    """Reclaim dormant regenerable bloat (``node_modules``, build output,
    caches) across the home tree — a deeper sweep than ``tidy``."""
    dormancy = get_config().safety.get("bloat_min_age_days", 7)
    targets = [
        t for t in find_bloat(str(Path.home()), min_age_days=dormancy)
        if t.reclaimable
    ]
    targets.sort(key=lambda t: t.size_bytes, reverse=True)
    targets = targets[:MAX_DEEP_CLEAN_TARGETS]
    paths = [t.path for t in targets]
    plan = create_cleanup_plan("mac", paths, "Dashboard deep clean")
    results = execute_cleanup(plan, dry_run=not execute)
    freed = sum(r.size_bytes for r in results if r.success)

    if execute:
        succeeded = sum(1 for r in results if r.success)
        log_action(
            machine="mac",
            action_type="deep_clean",
            description=f"Dashboard deep clean: {succeeded} dormant bloat dir(s)",
            files_affected=paths[:20],
            bytes_freed=freed,
            outcome="success" if succeeded == len(results) else "partial",
            llm_reasoning="Triggered from the JARVIS cockpit control panel",
        )

    return {
        "ok": True,
        "mode": "execute" if execute else "preview",
        "count": len(results),
        "would_free_bytes": freed,
        "would_free_human": format_size(freed),
        "sample": paths[:10],
    }


def _apply_setting(key: str, value) -> dict:
    """Persist one runtime setting and echo back its new value."""
    try:
        update_config({key: value})
    except (KeyError, TypeError) as exc:
        return {"ok": False, "error": str(exc), "actions": list(ALLOWED_ACTIONS)}
    return {"ok": True, "setting": key, "value": value}


def _set_dormancy_days(params: dict) -> dict:
    days = params.get("days")
    if not isinstance(days, int) or isinstance(days, bool) or not 0 <= days <= 365:
        return {"ok": False, "error": "days must be an int in 0..365"}
    return _apply_setting("safety.bloat_min_age_days", days)


def _set_idle_threshold(params: dict) -> dict:
    pct = params.get("percent")
    if isinstance(pct, bool) or not isinstance(pct, (int, float)) or not 0 <= pct <= 100:
        return {"ok": False, "error": "percent must be a number in 0..100"}
    return _apply_setting("safety.idle_cpu_threshold", pct)


def _engage() -> dict:
    """Master ENGAGE — run the full optimisation sweep in one guarded throw:
    execute tidy, docker prune, and a deep clean, then summarise."""
    tidy = _tidy(execute=True)
    docker = _docker_prune(execute=True)
    deep = _deep_clean(execute=True)
    freed = tidy.get("would_free_bytes", 0) + deep.get("would_free_bytes", 0)
    return {
        "ok": True,
        "mode": "execute",
        "freed_bytes": freed,
        "freed_human": format_size(freed),
        "steps": {"tidy": tidy, "docker_prune": docker, "deep_clean": deep},
    }


def run_command_action(action: str, params: dict | None = None) -> dict:
    """Execute one allow-listed command. Never runs arbitrary input.

    Destructive actions (:data:`DESTRUCTIVE_ACTIONS`) require ``params.confirm``
    — the guarded control's cover/lever throw supplies it.
    """
    params = params or {}

    if action not in ALLOWED_ACTIONS:
        return {
            "ok": False,
            "error": f"unknown action: {action!r}",
            "actions": list(ALLOWED_ACTIONS),
        }

    if action in DESTRUCTIVE_ACTIONS and not params.get("confirm"):
        return {
            "ok": False,
            "error": f"{action} is destructive — requires the guard gesture (confirm=true)",
            "actions": list(ALLOWED_ACTIONS),
        }

    if action == "refresh":
        return {"ok": True, "stats": collect_stats()}
    if action == "tidy_preview":
        return _tidy(execute=False)
    if action == "tidy_execute":
        return _tidy(execute=True)
    if action == "docker_prune_preview":
        return _docker_prune(execute=False)
    if action == "docker_prune_execute":
        return _docker_prune(execute=True)
    if action == "deep_clean_preview":
        return _deep_clean(execute=False)
    if action == "deep_clean_execute":
        return _deep_clean(execute=True)
    if action == "set_dry_run":
        return _apply_setting("safety.dry_run", bool(params.get("enabled")))
    if action == "set_notify":
        return _apply_setting("notifications.enabled", bool(params.get("enabled")))
    if action == "set_dormancy_days":
        return _set_dormancy_days(params)
    if action == "set_idle_threshold":
        return _set_idle_threshold(params)
    if action == "set_autopilot":
        return _apply_setting("safety.autopilot_armed", bool(params.get("armed")))
    if action == "engage":
        return _engage()

    # Defensive: an allow-listed action with no handler.
    return {"ok": False, "error": f"unhandled action: {action!r}"}


# --------------------------------------------------------------------------- #
# Voice / natural-language routing — the HUD "LISTENING" loop.
#
# Maps a spoken (or typed) phrase to JARVIS's capabilities and returns a short
# spoken reply. This surface is *read-only by construction*: it only ever runs
# telemetry reads and dry-run previews, and it NEVER executes a destructive
# action. A voice request to clean/optimise maps to the safe preview and JARVIS
# asks the operator to throw the guarded cockpit control — the guard gesture
# stays the sole confirmation for any deletion (R15/R18). Routing only targets
# actions already in :data:`ALLOWED_ACTIONS`; it adds no new command surface
# (R19).
# --------------------------------------------------------------------------- #
def _num(value, default: float = 0.0) -> float:
    """Coerce telemetry numbers, treating ``bool``/``None`` as the default."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return default
    return value


def _voice_health(system: dict) -> str:
    """Worst-of-three vitals severity, matching the HUD's health word."""
    def sev(v: float, warn: float, bad: float) -> str:
        return "critical" if v >= bad else "degraded" if v >= warn else "nominal"

    cpu = _num(system.get("cpu_load_pct"))
    ram = _num((system.get("ram") or {}).get("used_pct"))
    disk = _num((system.get("disk") or {}).get("used_pct"))
    rank = {"nominal": 0, "degraded": 1, "critical": 2}
    return max(
        (sev(cpu, 70, 88), sev(ram, 75, 90), sev(disk, 80, 92)),
        key=lambda s: rank[s],
    )


def _voice_reply(
    intent: str,
    speech: str,
    transcript: str,
    *,
    action: str | None = None,
    requires_guard: bool = False,
    result: dict | None = None,
) -> dict:
    return {
        "ok": True,
        "intent": intent,
        "transcript": transcript,
        "speech": speech,
        "action": action,
        "requires_guard": requires_guard,
        "result": result,
    }


def _voice_status(transcript: str) -> dict:
    stats = collect_stats()
    system = stats.get("system") or {}
    audit = stats.get("audit") or {}
    if isinstance(system, dict) and system.get("error"):
        return _voice_reply(
            "status",
            "Telemetry is degraded, sir — a sensor has dropped offline.",
            transcript, action="refresh", result=stats,
        )
    cpu = round(_num(system.get("cpu_load_pct")))
    ram = round(_num((system.get("ram") or {}).get("used_pct")))
    disk = round(_num((system.get("disk") or {}).get("used_pct")))
    head = {
        "nominal": "All systems nominal",
        "degraded": "Systems running degraded",
        "critical": "Warning — systems critical",
    }[_voice_health(system)]
    freed = audit.get("total_freed_human") or "0 bytes"
    speech = (
        f"{head}, sir. CPU load {cpu} percent, memory {ram} percent, "
        f"disk {disk} percent. I've reclaimed {freed} to date."
    )
    return _voice_reply("status", speech, transcript, action="refresh", result=stats)


def _voice_preview_cleanup(transcript: str, *, deep: bool) -> dict:
    out = _deep_clean(execute=False) if deep else _tidy(execute=False)
    label = "deep clean" if deep else "tidy"
    action = "deep_clean_execute" if deep else "tidy_execute"
    count = out.get("count", 0)
    human = out.get("would_free_human", "0B")
    if count:
        noun = "item" if count == 1 else "items"
        speech = (
            f"A {label} would reclaim {human} across {count} {noun}, sir. "
            f"Throw the {label} control in the cockpit to authorise it — "
            f"deletion stays guarded."
        )
    else:
        speech = f"Nothing to reclaim from a {label} right now, sir — you're already optimal."
    return _voice_reply(
        "deep_clean" if deep else "tidy", speech, transcript,
        action=action, requires_guard=True, result=out,
    )


def _voice_preview_docker(transcript: str) -> dict:
    out = _docker_prune(execute=False)
    total = sum(r.get("removed", 0) for r in out.get("results", []))
    if total:
        noun = "object" if total == 1 else "objects"
        speech = (
            f"A Docker prune would remove {total} reclaimable {noun}, sir. "
            f"Throw the prune control to authorise it."
        )
    else:
        speech = "Docker is already lean, sir — nothing to prune."
    return _voice_reply(
        "docker_prune", speech, transcript,
        action="docker_prune_execute", requires_guard=True, result=out,
    )


def interpret_command(text: str) -> dict:
    """Route a natural-language phrase to a JARVIS capability + spoken reply.

    Never deletes: destructive intents resolve to a read-only preview plus an
    instruction to throw the guarded cockpit control.
    """
    transcript = (text or "").strip()
    low = transcript.lower()
    if not low:
        return _voice_reply(
            "unknown",
            "I didn't catch that, sir. Try 'status', 'tidy', or 'deep clean'.",
            transcript,
        )

    def has(*words: str) -> bool:
        return any(w in low for w in words)

    if has("what can you", "what can i", "help", "capabilities", "commands"):
        return _voice_reply(
            "help",
            "I can report status, preview a tidy or a deep clean, scan Docker, or "
            "arm the full optimisation sweep. The destructive steps need you to "
            "throw the guarded control, sir.",
            transcript,
        )

    if has("status", "report", "how are", "how's", "how is", "vitals", "health",
           "sit rep", "sitrep", "diagnostic", "everything ok", "everything okay"):
        return _voice_status(transcript)

    if has("deep clean", "deep-clean", "deep", "bloat"):
        return _voice_preview_cleanup(transcript, deep=True)

    if has("tidy", "clean", "cleanup", "cache", "free up", "free space", "reclaim"):
        return _voice_preview_cleanup(transcript, deep=False)

    if has("docker", "prune", "container"):
        return _voice_preview_docker(transcript)

    if has("autopilot", "auto pilot", "auto-pilot"):
        disarm = has("disarm", "disable", "turn off", "stand down", "stop", " off")
        verb = "disarm" if disarm else "arm"
        return _voice_reply(
            "set_autopilot",
            f"Toggling autopilot is guarded, sir. To {verb} it, lift the cover on the "
            f"autopilot toggle in the cockpit and flip it.",
            transcript, action="set_autopilot", requires_guard=True,
        )

    if has("engage", "optimi", "full sweep", "sweep", "everything", "go full"):
        return _voice_reply(
            "engage",
            "The master optimisation sweep is a guarded action, sir. Lift the ENGAGE "
            "cover and throw the lever to authorise the full sweep.",
            transcript, action="engage", requires_guard=True,
        )

    return _voice_reply(
        "unknown",
        "I didn't catch a command, sir. Try 'status', 'tidy', 'deep clean', or "
        "'docker prune'.",
        transcript,
    )


# --------------------------------------------------------------------------- #
# HTTP layer
# --------------------------------------------------------------------------- #
_CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".map": "application/json",
    ".wasm": "application/wasm",
}


def _content_type(name: str) -> str:
    return _CONTENT_TYPES.get(Path(name).suffix.lower(), "application/octet-stream")


def web_root() -> Path:
    """Serve the built React app (``dashboard_app/dist``) when present, else the
    legacy single-file HUD (``dashboard_web``). Lets ``jarvis dashboard`` pick up
    the SOTA holographic build the moment it has been compiled."""
    dist = APP_DIR / "dist"
    return dist if (dist / "index.html").is_file() else WEB_DIR


def _resolve_static(path: str) -> Path | None:
    """Map a URL path to a real file under the web root, blocking traversal.
    Supports nested asset paths (e.g. ``/assets/index-abc.js``)."""
    root = web_root().resolve()
    rel = path.lstrip("/") or "index.html"
    try:
        target = (root / rel).resolve()
    except (OSError, ValueError):
        return None
    if root != target and root not in target.parents:
        return None  # path traversal attempt
    return target if target.is_file() else None


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

    def _serve_file(self, file: Path) -> None:
        try:
            data = file.read_bytes()
        except OSError:
            self._send_json(404, {"error": "not found"})
            return
        self._send(200, data, _content_type(file.name))

    def do_GET(self) -> None:  # noqa: N802 (stdlib naming)
        path = self.path.split("?", 1)[0]
        if path == "/api/stats":
            self._send_json(200, collect_stats())
            return
        target = _resolve_static(path)
        if target is not None:
            self._serve_file(target)
            return
        # SPA fallback: unknown non-API, non-asset path -> index.html
        if not path.startswith("/api/") and "." not in path.rsplit("/", 1)[-1]:
            index = web_root() / "index.html"
            if index.is_file():
                self._serve_file(index)
                return
        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path not in ("/api/command", "/api/voice"):
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

        if path == "/api/voice":
            text = payload.get("text")
            if not isinstance(text, str):
                self._send_json(400, {"error": "voice request needs a string 'text'"})
                return
            result = interpret_command(text)
        else:
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


def find_packaged_app() -> str | None:
    """Locate a packaged ``.app``'s executable, if one has been built/installed.

    electron-builder writes the notarized bundle to ``dist/mac*/<name>.app``;
    a user may also have copied it into ``/Applications``. Returns the inner
    Mach-O executable so it can be spawned directly with the loopback URL in its
    environment (``open`` can't forward env vars). ``None`` if no build exists.
    """
    app = f"{APP_PRODUCT_NAME}.app"
    # vite owns dist/, so electron-builder emits the bundle to dist-app/mac*
    roots = (
        list((APP_DIR / "dist-app").glob("mac*"))
        + list((APP_DIR / "dist").glob("mac*"))
        + list(_INSTALLED_APP_ROOTS)
    )
    for root in roots:
        exe = root / app / "Contents" / "MacOS" / APP_PRODUCT_NAME
        if exe.exists():
            return str(exe)
    return None


def launch_app(
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_PORT,
    *,
    electron: str | None = None,
    spawn=subprocess.Popen,
):
    """Spawn the HUD window pointed at the loopback backend.

    Prefers the packaged (notarized) ``.app`` when it has been built or
    installed; otherwise runs the shell directory under a dev Electron. The
    window discovers the backend through ``JARVIS_DASHBOARD_URL`` so no browser
    is ever opened. Raises ``RuntimeError`` if neither is available.
    """
    env = dict(os.environ, JARVIS_DASHBOARD_URL=f"http://{host}:{port}")

    if electron is None:
        packaged = find_packaged_app()
        if packaged:
            return spawn([packaged], env=env)

    electron = electron or find_electron()
    if not electron:
        raise RuntimeError(
            "Electron not found. Install the app shell with "
            "`cd lib/dashboard_app && npm install`, or run `jarvis dashboard --browser`."
        )
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
