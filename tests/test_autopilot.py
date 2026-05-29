"""Tests for JARVIS autopilot — idle-aware autonomous self-healing.

Autopilot is JARVIS's proactive layer: it detects space-eating but
regenerable directories (node_modules, build, dist, caches) and reclaims
them WITHOUT asking — but only while the machine is idle ("IDLE TIME=SLEEP").
These tests pin down the pure detection/planning logic plus the scheduler
job's wiring. Nothing here touches the real filesystem or deletes real data.
"""
import os
import sys
import time
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))


class TestIsIdle:
    """is_idle gates disruptive work on CPU idle %, embodying IDLE TIME=SLEEP."""

    def test_high_idle_is_idle(self):
        from lib.autopilot import is_idle, IDLE_CPU_THRESHOLD
        assert is_idle(95.0) is True
        assert is_idle(IDLE_CPU_THRESHOLD) is True  # at threshold counts as idle

    def test_busy_is_not_idle(self):
        from lib.autopilot import is_idle
        assert is_idle(40.0) is False

    def test_just_below_threshold_is_busy(self):
        from lib.autopilot import is_idle, IDLE_CPU_THRESHOLD
        assert is_idle(IDLE_CPU_THRESHOLD - 0.1) is False

    def test_custom_threshold(self):
        from lib.autopilot import is_idle
        assert is_idle(60.0, threshold=50.0) is True
        assert is_idle(40.0, threshold=50.0) is False


class TestFindBloat:
    """find_bloat locates regenerable bloat dirs and ages them for safety."""

    def _make_project(self, root: Path, name: str, *, files: int = 3) -> Path:
        proj = root / name
        proj.mkdir(parents=True, exist_ok=True)
        nm = proj / "node_modules" / "pkg"
        nm.mkdir(parents=True, exist_ok=True)
        for i in range(files):
            (nm / f"f{i}.bin").write_bytes(b"x" * 1024)
        return proj / "node_modules"

    def test_finds_node_modules_with_size(self, tmp_path):
        from lib.autopilot import find_bloat
        self._make_project(tmp_path, "app")

        targets = find_bloat(str(tmp_path), min_age_days=0)

        node_mods = [t for t in targets if t.path.endswith("node_modules")]
        assert len(node_mods) == 1
        assert node_mods[0].size_bytes >= 3 * 1024

    def test_age_gate_marks_fresh_dirs_not_reclaimable(self, tmp_path):
        from lib.autopilot import find_bloat
        nm = self._make_project(tmp_path, "fresh")
        # Just-created dir: age ~0 days, so with a 7-day floor it's protected.
        targets = find_bloat(str(tmp_path), min_age_days=7)
        match = next(t for t in targets if t.path == str(nm))
        assert match.reclaimable is False

    def test_age_gate_marks_dormant_dirs_reclaimable(self, tmp_path):
        from lib.autopilot import find_bloat
        nm = self._make_project(tmp_path, "dormant")
        old = time.time() - 30 * 86400  # 30 days ago
        os.utime(nm, (old, old))

        targets = find_bloat(str(tmp_path), min_age_days=7)
        match = next(t for t in targets if t.path == str(nm))
        assert match.reclaimable is True
        assert match.age_days >= 7

    def test_does_not_descend_into_matched_bloat_dir(self, tmp_path):
        """A node_modules nested inside another must not be double-counted."""
        from lib.autopilot import find_bloat
        outer = tmp_path / "app" / "node_modules"
        nested = outer / "sub" / "node_modules"
        nested.mkdir(parents=True)
        (nested / "f.bin").write_bytes(b"x" * 10)

        targets = find_bloat(str(tmp_path), min_age_days=0)
        node_mods = [t for t in targets if t.path.endswith("node_modules")]
        assert len(node_mods) == 1
        assert node_mods[0].path == str(outer)

    def test_skips_protected_paths(self, tmp_path):
        from lib.autopilot import find_bloat
        # A node_modules buried under a protected dir name must be ignored.
        protected = tmp_path / ".ssh" / "node_modules"
        protected.mkdir(parents=True)
        (protected / "f.bin").write_bytes(b"x" * 10)

        targets = find_bloat(str(tmp_path), min_age_days=0)
        assert all(".ssh" not in t.path for t in targets)

    def test_skips_symlinked_bloat(self, tmp_path):
        from lib.autopilot import find_bloat
        real = tmp_path / "real_modules"
        real.mkdir()
        (real / "f.bin").write_bytes(b"x" * 10)
        link_parent = tmp_path / "proj"
        link_parent.mkdir()
        try:
            os.symlink(real, link_parent / "node_modules")
        except (OSError, NotImplementedError):
            return  # platform without symlink support
        targets = find_bloat(str(tmp_path), min_age_days=0)
        assert all(not t.path.endswith("proj/node_modules") for t in targets)

    def test_respects_max_depth(self, tmp_path):
        from lib.autopilot import find_bloat
        deep = tmp_path / "a" / "b" / "c" / "node_modules"
        deep.mkdir(parents=True)
        (deep / "f.bin").write_bytes(b"x" * 10)

        # node_modules sits at depth 4; a max_depth of 2 must not reach it.
        targets = find_bloat(str(tmp_path), min_age_days=0, max_depth=2)
        assert targets == []


