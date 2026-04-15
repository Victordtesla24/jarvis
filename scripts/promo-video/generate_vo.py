#!/usr/bin/env python3
"""scripts/promo-video/generate_vo.py

Synthesise every VO line from shot_list.json into promo/vo/line{NN}.wav.
Provider chain: OpenAI tts-1-hd (fable voice) → macOS say -v Daniel.
Idempotent: skips lines whose .wav already exists.
"""
from __future__ import annotations
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.shot_list_loader import load, REPO_ROOT  # noqa: E402

# Load API keys from env files if present (best-effort, no hard dep on dotenv)
for env_file in (REPO_ROOT / "tests" / "api_keys.env", Path.home() / ".jarvis" / ".env"):
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            val = val.strip().strip('"').strip("'")
            os.environ.setdefault(key.strip(), val)

OUT = REPO_ROOT / "promo" / "vo"
OUT.mkdir(parents=True, exist_ok=True)


def synth_openai(text: str, out_wav: Path) -> bool:
    """Call OpenAI TTS with the fable voice. Returns True on success."""
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key.startswith("sk-"):
        return False
    try:
        import urllib.request
        import urllib.error
        import json
    except ImportError:
        return False
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        data=json.dumps({
            "model": "tts-1-hd",
            "voice": "fable",
            "input": text,
            "response_format": "wav",
        }).encode(),
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            out_wav.write_bytes(r.read())
    except urllib.error.HTTPError as e:
        print(f"  [openai] HTTP {e.code}: {e.read()[:200].decode(errors='replace')}")
        return False
    except Exception as exc:
        print(f"  [openai] error: {exc}")
        return False
    return True


def synth_say(text: str, out_wav: Path) -> bool:
    """Fallback: macOS say command with Daniel (British English).
    Writes WAV directly via --file-format=WAVE, no ffmpeg conversion needed.
    """
    try:
        subprocess.run(
            ["say",
             "--file-format=WAVE",
             "--data-format=LEI16@48000",
             "-v", "Daniel",
             "-o", str(out_wav),
             text],
            check=True, capture_output=True, timeout=30,
        )
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.decode() if exc.stderr else ""
        print(f"  [say] failed: {stderr[:200]}")
        return False
    # Sanity: file must be > 10KB (header alone is ~4KB)
    if out_wav.stat().st_size < 10_000:
        print(f"  [say] output too small ({out_wav.stat().st_size}B) — likely empty, sandbox?")
        return False
    return True


def main() -> int:
    data = load()
    vo_lines = data["vo_lines"]
    prefer_fallback = os.environ.get("PROMO_VO_FORCE_FALLBACK", "0") == "1"

    provider_used: dict[str, int] = {"openai": 0, "say": 0, "skipped": 0, "failed": 0}

    for key in sorted(vo_lines.keys()):
        line = vo_lines[key]
        idx = int(key.split("_")[1])
        out_wav = OUT / f"line{idx:02d}.wav"
        if out_wav.exists() and out_wav.stat().st_size > 1024:
            print(f"  ⏭  {out_wav.name} already exists, skipping")
            provider_used["skipped"] += 1
            continue

        text = line["text"]
        print(f"  🔊  {out_wav.name} — {text!r}")

        ok = False
        if not prefer_fallback:
            ok = synth_openai(text, out_wav)
            if ok:
                provider_used["openai"] += 1
                print(f"     ✅ via OpenAI fable")

        if not ok:
            ok = synth_say(text, out_wav)
            if ok:
                provider_used["say"] += 1
                print(f"     ✅ via macOS say Daniel")

        if not ok:
            print(f"     ❌ all providers failed for {out_wav.name}")
            provider_used["failed"] += 1

    print(f"\nVO summary: {provider_used}")
    return 0 if provider_used["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
