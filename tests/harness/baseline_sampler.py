"""
JARVIS HUD Baseline Sampler — Playwright Chromium FPS / heap / draw / WebGL info collector.

Used by ralph-loop-infinite S-4 (baseline) and S-9 (post-fix verification).

Usage:
    .venv/bin/python tests/harness/baseline_sampler.py \\
        --html /Users/vic/claude/General-Work/jarvis/jarvis-build/jarvis-full-animation.html \\
        --duration 60 \\
        --out diagnostics/baseline/fps-baseline.json \\
        --label baseline

The sampler:
  - Opens the HUD HTML in Chromium with WebGL enabled
  - Injects an in-page sampler that records per-frame timestamp via rAF
  - Captures WebGLRenderer-equivalent info (canvas count, getContextAttributes, lose_context ext)
  - Polls performance.memory every second (Chromium-only)
  - Reads JARVIS.PERF and JARVIS.STATE every second
  - Writes JSON: { meta, fps_samples[], memory_samples[], state_samples[], webgl_info, summary }

All inputs are real (no mocks). Errors propagate.
"""

import argparse
import json
import os
import statistics
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


_SAMPLER_JS = """
window.__J_SAMPLER__ = (() => {
  const frames = [];
  let lastT = performance.now();
  let running = true;
  function tick() {
    const now = performance.now();
    frames.push({ts: now, dt: now - lastT});
    lastT = now;
    if (running) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return {
    snapshot() {
      const memOk = (typeof performance !== 'undefined') && performance.memory;
      const mem = memOk ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      } : null;
      const perf = (typeof PERF !== 'undefined') ? {
        dpr: PERF.dpr, targetFPS: PERF.targetFPS,
        occluded: PERF.occluded, pageHidden: PERF.pageHidden,
        smCpuLoad: PERF.smCpuLoad, smGpuLoad: PERF.smGpuLoad,
        bloomScale: PERF.bloomScale, grainScale: PERF.grainScale
      } : null;
      const state = (typeof STATE !== 'undefined') ? {
        phase: STATE.phase, t: STATE.t,
        vitality: STATE.vitality,
        bloomMul: STATE.bloomMul,
        ringSpeedMul: STATE.ringSpeedMul
      } : null;
      const j = (typeof window.JARVIS !== 'undefined') ? {
        paused: window.JARVIS.paused, lowPower: window.JARVIS.lowPower
      } : null;
      return {frames: frames.length, mem, perf, state, jarvis: j};
    },
    drain() {
      const out = frames.slice();
      frames.length = 0;
      return out;
    },
    stop() { running = false; },
    canvasInfo() {
      return ['hexCanvas','bloomCanvas','glCoreCanvas','mainCanvas','scanCanvas','fxCanvas','grainCanvas']
        .map(id => {
          const cv = document.getElementById(id);
          if (!cv) return {id, missing: true};
          return {id, w: cv.width, h: cv.height, sw: cv.style.width, sh: cv.style.height};
        });
    },
    webglInfo() {
      const cv = document.getElementById('glCoreCanvas');
      if (!cv) return {error: 'no glCoreCanvas'};
      const gl = cv.getContext('webgl') || cv.getContext('webgl2') || cv.getContext('experimental-webgl');
      if (!gl) return {error: 'no webgl ctx'};
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const loseExt = gl.getExtension('WEBGL_lose_context');
      return {
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        contextAttributes: gl.getContextAttributes(),
        hasLoseContextExt: !!loseExt
      };
    }
  };
})();
"""


