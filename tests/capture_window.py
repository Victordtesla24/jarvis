#!/usr/bin/env python3
"""
tests/capture_window.py — thin CLI wrapper around
tests/lib/visual_lib.capture_jarvis_window for the Step 6 reactive demo.
Captures N frames of a named window at a fixed interval and writes them as
frame_NNN_<timestamp>.png under the specified output dir.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from lib.visual_lib import (  # noqa: E402
    capture_jarvis_window,
    _HAVE_QUARTZ,
    CAPTURE_DIR,
)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, required=True)
    ap.add_argument("--interval", type=float, required=True)
    ap.add_argument("--owner", type=str, default="JarvisTelemetry")
    ap.add_argument("--out-dir", type=Path, required=True)
    ap.add_argument("--prefix", type=str, default="frame_")
    args = ap.parse_args()

    if not _HAVE_QUARTZ:
        sys.exit("FATAL: pyobjc Quartz not installed; cannot capture window")

    args.out_dir.mkdir(parents=True, exist_ok=True)

    # Monkey-patch visual_lib's CAPTURE_DIR so captures land in args.out_dir
    # instead of the harness default.
    import lib.visual_lib as vl
    vl.CAPTURE_DIR = args.out_dir

    for i in range(1, args.count + 1):
        label = f"{args.prefix}{i:03d}"
        t0 = time.time()
        try:
            path = capture_jarvis_window(label, owner_name=args.owner)
            size_kb = path.stat().st_size / 1024.0
            print(f"  [frame {i:02d}/{args.count}] {path.name} ({size_kb:.0f} KB)", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"  [frame {i:02d}/{args.count}] ERROR: {exc}", flush=True)
        # Sleep any remainder of the interval (not strict real-time)
        elapsed = time.time() - t0
        if elapsed < args.interval:
            time.sleep(args.interval - elapsed)

    print(f"  done — frames in {args.out_dir}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
