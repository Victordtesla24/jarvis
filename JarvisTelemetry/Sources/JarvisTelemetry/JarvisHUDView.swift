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
                // ── 1. BACKGROUND: dark blue-black with hex grid ─────────
                darkBlue.ignoresSafeArea()

                // Hex grid background
                HexGridCanvas(width: w, height: h, phase: phase, color: gridBlue)

                // Subtle radial vignette centered on reactor
                RadialGradient(
                    gradient: Gradient(colors: [
                        cyan.opacity(0.03),
                        cyan.opacity(0.015),
                        Color.clear,
                        darkBlue.opacity(0.6)
                    ]),
                    center: .center,
                    startRadius: R * 0.2,
                    endRadius: max(w, h) * 0.7
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

                // ── 8. LEFT PANEL STACK ──────────────────────────────────
                VStack(alignment: .leading, spacing: 16) {
                    MiniArcGauge(value: store.gpuUsage, label: "GPU", color: cyan, phase: phase)
                    HoloPanelView(name: "DVHOP", value: String(format: "%.2f%%", store.dvhopCPUPct), sub: "Hypervisor CPU Tax", color: amber, style: .left)
                    HoloPanelView(name: "GUMER", value: String(format: "%.2f MB/s", store.gumerMBs), sub: "UMA Eviction Rate", color: cyan, style: .left)
                    HoloPanelView(name: "CCTC", value: String(format: "+%.1f\u{00B0}C", store.cctcDeltaC), sub: "Thermal Cost", color: crimson, style: .left)
                    VerticalBarGauge(values: store.eCoreUsages, label: "E-CORES", color: cyan, phase: phase)
                }
                .frame(width: w * 0.14)
                .position(x: w * 0.085, y: h * 0.48)

                // ── 9. RIGHT PANEL STACK ─────────────────────────────────
                VStack(alignment: .trailing, spacing: 16) {
                    MiniArcReactor(phase: phase, cyan: cyan, cyanBright: cyanBright)
                    PowerThermalPanel().environmentObject(store)
                    DRAMBandwidthPanel().environmentObject(store)
                    VerticalBarGauge(values: store.pCoreUsages, label: "P-CORES", color: amber, phase: phase)
                }
                .frame(width: w * 0.16)
                .position(x: w * 0.92, y: h * 0.48)

                // ── 10. CHATTER STREAMS ─────────────────────────────────
                ChatterStreamView(engine: chatterEngine, alignment: .left, phase: phase)
                    .frame(width: w * 0.20, alignment: .leading)
                    .position(x: w * 0.12, y: h * 0.65)

                ChatterStreamView(engine: chatterEngine, alignment: .right, phase: phase)
                    .frame(width: w * 0.18, alignment: .trailing)
                    .position(x: w * 0.88, y: h * 0.65)
            }
            .holographicFlicker(phase: phase)
            .onAppear {
                chatterEngine.bind(to: store)
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
            let inset: CGFloat = 16
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
                    Text("S.H.I.E.L.D. OS")
                        .font(.custom("Menlo", size: 8)).tracking(4)
                        .foregroundColor(cyan.opacity(0.4))
                    Text("JARVIS TELEMETRY v3.1")
                        .font(.custom("Menlo", size: 7)).tracking(3)
                        .foregroundColor(cyan.opacity(0.25))
                }

                Spacer()

                // Center: Time
                Text(store.timeString)
                    .font(.custom("Menlo", size: 26)).fontWeight(.light)
                    .foregroundColor(cyan)
                    .shadow(color: cyan.opacity(0.9), radius: 4)
                    .shadow(color: cyan.opacity(0.4), radius: 16)
                    .shadow(color: cyan.opacity(0.15), radius: 40)

                Spacer()

                // Right: Date
                VStack(alignment: .trailing, spacing: 2) {
                    Text(currentDayOfMonth)
                        .font(.custom("Menlo", size: 32)).fontWeight(.bold)
                        .foregroundColor(cyanBright)
                        .shadow(color: cyan.opacity(0.8), radius: 6)
                    Text(currentMonthYear)
                        .font(.custom("Menlo", size: 8)).tracking(3)
                        .foregroundColor(cyan.opacity(0.4))
                }
            }
            .padding(.horizontal, 30)
            .padding(.top, 12)

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
                    .font(.custom("Menlo", size: 9)).tracking(3)
                    .foregroundColor(cyan.opacity(0.35))

                Spacer()

                // Center: large clock
                Text(store.timeString)
                    .font(.custom("Menlo", size: 22)).fontWeight(.medium)
                    .foregroundColor(cyanBright.opacity(0.7))
                    .shadow(color: cyan.opacity(0.5), radius: 8)

                Spacer()

                // Right: thermal + power summary
                HStack(spacing: 12) {
                    Text(String(format: "%.0fW", store.totalPower))
                        .font(.custom("Menlo", size: 11)).foregroundColor(cyan.opacity(0.5))
                    Text(store.thermalState.uppercased())
                        .font(.custom("Menlo", size: 9)).tracking(2)
                        .foregroundColor(cyan.opacity(0.35))
                }
            }
            .padding(.horizontal, 30)
            .padding(.bottom, 14)
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
        Canvas { ctx, size in
            let c = center
            let pi2 = Double.pi * 2.0
            let top = -Double.pi / 2.0
            let ph = phase

            // ── HELPER: full circle ring ─────────────────────────────────
            func ring(_ r: Double, _ col: Color, _ w: Double, dash: [CGFloat]? = nil) {
                let p = Path { p in p.addArc(center: c, radius: r, startAngle: .zero, endAngle: .radians(pi2), clockwise: false) }
                let s = dash != nil ? StrokeStyle(lineWidth: w, lineCap: .butt, dash: dash!) : StrokeStyle(lineWidth: w, lineCap: .butt)
                ctx.stroke(p, with: .color(col), style: s)
            }

            // ── HELPER: glow ring (ring + TIGHT bloom — not diffuse) ─────
            func glowRing(_ r: Double, _ col: Color, _ w: Double, bloom: Double = 6) {
                ring(r, col.opacity(0.03), w + bloom)
                ring(r, col.opacity(0.12), w + bloom * 0.3)
                ring(r, col, w)
                ring(r, Color.white.opacity(0.12), w * 0.3)
            }

            // ── HELPER: tick marks with major/minor hierarchy + rotation ──
            func ticks(_ r: Double, _ n: Int, _ len: Double, _ col: Color, _ w: Double, rot: Double = 0, majorEvery: Int = 5) {
                let rotOff = rot * ph
                for i in 0..<n {
                    let isMajor = (i % majorEvery == 0)
                    let tLen = isMajor ? len * 1.8 : len
                    let tW = isMajor ? w * 2.0 : w
                    let tCol = isMajor ? col.opacity(1.0) : col.opacity(0.5)
                    let a = Double(i) / Double(n) * pi2 + rotOff
                    let p = Path { p in
                        p.move(to: CGPoint(x: c.x + cos(a) * (r - tLen/2), y: c.y + sin(a) * (r - tLen/2)))
                        p.addLine(to: CGPoint(x: c.x + cos(a) * (r + tLen/2), y: c.y + sin(a) * (r + tLen/2)))
                    }
                    ctx.stroke(p, with: .color(tCol), style: StrokeStyle(lineWidth: tW, lineCap: .butt))
                }
            }

            // ── HELPER: notch segments with rotation ─────────────────────
            func notch(_ r: Double, _ n: Int, _ frac: Double, _ col: Color, _ w: Double, rot: Double = 0) {
                let seg = pi2 / Double(n)
                let rotOff = rot * ph
                for i in 0..<n {
                    let s = Double(i) / Double(n) * pi2 + top + rotOff
                    let p = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(s), endAngle: .radians(s + seg * frac), clockwise: false) }
                    ctx.stroke(p, with: .color(col), style: StrokeStyle(lineWidth: w, lineCap: .butt))
                }
            }

            // ── HELPER: asymmetric rotating arc segments ─────────────────
            func arcs(_ r: Double, _ segments: [(start: Double, sweep: Double)], _ col: Color, _ w: Double, rot: Double = 0) {
                let rotOff = rot * ph
                for seg in segments {
                    let s = seg.start + rotOff
                    let p = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(s), endAngle: .radians(s + seg.sweep), clockwise: false) }
                    ctx.stroke(p, with: .color(col), style: StrokeStyle(lineWidth: w, lineCap: .round))
                }
            }

            // ── HELPER: glow arcs (arcs + TIGHT bloom) ────────────────────
            func glowArcs(_ r: Double, _ segments: [(start: Double, sweep: Double)], _ col: Color, _ w: Double, rot: Double = 0, bloom: Double = 4) {
                let rotOff = rot * ph
                for seg in segments {
                    let s = seg.start + rotOff
                    let p = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(s), endAngle: .radians(s + seg.sweep), clockwise: false) }
                    ctx.stroke(p, with: .color(col.opacity(0.05)), style: StrokeStyle(lineWidth: w + bloom, lineCap: .round))
                    ctx.stroke(p, with: .color(col.opacity(0.20)), style: StrokeStyle(lineWidth: w + 1, lineCap: .round))
                    ctx.stroke(p, with: .color(col), style: StrokeStyle(lineWidth: w, lineCap: .round))
                }
            }

            // ── HELPER: chevron/arrow markers ────────────────────────────
            func chevrons(_ r: Double, _ col: Color, _ sz: Double, _ count: Int = 4, rot: Double = 0) {
                let rotOff = rot * ph
                for i in 0..<count {
                    let a = Double(i) * pi2 / Double(count) + top + rotOff
                    let tip = CGPoint(x: c.x + cos(a) * (r + sz), y: c.y + sin(a) * (r + sz))
                    let l = CGPoint(x: c.x + cos(a - 0.08) * (r - sz * 0.2), y: c.y + sin(a - 0.08) * (r - sz * 0.2))
                    let rr = CGPoint(x: c.x + cos(a + 0.08) * (r - sz * 0.2), y: c.y + sin(a + 0.08) * (r - sz * 0.2))
                    let p = Path { p in p.move(to: l); p.addLine(to: tip); p.addLine(to: rr) }
                    ctx.stroke(p, with: .color(col), style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                }
            }

            // ── HELPER: orbiting dots ────────────────────────────────────
            func dots(_ r: Double, _ n: Int, _ col: Color, _ sz: Double, rot: Double = 0) {
                let rotOff = rot * ph
                for i in 0..<n {
                    let a = Double(i) / Double(n) * pi2 + rotOff
                    let pt = CGPoint(x: c.x + cos(a) * r, y: c.y + sin(a) * r)
                    let rect = CGRect(x: pt.x - sz/2, y: pt.y - sz/2, width: sz, height: sz)
                    ctx.fill(Path(ellipseIn: rect), with: .color(col))
                }
            }

            // ── HELPER: data core arcs — THIN precision arcs, tight bloom ─
            func coreArcs(_ usages: [Double], _ r: Double, _ w: Double, _ col: Color) {
                guard !usages.isEmpty else { return }
                let n = usages.count; let sw = pi2 / Double(n); let gap = sw * 0.06
                for (i, u) in usages.enumerated() {
                    let s0 = top + sw * Double(i) + gap / 2; let s1 = s0 + sw - gap
                    // Track background (subtle)
                    let tp = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(s0), endAngle: .radians(s1), clockwise: false) }
                    ctx.stroke(tp, with: .color(col.opacity(0.04)), style: StrokeStyle(lineWidth: w, lineCap: .round))
                    guard u > 0 else { continue }
                    let fe = s0 + (s1 - s0) * u
                    let fp = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(s0), endAngle: .radians(fe), clockwise: false) }
                    // 3-layer precision bloom — thin & restrained like real Jarvis
                    ctx.stroke(fp, with: .color(col.opacity(0.03)), style: StrokeStyle(lineWidth: w + 3, lineCap: .round))
                    ctx.stroke(fp, with: .color(col.opacity(0.18)), style: StrokeStyle(lineWidth: w + 0.5, lineCap: .round))
                    ctx.stroke(fp, with: .color(col.opacity(0.65)), style: StrokeStyle(lineWidth: w, lineCap: .round))
                    ctx.stroke(fp, with: .color(Color.white.opacity(0.10)), style: StrokeStyle(lineWidth: w * 0.25, lineCap: .round))
                }
            }

            // ── HELPER: radial spoke lines (reference shows these at zone boundaries)
            func spokes(_ rInner: Double, _ rOuter: Double, _ n: Int, _ col: Color, _ w: Double, rot: Double = 0) {
                let rotOff = rot * ph
                for i in 0..<n {
                    let a = Double(i) / Double(n) * pi2 + rotOff
                    let sp = Path { p in
                        p.move(to: CGPoint(x: c.x + cos(a) * rInner, y: c.y + sin(a) * rInner))
                        p.addLine(to: CGPoint(x: c.x + cos(a) * rOuter, y: c.y + sin(a) * rOuter))
                    }
                    ctx.stroke(sp, with: .color(col), style: StrokeStyle(lineWidth: w, lineCap: .butt))
                }
            }

            // ══════════════════════════════════════════════════════════════
            //  CINEMA-GRADE JARVIS REACTOR — 240+ ring layers
            // ══════════════════════════════════════════════════════════════

            // ── 0. ULTRA-DENSE BASE RING FILL ────────────────────────────
            // 220 concentric rings from 0.06R to 0.97R with varied styles
            for i in 0..<220 {
                let frac = Double(i) / 220.0
                let r = R * (0.06 + frac * 0.91)
                let distFromCenter = 1.0 - frac
                let baseOp = 0.14 + distFromCenter * 0.22
                let m = i % 18

                if m == 0 {
                    // Every 18th: steel accent with subtle cyan edge
                    ring(r, steel.opacity(min(baseOp + 0.18, 0.50)), 2.2)
                    ring(r, cyanDim.opacity(min(baseOp * 0.15, 0.06)), 3)
                } else if m == 9 {
                    // Offset accent: medium steel
                    ring(r, steel.opacity(min(baseOp + 0.10, 0.40)), 1.5)
                } else if m == 3 || m == 12 {
                    // Thicker steel band (2px)
                    ring(r, steel.opacity(baseOp * 1.2), 2.0)
                } else if m == 6 || m == 15 {
                    // Dashed ring
                    ring(r, steel.opacity(baseOp * 0.8), 0.5, dash: [2, 5])
                } else if m == 4 || m == 13 {
                    // Segmented ring
                    let nSeg = 6 + (i % 7) * 2
                    notch(r, nSeg, 0.6, steel.opacity(baseOp * 0.9), 0.8)
                } else if m == 7 || m == 16 {
                    // Fine dotted ring
                    ring(r, steel.opacity(baseOp * 0.6), 0.4, dash: [1, 3])
                } else {
                    // Default fill — visible steel rings
                    ring(r, steel.opacity(baseOp * 0.7), 0.4)
                }
            }

            // ── 0b. ACCENT GLOW RINGS (very subtle structural markers) ──
            glowRing(R * 0.94, cyanDim.opacity(0.4), 0.5, bloom: 2)
            glowRing(R * 0.82, cyanDim.opacity(0.35), 0.4, bloom: 2)
            glowRing(R * 0.72, cyanDim.opacity(0.35), 0.4, bloom: 2)
            glowRing(R * 0.62, cyanDim.opacity(0.35), 0.4, bloom: 2)
            glowRing(R * 0.50, cyanDim.opacity(0.30), 0.4, bloom: 2)
            glowRing(R * 0.38, cyanDim.opacity(0.25), 0.3, bloom: 2)
            glowRing(R * 0.25, cyanDim.opacity(0.25), 0.3, bloom: 2)

            // ══════════════════════════════════════════════════════════════
            //  HELPER: rectangular panel bezel (reused at multiple radii)
            // ══════════════════════════════════════════════════════════════
            func bezelPanels(_ inner: Double, _ outer: Double, _ count: Int, _ frac: Double, _ edgeBrightness: Double = 0.30) {
                let pw = outer - inner
                let midR = (inner + outer) / 2
                for i in 0..<count {
                    let seg = pi2 / Double(count)
                    let sA = Double(i) * seg + seg * (1.0 - frac) / 2
                    let eA = sA + seg * frac
                    // Dark fill — darker for more contrast
                    let pp = Path { p in p.addArc(center: c, radius: midR, startAngle: .radians(sA), endAngle: .radians(eA), clockwise: false) }
                    ctx.stroke(pp, with: .color(steel.opacity(0.10)), style: StrokeStyle(lineWidth: pw, lineCap: .butt))
                    // Animated border
                    let bOp = 0.25 + sin(ph * 0.5 + Double(i) * 0.5) * 0.06
                    ctx.stroke(pp, with: .color(steel.opacity(bOp)), style: StrokeStyle(lineWidth: pw, lineCap: .butt))
                    // Inner & outer edge lines — brighter for visible panel boundaries
                    let ip = Path { p in p.addArc(center: c, radius: inner, startAngle: .radians(sA), endAngle: .radians(eA), clockwise: false) }
                    let op = Path { p in p.addArc(center: c, radius: outer, startAngle: .radians(sA), endAngle: .radians(eA), clockwise: false) }
                    ctx.stroke(ip, with: .color(steel.opacity(edgeBrightness * 1.2)), style: StrokeStyle(lineWidth: 1.0))
                    ctx.stroke(op, with: .color(steel.opacity(edgeBrightness * 1.2)), style: StrokeStyle(lineWidth: 1.0))
                    // Radial side edges — visible panel separators
                    for angle in [sA, eA] {
                        let sp = Path { p in
                            p.move(to: CGPoint(x: c.x + cos(angle) * inner, y: c.y + sin(angle) * inner))
                            p.addLine(to: CGPoint(x: c.x + cos(angle) * outer, y: c.y + sin(angle) * outer))
                        }
                        ctx.stroke(sp, with: .color(steel.opacity(edgeBrightness * 0.9)), style: StrokeStyle(lineWidth: 0.7))
                    }
                }
            }

            // ══════════════════════════════════════════════════════════════
            //  PRIMARY OUTER BEZEL — thick industrial frame (0.96R → 1.06R)
            // ══════════════════════════════════════════════════════════════

            // ── MASSIVE OUTER BEZEL — dark industrial steel (ref-02 style) ──
            // Solid dark fill — bezel must read as a distinct opaque band
            ring(R * 1.01, Color(red: 0.08, green: 0.10, blue: 0.14).opacity(0.85), R * 0.14)
            ring(R * 1.01, steel.opacity(0.35), R * 0.14)   // steel tint over dark base
            ring(R * 1.01, steel.opacity(0.12), R * 0.20)   // wider shadow

            // Internal structure lines — visible metallic ridges
            ring(R * 0.96, steel.opacity(0.38), 1.5)
            ring(R * 0.98, steel.opacity(0.32), 1.2)
            ring(R * 1.00, steel.opacity(0.42), 2.0)        // center spine
            ring(R * 1.02, steel.opacity(0.32), 1.2)
            ring(R * 1.04, steel.opacity(0.35), 1.2)
            ring(R * 1.06, steel.opacity(0.32), 1.2)

            // Crisp edge lines — bright to define bezel boundary
            ring(R * 1.08, steel.opacity(0.72), 2.5)        // outer edge
            ring(R * 0.94, steel.opacity(0.75), 2.5)        // inner edge

            // 12 large rectangular segment panels (full bezel width)
            bezelPanels(R * 0.95, R * 1.07, 12, 0.62, 0.50)

            // Radial spokes through outer bezel (structural dividers)
            spokes(R * 0.94, R * 1.08, 36, steel.opacity(0.16), 0.4)
            spokes(R * 0.94, R * 1.08, 12, steel.opacity(0.30), 0.7)

            // Bezel accent elements
            chevrons(R * 1.03, cyan.opacity(0.25), 10, 4)
            ring(R * 0.965, steel.opacity(0.28), 0.8)

            // ── AMBER ACCENT RING (tucked inside bezel at inner edge) ────
            glowRing(R * 0.955, amber.opacity(0.65), 1.5, bloom: 4)
            ring(R * 0.955, amber.opacity(0.15), 3)    // warm glow

            // ── 2. OUTER TICK RING (150 ticks, CW) ──────────────────────
            ticks(R * 0.96, 150, 8, steel.opacity(0.55), 0.6, rot: 0.06, majorEvery: 5)
            ring(R * 0.95, steel.opacity(0.35), 0.8)

            // ── 3. ROTATING GLOW ARC SEGMENTS (outer) ───────────────────
            glowArcs(R * 0.935, [
                (0.2, 0.9), (1.6, 1.2), (3.2, 0.7), (4.8, 1.0), (5.8, 0.5)
            ], cyanDim.opacity(0.6), 2.0, rot: -0.04, bloom: 3)
            ring(R * 0.925, steel.opacity(0.18), 0.5, dash: [2, 5])

            // ── 4. GPU DATA ARC (thin, tight glow) ──────────────────────
            let gN = min(store.gpuUsage, 1.0)
            ring(R * 0.915, steel.opacity(0.08), 3)
            if gN > 0 {
                let gS = -Double.pi * 0.75; let gE = gS + Double.pi * 1.5 * gN
                let gP = Path { p in p.addArc(center: c, radius: R * 0.915, startAngle: .radians(gS), endAngle: .radians(gE), clockwise: false) }
                ctx.stroke(gP, with: .color(cyan.opacity(0.04)), style: StrokeStyle(lineWidth: 5, lineCap: .round))
                ctx.stroke(gP, with: .color(cyan.opacity(0.20)), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                ctx.stroke(gP, with: .color(cyan.opacity(0.65)), style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                ctx.stroke(gP, with: .color(Color.white.opacity(0.12)), style: StrokeStyle(lineWidth: 0.5, lineCap: .round))
            }
            ring(R * 0.905, cyan.opacity(0.18), 0.5)

            // ── 5. TICK RING 2 (100 ticks, CCW) ─────────────────────────
            ticks(R * 0.895, 100, 6, steel.opacity(0.52), 0.6, rot: -0.10, majorEvery: 5)
            notch(R * 0.88, 40, 0.50, steel.opacity(0.38), 3.5, rot: 0.02)
            ring(R * 0.87, steel.opacity(0.40), 1.0)

            // ══════════════════════════════════════════════════════════════
            //  INTERMEDIATE BEZEL 1 (0.86R → 0.89R) — E-core boundary
            // ══════════════════════════════════════════════════════════════
            ring(R * 0.875, Color(red: 0.08, green: 0.10, blue: 0.14).opacity(0.70), R * 0.04)
            ring(R * 0.875, steel.opacity(0.30), R * 0.04)   // steel tint
            ring(R * 0.875, steel.opacity(0.12), R * 0.06)   // wider subtle
            ring(R * 0.895, steel.opacity(0.60), 1.8)        // outer edge
            ring(R * 0.855, steel.opacity(0.62), 1.8)        // inner edge
            ring(R * 0.875, steel.opacity(0.38), 1.2)        // mid accent
            bezelPanels(R * 0.858, R * 0.892, 16, 0.55, 0.50)
            spokes(R * 0.855, R * 0.895, 24, steel.opacity(0.28), 0.5, rot: 0.01)

            // ══════════════════════════════════════════════════════════════
            //  E-CORE ZONE (0.80R → 0.86R)
            // ══════════════════════════════════════════════════════════════

            // ── 6. E-CORE DATA RING (thin precision arcs) ────────────────
            coreArcs(store.eCoreUsages, R * 0.845, 2.5, cyan)
            ring(R * 0.83, steel.opacity(0.30), 0.6)

            // ── 7. ORBITING DOTS ────────────────────────────────────────
            dots(R * 0.815, 16, cyan.opacity(0.40), 3, rot: 0.12)

            // ── 8. TICK RING 3 (80 ticks, CW) ──────────────────────────
            ticks(R * 0.80, 80, 5, steel.opacity(0.40), 0.5, rot: 0.14, majorEvery: 8)
            ring(R * 0.79, steel.opacity(0.22), 0.5, dash: [1, 3])

            // ── 9. ROTATING GLOW ARCS (mid-outer) ───────────────────────
            glowArcs(R * 0.78, [
                (0.5, 1.4), (2.3, 0.8), (4.0, 1.6), (5.8, 0.5)
            ], cyanDim.opacity(0.5), 1.8, rot: -0.08, bloom: 3)
            notch(R * 0.77, 20, 0.55, steel.opacity(0.32), 3.5, rot: 0.03)
            ring(R * 0.765, steel.opacity(0.30), 0.6)
            ring(R * 0.76, steel.opacity(0.25), 0.8)

            // ══════════════════════════════════════════════════════════════
            //  INTERMEDIATE BEZEL 2 (0.755R → 0.775R) — P-core boundary
            // ══════════════════════════════════════════════════════════════
            ring(R * 0.765, Color(red: 0.08, green: 0.10, blue: 0.14).opacity(0.65), R * 0.035)
            ring(R * 0.765, steel.opacity(0.28), R * 0.035)  // steel tint
            ring(R * 0.765, steel.opacity(0.10), R * 0.05)   // wider subtle
            ring(R * 0.78, steel.opacity(0.55), 1.5)         // outer edge
            ring(R * 0.75, steel.opacity(0.58), 1.5)         // inner edge
            ring(R * 0.765, steel.opacity(0.35), 1.0)        // mid accent
            bezelPanels(R * 0.752, R * 0.778, 20, 0.50, 0.45)
            spokes(R * 0.75, R * 0.78, 30, steel.opacity(0.25), 0.5, rot: -0.01)

            // ══════════════════════════════════════════════════════════════
            //  P-CORE ZONE (0.70R → 0.76R)
            // ══════════════════════════════════════════════════════════════

            // ── 10. P-CORE DATA RING (thin precision arcs) ───────────────
            coreArcs(store.pCoreUsages, R * 0.745, 3, amber)
            ring(R * 0.73, steel.opacity(0.28), 0.5)

            // ── 11. TICK RING 4 (60 ticks, CCW) ─────────────────────────
            ticks(R * 0.715, 60, 5, steel.opacity(0.38), 0.5, rot: -0.18, majorEvery: 5)
            chevrons(R * 0.70, cyan.opacity(0.35), 7, 4, rot: 0.05)
            ring(R * 0.695, steel.opacity(0.22), 0.5)

            // ── 12. ROTATING ARCS (mid) ─────────────────────────────────
            glowArcs(R * 0.685, [
                (0.8, 0.6), (1.8, 1.1), (3.5, 0.9), (5.0, 0.5), (5.7, 0.4)
            ], cyanDim, 2, rot: 0.06, bloom: 3)
            notch(R * 0.675, 14, 0.65, steel.opacity(0.25), 3.5, rot: -0.04)
            ring(R * 0.665, steel.opacity(0.25), 0.8)

            // ══════════════════════════════════════════════════════════════
            //  S-CORE ZONE (0.60R → 0.66R)
            // ══════════════════════════════════════════════════════════════

            // ── 13. S-CORE DATA RING (thin precision arcs) ───────────────
            coreArcs(store.sCoreUsages, R * 0.645, 2.5, crimson)
            ring(R * 0.63, steel.opacity(0.28), 0.5)

            // ── 14. TICK RING 5 (48 ticks, CW fast) ─────────────────────
            ticks(R * 0.615, 48, 5, steel.opacity(0.35), 0.5, rot: 0.25, majorEvery: 4)
            ring(R * 0.605, steel.opacity(0.18), 0.5, dash: [1, 3])

            // ── 14b. ADDITIONAL MID-ZONE DENSITY ─────────────────────────
            ring(R * 0.60, steel.opacity(0.28), 0.5)
            ticks(R * 0.595, 40, 4, steel.opacity(0.30), 0.4, rot: -0.08)
            ring(R * 0.59, steel.opacity(0.22), 0.5, dash: [1, 3])
            notch(R * 0.585, 12, 0.55, steel.opacity(0.20), 2.0, rot: 0.05)
            ring(R * 0.58, steel.opacity(0.20), 0.4)

            // ── 15. ORBITING DOTS (inner) ───────────────────────────────
            dots(R * 0.595, 10, cyan.opacity(0.30), 2.5, rot: -0.20)

            // ══════════════════════════════════════════════════════════════
            //  INNER DETAIL ZONE (0.40R → 0.58R)
            // ══════════════════════════════════════════════════════════════

            // ── 16. ROTATING ARCS (inner) ───────────────────────────────
            glowArcs(R * 0.58, [
                (0.3, 1.6), (2.5, 1.0), (4.2, 1.3), (5.9, 0.3)
            ], cyanDim, 2, rot: -0.12, bloom: 3)
            ring(R * 0.57, cyan.opacity(0.18), 0.6)

            // ── 17. TICK RING 6 (36 ticks, CCW fast) ────────────────────
            ticks(R * 0.555, 36, 6, steel.opacity(0.35), 0.6, rot: -0.35, majorEvery: 3)
            notch(R * 0.54, 9, 0.72, steel.opacity(0.25), 3.5, rot: 0.08)
            ring(R * 0.53, steel.opacity(0.20), 0.5, dash: [2, 4])

            // ── 18. ULTRA-DENSE INNER DETAIL (packed tight like refs) ────
            ticks(R * 0.525, 120, 3.5, steel.opacity(0.28), 0.3, rot: 0.18)
            ring(R * 0.52, steel.opacity(0.16), 0.4)
            ring(R * 0.515, cyan.opacity(0.12), 0.4)
            ticks(R * 0.51, 60, 2.5, steel.opacity(0.20), 0.3, rot: -0.12)
            ring(R * 0.505, steel.opacity(0.14), 0.4, dash: [1, 2])
            notch(R * 0.50, 24, 0.50, steel.opacity(0.18), 2.0, rot: -0.06)
            ring(R * 0.495, cyan.opacity(0.10), 0.4)
            ring(R * 0.49, steel.opacity(0.12), 0.3)
            ticks(R * 0.485, 80, 2.5, steel.opacity(0.18), 0.3, rot: 0.22)
            ring(R * 0.48, steel.opacity(0.14), 0.4)
            arcs(R * 0.475, [(0.0, 0.9), (1.4, 0.7), (2.8, 1.1), (4.5, 0.6), (5.5, 0.5)], cyanDim.opacity(0.08), 1.5, rot: 0.10)
            ring(R * 0.47, cyan.opacity(0.10), 0.4)
            ticks(R * 0.465, 48, 3, steel.opacity(0.16), 0.3, rot: -0.15)
            ring(R * 0.46, steel.opacity(0.12), 0.3, dash: [1, 2])
            notch(R * 0.455, 12, 0.60, steel.opacity(0.15), 2.0, rot: 0.04)

            // ══════════════════════════════════════════════════════════════
            //  INNER REACTOR CORE (0.08R → 0.44R)
            // ══════════════════════════════════════════════════════════════

            // ── 19. INNER REACTOR BOUNDARY ──────────────────────────────
            ticks(R * 0.45, 24, 7, steel.opacity(0.42), 0.7, rot: -0.15)
            ring(R * 0.445, steel.opacity(0.35), 0.8)
            glowRing(R * 0.44, cyan.opacity(0.5), 1.0, bloom: 3)
            ring(R * 0.435, steel.opacity(0.30), 0.6)
            chevrons(R * 0.43, steel.opacity(0.30), 6, 4, rot: 0.08)

            // ── 20. TICK RING 7 (24 ticks, CW fast) ─────────────────────
            ticks(R * 0.41, 24, 5, steel.opacity(0.32), 0.5, rot: 0.45)
            ring(R * 0.40, steel.opacity(0.18), 0.5)
            notch(R * 0.39, 6, 0.78, steel.opacity(0.20), 2.5, rot: -0.10)
            ring(R * 0.385, cyan.opacity(0.15), 0.5, dash: [2, 3])

            // ── 21. DEEP CORE (dense concentric detail) ────────────────
            ring(R * 0.37, steel.opacity(0.28), 0.6)
            ticks(R * 0.365, 16, 4, steel.opacity(0.25), 0.4, rot: 0.15)
            ring(R * 0.36, steel.opacity(0.22), 0.5)
            notch(R * 0.355, 8, 0.65, steel.opacity(0.20), 2.0, rot: 0.06)
            ticks(R * 0.35, 12, 8, steel.opacity(0.30), 0.6, rot: -0.25)
            ring(R * 0.345, steel.opacity(0.18), 0.4)
            glowRing(R * 0.34, cyanDim.opacity(0.35), 0.5, bloom: 2)
            ring(R * 0.335, steel.opacity(0.22), 0.5)
            ticks(R * 0.33, 14, 3, steel.opacity(0.18), 0.3, rot: 0.12)
            ring(R * 0.325, steel.opacity(0.16), 0.4)
            ring(R * 0.32, steel.opacity(0.22), 0.5, dash: [1, 2])
            ticks(R * 0.315, 10, 3, steel.opacity(0.20), 0.4, rot: 0.20)
            ring(R * 0.31, steel.opacity(0.18), 0.4)
            dots(R * 0.30, 8, cyan.opacity(0.18), 2.0, rot: 0.30)
            ring(R * 0.295, steel.opacity(0.18), 0.4)
            ring(R * 0.29, steel.opacity(0.20), 0.5)
            ticks(R * 0.285, 12, 3, steel.opacity(0.16), 0.3, rot: -0.18)
            ring(R * 0.28, steel.opacity(0.18), 0.4)
            notch(R * 0.275, 6, 0.70, steel.opacity(0.16), 1.8, rot: -0.08)
            ticks(R * 0.27, 8, 4, steel.opacity(0.20), 0.4, rot: -0.30)
            ring(R * 0.265, steel.opacity(0.16), 0.4)
            ring(R * 0.26, steel.opacity(0.18), 0.4)
            ring(R * 0.255, steel.opacity(0.14), 0.3, dash: [1, 2])
            ring(R * 0.25, steel.opacity(0.18), 0.5)
            ticks(R * 0.245, 10, 3, steel.opacity(0.14), 0.3, rot: 0.22)
            ring(R * 0.24, steel.opacity(0.15), 0.4, dash: [1, 2])
            ring(R * 0.235, steel.opacity(0.14), 0.3)
            ring(R * 0.23, steel.opacity(0.16), 0.4)
            ring(R * 0.225, steel.opacity(0.12), 0.3, dash: [1, 2])
            ring(R * 0.22, steel.opacity(0.15), 0.4, dash: [1, 2])
            ticks(R * 0.215, 8, 3, steel.opacity(0.14), 0.3, rot: -0.25)
            ring(R * 0.21, steel.opacity(0.14), 0.4)
            ticks(R * 0.205, 6, 4, steel.opacity(0.16), 0.4, rot: 0.18)
            ticks(R * 0.20, 8, 5, steel.opacity(0.18), 0.4, rot: -0.40)
            ring(R * 0.195, steel.opacity(0.14), 0.3)
            ring(R * 0.19, steel.opacity(0.14), 0.4)
            ring(R * 0.185, steel.opacity(0.12), 0.3, dash: [1, 2])
            ring(R * 0.18, steel.opacity(0.12), 0.3)

            // ── 21b. LONG STRUCTURAL SPOKES (full-radius radial lines) ──
            spokes(R * 0.18, R * 0.44, 12, steel.opacity(0.18), 0.5, rot: -0.02)
            spokes(R * 0.45, R * 0.60, 18, steel.opacity(0.16), 0.5, rot: 0.03)
            spokes(R * 0.60, R * 0.75, 24, steel.opacity(0.14), 0.4, rot: -0.01)
            spokes(R * 0.80, R * 0.96, 36, steel.opacity(0.10), 0.4, rot: 0.02)
            // Extra structural spokes at zone boundaries
            spokes(R * 0.18, R * 0.96, 8, steel.opacity(0.06), 0.3)

            // ── 22. CORE GLOW (tight pinpoint — not diffuse) ────────────
            let corePulse = 0.85 + sin(ph * 2.5) * 0.15
            // Small concentrated bloom (5 layers, tight radius)
            for layer in 0..<5 {
                let lr = R * 0.02 + Double(layer) * 3
                let lo = 0.06 * corePulse * (1.0 - Double(layer) / 5.0)
                let cp = Path(ellipseIn: CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2))
                ctx.fill(cp, with: .color(cyan.opacity(lo)))
            }
            // Tiny white-hot center dot
            let hotR = R * 0.015 * corePulse
            let hotP = Path(ellipseIn: CGRect(x: c.x - hotR, y: c.y - hotR, width: hotR * 2, height: hotR * 2))
            ctx.fill(hotP, with: .color(Color.white.opacity(0.15 * corePulse)))

            // ══════════════════════════════════════════════════════════════
            //  ANIMATED SWEEP LINE (radar-style)
            // ══════════════════════════════════════════════════════════════

            let sweepPeriod = 10.0
            let sA = ph.truncatingRemainder(dividingBy: sweepPeriod) / sweepPeriod * pi2
            // Main sweep line
            let sP = Path { p in
                p.move(to: CGPoint(x: c.x + cos(sA) * R * 0.15, y: c.y + sin(sA) * R * 0.15))
                p.addLine(to: CGPoint(x: c.x + cos(sA) * R * 1.00, y: c.y + sin(sA) * R * 1.00))
            }
            ctx.stroke(sP, with: .color(cyan.opacity(0.14)), style: StrokeStyle(lineWidth: 1.2))
            // Trailing glow (8 trailing lines)
            for t in 1...8 {
                let tA = sA - Double(t) * 0.015
                let tP = Path { p in
                    p.move(to: CGPoint(x: c.x + cos(tA) * R * 0.15, y: c.y + sin(tA) * R * 0.15))
                    p.addLine(to: CGPoint(x: c.x + cos(tA) * R * 1.00, y: c.y + sin(tA) * R * 1.00))
                }
                ctx.stroke(tP, with: .color(cyan.opacity(0.06 / Double(t))), style: StrokeStyle(lineWidth: 1.0))
            }

            // ── COUNTER-ROTATING SWEEP (slower, opposite direction) ─────
            let sA2 = ph.truncatingRemainder(dividingBy: 16.0) / 16.0 * pi2
            let sP2 = Path { p in
                p.move(to: CGPoint(x: c.x + cos(-sA2) * R * 0.30, y: c.y + sin(-sA2) * R * 0.30))
                p.addLine(to: CGPoint(x: c.x + cos(-sA2) * R * 0.80, y: c.y + sin(-sA2) * R * 0.80))
            }
            ctx.stroke(sP2, with: .color(cyanDim.opacity(0.08)), style: StrokeStyle(lineWidth: 0.8))

            // ── SWEEP GRADIENT WEDGE (pie-slice fade behind the sweep) ──
            let wedgeAngle = 0.35  // ~20 degrees trailing
            let wedgeSteps = 20
            for s in 0..<wedgeSteps {
                let frac = Double(s) / Double(wedgeSteps)
                let aStart = sA - wedgeAngle * frac
                let aEnd = sA - wedgeAngle * (frac + 1.0 / Double(wedgeSteps))
                let opacity = 0.05 * (1.0 - frac)
                let wp = Path { p in
                    p.move(to: c)
                    p.addArc(center: c, radius: R * 0.98, startAngle: .radians(aStart), endAngle: .radians(aEnd), clockwise: true)
                    p.closeSubpath()
                }
                ctx.fill(wp, with: .color(cyan.opacity(opacity)))
            }

            // ── CENTER TARGETING RETICLE ─────────────────────────────────
            let reticlePulse = 0.85 + sin(ph * 1.5) * 0.15
            // Concentric targeting circles
            for (rr, op) in [(R * 0.12, 0.12), (R * 0.08, 0.18), (R * 0.05, 0.08)] {
                let rp = Path { p in p.addArc(center: c, radius: rr, startAngle: .zero, endAngle: .radians(pi2), clockwise: false) }
                ctx.stroke(rp, with: .color(cyan.opacity(op * reticlePulse)), style: StrokeStyle(lineWidth: 0.5, dash: [3, 3]))
            }
            // Cross lines through center
            for angle in [0.0, Double.pi / 2] {
                let dx = cos(angle)
                let dy = sin(angle)
                let cp = Path { p in
                    p.move(to: CGPoint(x: c.x + dx * R * 0.03, y: c.y + dy * R * 0.03))
                    p.addLine(to: CGPoint(x: c.x + dx * R * 0.10, y: c.y + dy * R * 0.10))
                    p.move(to: CGPoint(x: c.x - dx * R * 0.03, y: c.y - dy * R * 0.03))
                    p.addLine(to: CGPoint(x: c.x - dx * R * 0.10, y: c.y - dy * R * 0.10))
                }
                ctx.stroke(cp, with: .color(cyan.opacity(0.15 * reticlePulse)), style: StrokeStyle(lineWidth: 0.5))
            }

            // ── RADIAL DATA TEXT (scattered around outer edge) ───────────
            // Render degree markers at cardinal & ordinal points
            let degreeMarkers: [(Double, String)] = [
                (0, "000"), (Double.pi/4, "045"), (Double.pi/2, "090"),
                (Double.pi*3/4, "135"), (Double.pi, "180"),
                (Double.pi*5/4, "225"), (Double.pi*3/2, "270"),
                (Double.pi*7/4, "315")
            ]
            for (angle, label) in degreeMarkers {
                let textR = R * 1.10
                let tx = c.x + cos(angle - Double.pi/2) * textR
                let ty = c.y + sin(angle - Double.pi/2) * textR
                ctx.draw(
                    Text(label)
                        .font(.custom("Menlo", size: 7))
                        .foregroundColor(steel.opacity(0.35)),
                    at: CGPoint(x: tx, y: ty)
                )
            }

        } // end Canvas
        // Ring labels overlay
        .overlay(
            ZStack {
                // E-CORES label
                Text("E-CORES")
                    .font(.custom("Menlo", size: 9)).tracking(3)
                    .foregroundColor(cyan.opacity(0.55))
                    .shadow(color: cyan.opacity(0.3), radius: 4)
                    .position(x: center.x, y: center.y - R * 0.845 - 18)
                // P-CORES label
                Text("P-CORES")
                    .font(.custom("Menlo", size: 8)).tracking(2)
                    .foregroundColor(amber.opacity(0.45))
                    .position(x: center.x, y: center.y - R * 0.745 - 15)
                // S-CORES label
                Text("S-CORES")
                    .font(.custom("Menlo", size: 8)).tracking(2)
                    .foregroundColor(crimson.opacity(0.45))
                    .position(x: center.x, y: center.y - R * 0.645 - 15)
                // GPU label
                Text("GPU")
                    .font(.custom("Menlo", size: 8)).tracking(2)
                    .foregroundColor(cyan.opacity(0.40))
                    .position(x: center.x, y: center.y - R * 0.915 - 14)
            }
        )
    }
}

