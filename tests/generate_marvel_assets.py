#!/usr/bin/env python3
"""
JARVIS Marvel Studios Asset Generator
Multi-provider fallback: Runway → OpenAI → OpenRouter → Replicate → Stability
Load tests/api_keys.env or ~/.jarvis/.env for credentials.
"""
import os, sys, time, json, base64, requests
from pathlib import Path
from dotenv import load_dotenv

# Load keys — api_keys.env takes priority over ~/.jarvis/.env
load_dotenv(Path(__file__).parent / "api_keys.env", override=True)
load_dotenv(Path.home() / ".jarvis/.env")

OUT = Path(__file__).parent / "output/marvel"
OUT.mkdir(parents=True, exist_ok=True)

SHOTS = [
    ("jarvis_boot",
     "Iron Man JARVIS HUD booting sequence, arc reactor core igniting, "
     "cyan plasma rings expanding outward, amber P-core arcs sweeping to 100%, "
     "deep space black background, Marvel Studios cinematic lighting, 8K"),
    ("jarvis_nominal",
     "Full-screen JARVIS holographic telemetry HUD, concentric cyan rings, "
     "central arc reactor glowing white-blue, amber GPU arc, side panels "
     "showing UNIFIED MEMORY 16GB MAPPED and THERMAL NOMINAL, Marvel quality"),
    ("jarvis_lockscreen",
     "JARVIS lock screen state, large cyan circular dial '1.2', rotating outer "
     "ring, holographic side widgets with clock, deep blue-black, Iron Man HUD"),
    ("jarvis_shutdown",
     "JARVIS HUD shutdown, arc reactor rings collapsing inward, cyan plasma "
     "dissolving to black, final white core pulse, Marvel Studios VFX"),
]

VIDEO_PROMPT = (
    "JARVIS Iron Man HUD arc reactor animation loop, cyan rings pulsing, "
    "amber telemetry arcs sweeping live data, central reactor breathing, "
    "holographic panels flickering, Marvel quality, seamless 8s loop, "
    "cinematic black background"
)

# ── Provider implementations ───────────────────────────────────────

def try_runway(shots, out_dir):
    key = os.getenv("RUNWAY_API_KEY", "")
    if not key.startswith("key_"):
        return False, "no valid RUNWAY_API_KEY (must start with key_)"
    headers = {"Authorization": f"Bearer {key}", "X-Runway-Version": "2024-11-06"}
    for name, prompt in shots:
        r = requests.post("https://api.dev.runwayml.com/v1/text_to_image",
            headers=headers,
            json={"promptText": prompt, "model": "gen4_image",
                  "ratio": "1920:1080"},
            timeout=120)
        if r.status_code != 200:
            return False, f"Runway HTTP {r.status_code}: {r.text[:200]}"
        task_id = r.json()["id"]
        for _ in range(60):
            time.sleep(3)
            poll = requests.get(f"https://api.dev.runwayml.com/v1/tasks/{task_id}",
                                headers=headers, timeout=30)
            data = poll.json()
            if data.get("status") == "SUCCEEDED":
                img_url = data["output"][0]
                img_bytes = requests.get(img_url, timeout=60).content
                (out_dir / f"{name}.png").write_bytes(img_bytes)
                print(f"  ✅ {name}.png via Runway")
                break
            if data.get("status") in ("FAILED", "CANCELLED"):
                return False, f"Runway task {task_id} status={data.get('status')}"
        else:
            return False, f"Runway task {task_id} timed out"
    return True, "runway"