def sample(html: Path, duration_s: float, out_path: Path, label: str) -> dict:
    if not html.exists():
        raise FileNotFoundError(f"HUD HTML not found: {html}")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    meta = {
        "label": label,
        "html": str(html),
        "duration_s": duration_s,
        "start_unix": int(time.time()),
        "start_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    fps_samples = []
    memory_samples = []
    state_samples = []
    webgl_info: dict = {}
    canvas_info: list = []

    with sync_playwright() as p:
        # Headless for sampler determinism. The HUD HTML is Canvas2D + a small
        # WebGL plasma core, both of which run in headless Chromium fine; SwiftShader
        # provides software WebGL when no hardware GPU process is exposed.
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--ignore-gpu-blocklist",
                "--enable-unsafe-swiftshader",
                "--no-sandbox",
            ],
        )
        context = browser.new_context(viewport={"width": 1920, "height": 1200})
        page = context.new_page()
        page.add_init_script(_SAMPLER_JS)

        # The HUD pulls Google Fonts; some sandboxes block the CDN which
        # makes wait_until=load/networkidle hang indefinitely. Use 'commit'
        # to return as soon as the response headers arrive, then poll for
        # the bootstrap globals which are set synchronously during parse.
        page.goto(html.as_uri(), wait_until="commit", timeout=20_000)
        page.wait_for_function(
            "typeof STATE !== 'undefined' && typeof PERF !== 'undefined' && typeof window.__J_SAMPLER__ !== 'undefined'",
            timeout=30_000,
        )

        webgl_info = page.evaluate("window.__J_SAMPLER__.webglInfo()")
        canvas_info = page.evaluate("window.__J_SAMPLER__.canvasInfo()")

        t_end = time.monotonic() + duration_s
        last_snapshot = time.monotonic()
        while time.monotonic() < t_end:
            time.sleep(min(1.0, t_end - time.monotonic()))
            now = time.monotonic()
            if now - last_snapshot >= 1.0:
                snap = page.evaluate("window.__J_SAMPLER__.snapshot()")
                memory_samples.append({"ts": int(time.time()), **(snap.get("mem") or {})})
                state_samples.append(
                    {"ts": int(time.time()), "perf": snap.get("perf"), "state": snap.get("state"), "jarvis": snap.get("jarvis"), "frames": snap.get("frames")}
                )
                last_snapshot = now

        raw_frames = page.evaluate("window.__J_SAMPLER__.drain()")
        page.evaluate("window.__J_SAMPLER__.stop()")
        for f in raw_frames:
            fps_samples.append({"ts_ms": f["ts"], "dt_ms": f["dt"]})

        browser.close()

    dts = [f["dt_ms"] for f in fps_samples if f["dt_ms"] > 0 and f["dt_ms"] < 200]
    fps_per_sample = [1000.0 / dt for dt in dts]
    summary = {
        "frame_count": len(fps_samples),
        "fps_mean": statistics.fmean(fps_per_sample) if fps_per_sample else 0.0,
        "fps_p5": statistics.quantiles(fps_per_sample, n=20)[0] if len(fps_per_sample) >= 20 else 0.0,
        "fps_p50": statistics.median(fps_per_sample) if fps_per_sample else 0.0,
        "fps_p95": statistics.quantiles(fps_per_sample, n=20)[18] if len(fps_per_sample) >= 20 else 0.0,
        "dt_mean_ms": statistics.fmean(dts) if dts else 0.0,
        "dt_max_ms": max(dts) if dts else 0.0,
        "heap_delta_bytes": (memory_samples[-1].get("usedJSHeapSize", 0) - memory_samples[0].get("usedJSHeapSize", 0)) if len(memory_samples) >= 2 else 0,
    }

    payload = {
        "meta": meta,
        "summary": summary,
        "webgl_info": webgl_info,
        "canvas_info": canvas_info,
        "fps_samples_compact": fps_samples[:: max(1, len(fps_samples) // 600)],
        "memory_samples": memory_samples,
        "state_samples": state_samples,
    }
    out_path.write_text(json.dumps(payload, indent=2))
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="JARVIS HUD baseline sampler")
    parser.add_argument("--html", required=True, type=Path)
    parser.add_argument("--duration", type=float, default=60.0)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--label", default="baseline")
    args = parser.parse_args()
    payload = sample(args.html, args.duration, args.out, args.label)
    s = payload["summary"]
    print(json.dumps({"label": args.label, **s}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
