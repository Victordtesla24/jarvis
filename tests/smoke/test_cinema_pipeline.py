"""
T-15 / SC-6.2: Playwright headless Chromium smoke test for the cinema bloom pipeline.

Navigates to http://localhost:8899/smoke/cinema-smoke.html, waits 3 s for the
Three.js + postprocessing bloom (or Canvas 2D fallback) to render, captures a
screenshot, and asserts ≥ 500 bright pixels (any channel > 200) in the annulus
ROI centred on the canvas: outer radius 80 px, inner exclusion radius 20 px.
"""

import io
from pathlib import Path

import pytest
from PIL import Image
from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).parent.parent.parent
SCREENSHOT_PATH = REPO_ROOT / "docs/smoke-results/cinema-pipeline-proof.png"
SMOKE_URL = "http://localhost:8899/smoke/cinema-smoke.html"

W, H = 800, 600
CX, CY = W // 2, H // 2
ANNULUS_OUTER = 80
ANNULUS_INNER = 20
BRIGHT_THRESHOLD = 200
BRIGHT_MIN_COUNT = 500


def test_cinema_pipeline_bloom(http_server):  # noqa: ARG001  (fixture)
    SCREENSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--use-angle=swiftshader",
            ],
        )
        page = browser.new_page(viewport={"width": W, "height": H})
        page.on(
            "console",
            lambda msg: console_errors.append(msg.text) if msg.type == "error" else None,
        )

        page.goto(SMOKE_URL, wait_until="networkidle")
        page.wait_for_timeout(3000)

        raw = page.screenshot(type="png")
        SCREENSHOT_PATH.write_bytes(raw)
        browser.close()

    assert not console_errors, f"Browser console errors: {console_errors}"

    img = Image.open(io.BytesIO(raw)).convert("RGB")
    assert img.size == (W, H), f"Screenshot size mismatch: {img.size}"

    pixels = img.load()
    bright_count = 0
    for py in range(CY - ANNULUS_OUTER, CY + ANNULUS_OUTER + 1):
        for px in range(CX - ANNULUS_OUTER, CX + ANNULUS_OUTER + 1):
            dist = ((px - CX) ** 2 + (py - CY) ** 2) ** 0.5
            if ANNULUS_INNER < dist < ANNULUS_OUTER:
                r, g, b = pixels[px, py]
                if max(r, g, b) > BRIGHT_THRESHOLD:
                    bright_count += 1

    assert bright_count >= BRIGHT_MIN_COUNT, (
        f"Bloom annulus bright-pixel count {bright_count} < {BRIGHT_MIN_COUNT}. "
        "Screenshot saved to: " + str(SCREENSHOT_PATH)
    )
