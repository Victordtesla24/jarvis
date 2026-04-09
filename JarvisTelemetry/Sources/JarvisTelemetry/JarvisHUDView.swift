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

                // Subtle radial vignette centered on reactor
                // Reactor ambient bloom — the reactor casts cyan light
                RadialGradient(
                    gradient: Gradient(colors: [
                        Color.white.opacity(0.04),
                        Color.white.opacity(0.02),
                        Color.clear
                    ]),
                    center: .center,
                    startRadius: R * 0.1,
                    endRadius: R * 1.2
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

                // ── 8. LEFT ARM — extends from reactor ─────────────────
                JarvisArmPanel(
                    side: .left,
                    cx: cx, cy: cy, R: R,
                    width: w, height: h,
                    phase: phase,
                    panels: [
                        ArmPanelData(label: "GPU", value: String(format: "%.0f%%", store.gpuUsage * 100), sub: "UTILIZATION"),
                        ArmPanelData(label: "DVHOP", value: String(format: "%.2f%%", store.dvhopCPUPct), sub: "HYPERVISOR TAX"),
                        ArmPanelData(label: "GUMER", value: String(format: "%.2f", store.gumerMBs), sub: "MB/s EVICTION"),
                        ArmPanelData(label: "CCTC", value: String(format: "+%.1f\u{00B0}C", store.cctcDeltaC), sub: "THERMAL COST"),
                    ]
                )

                // ── 9. RIGHT ARM — extends from reactor ────────────────
                JarvisArmPanel(
                    side: .right,
                    cx: cx, cy: cy, R: R,
                    width: w, height: h,
                    phase: phase,
                    panels: [
                        ArmPanelData(label: "CPU", value: String(format: "%.1f\u{00B0}C", store.cpuTemp), sub: "TEMPERATURE"),
                        ArmPanelData(label: "GPU", value: String(format: "%.1f\u{00B0}C", store.gpuTemp), sub: "TEMPERATURE"),
                        ArmPanelData(label: "MEMORY", value: String(format: "%.1f / %.0f GB", store.memoryUsedGB, store.memoryTotalGB), sub: "UNIFIED"),
                        ArmPanelData(label: "DRAM", value: String(format: "%.1f GB/s", store.dramReadBW), sub: "BANDWIDTH"),
                    ]
                )

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
                FloatingPanelOverlay(manager: floatingPanelManager, cyan: Color.white, amber: Color(red: 0.85, green: 0.90, blue: 0.95))

                // ── 13. SCANNER SWEEP ───────────────────────────────────
                ScannerSweepOverlay(width: w, height: h, phase: phase, cyan: Color.white)
            }
            .holographicFlicker(phase: phase)
            .onAppear {
                chatterEngine.bind(to: store)
                awarenessEngine.bind(to: store)
                floatingPanelManager.bind(to: store)
            }
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

                // Center: Time
                Text(store.timeString)
                    .font(.custom("Menlo", size: 26)).fontWeight(.light)
                    .foregroundColor(Color.white)
                    .shadow(color: Color.white.opacity(0.7), radius: 4)
                    .shadow(color: Color.white.opacity(0.3), radius: 16)
                    .shadow(color: Color.white.opacity(0.10), radius: 40)

                Spacer()

                // Right: Date
                VStack(alignment: .trailing, spacing: 2) {
                    Text(currentDayOfMonth)
                        .font(.custom("Menlo", size: 32)).fontWeight(.bold)
                        .foregroundColor(Color.white.opacity(0.80))
                        .shadow(color: Color.white.opacity(0.5), radius: 6)
                    Text(currentMonthYear)
                        .font(.custom("Menlo", size: 8)).tracking(3)
                        .foregroundColor(Color.white.opacity(0.35))
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

                // Center: large clock
                Text(store.timeString)
                    .font(.custom("Menlo", size: 22)).fontWeight(.medium)
                    .foregroundColor(Color.white.opacity(0.60))
                    .shadow(color: Color.white.opacity(0.3), radius: 8)

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
            let cpuAvg = (store.eCoreUsages + store.pCoreUsages + store.sCoreUsages)
                .reduce(0, +) / max(1, Double(store.eCoreUsages.count + store.pCoreUsages.count + store.sCoreUsages.count))
            let speedMul = 1.0 + cpuAvg * 0.5
            let ph = phase * speedMul

            // ══════════════════════════════════════════════════════════════
            //  IRON MAN JARVIS REACTOR — White/Silver Cinema Reference
            //  Bright white rings with massive bloom glow halos.
            //  Segmented arcs, dotted perimeter, chevron markers.
            //  Pure black background, projected-light aesthetic.
            // ══════════════════════════════════════════════════════════════

            // ═══════════════════════════════════════════════════════════
            //  JARVIS white/silver palette (from reference video)
            // ═══════════════════════════════════════════════════════════
            let jarvisWhite = Color.white
            let jarvisSilver = Color(red: 0.85, green: 0.90, blue: 0.95)
            let jarvisCyan = Color(red: 0.5, green: 0.8, blue: 0.9)
            let jarvisDim = Color(red: 0.4, green: 0.45, blue: 0.5)

            // ═══════════════════════════════════════════════════════════
            //  HELPERS — cinema bloom style
            // ═══════════════════════════════════════════════════════════

            func ring(_ r: Double, _ col: Color, _ w: Double, dash: [CGFloat]? = nil) {
                let p = Path { p in p.addArc(center: c, radius: r, startAngle: .zero, endAngle: .radians(pi2), clockwise: false) }
                let s = dash != nil ? StrokeStyle(lineWidth: w, lineCap: .butt, dash: dash!) : StrokeStyle(lineWidth: w, lineCap: .butt)
                ctx.stroke(p, with: .color(col), style: s)
            }

            // Cinema bloom — 5-layer glow that makes rings look like illuminated light tubes
            func bloomRing(_ r: Double, _ col: Color, _ w: Double) {
                ring(r, col.opacity(0.03), w + 30)  // ultra-wide ambient
                ring(r, col.opacity(0.06), w + 20)  // wide soft glow
                ring(r, col.opacity(0.12), w + 12)  // medium glow
                ring(r, col.opacity(0.40), w + 4)   // near glow
                ring(r, col.opacity(0.90), w)        // bright core
                ring(r, Color.white.opacity(0.60), w * 0.4) // white-hot center
            }

            // Bloom arc — same layered glow for partial arcs
            func bloomArc(_ r: Double, _ startAngle: Double, _ sweep: Double, _ col: Color, _ w: Double) {
                for (extraW, opacity) in [(30.0, 0.03), (20.0, 0.06), (12.0, 0.12), (4.0, 0.40), (0.0, 0.90)] {
                    let p = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(startAngle), endAngle: .radians(startAngle + sweep), clockwise: false) }
                    ctx.stroke(p, with: .color(col.opacity(opacity)), style: StrokeStyle(lineWidth: w + extraW, lineCap: .round))
                }
                // white-hot center line
                let wp = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(startAngle), endAngle: .radians(startAngle + sweep), clockwise: false) }
                ctx.stroke(wp, with: .color(Color.white.opacity(0.55)), style: StrokeStyle(lineWidth: w * 0.4, lineCap: .round))
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

            // GPU data arc — white, 10px wide, with bloom
            let gpuVal = [min(store.gpuUsage, 1.0)]
            dataArc(gpuVal, R * 0.88, 10.0, jarvisWhite)

            // ══════════════════════════════════════════════════════════════
            //  ZONE 4: E-CORE DATA (0.78R)
            //  Bloom marker + E-core data arcs + structural
            // ══════════════════════════════════════════════════════════════

            // Cyan zone marker
            bloomRing(R * 0.82, jarvisCyan.opacity(0.25), 2.0)

            // E-core data arcs — white, 10px wide
            dataArc(store.eCoreUsages, R * 0.78, 10.0, jarvisWhite)

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

            // P-core data arcs — silver, 10px wide
            dataArc(store.pCoreUsages, R * 0.65, 10.0, jarvisSilver)

            // 4 chevrons at 0.63R — COUNTER-CLOCKWISE
            chevrons(R * 0.63, jarvisWhite.opacity(0.50), 8, 4, rot: -0.06)

            // ══════════════════════════════════════════════════════════════
            //  ZONE 6: S-CORE DATA (0.55R)
            //  S-core data arcs + segmented arc
            // ══════════════════════════════════════════════════════════════

            // S-core data arcs — silver, 8px wide
            dataArc(store.sCoreUsages, R * 0.55, 8.0, jarvisSilver)

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
            //  Bloom rings + targeting reticle + crosshair + BLAZING CORE
            // ══════════════════════════════════════════════════════════════

            // Bloom rings at core boundary
            bloomRing(R * 0.22, jarvisWhite, 2.0)
            bloomRing(R * 0.15, jarvisWhite, 2.0)

            // Targeting reticle — dashed circles
            let reticlePulse = 0.85 + sin(ph * 1.5) * 0.15
            ring(R * 0.10, jarvisWhite.opacity(0.35 * reticlePulse), 1.0, dash: [4, 4])
            ring(R * 0.06, jarvisWhite.opacity(0.30 * reticlePulse), 1.0, dash: [3, 5])

            // Crosshair lines (4 directions, 0.03R to 0.08R)
            for angle in [0.0, Double.pi / 2, Double.pi, Double.pi * 1.5] {
                let dx = cos(angle)
                let dy = sin(angle)
                let cp = Path { p in
                    p.move(to: CGPoint(x: c.x + dx * R * 0.03, y: c.y + dy * R * 0.03))
                    p.addLine(to: CGPoint(x: c.x + dx * R * 0.08, y: c.y + dy * R * 0.08))
                }
                ctx.stroke(cp, with: .color(jarvisWhite.opacity(0.45 * reticlePulse)), style: StrokeStyle(lineWidth: 1.0))
            }

            // ── BLAZING CORE GLOW — cardiac heartbeat ───────────────
            let bpm = 45.0 + cpuAvg * 75.0
            let heartPeriod = 60.0 / bpm
            let heartPhase = (ph.truncatingRemainder(dividingBy: heartPeriod)) / heartPeriod
            let cardiac: Double
            if heartPhase < 0.1 {
                cardiac = 0.85 + 0.15 * (heartPhase / 0.1)
            } else if heartPhase < 0.25 {
                cardiac = 1.0 - 0.15 * ((heartPhase - 0.1) / 0.15)
            } else if heartPhase < 0.35 {
                cardiac = 0.85 + 0.05 * sin((heartPhase - 0.25) / 0.10 * .pi)
            } else {
                cardiac = 0.85
            }
            let corePulse = cardiac

            // 20 glow layers — MASSIVE bloom, the core is a LIGHT SOURCE
            for layer in 0..<20 {
                let lr = R * 0.005 + Double(layer) * R * 0.018
                let lo = (0.30 - Double(layer) * 0.014) * corePulse
                guard lo > 0 else { continue }
                let coreRect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                ctx.fill(Path(ellipseIn: coreRect), with: .color(jarvisWhite.opacity(lo)))
            }

            // Bright white sphere at 0.05R — LARGER
            let hotR = R * 0.05 * corePulse
            let hotRect = CGRect(x: c.x - hotR, y: c.y - hotR, width: hotR * 2, height: hotR * 2)
            ctx.fill(Path(ellipseIn: hotRect), with: .color(Color.white.opacity(0.85 * corePulse)))

            // Center point — PURE BLAZING white, 0.025R
            let innerR = R * 0.025 * corePulse
            let innerRect = CGRect(x: c.x - innerR, y: c.y - innerR, width: innerR * 2, height: innerR * 2)
            ctx.fill(Path(ellipseIn: innerRect), with: .color(Color.white.opacity(1.0)))

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
            // Bloom layers for the sweep line
            ctx.stroke(mainSweep, with: .color(jarvisWhite.opacity(0.06)), style: StrokeStyle(lineWidth: 12))
            ctx.stroke(mainSweep, with: .color(jarvisWhite.opacity(0.15)), style: StrokeStyle(lineWidth: 4))
            ctx.stroke(mainSweep, with: .color(jarvisWhite.opacity(0.60)), style: StrokeStyle(lineWidth: 1.5))

            // Trailing afterglow (fading wedge behind sweep)
            if sweepTime < 6.0 {
                for trail in 1..<16 {
                    let trailAngle = sa - Double(trail) * 0.025
                    let trailOpacity = (1.0 - Double(trail) / 16.0) * 0.18
                    let sp = Path { p in
                        p.move(to: CGPoint(x: c.x + cos(trailAngle) * R * 0.20, y: c.y + sin(trailAngle) * R * 0.20))
                        p.addLine(to: CGPoint(x: c.x + cos(trailAngle) * R * 0.94, y: c.y + sin(trailAngle) * R * 0.94))
                    }
                    ctx.stroke(sp, with: .color(jarvisWhite.opacity(trailOpacity)), style: StrokeStyle(lineWidth: 1.0))
                }
            }

            // Bright dot at sweep tip
            let tipX = c.x + cos(sa) * R * 0.96
            let tipY = c.y + sin(sa) * R * 0.96
            let tipGlow = CGRect(x: tipX - 6, y: tipY - 6, width: 12, height: 12)
            ctx.fill(Path(ellipseIn: tipGlow), with: .color(jarvisWhite.opacity(0.15)))
            let tipDot = CGRect(x: tipX - 2.5, y: tipY - 2.5, width: 5, height: 5)
            ctx.fill(Path(ellipseIn: tipDot), with: .color(jarvisWhite.opacity(0.80)))

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
                // E-CORES label
                Text("E-CORES")
                    .font(.custom("Menlo", size: 9)).tracking(3)
                    .foregroundColor(Color.white.opacity(0.60))
                    .shadow(color: Color.white.opacity(0.3), radius: 4)
                    .position(x: center.x, y: center.y - R * 0.78 - 18)
                // P-CORES label
                Text("P-CORES")
                    .font(.custom("Menlo", size: 8)).tracking(2)
                    .foregroundColor(Color(red: 0.85, green: 0.90, blue: 0.95).opacity(0.50))
                    .position(x: center.x, y: center.y - R * 0.65 - 15)
                // S-CORES label
                Text("S-CORES")
                    .font(.custom("Menlo", size: 8)).tracking(2)
                    .foregroundColor(Color(red: 0.85, green: 0.90, blue: 0.95).opacity(0.50))
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

