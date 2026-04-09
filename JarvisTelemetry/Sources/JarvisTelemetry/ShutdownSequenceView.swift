// File: Sources/JarvisTelemetry/ShutdownSequenceView.swift
// JARVIS shutdown — rings decelerate, particles implode, core dims, final flash

import SwiftUI

struct ShutdownSequenceView: View {
    @EnvironmentObject var phaseController: HUDPhaseController
    @EnvironmentObject var store: TelemetryStore

    private let jarvisWhite = Color.white
    private let jarvisSilver = Color(red: 0.85, green: 0.90, blue: 0.95)

    var body: some View {
        let p = phaseController.shutdownProgress

        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let cx = w / 2
            let cy = h / 2
            let R = min(w, h) * 0.42

            TimelineView(.animation(minimumInterval: 1.0/60.0)) { _ in
                ZStack {
                    Color.black.ignoresSafeArea()

                    // ── RINGS FADING OUT (0-70%) — outer first, inner last ──
                    if p < 0.75 {
                        Canvas { ctx, size in
                            let c = CGPoint(x: cx, y: cy)
                            let pi2 = Double.pi * 2.0
                            let rings: [(Double, Double)] = [
                                (0.95, 0.0), (0.93, 0.04), (0.90, 0.08),
                                (0.88, 0.12), (0.82, 0.16), (0.78, 0.22),
                                (0.70, 0.28), (0.65, 0.32), (0.55, 0.38),
                                (0.44, 0.44), (0.22, 0.52), (0.15, 0.58)
                            ]
                            for (rFrac, fadeStart) in rings {
                                let ringOp: Double
                                if p > fadeStart + 0.18 { ringOp = 0 }
                                else if p > fadeStart { ringOp = 1.0 - (p - fadeStart) / 0.18 }
                                else { ringOp = 1.0 }
                                guard ringOp > 0.01 else { continue }
                                let r = R * rFrac
                                let path = Path { p in p.addArc(center: c, radius: r, startAngle: .zero, endAngle: .radians(pi2), clockwise: false) }
                                ctx.stroke(path, with: .color(jarvisWhite.opacity(0.05 * ringOp)), style: StrokeStyle(lineWidth: 16))
                                ctx.stroke(path, with: .color(jarvisWhite.opacity(0.25 * ringOp)), style: StrokeStyle(lineWidth: 5))
                                ctx.stroke(path, with: .color(jarvisWhite.opacity(0.70 * ringOp)), style: StrokeStyle(lineWidth: 2))
                            }
                        }
                        .allowsHitTesting(false)
                    }

                    // ── CORE DIMMING (0-85%) ──
                    if p < 0.85 {
                        Canvas { ctx, size in
                            let c = CGPoint(x: cx, y: cy)
                            let bright = p > 0.55 ? max(0, 1.0 - (p - 0.55) / 0.30) : 1.0
                            let scale = p > 0.55 ? max(0.2, 1.0 - (p - 0.55) / 0.40) : 1.0

                            for layer in 0..<max(1, Int(12.0 * bright)) {
                                let lr = R * 0.005 * scale + Double(layer) * R * 0.015 * scale
                                let lo = 0.22 * bright * (1.0 - Double(layer) / 12.0)
                                let rect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                                ctx.fill(Path(ellipseIn: rect), with: .color(jarvisWhite.opacity(lo)))
                            }
                            let hotR = R * 0.04 * scale * bright
                            let hotRect = CGRect(x: c.x - hotR, y: c.y - hotR, width: hotR * 2, height: hotR * 2)
                            ctx.fill(Path(ellipseIn: hotRect), with: .color(Color.white.opacity(0.75 * bright)))
                        }
                        .allowsHitTesting(false)
                    }

                    // ── PARTICLE IMPLOSION (25-72%) ──
                    if p > 0.25 && p < 0.75 {
                        Canvas { ctx, size in
                            let c = CGPoint(x: cx, y: cy)
                            let ip = (p - 0.25) / 0.50
                            let t = ip * ip

                            for i in 0..<25 {
                                let seed = Double(i) * 137.508
                                let startX = (sin(seed * 2.3) + 1) / 2 * Double(w)
                                let startY = (cos(seed * 3.7) + 1) / 2 * Double(h)
                                let x = startX + (Double(c.x) - startX) * t
                                let y = startY + (Double(c.y) - startY) * t
                                let dist = sqrt(pow(x - Double(c.x), 2) + pow(y - Double(c.y), 2))
                                let maxDist = sqrt(pow(Double(w)/2, 2) + pow(Double(h)/2, 2))
                                let opacity = min(0.50, dist / maxDist)
                                let sz = 2.0 + (1.0 - ip)
                                let rect = CGRect(x: x - sz/2, y: y - sz/2, width: sz, height: sz)
                                ctx.fill(Path(ellipseIn: rect), with: .color(jarvisWhite.opacity(opacity)))
                                if dist < 25 {
                                    let fRect = CGRect(x: x - sz * 2, y: y - sz * 2, width: sz * 4, height: sz * 4)
                                    ctx.fill(Path(ellipseIn: fRect), with: .color(Color.white.opacity(0.20)))
                                }
                            }
                        }
                        .allowsHitTesting(false)
                    }

                    // ── "SHUTDOWN INITIATED" (0-20%) ──
                    if p < 0.22 {
                        let textOp = p < 0.03 ? p / 0.03 : max(0, 1.0 - (p - 0.15) / 0.07)
                        Text("SHUTDOWN INITIATED")
                            .font(.custom("Menlo", size: 14)).tracking(8)
                            .foregroundColor(jarvisWhite.opacity(textOp * 0.80))
                            .shadow(color: jarvisWhite.opacity(textOp * 0.30), radius: 10)
                            .position(x: cx, y: cy + R + 55)
                    }

                    // ── STATUS MESSAGES (10-70%) ──
                    ShutdownMessages(progress: p, cx: cx, cy: cy, R: R, color: jarvisWhite)

                    // ── FINAL FLASH (80-90%) ──
                    if p > 0.80 && p < 0.90 {
                        let flash = max(0, 1.0 - abs(p - 0.84) / 0.05)
                        Circle()
                            .fill(Color.white.opacity(0.65 * flash))
                            .frame(width: R * 0.15 * flash, height: R * 0.15 * flash)
                            .position(x: cx, y: cy)
                    }

                    // ── "JARVIS OFFLINE" (88-98%) ──
                    if p > 0.88 {
                        let textOp = p < 0.92 ? (p - 0.88) / 0.04 : max(0, 1.0 - (p - 0.95) / 0.03)
                        Text("JARVIS OFFLINE")
                            .font(.custom("Menlo", size: 16)).tracking(10)
                            .foregroundColor(jarvisSilver.opacity(textOp * 0.60))
                            .shadow(color: jarvisWhite.opacity(textOp * 0.20), radius: 8)
                            .position(x: cx, y: cy)
                    }
                }
            }
        }
    }
}