class TestPlanReclamation:
    """plan_reclamation is the pure decision core: what to reclaim and why."""

    def _target(self, path="/p/node_modules", size=1000, reclaimable=True):
        from lib.autopilot import BloatTarget
        return BloatTarget(path=path, size_bytes=size, age_days=30, reclaimable=reclaimable)

    def test_no_reclaimable_targets_means_no_run(self):
        from lib.autopilot import plan_reclamation
        plan = plan_reclamation(95.0, [self._target(reclaimable=False)])
        assert plan.should_run is False
        assert plan.targets == []
        assert "nothing to reclaim" in plan.reason.lower()

    def test_busy_system_defers(self):
        from lib.autopilot import plan_reclamation
        plan = plan_reclamation(10.0, [self._target()], idle_threshold=80.0)
        assert plan.should_run is False
        assert plan.targets == []
        assert "defer" in plan.reason.lower()

    def test_idle_with_targets_runs(self):
        from lib.autopilot import plan_reclamation
        plan = plan_reclamation(95.0, [self._target()], idle_threshold=80.0)
        assert plan.should_run is True
        assert len(plan.targets) == 1
        assert plan.total_bytes == 1000

    def test_selects_largest_targets_first_and_caps(self):
        from lib.autopilot import plan_reclamation
        targets = [
            self._target(path=f"/p{i}/node_modules", size=i * 100)
            for i in range(1, 6)
        ]
        plan = plan_reclamation(95.0, targets, idle_threshold=80.0, max_targets=2)
        assert len(plan.targets) == 2
        # Largest (500, 400) chosen, in descending order.
        assert [t.size_bytes for t in plan.targets] == [500, 400]

    def test_ignores_non_reclaimable_when_selecting(self):
        from lib.autopilot import plan_reclamation
        targets = [
            self._target(path="/keep/node_modules", size=9999, reclaimable=False),
            self._target(path="/go/node_modules", size=10, reclaimable=True),
        ]
        plan = plan_reclamation(95.0, targets, idle_threshold=80.0)
        assert [t.path for t in plan.targets] == ["/go/node_modules"]