// MARK: - MiniArcGauge ────────────────────────────────────────────────────────

struct MiniArcGauge: View {
    let value: Double
    let label: String
    let color: Color
    let phase: Double

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                // Background track
                Circle()
                    .stroke(color.opacity(0.08), lineWidth: 4)
                    .frame(width: 56, height: 56)

                // Value arc
                Circle()
                    .trim(from: 0, to: min(value, 1.0))
                    .stroke(
                        AngularGradient(
                            gradient: Gradient(colors: [color.opacity(0.3), color]),
                            center: .center
                        ),
                        style: StrokeStyle(lineWidth: 4, lineCap: .round)
                    )
                    .frame(width: 56, height: 56)
                    .rotationEffect(.degrees(-90))

                // Glow
                Circle()
                    .trim(from: 0, to: min(value, 1.0))
                    .stroke(color.opacity(0.15), style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .frame(width: 56, height: 56)
                    .rotationEffect(.degrees(-90))
                    .blur(radius: 3)

                // Percentage text
                Text(String(format: "%.0f", min(value, 1.0) * 100))
                    .font(.custom("Menlo", size: 14)).fontWeight(.bold)
                    .foregroundColor(color)
                    .shadow(color: color.opacity(0.6), radius: 4)

                // Tick marks
                ForEach(0..<12, id: \.self) { i in
                    Rectangle()
                        .fill(color.opacity(i % 3 == 0 ? 0.4 : 0.15))
                        .frame(width: 0.5, height: i % 3 == 0 ? 5 : 3)
                        .offset(y: -32)
                        .rotationEffect(.degrees(Double(i) * 30))
                }
            }

