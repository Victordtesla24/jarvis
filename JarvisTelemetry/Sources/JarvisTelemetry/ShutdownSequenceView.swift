// File: Sources/JarvisTelemetry/ShutdownSequenceView.swift
// JARVIS CINEMATIC SHUTDOWN — Iron Man power-down sequence
// ENHANCED: Sequential ring dimming, energy drainage spiraling to core,
// dramatic EMP flash, volumetric particle implosion, holographic text dissolve

import SwiftUI

struct ShutdownSequenceView: View {
    @EnvironmentObject var phaseController: HUDPhaseController
    @EnvironmentObject var store: TelemetryStore

    private let cyan      = Color(red: 0.00, green: 0.83, blue: 1.00)
    private let cyanBright = Color(red: 0.41, green: 0.95, blue: 0.95)
    private let cyanDim   = Color(red: 0.00, green: 0.55, blue: 0.70)
    private let amber     = Color(red: 1.00, green: 0.78, blue: 0.00)
    private let crimson   = Color(red: 1.00, green: 0.15, blue: 0.20)
    private let steel     = Color(red: 0.40, green: 0.52, blue: 0.58)
    private let gridBlue  = Color(red: 0.00, green: 0.20, blue: 0.30)

    var body: some View {
        let p = phaseController.shutdownProgress

        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let cx = w / 2
            let cy = h / 2
            let R = min(w, h) * 0.42

            TimelineView(.animation(minimumInterval: 1.0/60.0)) { timeline in
                let phase = timeline.date.timeIntervalSinceReferenceDate

                ZStack {
                    Color.black.ignoresSafeArea()

                    // ── 1. HEX GRID FADING OUT (0-45%) ──
                    if p < 0.50 {
                        let gridOp = max(0, 1.0 - p / 0.45)
                        HexGridCanvas(width: w, height: h, phase: phase, color: gridBlue)
                            .opacity(gridOp * 0.05)
                    }

                    // ── 2. SCAN LINES FADING (0-35%) ──
                    if p < 0.40 {
                        let scanOp = max(0, 1.0 - p / 0.35)
                        ScanLineOverlay(height: h, phase: phase, color: cyan)
                            .opacity(scanOp)
                    }

                    // ── 3. REACTOR BLOOM DIMMING — dramatic falloff ──
                    if p < 0.80 {
                        let bloomOp = max(0, 1.0 - p / 0.70)
                        RadialGradient(
                            gradient: Gradient(colors: [
                                cyan.opacity(0.10 * bloomOp),
                                cyan.opacity(0.04 * bloomOp),
                                Color.clear
                            ]),
                            center: .center,
                            startRadius: R * 0.03,
                            endRadius: R * 1.5
                        )
                        .ignoresSafeArea()
                    }

                    // ── 4. RINGS DECELERATING & FADING (0-72%) — SEQUENTIAL ──
                    if p < 0.75 {
                        ShutdownRings(progress: p, phase: phase, cx: cx, cy: cy, R: R,
                                      cyan: cyan, cyanDim: cyanDim, steel: steel)
                    }

                    // ── 5. DATA ARCS DRAINING (10-50%) — faster drain ──
                    if p > 0.10 && p < 0.55 {
                        ShutdownDataArcs(progress: p, cx: cx, cy: cy, R: R, store: store,
                                         cyan: cyan, amber: amber, crimson: crimson)
                    }

                    // ── 6. ENERGY DRAINAGE — visible energy spiraling to core ──
                    if p > 0.08 && p < 0.55 {
                        ShutdownEnergyDrainage(progress: p, phase: phase, cx: cx, cy: cy, R: R,
                                               width: w, height: h, cyan: cyan)
                    }

                    // ── 7. CONNECTIVE WIRES FIRING TO CORE (10-20%) ──
                    if p > 0.10 && p < 0.22 {
                        ShutdownWireFlash(progress: (p - 0.10) / 0.12, cx: cx, cy: cy, R: R,
                                          width: w, height: h, cyan: cyan)
                    }

                    // ── 8. PARTICLE IMPLOSION (20-70%) — ENHANCED ──
                    if p > 0.20 && p < 0.72 {
                        ShutdownParticleImplosion(progress: (p - 0.20) / 0.52, phase: phase,
                                                  cx: cx, cy: cy, width: w, height: h, cyan: cyan)
                    }

                    // ── 9. CORE DIMMING (0-85%) — ENHANCED cardiac slowdown ──
                    if p < 0.85 {
                        ShutdownCore(progress: p, phase: phase, cx: cx, cy: cy, R: R,
                                     cyan: cyan, cyanBright: cyanBright)
                    }

                    // ── 10. "SHUTDOWN INITIATED" (0-16%) ──
                    if p < 0.20 {
                        let textOp = p < 0.03
                            ? p / 0.03
                            : max(0, 1.0 - (p - 0.13) / 0.07)
                        Text("S H U T D O W N   I N I T I A T E D")
                            .font(.custom("Menlo", size: 15)).tracking(8)
                            .foregroundColor(cyan.opacity(textOp * 0.85))
                            .shadow(color: cyan.opacity(textOp * 0.5), radius: 10)
                            .shadow(color: cyan.opacity(textOp * 0.2), radius: 25)
                            .position(x: cx, y: cy + R + 60)
                    }

                    // ── 11. STATUS MESSAGES (8-65%) ──
                    ShutdownStatusStream(progress: p, cx: cx, cy: cy, R: R,
                                         cyan: cyan, cyanDim: cyanDim, amber: amber)

                    // ── 12. SIDE PANELS RETRACT (3-18%) — faster ──
                    if p > 0.03 && p < 0.22 {
                        let retractP = (p - 0.03) / 0.18
                        ShutdownPanelRetract(progress: retractP, width: w, height: h,
                                             cyan: cyan, cyanDim: cyanDim)
                    }

                    // ── 13. FINAL EMP FLASH (80-88%) — DRAMATIC ──
                    if p > 0.78 && p < 0.90 {
                        let flashCenter = 0.84
                        let flash = max(0, 1.0 - abs(p - flashCenter) / 0.05)
                        let flashSq = flash * flash  // sharper falloff

                        // Central white burst
                        Circle()
                            .fill(Color.white.opacity(0.80 * flashSq))
                            .frame(width: R * 0.15 * (0.2 + flash * 0.8),
                                   height: R * 0.15 * (0.2 + flash * 0.8))
                            .position(x: cx, y: cy)
                            .shadow(color: cyan.opacity(0.6 * flash), radius: 40)
                            .shadow(color: cyan.opacity(0.3 * flash), radius: 80)

                        // EMP ring expanding outward
                        if flash > 0.3 {
                            let empR = R * 0.1 + R * 0.6 * (1.0 - flash)
                            Circle()
                                .stroke(cyan.opacity(0.4 * flash), lineWidth: 3)
                                .frame(width: empR * 2, height: empR * 2)
                                .position(x: cx, y: cy)
                                .shadow(color: cyan.opacity(0.15 * flash), radius: 15)
                        }
                    }

                    // ── 14. "JARVIS OFFLINE" (86-98%) — holographic dissolve ──
                    if p > 0.86 {
                        let textOp = p < 0.91
                            ? (p - 0.86) / 0.05
                            : max(0, 1.0 - (p - 0.94) / 0.04)
                        // Dissolving text effect via reduced opacity
                        let glitch = p > 0.93 ? sin(p * 200) * 0.15 : 0.0

                        Text("J A R V I S   O F F L I N E")
                            .font(.custom("Menlo", size: 17)).tracking(10)
                            .foregroundColor(cyanDim.opacity(textOp * 0.65))
                            .shadow(color: cyan.opacity(textOp * 0.25), radius: 8)
                            .offset(x: glitch * 5)
                            .position(x: cx, y: cy)
                    }
                }
            }
        }
    }
}

