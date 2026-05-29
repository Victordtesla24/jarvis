"""Audit tests for JARVIS daemon components."""
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


class TestShouldCleanup:
    """Tests for _should_cleanup heuristic."""

    def test_low_disk_usage_no_cleanup(self):
        from lib.scheduler import _should_cleanup
        assert _should_cleanup(disk_pct=30, free_gb=200) is False

    def test_moderate_disk_usage_no_cleanup(self):
        from lib.scheduler import _should_cleanup
        assert _should_cleanup(disk_pct=50, free_gb=100) is False

    def test_at_threshold_no_cleanup(self):
        from lib.scheduler import _should_cleanup
        assert _should_cleanup(disk_pct=70, free_gb=50) is False

    def test_above_disk_threshold_cleanup(self):
        from lib.scheduler import _should_cleanup
        assert _should_cleanup(disk_pct=71, free_gb=100) is True

    def test_high_disk_cleanup(self):
        from lib.scheduler import _should_cleanup
        assert _should_cleanup(disk_pct=90, free_gb=100) is True

    def test_low_free_space_cleanup(self):
        from lib.scheduler import _should_cleanup
        assert _should_cleanup(disk_pct=50, free_gb=49) is True

    def test_zero_free_space_cleanup(self):
        from lib.scheduler import _should_cleanup
        assert _should_cleanup(disk_pct=50, free_gb=0) is True

    def test_ample_free_space_no_cleanup(self):
        from lib.scheduler import _should_cleanup
        assert _should_cleanup(disk_pct=0, free_gb=500) is False


class TestDiskInfo:
    """Tests for disk usage parsing (APFS Capacity-column handling)."""

    APFS_DF = (
        "Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on\n"
        "/dev/disk3s3s1    494G     13G    231G     6%    459k  2.3G    0%   /"
    )

    def test_uses_capacity_column_not_used_over_total(self):
        from lib import machine

        with patch("lib.machine.run_command", return_value=(self.APFS_DF, "", 0)):
            info = machine.get_disk_info()

        # used/total would be ~2.6%; df Capacity says 6%.
        assert info.used_pct == 6.0
        assert info.free_gb == 231.0
        assert info.total_gb == 494.0

    def test_parse_capacity_helper(self):
        from lib.machine import _parse_capacity

        assert _parse_capacity("6%") == 6.0
        assert _parse_capacity("100%") == 100.0
        assert _parse_capacity("-") is None


class TestRamInfo:
    """RAM 'used' = active + wired + compressed; free/inactive are
    reclaimable cache and must NOT count toward usage."""

    VM_STAT = (
        "Mach Virtual Memory Statistics: (page size of 16384 bytes)\n"
        "Pages free:                          100000.\n"
        "Pages active:                        200000.\n"
        "Pages inactive:                      150000.\n"
        "Pages wired down:                     50000.\n"
        "Pages occupied by compressor:         30000.\n"
    )

    def _run(self, total_bytes=16 * 1024 ** 3, vm_stat=None):
        vm_stat = self.VM_STAT if vm_stat is None else vm_stat

        def fake(cmd, timeout=60):
            if "hw.memsize" in cmd:
                return (str(total_bytes), "", 0)
            return (vm_stat, "", 0)

        return fake

    def test_used_counts_active_wired_compressed_only(self):
        from lib import machine

        with patch("lib.machine.run_command", side_effect=self._run()):
            total_gb, used_gb, used_pct = machine.get_ram_info()

        # (200000 + 50000 + 30000) pages * 16384 bytes = 4.27 GiB
        assert total_gb == 16.0
        assert used_gb == 4.3
        assert used_pct == 26.7

    def test_free_and_inactive_pages_do_not_change_usage(self):
        from lib import machine

        inflated = self.VM_STAT.replace("100000.", "9000000.").replace(
            "150000.", "9000000."
        )
        with patch("lib.machine.run_command", side_effect=self._run(vm_stat=inflated)):
            _, used_gb, _ = machine.get_ram_info()

        # Free/inactive ballooned but usage stays pinned to active+wired+compressed.
        assert used_gb == 4.3


class TestDaemonLogging:
    """Tests for RotatingFileHandler configuration."""

    def test_rotating_handler_configured_correctly(self, tmp_path):
        from lib.daemon import setup_daemon_logging

        logger = setup_daemon_logging(tmp_path)

        rotating_handlers = [
            h for h in logger.handlers
            if isinstance(h, RotatingFileHandler)
        ]

        assert len(rotating_handlers) >= 1, "No RotatingFileHandler found"

        handler = rotating_handlers[0]
        assert handler.maxBytes == 5 * 1024 * 1024, "maxBytes should be 5MB"
        assert handler.backupCount == 3, "backupCount should be 3"
        # The handler must honour the requested directory, not the hardcoded
        # production path — otherwise the test suite writes to the real log.
        assert Path(handler.baseFilename) == tmp_path / "jarvis.log"

    def test_setup_does_not_write_to_production_log(self, tmp_path):
        """Regression: configuring daemon logging during tests must not append
        to the real ~/.jarvis/logs/jarvis.log.

        Previously this class called ``setup_daemon_logging()`` with no args,
        attaching a RotatingFileHandler at the production path to the *root*
        logger. That handler survived the whole pytest session, so a later
        test's LLM-fallback warning ("...heuristics: boom") leaked into the
        production log and showed up as a scary recurring WARNING.
        """
        import logging
        from lib.daemon import setup_daemon_logging, LOG_DIR

        prod_log = LOG_DIR / "jarvis.log"
        before = prod_log.read_bytes() if prod_log.exists() else b""

        setup_daemon_logging(tmp_path)
        logging.getLogger("lib.llm_brain").warning(
            "LLM API failed, falling back to heuristics: boom"
        )

        after = prod_log.read_bytes() if prod_log.exists() else b""
        assert after == before, "daemon logging leaked into the production log"

        # The warning must land in the hermetic temp log instead.
        temp_log = tmp_path / "jarvis.log"
        assert temp_log.exists()
        assert "boom" in temp_log.read_text()


