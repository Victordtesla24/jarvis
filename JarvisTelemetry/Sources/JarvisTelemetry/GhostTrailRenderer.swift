// File: Sources/JarvisTelemetry/GhostTrailRenderer.swift
// Spec §3.11: Ghost Trails
// Maintains a ring buffer of the last 5 rendered phase values.
// JarvisReactorCanvas reads trailing phase offsets and draws ring copies
// at decreasing opacities — creating a motion blur / speed trail that grows
// more visible under high load (rings spin faster, trails stretch further).
//
// Usage:
//   1. In JarvisReactorCanvas, hold @StateObject private var ghostBuffer = GhostPhaseBuffer()
//   2. Call ghostBuffer.record(phase) in .onChange(of: phase)
//   3. Before drawing Ring 1, call ghostBuffer.trails(speedMultiplier:) to get
//      [(phaseOffset: Double, opacity: Double)] and draw dim ring copies.

import SwiftUI

// MARK: - GhostPhaseBuffer ────────────────────────────────────────────────────

final class GhostPhaseBuffer: ObservableObject {

    /// How many trailing frame copies to store
    static let capacity = 5

    /// Base opacities from oldest (index 0) to most-recent ghost (index 4).
    /// Real element is drawn on top at full opacity — not included here.
    static let baseOpacities: [Double] = [0.01, 0.03, 0.06, 0.10, 0.15]

    private var buffer: [Double] = Array(repeating: 0.0,
                                         count: GhostPhaseBuffer.capacity)
    private var writeIndex = 0

    // ── Recording ────────────────────────────────────────────────────────

    /// Record the current phase value each frame.
    func record(_ phase: Double) {
        buffer[writeIndex % GhostPhaseBuffer.capacity] = phase
        writeIndex += 1
    }

    // ── Reading ──────────────────────────────────────────────────────────

    /// Returns (phase, opacity) pairs for trailing ring copies.
    /// Opacity scales 0→1 as speedMultiplier goes from 0.8→2.0.
    /// Returns empty array when speed is below baseline (no trail visible).
    func trails(speedMultiplier: Double) -> [(phase: Double, opacity: Double)] {
        // No trail at normal or slow speed
        guard speedMultiplier > 0.8 else { return [] }
        // Visibility ramps from 0 at speed 0.8 to 1 at speed 2.0
        let visibility = min(1.0, (speedMultiplier - 0.8) / 1.2)
        let cap = GhostPhaseBuffer.capacity

        return (0..<cap).map { i in
            // Oldest entry first: index = (writeIndex - cap + i) mod cap
            let idx = (writeIndex - cap + i + cap * 1000) % cap
            let p   = buffer[idx]
            let o   = GhostPhaseBuffer.baseOpacities[i] * visibility
            return (p, o)
        }
    }
}

// MARK: - ViewModifier bridge ─────────────────────────────────────────────────
// GhostTrailModifier wraps a Canvas-based ring draw so callers can apply
// it via .modifier(GhostTrailModifier(buffer: ..., speedMultiplier: ...)).
// Optional — JarvisReactorCanvas uses GhostPhaseBuffer directly.

struct GhostTrailModifier: ViewModifier {
    let buffer         : GhostPhaseBuffer
    let speedMultiplier: Double
    let cyan           : Color

    func body(content: Content) -> some View {
        ZStack {
            // Ghost rings (behind the live content)
            GhostRingCanvas(buffer: buffer, speedMultiplier: speedMultiplier, cyan: cyan)
            // Live content on top
            content
        }
    }
}

/// Standalone canvas that draws translucent ring copies at historical phases.
/// Radius and center are passed as explicit geometry parameters.
struct GhostRingCanvas: View {
    let buffer         : GhostPhaseBuffer
    let speedMultiplier: Double
    let cyan           : Color

    var body: some View {
        Canvas(opaque: false, colorMode: .linear) { ctx, size in
            let trails = buffer.trails(speedMultiplier: speedMultiplier)
            guard !trails.isEmpty else { return }

            let c  = CGPoint(x: size.width / 2, y: size.height / 2)
            let R  = min(size.width, size.height) * 0.42
            let r1 = R * 0.95    // outermost ring radius (mirrors Ring 1 in JarvisReactorCanvas)

            let pi2     = Double.pi * 2.0
            let segArc  = pi2 / 48.0
            let gapFrac = 0.15
            let top     = -Double.pi / 2.0

            for (trailPhase, opacity) in trails {
                let speedMul = speedMultiplier
                let ph = trailPhase * speedMul
                for i in 0..<48 {
                    let segStart = Double(i) * segArc + top + ph * (pi2 / 100.0)
                    let segEnd   = segStart + segArc * (1.0 - gapFrac)
                    let ap = Path { p in
                        p.addArc(center: c, radius: r1,
                                 startAngle: .radians(segStart),
                                 endAngle:   .radians(segEnd),
                                 clockwise: false)
                    }
                    ctx.stroke(ap,
                               with: .color(cyan.opacity(opacity)),
                               style: StrokeStyle(lineWidth: 8, lineCap: .butt))
                }
            }
        }
        .allowsHitTesting(false)
    }
}
