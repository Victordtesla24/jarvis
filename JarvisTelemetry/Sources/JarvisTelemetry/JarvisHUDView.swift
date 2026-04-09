// File: Sources/JarvisTelemetry/JarvisHUDView.swift
// Iron Man JARVIS — Cinema-grade HUD matching real-jarvis-01/02/03.jpg
// Full-screen reactor + corner brackets + side gauges + hex grid + scan lines
// All rendering in Canvas for GPU efficiency at 60fps

import SwiftUI

// MARK: - Main HUD ────────────────────────────────────────────────────────────

struct JarvisHUDView: View {
    @EnvironmentObject var store: TelemetryStore
    @Environment(\.animationPhase) var phase
    @StateObject private var chatterEngine = ChatterEngine()
    @StateObject private var awarenessEngine = AwarenessEngine()
    @StateObject private var floatingPanelManager = FloatingPanelManager()

    // ── Jarvis color palette (matched from reference screenshots) ────────
    private let cyan      = Color(red: 0.00, green: 0.83, blue: 1.00)   // #00D4FF — primary
    private let cyanBright = Color(red: 0.41, green: 0.95, blue: 0.95)  // #69F1F1 — highlights
    private let cyanDim   = Color(red: 0.00, green: 0.55, blue: 0.70)   // #008CB3 — subtle
    private let amber     = Color(red: 1.00, green: 0.78, blue: 0.00)   // #FFC800
    private let crimson   = Color(red: 1.00, green: 0.15, blue: 0.20)   // #FF2633
    private let steel     = Color(red: 0.40, green: 0.52, blue: 0.58)   // #668494
    private let darkBlue  = Color(red: 0.02, green: 0.04, blue: 0.08)   // #050A14 — background
    private let gridBlue  = Color(red: 0.00, green: 0.20, blue: 0.30)   // #00334D — grid lines

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let cx = w / 2
            let cy = h / 2
            let R  = min(w, h) * 0.42  // Reactor radius (slightly smaller to leave room for side panels)

