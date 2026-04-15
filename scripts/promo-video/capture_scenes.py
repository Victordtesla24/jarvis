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

# avfoundation device index for the main display — "1:none" means screen 1, no audio.
# On some systems this is "2:none" (when a virtual camera at index 1 shifts the list).
# capture_scenes.py auto-probes and picks whichever index works.
SCREEN_DEV_CANDIDATES = ["1:none", "2:none", "0:none"]


def preflight_ffmpeg() -> str:
    """Return the avfoundation input index that produces a non-empty probe."""
    if not subprocess.run(["which", "ffmpeg"], capture_output=True).stdout:
        sys.exit("[preflight] ffmpeg not found; `brew install ffmpeg`")

    probe = RAW / "_probe.mp4"
    for dev in SCREEN_DEV_CANDIDATES:
        probe.unlink(missing_ok=True)
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error",
                 "-f", "avfoundation", "-capture_cursor", "0", "-framerate", "30",
                 "-i", dev,
                 "-t", "0.5",
                 "-c:v", "libx264", "-preset", "ultrafast",
                 str(probe)],
                check=True, capture_output=True, timeout=20,
            )
            if probe.exists() and probe.stat().st_size > 5000:
                probe.unlink(missing_ok=True)
                print(f"[preflight] avfoundation device '{dev}' works")
                return dev
        except subprocess.CalledProcessError as exc:
            stderr = exc.stderr.decode()[:300] if exc.stderr else ""
            print(f"[preflight] device '{dev}' failed: {stderr.splitlines()[-1] if stderr else ''}")

    sys.exit(
        "[preflight] NO avfoundation screen capture device works.\n"
        "Grant Screen Recording permission to Terminal (or your shell/ffmpeg) in:\n"
        "  System Settings → Privacy & Security → Screen Recording\n"
        "Then re-run ./scripts/promo-video/run.sh --rough"
    )


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


def record(dev: str, out_mp4: Path, duration: float) -> None:
    out_mp4.unlink(missing_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "avfoundation",
         "-capture_cursor", "0",
         "-framerate", "30",
         "-i", dev,
         "-t", f"{duration}",
         "-vf", "scale=2560:1440:force_original_aspect_ratio=decrease,"
                "pad=2560:1440:(ow-iw)/2:(oh-ih)/2:color=black",
         "-c:v", "libx264", "-preset", "medium", "-crf", "16",
         "-pix_fmt", "yuv420p",
         "-r", "30",
         str(out_mp4)],
        check=True,
    )


def capture_act1(dev: str) -> None:
    out = RAW / "act1.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        print(f"  ⏭  {out.name} already exists, skipping")
        return
    print(f"  🎥  act1.mp4 — cold boot + hero reactor (30s)")
    p = launch_app()
    time.sleep(0.8)
    record(dev, out, 30.0)
    stop_app(p)


def capture_act2(dev: str) -> None:
    out = RAW / "act2.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        print(f"  ⏭  {out.name} already exists, skipping")
        return
    print(f"  🎥  act2.mp4 — floating panels + chatter (35s)")
    p = launch_app()
    time.sleep(11.0)  # wait for boot sequence to complete
    record(dev, out, 35.0)
    stop_app(p)


def capture_act3(dev: str) -> None:
    out = RAW / "act3.mp4"
    if out.exists() and out.stat().st_size > 100_000:
        print(f"  ⏭  {out.name} already exists, skipping")
        return
    print(f"  🎥  act3.mp4 — battery drama via replay (30s)")
    p = launch_app(extra_env={"JARVIS_BATTERY_REPLAY": str(REPLAY_JSON)})
    time.sleep(11.0)
    record(dev, out, 30.0)
    stop_app(p)


def capture_act4(dev: str) -> None:
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
    rec_proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "avfoundation", "-capture_cursor", "0", "-framerate", "30",
         "-i", dev,
         "-t", "21",
         "-vf", "scale=2560:1440:force_original_aspect_ratio=decrease,"
                "pad=2560:1440:(ow-iw)/2:(oh-ih)/2:color=black",
         "-c:v", "libx264", "-preset", "medium", "-crf", "16",
         "-pix_fmt", "yuv420p", "-r", "30",
         str(out)],
    )
    # Fire SIGTERM at t=15 so the ShutdownSequenceView runs inside the [15,21] slice
    time.sleep(15.0)
    _kill(p.pid, "TERM")
    try:
        rec_proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        rec_proc.terminate()
        rec_proc.wait(timeout=5)
    try:
        p.wait(timeout=10)
    except subprocess.TimeoutExpired:
        _kill(p.pid, "KILL")


def main() -> int:
    dev = preflight_ffmpeg()
    preflight_swift_build()
    if subprocess.run(["sudo", "-n", "true"], capture_output=True).returncode == 0:
        print("[capture] sudo credentials cached — launching with privileged SMC access")
    else:
        print("[capture] sudo not cached — launching unprivileged (some SMC sensors will report 0)")
    capture_act1(dev)
    capture_act2(dev)
    capture_act3(dev)
    capture_act4(dev)
    print("\n[capture] all 4 acts captured to promo/raw_captures/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
