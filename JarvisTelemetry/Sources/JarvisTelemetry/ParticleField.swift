// File: Sources/JarvisTelemetry/ParticleField.swift

import SwiftUI

struct ParticleFieldView: View {
    let width: CGFloat
    let height: CGFloat
    let phase: Double
    let speedMultiplier: Double
    let cyan: Color

    private let targetCount = 40

    var body: some View {
        Canvas { ctx, size in
            let particles = generateParticles(phase: phase, width: Double(width), height: Double(height))

            for p in particles {
                let adjustedSize = (1.0 + p.depth) * p.size
                let adjustedOpacity = (0.1 + p.depth * 0.2) * p.opacity
                let rect = CGRect(
                    x: p.x - adjustedSize / 2,
                    y: p.y - adjustedSize / 2,
                    width: adjustedSize,
                    height: adjustedSize
                )
                ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(adjustedOpacity)))

                if p.depth > 0.6 {
                    let glowSize = adjustedSize * 3
                    let glowRect = CGRect(
                        x: p.x - glowSize / 2,
                        y: p.y - glowSize / 2,
                        width: glowSize,
                        height: glowSize
                    )
                    ctx.fill(Path(ellipseIn: glowRect), with: .color(cyan.opacity(adjustedOpacity * 0.15)))
                }
            }
        }
        .allowsHitTesting(false)
    }

    private struct ParticleData {
        var x: Double, y: Double, opacity: Double, size: Double, depth: Double
    }

    private func generateParticles(phase: Double, width: Double, height: Double) -> [ParticleData] {
        var result: [ParticleData] = []
        for i in 0..<targetCount {
            let seed = Double(i) * 137.508
            let depth = (sin(seed * 0.7) + 1) / 2
            let lifetime = 15.0 + sin(seed * 0.3) * 8.0

            let birthPhase = seed.truncatingRemainder(dividingBy: lifetime)
            let age = (phase - birthPhase).truncatingRemainder(dividingBy: lifetime)
            let normalizedAge = ((age / lifetime) + 1.0).truncatingRemainder(dividingBy: 1.0)

            let x = normalizedAge * (width + 100) - 50
            let wobble = sin(phase * 0.5 + seed * 0.2) * 30
            let baseY = (sin(seed * 2.3) + 1) / 2 * height
            let y = baseY + wobble

            let fadeIn = min(1.0, normalizedAge * 5)
            let fadeOut = min(1.0, (1.0 - normalizedAge) * 5)
            let opacity = fadeIn * fadeOut

            let size = 1.0 + depth * 1.5

            result.append(ParticleData(x: x, y: y, opacity: opacity, size: size, depth: depth))
        }
        return result
    }
}