            ZStack {
                // ── 1. BACKGROUND: dark blue-black (shifts crimson under thermal threat) ──
                let thermalThreat = store.thermalState.lowercased().contains("serious") || store.thermalState.lowercased().contains("critical")
                let bgColor = thermalThreat ? Color(red: 0.04, green: 0.02, blue: 0.03) : Color.black
                bgColor.ignoresSafeArea()

                // Hex grid background
                HexGridCanvas(width: w, height: h, phase: phase, color: gridBlue)

                // Reactor ambient bloom — CINEMA GRADE volumetric light cast
                RadialGradient(
                    gradient: Gradient(colors: [
                        cyan.opacity(0.12),
                        cyan.opacity(0.08),
                        cyan.opacity(0.04),
                        Color.white.opacity(0.015),
                        Color.clear
                    ]),
                    center: .center,
                    startRadius: R * 0.03,
                    endRadius: R * 1.6
                )
                .ignoresSafeArea()
                // Secondary bloom — tighter, brighter core glow
                RadialGradient(
                    gradient: Gradient(colors: [
                        cyan.opacity(0.10),
                        cyan.opacity(0.04),
                        Color.clear
                    ]),
                    center: .center,
                    startRadius: R * 0.01,
                    endRadius: R * 0.5
                )
                .ignoresSafeArea()

                // ── 2. SCAN LINE OVERLAY ─────────────────────────────────
                ScanLineOverlay(height: h, phase: phase, color: cyan)

                // ── 2b. AMBIENT PARTICLES ───────────────────────────────
                ParticleFieldView(
                    width: w, height: h, phase: phase,
                    speedMultiplier: 1.0,
                    cyan: cyan
                )

                // ── 3. FULL REACTOR ──────────────────────────────────────
                JarvisReactorCanvas(
                    store: store, phase: phase,
                    center: CGPoint(x: cx, y: cy), R: R,
                    cyan: cyan, cyanBright: cyanBright, cyanDim: cyanDim,
                    amber: amber, crimson: crimson, steel: steel
                )

                // ── 4. CORNER HUD BRACKETS ───────────────────────────────
                CornerBracketsOverlay(width: w, height: h, color: cyan, steel: steel, phase: phase)

                // ── 5. TOP BAR: time + date ──────────────────────────────
                TopBarView(store: store, width: w, cyan: cyan, cyanBright: cyanBright)

                // ── 6. BOTTOM BAR: clock + status ────────────────────────
                BottomBarView(store: store, width: w, height: h, cyan: cyan, cyanBright: cyanBright)

                // ── 7. HORIZONTAL STATUS BAR (below reactor) ────────────
                HorizontalStatusBar(store: store, width: w * 0.5, cyan: cyan, amber: amber, phase: phase)
                    .position(x: cx, y: cy + R + 30)

                // ── 8. CENTRAL STATS ─────────────────────────────────────
                CentralStatsView().environmentObject(store)
                    .position(x: cx, y: cy)

                // ── 8. LEFT PANEL — ENHANCED HOLOGRAPHIC TELEMETRY ─────
                VStack(spacing: 12) {
                    // Section header
                    HStack(spacing: 4) {
                        Rectangle().fill(cyan.opacity(0.6)).frame(width: 12, height: 1)
                        Text("THERMAL SENSORS")
                            .font(.custom("Menlo", size: 8)).tracking(3)
                            .foregroundColor(cyan.opacity(0.65))
                        Rectangle().fill(cyan.opacity(0.3)).frame(height: 1)
                    }

                    // Circular gauges row — LARGER
                    HStack(spacing: 10) {
                        JarvisCircularGauge(
                            value: min(store.cpuTemp / 100.0, 1.0),
                            displayValue: String(format: "%.1f", store.cpuTemp),
                            unit: "\u{00B0}C", label: "CPU TEMP",
                            size: 72, phase: phase,
                            accentColor: store.cpuTemp > 55 ? Color(red: 1.0, green: 0.15, blue: 0.20) :
                                         store.cpuTemp > 45 ? Color(red: 1.0, green: 0.78, blue: 0.0) :
                                         Color(red: 0.0, green: 0.83, blue: 1.0)
                        )
                        JarvisCircularGauge(
                            value: min(store.gpuTemp / 100.0, 1.0),
                            displayValue: String(format: "%.1f", store.gpuTemp),
                            unit: "\u{00B0}C", label: "GPU TEMP",
                            size: 72, phase: phase,
                            accentColor: store.gpuTemp > 55 ? Color(red: 1.0, green: 0.15, blue: 0.20) :
                                         store.gpuTemp > 45 ? Color(red: 1.0, green: 0.78, blue: 0.0) :
                                         Color(red: 0.0, green: 0.83, blue: 1.0)
                        )
                    }

                    // Section header
                    HStack(spacing: 4) {
                        Rectangle().fill(cyan.opacity(0.6)).frame(width: 12, height: 1)
                        Text("CUSTOM METRICS")
                            .font(.custom("Menlo", size: 8)).tracking(3)
                            .foregroundColor(cyan.opacity(0.65))
                        Rectangle().fill(cyan.opacity(0.3)).frame(height: 1)
                    }

                    // Data rows — color coded
                    JarvisPanelBox {
                        VStack(spacing: 5) {
                            JarvisDataRow(label: "DVHOP", value: String(format: "%.2f%%", store.dvhopCPUPct),
                                          accentColor: store.dvhopCPUPct > 5 ? .amber : .cyan)
                            JarvisDataRow(label: "GUMER", value: String(format: "%.2f MB/s", store.gumerMBs),
                                          accentColor: store.gumerMBs > 10 ? .amber : .cyan)
                            JarvisDataRow(label: "CCTC", value: String(format: "+%.1f\u{00B0}C", store.cctcDeltaC),
                                          accentColor: store.cctcDeltaC > 10 ? .crimson : store.cctcDeltaC > 5 ? .amber : .cyan)
                            JarvisDataRow(label: "ANE", value: String(format: "%.2fW", store.anePower),
                                          accentColor: .cyan)
                        }
                    }

                    // Section header
                    HStack(spacing: 4) {
                        Rectangle().fill(cyan.opacity(0.6)).frame(width: 12, height: 1)
                        Text("CORE UTILIZATION")
                            .font(.custom("Menlo", size: 8)).tracking(3)
                            .foregroundColor(cyan.opacity(0.65))
                        Rectangle().fill(cyan.opacity(0.3)).frame(height: 1)
                    }

                    // Core bars — ENHANCED
                    JarvisPanelBox {
                        VStack(spacing: 8) {
                            JarvisCoreBarGauge(values: store.eCoreUsages, label: "E-CORES",
                                               barColor: Color(red: 0.0, green: 0.83, blue: 1.0))
                            JarvisCoreBarGauge(values: store.pCoreUsages, label: "P-CORES",
                                               barColor: Color(red: 1.0, green: 0.78, blue: 0.0))
                            if !store.sCoreUsages.isEmpty {
                                JarvisCoreBarGauge(values: store.sCoreUsages, label: "S-CORES",
                                                   barColor: Color(red: 1.0, green: 0.15, blue: 0.20))
                            }
                        }
                    }
                }
                .frame(width: w * 0.15)
                .position(x: w * 0.09, y: h * 0.45)

                // ── 9. RIGHT PANEL — ENHANCED HOLOGRAPHIC TELEMETRY ────
                VStack(spacing: 12) {
                    // Section header
                    HStack(spacing: 4) {
                        Rectangle().fill(cyan.opacity(0.3)).frame(height: 1)
                        Text("GPU COMPLEX")
                            .font(.custom("Menlo", size: 8)).tracking(3)
                            .foregroundColor(cyan.opacity(0.65))
                        Rectangle().fill(cyan.opacity(0.6)).frame(width: 12, height: 1)
                    }

                    // GPU gauge — MUCH LARGER
                    JarvisCircularGauge(
                        value: store.gpuUsage,
                        displayValue: String(format: "%.0f", store.gpuUsage * 100),
                        unit: "%", label: "GPU USAGE",
                        size: 88, phase: phase,
                        accentColor: store.gpuUsage > 0.9 ? Color(red: 1.0, green: 0.15, blue: 0.20) :
                                     store.gpuUsage > 0.7 ? Color(red: 1.0, green: 0.78, blue: 0.0) :
                                     Color(red: 0.0, green: 0.83, blue: 1.0)
                    )

                    // Section header
                    HStack(spacing: 4) {
                        Rectangle().fill(cyan.opacity(0.3)).frame(height: 1)
                        Text("MEMORY SUBSYSTEM")
                            .font(.custom("Menlo", size: 8)).tracking(3)
                            .foregroundColor(cyan.opacity(0.65))
                        Rectangle().fill(cyan.opacity(0.6)).frame(width: 12, height: 1)
                    }

                    // Memory data — color coded
                    JarvisPanelBox {
                        VStack(spacing: 5) {
                            JarvisDataRow(label: "MEMORY", value: String(format: "%.1f / %.0f GB", store.memoryUsedGB, store.memoryTotalGB),
                                          accentColor: store.memoryUsedGB / max(store.memoryTotalGB, 1) > 0.85 ? .crimson : .cyan)
                            // Memory usage bar with holographic glow
                            GeometryReader { geo in
                                let memFrac = min(store.memoryUsedGB / max(store.memoryTotalGB, 1), 1.0)
                                let memColor: Color = memFrac > 0.85 ? Color(red: 1.0, green: 0.15, blue: 0.20) :
                                                      memFrac > 0.7 ? Color(red: 1.0, green: 0.78, blue: 0.0) :
                                                      Color(red: 0.0, green: 0.83, blue: 1.0)
                                ZStack(alignment: .leading) {
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(Color.white.opacity(0.06))
                                        .frame(height: 6)
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(memColor.opacity(0.70))
                                        .frame(width: geo.size.width * memFrac, height: 6)
                                        .shadow(color: memColor.opacity(0.5), radius: 4)
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(memColor.opacity(0.15))
                                        .frame(width: geo.size.width * memFrac, height: 14)
                                        .blur(radius: 3)
                                }
                            }
                            .frame(height: 14)

                            JarvisDataRow(label: "SWAP", value: String(format: "%.0f%%", store.swapPressure * 100),
                                          accentColor: store.swapPressure > 0.25 ? .amber : .cyan)
                            JarvisDataRow(label: "DRAM RD", value: String(format: "%.1f GB/s", store.dramReadBW),
                                          accentColor: .cyan)
                            JarvisDataRow(label: "DRAM WR", value: String(format: "%.1f GB/s", store.dramWriteBW),
                                          accentColor: .cyan)
                        }
                    }

                    // Section header
                    HStack(spacing: 4) {
                        Rectangle().fill(cyan.opacity(0.3)).frame(height: 1)
                        Text("POWER DRAW")
                            .font(.custom("Menlo", size: 8)).tracking(3)
                            .foregroundColor(cyan.opacity(0.65))
                        Rectangle().fill(cyan.opacity(0.6)).frame(width: 12, height: 1)
                    }

                    // Power bar — ENHANCED with color coding
                    JarvisPanelBox {
                        VStack(alignment: .leading, spacing: 4) {
                            JarvisDataRow(label: "TOTAL", value: String(format: "%.1fW", store.totalPower),
                                          accentColor: store.totalPower > 40 ? .crimson : store.totalPower > 25 ? .amber : .cyan)
                            GeometryReader { geo in
                                let pwrFrac = min(store.totalPower / 60.0, 1.0)
                                let pwrColor: Color = pwrFrac > 0.65 ? Color(red: 1.0, green: 0.15, blue: 0.20) :
                                                      pwrFrac > 0.4 ? Color(red: 1.0, green: 0.78, blue: 0.0) :
                                                      Color(red: 0.0, green: 0.83, blue: 1.0)
                                ZStack(alignment: .leading) {
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(Color.white.opacity(0.06))
                                        .frame(height: 6)
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(pwrColor.opacity(0.70))
                                        .frame(width: geo.size.width * pwrFrac, height: 6)
                                        .shadow(color: pwrColor.opacity(0.5), radius: 4)
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(pwrColor.opacity(0.15))
                                        .frame(width: geo.size.width * pwrFrac, height: 14)
                                        .blur(radius: 3)
                                }
                            }
                            .frame(height: 14)

                            HStack {
                                Text("THERMAL")
                                    .font(.custom("Menlo", size: 7)).tracking(2)
                                    .foregroundColor(Color(red: 0.4, green: 0.50, blue: 0.55).opacity(0.75))
                                Spacer()
                                Text(store.thermalState.uppercased())
                                    .font(.custom("Menlo", size: 9)).fontWeight(.bold)
                                    .foregroundColor(thermalTextColor(store.thermalState))
                                    .shadow(color: thermalTextColor(store.thermalState).opacity(0.5), radius: 4)
                            }
                        }
                    }
                }
                .frame(width: w * 0.16)
                .position(x: w * 0.93, y: h * 0.45)

                // ── 10. CHATTER STREAMS ─────────────────────────────────
                ChatterStreamView(engine: chatterEngine, alignment: .left, phase: phase)
                    .frame(width: w * 0.22, alignment: .leading)
                    .position(x: w * 0.13, y: h * 0.78)

                ChatterStreamView(engine: chatterEngine, alignment: .right, phase: phase)
                    .frame(width: w * 0.20, alignment: .trailing)
                    .position(x: w * 0.87, y: h * 0.78)

                // ── 11. AWARENESS PULSES ────────────────────────────────
                AwarenessPulseOverlay(engine: awarenessEngine, cx: cx, cy: cy)

                // ── 12. FLOATING DIAGNOSTIC PANELS ──────────────────────
                FloatingPanelOverlay(manager: floatingPanelManager, cyan: cyan, amber: amber)

                // ── 13. SCANNER SWEEP ───────────────────────────────────
                ScannerSweepOverlay(width: w, height: h, phase: phase, cyan: cyan)
            }
            .holographicFlicker(phase: phase)
            .onAppear {
                chatterEngine.bind(to: store)
                awarenessEngine.bind(to: store)
                floatingPanelManager.bind(to: store)
            }
        }
    }

    private func thermalTextColor(_ state: String) -> Color {
        switch state.lowercased() {
        case "nominal", "normal": return Color(red: 0.0, green: 0.83, blue: 1.0)
        case "fair": return Color(red: 1.0, green: 0.78, blue: 0.0)
        case "serious": return Color(red: 1.0, green: 0.4, blue: 0.0)
        case "critical": return Color(red: 1.0, green: 0.15, blue: 0.20)
        default: return .white
        }
    }
}

// MARK: - HexGridCanvas ───────────────────────────────────────────────────────

struct HexGridCanvas: View {
    let width: CGFloat
    let height: CGFloat
    let phase: Double
    let color: Color

