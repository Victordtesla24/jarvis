"""scripts/promo-video/lib/shot_list_loader.py
Shared JSON loader for the JARVIS promo video pipeline. Every phase script
imports this to avoid drifting schemas. Stdlib-only (no pyyaml dependency).
"""
from __future__ import annotations
import json
import os
from pathlib import Path
from typing import Any

REPO_ROOT = Path(os.environ.get(
    "REPO_ROOT", "/Users/vic/claude/General-Work/jarvis/jarvis-build"
))
SHOT_LIST_PATH = REPO_ROOT / "scripts" / "promo-video" / "shot_list.json"


class ShotListError(Exception):
    pass


_cache: dict[str, Any] | None = None


def load() -> dict[str, Any]:
    global _cache
    if _cache is not None:
        return _cache
    if not SHOT_LIST_PATH.exists():
        raise ShotListError(f"shot_list.json not found at {SHOT_LIST_PATH}")
    with open(SHOT_LIST_PATH) as f:
        data = json.load(f)
    total = sum(s["duration"] for s in data["scenes"])
    if abs(total - data["meta"]["duration_seconds"]) > 0.01:
        raise ShotListError(
            f"scene duration sum {total}s != meta.duration_seconds "
            f"{data['meta']['duration_seconds']}s"
        )
    _cache = data
    return data


def scenes_by_act(act: int) -> list[dict[str, Any]]:
    return [s for s in load()["scenes"] if s["act"] == act]


def scenes_by_capture_hint(hint: str) -> list[dict[str, Any]]:
    return [s for s in load()["scenes"] if s.get("capture_hint") == hint]


def vo_line(vo_ref: str) -> dict[str, Any]:
    lines = load()["vo_lines"]
    if vo_ref not in lines:
        raise ShotListError(f"unknown vo_ref: {vo_ref}")
    return lines[vo_ref]


def meta() -> dict[str, Any]:
    return load()["meta"]