class TestAutopilotJob:
    """The scheduler job wires detection → planning → reclamation + audit."""

    def _info(self, cpu_idle):
        info = MagicMock()
        info.cpu_idle_pct = cpu_idle
        return info

    def test_idle_reclaims_and_logs(self, monkeypatch):
        from lib import scheduler
        from lib.autopilot import BloatTarget
        from lib.cleanup import CleanupResult

        target = BloatTarget("/p/node_modules", 2048, 30, True)

        monkeypatch.setattr(scheduler, "get_system_info", lambda: self._info(95.0))
        monkeypatch.setattr(scheduler, "find_bloat", lambda *a, **k: [target])
        monkeypatch.setattr(
            scheduler, "execute_cleanup",
            lambda plan, dry_run: [CleanupResult(path="/p/node_modules", size_bytes=2048, success=True)],
        )
        logged = {}
        monkeypatch.setattr(
            scheduler, "log_action",
            lambda **kw: logged.update(kw),
        )
        monkeypatch.setattr(scheduler, "get_notifier", lambda: MagicMock())

        # Force a real reclaim (dry_run off) by stubbing config safety.
        cfg = MagicMock()
        cfg.safety = {"dry_run": False, "idle_cpu_threshold": 80.0}
        monkeypatch.setattr(scheduler, "get_config_safe", lambda: cfg)

        scheduler.autopilot_job()

        assert logged["action_type"] == "autopilot"
        assert logged["outcome"] == "success"
        assert logged["bytes_freed"] == 2048

    def test_busy_defers_without_cleanup(self, monkeypatch):
        from lib import scheduler
        from lib.autopilot import BloatTarget

        target = BloatTarget("/p/node_modules", 2048, 30, True)

        monkeypatch.setattr(scheduler, "get_system_info", lambda: self._info(5.0))
        monkeypatch.setattr(scheduler, "find_bloat", lambda *a, **k: [target])

        called = {"cleanup": False}

        def _no_cleanup(*a, **k):
            called["cleanup"] = True
            return []

        monkeypatch.setattr(scheduler, "execute_cleanup", _no_cleanup)
        logged = {}
        monkeypatch.setattr(scheduler, "log_action", lambda **kw: logged.update(kw))

        cfg = MagicMock()
        cfg.safety = {"dry_run": False, "idle_cpu_threshold": 80.0}
        monkeypatch.setattr(scheduler, "get_config_safe", lambda: cfg)

        scheduler.autopilot_job()

        assert called["cleanup"] is False, "must not reclaim while system is busy"
        assert logged["outcome"] == "deferred"
        assert logged["action_type"] == "autopilot"

    def test_dry_run_does_not_claim_real_freed_bytes(self, monkeypatch):
        from lib import scheduler
        from lib.autopilot import BloatTarget
        from lib.cleanup import CleanupResult

        target = BloatTarget("/p/node_modules", 4096, 30, True)
        monkeypatch.setattr(scheduler, "get_system_info", lambda: self._info(95.0))
        monkeypatch.setattr(scheduler, "find_bloat", lambda *a, **k: [target])
        captured = {}

        def _exec(plan, dry_run):
            captured["dry_run"] = dry_run
            return [CleanupResult(path="/p/node_modules", size_bytes=4096, success=True)]

        monkeypatch.setattr(scheduler, "execute_cleanup", _exec)
        logged = {}
        monkeypatch.setattr(scheduler, "log_action", lambda **kw: logged.update(kw))
        monkeypatch.setattr(scheduler, "get_notifier", lambda: MagicMock())

        cfg = MagicMock()
        cfg.safety = {"dry_run": True, "idle_cpu_threshold": 80.0}
        monkeypatch.setattr(scheduler, "get_config_safe", lambda: cfg)

        scheduler.autopilot_job()

        assert captured["dry_run"] is True
        assert logged["outcome"] == "dry_run"


class TestSchedulerRegistration:
    """setup_scheduler must register the autopilot job."""

    def test_autopilot_job_registered(self):
        from lib.scheduler import setup_scheduler

        # setup_scheduler builds but does not start the scheduler, so no
        # background threads are created and no shutdown is required.
        scheduler = setup_scheduler()
        assert scheduler.get_job("autopilot") is not None