    var body: some View {
        Canvas { ctx, size in
            let spacing: CGFloat = 48
            let hexR: CGFloat = 24
            let cols = Int(width / (spacing * 0.866)) + 2
            let rows = Int(height / spacing) + 2
            let pulse = sin(phase * 0.3) * 0.3 + 0.7  // subtle breathing

            for row in 0..<rows {
                for col in 0..<cols {
                    let offsetX: CGFloat = (row % 2 == 0) ? 0 : spacing * 0.433
                    let cx = CGFloat(col) * spacing * 0.866 + offsetX
                    let cy = CGFloat(row) * spacing * 0.75

                    // Distance from center for falloff
                    let dx = cx - width / 2
                    let dy = cy - height / 2
                    let dist = sqrt(dx * dx + dy * dy)
                    let maxDist = sqrt(width * width + height * height) / 2
                    let falloff = max(0, 1.0 - dist / (maxDist * 0.8))
                    let opacity = 0.04 * falloff * pulse

                    guard opacity > 0.005 else { continue }

                    var hex = Path()
                    for i in 0..<6 {
                        let angle = Double.pi / 3.0 * Double(i) - Double.pi / 6.0
                        let px = cx + hexR * CGFloat(cos(angle))
                        let py = cy + hexR * CGFloat(sin(angle))
                        if i == 0 { hex.move(to: CGPoint(x: px, y: py)) }
                        else { hex.addLine(to: CGPoint(x: px, y: py)) }
                    }
                    hex.closeSubpath()
                    ctx.stroke(hex, with: .color(color.opacity(opacity)), style: StrokeStyle(lineWidth: 0.5))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - ScanLineOverlay ─────────────────────────────────────────────────────

struct ScanLineOverlay: View {
    let height: CGFloat
    let phase: Double
    let color: Color

    var body: some View {
        Canvas { ctx, size in
            // Horizontal scan lines (CRT effect)
            let lineSpacing: CGFloat = 3
            let count = Int(height / lineSpacing)
            for i in 0..<count {
                let y = CGFloat(i) * lineSpacing
                let p = Path { p in
                    p.move(to: CGPoint(x: 0, y: y))
                    p.addLine(to: CGPoint(x: size.width, y: y))
                }
                ctx.stroke(p, with: .color(Color.black.opacity(0.06)), style: StrokeStyle(lineWidth: 1))
            }

            // Moving scan beam (sweeps top to bottom every 8 seconds)
            let scanY = (phase.truncatingRemainder(dividingBy: 8.0) / 8.0) * Double(height)
            let beamH: CGFloat = 60
            for i in 0..<Int(beamH) {
                let y = CGFloat(scanY) + CGFloat(i) - beamH / 2
                guard y >= 0, y < height else { continue }
                let intensity = 1.0 - abs(CGFloat(i) - beamH / 2) / (beamH / 2)
                let p = Path { p in
                    p.move(to: CGPoint(x: 0, y: y))
                    p.addLine(to: CGPoint(x: size.width, y: y))
                }
                ctx.stroke(p, with: .color(color.opacity(Double(intensity) * 0.06)), style: StrokeStyle(lineWidth: 1))
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - CornerBracketsOverlay ───────────────────────────────────────────────

struct CornerBracketsOverlay: View {
    let width: CGFloat
    let height: CGFloat
    let color: Color
    let steel: Color
    let phase: Double

    var body: some View {
        Canvas { ctx, size in
            let bracketLen: CGFloat = 80
            let inset: CGFloat = 40  // Clear of menu bar and dock
            let corners: [(CGFloat, CGFloat, CGFloat, CGFloat)] = [
                (inset, inset, 1, 1),                              // top-left
                (width - inset, inset, -1, 1),                     // top-right
                (inset, height - inset, 1, -1),                    // bottom-left
                (width - inset, height - inset, -1, -1)            // bottom-right
            ]

            for (x, y, dx, dy) in corners {
                // L-shaped bracket — brighter and thicker
                var p = Path()
                p.move(to: CGPoint(x: x + dx * bracketLen, y: y))
                p.addLine(to: CGPoint(x: x, y: y))
                p.addLine(to: CGPoint(x: x, y: y + dy * bracketLen))
                ctx.stroke(p, with: .color(color.opacity(0.85)), style: StrokeStyle(lineWidth: 2.0, lineCap: .square))
                // Glow
                ctx.stroke(p, with: .color(color.opacity(0.15)), style: StrokeStyle(lineWidth: 8, lineCap: .square))

                // Corner dot
                let dotR: CGFloat = 3.0
                let dot = Path(ellipseIn: CGRect(x: x - dotR, y: y - dotR, width: dotR * 2, height: dotR * 2))
                ctx.fill(dot, with: .color(color.opacity(0.80)))
                ctx.fill(Path(ellipseIn: CGRect(x: x - dotR * 2, y: y - dotR * 2, width: dotR * 4, height: dotR * 4)), with: .color(color.opacity(0.08)))

                // Inner tick marks along bracket arms
                for t in stride(from: CGFloat(10), through: bracketLen - 5, by: 10) {
                    let tickLen: CGFloat = 5
                    var ht = Path()
                    ht.move(to: CGPoint(x: x + dx * t, y: y - dy * tickLen))
                    ht.addLine(to: CGPoint(x: x + dx * t, y: y + dy * tickLen))
                    ctx.stroke(ht, with: .color(steel.opacity(0.45)), style: StrokeStyle(lineWidth: 0.6))
                    var vt = Path()
                    vt.move(to: CGPoint(x: x - dx * tickLen, y: y + dy * t))
                    vt.addLine(to: CGPoint(x: x + dx * tickLen, y: y + dy * t))
                    ctx.stroke(vt, with: .color(steel.opacity(0.45)), style: StrokeStyle(lineWidth: 0.6))
                }
            }

            // ── Crosshair at center ──────────────────────────────────────
            let cx = width / 2
            let cy = height / 2
            let crossLen: CGFloat = 15
            let crossGap: CGFloat = 40
            let crossOp = 0.25 + sin(phase * 2.0) * 0.08

            for angle in [0.0, Double.pi / 2, Double.pi, Double.pi * 1.5] {
                let dx = CGFloat(cos(angle))
                let dy = CGFloat(sin(angle))
                var cp = Path()
                cp.move(to: CGPoint(x: cx + dx * crossGap, y: cy + dy * crossGap))
                cp.addLine(to: CGPoint(x: cx + dx * (crossGap + crossLen), y: cy + dy * (crossGap + crossLen)))
                ctx.stroke(cp, with: .color(color.opacity(crossOp)), style: StrokeStyle(lineWidth: 1, lineCap: .square))
            }

            // ── Horizontal rule lines (top/bottom thirds) ────────────────
            let ruleOp = 0.14 + sin(phase * 0.5) * 0.04
            for frac in [0.12, 0.88] {
                let y = height * frac
                var rl = Path()
                rl.move(to: CGPoint(x: inset + 80, y: y))
                rl.addLine(to: CGPoint(x: width - inset - 80, y: y))
                ctx.stroke(rl, with: .color(steel.opacity(ruleOp)), style: StrokeStyle(lineWidth: 0.6, dash: [4, 8]))
            }
            // Vertical rules flanking reactor
            for frac in [0.18, 0.82] {
                let x = width * frac
                var vl = Path()
                vl.move(to: CGPoint(x: x, y: height * 0.2))
                vl.addLine(to: CGPoint(x: x, y: height * 0.8))
                ctx.stroke(vl, with: .color(steel.opacity(ruleOp * 0.5)), style: StrokeStyle(lineWidth: 0.4, dash: [3, 8]))
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - TopBarView ──────────────────────────────────────────────────────────

struct TopBarView: View {
    let store: TelemetryStore
    let width: CGFloat
    let cyan: Color
    let cyanBright: Color

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                // Left: SHIELD / system label
                VStack(alignment: .leading, spacing: 2) {
                    Text("macOS SILICON")
                        .font(.custom("Menlo", size: 10)).tracking(4)
                        .foregroundColor(Color.white.opacity(0.60))
                    Text("JARVIS TELEMETRY v3.1")
                        .font(.custom("Menlo", size: 8)).tracking(3)
                        .foregroundColor(Color(red: 0.85, green: 0.90, blue: 0.95).opacity(0.40))
                }

                Spacer()

                // Center: Time — cyan holographic glow
                Text(store.timeString)
                    .font(.custom("Menlo", size: 26)).fontWeight(.light)
                    .foregroundColor(cyanBright)
                    .shadow(color: cyan.opacity(0.6), radius: 6)
                    .shadow(color: cyan.opacity(0.25), radius: 18)
                    .shadow(color: cyan.opacity(0.08), radius: 40)

                Spacer()

                // Right: Date — cyan-tinted
                VStack(alignment: .trailing, spacing: 2) {
                    Text(currentDayOfMonth)
                        .font(.custom("Menlo", size: 32)).fontWeight(.bold)
                        .foregroundColor(cyanBright.opacity(0.80))
                        .shadow(color: cyan.opacity(0.4), radius: 6)
                    Text(currentMonthYear)
                        .font(.custom("Menlo", size: 8)).tracking(3)
                        .foregroundColor(cyan.opacity(0.35))
                }
            }
            .padding(.horizontal, 30)
            .padding(.top, 36)  // Below macOS menu bar

            Spacer()
        }
    }

    private var currentDayOfMonth: String {
        let f = DateFormatter()
        f.dateFormat = "dd"
        return f.string(from: Date())
    }

    private var currentMonthYear: String {
        let f = DateFormatter()
        f.dateFormat = "MMMM yyyy"
        return f.string(from: Date()).uppercased()
    }
}

// MARK: - BottomBarView ───────────────────────────────────────────────────────

struct BottomBarView: View {
    let store: TelemetryStore
    let width: CGFloat
    let height: CGFloat
    let cyan: Color
    let cyanBright: Color

    var body: some View {
        VStack {
            Spacer()

            HStack {
                // Left: chip name
                Text(store.chipName)
                    .font(.custom("Menlo", size: 10)).tracking(3)
                    .foregroundColor(Color.white.opacity(0.50))

                Spacer()

                // Center: large clock — cyan glow
                Text(store.timeString)
                    .font(.custom("Menlo", size: 22)).fontWeight(.medium)
                    .foregroundColor(cyanBright.opacity(0.65))
                    .shadow(color: cyan.opacity(0.25), radius: 8)

                Spacer()

                // Right: thermal + power summary
                HStack(spacing: 12) {
                    Text(String(format: "%.0fW", store.totalPower))
                        .font(.custom("Menlo", size: 11)).foregroundColor(Color.white.opacity(0.55))
                    Text(store.thermalState.uppercased())
                        .font(.custom("Menlo", size: 9)).tracking(2)
                        .foregroundColor(Color.white.opacity(0.45))
                }
            }
            .padding(.horizontal, 30)
            .padding(.bottom, 90)  // Above macOS dock
        }
    }
}

// MARK: - JarvisReactorCanvas ─────────────────────────────────────────────────

struct JarvisReactorCanvas: View {
    let store: TelemetryStore
    let phase: Double
    let center: CGPoint
    let R: Double
    let cyan: Color, cyanBright: Color, cyanDim: Color
    let amber: Color, crimson: Color, steel: Color

    var body: some View {
        Canvas(opaque: false, colorMode: .linear, rendersAsynchronously: true) { ctx, size in
            let c = center
            let pi2 = Double.pi * 2.0
            let top = -Double.pi / 2.0
            let allCores = store.eCoreUsages + store.pCoreUsages + store.sCoreUsages
            let cpuAvg = allCores.isEmpty ? 0 : allCores.reduce(0, +) / Double(allCores.count)
            let gpuLoad = store.gpuUsage
            let aggregateLoad = cpuAvg * 0.6 + gpuLoad * 0.3 + store.swapPressure * 0.1

            // Dynamic speed — rings accelerate with system load
            let speedMul = 1.0 + aggregateLoad * 0.8
            let ph = phase * speedMul

            // Dynamic bloom intensity — glow brightens with load
            let bloomScale = 0.8 + aggregateLoad * 0.5

            // Thermal threat detection — shifts palette
            let thermalThreat = store.thermalState.lowercased().contains("serious") || store.thermalState.lowercased().contains("critical")

            // ══════════════════════════════════════════════════════════════
            //  IRON MAN JARVIS REACTOR — Cinema-grade volumetric hologram
            //  Reactive to CPU/GPU/thermal — rings accelerate, bloom intensifies,
            //  color shifts from cyan to amber/crimson under thermal stress.
            // ══════════════════════════════════════════════════════════════

            // ═══════════════════════════════════════════════════════════
            //  JARVIS blended palette — white structure + cyan holographic
            // ═══════════════════════════════════════════════════════════
            // Thermal-reactive palette — shifts warm under thermal stress
            let jarvisWhite = thermalThreat
                ? Color(red: 0.95, green: 0.85, blue: 0.80)  // warm-tinted white
                : Color(red: 0.85, green: 0.95, blue: 1.00)  // cyan-tinted white
            let jarvisSilver = thermalThreat
                ? Color(red: 0.85, green: 0.75, blue: 0.70)
                : Color(red: 0.70, green: 0.85, blue: 0.92)
            let jarvisCyan = thermalThreat
                ? Color(red: 1.00, green: 0.50, blue: 0.15)   // shifts to amber-orange
                : Color(red: 0.00, green: 0.83, blue: 1.00)   // #00D4FF — primary
            let jarvisDim = Color(red: 0.25, green: 0.40, blue: 0.50)

            // ═══════════════════════════════════════════════════════════
            //  HELPERS — cinema bloom style
            // ═══════════════════════════════════════════════════════════

            func ring(_ r: Double, _ col: Color, _ w: Double, dash: [CGFloat]? = nil) {
                let p = Path { p in p.addArc(center: c, radius: r, startAngle: .zero, endAngle: .radians(pi2), clockwise: false) }
                let s = dash != nil ? StrokeStyle(lineWidth: w, lineCap: .butt, dash: dash!) : StrokeStyle(lineWidth: w, lineCap: .butt)
                ctx.stroke(p, with: .color(col), style: s)
            }

            // Cinema bloom — ENHANCED volumetric glow, scales with system load
            let bs = bloomScale  // capture for closure
            func bloomRing(_ r: Double, _ col: Color, _ w: Double) {
                ring(r, jarvisCyan.opacity(0.015 * bs), w + 44)   // ultra-ultra-wide cyan haze
                ring(r, jarvisCyan.opacity(0.025 * bs), w + 32)   // ultra-wide cyan ambient
                ring(r, col.opacity(0.04 * bs), w + 24)    // wide soft glow
                ring(r, col.opacity(0.08 * bs), w + 16)    // medium-wide glow
                ring(r, col.opacity(0.14 * bs), w + 10)    // medium glow
                ring(r, col.opacity(0.30 * bs), w + 5)     // near glow
                ring(r, col.opacity(0.75 * bs), w + 1)     // bright edge
                ring(r, col.opacity(min(0.90 * bs, 1.0)), w)  // bright core
                ring(r, Color.white.opacity(min(0.55 * bs, 1.0)), w * 0.4) // white-hot center
            }

            // Bloom arc — ENHANCED volumetric glow for partial arcs
            func bloomArc(_ r: Double, _ startAngle: Double, _ sweep: Double, _ col: Color, _ w: Double) {
                // Cyan ambient haze — ultra wide
                let cp = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(startAngle), endAngle: .radians(startAngle + sweep), clockwise: false) }
                ctx.stroke(cp, with: .color(jarvisCyan.opacity(0.015)), style: StrokeStyle(lineWidth: w + 40, lineCap: .round))
                for (extraW, opacity) in [(28.0, 0.025), (20.0, 0.05), (14.0, 0.10), (8.0, 0.22), (4.0, 0.40), (0.0, 0.85)] {
                    let p = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(startAngle), endAngle: .radians(startAngle + sweep), clockwise: false) }
                    ctx.stroke(p, with: .color(col.opacity(opacity)), style: StrokeStyle(lineWidth: w + extraW, lineCap: .round))
                }
                // white-hot center line
                let wp = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(startAngle), endAngle: .radians(startAngle + sweep), clockwise: false) }
                ctx.stroke(wp, with: .color(Color.white.opacity(0.50)), style: StrokeStyle(lineWidth: w * 0.4, lineCap: .round))
            }

            // Data arc with bloom — tracks + filled segments
            func dataArc(_ usages: [Double], _ r: Double, _ w: Double, _ col: Color) {
                guard !usages.isEmpty else { return }
                let n = usages.count
                let sw = pi2 / Double(n)
                let gap = sw * 0.10  // wider gaps between segments
                for (i, u) in usages.enumerated() {
                    let s0 = top + sw * Double(i) + gap / 2
                    let s1 = s0 + sw - gap
                    // Track — dim but visible
                    let tp = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(s0), endAngle: .radians(s1), clockwise: false) }
                    ctx.stroke(tp, with: .color(col.opacity(0.12)), style: StrokeStyle(lineWidth: w, lineCap: .round))
                    guard u > 0 else { continue }
                    let fe = s0 + (s1 - s0) * u
                    // Bloom data fill
                    bloomArc(r, s0, (fe - s0), col, w)
                }
            }

            // Segmented ring — N segments with gaps, rotating
            func segRing(_ r: Double, _ n: Int, _ frac: Double, _ col: Color, _ w: Double, rot: Double = 0) {
                let seg = pi2 / Double(n)
                let rotOff = rot * ph
                for i in 0..<n {
                    let s = Double(i) * seg + rotOff
                    let p = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(s), endAngle: .radians(s + seg * frac), clockwise: false) }
                    ctx.stroke(p, with: .color(col), style: StrokeStyle(lineWidth: w, lineCap: .round))
                }
            }

            // Chevron arrows — triangular pointers
            func chevrons(_ r: Double, _ col: Color, _ sz: Double, _ count: Int = 4, rot: Double = 0) {
                let rotOff = rot * ph
                for i in 0..<count {
                    let a = Double(i) * pi2 / Double(count) + top + rotOff
                    let tipPt = CGPoint(x: c.x + cos(a) * (r + sz), y: c.y + sin(a) * (r + sz))
                    let lPt = CGPoint(x: c.x + cos(a - 0.08) * (r - sz * 0.2), y: c.y + sin(a - 0.08) * (r - sz * 0.2))
                    let rPt = CGPoint(x: c.x + cos(a + 0.08) * (r - sz * 0.2), y: c.y + sin(a + 0.08) * (r - sz * 0.2))
                    // Glow halo behind chevron
                    let gp = Path { p in p.move(to: lPt); p.addLine(to: tipPt); p.addLine(to: rPt) }
                    ctx.stroke(gp, with: .color(col.opacity(0.15)), style: StrokeStyle(lineWidth: 8.0, lineCap: .round, lineJoin: .round))
                    ctx.stroke(gp, with: .color(col.opacity(0.80)), style: StrokeStyle(lineWidth: 2.0, lineCap: .round, lineJoin: .round))
                }
            }

            // Tick marks
            func ticks(_ r: Double, _ n: Int, _ len: Double, _ col: Color, _ w: Double, rot: Double = 0) {
                let rotOff = rot * ph
                for i in 0..<n {
                    let a = Double(i) / Double(n) * pi2 + rotOff
                    let isMajor = i % 5 == 0
                    let tLen = isMajor ? len * 1.6 : len
                    let tW = isMajor ? w * 1.8 : w
                    let p = Path { p in
                        p.move(to: CGPoint(x: c.x + cos(a) * (r - tLen/2), y: c.y + sin(a) * (r - tLen/2)))
                        p.addLine(to: CGPoint(x: c.x + cos(a) * (r + tLen/2), y: c.y + sin(a) * (r + tLen/2)))
                    }
                    ctx.stroke(p, with: .color(isMajor ? col : col.opacity(0.5)), style: StrokeStyle(lineWidth: tW))
                }
            }

            // Orbiting dots
            func dots(_ r: Double, _ n: Int, _ col: Color, _ sz: Double, rot: Double = 0) {
                let rotOff = rot * ph
                for i in 0..<n {
                    let a = Double(i) / Double(n) * pi2 + rotOff
                    let pt = CGPoint(x: c.x + cos(a) * r, y: c.y + sin(a) * r)
                    // Glow behind each dot
                    let glowRect = CGRect(x: pt.x - sz * 2, y: pt.y - sz * 2, width: sz * 4, height: sz * 4)
                    ctx.fill(Path(ellipseIn: glowRect), with: .color(col.opacity(0.10)))
                    let rect = CGRect(x: pt.x - sz/2, y: pt.y - sz/2, width: sz, height: sz)
                    ctx.fill(Path(ellipseIn: rect), with: .color(col))
                }
            }

            // ══════════════════════════════════════════════════════════════
            //  ZONE 1: OUTER PERIMETER (1.02R)
            //  Dotted ring + compass chevrons
            // ══════════════════════════════════════════════════════════════

            // Dotted perimeter ring — 120 evenly spaced dots
            dots(R * 1.02, 120, jarvisDim.opacity(0.50), 1.5)

            // 4 chevrons at compass points (white, 10px)
            chevrons(R * 1.02, jarvisWhite.opacity(0.70), 10, 4)

            // ══════════════════════════════════════════════════════════════
            //  ZONE 2: OUTER STRUCTURAL (0.93R - 0.96R)
            //  Thick bloom ring + segmented arcs + ticks
            // ══════════════════════════════════════════════════════════════

            // Main outer bloom ring — THICK, creates ~34px visible with bloom
            bloomRing(R * 0.95, jarvisSilver, 4.0)

            // 8-segment partial arcs at 0.93R — COUNTER-CLOCKWISE rotation
            let segSweep = (pi2 / 8.0) * 0.60
            for i in 0..<8 {
                let segStart = Double(i) * (pi2 / 8.0) + 0.08 - ph * 0.03  // CCW
                let ap = Path { p in p.addArc(center: c, radius: R * 0.93, startAngle: .radians(segStart), endAngle: .radians(segStart + segSweep), clockwise: false) }
                ctx.stroke(ap, with: .color(jarvisDim.opacity(0.35)), style: StrokeStyle(lineWidth: 3.0, lineCap: .round))
            }

            // 60 tick marks at 0.96R — CLOCKWISE, slow
            ticks(R * 0.96, 60, 6, jarvisDim.opacity(0.50), 0.8, rot: 0.01)

            // ══════════════════════════════════════════════════════════════
            //  ZONE 3: GPU DATA (0.88R)
            //  Bloom marker + GPU data arc
            // ══════════════════════════════════════════════════════════════

            // Faint cyan zone marker
            bloomRing(R * 0.90, jarvisCyan.opacity(0.30), 2.0)

            // GPU data arc — cyan, 10px wide, with bloom
            let gpuVal = [min(store.gpuUsage, 1.0)]
            dataArc(gpuVal, R * 0.88, 10.0, jarvisCyan)

            // ══════════════════════════════════════════════════════════════
            //  ZONE 4: E-CORE DATA (0.78R)
            //  Bloom marker + E-core data arcs + structural
            // ══════════════════════════════════════════════════════════════

            // Cyan zone marker
            bloomRing(R * 0.82, jarvisCyan.opacity(0.25), 2.0)

            // E-core data arcs — cyan, 10px wide
            dataArc(store.eCoreUsages, R * 0.78, 10.0, jarvisCyan)

            // Segmented structural arc at 0.76R — CLOCKWISE, moderate speed
            let structSweep6 = (pi2 / 6.0) * 0.55
            for i in 0..<6 {
                let segStart = Double(i) * (pi2 / 6.0) + 0.12 + ph * 0.04  // CW
                let ap = Path { p in p.addArc(center: c, radius: R * 0.76, startAngle: .radians(segStart), endAngle: .radians(segStart + structSweep6), clockwise: false) }
                ctx.stroke(ap, with: .color(jarvisDim.opacity(0.30)), style: StrokeStyle(lineWidth: 3.0, lineCap: .round))
            }

            // Half-sweep arc at 0.74R — only covers 180°, rotates CCW slowly
            let halfStart = ph * -0.02
            bloomArc(R * 0.74, halfStart, Double.pi, jarvisDim.opacity(0.20), 1.5)

            // ══════════════════════════════════════════════════════════════
            //  ZONE 5: P-CORE DATA (0.65R)
            //  Bloom marker + P-core data arcs + chevrons
            // ══════════════════════════════════════════════════════════════

            // Silver zone marker
            bloomRing(R * 0.70, jarvisSilver.opacity(0.30), 2.0)

            // P-core data arcs — amber, 10px wide
            dataArc(store.pCoreUsages, R * 0.65, 10.0, amber)

            // 4 chevrons at 0.63R — COUNTER-CLOCKWISE
            chevrons(R * 0.63, jarvisWhite.opacity(0.50), 8, 4, rot: -0.06)

            // ══════════════════════════════════════════════════════════════
            //  ZONE 6: S-CORE DATA (0.55R)
            //  S-core data arcs + segmented arc
            // ══════════════════════════════════════════════════════════════

            // S-core data arcs — crimson, 8px wide
            dataArc(store.sCoreUsages, R * 0.55, 8.0, crimson)

            // Segmented arc at 0.53R — COG TICK motion (steps every 0.5s like a clock)
            let cogStep = floor(ph * 2.0) / 2.0  // snaps to 0.5s intervals
            let cogAngle = cogStep * (pi2 / 16.0)  // tick forward by 22.5° per step
            let structSweep8 = (pi2 / 8.0) * 0.50
            for i in 0..<8 {
                let segStart = Double(i) * (pi2 / 8.0) + 0.20 + cogAngle
                let ap = Path { p in p.addArc(center: c, radius: R * 0.53, startAngle: .radians(segStart), endAngle: .radians(segStart + structSweep8), clockwise: false) }
                ctx.stroke(ap, with: .color(jarvisDim.opacity(0.25)), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
            }

            // ══════════════════════════════════════════════════════════════
            //  ZONE 7: INNER DETAIL (0.38R - 0.45R)
            //  Bright inner boundary + wavy ring + ticks + rotating arcs
            // ══════════════════════════════════════════════════════════════

            // Bright inner boundary bloom ring
            bloomRing(R * 0.44, jarvisWhite, 3.0)

            // Wavy/gear-tooth ring at 0.42R — 24-segment irregular edge
            let gearTeeth = 24
            let gearSegAngle = pi2 / Double(gearTeeth)
            for i in 0..<gearTeeth {
                let gearTick = floor(ph * 3.0) / 3.0 * (pi2 / 24.0)  // tick every 0.33s
                let a0 = Double(i) * gearSegAngle - gearTick  // CCW tick
                let innerR = R * 0.41
                let outerR = R * (i % 2 == 0 ? 0.43 : 0.415)
                let mid = a0 + gearSegAngle * 0.5
                let gp = Path { p in
                    p.move(to: CGPoint(x: c.x + cos(a0) * innerR, y: c.y + sin(a0) * innerR))
                    p.addLine(to: CGPoint(x: c.x + cos(mid) * outerR, y: c.y + sin(mid) * outerR))
                    p.addLine(to: CGPoint(x: c.x + cos(a0 + gearSegAngle) * innerR, y: c.y + sin(a0 + gearSegAngle) * innerR))
                }
                ctx.stroke(gp, with: .color(jarvisDim.opacity(0.35)), style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
            }

            // 12 tick marks at 0.40R
            ticks(R * 0.40, 12, 5, jarvisDim.opacity(0.55), 1.0)

            // 4 small arcs at 0.38R — FAST clockwise
            let smallArcSweep = pi2 * 0.08
            for i in 0..<4 {
                let arcStart = Double(i) * (pi2 / 4.0) + ph * 0.15  // fast CW
                let ap = Path { p in p.addArc(center: c, radius: R * 0.38, startAngle: .radians(arcStart), endAngle: .radians(arcStart + smallArcSweep), clockwise: false) }
                ctx.stroke(ap, with: .color(jarvisCyan.opacity(0.40)), style: StrokeStyle(lineWidth: 2.0, lineCap: .round))
            }

            // 3 arcs at 0.35R — COUNTER-CLOCKWISE, slower
            for i in 0..<3 {
                let arcStart = Double(i) * (pi2 / 3.0) - ph * 0.08  // CCW
                bloomArc(R * 0.35, arcStart, pi2 * 0.12, jarvisDim.opacity(0.25), 1.5)
            }

            // 6-segment COG ring at 0.32R — tick-steps like a clock
            let innerCogTick = floor(ph * 1.5) / 1.5 * (pi2 / 12.0)  // tick every 0.67s
            for i in 0..<6 {
                let segStart = Double(i) * (pi2 / 6.0) + innerCogTick
                let ap = Path { p in p.addArc(center: c, radius: R * 0.32, startAngle: .radians(segStart), endAngle: .radians(segStart + pi2 / 6.0 * 0.5), clockwise: false) }
                ctx.stroke(ap, with: .color(jarvisDim.opacity(0.30)), style: StrokeStyle(lineWidth: 2.0, lineCap: .butt))
            }

            // Half-sweep accent at 0.48R — 180° arc, smooth CW
            bloomArc(R * 0.48, ph * 0.05, Double.pi, jarvisDim.opacity(0.15), 1.5)

            // ══════════════════════════════════════════════════════════════
            //  ZONE 8: CORE (0R - 0.25R)
            //  IRON MAN ARC REACTOR CORE — Volumetric bloom, geodesic
            //  wireframe sphere, energy tendrils, targeting reticle
            // ══════════════════════════════════════════════════════════════

            // Bloom rings at core boundary — ENHANCED with double-layer glow
            bloomRing(R * 0.25, jarvisCyan.opacity(0.45), 2.5)
            bloomRing(R * 0.22, jarvisWhite, 2.5)
            bloomRing(R * 0.18, jarvisCyan.opacity(0.35), 1.5)
            bloomRing(R * 0.15, jarvisWhite, 2.0)

            // Targeting reticle — dashed circles with cyan pulse
            let reticlePulse = 0.85 + sin(ph * 1.5) * 0.15
            ring(R * 0.12, jarvisCyan.opacity(0.25 * reticlePulse), 1.0, dash: [6, 3])
            ring(R * 0.10, jarvisWhite.opacity(0.35 * reticlePulse), 1.0, dash: [4, 4])
            ring(R * 0.08, jarvisCyan.opacity(0.20 * reticlePulse), 0.8, dash: [2, 6])
            ring(R * 0.06, jarvisWhite.opacity(0.30 * reticlePulse), 1.0, dash: [3, 5])

            // Crosshair lines (4 directions, 0.03R to 0.10R) — EXTENDED
            for angle in [0.0, Double.pi / 2, Double.pi, Double.pi * 1.5] {
                let dx = cos(angle)
                let dy = sin(angle)
                // Outer crosshair segment
                let cp = Path { p in
                    p.move(to: CGPoint(x: c.x + dx * R * 0.03, y: c.y + dy * R * 0.03))
                    p.addLine(to: CGPoint(x: c.x + dx * R * 0.10, y: c.y + dy * R * 0.10))
                }
                ctx.stroke(cp, with: .color(jarvisCyan.opacity(0.08)), style: StrokeStyle(lineWidth: 6))
                ctx.stroke(cp, with: .color(jarvisWhite.opacity(0.45 * reticlePulse)), style: StrokeStyle(lineWidth: 1.0))
            }
            // Diagonal crosshairs (8 directions total)
            for angle in [Double.pi / 4, Double.pi * 3 / 4, Double.pi * 5 / 4, Double.pi * 7 / 4] {
                let dx = cos(angle)
                let dy = sin(angle)
                let cp = Path { p in
                    p.move(to: CGPoint(x: c.x + dx * R * 0.04, y: c.y + dy * R * 0.04))
                    p.addLine(to: CGPoint(x: c.x + dx * R * 0.07, y: c.y + dy * R * 0.07))
                }
                ctx.stroke(cp, with: .color(jarvisCyan.opacity(0.20 * reticlePulse)), style: StrokeStyle(lineWidth: 0.6))
            }

            // ── GEODESIC WIREFRAME SPHERE — Iron Man arc reactor signature ──
            let geoR = R * 0.13
            let geoRot = ph * 0.12  // slow rotation
            let geoTilt = 0.3  // slight tilt for 3D feel
            // Draw icosphere-like wireframe with 3 intersecting great circles
            for ring_i in 0..<5 {
                let ringAngle = Double(ring_i) * (Double.pi / 5.0) + geoRot
                let tiltedR = geoR * (0.4 + 0.6 * abs(sin(ringAngle + geoTilt)))
                let geoPath = Path { p in
                    p.addEllipse(in: CGRect(
                        x: c.x - tiltedR, y: c.y - tiltedR * 0.4,
                        width: tiltedR * 2, height: tiltedR * 0.8
                    ))
                }
                // Rotate the ellipse path by applying transform
                let rotAngle = Double(ring_i) * (Double.pi / 5.0)
                var transform = CGAffineTransform.identity
                transform = transform.translatedBy(x: c.x, y: c.y)
                transform = transform.rotated(by: rotAngle + geoRot * 0.3)
                transform = transform.translatedBy(x: -c.x, y: -c.y)
                let rotatedPath = geoPath.applying(transform)

                let geoOp = 0.18 + sin(ph * 0.8 + Double(ring_i)) * 0.08
                ctx.stroke(rotatedPath, with: .color(jarvisCyan.opacity(geoOp)), style: StrokeStyle(lineWidth: 0.6))
                ctx.stroke(rotatedPath, with: .color(jarvisCyan.opacity(geoOp * 0.3)), style: StrokeStyle(lineWidth: 3))
            }
            // Latitude lines on the geodesic sphere
            for lat in 0..<4 {
                let latFrac = Double(lat + 1) / 5.0
                let latR = geoR * sin(latFrac * Double.pi)
                let latY = c.y - geoR * cos(latFrac * Double.pi) * 0.4
                let latPath = Path { p in
                    p.addEllipse(in: CGRect(x: c.x - latR, y: latY - latR * 0.15, width: latR * 2, height: latR * 0.3))
                }
                let latOp = 0.12 + sin(ph * 0.5 + Double(lat) * 1.5) * 0.06
                ctx.stroke(latPath, with: .color(jarvisCyan.opacity(latOp)), style: StrokeStyle(lineWidth: 0.4))
            }
            // Geodesic vertex dots — bright nodes at intersections
            for i in 0..<12 {
                let vAngle = Double(i) * (pi2 / 12.0) + geoRot * 0.5
                let vR = geoR * (0.6 + 0.4 * sin(Double(i) * 2.4))
                let vx = c.x + cos(vAngle) * vR * 0.85
                let vy = c.y + sin(vAngle) * vR * 0.35
                let vSz = 1.5 + sin(ph * 2 + Double(i)) * 0.5
                let vGlow = CGRect(x: vx - vSz * 2, y: vy - vSz * 2, width: vSz * 4, height: vSz * 4)
                ctx.fill(Path(ellipseIn: vGlow), with: .color(jarvisCyan.opacity(0.15)))
                let vDot = CGRect(x: vx - vSz / 2, y: vy - vSz / 2, width: vSz, height: vSz)
                ctx.fill(Path(ellipseIn: vDot), with: .color(Color.white.opacity(0.6)))
            }

            // ── BLAZING CORE GLOW — cardiac heartbeat, ENHANCED ────────
            let bpm = 45.0 + cpuAvg * 75.0
            let heartPeriod = 60.0 / bpm
            let heartPhase = (ph.truncatingRemainder(dividingBy: heartPeriod)) / heartPeriod
            let cardiac: Double
            if heartPhase < 0.1 {
                cardiac = 0.80 + 0.20 * (heartPhase / 0.1)
            } else if heartPhase < 0.25 {
                cardiac = 1.0 - 0.15 * ((heartPhase - 0.1) / 0.15)
            } else if heartPhase < 0.35 {
                cardiac = 0.85 + 0.08 * sin((heartPhase - 0.25) / 0.10 * .pi)
            } else {
                cardiac = 0.82 + 0.03 * sin(ph * 3.0)  // subtle ambient throb
            }
            let corePulse = cardiac

            // 35 glow layers — VOLUMETRIC cyan bloom, the core is a LIGHT SOURCE
            // Ultra-wide ambient halo (outermost)
            for layer in 0..<8 {
                let lr = R * 0.25 + Double(layer) * R * 0.04
                let lo = 0.015 * corePulse * (1.0 - Double(layer) / 8.0)
                let coreRect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                ctx.fill(Path(ellipseIn: coreRect), with: .color(jarvisCyan.opacity(lo)))
            }
            // Main volumetric bloom (35 layers from center outward)
            for layer in 0..<35 {
                let lr = R * 0.004 + Double(layer) * R * 0.012
                let falloff = 1.0 - Double(layer) / 35.0
                let lo = (0.35 * falloff * falloff) * corePulse  // quadratic falloff
                guard lo > 0.005 else { continue }
                let coreRect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                let cyanBlend = Double(layer) / 35.0
                if cyanBlend > 0.5 {
                    ctx.fill(Path(ellipseIn: coreRect), with: .color(jarvisCyan.opacity(lo * 0.8)))
                } else if cyanBlend > 0.2 {
                    // Transition zone — blended cyan-white
                    ctx.fill(Path(ellipseIn: coreRect), with: .color(jarvisCyan.opacity(lo * 0.4)))
                    ctx.fill(Path(ellipseIn: coreRect), with: .color(jarvisWhite.opacity(lo * 0.5)))
                } else {
                    ctx.fill(Path(ellipseIn: coreRect), with: .color(jarvisWhite.opacity(lo)))
                }
            }

            // Energy tendrils radiating from core — 6 faint lines pulsing outward
            for i in 0..<6 {
                let tAngle = Double(i) * (pi2 / 6.0) + ph * 0.04
                let tPulse = 0.5 + 0.5 * sin(ph * 1.2 + Double(i) * 1.1)
                let tLen = R * (0.15 + 0.07 * tPulse)
                let tp = Path { p in
                    p.move(to: CGPoint(x: c.x + cos(tAngle) * R * 0.05, y: c.y + sin(tAngle) * R * 0.05))
                    p.addLine(to: CGPoint(x: c.x + cos(tAngle) * tLen, y: c.y + sin(tAngle) * tLen))
                }
                ctx.stroke(tp, with: .color(jarvisCyan.opacity(0.08 * tPulse * corePulse)), style: StrokeStyle(lineWidth: 3))
                ctx.stroke(tp, with: .color(jarvisWhite.opacity(0.15 * tPulse * corePulse)), style: StrokeStyle(lineWidth: 0.5))
            }

            // Bright cyan-white sphere at 0.06R — LARGER, more vivid
            let hotR = R * 0.06 * corePulse
            let hotRect = CGRect(x: c.x - hotR, y: c.y - hotR, width: hotR * 2, height: hotR * 2)
            ctx.fill(Path(ellipseIn: hotRect), with: .color(jarvisCyan.opacity(0.65 * corePulse)))
            ctx.fill(Path(ellipseIn: hotRect), with: .color(Color.white.opacity(0.70 * corePulse)))

            // Center point — white-hot center, 0.03R
            let innerR = R * 0.03 * corePulse
            let innerRect = CGRect(x: c.x - innerR, y: c.y - innerR, width: innerR * 2, height: innerR * 2)
            ctx.fill(Path(ellipseIn: innerRect), with: .color(Color.white.opacity(0.97)))
            // Inner glow ring around center
            let innerGlowPath = Path { p in p.addArc(center: c, radius: innerR * 1.5, startAngle: .zero, endAngle: .radians(pi2), clockwise: false) }
            ctx.stroke(innerGlowPath, with: .color(Color.white.opacity(0.4 * corePulse)), style: StrokeStyle(lineWidth: 1.5))

            // ══════════════════════════════════════════════════════════════
            //  RADAR SWEEP — white, with heavy bloom trail
            // ══════════════════════════════════════════════════════════════

            // SOPHISTICATED RADAR SWEEP — sweeps 270°, pauses, snaps back
            // Cycle: 6s sweep (0-270°) → 1s pause → instant snap to start → repeat
            let sweepCycle = 8.0
            let sweepTime = ph.truncatingRemainder(dividingBy: sweepCycle)
            let sweepAngle: Double
            if sweepTime < 6.0 {
                // Smooth sweep over 270° with ease-in-out
                let t = sweepTime / 6.0
                let eased = t * t * (3.0 - 2.0 * t)  // smoothstep
                sweepAngle = eased * pi2 * 0.75  // 270 degrees
            } else if sweepTime < 7.0 {
                // Pause at 270°
                sweepAngle = pi2 * 0.75
            } else {
                // Snap back (fast return over 1s)
                let t = (sweepTime - 7.0)
                sweepAngle = pi2 * 0.75 * (1.0 - t)
            }

            // Main sweep line with bloom
            let sa = sweepAngle + top
            let mainSweep = Path { p in
                p.move(to: CGPoint(x: c.x + cos(sa) * R * 0.15, y: c.y + sin(sa) * R * 0.15))
                p.addLine(to: CGPoint(x: c.x + cos(sa) * R * 0.96, y: c.y + sin(sa) * R * 0.96))
            }
            // Bloom layers for the sweep line — cyan-tinted
            ctx.stroke(mainSweep, with: .color(jarvisCyan.opacity(0.04)), style: StrokeStyle(lineWidth: 14))
            ctx.stroke(mainSweep, with: .color(jarvisWhite.opacity(0.12)), style: StrokeStyle(lineWidth: 4))
            ctx.stroke(mainSweep, with: .color(jarvisWhite.opacity(0.55)), style: StrokeStyle(lineWidth: 1.5))

            // Trailing afterglow (fading cyan wedge behind sweep)
            if sweepTime < 6.0 {
                for trail in 1..<16 {
                    let trailAngle = sa - Double(trail) * 0.025
                    let trailOpacity = (1.0 - Double(trail) / 16.0) * 0.15
                    let sp = Path { p in
                        p.move(to: CGPoint(x: c.x + cos(trailAngle) * R * 0.20, y: c.y + sin(trailAngle) * R * 0.20))
                        p.addLine(to: CGPoint(x: c.x + cos(trailAngle) * R * 0.94, y: c.y + sin(trailAngle) * R * 0.94))
                    }
                    ctx.stroke(sp, with: .color(jarvisCyan.opacity(trailOpacity)), style: StrokeStyle(lineWidth: 1.0))
                }
            }

            // Bright dot at sweep tip — cyan glow + white center
            let tipX = c.x + cos(sa) * R * 0.96
            let tipY = c.y + sin(sa) * R * 0.96
            let tipGlow = CGRect(x: tipX - 7, y: tipY - 7, width: 14, height: 14)
            ctx.fill(Path(ellipseIn: tipGlow), with: .color(jarvisCyan.opacity(0.12)))
            let tipDot = CGRect(x: tipX - 2.5, y: tipY - 2.5, width: 5, height: 5)
            ctx.fill(Path(ellipseIn: tipDot), with: .color(Color.white.opacity(0.75)))

            // ══════════════════════════════════════════════════════════════
            //  DEGREE MARKERS — 8 compass points at 1.06R
            // ══════════════════════════════════════════════════════════════

            let degreeMarkers: [(Double, String)] = [
                (0, "000"), (Double.pi/4, "045"), (Double.pi/2, "090"),
                (Double.pi*3/4, "135"), (Double.pi, "180"),
                (Double.pi*5/4, "225"), (Double.pi*3/2, "270"),
                (Double.pi*7/4, "315")
            ]
            for (angle, label) in degreeMarkers {
                let textR = R * 1.06
                let tx = c.x + cos(angle - Double.pi/2) * textR
                let ty = c.y + sin(angle - Double.pi/2) * textR
                ctx.draw(
                    Text(label)
                        .font(.custom("Menlo", size: 8))
                        .foregroundColor(jarvisWhite.opacity(0.50)),
                    at: CGPoint(x: tx, y: ty)
                )
            }

        } // end Canvas
        // Ring labels overlay — white/silver
        .overlay(
            ZStack {
                // E-CORES label — cyan
                Text("E-CORES")
                    .font(.custom("Menlo", size: 9)).tracking(3)
                    .foregroundColor(cyan.opacity(0.65))
                    .shadow(color: cyan.opacity(0.3), radius: 4)
                    .position(x: center.x, y: center.y - R * 0.78 - 18)
                // P-CORES label — amber
                Text("P-CORES")
                    .font(.custom("Menlo", size: 8)).tracking(2)
                    .foregroundColor(amber.opacity(0.55))
                    .position(x: center.x, y: center.y - R * 0.65 - 15)
                // S-CORES label — crimson
                Text("S-CORES")
                    .font(.custom("Menlo", size: 8)).tracking(2)
                    .foregroundColor(crimson.opacity(0.55))
                    .position(x: center.x, y: center.y - R * 0.55 - 15)
                // GPU label
                Text("GPU")
                    .font(.custom("Menlo", size: 8)).tracking(2)
                    .foregroundColor(Color.white.opacity(0.50))
                    .position(x: center.x, y: center.y - R * 0.88 - 14)
            }
        )
    }
}

// MARK: - JARVIS Arm Panels ──────────────────────────────────────────────────

// MARK: - JarvisCircularGauge ────────────────────────────────────────────────

struct JarvisCircularGauge: View {
    let value: Double
    let displayValue: String
    let unit: String
    let label: String
    let size: CGFloat
    let phase: Double
    var accentColor: Color = Color(red: 0.0, green: 0.83, blue: 1.0)

    var body: some View {
        ZStack {
            // Track arc (270°) — subtle with accent tint
            Circle()
                .trim(from: 0.125, to: 0.875)
                .stroke(accentColor.opacity(0.10), style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
                .frame(width: size, height: size)

            // Ultra-wide bloom behind fill
            Circle()
                .trim(from: 0.125, to: 0.125 + 0.75 * min(value, 1.0))
                .stroke(accentColor.opacity(0.06), style: StrokeStyle(lineWidth: 20, lineCap: .round))
                .frame(width: size, height: size)
                .blur(radius: 4)

            // Bloom behind fill
            Circle()
                .trim(from: 0.125, to: 0.125 + 0.75 * min(value, 1.0))
                .stroke(accentColor.opacity(0.15), style: StrokeStyle(lineWidth: 10, lineCap: .round))
                .frame(width: size, height: size)
                .blur(radius: 2)

            // Fill arc — accent colored
            Circle()
                .trim(from: 0.125, to: 0.125 + 0.75 * min(value, 1.0))
                .stroke(accentColor.opacity(0.85), style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
                .frame(width: size, height: size)

            // White-hot center of fill arc
            Circle()
                .trim(from: 0.125, to: 0.125 + 0.75 * min(value, 1.0))
                .stroke(Color.white.opacity(0.45), style: StrokeStyle(lineWidth: 1.2, lineCap: .round))
                .frame(width: size, height: size)

            // 12 tick marks — accent tinted
            ForEach(0..<12, id: \.self) { i in
                let angle = 135.0 + Double(i) * (270.0 / 11.0)
                Rectangle()
                    .fill(accentColor.opacity(i % 3 == 0 ? 0.50 : 0.20))
                    .frame(width: 0.6, height: i % 3 == 0 ? 6 : 3)
                    .offset(y: -size / 2 + 2)
                    .rotationEffect(.degrees(angle))
            }

            // Value + unit — LARGER, with accent glow
            VStack(spacing: 1) {
                Text(displayValue)
                    .font(.custom("Menlo", size: size * 0.30)).fontWeight(.bold)
                    .foregroundColor(accentColor.opacity(0.95))
                    .shadow(color: accentColor.opacity(0.5), radius: 4)
                Text(unit)
                    .font(.custom("Menlo", size: size * 0.13))
                    .foregroundColor(accentColor.opacity(0.50))
            }
        }
        .frame(width: size, height: size)
        .overlay(alignment: .bottom) {
            Text(label)
                .font(.custom("Menlo", size: 7)).tracking(2)
                .foregroundColor(accentColor.opacity(0.60))
                .offset(y: 10)
        }
    }
}

// MARK: - JarvisDataRow ──────────────────────────────────────────────────────

enum JarvisAccentColor {
    case cyan, amber, crimson

    var color: Color {
        switch self {
        case .cyan: return Color(red: 0.0, green: 0.83, blue: 1.0)
        case .amber: return Color(red: 1.0, green: 0.78, blue: 0.0)
        case .crimson: return Color(red: 1.0, green: 0.15, blue: 0.20)
        }
    }
}

struct JarvisDataRow: View {
    let label: String
    let value: String
    var accentColor: JarvisAccentColor = .cyan

    var body: some View {
        HStack {
            Text(label)
                .font(.custom("Menlo", size: 8)).tracking(2)
                .foregroundColor(Color(red: 0.4, green: 0.50, blue: 0.55).opacity(0.75))
            Spacer()
            Text(value)
                .font(.custom("Menlo", size: 11)).fontWeight(.bold)
                .foregroundColor(accentColor.color.opacity(0.90))
                .shadow(color: accentColor.color.opacity(0.4), radius: 4)
        }
    }
}

// MARK: - JarvisCoreBarGauge ─────────────────────────────────────────────────

struct JarvisCoreBarGauge: View {
    let values: [Double]
    let label: String
    var barColor: Color = Color(red: 0.0, green: 0.83, blue: 1.0)

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                    .font(.custom("Menlo", size: 7)).tracking(2)
                    .foregroundColor(barColor.opacity(0.65))
                Spacer()
                // Average value display
                Text(String(format: "%.0f%%", (values.reduce(0, +) / max(1, Double(values.count))) * 100))
                    .font(.custom("Menlo", size: 8)).fontWeight(.bold)
                    .foregroundColor(barColor.opacity(0.80))
            }

            HStack(spacing: 2) {
                ForEach(Array(values.enumerated()), id: \.offset) { _, val in
                    ZStack(alignment: .bottom) {
                        // Track
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(barColor.opacity(0.08))
                            .frame(width: 5, height: 28)
                        // Fill — color-coded by intensity
                        let fillColor = val > 0.9 ? Color(red: 1.0, green: 0.15, blue: 0.20) :
                                        val > 0.7 ? Color(red: 1.0, green: 0.78, blue: 0.0) : barColor
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(fillColor.opacity(0.75))
                            .frame(width: 5, height: max(1, CGFloat(val) * 28))
                        // Bloom glow
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(fillColor.opacity(0.15))
                            .frame(width: 10, height: max(1, CGFloat(val) * 28))
                            .blur(radius: 2)
                    }
                }
            }
        }
    }
}

// MARK: - JarvisPanelBox ─────────────────────────────────────────────────────

struct JarvisPanelBox<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    private let panelCyan = Color(red: 0.0, green: 0.83, blue: 1.0)