class TestConfigReload:
    """Tests for config reload behavior."""

    def test_get_config_returns_fresh_on_each_call(self):
        from lib.scheduler import get_config_safe

        config1 = get_config_safe()
        config2 = get_config_safe()

        assert config1 is config2


class TestSSHRetry:
    """exec_with_retry must be robust to None clients and re-raise cleanly."""

    def _manager(self):
        from lib.ssh_manager import SSHManager, SSHConnection
        mgr = SSHManager.__new__(SSHManager)  # bypass config-driven __init__
        mgr.connections = {"vps": SSHConnection(
            name="vps", hostname="h", ssh_user="root", ssh_key="/nope"
        )}
        return mgr

    def test_reraises_after_exhausting_retries(self, monkeypatch):
        mgr = self._manager()

        calls = {"n": 0}

        def always_fail(machine, command, timeout=30):
            calls["n"] += 1
            raise ConnectionError("boom")

        monkeypatch.setattr(mgr, "exec_command", always_fail)
        monkeypatch.setattr("lib.ssh_manager.time.sleep", lambda *_: None)

        with pytest.raises(ConnectionError, match="boom"):
            mgr.exec_with_retry("vps", "echo hi", retries=3)
        assert calls["n"] == 3

    def test_retries_zero_runs_once(self, monkeypatch):
        mgr = self._manager()
        calls = {"n": 0}

        def always_fail(machine, command, timeout=30):
            calls["n"] += 1
            raise ConnectionError("boom")

        monkeypatch.setattr(mgr, "exec_command", always_fail)
        # retries=0 must not raise TypeError on a None last_error.
        with pytest.raises(ConnectionError):
            mgr.exec_with_retry("vps", "echo hi", retries=0)
        assert calls["n"] == 1

    def test_succeeds_on_second_attempt(self, monkeypatch):
        mgr = self._manager()
        calls = {"n": 0}

        def flaky(machine, command, timeout=30):
            calls["n"] += 1
            if calls["n"] == 1:
                raise ConnectionError("transient")
            return ("out", "", 0)

        monkeypatch.setattr(mgr, "exec_command", flaky)
        monkeypatch.setattr("lib.ssh_manager.time.sleep", lambda *_: None)

        assert mgr.exec_with_retry("vps", "echo hi", retries=3) == ("out", "", 0)
        assert calls["n"] == 2


class TestSSHExecOrdering:
    """exec_command must drain stdout/stderr BEFORE blocking on the exit status.

    recv_exit_status() blocks (with no timeout) until the remote command exits;
    a command whose output overflows the channel window (~2 MB) blocks on write
    until the client reads, so reading the exit status first deadlocks forever.
    The safe order is read-then-status.
    """

    def _manager(self):
        from lib.ssh_manager import SSHManager
        return SSHManager.__new__(SSHManager)  # bypass config-driven __init__

    def _fake_client(self, events):
        class FakeChannel:
            def recv_exit_status(self):
                events.append("recv_exit_status")
                return 0

        class FakeStream:
            def __init__(self, name, data, channel=None):
                self._name = name
                self._data = data
                self.channel = channel

            def read(self):
                events.append(f"read_{self._name}")
                return self._data

        class FakeClient:
            def exec_command(self, command, timeout=30):
                channel = FakeChannel()
                stdout = FakeStream("stdout", b"out-data", channel=channel)
                stderr = FakeStream("stderr", b"err-data")
                return object(), stdout, stderr

        return FakeClient()

    def test_reads_streams_before_exit_status(self, monkeypatch):
        mgr = self._manager()
        events: list[str] = []
        monkeypatch.setattr(mgr, "get_connection", lambda machine: self._fake_client(events))

        out, err, code = mgr.exec_command("vps", "echo hi")

        assert (out, err, code) == ("out-data", "err-data", 0)
        # stdout must be drained before the (potentially blocking) exit-status read.
        assert events.index("read_stdout") < events.index("recv_exit_status")


