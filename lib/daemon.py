"""JARVIS daemon and setup logic (formerly in jarvisd).

Kept in lib/ so pygount properly classifies it as Python.
Imported by the top-level ``jarvis`` entry point.
"""
import sys
import os
import signal
import logging
from pathlib import Path
from logging.handlers import RotatingFileHandler

JARVIS_HOME = Path(__file__).resolve().parent.parent
LOG_DIR = JARVIS_HOME / "logs"


def setup_daemon_logging() -> logging.Logger:
    """Configure daemon logging with rotation: 5 MB per file, 3 backups.

    Handlers are attached to the *root* logger so that messages from every
    module — ``lib.scheduler``, ``lib.cleanup``, ``lib.ssh_manager``, etc. —
    land in ``logs/jarvis.log``, not just those logged through the ``jarvis``
    logger. Previously only the ``jarvis`` logger was wired up, so the
    autonomous agent's actual job activity (tidy/health/deep-clean) was
    invisible. Idempotent: re-running replaces JARVIS's own handlers rather
    than stacking duplicates.
    """
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(logging.INFO)

    # Drop handlers we installed on a previous call (keep any foreign ones).
    for handler in list(root.handlers):
        if getattr(handler, "_jarvis_handler", False):
            root.removeHandler(handler)

    fh = RotatingFileHandler(
        LOG_DIR / "jarvis.log",
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
    )
    fh.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    ))
    fh._jarvis_handler = True
    root.addHandler(fh)

    sh = logging.StreamHandler(sys.stderr)
    sh.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s"
    ))
    sh._jarvis_handler = True
    root.addHandler(sh)

    # APScheduler's scheduler logger is very chatty at INFO; keep job-execution
    # logs (executors) visible but quiet the per-tick scheduler bookkeeping.
    logging.getLogger("apscheduler.scheduler").setLevel(logging.WARNING)

    return root


def run_daemon() -> None:
    """Background scheduler loop."""
    logger = setup_daemon_logging()
    logger.info("=" * 50)
    logger.info("JARVIS: Starting autonomous machine agent")
    logger.info("=" * 50)

    scheduler = None

    def _handle_signal(signum: int, _frame) -> None:
        logger.info("JARVIS: Received signal %d, shutting down...", signum)
        if scheduler:
            scheduler.shutdown(wait=True)
        logger.info("JARVIS: Daemon stopped")
        sys.exit(0)

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    try:
        from lib.database import get_connection
        from lib.scheduler import setup_scheduler

        get_connection()
        logger.info("JARVIS: Database initialized")

        scheduler = setup_scheduler()
        scheduler.start()
        logger.info("JARVIS: Scheduler started")

        logger.info("JARVIS: Running on %s", os.uname().nodename)
        logger.info("JARVIS: Tidy job runs every 15 minutes")
        logger.info("JARVIS: Health check runs every 60 minutes")
        logger.info("JARVIS: Deep clean runs at midnight")

        while True:
            import time
            time.sleep(60)

    except Exception:
        logger.exception("JARVIS: Fatal error")
        raise


PLIST_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.jarvis.daemon</string>

    <key>ProgramArguments</key>
    <array>
        <string>{python}</string>
        <string>{jarvis_path}</string>
        <string>daemon</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>{log_dir}/launchd.out.log</string>

    <key>StandardErrorPath</key>
    <string>{log_dir}/launchd.err.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>"""


def run_setup() -> None:
    """Print a launchd plist to stdout and show install instructions."""
    import shutil

    python = shutil.which("python3") or "/opt/homebrew/bin/python3"
    plist = PLIST_TEMPLATE.format(
        python=python,
        jarvis_path=JARVIS_HOME / "jarvis",
        log_dir=LOG_DIR,
    )

    print(plist)

    print("\n# ── Install ──────────────────────────────────────────────", file=sys.stderr)
    print("# 1. Save the plist above to ~/Library/LaunchAgents/com.jarvis.daemon.plist", file=sys.stderr)
    print("# 2. launchctl load ~/Library/LaunchAgents/com.jarvis.daemon.plist", file=sys.stderr)
    print("# 3. Check: launchctl list | grep jarvis", file=sys.stderr)
    print("# ─────────────────────────────────────────────────────────", file=sys.stderr)