    var body: some View {
        content
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.black.opacity(0.55))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(panelCyan.opacity(0.18), lineWidth: 0.6)
            )
            .overlay(
                GeometryReader { geo in
                    // Corner accent dots — holographic border detail
                    let w = geo.size.width
                    let h = geo.size.height
                    ZStack {
                        Circle().fill(panelCyan.opacity(0.40)).frame(width: 3, height: 3)
                            .position(x: 4, y: 4)
                        Circle().fill(panelCyan.opacity(0.40)).frame(width: 3, height: 3)
                            .position(x: w - 4, y: 4)
                        Circle().fill(panelCyan.opacity(0.25)).frame(width: 3, height: 3)
                            .position(x: 4, y: h - 4)
                        Circle().fill(panelCyan.opacity(0.25)).frame(width: 3, height: 3)
                            .position(x: w - 4, y: h - 4)
                        // Bottom edge accent line
                        Path { p in
                            p.move(to: CGPoint(x: 8, y: h - 1))
                            p.addLine(to: CGPoint(x: w - 8, y: h - 1))
                        }
                        .stroke(panelCyan.opacity(0.10), lineWidth: 0.5)
                    }
                }
            )
    }
}

// MARK: - CentralStatsView ───────────────────────────────────────────────────

struct CentralStatsView: View {
    @EnvironmentObject var store: TelemetryStore

