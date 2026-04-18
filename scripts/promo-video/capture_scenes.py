#!/usr/bin/env python3
"""scripts/promo-video/capture_scenes.py

Launches JarvisTelemetry for each act, records the screen via macOS
`screencapture`, and saves raw_captures/act{1..4}.mp4.

Exit codes (shared across promo-video/*.py):
  0  success
 10  missing required dependency (ffmpeg, screencapture)
 11  Screen Recording permission not granted
 12  Swift build failure

Preflight:
  - checks ffmpeg is installed
  - checks Screen Recording permission via TCC probe
    (bypass with PROMO_SKIP_CAPTURE=1 for CI / offline runs)
  - builds the Swift app if .build/release/JarvisTelemetry is missing
"""
from __future__ import annotations
import argparse
import logging
import os
import shutil
import subprocess
import sys
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Optional

sys.path.insert(0, str(Path(__file__).parent))
from lib.shot_list_loader import REPO_ROOT  # noqa: E402

LOG = logging.getLogger("capture_scenes")

RAW_DEFAULT = REPO_ROOT / "promo" / "raw_captures"
SWIFT_BIN = REPO_ROOT / "JarvisTelemetry" / ".build" / "release" / "JarvisTelemetry"
REPLAY_JSON = REPO_ROOT / "scripts" / "promo-video" / "replay_sequences" / "act3_battery_drama.json"
LAUNCH_LOG = REPO_ROOT / "tests" / "output" / "jarvis_launch.log"

# R-42: exit codes
EX_MISSING_DEP = 10
EX_NO_PERMISSION = 11
EX_BUILD_FAILURE = 12