            Text(label)
                .font(.custom("Menlo", size: 7)).tracking(3)
                .foregroundColor(color.opacity(0.45))
        }
    }
}

// MARK: - MiniArcReactor ──────────────────────────────────────────────────────

struct MiniArcReactor: View {
    let phase: Double
    let cyan: Color
    let cyanBright: Color

    var body: some View {
        let pulse = 0.85 + sin(phase * 2.5) * 0.15

        ZStack {
            // Outer ring
            Circle()
                .stroke(cyan.opacity(0.20), lineWidth: 2)
                .frame(width: 60, height: 60)

            // Middle ring
            Circle()
                .stroke(cyan.opacity(0.30 * pulse), lineWidth: 1.5)
                .frame(width: 48, height: 48)

            // Inner ring
            Circle()
                .stroke(cyanBright.opacity(0.45 * pulse), lineWidth: 1)
                .frame(width: 34, height: 34)

            // Core glow
            Circle()
                .fill(
                    RadialGradient(
                        gradient: Gradient(colors: [
                            Color.white.opacity(0.25 * pulse),
                            cyan.opacity(0.30 * pulse),
                            cyan.opacity(0.05),
                            Color.clear
                        ]),
                        center: .center,
                        startRadius: 2,
                        endRadius: 26
                    )
                )
                .frame(width: 52, height: 52)

            // 3 rotating segment arcs
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .trim(from: 0.0, to: 0.2)
                    .stroke(cyan.opacity(0.50), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    .frame(width: 42, height: 42)
                    .rotationEffect(.degrees(Double(i) * 120 + phase * 30))
            }

            // Center dot
            Circle()
                .fill(Color.white.opacity(0.30 * pulse))
                .frame(width: 6, height: 6)
        }
        .frame(width: 64, height: 64)
    }
}

