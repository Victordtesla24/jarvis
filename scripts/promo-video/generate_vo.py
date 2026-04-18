#!/usr/bin/env python3
"""scripts/promo-video/generate_vo.py

Synthesise every VO line from shot_list.json into promo/vo/line{NN}.wav.
Provider chain: OpenAI tts-1-hd (fable voice) -> macOS say -v Daniel.
Idempotent: skips lines whose .wav already exists AND whose content hash
matches the sidecar .meta.json. Any of (text, voice_id, provider, target)
changing forces regeneration.

Exit codes (shared across promo-video/*.py):
  0  success
  1  at least one VO line failed all providers
 10  missing required tool (ffmpeg, say)
"""
from __future__ import annotations
import argparse
import hashlib
import json
import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))
from lib.shot_list_loader import load, REPO_ROOT  # noqa: E402

# R-12: the sole canonical API-key location is $HOME/.jarvis/.env. The old
# per-repo probe was a footgun that risked committing keys into the tree.
ENV_FILE = Path.home() / ".jarvis" / ".env"
if ENV_FILE.exists():
    for _line in ENV_FILE.read_text().splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _k, _, _v = _line.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

LOG = logging.getLogger("generate_vo")

OUT_DEFAULT = REPO_ROOT / "promo" / "vo"
TARGET_SAMPLE_RATE = 24000  # R-35: every VO wav emerges at 24 kHz mono.


def _atomic_write_bytes(out: Path, payload: bytes) -> None:
    """R-34: write-then-rename so a killed process never leaves a partial."""
    tmp = out.with_suffix(out.suffix + ".tmp")
    try:
        tmp.write_bytes(payload)
        tmp.replace(out)
    except OSError:
        tmp.unlink(missing_ok=True)
        raise


def _normalise_to_24khz_mono(raw: Path, target: Path) -> bool:
    """R-35: force every VO wav to 24 kHz mono PCM16 via ffmpeg. The input
    may be any format (MP3, AAC, whatever the TTS service returned) — ffmpeg
    normalises it. Returns True on success."""
    if shutil.which("ffmpeg") is None:
        LOG.error("ffmpeg not installed; cannot normalise %s", raw)
        return False
    tmp = target.with_suffix(target.suffix + ".tmp")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-i", str(raw),
             "-ar", str(TARGET_SAMPLE_RATE),
             "-ac", "1",
             "-c:a", "pcm_s16le",
             str(tmp)],
            check=True, capture_output=True, timeout=30,
        )
        tmp.replace(target)
        return True
    except subprocess.CalledProcessError as exc:
        tmp.unlink(missing_ok=True)
        stderr = (exc.stderr or b"").decode(errors="replace")
        LOG.warning("ffmpeg normalise failed: %s", stderr[:200])
        return False


def synth_openai(text: str, out_wav: Path) -> bool:
    """Call OpenAI TTS with the fable voice. Returns True on success.

    R-37: specific exception types only. R-34: atomic write.
    """
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key.startswith("sk-"):
        return False
    try:
        import urllib.request
        import urllib.error
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
            "model": os.environ.get("PROMO_TTS_MODEL", "tts-1"),
            "voice": "fable",
            "input": text,
            "response_format": "wav",
        }).encode(),
    )
    raw_tmp = out_wav.with_suffix(".raw.wav")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw_tmp.write_bytes(r.read())
    except urllib.error.HTTPError as e:
        LOG.warning("openai HTTP %s: %s",
                    e.code, e.read()[:200].decode(errors="replace"))
        raw_tmp.unlink(missing_ok=True)
        return False
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        LOG.warning("openai network error: %s", exc)
        raw_tmp.unlink(missing_ok=True)
        return False
    try:
        if not _normalise_to_24khz_mono(raw_tmp, out_wav):
            return False
        return True
    finally:
        raw_tmp.unlink(missing_ok=True)


