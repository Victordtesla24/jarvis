# HARD MANDATE: HOLOGRAPHIC HUD ONLY

Every JARVIS HUD element must read as **projected holographic light over the desktop**, like the
Iron-Man movie holograms — NOT opaque/solid panels.

## Rules (apply to the whole HUD, reactor + all panels)
- **Translucent, never solid.** Panels = very low-alpha glass (e.g. `rgba(10,30,36,0.18)`) + `backdrop-filter: blur()`. No opaque fills. The desktop/void shows through everywhere.
- **Glowing edges, not borders.** Thin cyan strokes with `box-shadow`/`drop-shadow` bloom; corner brackets; edges look like light, not lines.
- **Volumetric depth.** Layered z-depth + slight parallax on pointer; faint outer glow halos; scanlines + subtle grain so it reads as a projection.
- **Reactor = holographic 3D.** See-through rings, additive/screen blending, UnrealBloom; the rings are light, not plastic. The `reactor.mp4` backdrop is screen-blended.
- **Transparent substrate.** `body{background:transparent}` stays; in the packaged .app the desktop shows through (true overlay). The in-browser `#void` is only a dim preview.
- **Color = light:** cyan `#3ff0e0` / electric `#28e0ff` / hot `#eafdff` on near-black; additive glows, no flat gray UI chrome.
- **Motion:** gentle float/breathing, flicker-in like a hologram powering up; honor `prefers-reduced-motion`.

If any element looks like a solid window/card, it is WRONG — make it a translucent glowing projection.
