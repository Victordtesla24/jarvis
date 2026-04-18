"""
tests/lib/visual_lib.py — shared utilities for the JARVIS validation harness.

Provides:
- capture_jarvis_window(label) -> Path (preferred; wallpaper-layer aware)
- capture_screen(label) -> Path (fallback, full-display)
- capture_many_window(label, n, delay) -> list[Path]
- pixel_color_ratio(path, rgb, tol) -> float
- frame_motion_score(paths) -> float
- run_daemon_samples(daemon_path, n) -> list[dict]
- ClaudeVision.analyse(image_path, question, rubric) -> dict
- read_pid() / write_pid() helpers
- ProcessStats(pid) -> rss_mb, cpu_pct

Vision analysis uses Anthropic's Claude API via the anthropic SDK.
"""

from __future__ import annotations

import contextlib
import datetime
import json
import os
import signal
import socket
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image

# The google-generativeai SDK silently ignores `request_options={"timeout":...}`,
# so we enforce a socket-level floor and a SIGALRM hard deadline per call.
# SIGALRM actually interrupts blocking syscalls on the main thread, which is
# the only reliable way to bail out of a stuck Gemini request without leaking
# stuck worker threads via concurrent.futures.
socket.setdefaulttimeout(30.0)
GEMINI_WALLCLOCK_TIMEOUT_S = 35


class _AlarmTimeout(Exception):
    pass


@contextlib.contextmanager
def _alarm_timeout(seconds: int):
    """Raise _AlarmTimeout if the guarded block runs past `seconds` seconds.

    Only works on the main thread of the main interpreter (SIGALRM limitation).
    Restores the previous handler and cancels the alarm on exit.
    """
    if seconds <= 0:
        yield
        return

    def _handler(signum, frame):  # noqa: ARG001
        raise _AlarmTimeout(f"timed out after {seconds}s")

    prev = signal.signal(signal.SIGALRM, _handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, prev)

# Lazy-import Quartz only if available; fall back to screencapture if not.
try:
    import Quartz  # type: ignore
    import objc  # type: ignore  # noqa: F401
    _HAVE_QUARTZ = True
except ImportError:
    _HAVE_QUARTZ = False

REPO_ROOT = Path(
    os.environ.get(
        "REPO_ROOT",
        "/Users/vic/claude/General-Work/jarvis/jarvis-build",
    )
)
CAPTURE_DIR = REPO_ROOT / "tests" / "output" / "captures"
PID_FILE = Path("/tmp/jarvis_validation.pid")

PALETTE = {
    "cyan":       (0x00, 0xD4, 0xFF),
    "amber":      (0xFF, 0xC8, 0x00),
    "crimson":    (0xFF, 0x26, 0x33),
    "steel":      (0x66, 0x84, 0x94),
    "background": (0x05, 0x0A, 0x14),
}


# ---------- filesystem helpers ------------------------------------------------


def ensure_capture_dir() -> Path:
    CAPTURE_DIR.mkdir(parents=True, exist_ok=True)
    return CAPTURE_DIR


def now_tag() -> str:
    return datetime.datetime.now().strftime("%Y%m%dT%H%M%S")


# ---------- PID helpers -------------------------------------------------------


def write_pid(pid: int) -> None:
    PID_FILE.write_text(str(pid))


def read_pid() -> int | None:
    if not PID_FILE.exists():
        return None
    try:
        return int(PID_FILE.read_text().strip())
    except ValueError:
        return None


def process_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False


# ---------- screen capture ----------------------------------------------------


def capture_screen(label: str) -> Path:
    """Capture the main display as PNG via macOS `screencapture -x`.

    This grabs the composited top surface — i.e. whatever the user sees,
    including every foreground window. Not useful for validating a
    wallpaper-level HUD that is covered by other apps. Use
    capture_jarvis_window() instead unless you actually want the full desktop.
    """
    ensure_capture_dir()
    path = CAPTURE_DIR / f"{label}_{now_tag()}.png"
    subprocess.run(
        ["screencapture", "-x", str(path)],
        check=True,
        timeout=15,
    )
    if not path.exists() or path.stat().st_size == 0:
        raise RuntimeError(f"screencapture produced no data: {path}")
    return path


