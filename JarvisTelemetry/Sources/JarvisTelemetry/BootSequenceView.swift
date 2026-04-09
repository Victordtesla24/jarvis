// File: Sources/JarvisTelemetry/BootSequenceView.swift

import SwiftUI

struct BootSequenceView: View {
    @EnvironmentObject var phaseController: HUDPhaseController
    @EnvironmentObject var store: TelemetryStore

    private let darkBlue = Color(red: 0.02, green: 0.04, blue: 0.08)
    private let cyan = Color(red: 0.00, green: 0.83, blue: 1.00)
    private let cyanBright = Color(red: 0.41, green: 0.95, blue: 0.95)
    private let cyanDim = Color(red: 0.00, green: 0.55, blue: 0.70)
    private let amber = Color(red: 1.00, green: 0.78, blue: 0.00)
    private let crimson = Color(red: 1.00, green: 0.15, blue: 0.20)
    private let steel = Color(red: 0.40, green: 0.52, blue: 0.58)

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
                darkBlue.ignoresSafeArea()

                // Phase 1: Core ignition (0-15%)
                if p > 0.02 {
                    BootCoreView(progress: p, cx: cx, cy: cy, R: R, cyan: cyan, cyanBright: cyanBright)
                }

                // Phase 2: Ring materialization (10-60%)
                if p > 0.10 {
                    BootRingsView(progress: p, cx: cx, cy: cy, R: R,
                                  cyan: cyan, cyanDim: cyanDim, amber: amber, crimson: crimson, steel: steel,
                                  store: store)
                }

                // Phase 3: Hex grid fade-in (25-40%)
                if p > 0.25 {
                    let gridOpacity = min(1.0, (p - 0.25) / 0.15)
                    HexGridCanvas(width: w, height: h, phase: p * 10, color: Color(red: 0, green: 0.2, blue: 0.3))
                        .opacity(gridOpacity)
                }

                // Phase 4: Scan lines (30%+)
                if p > 0.30 {
                    let scanOp = min(1.0, (p - 0.30) / 0.10)
                    ScanLineOverlay(height: h, phase: p * 10, color: cyan)
                        .opacity(scanOp)
                }

                // Phase 5: Shockwave ring at ignition (5-15%)
                if p > 0.05 && p < 0.20 {
                    BootShockwaveView(progress: (p - 0.05) / 0.15, cx: cx, cy: cy, maxR: max(w, h), cyan: cyan)
                }

                // Phase 6: Text diagnostic stream (15-90%) — full boot only
                if p > 0.15 && !isWake {
                    BootTextStream(progress: p, store: store, cyan: cyan, cyanBright: cyanBright, amber: amber, crimson: crimson)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }

                // Phase 7: "JARVIS ONLINE" text (90-100%)
                if p > 0.90 {
                    let textOp = p < 0.98 ? min(1.0, (p - 0.90) / 0.05) : max(0, 1.0 - (p - 0.98) / 0.02)
                    Text("JARVIS ONLINE")
                        .font(.custom("Menlo", size: 14)).tracking(8)
                        .foregroundColor(cyanBright.opacity(textOp))
                        .shadow(color: cyan.opacity(textOp * 0.8), radius: 12)
                        .position(x: cx, y: cy + R + 60)
                }
            }
        }
    }
}

// MARK: - Boot Sub-Components

struct BootCoreView: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color, cyanBright: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let coreProgress = min(1.0, progress / 0.30)
            let coreR = 2.0 + coreProgress * R * 0.015
            let glowR = coreR * 4
            let pulse = 0.85 + sin(progress * 40) * 0.15

            for layer in 0..<5 {
                let lr = glowR + Double(layer) * 3
                let op = 0.08 * pulse * (1.0 - Double(layer) / 5.0) * coreProgress
                let rect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(op)))
            }

            let hotRect = CGRect(x: c.x - coreR, y: c.y - coreR, width: coreR * 2, height: coreR * 2)
            ctx.fill(Path(ellipseIn: hotRect), with: .color(Color.white.opacity(0.3 * pulse * coreProgress)))
            ctx.fill(Path(ellipseIn: hotRect), with: .color(cyanBright.opacity(0.5 * pulse * coreProgress)))

            // Ignition flash at ~8% progress
            if progress > 0.06 && progress < 0.12 {
                let flashIntensity = 1.0 - abs(progress - 0.08) / 0.04
                let flashR = R * 0.15 * flashIntensity
                let flashRect = CGRect(x: c.x - flashR, y: c.y - flashR, width: flashR * 2, height: flashR * 2)
                ctx.fill(Path(ellipseIn: flashRect), with: .color(Color.white.opacity(0.4 * flashIntensity)))
            }
        }
        .allowsHitTesting(false)
    }
}

