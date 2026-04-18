"""pytest config for scripts/promo-video.

R-63: explicitly skip capture_window.py harness (not a pytest module).
"""
from __future__ import annotations

collect_ignore = [
    "../capture_window.py",
]
