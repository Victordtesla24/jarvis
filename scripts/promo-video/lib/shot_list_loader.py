"""scripts/promo-video/lib/shot_list_loader.py

Shared JSON loader for the JARVIS promo video pipeline. Every phase script
imports this to avoid drifting schemas. Stdlib-only (no pyyaml dependency).

R-33 adds TypedDict schema + schema validation at load().
R-60 documents that the returned dict is shared-mutable — copy before mutating.
"""
from __future__ import annotations

import copy
import json
import os
from pathlib import Path
from typing import Any, TypedDict

REPO_ROOT = Path(os.environ.get("REPO_ROOT") or Path(__file__).resolve().parents[3])
SHOT_LIST_PATH = REPO_ROOT / "scripts" / "promo-video" / "shot_list.json"


class ShotListError(Exception):
    """Raised when shot_list.json fails schema validation."""


class SceneEntry(TypedDict, total=False):
    id: str
    act: int
    start: float
    duration: float
    source: str  # "live" | "ai" | "title_card"
    ai_prompt: str
    capture_hint: str | None
    vo_ref: str | None
    transition_in: str
    title_text: str


class VoLine(TypedDict, total=False):
    text: str
    place_at: float
    target_duration: float
    act: int


_SCENE_REQUIRED: tuple[str, ...] = (
    "id", "act", "start", "duration", "source",
)
_VO_REQUIRED: tuple[str, ...] = ("text", "place_at")

# Module-private cache — exposed read-only via load(). Mutating the returned
# dict is documented to be unsafe (R-60); callers that need to mutate must
# first deepcopy.
_cache: dict[str, Any] | None = None


def _validate(data: dict[str, Any]) -> None:
    meta = data.get("meta")
    if not isinstance(meta, dict):
        raise ShotListError("meta section missing or not a dict")
    if "duration_seconds" not in meta:
        raise ShotListError("meta missing required field: duration_seconds")

    scenes = data.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        raise ShotListError("scenes must be a non-empty list")
    for i, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            raise ShotListError(f"scene {i} is not a dict")
        for key in _SCENE_REQUIRED:
            if key not in scene:
                raise ShotListError(
                    f"scene {i} ({scene.get('id', '<no id>')}) missing "
                    f"required field: {key}"
                )

    vo_lines = data.get("vo_lines")
    if not isinstance(vo_lines, dict):
        raise ShotListError("vo_lines must be a dict")
    for vref, line in vo_lines.items():
        if not isinstance(line, dict):
            raise ShotListError(f"vo_line {vref!r} is not a dict")
        for key in _VO_REQUIRED:
            if key not in line:
                raise ShotListError(
                    f"vo_line {vref!r} missing required field: {key}"
                )

    total = sum(float(s["duration"]) for s in scenes)
    if abs(total - float(meta["duration_seconds"])) > 0.01:
        raise ShotListError(
            f"scene duration sum {total}s != meta.duration_seconds "
            f"{meta['duration_seconds']}s"
        )


def load() -> dict[str, Any]:
    """Load shot_list.json once per process. Returns a **shared** dict.

    Callers must not mutate the returned structure — mutations would poison
    the cache for every subsequent caller in the same process. If you need
    to edit, `copy.deepcopy(shot_list_loader.load())` first.
    """
    global _cache
    if _cache is not None:
        return _cache
    if not SHOT_LIST_PATH.exists():
        raise ShotListError(f"shot_list.json not found at {SHOT_LIST_PATH}")
    try:
        with open(SHOT_LIST_PATH) as f:
            data = json.load(f)
    except json.JSONDecodeError as exc:
        raise ShotListError(f"shot_list.json malformed: {exc}") from exc
    _validate(data)
    _cache = data
    return data


def load_copy() -> dict[str, Any]:
    """Return a deep-copied shot list that the caller can mutate freely."""
    return copy.deepcopy(load())


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