struct BootRingsView: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color, cyanDim: Color, amber: Color, crimson: Color, steel: Color
    let store: TelemetryStore

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let pi2 = Double.pi * 2.0
            let top = -Double.pi / 2.0

            let ringProgress = min(1.0, (progress - 0.10) / 0.50)
            let maxRingIndex = Int(ringProgress * 220)

            for i in 0..<min(maxRingIndex, 220) {
                let frac = Double(i) / 220.0
                let r = R * (0.06 + frac * 0.91)
                let ringBirthProgress = Double(i) / 220.0
                let ringAge = ringProgress - ringBirthProgress
                let ringOpacity = min(1.0, ringAge * 10)
                let distFromCenter = 1.0 - frac
                let baseOp = (0.14 + distFromCenter * 0.22) * ringOpacity
                let m = i % 18

                let path = Path { p in
                    p.addArc(center: c, radius: r, startAngle: .zero,
                             endAngle: .radians(pi2), clockwise: false)
                }

                if m == 0 {
                    ctx.stroke(path, with: .color(steel.opacity(min(baseOp + 0.18, 0.50))),
                               style: StrokeStyle(lineWidth: 2.2))
                } else if m == 3 || m == 12 {
                    ctx.stroke(path, with: .color(steel.opacity(baseOp * 1.2)),
                               style: StrokeStyle(lineWidth: 2.0))
                } else {
                    ctx.stroke(path, with: .color(steel.opacity(baseOp * 0.7)),
                               style: StrokeStyle(lineWidth: 0.4))
                }
            }

            // Core arcs at 45-55%
            if progress > 0.45 {
                let arcOp = min(1.0, (progress - 0.45) / 0.10)
                let eCores = store.eCoreUsages.isEmpty
                    ? Array(repeating: 0.5, count: max(store.eCoreCount, 10))
                    : store.eCoreUsages
                drawCoreArcs(ctx: ctx, c: c, usages: eCores, r: R * 0.845, w: 3, col: cyan, opacity: arcOp, top: top, pi2: pi2)

                if progress > 0.50 {
                    let pOp = min(1.0, (progress - 0.50) / 0.08)
                    let pCores = store.pCoreUsages.isEmpty
                        ? Array(repeating: 0.5, count: max(store.pCoreCount, 4))
                        : store.pCoreUsages
                    drawCoreArcs(ctx: ctx, c: c, usages: pCores, r: R * 0.745, w: 3, col: amber, opacity: pOp, top: top, pi2: pi2)
                }

                if progress > 0.55 {
                    let sOp = min(1.0, (progress - 0.55) / 0.08)
                    let sCores = store.sCoreUsages.isEmpty
                        ? Array(repeating: 0.3, count: max(store.sCoreCount, 1))
                        : store.sCoreUsages
                    drawCoreArcs(ctx: ctx, c: c, usages: sCores, r: R * 0.645, w: 2.5, col: crimson, opacity: sOp, top: top, pi2: pi2)
                }

                if progress > 0.55 {
                    let gOp = min(1.0, (progress - 0.55) / 0.08)
                    let gpu = store.gpuUsage > 0 ? store.gpuUsage : 0.4
                    let gS = -Double.pi * 0.75
                    let gE = gS + Double.pi * 1.5 * gpu
                    let gPath = Path { p in
                        p.addArc(center: c, radius: R * 0.915,
                                 startAngle: .radians(gS), endAngle: .radians(gE), clockwise: false)
                    }
                    ctx.stroke(gPath, with: .color(cyan.opacity(0.65 * gOp)),
                               style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                }
            }
        }
        .allowsHitTesting(false)
    }

    private func drawCoreArcs(ctx: GraphicsContext, c: CGPoint, usages: [Double],
                               r: Double, w: Double, col: Color, opacity: Double,
                               top: Double, pi2: Double) {
        let n = usages.count
        guard n > 0 else { return }
        let sw = pi2 / Double(n)
        let gap = sw * 0.06

        for (i, u) in usages.enumerated() {
            let s0 = top + sw * Double(i) + gap / 2
            let s1 = s0 + sw - gap
            let fe = s0 + (s1 - s0) * max(u, 0.05)
            let fp = Path { p in
                p.addArc(center: c, radius: r,
                         startAngle: .radians(s0), endAngle: .radians(fe), clockwise: false)
            }
            ctx.stroke(fp, with: .color(col.opacity(0.65 * opacity)),
                       style: StrokeStyle(lineWidth: w, lineCap: .round))
        }
    }
}

