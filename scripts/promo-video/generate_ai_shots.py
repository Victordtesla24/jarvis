#!/usr/bin/env python3
"""scripts/promo-video/generate_ai_shots.py

Generate the two AI cinematic wrap shots (intro.mp4, outro.mp4).
Provider chain per shot:
  1. Runway Gen-3 Alpha Turbo image-to-video (polish mode only, needs a still)
  2. ffmpeg Ken-Burns zoompan on a Gemini Imagen / OpenAI still
  3. ffmpeg zoompan on a synthesised gradient still (last-resort offline)

Idempotent: skips shots whose .mp4 already exists.
"""
from __future__ import annotations
import argparse
import base64
import json
import logging
import os
import random
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Optional

sys.path.insert(0, str(Path(__file__).parent))
from lib.shot_list_loader import load, REPO_ROOT  # noqa: E402

# R-12: single canonical API-key location.
ENV_FILE = Path.home() / ".jarvis" / ".env"
if ENV_FILE.exists():
    for _line in ENV_FILE.read_text().splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _k, _, _v = _line.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

LOG = logging.getLogger("generate_ai_shots")

OUT_DEFAULT = REPO_ROOT / "promo" / "ai_shots"

# R-38: outbound URLs must resolve to these hosts.
RUNWAY_ALLOWED_HOSTS = (".runwayml.com", ".prod.runwayml.com")

ROUGH_MODE_DEFAULT = os.environ.get("PROMO_MODE", "rough") == "rough"

# R-58: exponential backoff ceiling for Runway poll.
RUNWAY_MAX_WAIT = int(os.environ.get("RUNWAY_MAX_WAIT", "600"))

HttpError = (
    urllib.error.URLError,
    json.JSONDecodeError,
    UnicodeDecodeError,
    TimeoutError,
    OSError,
)


def http_post(url: str,
              headers: dict[str, str],
              body: dict[str, Any],
              connect_timeout: int = 5,
              read_timeout: int = 120,
              ) -> tuple[int, Optional[dict[str, Any]], bytes]:
    """Stdlib POST returning (status, json_or_none, raw_bytes). R-59."""
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, method="POST", headers=headers, data=data)
    # urllib only accepts a single timeout; use the larger (read) bound.
    timeout = max(connect_timeout, read_timeout)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            try:
                return r.status, json.loads(raw.decode()), raw
            except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                LOG.warning("http_post decode failed: %s", exc)
                return r.status, None, raw
    except urllib.error.HTTPError as e:
        body_text = e.read()[:300].decode(errors="replace")
        return e.code, None, body_text.encode()
    except HttpError as exc:
        LOG.warning("http_post error: %s", exc)
        return 0, None, str(exc).encode()


def http_get(url: str,
             headers: Optional[dict[str, str]] = None,
             connect_timeout: int = 5,
             read_timeout: int = 120,
             ) -> tuple[int, bytes]:
    """Stdlib GET returning (status, raw_bytes). R-59."""
    req = urllib.request.Request(url, headers=headers or {})
    timeout = max(connect_timeout, read_timeout)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except HttpError as exc:
        LOG.warning("http_get error: %s", exc)
        return 0, str(exc).encode()


def _runway_url_is_safe(url: str) -> bool:
    """R-38: https + hostname allowlist for any URL we download blob from."""
    if not isinstance(url, str) or not url.startswith("https://"):
        return False
    host = urllib.parse.urlparse(url).hostname
    if host is None:
        return False
    return any(host == h.lstrip(".") or host.endswith(h)
               for h in RUNWAY_ALLOWED_HOSTS)


def ai_scenes(act: Optional[int] = None) -> list[tuple[str, str, float]]:
    """Return [(out_name, prompt, duration)] for every source=='ai' scene."""
    data = load()
    result = []
    for s in data["scenes"]:
        if s["source"] != "ai":
            continue
        if act is not None and s.get("act") != act:
            continue
        name = "intro" if s["id"] == "s01_intro" else "outro"
        result.append((name, s["ai_prompt"], float(s["duration"])))
    return result


def generate_still_gemini(prompt: str, out_png: Path) -> bool:
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return False
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"imagen-3.0-generate-001:predict?key={key}"
    )
    status, data, raw = http_post(url, {"Content-Type": "application/json"}, {
        "instances": [{"prompt": prompt}],
        "parameters": {"aspectRatio": "16:9", "sampleCount": 1},
    })
    if status != 200 or data is None:
        LOG.warning("gemini HTTP %s: %s", status, raw[:200].decode(errors="replace"))
        return False
    try:
        b64 = data["predictions"][0]["bytesBase64Encoded"]
    except (KeyError, IndexError, TypeError):
        LOG.warning("gemini unexpected response shape")
        return False
    # R-34: atomic write.
    tmp = out_png.with_suffix(out_png.suffix + ".tmp")
    try:
        tmp.write_bytes(base64.b64decode(b64))
        tmp.replace(out_png)
    except (OSError, ValueError):
        tmp.unlink(missing_ok=True)
        raise
    return True


