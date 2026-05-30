"""Configuration loader with environment variable substitution."""
from __future__ import annotations
import os
import re
import logging
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

ENV_PATH = Path.home() / ".jarvis" / ".env"


def _looks_like_placeholder(value: str | None) -> bool:
    """True for unresolved ``${VAR}`` style placeholders."""
    return bool(value) and value.startswith("${") and value.endswith("}")


def load_dotenv(path: Path = ENV_PATH) -> int:
    """Load ``KEY=value`` pairs from ~/.jarvis/.env into os.environ.

    Nothing else in the app loads credentials, so this must run before any
    config substitution. It *overrides* an existing environment value when
    that value is missing, empty, or an unresolved ``${VAR}`` placeholder —
    this defeats broken shell exports such as
    ``MINIMAX_API_KEY=${MINIMAX_API_KEY}`` that would otherwise shadow the
    real key. Real pre-existing values are left untouched.

    Returns the number of variables loaded. Never raises.
    """
    if not path.exists():
        return 0

    loaded = 0
    try:
        for raw_line in path.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if not key:
                continue
            existing = os.environ.get(key)
            if existing is None or existing == "" or _looks_like_placeholder(existing):
                os.environ[key] = value
                loaded += 1
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Failed to load %s: %s", path, exc)
    return loaded


# Load .env as early as possible so os.environ is populated before any
# ${VAR} substitution happens during config load.
load_dotenv()


def _substitute_env(value: str) -> str:
    """Replace ${VAR} patterns with environment variable values."""
    if not isinstance(value, str):
        return value

    pattern = re.compile(r'\$\{([^}]+)\}')

    def replacer(match):
        var_name = match.group(1)
        return os.environ.get(var_name, match.group(0))

    return pattern.sub(replacer, value)