def try_openai(shots, out_dir):
    """Try each image model the project has access to, stopping on first one
    that accepts a generate call. Stays within the single OpenAI provider
    branch — no cross-provider fallback here.
    """
    key = os.getenv("OPENAI_API_KEY", "")
    if not key.startswith("sk-"):
        return False, "no valid OPENAI_API_KEY"
    try:
        import openai
    except ImportError:
        return False, "openai package not installed"

    client = openai.OpenAI(api_key=key)

    # gpt-image-1 is the current-generation model; dall-e-3 and dall-e-2 are
    # fallbacks for projects without gpt-image-1 access.
    model_trials: list[tuple[str, dict]] = [
        ("gpt-image-1", {"size": "1536x1024", "quality": "high"}),
        ("dall-e-3",    {"size": "1792x1024", "quality": "hd", "response_format": "b64_json"}),
        ("dall-e-2",    {"size": "1024x1024", "response_format": "b64_json"}),
    ]

    working_model = None
    working_extra: dict = {}
    for model, extra in model_trials:
        try:
            probe = client.images.generate(
                model=model, prompt="a single black square", n=1, **extra
            )
            _ = probe.data[0]  # force attribute access
            working_model = model
            working_extra = extra
            print(f"  [openai] model probe ok: {model}")
            break
        except Exception as exc:  # noqa: BLE001
            msg = str(exc)[:160]
            print(f"  [openai] model probe failed for {model}: {msg}")
            continue

    if working_model is None:
        return False, "OpenAI project has no accessible image model"

    for name, prompt in shots:
        try:
            resp = client.images.generate(
                model=working_model, prompt=prompt, n=1, **working_extra
            )
            datum = resp.data[0]
            if getattr(datum, "b64_json", None):
                img_bytes = base64.b64decode(datum.b64_json)
            elif getattr(datum, "url", None):
                img_bytes = requests.get(datum.url, timeout=60).content
            else:
                raise RuntimeError("neither b64_json nor url present in OpenAI response")
            (out_dir / f"{name}.png").write_bytes(img_bytes)
            print(f"  ✅ {name}.png via OpenAI {working_model}")
        except Exception as exc:  # noqa: BLE001
            return False, f"OpenAI {working_model} failed for {name}: {exc}"
    return True, f"openai/{working_model}"