    var body: some View {
        VStack(spacing: 6) {
            Text(store.chipName)
                .font(.custom("Menlo", size: 9)).tracking(4)
                .foregroundColor(Color.white.opacity(0.35))

            DigitCipherText(
                value: String(format: "%.0f", store.totalPower),
                font: .custom("Menlo", size: 72).weight(.bold),
                color: Color.white
            )
                .shadow(color: Color.white.opacity(0.80), radius: 4)
                .shadow(color: Color.white.opacity(0.50), radius: 16)
                .shadow(color: Color.white.opacity(0.25), radius: 40)
                .shadow(color: Color.white.opacity(0.10), radius: 80)

            Text("WATTS")
                .font(.custom("Menlo", size: 7)).tracking(5)
                .foregroundColor(Color.white.opacity(0.45))

            // Divider with glow
            Rectangle()
                .fill(Color.white.opacity(0.30))
                .frame(width: 80, height: 0.5)
                .shadow(color: Color.white.opacity(0.2), radius: 6)

            Text(store.thermalState.uppercased())
                .font(.custom("Menlo", size: 9)).tracking(3)
                .foregroundColor(thermalColor)
                .shadow(color: thermalColor.opacity(0.7), radius: 5)
        }
    }

    private var thermalColor: Color {
        switch store.thermalState.lowercased() {
        case "nominal", "normal": return .white
        case "fair": return Color(red: 1.0, green: 0.8, blue: 0.0)
        case "serious": return Color(red: 1.0, green: 0.3, blue: 0.0)
        case "critical": return Color(red: 1.0, green: 0.0, blue: 0.0)
        default: return .white
        }
    }
}


