// File: Sources/JarvisTelemetry/BootSequenceView.swift
// JARVIS boot sequence — white/silver bloom on black, matching main HUD

import SwiftUI

struct BootSequenceView: View {
    @EnvironmentObject var phaseController: HUDPhaseController
    @EnvironmentObject var store: TelemetryStore

    private let jarvisWhite = Color.white
    private let jarvisSilver = Color(red: 0.85, green: 0.90, blue: 0.95)

    var body: some View {
        let p = phaseController.bootProgress
        let isWake = phaseController.phase == .boot(isWake: true)

        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let cx = w / 2
            let cy = h / 2
            let R = min(w, h) * 0.42

            ZStack {
                Color.black.ignoresSafeArea()

                // ── CORE IGNITION (0-15%) ──
                if p > 0.02 {
                    Canvas { ctx, size in
                        let c = CGPoint(x: cx, y: cy)
                        let coreP = min(1.0, p / 0.15)
                        let pulse = 0.85 + sin(p * 40) * 0.15

                        for layer in 0..<Int(coreP * 15) {
                            let lr = 2.0 + Double(layer) * R * 0.014
                            let lo = 0.25 * pulse * coreP * (1.0 - Double(layer) / 15.0)
                            let rect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                            ctx.fill(Path(ellipseIn: rect), with: .color(jarvisWhite.opacity(lo)))
                        }

                        let hotR = (2.0 + coreP * R * 0.05) * pulse
                        let hotRect = CGRect(x: c.x - hotR, y: c.y - hotR, width: hotR * 2, height: hotR * 2)
                        ctx.fill(Path(ellipseIn: hotRect), with: .color(Color.white.opacity(0.90 * coreP)))

                        if p > 0.06 && p < 0.12 {
                            let flash = 1.0 - abs(p - 0.08) / 0.04
                            let flashR = R * 0.20 * flash
                            let fRect = CGRect(x: c.x - flashR, y: c.y - flashR, width: flashR * 2, height: flashR * 2)
                            ctx.fill(Path(ellipseIn: fRect), with: .color(Color.white.opacity(0.55 * flash)))
                        }
                    }
                    .allowsHitTesting(false)
                }

                // ── SHOCKWAVE (5-18%) ──
                if p > 0.05 && p < 0.20 {
                    Canvas { ctx, size in
                        let c = CGPoint(x: cx, y: cy)
                        let sp = (p - 0.05) / 0.15
                        let r = sp * max(w, h) * 0.7
                        let opacity = (1.0 - sp) * 0.40
                        let path = Path { p in p.addArc(center: c, radius: r, startAngle: .zero, endAngle: .radians(.pi * 2), clockwise: false) }
                        ctx.stroke(path, with: .color(jarvisWhite.opacity(opacity)), style: StrokeStyle(lineWidth: 2.0 + sp * 3.0))
                    }
                    .allowsHitTesting(false)
                }

                // ── BLOOM RINGS MATERIALIZE (10-60%) ──
                if p > 0.10 {
                    Canvas { ctx, size in
                        let c = CGPoint(x: cx, y: cy)
                        let pi2 = Double.pi * 2.0
                        let rings: [(Double, Double)] = [
                            (0.15, 0.12), (0.22, 0.16), (0.44, 0.20),
                            (0.55, 0.26), (0.65, 0.30), (0.70, 0.35),
                            (0.78, 0.40), (0.82, 0.44), (0.88, 0.48),
                            (0.90, 0.51), (0.93, 0.54), (0.95, 0.57)
                        ]
                        for (rFrac, threshold) in rings {
                            guard p > threshold else { continue }
                            let age = min(1.0, (p - threshold) / 0.06)
                            let r = R * rFrac
                            let path = Path { p in p.addArc(center: c, radius: r, startAngle: .zero, endAngle: .radians(pi2), clockwise: false) }
                            ctx.stroke(path, with: .color(jarvisWhite.opacity(0.03 * age)), style: StrokeStyle(lineWidth: 28))
                            ctx.stroke(path, with: .color(jarvisWhite.opacity(0.08 * age)), style: StrokeStyle(lineWidth: 14))
                            ctx.stroke(path, with: .color(jarvisWhite.opacity(0.35 * age)), style: StrokeStyle(lineWidth: 5))
                            ctx.stroke(path, with: .color(jarvisWhite.opacity(0.80 * age)), style: StrokeStyle(lineWidth: 2))
                        }
                    }
                    .allowsHitTesting(false)
                }

                // ── DATA ARCS FLASH ON (45-65%) ──
                if p > 0.45 {
                    Canvas { ctx, size in
                        let c = CGPoint(x: cx, y: cy)
                        let pi2 = Double.pi * 2.0
                        let top = -Double.pi / 2.0

                        func flashArcs(_ usages: [Double], _ r: Double, _ threshold: Double, fallback: Int) {
                            let vals = usages.isEmpty ? Array(repeating: 0.5, count: fallback) : usages
                            guard p > threshold, !vals.isEmpty else { return }
                            let age = min(1.0, (p - threshold) / 0.08)
                            let n = vals.count; let sw = pi2 / Double(n); let gap = sw * 0.10
                            for (i, u) in vals.enumerated() {
                                let s0 = top + sw * Double(i) + gap / 2
                                let fe = s0 + (sw - gap) * max(u, 0.05)
                                let fp = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(s0), endAngle: .radians(fe), clockwise: false) }
                                let flash = age < 0.3 ? 1.4 : 1.0
                                ctx.stroke(fp, with: .color(jarvisWhite.opacity(0.08 * age)), style: StrokeStyle(lineWidth: 20, lineCap: .round))
                                ctx.stroke(fp, with: .color(jarvisWhite.opacity(0.80 * age * flash)), style: StrokeStyle(lineWidth: 10, lineCap: .round))
                            }
                        }

                        flashArcs(store.eCoreUsages, R * 0.78, 0.45, fallback: max(store.eCoreCount, 10))
                        flashArcs(store.pCoreUsages, R * 0.65, 0.50, fallback: max(store.pCoreCount, 4))
                        flashArcs(store.sCoreUsages, R * 0.55, 0.55, fallback: max(store.sCoreCount, 1))

                        if p > 0.52 {
                            let gAge = min(1.0, (p - 0.52) / 0.08)
                            let gpu = store.gpuUsage > 0 ? store.gpuUsage : 0.4
                            let gS = -Double.pi * 0.75
                            let gE = gS + Double.pi * 1.5 * gpu
                            let gPath = Path { p in p.addArc(center: c, radius: R * 0.88, startAngle: .radians(gS), endAngle: .radians(gE), clockwise: false) }
                            ctx.stroke(gPath, with: .color(jarvisWhite.opacity(0.80 * gAge)), style: StrokeStyle(lineWidth: 10, lineCap: .round))
                        }
                    }
                    .allowsHitTesting(false)
                }

