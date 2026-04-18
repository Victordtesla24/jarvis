"""Gate F harness tests.

Concrete pytest suite that exercises pure functions of tests/lib/visual_lib.py
on synthetic fixtures. Runs headlessly in any clean shell where numpy and
Pillow are importable. No display, no GUI, no sudo, no API keys.
"""

from __future__ import annotations

import datetime
import os
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from lib import visual_lib


def _write_rgb_png(tmp_path: Path, name: str, rgb: tuple[int, int, int], size: tuple[int, int] = (32, 32)) -> Path:
    img = Image.new("RGB", size, rgb)
    path = tmp_path / name
    img.save(path)
    return path


def test_palette_shape_and_values() -> None:
    palette = visual_lib.PALETTE
    assert set(palette.keys()) == {"cyan", "amber", "crimson", "steel", "background"}
    for name, value in palette.items():
        assert isinstance(value, tuple) and len(value) == 3, name
        for channel in value:
            assert 0 <= channel <= 255, name


def test_pixel_color_ratio_uniform_cyan(tmp_path: Path) -> None:
    cyan = visual_lib.PALETTE["cyan"]
    path = _write_rgb_png(tmp_path, "cyan.png", cyan)
    ratio = visual_lib.pixel_color_ratio(path, cyan, tol=0)
    assert ratio == pytest.approx(1.0)


def test_pixel_color_ratio_mismatch(tmp_path: Path) -> None:
    path = _write_rgb_png(tmp_path, "black.png", (0, 0, 0))
    ratio = visual_lib.pixel_color_ratio(path, visual_lib.PALETTE["cyan"], tol=0)
    assert ratio == pytest.approx(0.0)


def test_hue_family_ratio_amber(tmp_path: Path) -> None:
    amber = visual_lib.PALETTE["amber"]
    path = _write_rgb_png(tmp_path, "amber.png", amber)
    ratio = visual_lib.hue_family_ratio(path, hue_range=(0.08, 0.14), min_saturation=0.3, min_value=0.2)
    assert ratio > 0.95


def test_hue_family_ratio_rejects_black(tmp_path: Path) -> None:
    path = _write_rgb_png(tmp_path, "black.png", (0, 0, 0))
    ratio = visual_lib.hue_family_ratio(path, hue_range=(0.45, 0.58))
    assert ratio == pytest.approx(0.0)


def test_frame_motion_score_identical(tmp_path: Path) -> None:
    colour = visual_lib.PALETTE["background"]
    a = _write_rgb_png(tmp_path, "a.png", colour)
    b = _write_rgb_png(tmp_path, "b.png", colour)
    score = visual_lib.frame_motion_score([a, b])
    assert score == pytest.approx(0.0)


def test_frame_motion_score_divergent(tmp_path: Path) -> None:
    a = _write_rgb_png(tmp_path, "a.png", (0, 0, 0))
    b = _write_rgb_png(tmp_path, "b.png", (255, 255, 255))
    score = visual_lib.frame_motion_score([a, b])
    assert score == pytest.approx(255.0)


def test_frame_motion_score_single_path_is_zero(tmp_path: Path) -> None:
    a = _write_rgb_png(tmp_path, "solo.png", (128, 128, 128))
    assert visual_lib.frame_motion_score([a]) == pytest.approx(0.0)


def test_now_tag_format() -> None:
    tag = visual_lib.now_tag()
    datetime.datetime.strptime(tag, "%Y%m%dT%H%M%S")


def test_process_alive_self_and_bogus() -> None:
    assert visual_lib.process_alive(os.getpid()) is True
    assert visual_lib.process_alive(2_147_483_646) is False


def test_load_rgb_roundtrip(tmp_path: Path) -> None:
    rgb = (10, 20, 30)
    path = _write_rgb_png(tmp_path, "tiny.png", rgb, size=(4, 4))
    arr = visual_lib.load_rgb(path)
    assert isinstance(arr, np.ndarray)
    assert arr.shape == (4, 4, 3)
    assert tuple(arr[0, 0]) == rgb