// MARK: - Decelerating Rings — ENHANCED

/// Rings slow with angular momentum drag — SEQUENTIAL outer-to-inner dimming
struct ShutdownRings: View {
    let progress: Double
    let phase: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color, cyanDim: Color, steel: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let pi2 = Double.pi * 2.0

            // 16 ring groups (outer to inner) — more granular
            let rings: [(radiusFrac: Double, fadeStart: Double, decayRate: Double)] = [
                (0.97, 0.00, 0.90),
                (0.95, 0.02, 0.91),
                (0.93, 0.05, 0.92),
                (0.90, 0.08, 0.925),
                (0.88, 0.11, 0.93),
                (0.84, 0.14, 0.935),
                (0.80, 0.18, 0.94),
                (0.75, 0.22, 0.945),
                (0.70, 0.26, 0.95),
                (0.65, 0.30, 0.955),
                (0.58, 0.35, 0.96),
                (0.50, 0.40, 0.965),
                (0.42, 0.44, 0.97),
                (0.32, 0.48, 0.975),
                (0.22, 0.52, 0.98),
                (0.15, 0.56, 0.985),
            ]

            for (i, ring) in rings.enumerated() {
                let ringOp: Double
                if progress > ring.fadeStart + 0.16 { ringOp = 0 }
                else if progress > ring.fadeStart { ringOp = 1.0 - (progress - ring.fadeStart) / 0.16 }
                else { ringOp = 1.0 }
                guard ringOp > 0.01 else { continue }

                let r = R * ring.radiusFrac

                let timeSinceDecel = max(0, progress - ring.fadeStart * 0.5)
                let framesDecayed = timeSinceDecel * 60.0
                let velocity = pow(ring.decayRate, framesDecayed)
                let altDir: Double = i % 2 == 0 ? 1.0 : -1.0
                let angle = phase * 0.08 * velocity * altDir

                let path = Path { p in
                    p.addArc(center: c, radius: r,
                             startAngle: .radians(angle),
                             endAngle: .radians(angle + pi2), clockwise: false)
                }

                let isStructural = i % 3 == 0
                if isStructural {
                    // Cyan bloom fading
                    ctx.stroke(path, with: .color(cyan.opacity(0.05 * ringOp)),
                               style: StrokeStyle(lineWidth: 20))
                    ctx.stroke(path, with: .color(steel.opacity(0.35 * ringOp)),
                               style: StrokeStyle(lineWidth: 2.5))
                    ctx.stroke(path, with: .color(Color.white.opacity(0.12 * ringOp)),
                               style: StrokeStyle(lineWidth: 0.6))
                } else {
                    ctx.stroke(path, with: .color(cyan.opacity(0.03 * ringOp)),
                               style: StrokeStyle(lineWidth: 14))
                    ctx.stroke(path, with: .color(cyanDim.opacity(0.22 * ringOp)),
                               style: StrokeStyle(lineWidth: 1.0))
                }

                // White edge highlight while spinning fast
                if velocity > 0.3 {
                    ctx.stroke(path, with: .color(Color.white.opacity(0.07 * ringOp * velocity)),
                               style: StrokeStyle(lineWidth: 0.5))
                }

                // Dimming sparkle — brief flash as each ring dies
                if ringOp > 0 && ringOp < 0.15 {
                    let sparkOp = ringOp / 0.15
                    let sparkAngle = angle + phase * 0.5
                    let sx = c.x + r * cos(sparkAngle)
                    let sy = c.y + r * sin(sparkAngle)
                    let sparkRect = CGRect(x: sx - 3, y: sy - 3, width: 6, height: 6)
                    ctx.fill(Path(ellipseIn: sparkRect), with: .color(cyan.opacity(0.5 * sparkOp)))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Energy Drainage — NEW

/// Visible energy flowing from rings back toward core during shutdown
struct ShutdownEnergyDrainage: View {
    let progress: Double
    let phase: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let width: CGFloat, height: CGFloat
    let cyan: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let drainP = min(1.0, (progress - 0.08) / 0.40)
            let rayCount = 16

            for i in 0..<rayCount {
                let angle = Double(i) / Double(rayCount) * .pi * 2.0
                // Energy flows INWARD (reverse of boot cascade)
                let pulseCycle = (phase * 0.6 + Double(i) * 0.4).truncatingRemainder(dividingBy: 2.0)
                let pulseT = pulseCycle / 2.0

                let outerR = Double(R) * (0.95 - drainP * 0.5)
                let innerR = Double(R) * 0.04
                // Inward direction: start at outer, move to inner
                let currentR = outerR - (outerR - innerR) * pulseT

                let dotX = c.x + cos(angle) * currentR
                let dotY = c.y + sin(angle) * currentR

                let fadeIn = min(1.0, pulseT * 3)
                let fadeOut = min(1.0, (1.0 - pulseT) * 5)
                let dotOp = fadeIn * fadeOut * 0.30 * (1.0 - drainP * 0.7)

                guard dotOp > 0.01 else { continue }

                let dotSz = 1.5 + pulseT * 1.5
                let dotRect = CGRect(x: dotX - dotSz / 2, y: dotY - dotSz / 2, width: dotSz, height: dotSz)
                ctx.fill(Path(ellipseIn: dotRect), with: .color(cyan.opacity(dotOp)))

                // Glow
                let glowRect = CGRect(x: dotX - dotSz * 2, y: dotY - dotSz * 2, width: dotSz * 4, height: dotSz * 4)
                ctx.fill(Path(ellipseIn: glowRect), with: .color(cyan.opacity(dotOp * 0.25)))

                // Spiral trail — adds drama
                let spiralOff = sin(pulseT * .pi * 3) * 8 * (1.0 - pulseT)
                let trailX = dotX + sin(angle + .pi / 2) * spiralOff
                let trailY = dotY + cos(angle + .pi / 2) * spiralOff
                let trailRect = CGRect(x: trailX - dotSz * 0.5, y: trailY - dotSz * 0.5, width: dotSz, height: dotSz)
                ctx.fill(Path(ellipseIn: trailRect), with: .color(cyan.opacity(dotOp * 0.15)))
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Data Arcs Draining

struct ShutdownDataArcs: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let store: TelemetryStore
    let cyan: Color, amber: Color, crimson: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let pi2 = Double.pi * 2.0
            let top = -Double.pi / 2.0

            let drain = max(0, 1.0 - (progress - 0.10) / 0.35)
            let opacity = drain * 0.70

            let eCores = store.eCoreUsages.isEmpty
                ? Array(repeating: 0.3, count: 10) : store.eCoreUsages
            drawDrainingArcs(ctx: ctx, c: c, usages: eCores.map { $0 * drain },
                             r: R * 0.845, lineW: 3, color: cyan, opacity: opacity,
                             top: top, pi2: pi2)

            if progress < 0.45 {
                let pDrain = max(0, 1.0 - (progress - 0.10) / 0.28)
                let pCores = store.pCoreUsages.isEmpty
                    ? Array(repeating: 0.3, count: 4) : store.pCoreUsages
                drawDrainingArcs(ctx: ctx, c: c, usages: pCores.map { $0 * pDrain },
                                 r: R * 0.745, lineW: 3, color: amber, opacity: pDrain * 0.70,
                                 top: top, pi2: pi2)
            }

            if progress < 0.40 {
                let sDrain = max(0, 1.0 - (progress - 0.10) / 0.22)
                let sCores = store.sCoreUsages.isEmpty
                    ? Array(repeating: 0.2, count: 1) : store.sCoreUsages
                drawDrainingArcs(ctx: ctx, c: c, usages: sCores.map { $0 * sDrain },
                                 r: R * 0.645, lineW: 2.5, color: crimson, opacity: sDrain * 0.70,
                                 top: top, pi2: pi2)
            }

            if progress < 0.45 {
                let gDrain = max(0, 1.0 - (progress - 0.10) / 0.28)
                let gpu = max(store.gpuUsage, 0.3) * gDrain
                let gS = -Double.pi * 0.75
                let gE = gS + Double.pi * 1.5 * gpu
                let gPath = Path { p in
                    p.addArc(center: c, radius: R * 0.915,
                             startAngle: .radians(gS), endAngle: .radians(gE), clockwise: false)
                }
                ctx.stroke(gPath, with: .color(cyan.opacity(0.04 * gDrain)),
                           style: StrokeStyle(lineWidth: 18, lineCap: .round))
                ctx.stroke(gPath, with: .color(cyan.opacity(0.12 * gDrain)),
                           style: StrokeStyle(lineWidth: 8, lineCap: .round))
                ctx.stroke(gPath, with: .color(cyan.opacity(0.65 * gDrain)),
                           style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
            }
        }
        .allowsHitTesting(false)
    }

    private func drawDrainingArcs(ctx: GraphicsContext, c: CGPoint, usages: [Double],
                                   r: Double, lineW: Double, color: Color, opacity: Double,
                                   top: Double, pi2: Double) {
        let n = usages.count
        guard n > 0 else { return }
        let sw = pi2 / Double(n)
        let gap = sw * 0.06

        for (i, u) in usages.enumerated() {
            guard u > 0.01 else { continue }
            let s0 = top + sw * Double(i) + gap / 2
            let fe = s0 + (sw - gap) * u
            let fp = Path { p in
                p.addArc(center: c, radius: r,
                         startAngle: .radians(s0), endAngle: .radians(fe), clockwise: false)
            }
            ctx.stroke(fp, with: .color(color.opacity(0.04 * opacity)),
                       style: StrokeStyle(lineWidth: lineW * 6, lineCap: .round))
            ctx.stroke(fp, with: .color(color.opacity(0.10 * opacity)),
                       style: StrokeStyle(lineWidth: lineW * 3, lineCap: .round))
            ctx.stroke(fp, with: .color(color.opacity(opacity)),
                       style: StrokeStyle(lineWidth: lineW, lineCap: .round))
        }
    }
}

// MARK: - Connective Wire Flash

struct ShutdownWireFlash: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let width: CGFloat, height: CGFloat
    let cyan: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let wireCount = 10

            for i in 0..<wireCount {
                let seed = Double(i) * 137.508
                let angle = Double(i) / Double(wireCount) * .pi * 2.0
                let edgeR = max(width, height) * 0.5
                let startX = c.x + edgeR * cos(angle) * 0.7
                let startY = c.y + edgeR * sin(angle) * 0.7

                let drawP = min(1.0, progress * 2.0)
                let fadeP = max(0, progress - 0.5) * 2.0
                let opacity = (1.0 - fadeP) * 0.40

                guard opacity > 0.01 else { continue }

                let midX = (startX + c.x) / 2 + sin(seed) * 50
                let midY = (startY + c.y) / 2 + cos(seed) * 50
                let endX = c.x + (startX - c.x) * (1.0 - drawP)
                let endY = c.y + (startY - c.y) * (1.0 - drawP)

                let wirePath = Path { p in
                    p.move(to: CGPoint(x: startX, y: startY))
                    p.addQuadCurve(
                        to: CGPoint(x: endX, y: endY),
                        control: CGPoint(x: midX, y: midY)
                    )
                }

                ctx.stroke(wirePath, with: .color(cyan.opacity(opacity * 0.25)),
                           style: StrokeStyle(lineWidth: 4, lineCap: .round))
                ctx.stroke(wirePath, with: .color(cyan.opacity(opacity)),
                           style: StrokeStyle(lineWidth: 0.8, lineCap: .round))

                if drawP < 1.0 {
                    let tipSz = 3.0
                    let tipGlow = CGRect(x: endX - tipSz * 2, y: endY - tipSz * 2, width: tipSz * 4, height: tipSz * 4)
                    ctx.fill(Path(ellipseIn: tipGlow), with: .color(cyan.opacity(opacity * 0.4)))
                    let tipRect = CGRect(x: endX - tipSz / 2, y: endY - tipSz / 2, width: tipSz, height: tipSz)
                    ctx.fill(Path(ellipseIn: tipRect), with: .color(Color.white.opacity(opacity * 0.9)))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Particle Implosion — ENHANCED

/// More particles, spiral trajectories, dramatic flash-on-arrival
struct ShutdownParticleImplosion: View {
    let progress: Double
    let phase: Double
    let cx: CGFloat, cy: CGFloat
    let width: CGFloat, height: CGFloat
    let cyan: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let particleCount = 50  // More particles

            let t = progress * progress * progress  // cubic acceleration

            for i in 0..<particleCount {
                let seed = Double(i) * 137.508

                let startX = (sin(seed * 2.3) + 1) / 2 * Double(width)
                let startY = (cos(seed * 3.7) + 1) / 2 * Double(height)

                // Spiral inward instead of straight line
                let spiralAngle = t * .pi * 2 * (1.0 + sin(seed) * 0.5)
                let linearX = startX + (Double(c.x) - startX) * t
                let linearY = startY + (Double(c.y) - startY) * t
                let spiralR = (1.0 - t) * 30 * sin(seed * 0.5)
                let x = linearX + cos(spiralAngle + seed) * spiralR
                let y = linearY + sin(spiralAngle + seed) * spiralR

                let dist = sqrt(pow(x - Double(c.x), 2) + pow(y - Double(c.y), 2))
                let maxDist = sqrt(pow(Double(width)/2, 2) + pow(Double(height)/2, 2))

                let proximity = 1.0 - min(1.0, dist / maxDist)
                let opacity = (0.15 + proximity * 0.50) * (1.0 - progress * 0.3)

                let sz: Double
                if dist < 25 {
                    let flashP = 1.0 - dist / 25.0
                    sz = 2.0 + flashP * 7.0
                    let flashRect = CGRect(x: x - sz * 2, y: y - sz * 2,
                                           width: sz * 4, height: sz * 4)
                    ctx.fill(Path(ellipseIn: flashRect),
                             with: .color(cyan.opacity(0.30 * flashP)))
                    ctx.fill(Path(ellipseIn: flashRect),
                             with: .color(Color.white.opacity(0.20 * flashP)))
                } else {
                    sz = 1.5 + (1.0 - progress) * 1.5
                }

                let rect = CGRect(x: x - sz/2, y: y - sz/2, width: sz, height: sz)
                ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(opacity)))

                // Motion trail — 4 trailing copies (more dramatic)
                if progress > 0.1 && dist > 30 {
                    for trail in 1...4 {
                        let trailT = max(0, t - Double(trail) * 0.012)
                        let tLinX = startX + (Double(c.x) - startX) * trailT
                        let tLinY = startY + (Double(c.y) - startY) * trailT
                        let tSpiralR = (1.0 - trailT) * 30 * sin(seed * 0.5)
                        let tSpiralA = trailT * .pi * 2 * (1.0 + sin(seed) * 0.5)
                        let tx = tLinX + cos(tSpiralA + seed) * tSpiralR
                        let ty = tLinY + sin(tSpiralA + seed) * tSpiralR
                        let trailOp = opacity * (0.12 / Double(trail))
                        let tSz = sz * 0.6
                        let tRect = CGRect(x: tx - tSz/2, y: ty - tSz/2, width: tSz, height: tSz)
                        ctx.fill(Path(ellipseIn: tRect), with: .color(cyan.opacity(trailOp)))
                    }
                }
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Core Dimming — ENHANCED

/// Core heartbeat slows dramatically, volumetric bloom dims, final pulse
struct ShutdownCore: View {
    let progress: Double
    let phase: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color, cyanBright: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)

            let bright: Double = progress > 0.50
                ? max(0, 1.0 - (progress - 0.50) / 0.35)
                : 1.0

            let scale: Double = progress > 0.55
                ? max(0.10, 1.0 - (progress - 0.55) / 0.30)
                : 1.0

            // Heartbeat slows: ~90 BPM to ~15 BPM
            let bpmFactor = max(0.15, 1.0 - progress * 0.85)
            let beatCycle = phase * 1.5 * bpmFactor
            let beat = pow(max(0, sin(beatCycle)), 4.0) * bright

            // Ultra-wide ambient halo dimming
            for layer in 0..<6 {
                let lr = R * 0.15 * scale + Double(layer) * R * 0.05 * scale
                let lo = 0.015 * bright * (1.0 - Double(layer) / 6.0)
                let rect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(lo)))
            }

            // Volumetric glow layers — 25 layers dimming
            for layer in 0..<max(1, Int(25.0 * bright)) {
                let lr = R * 0.004 * scale + Double(layer) * R * 0.012 * scale
                let falloff = 1.0 - Double(layer) / 25.0
                let lo = (0.30 * falloff * falloff) * bright + beat * 0.06
                guard lo > 0.005 else { continue }
                let rect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                let blend = Double(layer) / 25.0
                if blend > 0.4 {
                    ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(lo * 0.7)))
                } else {
                    ctx.fill(Path(ellipseIn: rect), with: .color(cyanBright.opacity(lo)))
                }
            }