// MARK: - HorizontalStatusBar ─────────────────────────────────────────────────

struct HorizontalStatusBar: View {
    let store: TelemetryStore
    let width: CGFloat
    let cyan: Color
    let amber: Color
    let phase: Double

    private let barWhite = Color.white
    private let barSilver = Color(red: 0.85, green: 0.90, blue: 0.95)

    var body: some View {
        VStack(spacing: 6) {
            // CPU usage bar
            HStack(spacing: 8) {
                Text("CPU")
                    .font(.custom("Menlo", size: 7)).tracking(2)
                    .foregroundColor(barWhite.opacity(0.40))
                    .frame(width: 28, alignment: .trailing)

                ZStack(alignment: .leading) {
                    // Track
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(barWhite.opacity(0.06))
                        .frame(width: width * 0.7, height: 6)

                    // Fill
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(
                            LinearGradient(
                                colors: [barWhite.opacity(0.4), barWhite],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: width * 0.7 * min(averageCPU, 1.0), height: 6)
                        .shadow(color: barWhite.opacity(0.5), radius: 4)

                    // Glow
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(barWhite.opacity(0.08))
                        .frame(width: width * 0.7 * min(averageCPU, 1.0), height: 14)
                        .blur(radius: 4)
                }

                Text(String(format: "%.0f%%", averageCPU * 100))
                    .font(.custom("Menlo", size: 8)).fontWeight(.bold)
                    .foregroundColor(barWhite.opacity(0.6))
                    .frame(width: 32)
            }

            // Memory pressure bar
            HStack(spacing: 8) {
                Text("MEM")
                    .font(.custom("Menlo", size: 7)).tracking(2)
                    .foregroundColor(barSilver.opacity(0.40))
                    .frame(width: 28, alignment: .trailing)

                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(barSilver.opacity(0.06))
                        .frame(width: width * 0.7, height: 6)

                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(
                            LinearGradient(
                                colors: [barSilver.opacity(0.4), barSilver],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: width * 0.7 * min(store.swapPressure, 1.0), height: 6)
                        .shadow(color: barSilver.opacity(0.5), radius: 4)
                }

                Text(String(format: "%.0f%%", store.swapPressure * 100))
                    .font(.custom("Menlo", size: 8)).fontWeight(.bold)
                    .foregroundColor(barSilver.opacity(0.6))
                    .frame(width: 32)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 3)
                .fill(Color.black.opacity(0.40))
                .overlay(RoundedRectangle(cornerRadius: 3).stroke(barWhite.opacity(0.12), lineWidth: 0.5))
        )
    }

    private var averageCPU: Double {
        let all = store.eCoreUsages + store.pCoreUsages + store.sCoreUsages
        guard !all.isEmpty else { return 0 }
        return all.reduce(0, +) / Double(all.count)
    }
}