def generate_still_openai(prompt: str, out_png: Path) -> bool:
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key.startswith("sk-"):
        return False
    status, data, raw = http_post(
        "https://api.openai.com/v1/images/generations",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        {
            "model": "gpt-image-1",
            "prompt": prompt,
            "size": "1536x1024",
            "n": 1,
        },
    )
    if status != 200 or data is None:
        LOG.warning("openai-img HTTP %s: %s",
                    status, raw[:200].decode(errors="replace"))
        return False
    try:
        b64 = data["data"][0]["b64_json"]
    except (KeyError, IndexError, TypeError):
        LOG.warning("openai-img unexpected response shape")
        return False
    tmp = out_png.with_suffix(out_png.suffix + ".tmp")
    try:
        tmp.write_bytes(base64.b64decode(b64))
        tmp.replace(out_png)
    except (OSError, ValueError):
        tmp.unlink(missing_ok=True)
        raise
    return True


def generate_still_synth(name: str, out_png: Path) -> bool:
    """Last-resort offline: synthesise a 16:9 cyan-on-black radial gradient."""
    if name == "intro":
        filt = (
            "color=0x050A14:size=2560x1440:rate=1,"
            "drawbox=x=1270:y=710:w=20:h=20:color=0x1AE6F5:t=fill,"
            "gblur=sigma=40,"
            "gblur=sigma=20"
        )
    else:
        filt = (
            "color=0x050A14:size=2560x1440:rate=1,"
            "drawbox=x=1180:y=620:w=200:h=200:color=0x1AE6F5:t=fill,"
            "gblur=sigma=80"
        )
    tmp = out_png.with_suffix(out_png.suffix + ".tmp")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-f", "lavfi", "-i", filt,
             "-frames:v", "1",
             str(tmp)],
            check=True, capture_output=True, timeout=30,
        )
        tmp.replace(out_png)
        return True
    except subprocess.CalledProcessError as exc:
        tmp.unlink(missing_ok=True)
        stderr = (exc.stderr or b"").decode(errors="replace")
        LOG.warning("synth-still ffmpeg failed: %s", stderr[:200])
        return False


def ken_burns_from_still(still: Path, out_mp4: Path, duration: float) -> bool:
    """Animate a still via ffmpeg zoompan. Outputs 2560x1440 @ 30fps H.264."""
    frames = int(duration * 30)
    tmp = out_mp4.with_suffix(out_mp4.suffix + ".tmp")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-loop", "1", "-i", str(still),
             "-vf",
             f"scale=3840:2160:force_original_aspect_ratio=increase,"
             f"zoompan=z='zoom+0.0008':d={frames}:s=2560x1440:fps=30,"
             f"format=yuv420p",
             "-t", f"{duration}",
             "-c:v", "libx264", "-preset", "medium", "-crf", "18",
             "-pix_fmt", "yuv420p", "-r", "30",
             str(tmp)],
            check=True, capture_output=True, timeout=120,
        )
        tmp.replace(out_mp4)
        return True
    except subprocess.CalledProcessError as exc:
        tmp.unlink(missing_ok=True)
        stderr = (exc.stderr or b"").decode(errors="replace")
        LOG.warning("ken-burns ffmpeg failed: %s", stderr[:300])
        return False


