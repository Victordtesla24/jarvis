"""Idle-aware autonomous self-healing for JARVIS.

JARVIS's proactive layer. The scheduled ``tidy``/``deep_clean`` jobs react on a
fixed timer; autopilot takes *initiative*: it hunts the heavy, regenerable
space-eaters a developer machine accumulates — ``node_modules``, build output,
framework/tool caches — and reclaims them WITHOUT asking.

Two safety rails make "fix it, no permission required" sane rather than
reckless:

* **IDLE TIME = SLEEP.** Reclamation only fires while the machine is idle (high
  CPU idle %). When the user is actively working, autopilot detects but defers,
  so a `rm -rf node_modules` never competes with a running build.
* **Dormancy gate.** Only directories untouched for ``min_age_days`` are marked
  reclaimable. An active project's ``node_modules`` is left alone; a project you
  haven't opened in weeks gets cleaned. Everything reclaimed regenerates from
  source (``npm install``, a rebuild, a cache refill).

This module is deliberately pure and I/O-light: detection (:func:`find_bloat`)
and the decision core (:func:`plan_reclamation`) have no side effects, so the
scheduler can orchestrate and audit them and tests can pin the behaviour
without deleting anything real.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path

from lib.cleanup import get_directory_size, should_skip

# A machine is "idle" once CPU idle % reaches this floor. Tuned high so
# reclamation never steals cycles from an active build or compile.
IDLE_CPU_THRESHOLD = 80.0

# Directory names that are large, regenerable, and safe to remove: package
# installs, build output, and framework/tool caches. Each rebuilds from source
# on demand, so deleting a dormant one costs only a reinstall/rebuild later.
BLOAT_DIR_NAMES = frozenset({
    "node_modules",
    ".next",
    ".nuxt",
    ".turbo",
    ".parcel-cache",
    ".gradle",
    "dist",
    "build",
    "target",
})


@dataclass
class BloatTarget:
    """A regenerable directory found during a bloat scan."""
    path: str
    size_bytes: int
    age_days: float
    reclaimable: bool


@dataclass
class ReclamationPlan:
    """The decision of what to reclaim now, and the reasoning for the audit log."""
    should_run: bool
    reason: str
    targets: list[BloatTarget]

    @property
    def total_bytes(self) -> int:
        return sum(t.size_bytes for t in self.targets)


def is_idle(cpu_idle_pct: float, threshold: float = IDLE_CPU_THRESHOLD) -> bool:
    """True when the machine is idle enough for disruptive maintenance.

    Idle is defined by CPU idle percentage at or above ``threshold`` — the
    "IDLE TIME = SLEEP" rule that keeps reclamation off the user's back while
    they work.
    """
    return cpu_idle_pct >= threshold


def find_bloat(
    base_path: str,
    min_age_days: float = 7,
    max_depth: int = 8,
) -> list[BloatTarget]:
    """Scan ``base_path`` for regenerable bloat directories.

    Returns one :class:`BloatTarget` per matched directory, tagged
    ``reclaimable`` when it has been dormant for at least ``min_age_days``
    (judged by the directory's own mtime — cheap and accurate for installs and
    build outputs). Protected paths (see :func:`lib.cleanup.should_skip`),
    symlinks, ``.git`` metadata, and anything past ``max_depth`` are skipped,
    and a matched directory is never descended into so nested copies aren't
    double-counted.
    """
    base = Path(base_path).expanduser().resolve()
    base_depth = len(base.parts)
    now = time.time()
    targets: list[BloatTarget] = []

    for dirpath, dirnames, _filenames in os.walk(base):
        depth = len(Path(dirpath).parts) - base_depth
        if depth >= max_depth:
            dirnames.clear()
            continue

        for name in [d for d in dirnames if d in BLOAT_DIR_NAMES]:
            full = os.path.join(dirpath, name)
            if os.path.islink(full):
                continue
            try:
                age_days = (now - os.path.getmtime(full)) / 86400.0
            except OSError:
                continue
            size = get_directory_size(full)
            targets.append(BloatTarget(
                path=full,
                size_bytes=size,
                age_days=age_days,
                reclaimable=age_days >= min_age_days,
            ))

        # Prune so the walk skips matched bloat dirs (already accounted for),
        # protected paths, and VCS metadata.
        dirnames[:] = [
            d for d in dirnames
            if d not in BLOAT_DIR_NAMES
            and d != ".git"
            and not should_skip(os.path.join(dirpath, d))
        ]

    return targets


def plan_reclamation(
    cpu_idle_pct: float,
    bloat_targets: list[BloatTarget],
    *,
    idle_threshold: float = IDLE_CPU_THRESHOLD,
    max_targets: int = 50,
) -> ReclamationPlan:
    """Decide whether and what to reclaim — pure, no side effects.

    Reclaims nothing unless there are dormant (reclaimable) targets AND the
    machine is idle. When it does act, it picks the largest offenders first,
    capped at ``max_targets`` per run to keep any single sweep bounded.
    """
    reclaimable = [t for t in bloat_targets if t.reclaimable]

    if not reclaimable:
        return ReclamationPlan(
            should_run=False,
            reason="No dormant bloat found — nothing to reclaim",
            targets=[],
        )

    if not is_idle(cpu_idle_pct, idle_threshold):
        return ReclamationPlan(
            should_run=False,
            reason=(
                f"Deferred: system busy (CPU idle {cpu_idle_pct:.0f}% "
                f"< {idle_threshold:.0f}%) — IDLE TIME=SLEEP"
            ),
            targets=[],
        )

    selected = sorted(reclaimable, key=lambda t: t.size_bytes, reverse=True)[:max_targets]
    return ReclamationPlan(
        should_run=True,
        reason=f"Idle — reclaiming {len(selected)} dormant bloat dir(s)",
        targets=selected,
    )
