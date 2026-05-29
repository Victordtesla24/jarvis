"""Regression tests for logic bugs fixed in the JARVIS codebase.

Each test pins behavior that was previously incorrect:
- CPU-idle iostat fallback read the wrong column (a load average).
- Cleanup target scanning double-counted files nested inside a yielded dir.
- Scheduled tidy reported phantom "freed" bytes during a dry run.
- Docker prune reported a hardcoded count instead of the real number removed.
- `update_pip` claimed it updated packages it never touched.
- The heuristic "monitor" branch crashed on a non-numeric free_gb.
"""
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))


class TestCpuIdleFallback:
    """get_cpu_idle's iostat fallback must read the idle column, not load avg."""

    IOSTAT = "   18.80  399  7.32   5  8 88  5.31 5.77 5.17"

    def test_iostat_fallback_returns_idle_not_load_average(self, monkeypatch):
        from lib import machine

        def fake_run(cmd, timeout=60):
            if "top" in cmd:
                return ("", "", 0)  # top produced no 'CPU usage' line
            if "iostat" in cmd:
                return (self.IOSTAT, "", 0)
            return ("", "", 0)

        monkeypatch.setattr(machine, "run_command", fake_run)
        # Columns: KB/t tps MB/s us sy id 1m 5m 15m -> idle 'id' is 88, not 5.17.
        assert machine.get_cpu_idle() == 88.0


class TestCleanupNoDoubleCount:
    """Files nested under an already-yielded directory must not be re-yielded."""

    def test_pyc_inside_pycache_not_counted_twice(self, tmp_path):
        from lib.cleanup import find_cleanup_targets

        pyc_dir = tmp_path / "proj" / "__pycache__"
        pyc_dir.mkdir(parents=True)
        (pyc_dir / "mod.pyc").write_bytes(b"xxxxx")  # 5 bytes
        (pyc_dir / "other.pyc").write_bytes(b"yy")  # 2 bytes

        results = list(find_cleanup_targets(str(tmp_path)))
        paths = [p for p, _ in results]

        assert any(p.endswith("__pycache__") for p in paths)
        # The .pyc files live inside the yielded dir; they must not appear again.
        assert not any(p.endswith(".pyc") for p in paths)
        # Total size counts the directory once (7 bytes), not 7 + 5 + 2.
        assert sum(s for _, s in results) == 7


def _high_disk_info():
    from lib.machine import DiskInfo, SystemInfo

    return SystemInfo(
        disk=DiskInfo(total_gb=100, used_gb=90, free_gb=5, used_pct=90),
        ram_total_gb=16,
        ram_used_gb=8,
        ram_used_pct=50,
        cpu_idle_pct=50,
    )


class TestTidyJobDryRunReporting:
    """A dry run must not record/notify bytes as actually freed."""

    def test_dry_run_marks_outcome_and_skips_notification(self, monkeypatch):
        from lib import scheduler
        from lib.cleanup import CleanupResult

        fake_cfg = types.SimpleNamespace(safety={"dry_run": True}, schedule={})
        monkeypatch.setattr(scheduler, "get_config_safe", lambda: fake_cfg)
        monkeypatch.setattr(scheduler, "get_system_info", _high_disk_info)
        monkeypatch.setattr(scheduler, "update_machine_state", lambda **kw: None)
        monkeypatch.setattr(
            scheduler, "find_cleanup_targets", lambda home: [("/tmp/fake", 1000)]
        )
        monkeypatch.setattr(
            scheduler,
            "create_cleanup_plan",
            lambda m, p, d: types.SimpleNamespace(files=p, total_size=1000, description=d),
        )
        monkeypatch.setattr(
            scheduler,
            "execute_cleanup",
            lambda plan, dry_run: [
                CleanupResult(path="/tmp/fake", size_bytes=1000, success=True)
            ],
        )
        monkeypatch.setattr(
            scheduler, "get_ssh_manager", lambda: types.SimpleNamespace(connections={})
        )

        captured = []
        monkeypatch.setattr(scheduler, "log_action", lambda **kw: captured.append(kw))
        notifier = MagicMock()
        monkeypatch.setattr(scheduler, "get_notifier", lambda: notifier)

        scheduler.tidy_job()

        tidy_logs = [c for c in captured if c.get("action_type") == "tidy"]
        assert tidy_logs, "expected a tidy audit entry"
        assert tidy_logs[0]["outcome"] == "dry_run"
        # No "cleanup complete" notification should fire for a dry run.
        notifier.notify_significant.assert_not_called()


class TestDockerPruneCount:
    """Prune results must report the real number of removed entries."""

    def test_prune_containers_counts_listed_entries(self, monkeypatch):
        from lib import docker_ops

        out = "Deleted Containers:\nabc123\ndef456\n\nTotal reclaimed space: 1.5GB\n"
        monkeypatch.setattr(docker_ops, "run_docker", lambda cmd, timeout=120: (out, "", 0))

        res = docker_ops.prune_containers(dry_run=False)
        assert res.removed == 2
        assert res.space_freed == "1.5GB"

    def test_prune_containers_zero_when_nothing_removed(self, monkeypatch):
        from lib import docker_ops

        out = "Total reclaimed space: 0B\n"
        monkeypatch.setattr(docker_ops, "run_docker", lambda cmd, timeout=120: (out, "", 0))

        res = docker_ops.prune_containers(dry_run=False)
        assert res.removed == 0
        assert res.space_freed == "0B"

    def test_prune_images_counts_listed_entries(self, monkeypatch):
        from lib import docker_ops

        out = (
            "Deleted Images:\nuntagged: foo:latest\ndeleted: sha256:abc\n\n"
            "Total reclaimed space: 200MB\n"
        )
        monkeypatch.setattr(docker_ops, "run_docker", lambda cmd, timeout=120: (out, "", 0))

        res = docker_ops.prune_images(dry_run=False)
        assert res.removed == 2
        assert res.space_freed == "200MB"


class TestUpdatePipHonestCount:
    """update_pip must not claim to have updated packages it left untouched."""

    def test_uv_branch_reports_zero_updated(self, monkeypatch):
        from lib import package_managers as pm

        def fake_run(cmd, timeout=300):
            if cmd.startswith("which uv"):
                return ("/usr/bin/uv", "", 0)
            if "pip list --outdated" in cmd:
                return ('[{"name": "a"}, {"name": "b"}]', "", 0)
            if "install --upgrade pip" in cmd:
                return ("", "", 0)
            return ("", "", 0)

        monkeypatch.setattr(pm, "run_command", fake_run)

        res = pm.update_pip()
        # The two outdated packages were never upgraded -> count must be 0.
        assert res.packages_updated == 0
        assert "2" in res.output  # but the outdated count is still surfaced


class TestHeuristicNonNumericFreeGb:
    """_heuristic_decide must not crash when free_gb is non-numeric."""

    def test_monitor_branch_handles_unknown_free_gb(self):
        from lib.llm_brain import LLMBrain

        brain = LLMBrain.__new__(LLMBrain)  # no config/network needed
        result = brain._heuristic_decide(
            "tidy", {"disk_used_pct": 30, "free_gb": "unknown"}
        )
        assert result["action"] == "monitor"
