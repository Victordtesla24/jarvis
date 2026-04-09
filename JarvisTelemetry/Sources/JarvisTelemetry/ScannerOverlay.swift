// File: Sources/JarvisTelemetry/ScannerOverlay.swift

import SwiftUI

struct ScannerSweepOverlay: View {
    let width: CGFloat
    let height: CGFloat
    let phase: Double
    let cyan: Color

    var body: some View {
        Canvas { ctx, size in
            let sweepPeriod = 35.0
            let sweepDuration = 3.0
            let cyclePhase = phase.truncatingRemainder(dividingBy: sweepPeriod)

            guard cyclePhase < sweepDuration else { return }

            let sweepProgress = cyclePhase / sweepDuration
            let scanY = sweepProgress * Double(height)
            let trailHeight: Double = 40

            let scanLine = Path { p in
                p.move(to: CGPoint(x: 0, y: scanY))
                p.addLine(to: CGPoint(x: Double(width), y: scanY))
            }
            ctx.stroke(scanLine, with: .color(cyan.opacity(0.35)), style: StrokeStyle(lineWidth: 1.5))
            ctx.stroke(scanLine, with: .color(Color.white.opacity(0.12)), style: StrokeStyle(lineWidth: 0.5))

            for i in 0..<Int(trailHeight) {
                let y = scanY - Double(i)
                guard y >= 0 else { continue }
                let trailOpacity = (1.0 - Double(i) / trailHeight) * 0.06
                let trail = Path { p in
                    p.move(to: CGPoint(x: 0, y: y))
                    p.addLine(to: CGPoint(x: Double(width), y: y))
                }
                ctx.stroke(trail, with: .color(cyan.opacity(trailOpacity)), style: StrokeStyle(lineWidth: 1))
            }
        }
        .allowsHitTesting(false)
    }
}
