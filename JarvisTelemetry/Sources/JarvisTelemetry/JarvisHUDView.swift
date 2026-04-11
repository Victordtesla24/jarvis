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
            // Reactor radius shrunk to 0.34 × min(w,h) so the left/right
            // panels (widened to 320pt in JarvisLeftPanel / JarvisRightPanel)
            // have real breathing room on wide displays, matching the
            // reference Kartik's-system layout with prominent panels and
            // full telemetric data visible at the captured resolution.
            let R  = min(w, h) * 0.34

            ZStack {
                // ── 1. BACKGROUND: dark blue-black (shifts crimson under thermal threat) ──
                let thermalThreat = store.thermalState.lowercased().contains("serious") || store.thermalState.lowercased().contains("critical")
                let bgColor = thermalThreat ? Color(red: 0.04, green: 0.02, blue: 0.03) : Color.black
                bgColor.ignoresSafeArea()

                // Hex grid: 52pt, #00D4FF @0.07, 0.2°/s rotation
                HexGridCanvas(width: w, height: h, phase: phase, color: cyan)

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

                // ── 1b. RING COUNTER-ROTATION (CABasicAnimation, CA layer) ──
                // 5 concentric rings at 45/32/22/18/12s CW↔CCW — behind reactor
                RingRotationView()
                    .ignoresSafeArea()
                    .allowsHitTesting(false)

                // ── 2. SCAN LINE OVERLAY (CRT horizontal lines) ──────────
                ScanLineOverlay(height: h, phase: phase, color: cyan)

                // ── 2b. SCAN-LINE SWEEP — Metal fragment shader ──────────
                // White→transparent gradient band, 4 pt, opacity 0.18,
                // sweeps y=0→screenHeight over 3.5s, CADisplayLink-driven.
                ScanLineMetalView()
                    .ignoresSafeArea()
                    .allowsHitTesting(false)

                // ── 2c. AMBIENT PARTICLES ───────────────────────────────
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

                // ── 3b. REACTOR PARTICLE EMITTER (CAEmitterLayer) ───────
                // birthRate=12, lifetime=2.8s, velocity=140, emissionRange=2π
                // color=#00D4FF, scale=0.04 — centred on reactor core
                ReactorParticleEmitter()
                    .ignoresSafeArea()
                    .allowsHitTesting(false)

                // ── 3c. CORE PULSE RING (CASpringAnimation) ──────────────
                // scale 1.0→1.6→1.0, damping=0.6, duration=2.2s, repeat ∞
                CorePulseRingView()
                    .ignoresSafeArea()
                    .allowsHitTesting(false)

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

                // ── 8. LEFT PANEL (JarvisLeftPanel) ────────────────────
                JarvisLeftPanel()
                    .environmentObject(store)

                // ── 9. RIGHT PANEL (JarvisRightPanel) ───────────────────
                JarvisRightPanel()
                    .environmentObject(store)

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

                // ── 14. R-02 REACTIVE EVENT OVERLAY (topmost layer) ─────
                //  Telemetry-driven transient text events: CPU spike,
                //  GPU surge, memory pressure, thermal warn, disk I/O, etc.
                //  Enabled by ReactorAnimationController.activeOverlays.
                ReactiveOverlayView()
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
            // ── Spec: 52pt spacing, #00D4FF stroke at opacity 0.07, 0.2°/s rotation
            let spacing: CGFloat = 52
            let hexR: CGFloat    = 26   // inner radius = spacing / 2
            let cols = Int(width / (spacing * 0.866)) + 3
            let rows = Int(height / spacing) + 3

            // 0.2°/s slow rotation driven by phase (seconds since reference date)
            let rotAngle = phase * (0.2 * Double.pi / 180.0)
            let cosR = CGFloat(cos(rotAngle))
            let sinR = CGFloat(sin(rotAngle))
            let scrCX = width  / 2
            let scrCY = height / 2

            for row in 0..<rows {
                for col in 0..<cols {
                    // Hex grid base position (offset even/odd rows)
                    let offsetX: CGFloat = (row % 2 == 0) ? 0 : spacing * 0.433
                    let bx = CGFloat(col) * spacing * 0.866 + offsetX - spacing
                    let by = CGFloat(row) * spacing * 0.75  - spacing

                    // Rotate grid point around screen centre
                    let dx = bx - scrCX
                    let dy = by - scrCY
                    let cx = dx * cosR - dy * sinR + scrCX
                    let cy = dx * sinR + dy * cosR + scrCY

                    // Radial opacity falloff (brighter at centre, fades at edges)
                    let fdx = cx - scrCX
                    let fdy = cy - scrCY
                    let dist    = sqrt(fdx * fdx + fdy * fdy)
                    let maxDist = sqrt(width * width + height * height) / 2
                    let falloff = max(0, 1.0 - dist / (maxDist * 0.85))
                    // Max opacity 0.07 per spec; center slightly brighter
                    let opacity = 0.07 * falloff

                    guard opacity > 0.004 else { continue }

                    // Draw hexagon — vertices also rotated (add rotAngle to each)
                    var hex = Path()
                    for i in 0..<6 {
                        let a  = Double.pi / 3.0 * Double(i) - Double.pi / 6.0 + rotAngle
                        let px = cx + hexR * CGFloat(cos(a))
                        let py = cy + hexR * CGFloat(sin(a))
                        if i == 0 { hex.move(to: CGPoint(x: px, y: py)) }
                        else       { hex.addLine(to: CGPoint(x: px, y: py)) }
                    }
                    hex.closeSubpath()
                    // color is passed as cyan (#00D4FF) from call site
                    ctx.stroke(hex, with: .color(color.opacity(opacity)),
                               style: StrokeStyle(lineWidth: 0.6))
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
    // R-02: injected automatically via SwiftUI environment — ReactorAnimationController
    // is published by JarvisRootView and propagates through every descendant view.
    @EnvironmentObject var reactorController: ReactorAnimationController
    let store: TelemetryStore
    let phase: Double
    let center: CGPoint
    let R: Double
    let cyan: Color, cyanBright: Color, cyanDim: Color
    let amber: Color, crimson: Color, steel: Color

    // Static formatters for arc text (cheap: allocated once)
    private static let hudTimeFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "h:mm a"; return f
    }()
    private static let hudDateFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "dd MMM"; return f
    }()

    // ── Personality state for mode control bar (GAP-13) ────────────
    private var personalityState: String {
        let thermal = store.thermalState.lowercased()
        if thermal.contains("critical") { return "CRITICAL" }
        if thermal.contains("serious") { return "STRAINED" }
        let allCores = store.eCoreUsages + store.pCoreUsages + store.sCoreUsages
        let cpuAvg = allCores.isEmpty ? 0 : allCores.reduce(0, +) / Double(allCores.count)
        if cpuAvg < 0.05 && store.gpuUsage < 0.05 { return "STANDBY" }
        return "NOMINAL"
    }

    var body: some View {
        Canvas(opaque: false, colorMode: .linear, rendersAsynchronously: true) { ctx, size in
            let c = center
            let pi2 = Double.pi * 2.0
            let top = -Double.pi / 2.0
            let allCores = store.eCoreUsages + store.pCoreUsages + store.sCoreUsages
            let cpuAvg = allCores.isEmpty ? 0 : allCores.reduce(0, +) / Double(allCores.count)
            let gpuLoad = store.gpuUsage
            let aggregateLoad = cpuAvg * 0.6 + gpuLoad * 0.3 + store.swapPressure * 0.1

            // Dynamic speed — rings accelerate with system load.
            // R-02: multiply in the reactive controller's ringSpeedMultiplier so
            // CPU spikes (>1), idle slowdown (<1), and thermal throttling can
            // all adjust the ring rotation rate in real time alongside the
            // aggregate-load ramp.
            let speedMul = (1.0 + aggregateLoad * 0.8) * reactorController.ringSpeedMultiplier
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
            // R-02: let the reactive controller shift ring hue via RGB lerp.
            // hueShift = 0 keeps the existing cyan (or thermal-threat amber
            // path), hueShift = 1 pushes toward pure amber regardless.
            let baseJarvisCyan = thermalThreat
                ? Color(red: 1.00, green: 0.50, blue: 0.15)   // shifts to amber-orange
                : Color(red: 0.00, green: 0.83, blue: 1.00)   // #00D4FF — primary
            let hueShift = reactorController.ringHueShift
            let jarvisCyan: Color = hueShift < 0.01
                ? baseJarvisCyan
                : Color(
                    red:   0.00 * (1 - hueShift) + 1.00 * hueShift,
                    green: 0.83 * (1 - hueShift) + 0.78 * hueShift,
                    blue:  1.00 * (1 - hueShift) + 0.00 * hueShift
                )
            let jarvisDim = Color(red: 0.25, green: 0.40, blue: 0.50)

            // ═══════════════════════════════════════════════════════════
            //  HELPERS — cinema bloom style
            // ═══════════════════════════════════════════════════════════

            func ring(_ r: Double, _ col: Color, _ w: Double, dash: [CGFloat]? = nil) {
                let p = Path { p in p.addArc(center: c, radius: r, startAngle: .zero, endAngle: .radians(pi2), clockwise: false) }
                let s = dash != nil ? StrokeStyle(lineWidth: w, lineCap: .butt, dash: dash!) : StrokeStyle(lineWidth: w, lineCap: .butt)
                ctx.stroke(p, with: .color(col), style: s)
            }

            // Cinema bloom — TIGHT glow within 6px, scales with system load
            let bs = bloomScale  // capture for closure
            func bloomRing(_ r: Double, _ col: Color, _ w: Double) {
                ring(r, jarvisCyan.opacity(0.03 * bs), w + 6)   // tight cyan haze
                ring(r, col.opacity(0.12 * bs), w + 3)     // near glow
                ring(r, col.opacity(0.40 * bs), w + 1)     // bright edge
                ring(r, col.opacity(min(0.90 * bs, 1.0)), w)  // bright core
                ring(r, Color.white.opacity(min(0.50 * bs, 1.0)), w * 0.35) // white-hot center
            }

            // Bloom arc — TIGHT glow within 4px of centerline
            func bloomArc(_ r: Double, _ startAngle: Double, _ sweep: Double, _ col: Color, _ w: Double) {
                for (extraW, opacity) in [(4.0, 0.06), (2.0, 0.18), (0.5, 0.50), (0.0, 0.85)] {
                    let p = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(startAngle), endAngle: .radians(startAngle + sweep), clockwise: false) }
                    ctx.stroke(p, with: .color(col.opacity(opacity)), style: StrokeStyle(lineWidth: w + extraW, lineCap: .round))
                }
                let wp = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(startAngle), endAngle: .radians(startAngle + sweep), clockwise: false) }
                ctx.stroke(wp, with: .color(Color.white.opacity(0.45)), style: StrokeStyle(lineWidth: w * 0.3, lineCap: .round))
            }

            // Data arc — TIGHT bloom, fills within 6px of centerline
            func dataArc(_ usages: [Double], _ r: Double, _ w: Double, _ col: Color) {
                guard !usages.isEmpty else { return }
                let n = usages.count
                let sw = pi2 / Double(n)
                let gap = sw * 0.10
                for (i, u) in usages.enumerated() {
                    let s0 = top + sw * Double(i) + gap / 2
                    let s1 = s0 + sw - gap
                    // Track — dim
                    let tp = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(s0), endAngle: .radians(s1), clockwise: false) }
                    ctx.stroke(tp, with: .color(col.opacity(0.12)), style: StrokeStyle(lineWidth: w, lineCap: .round))
                    guard u > 0 else { continue }
                    let fe = s0 + (s1 - s0) * u
                    // TIGHT bloom — 3 layers, total spread ~6px
                    let fp = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(s0), endAngle: .radians(fe), clockwise: false) }
                    ctx.stroke(fp, with: .color(col.opacity(0.08)), style: StrokeStyle(lineWidth: w + 6, lineCap: .round))
                    ctx.stroke(fp, with: .color(col.opacity(0.30)), style: StrokeStyle(lineWidth: w + 2, lineCap: .round))
                    ctx.stroke(fp, with: .color(col.opacity(0.85)), style: StrokeStyle(lineWidth: w, lineCap: .round))
                    ctx.stroke(fp, with: .color(Color.white.opacity(0.40)), style: StrokeStyle(lineWidth: w * 0.3, lineCap: .round))
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
            //  INTERIOR FILL (r < 54%) — dark radial gradient + 80 star dots
            //  Drawn first so rings paint on top of it
            // ══════════════════════════════════════════════════════════════
            let interiorR = R * 0.54
            let intFillPath = Path(ellipseIn: CGRect(
                x: c.x - interiorR, y: c.y - interiorR,
                width: interiorR * 2, height: interiorR * 2
            ))
            ctx.fill(intFillPath, with: .radialGradient(
                Gradient(colors: [
                    Color(red: 0.004, green: 0.031, blue: 0.063),  // #010810 center
                    Color(red: 0.000, green: 0.016, blue: 0.031)   // #000408 edge
                ]),
                center: c, startRadius: 0, endRadius: interiorR
            ))
            // 80 fixed-seed star dots — same positions every frame
            var starSeed: UInt64 = 53791
            for _ in 0..<80 {
                starSeed = starSeed &* 6364136223846793005 &+ 1442695040888963407
                let starAngle = Double(starSeed >> 11) / Double(1 << 53) * pi2
                starSeed = starSeed &* 6364136223846793005 &+ 1442695040888963407
                let starDist  = Double(starSeed >> 11) / Double(1 << 53) * 0.92 * interiorR
                let sx = c.x + cos(starAngle) * starDist
                let sy = c.y + sin(starAngle) * starDist
                ctx.fill(Path(ellipseIn: CGRect(x: sx - 0.5, y: sy - 0.5, width: 1, height: 1)),
                         with: .color(Color.white.opacity(0.30)))
            }

            // ══════════════════════════════════════════════════════════════
            //  GAP-03: 5-RING ARCHITECTURE — replacing 220+ ring field
            //  Ring 1: Outermost segmented tiles (0.95R)
            //  Ring 2: Arc-sweep telemetry (0.78R)
            //  Ring 3: Label annotation ring (0.62R)
            //  Ring 4: Secondary telemetry arc (0.48R)
            //  Ring 5: Innermost thin ring + ticks (0.35R)
            // ══════════════════════════════════════════════════════════════

            // ── Crosshair notch helper — N/S/E/W cutouts on every ring ──
            // We skip drawing segments that fall within ±3° of N/S/E/W
            func isInNotch(_ angle: Double) -> Bool {
                let notchHalfWidth = 3.0 * Double.pi / 180.0
                let cardinals = [top, top + Double.pi/2, top + Double.pi, top + Double.pi * 1.5]
                for cardinal in cardinals {
                    var diff = angle - cardinal
                    // Normalize to -π..π
                    while diff > Double.pi { diff -= pi2 }
                    while diff < -Double.pi { diff += pi2 }
                    if abs(diff) < notchHalfWidth { return true }
                }
                return false
            }

            // ══════════════════════════════════════════════════════════════
            //  RING 1: OUTERMOST — 48 segmented dash tiles (28×8pt)
            //  GAP-02: Double-shadow bloom on every cyan segment
            // ══════════════════════════════════════════════════════════════
            let ring1R = R * 0.95
            let segCount1 = 48
            let segArc1 = pi2 / Double(segCount1)
            let gapFrac1 = 0.15  // 15% gap between segments
            for i in 0..<segCount1 {
                let segStart = Double(i) * segArc1 + top
                let segEnd = segStart + segArc1 * (1.0 - gapFrac1)
                let segMid = (segStart + segEnd) / 2.0
                if isInNotch(segMid) { continue }
                let sp = Path { p in p.addArc(center: c, radius: ring1R,
                    startAngle: .radians(segStart), endAngle: .radians(segEnd), clockwise: false) }
                // GAP-02: Double-shadow bloom — radius 24 + radius 12
                ctx.stroke(sp, with: .color(jarvisCyan.opacity(0.06 * bs)),
                           style: StrokeStyle(lineWidth: 28, lineCap: .butt))
                ctx.stroke(sp, with: .color(jarvisCyan.opacity(0.15 * bs)),
                           style: StrokeStyle(lineWidth: 16, lineCap: .butt))
                ctx.stroke(sp, with: .color(jarvisCyan.opacity(0.85)),
                           style: StrokeStyle(lineWidth: 8, lineCap: .butt))
                ctx.stroke(sp, with: .color(Color.white.opacity(0.40)),
                           style: StrokeStyle(lineWidth: 3, lineCap: .butt))
            }

            // Outer perimeter dots + chevrons
            dots(R * 1.02, 120, jarvisDim.opacity(0.50), 1.5)
            chevrons(R * 1.02, jarvisWhite.opacity(0.70), 10, 4)

            // ══════════════════════════════════════════════════════════════
            //  RING 2: ARC-SWEEP TELEMETRY (0.78R)
            //  GPU + E-Core + P-Core data arcs with bloom
            // ══════════════════════════════════════════════════════════════
            let ring2R = R * 0.78
            // Structural bloom ring
            bloomRing(ring2R + R * 0.06, jarvisSilver, 2.0)
            // GPU data arc at 0.84R
            let gpuVal = [min(store.gpuUsage, 1.0)]
            dataArc(gpuVal, R * 0.84, 10.0, jarvisCyan)
            // E-core data arcs at ring2R
            dataArc(store.eCoreUsages, ring2R, 10.0, jarvisCyan)
            // Ticks at outer edge of ring 2
            ticks(R * 0.88, 60, 6, jarvisDim.opacity(0.50), 0.8, rot: 0.01)

            // ══════════════════════════════════════════════════════════════
            //  RING 3: LABEL ANNOTATION RING (0.62R)
            //  GAP-12: 8 command labels at 45° intervals
            // ══════════════════════════════════════════════════════════════
            let ring3R = R * 0.62
            // Structural ring
            bloomRing(ring3R, jarvisDim.opacity(0.30), 1.5)

            // GAP-12: Inner ring command labels
            do {
                let cmdLabels = ["CPU", "GPU", "MEM", "NET", "ANE", "DISK", "PWR", "TEMP"]
                let labelR = ring3R - 16
                for i in 0..<8 {
                    let angle = Double(i) * (pi2 / 8.0) + top
                    // Tick line from ring to label
                    let tickStart = CGPoint(x: c.x + cos(angle) * ring3R, y: c.y + sin(angle) * ring3R)
                    let tickEnd = CGPoint(x: c.x + cos(angle) * (ring3R - 12), y: c.y + sin(angle) * (ring3R - 12))
                    let tickP = Path { p in p.move(to: tickStart); p.addLine(to: tickEnd) }
                    ctx.stroke(tickP, with: .color(jarvisCyan.opacity(0.5)), style: StrokeStyle(lineWidth: 0.5))
                    // Label text
                    let lx = c.x + cos(angle) * labelR
                    let ly = c.y + sin(angle) * labelR
                    ctx.draw(
                        Text(cmdLabels[i])
                            .font(.system(size: 7, design: .monospaced).bold())
                            .foregroundColor(jarvisCyan.opacity(0.9)),
                        at: CGPoint(x: lx, y: ly)
                    )
                }
            }

            // P-core data arcs at 0.65R — amber
            dataArc(store.pCoreUsages, R * 0.65, 10.0, amber)
            chevrons(R * 0.63, jarvisWhite.opacity(0.50), 8, 4, rot: -0.06)

            // ══════════════════════════════════════════════════════════════
            //  RING 4: SECONDARY TELEMETRY ARC (0.48R)
            //  S-core data + segmented arcs
            // ══════════════════════════════════════════════════════════════
            let ring4R = R * 0.48
            bloomRing(ring4R, jarvisWhite, 2.0)
            // S-core data arcs — crimson
            dataArc(store.sCoreUsages, R * 0.50, 8.0, crimson)
            // Segmented structural arcs
            let cogStep = floor(ph * 2.0) / 2.0
            let cogAngle = cogStep * (pi2 / 16.0)
            for i in 0..<8 {
                let segStart = Double(i) * (pi2 / 8.0) + 0.20 + cogAngle
                let segMid = segStart + (pi2 / 8.0) * 0.25
                if isInNotch(segMid) { continue }
                let ap = Path { p in p.addArc(center: c, radius: R * 0.45,
                    startAngle: .radians(segStart),
                    endAngle: .radians(segStart + (pi2/8.0)*0.50), clockwise: false) }
                ctx.stroke(ap, with: .color(jarvisDim.opacity(0.25)),
                           style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
            }

            // ══════════════════════════════════════════════════════════════
            //  RING 5: INNERMOST — solid thin ring + tick marks every 15°
            // ══════════════════════════════════════════════════════════════
            let ring5R = R * 0.35
            bloomRing(ring5R, jarvisCyan.opacity(0.35), 1.5)
            // Tick marks every 15° (24 ticks)
            let tickCount5 = 24
            for i in 0..<tickCount5 {
                let angle = Double(i) / Double(tickCount5) * pi2 + top
                if isInNotch(angle) { continue }
                let isMajor = i % 6 == 0
                let tLen: Double = isMajor ? 10 : 5
                let tW: Double = isMajor ? 1.5 : 0.8
                let tp = Path { p in
                    p.move(to: CGPoint(x: c.x + cos(angle) * (ring5R - tLen/2),
                                       y: c.y + sin(angle) * (ring5R - tLen/2)))
                    p.addLine(to: CGPoint(x: c.x + cos(angle) * (ring5R + tLen/2),
                                          y: c.y + sin(angle) * (ring5R + tLen/2)))
                }
                ctx.stroke(tp, with: .color(isMajor ? jarvisCyan.opacity(0.6) : jarvisDim.opacity(0.4)),
                           style: StrokeStyle(lineWidth: tW))
            }

            // ══════════════════════════════════════════════════════════════
            //  N/S/E/W CROSSHAIR NOTCHES — extended lines at cardinal points
            // ══════════════════════════════════════════════════════════════
            for angle in [top, top + Double.pi/2, top + Double.pi, top + Double.pi * 1.5] {
                let dx = cos(angle)
                let dy = sin(angle)
                // Full-length notch line from ring5 to ring1
                let notchP = Path { p in
                    p.move(to: CGPoint(x: c.x + dx * (ring5R + 6), y: c.y + dy * (ring5R + 6)))
                    p.addLine(to: CGPoint(x: c.x + dx * (ring1R - 6), y: c.y + dy * (ring1R - 6)))
                }
                ctx.stroke(notchP, with: .color(jarvisCyan.opacity(0.04)), style: StrokeStyle(lineWidth: 8))
                ctx.stroke(notchP, with: .color(jarvisDim.opacity(0.20)), style: StrokeStyle(lineWidth: 1.0))
            }

            // ══════════════════════════════════════════════════════════════
            //  R-02 · REACTIVE SHOCKWAVE + BATTERY RING
            // ══════════════════════════════════════════════════════════════

            // Expanding cyan shockwave: fires on CPU spikes and thermal
            // critical. Progress ramps 0→1 over 1.2s from the controller.
            if reactorController.shockwaveActive {
                let prog = reactorController.shockwaveProgress
                let shockR = prog * ring1R
                let alpha = 1.0 - prog
                let sp = Path { p in
                    p.addArc(center: c, radius: shockR, startAngle: .zero,
                             endAngle: .radians(pi2), clockwise: false)
                }
                ctx.stroke(sp, with: .color(jarvisCyan.opacity(alpha * 0.25)),
                           style: StrokeStyle(lineWidth: 14))
                ctx.stroke(sp, with: .color(jarvisCyan.opacity(alpha)),
                           style: StrokeStyle(lineWidth: 2.0))
            }

            // Battery ring at R × 0.92 — sweep length = current charge level,
            // colour lerps amber → green via HSV hue.
            let batRingR = R * 0.92
            let batSweep = reactorController.batteryRingProgress * pi2
            let batColor = Color(
                hue: reactorController.batteryRingHue,
                saturation: 0.9,
                brightness: 0.9
            )
            let batTrack = Path { p in
                p.addArc(center: c, radius: batRingR, startAngle: .zero,
                         endAngle: .radians(pi2), clockwise: false)
            }
            ctx.stroke(batTrack, with: .color(batColor.opacity(0.12)),
                       style: StrokeStyle(lineWidth: 1.0))
            if batSweep > 0.001 {
                let batFill = Path { p in
                    p.addArc(center: c, radius: batRingR,
                             startAngle: .radians(top),
                             endAngle: .radians(top + batSweep),
                             clockwise: false)
                }
                ctx.stroke(batFill, with: .color(batColor.opacity(0.25)),
                           style: StrokeStyle(lineWidth: 5, lineCap: .round))
                ctx.stroke(batFill, with: .color(batColor),
                           style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
            }

            // ══════════════════════════════════════════════════════════════
            //  TIME & DATE ARC TEXT at ring boundary
            // ══════════════════════════════════════════════════════════════
            let hudNow = Date()
            let timeArcStr = JarvisReactorCanvas.hudTimeFmt.string(from: hudNow).uppercased()
            let dateArcStr = JarvisReactorCanvas.hudDateFmt.string(from: hudNow).uppercased()
            ctx.draw(
                Text(timeArcStr).font(.custom("Menlo", size: 9)).foregroundColor(jarvisCyan),
                at: CGPoint(x: c.x, y: c.y - R * 0.70)
            )
            ctx.draw(
                Text(dateArcStr).font(.custom("Menlo", size: 9)).foregroundColor(jarvisCyan),
                at: CGPoint(x: c.x, y: c.y + R * 0.70)
            )

            // ══════════════════════════════════════════════════════════════
            //  GAP-01: ARC-REACTOR CORE 3D CAPSULE
            //  Outer metallic ring → segmented arc → inner glow → capsule
            //  R-02: thermal distortion applies a small translate to this
            //  region only; reversed after the core finishes drawing.
            // ══════════════════════════════════════════════════════════════

            var coreJitterX: Double = 0
            var coreJitterY: Double = 0
            if reactorController.thermalDistortionActive {
                let amount = reactorController.thermalDistortionAmount
                let t = Date().timeIntervalSince1970
                coreJitterX = sin(t * 30) * amount * 3.0
                coreJitterY = cos(t * 28) * amount * 2.0
                ctx.translateBy(x: coreJitterX, y: coreJitterY)
            }

            // Outer metallic ring (dark grey radial gradient, 120pt diameter equiv ≈ 0.18R)
            let metallicR = R * 0.18
            let metallicRect = CGRect(x: c.x - metallicR, y: c.y - metallicR,
                                       width: metallicR * 2, height: metallicR * 2)
            ctx.fill(Path(ellipseIn: metallicRect), with: .radialGradient(
                Gradient(colors: [
                    Color(red: 0.30, green: 0.32, blue: 0.35),
                    Color(red: 0.15, green: 0.16, blue: 0.18),
                    Color(red: 0.06, green: 0.07, blue: 0.09)
                ]),
                center: c, startRadius: metallicR * 0.3, endRadius: metallicR
            ))
            ctx.stroke(Path(ellipseIn: metallicRect),
                       with: .color(jarvisDim.opacity(0.5)),
                       style: StrokeStyle(lineWidth: 2.0))

            // Middle ring: 12 segmented arcs (white fill, 8pt gap)
            let segRingR = metallicR * 0.75
            for i in 0..<12 {
                let segStart = Double(i) * (pi2 / 12.0)
                let segEnd = segStart + (pi2 / 12.0) * 0.70
                let sp = Path { p in p.addArc(center: c, radius: segRingR,
                    startAngle: .radians(segStart), endAngle: .radians(segEnd), clockwise: false) }
                // Bloom behind segments
                ctx.stroke(sp, with: .color(jarvisCyan.opacity(0.10)),
                           style: StrokeStyle(lineWidth: 6, lineCap: .butt))
                ctx.stroke(sp, with: .color(Color.white.opacity(0.85)),
                           style: StrokeStyle(lineWidth: 3, lineCap: .butt))
            }

            // Inner glow: radial gradient #FFFFFF → #00D4FF → transparent
            let innerGlowR = metallicR * 0.5
            // Pulsing scale (1.0 → 1.12 → 1.0, 2.4s period).
            // R-02: coreIntensity multiplier lets the controller breathe
            // the glow during idle and dim it during thermal-critical.
            let glowPulse = (1.0 + 0.12 * sin(ph * (pi2 / 2.4))) * reactorController.coreIntensity
            let glowR = innerGlowR * glowPulse
            let glowRect = CGRect(x: c.x - glowR, y: c.y - glowR, width: glowR * 2, height: glowR * 2)
            ctx.fill(Path(ellipseIn: glowRect), with: .radialGradient(
                Gradient(colors: [
                    Color.white.opacity(0.70),
                    jarvisCyan.opacity(0.50),
                    jarvisCyan.opacity(0.15),
                    Color.clear
                ]),
                center: c, startRadius: 0, endRadius: glowR
            ))

            // Core capsule: dark pill shape in center
            let capsW: Double = R * 0.045
            let capsH: Double = R * 0.075
            let capsRect = CGRect(x: c.x - capsW/2, y: c.y - capsH/2, width: capsW, height: capsH)
            let capsPath = Path(roundedRect: capsRect, cornerRadius: capsW/2)
            ctx.fill(capsPath, with: .color(Color(red: 0.102, green: 0.102, blue: 0.180)))  // #1A1A2E
            // White glow overlay on capsule
            ctx.fill(capsPath, with: .color(Color.white.opacity(0.15 * glowPulse)))
            ctx.stroke(capsPath, with: .color(Color.white.opacity(0.50)),
                       style: StrokeStyle(lineWidth: 0.5))

            // Core text — current hour
            let coreHour = Calendar.current.component(.hour, from: Date())
            ctx.draw(
                Text("\(coreHour)")
                    .font(.system(size: 22, design: .monospaced).bold())
                    .foregroundColor(jarvisCyan),
                at: c
            )

            // R-02: undo thermal distortion translate so the rest of the HUD
            // (radar sweep, degree markers, etc.) renders at the stable centre.
            if reactorController.thermalDistortionActive {
                ctx.translateBy(x: -coreJitterX, y: -coreJitterY)
            }

            // ══════════════════════════════════════════════════════════════
            //  RADAR SWEEP — retained from original
            // ══════════════════════════════════════════════════════════════
            let sweepCycle = 8.0
            let sweepTime = ph.truncatingRemainder(dividingBy: sweepCycle)
            let sweepAngle: Double
            if sweepTime < 6.0 {
                let t = sweepTime / 6.0
                let eased = t * t * (3.0 - 2.0 * t)
                sweepAngle = eased * pi2 * 0.75
            } else if sweepTime < 7.0 {
                sweepAngle = pi2 * 0.75
            } else {
                let t = (sweepTime - 7.0)
                sweepAngle = pi2 * 0.75 * (1.0 - t)
            }
            let sa = sweepAngle + top
            let mainSweep = Path { p in
                p.move(to: CGPoint(x: c.x + cos(sa) * R * 0.15, y: c.y + sin(sa) * R * 0.15))
                p.addLine(to: CGPoint(x: c.x + cos(sa) * R * 0.96, y: c.y + sin(sa) * R * 0.96))
            }
            ctx.stroke(mainSweep, with: .color(jarvisCyan.opacity(0.04)), style: StrokeStyle(lineWidth: 14))
            ctx.stroke(mainSweep, with: .color(jarvisWhite.opacity(0.12)), style: StrokeStyle(lineWidth: 4))
            ctx.stroke(mainSweep, with: .color(jarvisWhite.opacity(0.55)), style: StrokeStyle(lineWidth: 1.5))
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
            let tipX = c.x + cos(sa) * R * 0.96
            let tipY = c.y + sin(sa) * R * 0.96
            ctx.fill(Path(ellipseIn: CGRect(x: tipX - 7, y: tipY - 7, width: 14, height: 14)),
                     with: .color(jarvisCyan.opacity(0.12)))
            ctx.fill(Path(ellipseIn: CGRect(x: tipX - 2.5, y: tipY - 2.5, width: 5, height: 5)),
                     with: .color(Color.white.opacity(0.75)))

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
                    Text(label).font(.custom("Menlo", size: 8)).foregroundColor(jarvisWhite.opacity(0.50)),
                    at: CGPoint(x: tx, y: ty)
                )
            }

            // ══════════════════════════════════════════════════════════════
            //  GAP-13: MODE CONTROL BAR — top of outer ring
            //  4 pill segments: NOMINAL | STRAINED | CRITICAL | STANDBY
            // ══════════════════════════════════════════════════════════════
            do {
                let modes = ["NOMINAL", "STRAINED", "CRITICAL", "STANDBY"]
                let pillW: Double = 50
                let pillH: Double = 14
                let pillGap: Double = 6
                let totalW = Double(modes.count) * pillW + Double(modes.count - 1) * pillGap
                let startX = c.x - totalW / 2
                let barY = c.y - R * 0.95 - 28  // just above outer ring

                for (i, mode) in modes.enumerated() {
                    let px = startX + Double(i) * (pillW + pillGap)
                    let pillRect = CGRect(x: px, y: barY, width: pillW, height: pillH)
                    let pillPath = Path(roundedRect: pillRect, cornerRadius: pillH / 2)

                    let isActive = (store.thermalState.lowercased().contains("critical") && mode == "CRITICAL") ||
                                   (store.thermalState.lowercased().contains("serious") && mode == "STRAINED") ||
                                   (!store.thermalState.lowercased().contains("critical") &&
                                    !store.thermalState.lowercased().contains("serious") && mode == "NOMINAL") ||
                                   (cpuAvg < 0.05 && gpuLoad < 0.05 && mode == "STANDBY")

                    if isActive {
                        ctx.fill(pillPath, with: .color(jarvisCyan))
                        ctx.draw(
                            Text(mode).font(.system(size: 7, design: .monospaced).bold())
                                .foregroundColor(Color(red: 0, green: 0.03, blue: 0.06)),
                            at: CGPoint(x: px + pillW/2, y: barY + pillH/2)
                        )
                    } else {
                        ctx.stroke(pillPath, with: .color(jarvisCyan.opacity(0.30)),
                                   style: StrokeStyle(lineWidth: 1))
                        ctx.draw(
                            Text(mode).font(.system(size: 7, design: .monospaced))
                                .foregroundColor(jarvisCyan.opacity(0.30)),
                            at: CGPoint(x: px + pillW/2, y: barY + pillH/2)
                        )
                    }
                }
            }

        } // end Canvas
        // Ring labels overlay — core cluster labels
        .overlay(
            ZStack {
                Text("E-CORES")
                    .font(.custom("Menlo", size: 9)).tracking(3)
                    .foregroundColor(cyan.opacity(0.65))
                    .shadow(color: cyan.opacity(0.3), radius: 4)
                    .position(x: center.x, y: center.y - R * 0.78 - 18)
                Text("P-CORES")
                    .font(.custom("Menlo", size: 8)).tracking(2)
                    .foregroundColor(amber.opacity(0.55))
                    .position(x: center.x, y: center.y - R * 0.65 - 15)
                Text("S-CORES")
                    .font(.custom("Menlo", size: 8)).tracking(2)
                    .foregroundColor(crimson.opacity(0.55))
                    .position(x: center.x, y: center.y - R * 0.50 - 15)
                Text("GPU")
                    .font(.custom("Menlo", size: 8)).tracking(2)
                    .foregroundColor(Color.white.opacity(0.50))
                    .position(x: center.x, y: center.y - R * 0.84 - 14)
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

