// File: Sources/JarvisTelemetry/ShutdownSequenceView.swift

import SwiftUI

struct ShutdownSequenceView: View {
    @EnvironmentObject var phaseController: HUDPhaseController
    @EnvironmentObject var store: TelemetryStore

    private let darkBlue = Color(red: 0.02, green: 0.04, blue: 0.08)
    private let cyan = Color(red: 0.00, green: 0.83, blue: 1.00)
    private let cyanBright = Color(red: 0.41, green: 0.95, blue: 0.95)
    private let steel = Color(red: 0.40, green: 0.52, blue: 0.58)

    var body: some View {
        let p = phaseController.shutdownProgress

        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let cx = w / 2
            let cy = h / 2
            let R = min(w, h) * 0.42

            TimelineView(.animation(minimumInterval: 1.0/60.0)) { timeline in
                let time = timeline.date.timeIntervalSinceReferenceDate

                ZStack {
                    darkBlue.ignoresSafeArea()

                    // Hex grid fading out
                    if p < 0.80 {
                        let gridOp = p > 0.50 ? max(0, 1.0 - (p - 0.50) / 0.30) : 1.0
                        HexGridCanvas(width: w, height: h, phase: time, color: Color(red: 0, green: 0.2, blue: 0.3))
                            .opacity(gridOp)
                    }

                    // Reactor rings decelerating
                    ShutdownReactorView(progress: p, cx: cx, cy: cy, R: R, cyan: cyan, steel: steel)

                    // Particle implosion
                    if p > 0.30 && p < 0.75 {
                        ShutdownParticleImplosion(progress: (p - 0.30) / 0.45, cx: cx, cy: cy,
                                                   width: w, height: h, cyan: cyan)
                    }

                    // Status text
                    ShutdownTextView(progress: p, cx: cx, cy: cy, R: R, cyan: cyan)

                    // "SHUTDOWN INITIATED" (0-20%)
                    if p < 0.25 {
                        let textOp = p < 0.05 ? p / 0.05 : max(0, 1.0 - (p - 0.15) / 0.10)
                        Text("SHUTDOWN INITIATED")
                            .font(.custom("Menlo", size: 12)).tracking(6)
                            .foregroundColor(cyan.opacity(textOp * 0.7))
                            .shadow(color: cyan.opacity(textOp * 0.4), radius: 8)
                            .position(x: cx, y: cy + R + 50)
                    }

                    // Final flash at ~82%
                    if p > 0.80 && p < 0.88 {
                        let flash = max(0, 1.0 - abs(p - 0.83) / 0.05)
                        Circle()
                            .fill(Color.white.opacity(0.5 * flash))
                            .frame(width: R * 0.10 * flash * 2, height: R * 0.10 * flash * 2)
                            .position(x: cx, y: cy)
                    }

                    // "JARVIS OFFLINE" (88-98%)
                    if p > 0.88 {
                        let textOp = p < 0.92 ? (p - 0.88) / 0.04 : max(0, 1.0 - (p - 0.95) / 0.05)
                        Text("JARVIS OFFLINE")
                            .font(.custom("Menlo", size: 14)).tracking(8)
                            .foregroundColor(cyan.opacity(textOp * 0.5))
                            .shadow(color: cyan.opacity(textOp * 0.3), radius: 6)
                            .position(x: cx, y: cy)
                    }
                }
            }
        }
    }
}

struct ShutdownReactorView: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color, steel: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let pi2 = Double.pi * 2.0
            let maxRings = max(0, Int((1.0 - progress * 0.8) * 220))

            for i in 0..<min(maxRings, 220) {
                let frac = Double(i) / 220.0
                let r = R * (0.06 + frac * 0.91)
                let fadeStart = frac * 0.6
                let ringOpacity: Double
                if progress > fadeStart + 0.30 { ringOpacity = 0 }
                else if progress > fadeStart { ringOpacity = 1.0 - (progress - fadeStart) / 0.30 }
                else { ringOpacity = 1.0 }

                guard ringOpacity > 0.01 else { continue }
                let baseOp = (0.14 + (1.0 - frac) * 0.22) * ringOpacity

                let path = Path { p in p.addArc(center: c, radius: r, startAngle: .zero, endAngle: .radians(pi2), clockwise: false) }
                ctx.stroke(path, with: .color(steel.opacity(baseOp * 0.7)), style: StrokeStyle(lineWidth: 0.4))
            }

            // Core dimming
            if progress < 0.85 {
                let bright = progress > 0.60 ? max(0, 1.0 - (progress - 0.60) / 0.25) : 1.0
                let scale = progress > 0.60 ? max(0.3, 1.0 - (progress - 0.60) / 0.40) : 1.0
                let coreR = R * 0.015 * scale

                for layer in 0..<3 {
                    let lr = coreR + Double(layer) * 2
                    let lo = 0.06 * bright * (1.0 - Double(layer) / 3.0)
                    let rect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                    ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(lo)))
                }
                let hotRect = CGRect(x: c.x - coreR, y: c.y - coreR, width: coreR * 2, height: coreR * 2)
                ctx.fill(Path(ellipseIn: hotRect), with: .color(Color.white.opacity(0.12 * bright)))
            }
        }
        .allowsHitTesting(false)
    }
}

struct ShutdownParticleImplosion: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat
    let width: CGFloat, height: CGFloat
    let cyan: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            for i in 0..<30 {
                let seed = Double(i) * 137.508
                let startX = (sin(seed * 2.3) + 1) / 2 * Double(width)
                let startY = (cos(seed * 3.7) + 1) / 2 * Double(height)
                let t = progress * progress
                let x = startX + (Double(c.x) - startX) * t
                let y = startY + (Double(c.y) - startY) * t
                let dist = sqrt(pow(x - Double(c.x), 2) + pow(y - Double(c.y), 2))
                let maxDist = sqrt(pow(Double(width)/2, 2) + pow(Double(height)/2, 2))
                let opacity = min(0.4, dist / maxDist)
                let sz = 1.5 + (1.0 - progress)
                let rect = CGRect(x: x - sz/2, y: y - sz/2, width: sz, height: sz)
                ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(opacity)))
                if dist < 20 {
                    let fSz = sz * 3
                    let fRect = CGRect(x: x - fSz/2, y: y - fSz/2, width: fSz, height: fSz)
                    ctx.fill(Path(ellipseIn: fRect), with: .color(Color.white.opacity(0.15)))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

struct ShutdownTextView: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color

    private var messages: [(String, Double, Double)] {
        [
            ("SECURING TELEMETRY STREAM...", 0.12, 0.25),
            ("CORE METRICS: ARCHIVED", 0.20, 0.35),
            ("POWERING DOWN SUBSYSTEMS...", 0.28, 0.45),
            ("GPU COMPLEX: OFFLINE", 0.38, 0.55),
            ("CORE CLUSTERS: OFFLINE", 0.48, 0.65),
            ("THERMAL MONITORING: SUSPENDED", 0.58, 0.75),
        ]
    }

    var body: some View {
        VStack(spacing: 4) {
            ForEach(Array(messages.enumerated()), id: \.offset) { _, msg in
                if progress >= msg.1 {
                    let fadeIn = min(1.0, (progress - msg.1) / 0.03)
                    let fadeOut = progress > msg.2 ? max(0, 1.0 - (progress - msg.2) / 0.05) : 1.0
                    Text(msg.0)
                        .font(.custom("Menlo", size: 9)).tracking(2)
                        .foregroundColor(cyan.opacity(fadeIn * fadeOut * 0.5))
                }
            }
        }
        .position(x: cx, y: cy + R + 80)
    }
}