def check_screen_recording_permission() -> bool:
    """R-41: check TCC via CGPreflightScreenCaptureAccess. Falls back to a
    screencapture probe if the CoreGraphics symbol is unavailable.
    """
    try:
        import ctypes  # noqa: WPS433
        cg = ctypes.CDLL(
            "/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics"
        )
        cg.CGPreflightScreenCaptureAccess.restype = ctypes.c_int
        return cg.CGPreflightScreenCaptureAccess() != 0
    except OSError:
        pass
    # Fall back to a 1-second probe.
    probe = RAW_DEFAULT / "_probe.mov"
    probe.parent.mkdir(parents=True, exist_ok=True)
    probe.unlink(missing_ok=True)
    try:
        subprocess.run(
            ["/usr/sbin/screencapture", "-v", "-V", "1", "-x", str(probe)],
            check=True, capture_output=True, timeout=20,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False
    ok = probe.exists() and probe.stat().st_size > 50_000
    probe.unlink(missing_ok=True)
    return ok


def preflight_capture(skip: bool) -> None:
    """Verify dependencies + TCC permission. Sets placeholder outputs when
    PROMO_SKIP_CAPTURE=1 is set so the rest of the pipeline can proceed."""
    if shutil.which("ffmpeg") is None:
        LOG.error("ffmpeg not found; brew install ffmpeg")
        sys.exit(EX_MISSING_DEP)
    if not Path("/usr/sbin/screencapture").exists():
        LOG.error("/usr/sbin/screencapture not found (macOS only)")
        sys.exit(EX_MISSING_DEP)

    if skip:
        LOG.info("PROMO_SKIP_CAPTURE=1 — installing placeholder MP4s")
        return

    if not check_screen_recording_permission():
        LOG.error("Screen Recording permission not granted. Grant to Terminal at: "
                  "System Settings -> Privacy & Security -> Screen Recording")
        sys.exit(EX_NO_PERMISSION)
    LOG.info("screen recording permission OK")


def preflight_swift_build() -> None:
    if SWIFT_BIN.exists():
        return
    LOG.info("building Swift app (first run)")
    try:
        subprocess.run(
            ["swift", "build", "-c", "release"],
            cwd=REPO_ROOT / "JarvisTelemetry",
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        LOG.error("swift build failed: %s", exc)
        sys.exit(EX_BUILD_FAILURE)
    if not SWIFT_BIN.exists():
        LOG.error("Swift build produced nothing at %s", SWIFT_BIN)
        sys.exit(EX_BUILD_FAILURE)


@contextmanager
def _open_launch_log() -> Generator:
    """R-11: context-manager-managed log fd so Popen inherits cleanly and the
    parent handle is always closed even if Popen raises."""
    LAUNCH_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(LAUNCH_LOG, "a") as f:
        f.write(f"\n=== {time.strftime('%Y-%m-%d %H:%M:%S')} ===\n")
        f.flush()
        yield f


def launch_app(extra_env: Optional[dict[str, str]] = None) -> subprocess.Popen:
    """Launch JarvisTelemetry. R-11: parent log fd is scoped to a with-block."""
    env = os.environ.copy()
    env["JARVIS_PROMO_CAPTURE"] = "1"
    if extra_env:
        env.update(extra_env)
    use_sudo = subprocess.run(
        ["sudo", "-n", "true"], capture_output=True
    ).returncode == 0
    cmd: list[str]
    if use_sudo:
        cmd = ["sudo", "-n", "-E", str(SWIFT_BIN)]
    else:
        cmd = [str(SWIFT_BIN)]
    with _open_launch_log() as log:
        # Popen dups the log fd for the child; the with-block closes our copy
        # as soon as we exit, so no parent-side fd leaks to subsequent calls.
        return subprocess.Popen(cmd, env=env, stdout=log, stderr=log)


def _kill(pid: int, sig: str) -> None:
    if subprocess.run(["sudo", "-n", "true"], capture_output=True).returncode == 0:
        subprocess.run(
            ["sudo", "-n", "kill", f"-{sig}", str(pid)], capture_output=True)
    else:
        subprocess.run(["kill", f"-{sig}", str(pid)], capture_output=True)


def stop_app(p: subprocess.Popen, grace: float = 3.0) -> None:
    if p.poll() is not None:
        return
    _kill(p.pid, "TERM")
    try:
        p.wait(timeout=grace)
    except subprocess.TimeoutExpired:
        _kill(p.pid, "KILL")
        try:
            p.wait(timeout=1.0)
        except subprocess.TimeoutExpired:
            pass


def _make_placeholder_mp4(out: Path, duration: float) -> None:
    out.unlink(missing_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "lavfi",
         "-i", f"color=0x050A14:size=2560x1440:rate=30:d={duration:.3f}",
         "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
         "-pix_fmt", "yuv420p",
         str(out)],
        check=True, capture_output=True,
    )


def record(out_mp4: Path, duration: float, skip: bool) -> None:
    out_mp4.unlink(missing_ok=True)
    if skip:
        _make_placeholder_mp4(out_mp4, duration)
        return
    raw_mov = out_mp4.with_suffix(".raw.mov")
    raw_mov.unlink(missing_ok=True)

    secs = max(1, int(round(duration)))
    subprocess.run(
        ["/usr/sbin/screencapture", "-v", "-V", str(secs), "-x", str(raw_mov)],
        check=True, capture_output=True,
    )
    if not raw_mov.exists() or raw_mov.stat().st_size < 100_000:
        raise RuntimeError(f"screencapture produced empty/small file: {raw_mov}")

    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-i", str(raw_mov),
         "-vf", "scale=2560:1440:force_original_aspect_ratio=decrease,"
                "pad=2560:1440:(ow-iw)/2:(oh-ih)/2:color=black,fps=30",
         "-t", f"{duration}",
         "-c:v", "libx264", "-preset", "medium", "-crf", "16",
         "-pix_fmt", "yuv420p",
         str(out_mp4)],
        check=True, capture_output=True,
    )
    raw_mov.unlink(missing_ok=True)


def capture_act1(raw_dir: Path, skip: bool) -> None:
    out = raw_dir / "act1.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        LOG.info("skip %s (exists)", out.name)
        return
    LOG.info("act1.mp4 — cold boot + hero reactor (30s)")
    if skip:
        _make_placeholder_mp4(out, 30.0)
        return
    p = launch_app()
    try:
        time.sleep(0.8)
        record(out, 30.0, skip=skip)
    finally:
        stop_app(p)


def capture_act2(raw_dir: Path, skip: bool) -> None:
    out = raw_dir / "act2.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        LOG.info("skip %s (exists)", out.name)
        return
    LOG.info("act2.mp4 — floating panels + chatter (35s)")
    if skip:
        _make_placeholder_mp4(out, 35.0)
        return
    p = launch_app()
    try:
        time.sleep(11.0)
        record(out, 35.0, skip=skip)
    finally:
        stop_app(p)