// MARK: - VerticalBarGauge ────────────────────────────────────────────────────

struct VerticalBarGauge: View {
    let values: [Double]
    let label: String
    let color: Color
    let phase: Double

    var body: some View {
        VStack(spacing: 4) {
            Text(label)
                .font(.custom("Menlo", size: 7)).tracking(3)
                .foregroundColor(color.opacity(0.4))

            HStack(spacing: 2) {
                ForEach(0..<min(values.count, 12), id: \.self) { i in
                    let v = min(values[i], 1.0)
                    VStack(spacing: 0) {
                        Spacer()
                        RoundedRectangle(cornerRadius: 1)
                            .fill(color.opacity(0.15))
                            .frame(width: 4, height: 40)
                            .overlay(
                                VStack {
                                    Spacer()
                                    RoundedRectangle(cornerRadius: 1)
                                        .fill(color)
                                        .frame(height: CGFloat(v) * 40)
                                        .shadow(color: color.opacity(0.6), radius: 3)
                                }
                            )
                    }
                    .frame(height: 40)
                }
            }
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 3)
                .fill(Color.black.opacity(0.45))
                .overlay(RoundedRectangle(cornerRadius: 3).stroke(color.opacity(0.15), lineWidth: 0.5))
        )
    }
}

// MARK: - HoloPanelView ──────────────────────────────────────────────────────