def _find_jarvis_windows(owner_name: str = "JarvisTelemetry") -> list[dict]:
    """Return Quartz window-info dicts for all JARVIS windows on-screen."""
    if not _HAVE_QUARTZ:
        return []
    options = (
        Quartz.kCGWindowListOptionAll
        | Quartz.kCGWindowListOptionOnScreenOnly
    )
    infos = Quartz.CGWindowListCopyWindowInfo(options, Quartz.kCGNullWindowID) or []
    return [
        dict(info)
        for info in infos
        if info.get("kCGWindowOwnerName") == owner_name
    ]


def capture_jarvis_window(label: str, owner_name: str = "JarvisTelemetry") -> Path:
    """Capture the JARVIS HUD window(s) directly, bypassing top-of-stack.

    Uses CGWindowListCreateImage with kCGWindowListOptionIncludingWindow so the
    image reflects what that specific window is rendering, even if foreground
    apps cover it. If multiple JARVIS windows exist (one per display), the
    largest one is used. Falls back to screencapture when Quartz is absent.
    """
    ensure_capture_dir()
    if not _HAVE_QUARTZ:
        return capture_screen(label)

    windows = _find_jarvis_windows(owner_name)
    if not windows:
        # App not running or window not created yet; caller decides what to do.
        raise RuntimeError(f"No on-screen window owned by '{owner_name}' found")

    def window_area(w: dict) -> float:
        bounds = w.get("kCGWindowBounds") or {}
        return float(bounds.get("Width", 0)) * float(bounds.get("Height", 0))

    target = max(windows, key=window_area)
    window_id = int(target["kCGWindowNumber"])

    cg_image = Quartz.CGWindowListCreateImage(
        Quartz.CGRectNull,
        Quartz.kCGWindowListOptionIncludingWindow,
        window_id,
        Quartz.kCGWindowImageBoundsIgnoreFraming
        | Quartz.kCGWindowImageBestResolution,
    )
    if cg_image is None:
        raise RuntimeError(
            f"CGWindowListCreateImage returned None for window id {window_id}"
        )

    path = CAPTURE_DIR / f"{label}_{now_tag()}.png"
    # Write PNG via CoreGraphics destination.
    url = Quartz.CFURLCreateWithFileSystemPath(
        None, str(path), Quartz.kCFURLPOSIXPathStyle, False
    )
    dest = Quartz.CGImageDestinationCreateWithURL(
        url, "public.png", 1, None
    )
    if dest is None:
        raise RuntimeError(f"CGImageDestinationCreateWithURL failed for {path}")
    Quartz.CGImageDestinationAddImage(dest, cg_image, None)
    if not Quartz.CGImageDestinationFinalize(dest):
        raise RuntimeError(f"CGImageDestinationFinalize failed for {path}")

    if not path.exists() or path.stat().st_size == 0:
        raise RuntimeError(f"Quartz capture produced no data: {path}")
    return path


def capture_many(label: str, n: int, delay: float, *, use_window: bool = True) -> list[Path]:
    out: list[Path] = []
    grab = capture_jarvis_window if (use_window and _HAVE_QUARTZ) else capture_screen
    for i in range(n):
        out.append(grab(f"{label}_{i:03d}"))
        if i < n - 1:
            time.sleep(delay)
    return out


# ---------- pixel analysis ----------------------------------------------------