def synth_say(text: str, out_wav: Path) -> bool:
    """Fallback: macOS say command -> ffmpeg 24 kHz mono normalise.

    R-35: every VO emerges at exactly 24 kHz mono regardless of provider.
    """
    if shutil.which("say") is None:
        LOG.error("macOS `say` not available")
        return False
    raw_tmp = out_wav.with_suffix(".raw.wav")
    try:
        subprocess.run(
            ["say",
             "--file-format=WAVE",
             "--data-format=LEI16@48000",
             "-v", "Daniel",
             "-o", str(raw_tmp),
             text],
            check=True, capture_output=True, timeout=30,
        )
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or b"").decode(errors="replace")
        LOG.warning("say failed: %s", stderr[:200])
        raw_tmp.unlink(missing_ok=True)
        return False
    if not raw_tmp.exists() or raw_tmp.stat().st_size < 10_000:
        LOG.warning("say output too small (%s bytes) — empty/sandbox?",
                    raw_tmp.stat().st_size if raw_tmp.exists() else 0)
        raw_tmp.unlink(missing_ok=True)
        return False
    try:
        return _normalise_to_24khz_mono(raw_tmp, out_wav)
    finally:
        raw_tmp.unlink(missing_ok=True)


def _meta_hash(provider: str, text: str, voice_id: str, duration: float) -> str:
    """R-36: content-hash sidecar so changing text/voice/target forces regen."""
    payload = f"{provider}|{text}|{voice_id}|{duration:.3f}".encode()
    return hashlib.sha256(payload).hexdigest()


def _needs_regen(out_wav: Path, expected_hash: str) -> bool:
    if not out_wav.exists():
        return True
    if out_wav.stat().st_size < 1024:
        return True
    meta = out_wav.with_suffix(".meta.json")
    if not meta.exists():
        return True
    try:
        data = json.loads(meta.read_text())
    except (json.JSONDecodeError, OSError):
        return True
    return data.get("hash") != expected_hash


def _write_meta(out_wav: Path, provider: str, hash_: str) -> None:
    meta = out_wav.with_suffix(".meta.json")
    meta.write_text(json.dumps({
        "provider": provider,
        "hash": hash_,
        "sample_rate": TARGET_SAMPLE_RATE,
        "channels": 1,
    }, indent=2, sort_keys=True) + "\n")


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    """R-40: argparse with --help, --act, --out-dir."""
    p = argparse.ArgumentParser(
        description="Generate JARVIS promo VO tracks from shot_list.json")
    p.add_argument("--act", type=int, choices=[1, 2, 3, 4], default=None,
                   help="Only generate VO lines belonging to this act.")
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
    out_dir.mkdir(parents=True, exist_ok=True)

    data = load()
    vo_lines = data["vo_lines"]
    prefer_fallback = os.environ.get("PROMO_VO_FORCE_FALLBACK", "0") == "1"

    provider_used = {"openai": 0, "say": 0, "skipped": 0, "failed": 0}

    for key in sorted(vo_lines.keys()):
        line = vo_lines[key]
        if args.act is not None and line.get("act") not in (args.act, None):
            continue
        idx = int(key.split("_")[1])
        out_wav = out_dir / f"line{idx:02d}.wav"
        text: str = line["text"]
        duration = float(line.get("target_duration", 0.0))
        voice_id = "fable" if not prefer_fallback else "Daniel"
        planned_provider = "openai" if not prefer_fallback else "say"
        expected_hash = _meta_hash(planned_provider, text, voice_id, duration)

        if not _needs_regen(out_wav, expected_hash):
            LOG.info("skip %s (hash match)", out_wav.name)
            provider_used["skipped"] += 1
            continue

        LOG.info("synth %s: %r", out_wav.name, text)

        ok = False
        used_provider: Optional[str] = None
        if not prefer_fallback:
            if synth_openai(text, out_wav):
                ok = True
                used_provider = "openai"
                provider_used["openai"] += 1

        if not ok and synth_say(text, out_wav):
            ok = True
            used_provider = "say"
            provider_used["say"] += 1

        if not ok:
            LOG.error("all providers failed for %s", out_wav.name)
            provider_used["failed"] += 1
            continue

        # Compute final hash using actual provider that succeeded.
        assert used_provider is not None
        voice = "fable" if used_provider == "openai" else "Daniel"
        final_hash = _meta_hash(used_provider, text, voice, duration)
        _write_meta(out_wav, used_provider, final_hash)

    # R-1: emit canonical vo_timing.json from shot_list.json (deterministic).
    timing = {k: v["place_at"] for k, v in sorted(vo_lines.items())}
    timing_path = out_dir / "vo_timing.json"
    _atomic_write_bytes(
        timing_path,
        (json.dumps(timing, indent=2, sort_keys=True) + "\n").encode(),
    )
    LOG.info("wrote %s (%d entries)",
             timing_path.relative_to(REPO_ROOT), len(timing))

    LOG.info("VO summary: %s", provider_used)
    return 0 if provider_used["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
