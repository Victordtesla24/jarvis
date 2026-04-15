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
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.shot_list_loader import load, REPO_ROOT  # noqa: E402

# Load API keys best-effort from env files
for env_file in (REPO_ROOT / "tests" / "api_keys.env", Path.home() / ".jarvis" / ".env"):
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            val = val.strip().strip('"').strip("'")
            os.environ.setdefault(key.strip(), val)

OUT = REPO_ROOT / "promo" / "ai_shots"
STILLS = OUT / "_stills"
OUT.mkdir(parents=True, exist_ok=True)
STILLS.mkdir(parents=True, exist_ok=True)

ROUGH_MODE = os.environ.get("PROMO_MODE", "rough") == "rough"


def http_post(url: str, headers: dict, body: dict, timeout: int = 120):
    """Stdlib POST returning (status, json_or_none, raw_bytes)."""
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, method="POST", headers=headers, data=data)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            try:
                return r.status, json.loads(raw.decode()), raw
            except Exception:
                return r.status, None, raw
    except urllib.error.HTTPError as e:
        body_text = e.read()[:300].decode(errors="replace")
        return e.code, None, body_text.encode()
    except Exception as exc:
        return 0, None, str(exc).encode()


def http_get(url: str, headers: dict | None = None, timeout: int = 120):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as exc:
        return 0, str(exc).encode()


def ai_scenes() -> list[tuple[str, str, float]]:
    """Return [(out_name, prompt, duration)] for every source=='ai' scene."""
    data = load()
    result = []
    for s in data["scenes"]:
        if s["source"] != "ai":
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
        print(f"  [gemini] HTTP {status}: {raw[:200].decode(errors='replace')}")
        return False
    try:
        b64 = data["predictions"][0]["bytesBase64Encoded"]
    except (KeyError, IndexError, TypeError):
        print(f"  [gemini] unexpected response shape")
        return False
    out_png.write_bytes(base64.b64decode(b64))
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
        print(f"  [openai-img] HTTP {status}: {raw[:200].decode(errors='replace')}")
        return False
    try:
        b64 = data["data"][0]["b64_json"]
    except (KeyError, IndexError, TypeError):
        print(f"  [openai-img] unexpected response")
        return False
    out_png.write_bytes(base64.b64decode(b64))
    return True


def generate_still_synth(name: str, out_png: Path) -> bool:
    """Last-resort offline: synthesise a 16:9 cyan-on-black radial gradient."""
    # Use ffmpeg's lavfi to synthesise a 2560x1440 radial gradient frame
    if name == "intro":
        # Small bright centre dot on deep void
        filt = (
            "color=0x050A14:size=2560x1440:rate=1,"
            "drawbox=x=1270:y=710:w=20:h=20:color=0x1AE6F5:t=fill,"
            "gblur=sigma=40,"
            "gblur=sigma=20"
        )
    else:
        # Outro: blurred wide cyan halo
        filt = (
            "color=0x050A14:size=2560x1440:rate=1,"
            "drawbox=x=1180:y=620:w=200:h=200:color=0x1AE6F5:t=fill,"
            "gblur=sigma=80"
        )
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-f", "lavfi", "-i", filt,
             "-frames:v", "1",
             str(out_png)],
            check=True, capture_output=True, timeout=30,
        )
    except subprocess.CalledProcessError as exc:
        print(f"  [synth-still] ffmpeg failed: {exc.stderr.decode()[:200]}")
        return False
    return True


def ken_burns_from_still(still: Path, out_mp4: Path, duration: float) -> bool:
    """Animate a still via ffmpeg zoompan. Outputs 2560x1440 @ 30fps H.264."""
    frames = int(duration * 30)
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
             str(out_mp4)],
            check=True, capture_output=True, timeout=120,
        )
    except subprocess.CalledProcessError as exc:
        print(f"  [ken-burns] ffmpeg failed: {exc.stderr.decode()[:300]}")
        return False
    return True


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
        headers, body, timeout=120,
    )
    if status not in (200, 201) or data is None:
        print(f"  [runway] HTTP {status}: {raw[:300].decode(errors='replace')}")
        return False
    task_id = data.get("id")
    if not task_id:
        return False

    for _ in range(60):
        time.sleep(3)
        code, poll_raw = http_get(
            f"https://api.dev.runwayml.com/v1/tasks/{task_id}",
            {"Authorization": f"Bearer {key}", "X-Runway-Version": "2024-11-06"},
            timeout=30,
        )
        if code != 200:
            continue
        try:
            poll_data = json.loads(poll_raw.decode())
        except Exception:
            continue
        status = poll_data.get("status")
        if status == "SUCCEEDED":
            video_url = (poll_data.get("output") or [None])[0]
            if not video_url:
                return False
            _, raw_video = http_get(video_url, timeout=120)
            if isinstance(raw_video, bytes) and len(raw_video) > 10_000:
                tmp = out_mp4.with_suffix(".src.mp4")
                tmp.write_bytes(raw_video)
                subprocess.run(
                    ["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp),
                     "-vf", "scale=2560:1440:force_original_aspect_ratio=increase,"
                            "crop=2560:1440,fps=30",
                     "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                     "-pix_fmt", "yuv420p", "-an",
                     str(out_mp4)],
                    check=True, capture_output=True, timeout=120,
                )
                tmp.unlink(missing_ok=True)
                return True
        if status in ("FAILED", "CANCELLED"):
            print(f"  [runway] task {task_id} {status}")
            return False
    print(f"  [runway] task {task_id} timed out")
    return False


def main() -> int:
    scenes = ai_scenes()
    used: dict[str, int] = {
        "runway": 0, "ken-burns-gemini": 0, "ken-burns-openai": 0,
        "ken-burns-synth": 0, "skipped": 0, "failed": 0,
    }

    for name, prompt, duration in scenes:
        out_mp4 = OUT / f"{name}.mp4"
        if out_mp4.exists() and out_mp4.stat().st_size > 10_000:
            print(f"  ⏭  {out_mp4.name} already exists, skipping")
            used["skipped"] += 1
            continue

        print(f"  🎬  {out_mp4.name} — {prompt[:60]}…")

        # Get a reference still via provider chain
        still = STILLS / f"{name}.png"
        still_src = None
        if not still.exists():
            if generate_still_gemini(prompt, still):
                still_src = "gemini"
            elif generate_still_openai(prompt, still):
                still_src = "openai"
            elif generate_still_synth(name, still):
                still_src = "synth"
            else:
                print(f"     ❌ still generation failed for {name}")
                used["failed"] += 1
                continue
        else:
            still_src = "cached"

        print(f"     still: {still_src}")

        ok = False
        if not ROUGH_MODE and generate_runway_video(prompt, still, out_mp4, duration):
            ok = True
            used["runway"] += 1
            print(f"     ✅ via Runway Gen-3")

        if not ok and ken_burns_from_still(still, out_mp4, duration):
            ok = True
            key = f"ken-burns-{still_src}" if still_src != "cached" else "ken-burns-synth"
            used[key] = used.get(key, 0) + 1
            print(f"     ✅ via Ken-Burns zoompan")

        if not ok:
            print(f"     ❌ all providers failed for {name}")
            used["failed"] += 1

    print(f"\nAI shots summary: {used}")
    return 0 if used["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
