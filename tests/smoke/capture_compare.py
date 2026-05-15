"""Side-by-side capture tool for the marvel-vs-target iteration loop.

Loads the marvel baseline, reads the WebGL backbuffer pixels via `readPixels`
(page.screenshot silently drops WebGL content in Chromium headless+ANGLE/Metal
on macOS — we bypass that by reconstructing the canvas as a PNG from raw
RGBA bytes), and also captures compare.html with the marvel chip clicked.
"""
from __future__ import annotations

import base64
import io
import sys
from pathlib import Path
from typing import Any

from PIL import Image
from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).parent.parent.parent
OUT_DIR = REPO_ROOT / "docs/jarvis-uhd-cinematic-v2-parity/marvel-compare"
OUT_DIR.mkdir(parents=True, exist_ok=True)

MARVEL_URL = "http://localhost:8899/jarvis-reactor-cinematic-marvel.html?compare=1"
COMPARE_URL = "http://localhost:8899/compare.html"

VIEWPORT = {"width": 1920, "height": 1080}


def _dump_canvas_via_readpixels(page: Any, w: int, h: int) -> bytes:
    """Read the WebGL backbuffer and construct a PNG via Pillow.

    Returns raw PNG bytes.
    """
    b64 = page.evaluate(
        """async ({w, h}) => {
            const c = document.getElementById('marvel-canvas');
            // Force a composer render immediately before readPixels so the
            // backbuffer holds the freshest frame.
            window.__MARVEL.composer.render();
            const gl = c.getContext('webgl2') || c.getContext('webgl');
            const pixels = new Uint8Array(w * h * 4);
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            // Flip vertically — WebGL origin is bottom-left, PNG is top-left.
            const flipped = new Uint8Array(w * h * 4);
            for (let y = 0; y < h; y++) {
                const src = (h - 1 - y) * w * 4;
                const dst = y * w * 4;
                flipped.set(pixels.subarray(src, src + w * 4), dst);
            }
            // Encode as base64 for transport to Python.
            let bin = '';
            const chunk = 0x8000;
            for (let i = 0; i < flipped.length; i += chunk) {
                bin += String.fromCharCode.apply(null, flipped.subarray(i, i + chunk));
            }
            return btoa(bin);
        }""",
        {"w": w, "h": h},
    )
    raw = base64.b64decode(b64)
    img = Image.frombytes("RGBA", (w, h), raw)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _composite_canvas_over_dom(page: Any, w: int, h: int) -> bytes:
    """Capture the full page screenshot, then overlay the WebGL backbuffer
    image on top so HUD + reactor appear together."""
    canvas_png = _dump_canvas_via_readpixels(page, w, h)
    canvas_img = Image.open(io.BytesIO(canvas_png)).convert("RGBA")
    dom_png = page.screenshot(type="png", full_page=False, animations="disabled", timeout=90000)
    dom_img = Image.open(io.BytesIO(dom_png)).convert("RGBA")
    # Alpha-composite canvas UNDER dom (canvas is the background, dom overlays
    # include HUD elements with transparency).
    combined = Image.alpha_composite(canvas_img, dom_img)
    buf = io.BytesIO()
    combined.save(buf, format="PNG")
    return buf.getvalue()


def capture(label: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox", "--disable-setuid-sandbox",
                "--enable-webgl", "--ignore-gpu-blocklist",
                "--use-angle=metal",
                "--hide-scrollbars",
            ],
        )
        ctx = browser.new_context(viewport=VIEWPORT)

        # 1. Marvel baseline alone — compare mode hides HUD, we want pure reactor
        p1 = ctx.new_page()
        p1.goto(MARVEL_URL, wait_until="domcontentloaded", timeout=30000)
        p1.wait_for_timeout(5500)
        solo_png = _dump_canvas_via_readpixels(p1, VIEWPORT["width"], VIEWPORT["height"])
        (OUT_DIR / f"marvel-solo-{label}.png").write_bytes(solo_png)
        p1.close()

        # 2. compare.html with marvel chip clicked
        p2 = ctx.new_page()
        p2.goto(COMPARE_URL, wait_until="domcontentloaded", timeout=30000)
        p2.wait_for_timeout(1500)
        p2.evaluate("""() => {
            // Force LEFT pane to marvel + lock RIGHT pane to vecteezy-1 target
            const marvelChip = document.getElementById('marvelChip');
            if (marvelChip) marvelChip.click();
            // Disable auto-cycle and click the first picker chip (Vecteezy-1)
            const autoBtn = document.getElementById('autoBtn');
            if (autoBtn && autoBtn.classList.contains('active')) autoBtn.click();
            const firstChip = document.querySelector('#picker .chip');
            if (firstChip) firstChip.click();
        }""")
        # Wait for the iframe to load marvel and reach stable NOMINAL phase
        p2.wait_for_timeout(6000)
        # Capture the full compare page DOM (HUD + ref img), then blit the
        # marvel canvas of the iframe on top.
        iframe = p2.frame(name="v3Iframe") or p2.frames[-1]
        if iframe is None:
            raise RuntimeError("No iframe found in compare.html")
        compare_dom = p2.screenshot(type="png", full_page=False, animations="disabled", timeout=90000)
        try:
            canvas_png = _dump_canvas_via_readpixels(iframe, VIEWPORT["width"], VIEWPORT["height"])
        except Exception as e:
            print(f"iframe canvas dump failed: {e}; using DOM only")
            canvas_png = compare_dom
        (OUT_DIR / f"compare-full-{label}.png").write_bytes(compare_dom)
        (OUT_DIR / f"compare-marvel-canvas-{label}.png").write_bytes(canvas_png)
        p2.close()

        browser.close()
    print(f"WROTE marvel-solo-{label}.png + compare-full-{label}.png + compare-marvel-canvas-{label}.png")


if __name__ == "__main__":
    label = sys.argv[1] if len(sys.argv) > 1 else "iter"
    capture(label)