def generate_runway_video(prompt: str, still: Path, out_mp4: Path,
                          duration: float) -> bool:
    key = os.environ.get("RUNWAY_API_KEY", "")
    if not key.startswith("key_"):
        return False

    img_b64 = base64.b64encode(still.read_bytes()).decode()
    data_url = f"data:image/png;base64,{img_b64}"

    headers = {
        "Authorization": f"Bearer {key}",
        "X-Runway-Version": "2024-11-06",
        "Content-Type": "application/json",
    }
    body = {
        "promptImage": data_url,
        "model": "gen3a_turbo",
        "promptText": prompt,
        "duration": 5 if duration <= 5 else 10,
        "ratio": "1280:768",
    }
    status, data, raw = http_post(
        "https://api.dev.runwayml.com/v1/image_to_video",
        headers, body, connect_timeout=5, read_timeout=120,
    )
    if status not in (200, 201) or data is None:
        LOG.warning("runway HTTP %s: %s",
                    status, raw[:300].decode(errors="replace"))
        return False
    task_id = data.get("id")
    if not task_id:
        return False

    # R-58: exponential backoff (3s -> 30s, jittered) bounded by RUNWAY_MAX_WAIT.
    waited = 0.0
    delay = 3.0
    while waited < RUNWAY_MAX_WAIT:
        time.sleep(delay)
        waited += delay
        delay = min(30.0, delay * 1.4) + random.uniform(0.0, 1.0)

        code, poll_raw = http_get(
            f"https://api.dev.runwayml.com/v1/tasks/{task_id}",
            {"Authorization": f"Bearer {key}", "X-Runway-Version": "2024-11-06"},
            connect_timeout=5, read_timeout=30,
        )
        if code != 200:
            continue
        try:
            poll_data = json.loads(poll_raw.decode())
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            LOG.warning("runway poll decode: %s", exc)
            continue
        task_status = poll_data.get("status")
        if task_status == "SUCCEEDED":
            video_url = (poll_data.get("output") or [None])[0]
            # R-38: https + hostname allowlist.
            if not _runway_url_is_safe(video_url):
                LOG.error("runway returned non-allowlisted URL: %r", video_url)
                return False
            _, raw_video = http_get(
                video_url, connect_timeout=5, read_timeout=120)
            if not isinstance(raw_video, bytes) or len(raw_video) < 10_000:
                return False
            tmp_src = out_mp4.with_suffix(".src.mp4")
            tmp_out = out_mp4.with_suffix(out_mp4.suffix + ".tmp")
            tmp_src.write_bytes(raw_video)
            try:
                subprocess.run(
                    ["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp_src),
                     "-vf", "scale=2560:1440:force_original_aspect_ratio=increase,"
                            "crop=2560:1440,fps=30",
                     "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                     "-pix_fmt", "yuv420p", "-an",
                     str(tmp_out)],
                    check=True, capture_output=True, timeout=120,
                )
                tmp_out.replace(out_mp4)
                return True
            except subprocess.CalledProcessError as exc:
                # R-39: clean up tmp files on encode failure.
                tmp_out.unlink(missing_ok=True)
                stderr = (exc.stderr or b"").decode(errors="replace")
                LOG.warning("runway post-ffmpeg failed: %s", stderr[:300])
                return False
            finally:
                tmp_src.unlink(missing_ok=True)
        if task_status in ("FAILED", "CANCELLED"):
            LOG.warning("runway task %s %s", task_id, task_status)
            return False
    LOG.warning("runway task %s timed out after %.0fs", task_id, waited)
    return False


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate JARVIS promo AI shots (intro + outro)")
    p.add_argument("--act", type=int, choices=[1, 2, 3, 4], default=None,
                   help="Only generate AI scenes belonging to this act.")
    p.add_argument("--out-dir", type=Path, default=OUT_DEFAULT,
                   help=f"Output directory (default: {OUT_DEFAULT})")
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
    out_dir: Path = args.out_dir
    stills = out_dir / "_stills"
    out_dir.mkdir(parents=True, exist_ok=True)
    stills.mkdir(parents=True, exist_ok=True)

    rough_mode = ROUGH_MODE_DEFAULT

    scenes = ai_scenes(act=args.act)
    used = {
        "runway": 0, "ken-burns-gemini": 0, "ken-burns-openai": 0,
        "ken-burns-synth": 0, "skipped": 0, "failed": 0,
    }

    for name, prompt, duration in scenes:
        out_mp4 = out_dir / f"{name}.mp4"
        if out_mp4.exists() and out_mp4.stat().st_size > 10_000:
            LOG.info("skip %s", out_mp4.name)
            used["skipped"] += 1
            continue

        LOG.info("%s: %s", out_mp4.name, prompt[:60])

        still = stills / f"{name}.png"
        still_src = None
        if not still.exists():
            if generate_still_gemini(prompt, still):
                still_src = "gemini"
            elif generate_still_openai(prompt, still):
                still_src = "openai"
            elif generate_still_synth(name, still):
                still_src = "synth"
            else:
                LOG.error("still generation failed for %s", name)
                used["failed"] += 1
                continue
        else:
            still_src = "cached"

        ok = False
        if not rough_mode and generate_runway_video(prompt, still, out_mp4, duration):
            ok = True
            used["runway"] += 1

        if not ok and ken_burns_from_still(still, out_mp4, duration):
            ok = True
            key = f"ken-burns-{still_src}" if still_src != "cached" else "ken-burns-synth"
            used[key] = used.get(key, 0) + 1

        if not ok:
            LOG.error("all providers failed for %s", name)
            used["failed"] += 1

    LOG.info("AI shots summary: %s", used)
    return 0 if used["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