def _process_value(value: Any) -> Any:
    """Recursively process a config value for env substitution."""
    if isinstance(value, dict):
        return {k: _process_value(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [_process_value(v) for v in value]
    elif isinstance(value, str):
        return _substitute_env(value)
    else:
        return value


class Config:
    """JARVIS configuration manager.

    Loads from ~/.jarvis/config.yaml with ${ENV_VAR} substitution.
    Singleton pattern for module-wide access.
    """

    CONFIG_PATH = Path.home() / ".jarvis" / "config.yaml"

    _instance: 'Config | None' = None
    _data: dict | None = None

    def __new__(cls):
        if cls._instance is None:
            instance = super().__new__(cls)
            try:
                instance._load()
            except Exception:
                # If load fails, create a default empty config
                # so the agent can still start and report the error
                instance._data = {
                    "minimax_api_key": "",
                    "machines": {},
                    "schedule": {"tidy_every": 15, "health_check": 60, "deep_clean": "00:00"},
                    "safety": {"dry_run": False, "confirm_threshold_mb": 1024, "skip_paths": []},
                    "notifications": {"enabled": True, "on_completion": False, "min_significance_mb": 100},
                }
            cls._instance = instance
        return cls._instance

    def _load(self):
        """Load configuration from YAML file."""
        # Refresh credentials from .env on every (re)load.
        load_dotenv()

        if not self.CONFIG_PATH.exists():
            raise FileNotFoundError(f"Config not found: {self.CONFIG_PATH}")

        with open(self.CONFIG_PATH) as f:
            raw = yaml.safe_load(f)

        if raw is None:
            raw = {}

        self._data = _process_value(raw)

    def reload(self):
        """Reload configuration from disk."""
        self._load()

    @property
    def minimax_api_key(self) -> str:
        raw = self._data.get("minimax_api_key", "") or ""
        if _looks_like_placeholder(raw):
            logger.warning(
                "MiniMax API key not resolved — set MINIMAX_API_KEY in ~/.jarvis/.env"
            )
            return ""
        return raw

    @property
    def minimax_base_url(self) -> str:
        """MiniMax API base URL. The international endpoint is the default;
        the legacy ``api.minimax.chat`` host rejects ``sk-`` keys."""
        return self._data.get("minimax_base_url") or "https://api.minimaxi.chat/v1"

    @property
    def minimax_model(self) -> str:
        return self._data.get("minimax_model") or "MiniMax-Text-01"

    @property
    def machines(self) -> dict:
        return self._data.get("machines", {})

    @property
    def schedule(self) -> dict:
        defaults = {
            "tidy_every": 15,
            "health_check": 60,
            "deep_clean": "00:00",
            "update_check": "weekly",
        }
        result = dict(defaults)
        result.update(self._data.get("schedule", {}))
        return result

    @property
    def safety(self) -> dict:
        defaults = {
            "dry_run": False,
            "confirm_threshold_mb": 1024,
            "skip_paths": [],
            "auto_exclude_patterns": [],
        }
        result = dict(defaults)
        result.update(self._data.get("safety", {}))
        return result

    @property
    def notifications(self) -> dict:
        defaults = {
            "enabled": True,
            "on_completion": False,
            "min_significance_mb": 100,
        }
        result = dict(defaults)
        result.update(self._data.get("notifications", {}))
        return result


def get_config() -> Config:
    """Get singleton config instance."""
    return Config()


# Runtime-tunable settings the cockpit control panel may persist. Keys are
# ``section.leaf`` paths; values are restricted to these types. Anything not
# listed here is off-limits — the writer can never reach credentials or the
# machine/SSH blocks.
RUNTIME_SETTABLE: dict[str, type] = {
    "safety.dry_run": bool,
    "safety.autopilot_armed": bool,
    "safety.bloat_min_age_days": (int, float),  # type: ignore[dict-item]
    "safety.idle_cpu_threshold": (int, float),  # type: ignore[dict-item]
    "notifications.enabled": bool,
}


def _format_scalar(value: Any) -> str:
    """Render a Python scalar as the YAML token to write back."""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _set_yaml_scalar(text: str, section: str, leaf: str, value: Any) -> str:
    """Surgically set ``section.leaf`` in a YAML document, preserving every
    other line — comments, blank lines, ordering, and any inline comment on the
    edited line. Credentials (other lines) are never touched (R16)."""
    lines = text.splitlines()
    token = _format_scalar(value)
    sec_re = re.compile(rf"^{re.escape(section)}:\s*(#.*)?$")
    leaf_re = re.compile(rf"^(\s+)({re.escape(leaf)}:\s*)([^#\n]*?)(\s*(?:#.*)?)$")

    in_section = False
    indent = "  "
    for i, line in enumerate(lines):
        if sec_re.match(line):
            in_section = True
            continue
        if in_section:
            if line and not line[0].isspace() and not line.lstrip().startswith("#"):
                break  # next top-level block — leaf wasn't present
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                indent = line[: len(line) - len(line.lstrip())]
            m = leaf_re.match(line)
            if m:
                lines[i] = f"{m.group(1)}{m.group(2)}{token}{m.group(4)}"
                return "\n".join(lines) + "\n"

    # Leaf absent: add it (creating the section if needed).
    if in_section:
        for i, line in enumerate(lines):
            if sec_re.match(line):
                lines.insert(i + 1, f"{indent}{leaf}: {token}")
                break
    else:
        lines.append(f"{section}:")
        lines.append(f"  {leaf}: {token}")
    return "\n".join(lines) + "\n"


def update_config(updates: dict[str, Any], path: Path | None = None) -> dict[str, Any]:
    """Persist an allow-listed set of runtime settings to ``config.yaml``.

    Only keys in :data:`RUNTIME_SETTABLE` may be written, and only their own
    lines are edited — every comment, blank line, and ``${VAR}`` credential
    placeholder is left untouched, so a secret is never resolved onto disk
    (R16). The singleton is reloaded so the change takes effect with no daemon
    restart. Returns the applied ``{key: value}`` map.
    """
    if not updates:
        return {}

    for key, value in updates.items():
        expected = RUNTIME_SETTABLE.get(key)
        if expected is None:
            raise KeyError(f"not a runtime-settable key: {key!r}")
        if expected is bool:
            if not isinstance(value, bool):
                raise TypeError(f"{key} expects a boolean, got {type(value).__name__}")
        elif isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TypeError(f"{key} expects a number, got {type(value).__name__}")

    target = path or Config.CONFIG_PATH
    text = target.read_text() if target.exists() else ""
    for key, value in updates.items():
        section, _, leaf = key.partition(".")
        text = _set_yaml_scalar(text, section, leaf, value)

    target.write_text(text)
    get_config().reload()
    return dict(updates)
