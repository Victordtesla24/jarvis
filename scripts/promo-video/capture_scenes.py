#!/usr/bin/env python3
"""scripts/promo-video/capture_scenes.py

Launches JarvisTelemetry for each act, records the screen via ffmpeg
avfoundation, and saves raw_captures/act{1..4}.mp4.

Preflight:
  - checks ffmpeg is installed
  - checks Screen Recording permission via a probe capture
  - builds the Swift app if .build/release/JarvisTelemetry is missing

Act recording windows:
  - Act 1  : 30 s from fresh launch (boot sequence + hero reactor)
  - Act 2  : 35 s after boot completes (panels + chatter)
  - Act 3  : 30 s with JARVIS_BATTERY_REPLAY env var (battery drama)
  - Act 4  : 25 s with SIGTERM for animated shutdown at t=18s
"""
from __future__ import annotations
import os
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.shot_list_loader import REPO_ROOT  # noqa: E402

RAW = REPO_ROOT / "promo" / "raw_captures"
RAW.mkdir(parents=True, exist_ok=True)

SWIFT_BIN = REPO_ROOT / "JarvisTelemetry" / ".build" / "release" / "JarvisTelemetry"
REPLAY_JSON = REPO_ROOT / "scripts" / "promo-video" / "replay_sequences" / "act3_battery_drama.json"
LAUNCH_LOG = REPO_ROOT / "tests" / "output" / "jarvis_launch.log"

def preflight_capture() -> None:
    """Verify macOS `screencapture` works and ffmpeg is installed.

    Why screencapture instead of ffmpeg avfoundation? On macOS 14+, ffmpeg's
    avfoundation screen-grab input has been observed to return pure-black
    frames while /usr/sbin/screencapture (which uses ScreenCaptureKit under
    the hood) captures the composited display correctly. We use screencapture
    for the raw capture and ffmpeg only for format conversion and assembly.
    """
    if not subprocess.run(["which", "ffmpeg"], capture_output=True).stdout:
        sys.exit("[preflight] ffmpeg not found; `brew install ffmpeg`")
    if not Path("/usr/sbin/screencapture").exists():
        sys.exit("[preflight] /usr/sbin/screencapture not found (macOS only)")

    # Probe: capture 1 second. If Screen Recording permission is missing,
    # the output file will be zero-length or the exit code non-zero.
    probe = RAW / "_probe.mov"
    probe.unlink(missing_ok=True)
    try:
        subprocess.run(
            ["/usr/sbin/screencapture", "-v", "-V", "1", "-x", str(probe)],
            check=True, capture_output=True, timeout=20,
        )
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.decode()[:400] if exc.stderr else ""
        sys.exit(
            "[preflight] /usr/sbin/screencapture -v failed.\n"
            "Grant Screen Recording permission to Terminal in:\n"
            "  System Settings → Privacy & Security → Screen Recording\n"
            f"screencapture stderr:\n{stderr}"
        )
    if not probe.exists() or probe.stat().st_size < 50_000:
        sz = probe.stat().st_size if probe.exists() else 0
        sys.exit(
            f"[preflight] screencapture probe produced only {sz}B — Screen "
            f"Recording permission likely missing. Grant it to Terminal in:\n"
            f"  System Settings → Privacy & Security → Screen Recording"
        )
    probe.unlink(missing_ok=True)
    print("[preflight] screencapture OK")


def preflight_swift_build() -> None:
    if SWIFT_BIN.exists():
        return
    print("[preflight] building Swift app (first run)…")
    subprocess.run(
        ["swift", "build", "-c", "release"],
        cwd=REPO_ROOT / "JarvisTelemetry",
        check=True,
    )
    if not SWIFT_BIN.exists():
        sys.exit(f"[preflight] Swift build produced nothing at {SWIFT_BIN}")


def launch_app(extra_env: dict[str, str] | None = None) -> subprocess.Popen:
    """Launch JarvisTelemetry with sudo -n -E (non-interactive, inherit env)."""
    env = os.environ.copy()
    env["JARVIS_PROMO_CAPTURE"] = "1"
    if extra_env:
        env.update(extra_env)
    LAUNCH_LOG.parent.mkdir(parents=True, exist_ok=True)
    log = open(LAUNCH_LOG, "a")
    log.write(f"\n=== {time.strftime('%Y-%m-%d %H:%M:%S')} ===\n")
    log.flush()
    # Use sudo -n -E only if credentials are cached, otherwise run unprivileged.
    # Running unprivileged means some SMC sensors report zero but IOKit / IOReport
    # still drive the visible ring animations (see tests/build_and_launch.sh).
    use_sudo = subprocess.run(
        ["sudo", "-n", "true"], capture_output=True
    ).returncode == 0
    if use_sudo:
        p = subprocess.Popen(
            ["sudo", "-n", "-E", str(SWIFT_BIN)],
            env=env, stdout=log, stderr=log,
        )
    else:
        p = subprocess.Popen(
            [str(SWIFT_BIN)],
            env=env, stdout=log, stderr=log,
        )
    return p