def capture_act3(raw_dir: Path, skip: bool) -> None:
    out = raw_dir / "act3.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        LOG.info("skip %s (exists)", out.name)
        return
    LOG.info("act3.mp4 — battery drama via replay (30s)")
    if skip:
        _make_placeholder_mp4(out, 30.0)
        return
    p = launch_app(extra_env={"JARVIS_BATTERY_REPLAY": str(REPLAY_JSON)})
    try:
        time.sleep(11.0)
        record(out, 30.0, skip=skip)
    finally:
        stop_app(p)


def capture_act4(raw_dir: Path, skip: bool) -> None:
    """Act 4 — integration + shutdown (21s). SIGTERM fires at t=15 so
    ShutdownSequenceView plays through the final 6 seconds."""
    out = raw_dir / "act4.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        LOG.info("skip %s (exists)", out.name)
        return
    LOG.info("act4.mp4 — macOS integration + shutdown (21s)")
    if skip:
        _make_placeholder_mp4(out, 21.0)
        return
    p = launch_app()
    try:
        time.sleep(11.0)

        raw_mov = out.with_suffix(".raw.mov")
        raw_mov.unlink(missing_ok=True)
        # R-57: capture screencapture stdout/stderr and check returncode.
        with _open_launch_log() as log:
            rec_proc = subprocess.Popen(
                ["/usr/sbin/screencapture", "-v", "-V", "21", "-x", str(raw_mov)],
                stdout=log, stderr=log,
            )
        time.sleep(15.0)
        _kill(p.pid, "TERM")
        try:
            rec_rc = rec_proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            rec_proc.terminate()
            try:
                rec_rc = rec_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                rec_proc.kill()
                rec_rc = rec_proc.wait(timeout=2)
        if rec_rc != 0:
            LOG.warning("screencapture exited rc=%s (act4)", rec_rc)
        try:
            p.wait(timeout=10)
        except subprocess.TimeoutExpired:
            _kill(p.pid, "KILL")

        if not (raw_mov.exists() and raw_mov.stat().st_size > 100_000):
            raise RuntimeError(f"act4 screencapture produced empty file: {raw_mov}")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-i", str(raw_mov),
             "-vf", "scale=2560:1440:force_original_aspect_ratio=decrease,"
                    "pad=2560:1440:(ow-iw)/2:(oh-ih)/2:color=black,fps=30",
             "-t", "21",
             "-c:v", "libx264", "-preset", "medium", "-crf", "16",
             "-pix_fmt", "yuv420p",
             str(out)],
            check=True, capture_output=True,
        )
        raw_mov.unlink(missing_ok=True)
    finally:
        if p.poll() is None:
            stop_app(p)


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Capture 4 act scenes for the JARVIS promo video")
    p.add_argument("--act", type=int, choices=[1, 2, 3, 4], default=None,
                   help="Only record this act (default: all)")
    p.add_argument("--out-dir", type=Path, default=RAW_DEFAULT,
                   help=f"Output directory (default: {RAW_DEFAULT})")
    p.add_argument("-v", "--verbose", action="store_true",
                   help="Enable debug logging")
    return p.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s: %(message)s",
        stream=sys.stderr,
    )
    raw_dir: Path = args.out_dir
    raw_dir.mkdir(parents=True, exist_ok=True)

    skip = os.environ.get("PROMO_SKIP_CAPTURE", "0") == "1"
    preflight_capture(skip=skip)
    if not skip:
        preflight_swift_build()
        if subprocess.run(["sudo", "-n", "true"],
                          capture_output=True).returncode == 0:
            LOG.info("sudo credentials cached — privileged SMC access")
        else:
            LOG.info("sudo not cached — unprivileged (some SMC sensors -> 0)")

    runners = {
        1: capture_act1, 2: capture_act2, 3: capture_act3, 4: capture_act4,
    }
    if args.act is not None:
        runners[args.act](raw_dir, skip=skip)
    else:
        for act in (1, 2, 3, 4):
            runners[act](raw_dir, skip=skip)

    # Final artifact path on stdout; progress already went to stderr.
    for a in (1, 2, 3, 4):
        if args.act is not None and a != args.act:
            continue
        print(str(raw_dir / f"act{a}.mp4"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