// MARK: - Shutdown Status Messages

struct ShutdownMessages: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let color: Color

    private var messages: [(String, Double, Double)] {
        [
            ("SECURING TELEMETRY STREAM...", 0.10, 0.25),
            ("CORE METRICS: ARCHIVED", 0.18, 0.33),
            ("POWERING DOWN SUBSYSTEMS...", 0.25, 0.42),
            ("GPU COMPLEX: OFFLINE", 0.35, 0.52),
            ("CORE CLUSTERS: OFFLINE", 0.45, 0.62),
            ("THERMAL MONITORING: SUSPENDED", 0.55, 0.72),
        ]
    }

    var body: some View {
        VStack(spacing: 4) {
            ForEach(Array(messages.enumerated()), id: \.offset) { _, msg in
                if progress >= msg.1 {
                    let fadeIn = min(1.0, (progress - msg.1) / 0.03)
                    let fadeOut = progress > msg.2 ? max(0, 1.0 - (progress - msg.2) / 0.05) : 1.0
                    let chars = min(msg.0.count, Int((progress - msg.1) * 67))
                    Text(String(msg.0.prefix(chars)))
                        .font(.custom("Menlo", size: 9)).tracking(2)
                        .foregroundColor(color.opacity(fadeIn * fadeOut * 0.50))
                        .shadow(color: color.opacity(fadeIn * fadeOut * 0.15), radius: 4)
                }
            }
        }
        .position(x: cx, y: cy + R + 85)
    }
}
