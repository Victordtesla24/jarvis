// File: Sources/JarvisTelemetry/ParticleField.swift
// ENHANCED — Cinema-grade particle system with ambient, orbital, and radial particles
// Creates atmospheric depth matching Iron Man JARVIS holographic environment

import SwiftUI

struct ParticleFieldView: View {
    let width: CGFloat
    let height: CGFloat
    let phase: Double
    let speedMultiplier: Double
    let cyan: Color

    // REQ-B10: 30-50 ambient drifters. §7 caps all particle arrays at 50.
    private let ambientCount = 45
    private let orbitalCount = 40
    private let radialCount = 25

    var body: some View {
        Canvas { ctx, size in
            let cx = width / 2
            let cy = height / 2
            let R = min(width, height) * 0.42

            // ── AMBIENT PARTICLES — drifting holographic dust ──
            for i in 0..<ambientCount {
                let seed = Double(i) * 137.508
                let depth = (sin(seed * 0.7) + 1) / 2
                let lifetime = (12.0 + sin(seed * 0.3) * 6.0) / speedMultiplier

                let birthPhase = seed.truncatingRemainder(dividingBy: lifetime)
                let age = (phase - birthPhase).truncatingRemainder(dividingBy: lifetime)
                let normalizedAge = ((age / lifetime) + 1.0).truncatingRemainder(dividingBy: 1.0)

                let x = normalizedAge * (Double(width) + 100) * speedMultiplier - 50
                let wobble = sin(phase * 0.4 + seed * 0.2) * 25
                let vertDrift = cos(phase * 0.15 + seed * 0.5) * 10
                let baseY = (sin(seed * 2.3) + 1) / 2 * Double(height)
                let y = baseY + wobble + vertDrift

                let fadeIn = min(1.0, normalizedAge * 5)
                let fadeOut = min(1.0, (1.0 - normalizedAge) * 5)
                let opacity = fadeIn * fadeOut

                // Distance from center affects brightness — closer = brighter
                let dx = x - Double(cx)
                let dy = y - Double(cy)
                let dist = sqrt(dx * dx + dy * dy)
                let maxDist = sqrt(Double(width * width + height * height)) / 2
                let proximity = max(0, 1.0 - dist / maxDist)
                let brightBoost = 1.0 + proximity * 0.5

                let adjustedSize = (1.5 + depth * 2.0) * (1.0 + depth * 0.5)
                let adjustedOpacity = (0.35 + depth * 0.45) * opacity * brightBoost

                let rect = CGRect(
                    x: x - adjustedSize / 2,
                    y: y - adjustedSize / 2,
                    width: adjustedSize,
                    height: adjustedSize
                )
                ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(adjustedOpacity)))

                // Glow halo for deeper (closer) particles
                if depth > 0.5 {
                    let glowSize = adjustedSize * 3.5
                    let glowRect = CGRect(
                        x: x - glowSize / 2,
                        y: y - glowSize / 2,
                        width: glowSize,
                        height: glowSize
                    )
                    ctx.fill(Path(ellipseIn: glowRect), with: .color(cyan.opacity(adjustedOpacity * 0.35)))
                }
            }

            // ── ORBITAL PARTICLES — tracing ring paths around reactor ──
            for i in 0..<orbitalCount {
                let seed = Double(i) * 97.531 + 50.0
                // Each particle orbits at a specific radius
                let orbitFrac = (sin(seed * 0.47) + 1) / 2  // 0-1
                let orbitR = Double(R) * (0.20 + orbitFrac * 0.82)  // 0.20R to 1.02R

                // Orbital speed varies — inner orbits faster
                let orbitSpeed = (0.03 + (1.0 - orbitFrac) * 0.08) * speedMultiplier
                let direction: Double = i % 3 == 0 ? -1.0 : 1.0  // most CW, some CCW
                let angle = phase * orbitSpeed * direction + seed

                let px = Double(cx) + cos(angle) * orbitR
                let py = Double(cy) + sin(angle) * orbitR

                // Fade based on angular position — creates a "comet tail" effect
                let tailPhase = (angle * 3.0).truncatingRemainder(dividingBy: Double.pi * 2)
                let tailFade = 0.4 + 0.6 * max(0, sin(tailPhase))

                let sz = 1.2 + orbitFrac * 1.0
                let op = (0.20 + orbitFrac * 0.25) * tailFade

                let rect = CGRect(x: px - sz / 2, y: py - sz / 2, width: sz, height: sz)
                ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(op)))

                // Brighter particles get a glow
                if tailFade > 0.7 && orbitFrac > 0.3 {
                    let glowSz = sz * 3
                    let glowRect = CGRect(x: px - glowSz / 2, y: py - glowSz / 2, width: glowSz, height: glowSz)
                    ctx.fill(Path(ellipseIn: glowRect), with: .color(cyan.opacity(op * 0.3)))
                }

                // Motion trail — 2 trailing copies
                for trail in 1...2 {
                    let trailAngle = angle - Double(trail) * 0.03 * direction
                    let tx = Double(cx) + cos(trailAngle) * orbitR
                    let ty = Double(cy) + sin(trailAngle) * orbitR
                    let tSz = sz * 0.6
                    let tOp = op * (0.25 / Double(trail))
                    let tRect = CGRect(x: tx - tSz / 2, y: ty - tSz / 2, width: tSz, height: tSz)
                    ctx.fill(Path(ellipseIn: tRect), with: .color(cyan.opacity(tOp)))
                }
            }

            // ── RADIAL PARTICLES — energy emanating from core outward ──
            for i in 0..<radialCount {
                let seed = Double(i) * 211.7 + 100.0
                // Each particle has a fixed radial direction
                let rayAngle = seed.truncatingRemainder(dividingBy: Double.pi * 2)

                // Particle travels outward in a cycle
                let lifetime = 4.0 + sin(seed * 0.2) * 2.0
                let age = (phase + seed).truncatingRemainder(dividingBy: lifetime)
                let normalizedAge = age / lifetime

                let startR = Double(R) * 0.08
                let endR = Double(R) * (0.50 + (sin(seed * 0.9) + 1) / 2 * 0.55)
                let currentR = startR + (endR - startR) * normalizedAge

                let px = Double(cx) + cos(rayAngle) * currentR
                let py = Double(cy) + sin(rayAngle) * currentR

                // Fade in at start, fade out at end
                let fadeIn = min(1.0, normalizedAge * 8)
                let fadeOut = min(1.0, (1.0 - normalizedAge) * 4)
                let op = fadeIn * fadeOut * 0.35

                let sz = 1.0 + normalizedAge * 0.8  // grows slightly as it travels
                let rect = CGRect(x: px - sz / 2, y: py - sz / 2, width: sz, height: sz)
                ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(op)))

                // Brief bright flash at birth
                if normalizedAge < 0.05 {
                    let flashOp = (1.0 - normalizedAge / 0.05) * 0.5
                    let flashSz = sz * 4
                    let flashRect = CGRect(x: px - flashSz / 2, y: py - flashSz / 2, width: flashSz, height: flashSz)
                    ctx.fill(Path(ellipseIn: flashRect), with: .color(cyan.opacity(flashOp)))
                }
            }
        }
        .allowsHitTesting(false)
    }
}