enum HoloPanelStyle { case left, right }

struct HoloPanelView: View {
    let name: String
    let value: String
    let sub: String
    let color: Color
    var style: HoloPanelStyle = .left

    var body: some View {
        VStack(alignment: style == .left ? .leading : .trailing, spacing: 4) {
            // Header with chamfered accent line
            HStack(spacing: 6) {
                if style == .left {
                    Rectangle().fill(color.opacity(0.5)).frame(width: 3, height: 10)
                }
                Text(name)
                    .font(.custom("Menlo", size: 8)).tracking(3)
                    .foregroundColor(color.opacity(0.55))
                if style == .right {
                    Rectangle().fill(color.opacity(0.5)).frame(width: 3, height: 10)
                }
            }

            Text(value)
                .font(.custom("Menlo", size: 20)).fontWeight(.bold)
                .foregroundColor(color)
                .shadow(color: color.opacity(0.9), radius: 3)
                .shadow(color: color.opacity(0.4), radius: 10)
                .shadow(color: color.opacity(0.15), radius: 25)

            Text(sub)
                .font(.custom("Menlo", size: 6)).tracking(2)
                .foregroundColor(color.opacity(0.30))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            ZStack {
                // Glass fill
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.black.opacity(0.55))
                // Chamfered border with corner accents
                RoundedRectangle(cornerRadius: 3)
                    .stroke(color.opacity(0.25), lineWidth: 0.5)
                // Top edge highlight
                VStack {
                    Rectangle().fill(color.opacity(0.15)).frame(height: 0.5)
                    Spacer()
                }
                .clipShape(RoundedRectangle(cornerRadius: 3))
            }
        )
        .shadow(color: color.opacity(0.10), radius: 10)
    }
}

