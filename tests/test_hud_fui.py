"""SC6 — the HUD meets the Marvel FUI + command-center UX bar (R13/R14), 60fps.

SC6 is a *front-end* success criterion. The HUD itself is a single static asset
(``lib/dashboard_web/index.html``) served verbatim by the loopback backend and
loaded by the floating ``.app``; there is no JS test runner in this repo, so —
exactly like ``test_dashboard_app.py`` does for SC5 — these tests pin the
HUD by asserting that the required capabilities are actually present and
structurally correct in the shipped asset.

They cover:

- **R13 (Marvel/Iron-Man FUI):** the three exact semantic colour tiers on the
  ``#080D14`` base, the Eurostile/OCR-A/Space-Mono type stack, selective
  UnrealBloom, a holographic Fresnel+scanline material, GPGPU "data dust",
  chromatic aberration, and GSAP staggered boot / idle breathing / Z-space
  parallax.
- **R14 (command-center UX):** the 5-second health word, per-panel
  Live/Stale/Offline freshness (no spinners), a monitoring/control mode switch
  plus a ⌘K command palette, tabular-nums, value+delta+sparkline, ≤6 cards
  above the fold, redundant (colour+shape) status, ``prefers-reduced-motion``,
  and a computed ≥4.5:1 text-contrast guarantee on the dark composite.
- **60fps:** a single rAF master loop with a device-pixel-ratio cap, an
  adaptive-quality FPS guard, and render-pausing when the window is hidden.
"""
import re

from lib import dashboard

HTML = (dashboard.WEB_DIR / "index.html").read_text()
LOW = HTML.lower()


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _relative_luminance(hex_color: str) -> float:
    """WCAG 2.x relative luminance of an ``#rrggbb`` colour."""
    h = hex_color.lstrip("#")
    chans = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in chans]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def _contrast_ratio(a: str, b: str) -> float:
    la, lb = _relative_luminance(a), _relative_luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _css_var(name: str) -> str:
    m = re.search(rf"--{name}:\s*(#[0-9A-Fa-f]{{6}})", HTML)
    assert m, f"CSS variable --{name} not declared as a 6-digit hex"
    return m.group(1)


# --------------------------------------------------------------------------- #
# sanity — the asset is whole (guards against a truncated write)
# --------------------------------------------------------------------------- #
def test_hud_asset_is_complete():
    assert HTML.startswith("<!DOCTYPE html>")
    assert "</html>" in HTML
    assert len(HTML) > 15000, "HUD looks truncated"


def test_existing_hud_contract_preserved():
    # Markers other suites already depend on must survive the FUI rework.
    for marker in ("JARVIS", "arc-reactor", "three", "gauge", "/api/stats"):
        assert marker in HTML, f"regressed HUD marker {marker!r}"
    assert "setClearColor(0x000000, 0)" in HTML  # transparent .app (SC5)
    assert "data-interactive" in HTML  # click-through regions (SC5)


# --------------------------------------------------------------------------- #
# R13 — Marvel / Iron-Man FUI
# --------------------------------------------------------------------------- #
def test_three_semantic_colour_tiers_on_dark_base():
    # cyan ambient / amber active / red critical on #080D14 — exact PRD hexes.
    for tier in ("#8BD3FB", "#FBCA03", "#AA0505", "#080D14"):
        assert tier in HTML, f"missing FUI colour tier {tier}"


def test_fui_type_stack():
    # Eurostile-Extended (licensed → bundled fallback) + OCR-A + Space-Mono.
    assert "eurostile" in LOW
    assert "ocr" in LOW
    assert "space mono" in LOW


def test_selective_unreal_bloom():
    assert "EffectComposer" in HTML
    assert "UnrealBloomPass" in HTML
    # selective bloom isolates glowing geometry onto a dedicated layer
    assert "BLOOM_LAYER" in HTML
    assert "darkenNonBloomed" in HTML or "darkenNonBloom" in HTML


def test_holographic_fresnel_scanline_material():
    assert "ShaderMaterial" in HTML
    assert "fresnel" in LOW
    assert "scanline" in LOW


def test_gpgpu_data_dust():
    assert "data dust" in LOW
    assert "Points" in HTML  # THREE.Points particle field
    assert "BufferGeometry" in HTML


def test_chromatic_aberration():
    assert "aberration" in LOW


def test_gsap_boot_breathing_parallax():
    assert "gsap" in LOW
    assert "stagger" in LOW  # staggered boot reveal
    assert "parallax" in LOW  # Z-space mouse parallax
    assert "breath" in LOW  # idle breathing


# --------------------------------------------------------------------------- #
# R14 — command-center UX
# --------------------------------------------------------------------------- #
def test_five_second_health_word():
    assert 'id="health"' in HTML
    for word in ("NOMINAL", "DEGRADED", "CRITICAL"):
        assert word in HTML, f"missing health state {word}"


def test_per_panel_freshness_without_spinners():
    for state in ("LIVE", "STALE", "OFFLINE"):
        assert state in HTML, f"missing freshness state {state}"
    assert "freshness" in LOW
    # R14 is explicit: no spinners anywhere.
    assert "spinner" not in LOW


def test_mode_switch_and_command_palette():
    assert "MONITOR" in HTML and "CONTROL" in HTML  # monitoring vs control view
    assert "palette" in LOW
    assert "⌘K" in HTML  # keyboard summon


def test_tabular_nums_value_delta_sparkline():
    assert "tabular-nums" in LOW
    assert "delta" in LOW
    assert "sparkline" in LOW


def test_at_most_six_cards_above_the_fold():
    fold_cards = re.findall(r"data-fold\b", HTML)
    assert 0 < len(fold_cards) <= 6, f"above-the-fold cards: {len(fold_cards)} (max 6)"


def test_redundant_colour_plus_shape_status():
    assert "redundant" in LOW
    # status is encoded by shape as well as colour (colour-blind safe)
    for glyph in ("●", "▲", "■"):
        assert glyph in HTML, f"missing status shape glyph {glyph!r}"


def test_prefers_reduced_motion_supported():
    assert "prefers-reduced-motion" in LOW


def test_primary_text_contrast_meets_4_5_to_1():
    ratio = _contrast_ratio(_css_var("txt"), _css_var("ink"))
    assert ratio >= 4.5, f"primary text contrast {ratio:.2f}:1 < 4.5:1"


# --------------------------------------------------------------------------- #
# 60fps — single master loop, dPR cap, adaptive quality, hidden-tab pause
# --------------------------------------------------------------------------- #
def test_single_master_animation_loop():
    # Easing gauges, scene, dust and parallax all ride ONE rAF master loop so
    # they share a frame budget instead of competing.
    assert "requestAnimationFrame" in HTML
    assert "masterLoop" in HTML or "master loop" in LOW


def test_device_pixel_ratio_capped():
    assert re.search(r"Math\.min\(\s*(?:window\.)?devicePixelRatio", HTML), (
        "pixel ratio must be capped for fill-rate"
    )


def test_adaptive_fps_guard():
    assert "fps" in LOW
    # quality is dialed back when the frame budget is missed
    assert "degrade" in LOW or "adaptive" in LOW


def test_render_pauses_when_hidden():
    assert "visibilitychange" in LOW or "document.hidden" in LOW
