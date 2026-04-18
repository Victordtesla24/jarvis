#!/usr/bin/env python3
"""
tests/generate_evidence.py — assemble a single evidence MP4 from the PNG
captures produced by visual_capture.py.

Rationale: the pasted protocol's Gemini image generation path is unreliable
because `gemini-2.0-flash` is text-only for most accounts. Instead we use the
captures we already have and stitch them into a short video with ffmpeg.
Runs AFTER visual_capture.py so all frames are on disk.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(
    os.environ.get(
        "REPO_ROOT",
        "/Users/vic/claude/General-Work/jarvis/jarvis-build",
    )
)
CAPTURE_DIR = REPO_ROOT / "tests" / "output" / "captures"
OUT_DIR = REPO_ROOT / "tests" / "output"
VIDEO_PATH = OUT_DIR / "jarvis_evidence.mp4"
MONTAGE_DIR = OUT_DIR / "_montage"


def main() -> int:
    if not CAPTURE_DIR.exists():
        print(f"[evidence] no captures dir at {CAPTURE_DIR}, nothing to do")
        return 0

    pngs = sorted(CAPTURE_DIR.glob("*.png"))
    if not pngs:
        print("[evidence] no PNG captures found, skipping video assembly")
        return 0

    if not shutil.which("ffmpeg"):
        print("[evidence] ffmpeg not found, skipping video assembly")
        return 0

    MONTAGE_DIR.mkdir(parents=True, exist_ok=True)
    for p in MONTAGE_DIR.glob("frame_*.png"):
        p.unlink()

    for i, src in enumerate(pngs):
        dst = MONTAGE_DIR / f"frame_{i:04d}.png"
        try:
            os.link(src, dst)
        except OSError:
            shutil.copyfile(src, dst)

    print(f"[evidence] composing {len(pngs)} frames -> {VIDEO_PATH}")
    cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        "2",
        "-i",
        str(MONTAGE_DIR / "frame_%04d.png"),
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "medium",
        "-crf",
        "23",
        str(VIDEO_PATH),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print("[evidence] ffmpeg failed:")
        print(proc.stderr[-1500:])
        return proc.returncode

    shutil.rmtree(MONTAGE_DIR, ignore_errors=True)

    size_mb = VIDEO_PATH.stat().st_size / (1024 * 1024)
    print(f"[evidence] wrote {VIDEO_PATH} ({size_mb:.2f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