                // ── HARDWARE TEXT (15-85%) — full boot only ──
                if p > 0.15 && !isWake {
                    BootTextStream(progress: p, store: store, textColor: jarvisWhite, accentColor: jarvisSilver)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }

                // ── "JARVIS ONLINE" (90-100%) ──
                if p > 0.90 {
                    let textOp = p < 0.97 ? min(1.0, (p - 0.90) / 0.04) : max(0, 1.0 - (p - 0.97) / 0.03)
                    Text("JARVIS ONLINE")
                        .font(.custom("Menlo", size: 16)).tracking(10)
                        .foregroundColor(jarvisWhite.opacity(textOp * 0.90))
                        .shadow(color: jarvisWhite.opacity(textOp * 0.40), radius: 12)
                        .position(x: cx, y: cy + R + 60)
                }
            }
        }
    }
}

// MARK: - Boot Text Stream

struct BootTextStream: View {
    let progress: Double
    let store: TelemetryStore
    let textColor: Color
    let accentColor: Color

    private var lines: [(String, Color, Double)] {
        let chip = store.chipName.isEmpty || store.chipName == "Apple Silicon" ? "APPLE M4 MAX" : store.chipName.uppercased()
        let eCt = store.eCoreCount > 0 ? store.eCoreCount : 10
        let pCt = store.pCoreCount > 0 ? store.pCoreCount : 4
        let sCt = store.sCoreCount > 0 ? store.sCoreCount : 1
        let gpuCt = store.gpuCoreCount > 0 ? store.gpuCoreCount : 40
        let memGB = store.memoryTotalGB > 0 ? Int(store.memoryTotalGB) : 128
        return [
            ("INITIALIZING JARVIS NEURAL INTERFACE...", textColor, 0.15),
            ("SCANNING SILICON TOPOLOGY...", textColor, 0.20),
            ("\(chip) DETECTED", accentColor, 0.25),
            ("CORE CLUSTER 0: \(eCt)x EFFICIENCY — ONLINE", textColor, 0.35),
            ("CORE CLUSTER 1: \(pCt)x PERFORMANCE — ONLINE", textColor, 0.40),
            ("CORE CLUSTER 2: \(sCt)x STORM — ONLINE", textColor, 0.45),
            ("GPU COMPLEX: \(gpuCt)-CORE — ONLINE", accentColor, 0.50),
            ("UNIFIED MEMORY: \(memGB)GB — MAPPED", textColor, 0.55),
            ("THERMAL ENVELOPE: NOMINAL", textColor, 0.60),
            ("CONFIGURING TELEMETRY STREAM...", textColor, 0.65),
            ("TELEMETRY ACTIVE — 1Hz REFRESH", accentColor, 0.70),
            ("ALL SYSTEMS NOMINAL", accentColor, 0.80),
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Spacer()
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                if progress >= line.2 {
                    let age = progress - line.2
                    let opacity = min(1.0, age / 0.03)
                    let chars = min(line.0.count, Int(age * 67))
                    Text(String(line.0.prefix(chars)))
                        .font(.custom("Menlo", size: 9)).tracking(2)
                        .foregroundColor(line.1.opacity(opacity * 0.60))
                        .shadow(color: line.1.opacity(opacity * 0.20), radius: 4)
                }
            }
            Spacer().frame(height: 50)
        }
        .padding(.leading, 40)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