struct BootShockwaveView: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, maxR: CGFloat
    let cyan: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let r = progress * maxR * 0.8
            let opacity = (1.0 - progress) * 0.5
            let width = 2.0 + progress * 4.0

            let path = Path { p in
                p.addArc(center: c, radius: r, startAngle: .zero,
                         endAngle: .radians(.pi * 2), clockwise: false)
            }
            ctx.stroke(path, with: .color(cyan.opacity(opacity)),
                       style: StrokeStyle(lineWidth: width))
            ctx.stroke(path, with: .color(Color.white.opacity(opacity * 0.3)),
                       style: StrokeStyle(lineWidth: width * 0.3))
        }
        .allowsHitTesting(false)
    }
}

struct BootTextStream: View {
    let progress: Double
    let store: TelemetryStore
    let cyan: Color, cyanBright: Color, amber: Color, crimson: Color

    private var visibleLines: [(text: String, color: Color, threshold: Double)] {
        let chip = store.chipName.isEmpty || store.chipName == "Apple Silicon"
            ? "APPLE M4 MAX" : store.chipName.uppercased()
        let eCt = store.eCoreCount > 0 ? store.eCoreCount : 10
        let pCt = store.pCoreCount > 0 ? store.pCoreCount : 4
        let sCt = store.sCoreCount > 0 ? store.sCoreCount : 1
        let gpuCt = store.gpuCoreCount > 0 ? store.gpuCoreCount : 40
        let memGB = store.memoryTotalGB > 0 ? Int(store.memoryTotalGB) : 128

        return [
            ("INITIALIZING JARVIS NEURAL INTERFACE...", cyan, 0.15),
            ("SCANNING SILICON TOPOLOGY...", cyan, 0.20),
            ("\(chip) DETECTED", cyanBright, 0.25),
            ("CORE CLUSTER 0: \(eCt)x EFFICIENCY — ONLINE", cyan, 0.35),
            ("CORE CLUSTER 1: \(pCt)x PERFORMANCE — ONLINE", amber, 0.40),
            ("CORE CLUSTER 2: \(sCt)x STORM — ONLINE", crimson, 0.45),
            ("GPU COMPLEX: \(gpuCt)-CORE — ONLINE", cyan, 0.50),
            ("UNIFIED MEMORY: \(memGB)GB — MAPPED", cyan, 0.55),
            ("THERMAL ENVELOPE: NOMINAL", cyan, 0.60),
            ("CONFIGURING TELEMETRY STREAM...", cyan, 0.65),
            ("TELEMETRY ACTIVE — 1Hz REFRESH", cyanBright, 0.70),
            ("ALL SYSTEMS NOMINAL", cyanBright, 0.80),
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Spacer()

            ForEach(Array(visibleLines.enumerated()), id: \.offset) { idx, line in
                if progress >= line.threshold {
                    let lineAge = progress - line.threshold
                    let opacity = min(1.0, lineAge / 0.03)
                    let charsToShow = min(line.text.count, Int(lineAge * 600))
                    let displayText = String(line.text.prefix(charsToShow))

                    Text(displayText)
                        .font(.custom("Menlo", size: 9)).tracking(2)
                        .foregroundColor(line.color.opacity(opacity * 0.7))
                        .shadow(color: line.color.opacity(opacity * 0.3), radius: 4)
                }
            }

            Spacer().frame(height: 40)
        }
        .padding(.leading, 40)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
