// Curved holographic-glass post layer (HUD.aep "CRT curv" + Project File.aep "Plane
// Curvature"). Deliberately minimal and additive: the dashboard already has two
// vignettes + two scanline layers, so this adds only what they don't — a faint curved
// top sheen, a soft cyan edge fringe, and an occasional whole-glass holo flicker. Pure
// CSS, no per-frame work, pointer-events-none. z-30: above the flat HUD (z20) / reactor
// (z12), below the HUDOverlay alerts (z40) and the JARVIS console (z50).
const HoloGlass = () => (
  <div className="absolute inset-0 z-30 pointer-events-none select-none hologlass-flicker" aria-hidden="true">
    {/* curved-glass top sheen — fakes light raking across a convex projection surface */}
    <div
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(90% 46% at 50% -12%, rgba(155,234,246,0.07), transparent 60%)',
        mixBlendMode: 'screen',
      }}
    />
    {/* soft cyan edge fringe — confined to the outer ring so centre text stays crisp */}
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(122% 122% at 50% 50%, transparent 70%, rgba(0,240,255,0.05) 92%, rgba(0,163,255,0.07) 100%)',
        mixBlendMode: 'screen',
      }}
    />
  </div>
);

export default HoloGlass;