            // Hot core center
            let hotR = R * 0.04 * scale * (bright + beat * 0.3)
            let hotRect = CGRect(x: c.x - hotR, y: c.y - hotR, width: hotR * 2, height: hotR * 2)
            ctx.fill(Path(ellipseIn: hotRect), with: .color(cyanBright.opacity(0.75 * bright)))
            ctx.fill(Path(ellipseIn: hotRect), with: .color(Color.white.opacity(0.5 * bright * (0.5 + beat * 0.5))))

            // Heartbeat ripple ring
            if beat > 0.3 && bright > 0.15 {
                let rippleR = hotR * 3.5 * beat
                let ripplePath = Path { p in
                    p.addArc(center: c, radius: rippleR, startAngle: .zero,
                             endAngle: .radians(.pi * 2), clockwise: false)
                }
                ctx.stroke(ripplePath, with: .color(cyan.opacity(0.15 * beat * bright)),
                           style: StrokeStyle(lineWidth: 2))
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Panel Retraction

struct ShutdownPanelRetract: View {
    let progress: Double
    let width: CGFloat, height: CGFloat
    let cyan: Color, cyanDim: Color

    var body: some View {
        let retractP = progress * progress  // ease-in

        RoundedRectangle(cornerRadius: 4)
            .stroke(cyan.opacity(0.28 * (1.0 - retractP)), lineWidth: 0.8)
            .frame(width: width * 0.15, height: height * 0.50)
            .position(x: width * 0.09 - retractP * 350, y: height * 0.45)
            .opacity(1.0 - retractP)

        RoundedRectangle(cornerRadius: 4)
            .stroke(cyan.opacity(0.28 * (1.0 - retractP)), lineWidth: 0.8)
            .frame(width: width * 0.16, height: height * 0.50)
            .position(x: width * 0.93 + retractP * 350, y: height * 0.45)
            .opacity(1.0 - retractP)

        Rectangle()
            .fill(Color.black.opacity(0.25 * (1.0 - retractP)))
            .frame(height: 36)
            .position(x: width / 2, y: 18 - retractP * 65)
            .opacity(1.0 - retractP)
    }
}

// MARK: - Status Messages — ENHANCED

struct ShutdownStatusStream: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color, cyanDim: Color, amber: Color

    private var messages: [(text: String, color: Color, start: Double, end: Double)] {
        [
            ("SECURING TELEMETRY STREAM...", cyan, 0.08, 0.25),
            ("CORE METRICS: ARCHIVED", cyanDim, 0.15, 0.32),
            ("POWERING DOWN SUBSYSTEMS...", cyan, 0.22, 0.42),
            ("GPU COMPLEX: OFFLINE", amber, 0.30, 0.50),
            ("CORE CLUSTERS: OFFLINE", amber, 0.40, 0.58),
            ("THERMAL MONITORING: SUSPENDED", cyanDim, 0.48, 0.68),
        ]
    }

    var body: some View {
        VStack(spacing: 5) {
            ForEach(Array(messages.enumerated()), id: \.offset) { _, msg in
                if progress >= msg.start {
                    let age = progress - msg.start
                    let fadeIn = min(1.0, age / 0.02)
                    let fadeOut = progress > msg.end
                        ? max(0, 1.0 - (progress - msg.end) / 0.04)
                        : 1.0
                    let chars = min(msg.text.count, Int(age * 800))

                    HStack(spacing: 5) {
                        Circle()
                            .fill(msg.color.opacity(fadeIn * fadeOut * 0.6))
                            .frame(width: 3, height: 3)
                        Text(String(msg.text.prefix(chars)))
                            .font(.custom("Menlo", size: 10)).tracking(2)
                            .foregroundColor(msg.color.opacity(fadeIn * fadeOut * 0.60))
                            .shadow(color: msg.color.opacity(fadeIn * fadeOut * 0.20), radius: 5)
                    }
                }
            }
        }
        .position(x: cx, y: cy + R + 90)
    }
}