def try_openrouter(shots, out_dir):
    """OpenRouter exposes image generation via /chat/completions with a
    multimodal model (e.g. google/gemini-2.5-flash-image-preview). The
    model returns images inline in assistant message parts; we decode any
    data URL or fetch any http URL we find.
    """
    key = os.getenv("OPENROUTER_API_KEY", "")
    if not key.startswith("sk-or-"):
        return False, "no valid OPENROUTER_API_KEY"

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/Victordtesla24/jarvis",
        "X-Title": "JARVIS Marvel Harness",
    }

    # Ordered by likelihood of giving us an image output. The first that
    # returns HTTP 200 with a decodable image is kept for the rest of the shots.
    model_trials = [
        "google/gemini-2.5-flash-image-preview",
        "google/gemini-2.5-flash-image",
        "google/gemini-2.0-flash-exp:free",
    ]

    def _extract_image_bytes(resp_json) -> bytes | None:
        try:
            choice = resp_json["choices"][0]
            msg = choice.get("message") or {}
        except (KeyError, IndexError, TypeError):
            return None
        # OpenRouter returns images either in message.images[] or inside
        # message.content as a list of parts; handle both.
        images = msg.get("images") or []
        for img in images:
            src = img.get("image_url") or img
            if isinstance(src, dict):
                src = src.get("url") or ""
            if not isinstance(src, str):
                continue
            if src.startswith("data:"):
                b64 = src.split(",", 1)[-1]
                return base64.b64decode(b64)
            if src.startswith("http"):
                return requests.get(src, timeout=60).content
        content = msg.get("content")
        if isinstance(content, list):
            for part in content:
                if not isinstance(part, dict):
                    continue
                if part.get("type") in ("image_url", "image"):
                    src = part.get("image_url") or {}
                    if isinstance(src, dict):
                        src = src.get("url") or ""
                    if isinstance(src, str) and src.startswith("data:"):
                        return base64.b64decode(src.split(",", 1)[-1])
                    if isinstance(src, str) and src.startswith("http"):
                        return requests.get(src, timeout=60).content
        return None

    working_model = None
    for model in model_trials:
        try:
            r = requests.post(
                url, headers=headers, timeout=120,
                json={
                    "model": model,
                    "modalities": ["image", "text"],
                    "messages": [{
                        "role": "user",
                        "content": "a single black square, png, no text",
                    }],
                },
            )
        except Exception as exc:  # noqa: BLE001
            print(f"  [openrouter] probe {model} network error: {exc}")
            continue
        if r.status_code != 200:
            print(f"  [openrouter] probe {model} HTTP {r.status_code}: {r.text[:160]}")
            continue
        if _extract_image_bytes(r.json()) is None:
            print(f"  [openrouter] probe {model} returned no image")
            continue
        working_model = model
        print(f"  [openrouter] model probe ok: {model}")
        break

    if working_model is None:
        return False, "OpenRouter has no multimodal image model producing images"

    for name, prompt in shots:
        try:
            r = requests.post(
                url, headers=headers, timeout=180,
                json={
                    "model": working_model,
                    "modalities": ["image", "text"],
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
        except Exception as exc:  # noqa: BLE001
            return False, f"OpenRouter network error for {name}: {exc}"
        if r.status_code != 200:
            return False, f"OpenRouter HTTP {r.status_code} for {name}: {r.text[:200]}"
        img_bytes = _extract_image_bytes(r.json())
        if img_bytes is None:
            return False, f"OpenRouter returned no image bytes for {name}"
        (out_dir / f"{name}.png").write_bytes(img_bytes)
        print(f"  ✅ {name}.png via OpenRouter/{working_model.split('/')[-1]}")
    return True, f"openrouter/{working_model}"

def try_replicate(shots, out_dir):
    key = os.getenv("REPLICATE_API_KEY", "")
    if not key.startswith("r8_"):
        return False, "no valid REPLICATE_API_KEY"
    try:
        import replicate
    except ImportError:
        return False, "replicate package not installed (pip install replicate)"
    client = replicate.Client(api_token=key)
    for name, prompt in shots:
        output = client.run(
            "black-forest-labs/flux-1.1-pro",
            input={"prompt": prompt, "aspect_ratio": "16:9",
                   "output_format": "png", "output_quality": 95})
        img_bytes = requests.get(str(output), timeout=60).content
        (out_dir / f"{name}.png").write_bytes(img_bytes)
        print(f"  ✅ {name}.png via Replicate/Flux")
    return True, "replicate"

def try_stability(shots, out_dir):
    key = os.getenv("STABILITY_API_KEY", "")
    if not key.startswith("sk-"):
        return False, "no valid STABILITY_API_KEY"
    for name, prompt in shots:
        r = requests.post(
            "https://api.stability.ai/v2beta/stable-image/generate/ultra",
            headers={"Authorization": f"Bearer {key}", "Accept": "image/*"},
            files={"none": ""},
            data={"prompt": prompt, "aspect_ratio": "16:9",
                  "output_format": "png"},
            timeout=120)
        if r.status_code != 200:
            return False, f"Stability HTTP {r.status_code}: {r.text[:200]}"
        (out_dir / f"{name}.png").write_bytes(r.content)
        print(f"  ✅ {name}.png via Stability AI Ultra")
    return True, "stability"

# ── Main orchestration ─────────────────────────────────────────────

providers = [try_runway, try_openai, try_openrouter, try_replicate, try_stability]
success, provider = False, None

print("🎬  JARVIS Marvel Asset Generator")
print(f"    Output → {OUT}\n")

for fn in providers:
    name = fn.__name__.replace("try_", "")
    print(f"  → Trying {name}...")
    ok, msg = fn(SHOTS, OUT)
    if ok:
        success = True
        provider = msg
        print(f"\n✅  Images generated via {provider}")
        break
    else:
        print(f"     ✗ {msg}")

if not success:
    print("""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️  NO WORKING API KEY FOUND

  Add a real key for any one provider to:
    tests/api_keys.env

  Provider   Key prefix   Get key at
  ─────────  ──────────   ──────────────────────────────
  Runway     key_         https://app.runwayml.com/settings/api-keys
  OpenAI     sk-proj-     https://platform.openai.com/api-keys
  OpenRouter sk-or-v1-    https://openrouter.ai/keys
  Replicate  r8_          https://replicate.com/account/api-tokens
  Stability  sk-          https://platform.stability.ai/account/keys

  Then re-run:
    source tests/.venv/bin/activate
    python3 tests/generate_marvel_assets.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")
    sys.exit(1)


# ── Cinematic ffmpeg pipeline ──────────────────────────────────────
#
# Build a Marvel-style reel from the still shots:
#   1. Per-still Ken Burns clip (slow zoom + pan, 5s each)
#   2. Crossfade all clips into a single reel with fade-in and fade-out
#   3. Also produce a short looping animation clip driven by the nominal
#      still (radial zoom pulse) — this is the "jarvis_animation_loop.mp4"
#      that earlier runs tried to request from a text-to-video endpoint.

def _run_ffmpeg(args: list[str]) -> None:
    import subprocess
    proc = subprocess.run(args, capture_output=True, text=True)
    if proc.returncode != 0:
        print("  [ffmpeg] FAILED:")
        print(proc.stderr[-1500:])
        raise RuntimeError(f"ffmpeg exited {proc.returncode}")


def _make_ken_burns_clip(src: Path, dst: Path, *, duration_s: int = 5,
                          zoom_from: float = 1.0, zoom_to: float = 1.18,
                          pan: str = "center") -> None:
    """Produce a 1920x1080 H264 clip from a single still with a slow Ken
    Burns zoom. `pan` controls the zoom anchor: 'center', 'up_left', etc."""
    fps = 30
    frames = duration_s * fps
    # Zoom expression ramps linearly from zoom_from to zoom_to across frames.
    zoom_expr = (
        f"min({zoom_from}+({zoom_to - zoom_from})*on/{frames},{zoom_to})"
    )
    pan_map = {
        "center":   ("iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"),
        "up_left":  ("0.15*iw*(1-1/zoom)", "0.15*ih*(1-1/zoom)"),
        "up_right": ("iw-iw/zoom-0.15*iw*(1-1/zoom)", "0.15*ih*(1-1/zoom)"),
        "down":     ("iw/2-(iw/zoom/2)", "ih-ih/zoom-0.05*ih*(1-1/zoom)"),
    }
    x_expr, y_expr = pan_map.get(pan, pan_map["center"])
    # Upscale to 4K first so the sub-pixel pan looks smooth, then downscale.
    vf = (
        f"scale=3840:2160,"
        f"zoompan=z='{zoom_expr}':x='{x_expr}':y='{y_expr}':"
        f"d={frames}:s=1920x1080:fps={fps},"
        f"format=yuv420p"
    )
    _run_ffmpeg([
        "ffmpeg", "-y",
        "-loop", "1",
        "-t", str(duration_s),
        "-i", str(src),
        "-vf", vf,
        "-r", str(fps),
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        str(dst),
    ])


def _concat_with_crossfade(clips: list[Path], dst: Path,
                            crossfade_s: float = 0.8) -> None:
    """Chain N clips with progressive xfade transitions into a single MP4."""
    if not clips:
        raise ValueError("no clips to concat")
    if len(clips) == 1:
        import shutil
        shutil.copyfile(clips[0], dst)
        return

    # xfade concatenates pairwise; we need one filter per adjacent pair.
    # For 4 clips, the graph is:
    #   [0][1] xfade offset=c0-cf -> [x01]
    #   [x01][2] xfade offset=(c0+c1-2*cf) -> [x012]
    #   [x012][3] xfade offset=(c0+c1+c2-3*cf) -> [out]
    # Using ffprobe to read each clip's duration would be cleaner, but every
    # Ken Burns clip we produce here has a known 5s duration, so hard-code.
    clip_dur = 5.0
    filter_parts: list[str] = []
    current = "[0:v]"
    offset = clip_dur - crossfade_s
    for i in range(1, len(clips)):
        label = f"[x{i}]" if i < len(clips) - 1 else "[outv]"
        filter_parts.append(
            f"{current}[{i}:v]xfade=transition=fade:"
            f"duration={crossfade_s}:offset={offset:.3f}{label}"
        )
        current = label
        offset += clip_dur - crossfade_s

    filter_complex = ";".join(filter_parts)
    args = ["ffmpeg", "-y"]
    for c in clips:
        args += ["-i", str(c)]
    args += [
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        str(dst),
    ]
    _run_ffmpeg(args)


def _make_pulse_loop(src: Path, dst: Path, *, duration_s: int = 8) -> None:
    """Produce a looping animation clip by oscillating the zoom level of a
    single still. Gives the impression of a breathing reactor without needing
    an actual text-to-video model."""
    fps = 30
    frames = duration_s * fps
    # Oscillate zoom between 1.00 and 1.12 over the clip, sinusoidally.
    # FFmpeg's zoompan accepts arbitrary expressions; use (1 + A*sin(2*pi*t/T))
    # where T = duration_s in frames.
    zoom_expr = f"1+0.06*sin(2*PI*on/{frames})"
    vf = (
        f"scale=3840:2160,"
        f"zoompan=z='{zoom_expr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
        f"d={frames}:s=1920x1080:fps={fps},"
        f"format=yuv420p"
    )
    _run_ffmpeg([
        "ffmpeg", "-y",
        "-loop", "1",
        "-t", str(duration_s),
        "-i", str(src),
        "-vf", vf,
        "-r", str(fps),
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        str(dst),
    ])


def generate_cinematic_video(out_dir: Path) -> list[Path]:
    """Produce jarvis_marvel_reel.mp4 and jarvis_animation_loop.mp4 from the
    still shots that already exist in `out_dir`. Returns the list of MP4
    paths that were actually written."""
    stills = sorted(out_dir.glob("jarvis_*.png"))
    if not stills:
        print("  [video] no stills found, skipping cinematic pipeline")
        return []

    tmp_dir = out_dir / "_clips"
    tmp_dir.mkdir(exist_ok=True)
    for p in tmp_dir.glob("*.mp4"):
        p.unlink()

    # Map known shot names to different pans so the reel has variety.
    pans = {
        "jarvis_boot":       "up_left",
        "jarvis_nominal":    "center",
        "jarvis_lockscreen": "up_right",
        "jarvis_shutdown":   "down",
    }

    clips: list[Path] = []
    for still in stills:
        pan = pans.get(still.stem, "center")
        clip = tmp_dir / f"{still.stem}.mp4"
        print(f"  [video] rendering {still.stem} (pan={pan})")
        try:
            _make_ken_burns_clip(still, clip, duration_s=5, pan=pan)
            clips.append(clip)
        except Exception as exc:  # noqa: BLE001
            print(f"  [video] ken-burns failed for {still.stem}: {exc}")

    written: list[Path] = []
    reel = out_dir / "jarvis_marvel_reel.mp4"
    if clips:
        print(f"  [video] stitching reel ({len(clips)} clips with crossfade)")
        try:
            _concat_with_crossfade(clips, reel, crossfade_s=0.8)
            written.append(reel)
            print(f"  🎬 reel → {reel}")
        except Exception as exc:  # noqa: BLE001
            print(f"  [video] reel concat failed: {exc}")

    nominal = out_dir / "jarvis_nominal.png"
    if nominal.exists():
        loop = out_dir / "jarvis_animation_loop.mp4"
        print("  [video] rendering animation loop (radial pulse)")
        try:
            _make_pulse_loop(nominal, loop, duration_s=8)
            written.append(loop)
            print(f"  🎬 loop → {loop}")
        except Exception as exc:  # noqa: BLE001
            print(f"  [video] animation loop failed: {exc}")

    # Cleanup intermediate clips
    for c in clips:
        try:
            c.unlink()
        except OSError:
            pass
    try:
        tmp_dir.rmdir()
    except OSError:
        pass

    return written


videos = generate_cinematic_video(OUT)
print(f"\nImages: {len(sorted(OUT.glob('jarvis_*.png')))}")
print(f"Videos: {len(videos)}")
print(f"Output dir: {OUT}")
print("Done.")