enum ArmSide { case left, right }

struct ArmPanelData {
    let label: String
    let value: String
    let sub: String
}

struct JarvisArmPanel: View {
    let side: ArmSide
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let width: CGFloat, height: CGFloat
    let phase: Double
    let panels: [ArmPanelData]

    // Unified JARVIS palette
    private let jarvisWhite = Color.white
    private let jarvisSilver = Color(red: 0.85, green: 0.90, blue: 0.95)
    private let jarvisDim = Color(red: 0.4, green: 0.45, blue: 0.5)

    var body: some View {
        let isLeft = side == .left
        let panelX = isLeft ? width * 0.06 : width * 0.94
        let armOriginX = cx + (isLeft ? -R * 0.98 : R * 0.98)
        let armOriginY = cy

        ZStack {
            // ── CONNECTING ARM LINE from reactor to panel zone ──
            Canvas { ctx, size in
                // Main arm line — horizontal from reactor edge to panel
                let startX = armOriginX
                let endX = isLeft ? panelX + 70 : panelX - 70

                // Arm with 90-degree bend
                let bendY = armOriginY - CGFloat(panels.count) * 28
                let armPath = Path { p in
                    p.move(to: CGPoint(x: startX, y: armOriginY))
                    p.addLine(to: CGPoint(x: endX, y: armOriginY))
                    p.addLine(to: CGPoint(x: endX, y: bendY))
                }

                // Bloom on arm line
                ctx.stroke(armPath, with: .color(jarvisWhite.opacity(0.04)), style: StrokeStyle(lineWidth: 12, lineCap: .round, lineJoin: .round))
                ctx.stroke(armPath, with: .color(jarvisWhite.opacity(0.10)), style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
                ctx.stroke(armPath, with: .color(jarvisWhite.opacity(0.40)), style: StrokeStyle(lineWidth: 1.0, lineCap: .round, lineJoin: .round))

                // Small node dot at reactor junction
                let nodeDot = CGRect(x: startX - 3, y: armOriginY - 3, width: 6, height: 6)
                ctx.fill(Path(ellipseIn: nodeDot), with: .color(jarvisWhite.opacity(0.60)))

                // Branch lines to each panel
                for (i, _) in panels.enumerated() {
                    let panelY = armOriginY - 80 + CGFloat(i) * 56
                    let branchStart = CGPoint(x: endX, y: panelY)
                    let branchEnd = CGPoint(x: isLeft ? panelX + 8 : panelX - 8, y: panelY)

                    let branchPath = Path { p in
                        p.move(to: branchStart)
                        p.addLine(to: branchEnd)
                    }
                    ctx.stroke(branchPath, with: .color(jarvisWhite.opacity(0.06)), style: StrokeStyle(lineWidth: 8))
                    ctx.stroke(branchPath, with: .color(jarvisWhite.opacity(0.25)), style: StrokeStyle(lineWidth: 1.0))

                    // Connector dot
                    let dot = CGRect(x: branchEnd.x - 2, y: branchEnd.y - 2, width: 4, height: 4)
                    ctx.fill(Path(ellipseIn: dot), with: .color(jarvisWhite.opacity(0.50)))
                }
            }
            .allowsHitTesting(false)

            // ── PANEL CARDS ──
            VStack(alignment: isLeft ? .leading : .trailing, spacing: 12) {
                ForEach(Array(panels.enumerated()), id: \.offset) { _, panel in
                    JarvisDataCard(
                        label: panel.label,
                        value: panel.value,
                        sub: panel.sub,
                        alignment: isLeft ? .leading : .trailing,
                        phase: phase
                    )
                }
            }
            .frame(width: width * 0.13)
            .position(x: panelX, y: cy - 10)
        }
    }
}

struct JarvisDataCard: View {
    let label: String
    let value: String
    let sub: String
    let alignment: HorizontalAlignment
    let phase: Double

    private let jarvisWhite = Color.white
    private let jarvisSilver = Color(red: 0.85, green: 0.90, blue: 0.95)
    private let jarvisDim = Color(red: 0.4, green: 0.45, blue: 0.5)

    var body: some View {
        VStack(alignment: alignment, spacing: 2) {
            // Label
            Text(label)
                .font(.custom("Menlo", size: 7)).tracking(3)
                .foregroundColor(jarvisDim.opacity(0.70))

            // Value — large, bright
            Text(value)
                .font(.custom("Menlo", size: 16)).fontWeight(.bold)
                .foregroundColor(jarvisWhite.opacity(0.85))
                .shadow(color: jarvisWhite.opacity(0.20), radius: 8)
                .shadow(color: jarvisWhite.opacity(0.10), radius: 16)

            // Sub-label
            Text(sub)
                .font(.custom("Menlo", size: 6)).tracking(2)
                .foregroundColor(jarvisDim.opacity(0.45))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 2)
                .fill(Color.black.opacity(0.40))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 2)
                .stroke(jarvisWhite.opacity(0.12), lineWidth: 0.5)
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

