"""Shared pytest fixtures.

The autouse logging guard keeps tests from mutating the global root logger.
``lib.daemon.setup_daemon_logging`` attaches a ``RotatingFileHandler`` to the
root logger; without isolation that handler survives the whole session and
later tests' warnings (e.g. the LLM "...heuristics: boom" fallback) leak into
the real ``logs/jarvis.log``. This fixture snapshots the root logger before
each test and restores it afterwards, closing any handler a test added.
"""
import logging

import pytest


@pytest.fixture(autouse=True)
def _isolate_root_logger():
    root = logging.getLogger()
    saved_handlers = root.handlers[:]
    saved_level = root.level

    yield

    for handler in root.handlers[:]:
        if handler not in saved_handlers:
            root.removeHandler(handler)
            handler.close()
    root.handlers[:] = saved_handlers
    root.setLevel(saved_level)