// MARK: - CentralStatsView ───────────────────────────────────────────────────

struct CentralStatsView: View {
    @EnvironmentObject var store: TelemetryStore
    private let cyan = Color(red: 0.00, green: 0.83, blue: 1.00)
    private let cyanBright = Color(red: 0.41, green: 0.95, blue: 0.95)

    var body: some View {
        VStack(spacing: 6) {
            Text(store.chipName)
                .font(.custom("Menlo", size: 9)).tracking(4)
                .foregroundColor(cyan.opacity(0.40))

            Text(String(format: "%.0f", store.totalPower))
                .font(.custom("Menlo", size: 48)).fontWeight(.bold)
                .foregroundColor(cyanBright)
                .shadow(color: cyan.opacity(0.95), radius: 3)
                .shadow(color: cyan.opacity(0.50), radius: 12)
                .shadow(color: cyan.opacity(0.25), radius: 30)
                .shadow(color: cyan.opacity(0.10), radius: 60)

            Text("WATTS")
                .font(.custom("Menlo", size: 7)).tracking(5)
                .foregroundColor(cyan.opacity(0.55))

            // Divider with glow
            Rectangle()
                .fill(cyan.opacity(0.40))
                .frame(width: 80, height: 0.5)
                .shadow(color: cyan.opacity(0.3), radius: 6)

            Text(store.thermalState.uppercased())
                .font(.custom("Menlo", size: 9)).tracking(3)
                .foregroundColor(thermalColor)
                .shadow(color: thermalColor.opacity(0.7), radius: 5)
        }
    }