class TestDatabaseSchema:
    """Tests for database schema integrity."""

    def test_schema_has_required_tables(self):
        from lib.database import get_connection

        conn = get_connection()
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
        tables = {row[0] for row in cursor.fetchall()}

        required = {"machine_state", "audit_log", "user_preferences", "task_history"}
        assert required.issubset(tables), f"Missing tables: {required - tables}"

    def test_schema_has_required_indexes(self):
        from lib.database import get_connection

        conn = get_connection()
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index'"
        )
        indexes = {row[0] for row in cursor.fetchall()}

        required = {"idx_audit_timestamp", "idx_audit_machine", "idx_task_started"}
        assert required.issubset(indexes), f"Missing indexes: {required - indexes}"


class TestDatabaseConnectionHandling:
    """Internal DB helpers must not leak connections."""

    def test_log_action_closes_connection(self, tmp_path, monkeypatch):
        import sqlite3
        import lib.database as db

        monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")

        closed = {"count": 0}

        class TrackingConnection(sqlite3.Connection):
            def close(self):
                closed["count"] += 1
                super().close()

        real_connect = sqlite3.connect

        def tracking_connect(*a, **k):
            k["factory"] = TrackingConnection
            return real_connect(*a, **k)

        monkeypatch.setattr(db.sqlite3, "connect", tracking_connect)

        db.log_action(machine="mac", action_type="test", description="x")
        rows = db.get_recent_logs(limit=5)

        assert closed["count"] == 2, "each helper call must close its connection"
        assert any(r["action_type"] == "test" for r in rows)


class TestCleanupSafety:
    """Cleanup must never target protected paths, including JARVIS's own dir."""

    def test_skips_own_jarvis_dir(self):
        from lib.cleanup import should_skip

        assert should_skip("/Users/vic/.jarvis/logs/jarvis.log") is True
        assert should_skip("/Users/vic/.jarvis/memory.db") is True

    def test_skips_ssh_and_config(self):
        from lib.cleanup import should_skip

        assert should_skip("/Users/vic/.ssh/id_ed25519") is True
        assert should_skip("/Users/vic/.config/foo") is True

    def test_allows_ordinary_cache(self):
        from lib.cleanup import should_skip

        assert should_skip("/Users/vic/projects/app/__pycache__") is False

    def test_protects_live_tooling_from_autopilot(self):
        """Autopilot must not reclaim node_modules of connected MCP servers
        or the Claude Code plugin cache — deleting those breaks running tools."""
        from lib.cleanup import should_skip

        assert should_skip("/Users/vic/mcp-servers/1mcp-agent/node_modules") is True
        assert should_skip(
            "/Users/vic/.claude/plugins/cache/x/chrome-devtools-mcp/node_modules"
        ) is True
        # An unrelated stale project is still fair game for reclamation.
        assert should_skip("/Users/vic/oldproj/node_modules") is False


class TestCleanupThresholds:
    """Tests for configurable cleanup thresholds."""

    def test_get_cleanup_thresholds_returns_defaults(self):
        from lib.scheduler import _get_cleanup_thresholds

        disk_thresh, free_thresh = _get_cleanup_thresholds()
        assert isinstance(disk_thresh, (int, float))
        assert isinstance(free_thresh, (int, float))
        assert disk_thresh == 70.0
        assert free_thresh == 50.0


class TestNotifier:
    """Tests for desktop notification behavior."""

    def test_returns_false_when_disabled(self):
        from lib.notifier import Notifier

        n = Notifier()
        n.enabled = False
        # No subprocess call should happen when disabled.
        with patch("lib.notifier.subprocess.run") as mock_run:
            assert n.notify("Test", "msg") is False
            mock_run.assert_not_called()

    def test_returns_false_on_non_darwin(self):
        from lib.notifier import Notifier

        n = Notifier()
        n.enabled = True
        with patch("lib.notifier.sys.platform", "linux"):
            with patch("lib.notifier.subprocess.run") as mock_run:
                assert n.notify("Test", "msg") is False
                mock_run.assert_not_called()

    def test_sound_clause_is_single_statement(self):
        """Regression: `sound name` must stay on the `display notification`
        line — a separate line is an AppleScript syntax error (-10002)."""
        from lib.notifier import Notifier

        n = Notifier()
        n.enabled = True
        captured = {}

        def fake_run(args, **kwargs):
            captured["script"] = args[-1]
            return MagicMock(returncode=0)

        with patch("lib.notifier.sys.platform", "darwin"):
            with patch("lib.notifier.subprocess.run", side_effect=fake_run):
                assert n.notify("Title", "Body", sound=True) is True

        script = captured["script"]
        assert "\n" not in script, "notification command must be one statement"
        assert script.startswith("display notification ")
        assert script.endswith(' sound name "Glass"')

    def test_quotes_are_escaped(self):
        from lib.notifier import Notifier

        n = Notifier()
        n.enabled = True
        captured = {}

        def fake_run(args, **kwargs):
            captured["script"] = args[-1]
            return MagicMock(returncode=0)

        with patch("lib.notifier.sys.platform", "darwin"):
            with patch("lib.notifier.subprocess.run", side_effect=fake_run):
                n.notify('Ti"tle', 'say "hi"', sound=False)

        # Embedded double quotes must be backslash-escaped for AppleScript.
        assert '\\"' in captured["script"]