def load_rgb(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"))


def pixel_color_ratio(path: Path, rgb: tuple[int, int, int], tol: int = 12) -> float:
    """Fraction of pixels within `tol` per-channel of the target colour."""
    arr = load_rgb(path)
    r, g, b = rgb
    mask = (
        (np.abs(arr[:, :, 0].astype(int) - r) <= tol)
        & (np.abs(arr[:, :, 1].astype(int) - g) <= tol)
        & (np.abs(arr[:, :, 2].astype(int) - b) <= tol)
    )
    return float(mask.sum()) / float(mask.size)


def _rgb_to_hsv(rgb: np.ndarray) -> np.ndarray:
    """Vectorised RGB[0..255] -> HSV[0..1] conversion (H in 0..1)."""
    rgbf = rgb.astype(np.float32) / 255.0
    r, g, b = rgbf[..., 0], rgbf[..., 1], rgbf[..., 2]
    maxc = np.max(rgbf, axis=-1)
    minc = np.min(rgbf, axis=-1)
    v = maxc
    delta = maxc - minc
    s = np.where(maxc > 1e-6, delta / np.maximum(maxc, 1e-6), 0.0)
    # Hue calculation
    rc = np.where(delta > 1e-6, (maxc - r) / np.maximum(delta, 1e-6), 0.0)
    gc = np.where(delta > 1e-6, (maxc - g) / np.maximum(delta, 1e-6), 0.0)
    bc = np.where(delta > 1e-6, (maxc - b) / np.maximum(delta, 1e-6), 0.0)
    h = np.where(r == maxc, bc - gc, np.where(g == maxc, 2.0 + rc - bc, 4.0 + gc - rc))
    h = (h / 6.0) % 1.0
    return np.stack([h, s, v], axis=-1)


def hue_family_ratio(
    path: Path,
    hue_range: tuple[float, float],
    min_saturation: float = 0.35,
    min_value: float = 0.25,
) -> float:
    """Fraction of pixels whose HSV hue lies in [hue_range] with enough sat/val.

    Hue is normalised 0..1 (i.e. degrees / 360). For cyan use (0.45, 0.58),
    for amber/orange use (0.08, 0.14), for red/crimson use two ranges or
    wrap-around; the caller combines as needed. This is far more robust than
    exact-RGB matching against anti-aliased gradient rings.
    """
    rgb = load_rgb(path)
    hsv = _rgb_to_hsv(rgb)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    lo, hi = hue_range
    if lo <= hi:
        hue_mask = (h >= lo) & (h <= hi)
    else:  # wrap-around (e.g. red near 0)
        hue_mask = (h >= lo) | (h <= hi)
    mask = hue_mask & (s >= min_saturation) & (v >= min_value)
    return float(mask.sum()) / float(mask.size)


def frame_motion_score(paths: Iterable[Path]) -> float:
    """Average per-pixel absolute diff between consecutive frames (0..255)."""
    frames = [load_rgb(p).astype(np.int16) for p in paths]
    if len(frames) < 2:
        return 0.0
    diffs = [
        float(np.mean(np.abs(frames[i] - frames[i - 1])))
        for i in range(1, len(frames))
    ]
    return sum(diffs) / len(diffs)


# ---------- daemon helpers ----------------------------------------------------


def run_daemon_samples(
    daemon_path: Path,
    n: int = 3,
    timeout: int = 15,
    interval_ms: int = 1000,
) -> list[dict]:
    """Run the Go daemon in headless mode and return parsed samples.

    The daemon emits a single JSON array like `[{...},{...}]`, so parse the
    full stdout as JSON first. Fall back to NDJSON in case the format changes.
    `interval_ms` is forwarded as --interval so the cadence test measures the
    same 1 Hz mode the Swift frontend consumes, not the daemon's internal default.
    """
    proc = subprocess.run(
        [
            str(daemon_path),
            "--headless",
            "--count",
            str(n),
            "--interval",
            str(interval_ms),
        ],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    raw = proc.stdout.strip()
    if not raw:
        return []

    try:
        doc = json.loads(raw)
        if isinstance(doc, list):
            return [x for x in doc if isinstance(x, dict)]
        if isinstance(doc, dict):
            return [doc]
    except json.JSONDecodeError:
        pass

    samples: list[dict] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or not line.startswith("{"):
            continue
        try:
            samples.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return samples


def daemon_sample_cadence_ms(
    daemon_path: Path,
    interval_ms: int = 1000,
    warmup_samples: int = 0,
    measured_samples: int = 3,
    overall_timeout_s: int = 30,
) -> float | None:
    """Measure steady-state sample cadence from the daemon's own timestamps.

    Uses `--headless --count N` which emits a single JSON array of N samples
    at the end of the run. Warmup is treated as zero by default because the
    daemon's internal IOReport warmup happens before the first emitted sample,
    so samples in the array are already post-warmup.
    """
    import datetime

    n = max(2, warmup_samples + measured_samples)
    samples = run_daemon_samples(
        daemon_path, n=n, timeout=overall_timeout_s, interval_ms=interval_ms
    )
    if len(samples) < warmup_samples + 2:
        return None

    steady = samples[warmup_samples:]
    deltas: list[float] = []
    prev_ts: datetime.datetime | None = None
    for s in steady:
        ts_str = s.get("timestamp")
        if not ts_str:
            continue
        try:
            ts = datetime.datetime.fromisoformat(ts_str)
        except ValueError:
            continue
        if prev_ts is not None:
            deltas.append((ts - prev_ts).total_seconds() * 1000.0)
        prev_ts = ts

    if not deltas:
        return None
    deltas.sort()
    return deltas[len(deltas) // 2]


# ---------- process stats -----------------------------------------------------


@dataclass
class ProcessStats:
    pid: int
    rss_mb: float
    cpu_pct: float

    @classmethod
    def sample(cls, pid: int) -> "ProcessStats | None":
        try:
            out = subprocess.run(
                ["ps", "-p", str(pid), "-o", "rss=,pcpu="],
                capture_output=True,
                text=True,
                check=True,
            ).stdout.strip()
        except subprocess.CalledProcessError:
            return None
        if not out:
            return None
        parts = out.split()
        if len(parts) < 2:
            return None
        return cls(pid=pid, rss_mb=int(parts[0]) / 1024.0, cpu_pct=float(parts[1]))


# ---------- Claude vision -----------------------------------------------------


class ClaudeVision:
    """Vision helper backed by Anthropic's Claude API.

    Tries a short list of Claude vision-capable models starting with the
    fastest (Haiku) and falling back to Sonnet on error. Each call gets a
    SIGALRM-enforced hard deadline to prevent harness hangs.
    """

    CANDIDATES = (
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-5-20250929",
        "claude-sonnet-4-6",
        "claude-3-5-sonnet-20241022",
    )

    def __init__(self, model_name: str | None = None) -> None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        import anthropic

        self._client = anthropic.Anthropic(api_key=api_key, timeout=60.0)
        self._candidates = [model_name] if model_name else list(self.CANDIDATES)
        self._idx = 0
        self.model_name = self._candidates[0]

    def _advance_model(self) -> bool:
        self._idx += 1
        if self._idx >= len(self._candidates):
            return False
        self.model_name = self._candidates[self._idx]
        return True

    def _encode_image(self, image_path: Path) -> tuple[str, str]:
        """Return (media_type, base64_data) for a resized JPEG of the image."""
        pil = Image.open(image_path).convert("RGB")
        max_width = 1024
        if pil.width > max_width:
            new_h = int(pil.height * (max_width / pil.width))
            pil = pil.resize((max_width, new_h), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        pil.save(buf, format="JPEG", quality=80, optimize=True)
        return "image/jpeg", base64.standard_b64encode(buf.getvalue()).decode("ascii")

    def _call(self, image_path: Path, prompt: str) -> str:
        media_type, b64_data = self._encode_image(image_path)
        with _alarm_timeout(CLAUDE_WALLCLOCK_TIMEOUT_S):
            message = self._client.messages.create(
                model=self.model_name,
                max_tokens=400,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": b64_data,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }],
            )
        # Extract text from the first text block in the response.
        for block in message.content:
            text = getattr(block, "text", None)
            if text:
                return text
        return ""

    def analyse(self, image_path: Path, question: str, rubric: str) -> dict:
        """Ask Claude a single yes/no question about the image.

        Returns a dict with keys: passed (bool), confidence (0..1), reason (str).
        """
        prompt = (
            "You are a strict QA reviewer inspecting a screenshot of a macOS "
            "Iron Man JARVIS-style HUD desktop wallpaper. Answer the following "
            "question as precisely as you can.\n\n"
            f"QUESTION: {question}\n\n"
            f"PASS CRITERIA: {rubric}\n\n"
            "Return ONLY a single JSON object in this exact shape, no prose: "
            '{"passed": true|false, "confidence": 0.0..1.0, '
            '"reason": "short sentence"}'
        )

        text = ""
        last_error: Exception | None = None
        while True:
            try:
                text = self._call(image_path, prompt).strip()
                break
            except _AlarmTimeout:
                last_error = RuntimeError(
                    f"claude timeout ({self.model_name} > {CLAUDE_WALLCLOCK_TIMEOUT_S}s)"
                )
                if self._advance_model():
                    continue
                return {"passed": False, "confidence": 0.0, "reason": str(last_error)}
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                msg = str(exc).lower()
                if any(tok in msg for tok in ("404", "not found", "does not exist", "model")):
                    if self._advance_model():
                        continue
                return {
                    "passed": False,
                    "confidence": 0.0,
                    "reason": f"claude error ({self.model_name}): {exc}",
                }

        if not text:
            return {"passed": False, "confidence": 0.0, "reason": "empty response"}

        # Claude should return strict JSON, but tolerate wrapping in markdown
        # fences or explanatory prose as a safety net.
        parsed = None
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1:
                try:
                    parsed = json.loads(text[start : end + 1])
                except json.JSONDecodeError:
                    pass

        if not isinstance(parsed, dict):
            return {"passed": False, "confidence": 0.0, "reason": f"bad json: {text[:120]}"}

        return {
            "passed": bool(parsed.get("passed", False)),
            "confidence": float(parsed.get("confidence", 0.0)),
            "reason": str(parsed.get("reason", ""))[:300],
        }