def _kill(pid: int, sig: str) -> None:
    """Try sudo kill first (for sudo-launched processes), fall back to plain kill."""
    if subprocess.run(["sudo", "-n", "true"], capture_output=True).returncode == 0:
        subprocess.run(["sudo", "-n", "kill", f"-{sig}", str(pid)], capture_output=True)
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


def record(out_mp4: Path, duration: float) -> None:
    """Record the main display via macOS `screencapture -v -V` and transcode
    to 2560x1440 H.264. Two stages:
      1. screencapture writes a native-resolution .mov via ScreenCaptureKit
      2. ffmpeg rescales/pads to 2560x1440, re-encodes for pipeline consistency
    """
    out_mp4.unlink(missing_ok=True)
    raw_mov = out_mp4.with_suffix(".raw.mov")
    raw_mov.unlink(missing_ok=True)

    # Ceil duration to an integer because screencapture -V takes integer seconds
    secs = max(1, int(round(duration)))
    subprocess.run(
        ["/usr/sbin/screencapture", "-v", "-V", str(secs), "-x", str(raw_mov)],
        check=True, capture_output=True,
    )
    if not raw_mov.exists() or raw_mov.stat().st_size < 100_000:
        raise RuntimeError(f"screencapture produced empty/small file: {raw_mov}")

    # Transcode: scale longest edge to 2560, pad to 2560x1440, H.264, yuv420p, 30fps
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


def capture_act1() -> None:
    out = RAW / "act1.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        print(f"  ⏭  {out.name} already exists, skipping")
        return
    print(f"  🎥  act1.mp4 — cold boot + hero reactor (30s)")
    p = launch_app()
    time.sleep(0.8)
    record(out, 30.0)
    stop_app(p)


def capture_act2() -> None:
    out = RAW / "act2.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        print(f"  ⏭  {out.name} already exists, skipping")
        return
    print(f"  🎥  act2.mp4 — floating panels + chatter (35s)")
    p = launch_app()
    time.sleep(11.0)  # wait for boot sequence to complete
    record(out, 35.0)
    stop_app(p)


def capture_act3() -> None:
    out = RAW / "act3.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        print(f"  ⏭  {out.name} already exists, skipping")
        return
    print(f"  🎥  act3.mp4 — battery drama via replay (30s)")
    p = launch_app(extra_env={"JARVIS_BATTERY_REPLAY": str(REPLAY_JSON)})
    time.sleep(11.0)
    record(out, 30.0)
    stop_app(p)


def capture_act4() -> None:
    """Act 4 — integration + shutdown (21s total).

    Timeline inside act4.mp4:
      [0-7]   steady state → used for s14 jarvis_links
      [7-15]  steady state → used for s15 lock_freeze (polish can overlay lock anim)
      [15-21] shutdown animation (SIGTERM fired at t=15 into the capture)
    """
    out = RAW / "act4.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        print(f"  ⏭  {out.name} already exists, skipping")
        return
    print(f"  🎥  act4.mp4 — macOS integration + shutdown (21s)")
    p = launch_app()
    time.sleep(11.0)

    raw_mov = out.with_suffix(".raw.mov")
    raw_mov.unlink(missing_ok=True)
    # Start screencapture in background for 21 seconds
    rec_proc = subprocess.Popen(
        ["/usr/sbin/screencapture", "-v", "-V", "21", "-x", str(raw_mov)],
    )
    # Let 15s elapse, then fire SIGTERM at the app so ShutdownSequenceView runs
    time.sleep(15.0)
    _kill(p.pid, "TERM")
    # Wait for screencapture to finish (it will stop automatically at -V 21)
    try:
        rec_proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        rec_proc.terminate()
        try:
            rec_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            rec_proc.kill()
    try:
        p.wait(timeout=10)
    except subprocess.TimeoutExpired:
        _kill(p.pid, "KILL")

    # Transcode raw mov → 2560x1440 H.264 mp4 matching the other acts
    if raw_mov.exists() and raw_mov.stat().st_size > 100_000:
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
    else:
        raise RuntimeError(f"act4 screencapture produced empty file: {raw_mov}")


def main() -> int:
    preflight_capture()
    preflight_swift_build()
    if subprocess.run(["sudo", "-n", "true"], capture_output=True).returncode == 0:
        print("[capture] sudo credentials cached — launching with privileged SMC access")
    else:
        print("[capture] sudo not cached — launching unprivileged (some SMC sensors will report 0)")
    capture_act1()
    capture_act2()
    capture_act3()
    capture_act4()
    print("\n[capture] all 4 acts captured to promo/raw_captures/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