    private var thermalColor: Color {
        switch store.thermalState.lowercased() {
        case "nominal", "normal": return cyan
        case "fair": return Color(red: 1.0, green: 0.8, blue: 0.0)
        case "serious": return Color(red: 1.0, green: 0.3, blue: 0.0)
        case "critical": return Color(red: 1.0, green: 0.0, blue: 0.0)
        default: return .white
        }
    }
}

// MARK: - PowerThermalPanel ──────────────────────────────────────────────────

struct PowerThermalPanel: View {
    @EnvironmentObject var store: TelemetryStore
    private let cyan = Color(red: 0.00, green: 0.83, blue: 1.00)
    private let amber = Color(red: 1.0, green: 0.78, blue: 0.0)

    var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            HStack(spacing: 6) {
                Text("THERMAL")
                    .font(.custom("Menlo", size: 7)).tracking(3)
                    .foregroundColor(cyan.opacity(0.35))
                Rectangle().fill(cyan.opacity(0.25)).frame(width: 3, height: 8)
            }
            row("CPU", String(format: "%.1f\u{00B0}C", store.cpuTemp), amber)
            row("GPU", String(format: "%.1f\u{00B0}C", store.gpuTemp), amber)
            row("ANE", String(format: "%.2fW", store.anePower), cyan)
            row("SWAP", String(format: "%.0f%%", store.swapPressure * 100), store.swapPressure > 0.8 ? .red : cyan)
        }
        .padding(10)
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: 3).fill(Color.black.opacity(0.55))
                RoundedRectangle(cornerRadius: 3).stroke(cyan.opacity(0.25), lineWidth: 0.5)
                VStack {
                    Rectangle().fill(cyan.opacity(0.12)).frame(height: 0.5)
                    Spacer()
                }
                .clipShape(RoundedRectangle(cornerRadius: 3))
            }
        )
        .shadow(color: cyan.opacity(0.10), radius: 8)
    }

    private func row(_ l: String, _ v: String, _ c: Color) -> some View {
        HStack(spacing: 8) {
            Text(l)
                .font(.custom("Menlo", size: 8)).tracking(2)
                .foregroundColor(c.opacity(0.45))
                .frame(width: 32, alignment: .trailing)
            Text(v)
                .font(.custom("Menlo", size: 16)).fontWeight(.bold)
                .foregroundColor(c)
                .shadow(color: c.opacity(0.7), radius: 3)
                .shadow(color: c.opacity(0.3), radius: 10)
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

    var body: some View {
        VStack(spacing: 6) {
            // CPU usage bar
            HStack(spacing: 8) {
                Text("CPU")
                    .font(.custom("Menlo", size: 7)).tracking(2)
                    .foregroundColor(cyan.opacity(0.40))
                    .frame(width: 28, alignment: .trailing)

                ZStack(alignment: .leading) {
                    // Track
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(cyan.opacity(0.06))
                        .frame(width: width * 0.7, height: 6)

                    // Fill
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(
                            LinearGradient(
                                colors: [cyan.opacity(0.4), cyan],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: width * 0.7 * min(averageCPU, 1.0), height: 6)
                        .shadow(color: cyan.opacity(0.5), radius: 4)

                    // Glow
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(cyan.opacity(0.08))
                        .frame(width: width * 0.7 * min(averageCPU, 1.0), height: 14)
                        .blur(radius: 4)
                }

                Text(String(format: "%.0f%%", averageCPU * 100))
                    .font(.custom("Menlo", size: 8)).fontWeight(.bold)
                    .foregroundColor(cyan.opacity(0.6))
                    .frame(width: 32)
            }

            // Memory pressure bar
            HStack(spacing: 8) {
                Text("MEM")
                    .font(.custom("Menlo", size: 7)).tracking(2)
                    .foregroundColor(amber.opacity(0.40))
                    .frame(width: 28, alignment: .trailing)

                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(amber.opacity(0.06))
                        .frame(width: width * 0.7, height: 6)

                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(
                            LinearGradient(
                                colors: [amber.opacity(0.4), amber],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: width * 0.7 * min(store.swapPressure, 1.0), height: 6)
                        .shadow(color: amber.opacity(0.5), radius: 4)
                }

                Text(String(format: "%.0f%%", store.swapPressure * 100))
                    .font(.custom("Menlo", size: 8)).fontWeight(.bold)
                    .foregroundColor(amber.opacity(0.6))
                    .frame(width: 32)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 3)
                .fill(Color.black.opacity(0.40))
                .overlay(RoundedRectangle(cornerRadius: 3).stroke(cyan.opacity(0.12), lineWidth: 0.5))
        )
    }

    private var averageCPU: Double {
        let all = store.eCoreUsages + store.pCoreUsages + store.sCoreUsages
        guard !all.isEmpty else { return 0 }
        return all.reduce(0, +) / Double(all.count)
    }
}

// MARK: - DRAMBandwidthPanel ─────────────────────────────────────────────────

struct DRAMBandwidthPanel: View {
    @EnvironmentObject var store: TelemetryStore
    private let cyan = Color(red: 0.00, green: 0.83, blue: 1.00)

    var body: some View {
        VStack(alignment: .trailing, spacing: 5) {
            HStack(spacing: 6) {
                Text("DRAM BW")
                    .font(.custom("Menlo", size: 7)).tracking(3)
                    .foregroundColor(cyan.opacity(0.35))
                Rectangle().fill(cyan.opacity(0.25)).frame(width: 3, height: 8)
            }
            Text(String(format: "%.1f", store.dramReadBW))
                .font(.custom("Menlo", size: 22)).fontWeight(.bold)
                .foregroundColor(cyan)
                .shadow(color: cyan.opacity(0.8), radius: 3)
                .shadow(color: cyan.opacity(0.3), radius: 12)
            Text("GB/s READ")
                .font(.custom("Menlo", size: 7)).tracking(3)
                .foregroundColor(cyan.opacity(0.35))
        }
        .padding(10)
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: 3).fill(Color.black.opacity(0.55))
                RoundedRectangle(cornerRadius: 3).stroke(cyan.opacity(0.25), lineWidth: 0.5)
                VStack {
                    Rectangle().fill(cyan.opacity(0.12)).frame(height: 0.5)
                    Spacer()
                }
                .clipShape(RoundedRectangle(cornerRadius: 3))
            }
        )
        .shadow(color: cyan.opacity(0.10), radius: 8)
    }
}
