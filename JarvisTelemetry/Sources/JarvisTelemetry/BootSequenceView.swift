// File: Sources/JarvisTelemetry/BootSequenceView.swift
// JARVIS CINEMATIC BOOT — Iron Man workshop ignition sequence
// ENHANCED: Multiple shockwaves, energy cascade, holographic text reveal,
// volumetric core bloom, dramatic ring materialization with spark trails
// Cyan/amber/crimson palette matching main HUD for seamless transition

import SwiftUI

struct BootSequenceView: View {
    @EnvironmentObject var phaseController: HUDPhaseController
    @EnvironmentObject var store: TelemetryStore

    // Iron Man palette — matches JarvisHUDView exactly
    private let cyan      = Color(red: 0.102, green: 0.902, blue: 0.961)   // #1AE6F5
    private let cyanBright = Color(red: 0.41, green: 0.95, blue: 0.95)  // #69F1F1
    private let cyanDim   = Color(red: 0.00, green: 0.55, blue: 0.70)   // #008CB3
    private let amber     = Color(red: 1.00, green: 0.78, blue: 0.00)   // #FFC800
    private let crimson   = Color(red: 1.00, green: 0.15, blue: 0.20)   // #FF2633
    private let steel     = Color(red: 0.40, green: 0.52, blue: 0.58)   // #668494
    private let darkBlue  = Color(red: 0.02, green: 0.04, blue: 0.08)   // #050A14
    private let gridBlue  = Color(red: 0.00, green: 0.20, blue: 0.30)   // #00334D

    var body: some View {
        let p = phaseController.bootProgress
        let isWake = phaseController.phase == .boot(isWake: true)

        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let cx = w / 2
            let cy = h / 2
            let R = min(w, h) * 0.42

            TimelineView(.animation(minimumInterval: 1.0/60.0)) { timeline in
                let phase = timeline.date.timeIntervalSinceReferenceDate

                ZStack {
                    // ── BACKGROUND ──
                    Color.black.ignoresSafeArea()

                    // Ambient reactor bloom — grows with boot progress, ENHANCED
                    if p > 0.05 {
                        let bloomP = min(1, p / 0.25)
                        RadialGradient(
                            gradient: Gradient(colors: [
                                cyan.opacity(0.10 * bloomP),
                                cyan.opacity(0.05 * bloomP),
                                cyan.opacity(0.02 * bloomP),
                                Color.clear
                            ]),
                            center: .center,
                            startRadius: R * 0.03,
                            endRadius: R * 1.8
                        )
                        .ignoresSafeArea()
                        // Inner bloom — brighter, tighter
                        RadialGradient(
                            gradient: Gradient(colors: [
                                cyan.opacity(0.12 * bloomP),
                                cyan.opacity(0.04 * bloomP),
                                Color.clear
                            ]),
                            center: .center,
                            startRadius: R * 0.01,
                            endRadius: R * 0.5
                        )
                        .ignoresSafeArea()
                    }

                    // ── 1. CORE IGNITION (0-15%) — ENHANCED ──
                    if p > 0.02 {
                        BootCoreIgnition(progress: p, phase: phase, cx: cx, cy: cy, R: R,
                                         cyan: cyan, cyanBright: cyanBright)
                    }

                    // ── 2. TRIPLE SHOCKWAVE RINGS (5-25%) — STAGGERED ──
                    if p > 0.04 && p < 0.25 {
                        // Primary shockwave — immediate
                        BootShockwave(progress: min(1, (p - 0.04) / 0.12), cx: cx, cy: cy,
                                      maxR: max(w, h), cyan: cyan, intensity: 1.0)
                    }
                    if p > 0.07 && p < 0.28 {
                        // Secondary shockwave — delayed, wider
                        BootShockwave(progress: min(1, (p - 0.07) / 0.15), cx: cx, cy: cy,
                                      maxR: max(w, h), cyan: cyanBright, intensity: 0.6)
                    }
                    if p > 0.10 && p < 0.32 {
                        // Tertiary shockwave — delayed more, subtle
                        BootShockwave(progress: min(1, (p - 0.10) / 0.18), cx: cx, cy: cy,
                                      maxR: max(w, h), cyan: cyanDim, intensity: 0.35)
                    }

                    // ── 3. HEX GRID FADE-IN (20-35%) — earlier, more visible ──
                    if p > 0.20 {
                        let gridOp = min(1.0, (p - 0.20) / 0.12)
                        HexGridCanvas(width: w, height: h, phase: phase, color: gridBlue)
                            .opacity(gridOp * 0.05)
                    }

                    // ── 4. SCAN LINES (25%+) ──
                    if p > 0.25 {
                        let scanOp = min(1.0, (p - 0.25) / 0.08)
                        ScanLineOverlay(height: h, phase: phase, color: cyan)
                            .opacity(scanOp)
                    }

                    // ── 5. REACTOR RINGS MATERIALIZE (8-55%) — with energy cascade ──
                    if p > 0.08 {
                        BootReactorRings(progress: p, phase: phase, cx: cx, cy: cy, R: R,
                                         cyan: cyan, cyanDim: cyanDim, steel: steel)
                    }

                    // ── 5b. ENERGY CASCADE — visible energy flowing core → rings ──
                    if p > 0.12 && p < 0.65 {
                        BootEnergyCascade(progress: p, phase: phase, cx: cx, cy: cy, R: R, cyan: cyan)
                    }

                    // ── 6. STRUCTURAL ELEMENTS — bezels, ticks, spokes (50-65%) ──
                    if p > 0.50 {
                        BootStructuralElements(progress: p, phase: phase, cx: cx, cy: cy, R: R,
                                               steel: steel, cyan: cyan)
                    }

                    // ── 7. DATA ARCS FLASH ON (40-60%) — earlier ──
                    if p > 0.40 {
                        BootDataArcs(progress: p, cx: cx, cy: cy, R: R, store: store,
                                     cyan: cyan, amber: amber, crimson: crimson)
                    }

                    // ── 8. AMBIENT PARTICLES (70%+) — earlier, more dramatic ──
                    if p > 0.70 {
                        let particleOp = min(1.0, (p - 0.70) / 0.12)
                        ParticleFieldView(width: w, height: h, phase: phase,
                                          speedMultiplier: 0.5, cyan: cyan)
                            .opacity(particleOp)
                    }

                    // ── 9. HARDWARE TEXT STREAM (12-80%) — full boot only, ENHANCED ──
                    if p > 0.12 && !isWake {
                        BootDiagnosticStream(progress: p, store: store,
                                             cyan: cyan, cyanBright: cyanBright,
                                             amber: amber, crimson: crimson)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }

                    // ── 10. SIDE PANEL SLIDE-IN (70-90%) — earlier ──
                    if p > 0.70 {
                        let panelP = min(1.0, (p - 0.70) / 0.18)
                        BootPanelReveal(progress: panelP, width: w, height: h,
                                        cyan: cyan, cyanDim: cyanDim, steel: steel)
                    }

                    // ── 11. AWARENESS PULSE (90%) ──
                    if p > 0.90 && p < 0.97 {
                        let pulseP = (p - 0.90) / 0.07
                        BootAwarenessPulse(progress: pulseP, cx: cx, cy: cy,
                                           maxR: max(w, h) * 0.8, cyan: cyan)
                    }

                    // ── 12. "JARVIS ONLINE" (88-100%) — ENHANCED with scan reveal ──
                    if p > 0.88 {
                        let textOp = p < 0.95
                            ? min(1.0, (p - 0.88) / 0.04)
                            : max(0, 1.0 - (p - 0.97) / 0.03)
                        // Scan line reveal effect
                        let scanReveal = min(1.0, (p - 0.88) / 0.06)

                        ZStack {
                            Text("J A R V I S   O N L I N E")
                                .font(.custom("Menlo", size: 18)).tracking(12)
                                .foregroundColor(cyanBright.opacity(textOp * 0.95))
                                .shadow(color: cyan.opacity(textOp * 0.8), radius: 8)
                                .shadow(color: cyan.opacity(textOp * 0.4), radius: 20)
                                .shadow(color: cyan.opacity(textOp * 0.15), radius: 50)
                                .mask(
                                    Rectangle()
                                        .frame(width: 500 * scanReveal, height: 40)
                                )

                            // Scan line across text
                            if scanReveal < 1.0 {
                                Rectangle()
                                    .fill(Color.white.opacity(0.8 * (1.0 - scanReveal)))
                                    .frame(width: 2, height: 30)
                                    .offset(x: -250 + 500 * scanReveal)
                                    .shadow(color: cyan.opacity(0.6), radius: 8)
                            }
                        }
                        .position(x: cx, y: cy + R + 65)
                    }
                }
            }
        }
    }
}

// MARK: - Core Ignition — ENHANCED

/// Pulsing cyan core with VOLUMETRIC bloom — 30+ glow layers from a single pixel
struct BootCoreIgnition: View {
    let progress: Double
    let phase: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color, cyanBright: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let coreP = min(1.0, progress / 0.15)
            let pulse = 0.85 + sin(phase * 8.0) * 0.15

            // Ultra-wide ambient halo — visible from 2%
            for layer in 0..<Int(coreP * 8) {
                let lr = R * 0.10 + Double(layer) * R * 0.06
                let lo = 0.015 * pulse * coreP * (1.0 - Double(layer) / 8.0)
                let rect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(lo)))
            }

            // Layered cyan glow halos — expanding outward, MORE layers
            for layer in 0..<Int(coreP * 25) {
                let lr = 2.0 + Double(layer) * R * 0.010
                let lo = 0.25 * pulse * coreP * (1.0 - Double(layer) / 25.0)
                let rect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                let blend = Double(layer) / 25.0
                if blend > 0.5 {
                    ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(lo * 0.7)))
                } else {
                    ctx.fill(Path(ellipseIn: rect), with: .color(cyanBright.opacity(lo)))
                }
            }

            // Hot white-cyan core
            let hotR = (2.0 + coreP * R * 0.05) * pulse
            let hotRect = CGRect(x: c.x - hotR, y: c.y - hotR, width: hotR * 2, height: hotR * 2)
            ctx.fill(Path(ellipseIn: hotRect), with: .color(cyanBright.opacity(0.8 * coreP)))
            ctx.fill(Path(ellipseIn: hotRect), with: .color(Color.white.opacity(0.6 * coreP * pulse)))

            // Ignition flash at ~8% — ENHANCED bright white burst with cyan edge
            if progress > 0.05 && progress < 0.14 {
                let flash = 1.0 - abs(progress - 0.08) / 0.05
                let flashR = R * 0.22 * flash
                let fRect = CGRect(x: c.x - flashR, y: c.y - flashR, width: flashR * 2, height: flashR * 2)
                ctx.fill(Path(ellipseIn: fRect), with: .color(Color.white.opacity(0.6 * flash)))
                // Cyan outer ring
                let ringPath = Path { p in
                    p.addArc(center: c, radius: flashR * 1.4, startAngle: .zero,
                             endAngle: .radians(.pi * 2), clockwise: false)
                }
                ctx.stroke(ringPath, with: .color(cyan.opacity(0.5 * flash)),
                           style: StrokeStyle(lineWidth: 3))
                // Inner glow ring
                let innerRingPath = Path { p in
                    p.addArc(center: c, radius: flashR * 0.7, startAngle: .zero,
                             endAngle: .radians(.pi * 2), clockwise: false)
                }
                ctx.stroke(innerRingPath, with: .color(cyanBright.opacity(0.3 * flash)),
                           style: StrokeStyle(lineWidth: 2))

                // Radial light rays during flash
                for i in 0..<8 {
                    let rayAngle = Double(i) * (.pi / 4.0)
                    let rayStart = flashR * 0.5
                    let rayEnd = flashR * 2.5 * flash
                    let rayPath = Path { p in
                        p.move(to: CGPoint(x: c.x + cos(rayAngle) * rayStart, y: c.y + sin(rayAngle) * rayStart))
                        p.addLine(to: CGPoint(x: c.x + cos(rayAngle) * rayEnd, y: c.y + sin(rayAngle) * rayEnd))
                    }
                    ctx.stroke(rayPath, with: .color(cyan.opacity(0.2 * flash)),
                               style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                }
            }

            // Post-ignition: cardiac pulse emerges (15%+) — ENHANCED
            if progress > 0.15 {
                let cardiacP = min(1.0, (progress - 0.15) / 0.08)
                let beatCycle = phase * 1.5
                let beat = pow(max(0, sin(beatCycle)), 4.0)
                let coreGlow = R * 0.04 * (1.0 + beat * 0.4) * cardiacP
                let glowRect = CGRect(x: c.x - coreGlow, y: c.y - coreGlow,
                                      width: coreGlow * 2, height: coreGlow * 2)
                ctx.fill(Path(ellipseIn: glowRect), with: .color(cyanBright.opacity(0.85 * cardiacP)))
                ctx.fill(Path(ellipseIn: glowRect), with: .color(Color.white.opacity(0.5 * beat * cardiacP)))

                // Heartbeat ripple ring
                if beat > 0.5 {
                    let rippleR = coreGlow * 2.5 * beat
                    let ripplePath = Path { p in
                        p.addArc(center: c, radius: rippleR, startAngle: .zero,
                                 endAngle: .radians(.pi * 2), clockwise: false)
                    }
                    ctx.stroke(ripplePath, with: .color(cyan.opacity(0.12 * beat * cardiacP)),
                               style: StrokeStyle(lineWidth: 1.5))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Shockwave Ring — ENHANCED

/// Expanding ring of light — PARAMETRIC intensity for staggered multi-wave
struct BootShockwave: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, maxR: CGFloat
    let cyan: Color
    var intensity: Double = 1.0

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let r = progress * maxR * 0.8
            let opacity = (1.0 - progress) * 0.50 * intensity
            let width = 2.0 + progress * 6.0

            // Main cyan ring
            let path = Path { p in
                p.addArc(center: c, radius: r, startAngle: .zero,
                         endAngle: .radians(.pi * 2), clockwise: false)
            }
            ctx.stroke(path, with: .color(cyan.opacity(opacity)),
                       style: StrokeStyle(lineWidth: width))

            // Inner white highlight — brighter
            ctx.stroke(path, with: .color(Color.white.opacity(opacity * 0.4)),
                       style: StrokeStyle(lineWidth: width * 0.35))

            // Bloom glow — wider
            ctx.stroke(path, with: .color(cyan.opacity(opacity * 0.15)),
                       style: StrokeStyle(lineWidth: width * 5))

            // Trailing glow — extended
            if progress < 0.7 {
                let trailR = r * 0.90
                let trailPath = Path { p in
                    p.addArc(center: c, radius: trailR, startAngle: .zero,
                             endAngle: .radians(.pi * 2), clockwise: false)
                }
                ctx.stroke(trailPath, with: .color(cyan.opacity(opacity * 0.12)),
                           style: StrokeStyle(lineWidth: width * 6))
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Energy Cascade — NEW

/// Visible energy flowing from core outward to ring positions during boot
struct BootEnergyCascade: View {
    let progress: Double
    let phase: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let cascadeP = min(1.0, (progress - 0.12) / 0.40)
            let rayCount = 12

            for i in 0..<rayCount {
                let angle = Double(i) / Double(rayCount) * .pi * 2.0
                // Energy pulse travels outward
                let pulseSpeed = 0.8 + sin(Double(i) * 1.7) * 0.3
                let pulseCycle = (phase * pulseSpeed + Double(i) * 0.5).truncatingRemainder(dividingBy: 2.0)
                let pulseT = pulseCycle / 2.0  // 0-1

                let innerR = R * 0.06
                let outerR = R * (0.15 + cascadeP * 0.85)
                let currentR = innerR + (outerR - innerR) * pulseT

                // Bright dot traveling outward
                let dotX = c.x + cos(angle) * currentR
                let dotY = c.y + sin(angle) * currentR

                let fadeIn = min(1.0, pulseT * 4)
                let fadeOut = min(1.0, (1.0 - pulseT) * 3)
                let dotOp = fadeIn * fadeOut * 0.35 * cascadeP

                let dotSz = 2.0 + (1.0 - pulseT) * 2.0
                let dotRect = CGRect(x: dotX - dotSz / 2, y: dotY - dotSz / 2, width: dotSz, height: dotSz)
                ctx.fill(Path(ellipseIn: dotRect), with: .color(cyan.opacity(dotOp)))

                // Glow behind dot
                let glowRect = CGRect(x: dotX - dotSz * 2, y: dotY - dotSz * 2, width: dotSz * 4, height: dotSz * 4)
                ctx.fill(Path(ellipseIn: glowRect), with: .color(cyan.opacity(dotOp * 0.3)))

                // Faint line from core to current position
                let linePath = Path { p in
                    p.move(to: CGPoint(x: c.x + cos(angle) * innerR, y: c.y + sin(angle) * innerR))
                    p.addLine(to: CGPoint(x: dotX, y: dotY))
                }
                ctx.stroke(linePath, with: .color(cyan.opacity(dotOp * 0.15)),
                           style: StrokeStyle(lineWidth: 0.5))
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Reactor Rings Materialization

/// Rings materializing in staggered arc-cluster order — R9 spec.
/// Clusters map to logical HUD zones: E-Core (inner) → P-Core → GPU → structural.
/// Each cluster fades in over a bootProgress span of bootClusterFadeSpan.
/// Only active on the full-boot path (progress driven at 8s pace).
struct BootReactorRings: View {
    let progress: Double
    let phase: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color, cyanDim: Color, steel: Color

    /// Returns a local 0→1 progress for a cluster that starts at `threshold`.
    private func clusterProgress(_ threshold: Double) -> Double {
        let span = JARVISNominalState.bootClusterFadeSpan
        return max(0.0, min(1.0, (progress - threshold) / span))
    }

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let pi2 = Double.pi * 2.0

            // ── Cluster local progress values ────────────────────────────────
            // E-Core zone  : frac 0.00–0.30 (inner rings, ~0.06–0.35R) — threshold 0.25
            // P-Core zone  : frac 0.30–0.55 (~0.35–0.56R)              — threshold 0.45
            // GPU arc zone : frac 0.55–0.75 (~0.56–0.78R)              — threshold 0.60
            // Rings zone   : frac 0.75–1.00 (~0.78–0.97R outer)        — threshold 0.75
            let eCoreP   = clusterProgress(JARVISNominalState.bootClusterECore)
            let pCoreP   = clusterProgress(JARVISNominalState.bootClusterPCore)
            let gpuArcP  = clusterProgress(JARVISNominalState.bootClusterGPUArc)
            let ringsP   = clusterProgress(JARVISNominalState.bootClusterRings)

            // Total ring count — same as before so geometry is unchanged
            let totalRings = 220

            for i in 0..<totalRings {
                let frac = Double(i) / Double(totalRings)

                // ── Assign ring to cluster by radial fraction ────────────────
                let clusterLocalP: Double
                if frac < 0.30 {
                    clusterLocalP = eCoreP
                } else if frac < 0.55 {
                    clusterLocalP = pCoreP
                } else if frac < 0.75 {
                    clusterLocalP = gpuArcP
                } else {
                    clusterLocalP = ringsP
                }
                guard clusterLocalP > 0 else { continue }

                // Within-cluster stagger: rings in each cluster appear
                // sequentially from inner to outer over the cluster's 0→1 window.
                // clusterFracCount = normalised position within cluster band
                let bandStart: Double = frac < 0.30 ? 0.00
                              : frac < 0.55 ? 0.30
                              : frac < 0.75 ? 0.55 : 0.75
                let bandEnd:   Double = frac < 0.30 ? 0.30
                              : frac < 0.55 ? 0.55
                              : frac < 0.75 ? 0.75 : 1.00
                let bandWidth = bandEnd - bandStart
                let posInBand = bandWidth > 0 ? (frac - bandStart) / bandWidth : 0
                let ringBirth = posInBand          // 0→1 within cluster
                let ringAge   = clusterLocalP - ringBirth
                guard ringAge > 0 else { continue }
                let ringOp = min(1.0, ringAge * 8)

                let r = R * (0.06 + frac * 0.91)
                let rotSpeed = 0.02 + frac * 0.05
                let altDir: Double = i % 2 == 0 ? 1.0 : -1.0
                let rotAngle = phase * rotSpeed * altDir * min(1.0, ringAge * 3)

                let distFromCenter = 1.0 - frac
                let baseOp = (0.15 + distFromCenter * 0.25) * ringOp
                let m = i % 18

                // Structural rings (every 18th) are brighter with CYAN BLOOM
                if m == 0 {
                    let path = Path { p in
                        p.addArc(center: c, radius: r,
                                 startAngle: .radians(rotAngle),
                                 endAngle: .radians(rotAngle + pi2), clockwise: false)
                    }
                    ctx.stroke(path, with: .color(cyan.opacity(min(baseOp * 0.15, 0.08))),
                               style: StrokeStyle(lineWidth: 12))
                    ctx.stroke(path, with: .color(steel.opacity(min(baseOp + 0.18, 0.50))),
                               style: StrokeStyle(lineWidth: 2.5))
                    ctx.stroke(path, with: .color(Color.white.opacity(min(baseOp * 0.2, 0.15))),
                               style: StrokeStyle(lineWidth: 0.5))
                } else if m == 3 || m == 12 {
                    let path = Path { p in
                        p.addArc(center: c, radius: r,
                                 startAngle: .radians(rotAngle),
                                 endAngle: .radians(rotAngle + pi2), clockwise: false)
                    }
                    ctx.stroke(path, with: .color(cyan.opacity(baseOp * 0.08)),
                               style: StrokeStyle(lineWidth: 8))
                    ctx.stroke(path, with: .color(steel.opacity(baseOp * 1.2)),
                               style: StrokeStyle(lineWidth: 1.8))
                } else {
                    let path = Path { p in
                        p.addArc(center: c, radius: r,
                                 startAngle: .radians(rotAngle),
                                 endAngle: .radians(rotAngle + pi2), clockwise: false)
                    }
                    ctx.stroke(path, with: .color(cyanDim.opacity(baseOp * 0.55)),
                               style: StrokeStyle(lineWidth: 0.5))
                }

                // Particle spark trail on newly appearing rings
                if ringAge > 0 && ringAge < 0.06 {
                    let sparkOp = (1.0 - ringAge / 0.06) * 0.8
                    let sparkAngle = rotAngle + ringAge * 18.0
                    let sx = c.x + r * cos(sparkAngle)
                    let sy = c.y + r * sin(sparkAngle)
                    let sparkSize = 2.5 + (1.0 - ringAge / 0.06) * 4.0
                    let glowRect = CGRect(x: sx - sparkSize * 2, y: sy - sparkSize * 2,
                                          width: sparkSize * 4, height: sparkSize * 4)
                    ctx.fill(Path(ellipseIn: glowRect), with: .color(cyan.opacity(sparkOp * 0.3)))
                    let sRect = CGRect(x: sx - sparkSize/2, y: sy - sparkSize/2,
                                       width: sparkSize, height: sparkSize)
                    ctx.fill(Path(ellipseIn: sRect), with: .color(cyan.opacity(sparkOp)))
                    ctx.fill(Path(ellipseIn: sRect), with: .color(Color.white.opacity(sparkOp * 0.4)))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Structural Elements

/// Bezels, tick marks, and spokes — ENHANCED with bloom
struct BootStructuralElements: View {
    let progress: Double
    let phase: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let steel: Color, cyan: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let fadeIn = min(1.0, (progress - 0.50) / 0.12)

            // Outer bezel ring — with cyan bloom
            let bezelR = R * 0.96
            let bezelPath = Path { p in
                p.addArc(center: c, radius: bezelR, startAngle: .zero,
                         endAngle: .radians(.pi * 2), clockwise: false)
            }
            ctx.stroke(bezelPath, with: .color(cyan.opacity(0.06 * fadeIn)),
                       style: StrokeStyle(lineWidth: 14))
            ctx.stroke(bezelPath, with: .color(steel.opacity(0.40 * fadeIn)),
                       style: StrokeStyle(lineWidth: 2.5))

            // Degree tick marks — cyan tinted
            let tickCount = 72
            for i in 0..<tickCount {
                let angle = Double(i) / Double(tickCount) * .pi * 2.0 - .pi / 2.0
                let isMajor = i % 9 == 0
                let innerR = bezelR - (isMajor ? 14.0 : 7.0)
                let outerR = bezelR + 2.0

                let p1 = CGPoint(x: c.x + innerR * cos(angle), y: c.y + innerR * sin(angle))
                let p2 = CGPoint(x: c.x + outerR * cos(angle), y: c.y + outerR * sin(angle))
                let tickPath = Path { p in p.move(to: p1); p.addLine(to: p2) }

                let tickColor = isMajor ? cyan : steel
                let tickOp = (isMajor ? 0.50 : 0.25) * fadeIn
                ctx.stroke(tickPath, with: .color(tickColor.opacity(tickOp)),
                           style: StrokeStyle(lineWidth: isMajor ? 1.8 : 0.8))
            }

            // Structural spokes (4 cardinal + 4 diagonal) — ENHANCED
            for i in 0..<8 {
                let angle = Double(i) * .pi / 4.0
                let innerR = R * 0.10
                let outerR = R * 0.94
                let p1 = CGPoint(x: c.x + innerR * cos(angle), y: c.y + innerR * sin(angle))
                let p2 = CGPoint(x: c.x + outerR * cos(angle), y: c.y + outerR * sin(angle))
                let spokePath = Path { p in p.move(to: p1); p.addLine(to: p2) }
                let isCardinal = i % 2 == 0
                let spokeOp = (isCardinal ? 0.10 : 0.05) * fadeIn
                ctx.stroke(spokePath, with: .color(cyan.opacity(spokeOp * 0.3)),
                           style: StrokeStyle(lineWidth: 4))
                ctx.stroke(spokePath, with: .color(steel.opacity(spokeOp)),
                           style: StrokeStyle(lineWidth: 0.5))
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Data Arcs

/// Core utilization arcs flash on with a brief over-bright then settle
struct BootDataArcs: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let store: TelemetryStore
    let cyan: Color, amber: Color, crimson: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let pi2 = Double.pi * 2.0
            let top = -Double.pi / 2.0

            // E-Cores — cyan (40%+)
            let eCores = store.eCoreUsages.isEmpty
                ? Array(repeating: 0.5, count: max(store.eCoreCount, 10))
                : store.eCoreUsages
            if !eCores.isEmpty {
                let eAge = min(1.0, (progress - 0.40) / 0.06)
                let eFlash = eAge < 0.3 ? 1.8 : 1.0  // brighter flash
                drawArcs(ctx: ctx, c: c, usages: eCores, r: R * 0.845,
                         lineW: 3, color: cyan, opacity: eAge * eFlash,
                         top: top, pi2: pi2)
            }

            // P-Cores — amber (45%+)
            if progress > 0.45 {
                let pCores = store.pCoreUsages.isEmpty
                    ? Array(repeating: 0.5, count: max(store.pCoreCount, 4))
                    : store.pCoreUsages
                let pAge = min(1.0, (progress - 0.45) / 0.06)
                let pFlash = pAge < 0.3 ? 1.8 : 1.0
                drawArcs(ctx: ctx, c: c, usages: pCores, r: R * 0.745,
                         lineW: 3, color: amber, opacity: pAge * pFlash,
                         top: top, pi2: pi2)
            }

            // S-Cores — crimson (50%+)
            if progress > 0.50 {
                let sCores = store.sCoreUsages.isEmpty
                    ? Array(repeating: 0.3, count: max(store.sCoreCount, 1))
                    : store.sCoreUsages
                let sAge = min(1.0, (progress - 0.50) / 0.06)
                let sFlash = sAge < 0.3 ? 1.8 : 1.0
                drawArcs(ctx: ctx, c: c, usages: sCores, r: R * 0.645,
                         lineW: 2.5, color: crimson, opacity: sAge * sFlash,
                         top: top, pi2: pi2)
            }

            // GPU arc — cyan outer sweep (50%+)
            if progress > 0.50 {
                let gAge = min(1.0, (progress - 0.50) / 0.06)
                let gpu = store.gpuUsage > 0 ? store.gpuUsage : 0.4
                let gS = -Double.pi * 0.75
                let gE = gS + Double.pi * 1.5 * gpu
                let gPath = Path { p in
                    p.addArc(center: c, radius: R * 0.915,
                             startAngle: .radians(gS), endAngle: .radians(gE), clockwise: false)
                }
                // Bloom glow — ENHANCED
                ctx.stroke(gPath, with: .color(cyan.opacity(0.04 * gAge)),
                           style: StrokeStyle(lineWidth: 20, lineCap: .round))
                ctx.stroke(gPath, with: .color(cyan.opacity(0.15 * gAge)),
                           style: StrokeStyle(lineWidth: 8, lineCap: .round))
                ctx.stroke(gPath, with: .color(cyan.opacity(0.70 * gAge)),
                           style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
            }
        }
        .allowsHitTesting(false)
    }

    private func drawArcs(ctx: GraphicsContext, c: CGPoint, usages: [Double],
                          r: Double, lineW: Double, color: Color, opacity: Double,
                          top: Double, pi2: Double) {
        let n = usages.count
        guard n > 0 else { return }
        let sw = pi2 / Double(n)
        let gap = sw * 0.06

        for (i, u) in usages.enumerated() {
            let s0 = top + sw * Double(i) + gap / 2
            let fe = s0 + (sw - gap) * max(u, 0.05)
            let fp = Path { p in
                p.addArc(center: c, radius: r,
                         startAngle: .radians(s0), endAngle: .radians(fe), clockwise: false)
            }
            // Bloom glow — ENHANCED
            ctx.stroke(fp, with: .color(color.opacity(0.04 * opacity)),
                       style: StrokeStyle(lineWidth: lineW * 8, lineCap: .round))
            ctx.stroke(fp, with: .color(color.opacity(0.12 * opacity)),
                       style: StrokeStyle(lineWidth: lineW * 4, lineCap: .round))
            ctx.stroke(fp, with: .color(color.opacity(0.70 * opacity)),
                       style: StrokeStyle(lineWidth: lineW, lineCap: .round))
            // White-hot center
            ctx.stroke(fp, with: .color(Color.white.opacity(0.25 * opacity)),
                       style: StrokeStyle(lineWidth: lineW * 0.3, lineCap: .round))
        }
    }
}

// MARK: - Awareness Pulse

/// Single sonar-ping ripple at 90% boot — "the HUD is alive"
struct BootAwarenessPulse: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, maxR: CGFloat
    let cyan: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let r = progress * maxR
            let op = (1.0 - progress) * 0.35

            // Main pulse ring
            let path = Path { p in
                p.addArc(center: c, radius: r, startAngle: .zero,
                         endAngle: .radians(.pi * 2), clockwise: false)
            }
            ctx.stroke(path, with: .color(cyan.opacity(op)),
                       style: StrokeStyle(lineWidth: 5))
            // Inner white highlight
            ctx.stroke(path, with: .color(Color.white.opacity(op * 0.3)),
                       style: StrokeStyle(lineWidth: 1.5))
            // Wide bloom
            ctx.stroke(path, with: .color(cyan.opacity(op * 0.12)),
                       style: StrokeStyle(lineWidth: 20))
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Side Panel Reveal

/// Left and right panels slide in with holographic border glow
struct BootPanelReveal: View {
    let progress: Double
    let width: CGFloat, height: CGFloat
    let cyan: Color, cyanDim: Color, steel: Color

    var body: some View {
        let easeP = 1.0 - pow(1.0 - progress, 3)
        let offset = (1.0 - easeP) * 300

        // Left panel zone — wider, with cyan border
        RoundedRectangle(cornerRadius: 4)
            .stroke(cyan.opacity(0.30 * easeP), lineWidth: 0.8)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.black.opacity(0.35 * easeP))
            )
            .frame(width: width * 0.15, height: height * 0.50)
            .overlay(
                RoundedRectangle(cornerRadius: 3)
                    .stroke(cyanDim.opacity(0.12 * easeP), lineWidth: 0.4)
                    .padding(3)
            )
            .position(x: width * 0.09 - offset, y: height * 0.45)
            .opacity(easeP)

        // Right panel zone — wider
        RoundedRectangle(cornerRadius: 4)
            .stroke(cyan.opacity(0.30 * easeP), lineWidth: 0.8)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.black.opacity(0.35 * easeP))
            )
            .frame(width: width * 0.16, height: height * 0.50)
            .overlay(
                RoundedRectangle(cornerRadius: 3)
                    .stroke(cyanDim.opacity(0.12 * easeP), lineWidth: 0.4)
                    .padding(3)
            )
            .position(x: width * 0.93 + offset, y: height * 0.45)
            .opacity(easeP)

        // Top bar slides down
        Rectangle()
            .fill(Color.black.opacity(0.25 * easeP))
            .frame(height: 36)
            .overlay(
                Rectangle().fill(cyan.opacity(0.18 * easeP)).frame(height: 0.5),
                alignment: .bottom
            )
            .position(x: width / 2, y: 18 - (1.0 - easeP) * 60)
            .opacity(easeP)
    }
}

// MARK: - Diagnostic Text Stream — ENHANCED

/// Hardware enumeration text — color-coded, with holographic scan-reveal
struct BootDiagnosticStream: View {
    let progress: Double
    let store: TelemetryStore
    let cyan: Color, cyanBright: Color, amber: Color, crimson: Color

    private var lines: [(text: String, color: Color, threshold: Double)] {
        let chip = store.chipName.isEmpty || store.chipName == JARVISNominalState.chipNameDefault
            ? "CHIP: READING..." : store.chipName.uppercased()
        let eCt = store.eCoreCount > 0 ? store.eCoreCount : 10
        let pCt = store.pCoreCount > 0 ? store.pCoreCount : 4
        let sCt = store.sCoreCount > 0 ? store.sCoreCount : 1
        let gpuCt = store.gpuCoreCount > 0 ? store.gpuCoreCount : 40
        let memGB = store.memoryTotalGB > 0 ? Int(store.memoryTotalGB) : 128

        return [
            ("INITIALIZING JARVIS NEURAL INTERFACE v3.1", cyan, 0.12),
            ("SCANNING SILICON TOPOLOGY...", cyan, 0.16),
            ("\(chip) DETECTED", cyanBright, 0.22),
            ("CORE CLUSTER 0: \(eCt)x EFFICIENCY \u{2014} ONLINE", cyan, 0.30),
            ("CORE CLUSTER 1: \(pCt)x PERFORMANCE \u{2014} ONLINE", amber, 0.35),
            ("CORE CLUSTER 2: \(sCt)x STORM \u{2014} ONLINE", crimson, 0.40),
            ("GPU COMPLEX: \(gpuCt)-CORE \u{2014} ONLINE", cyan, 0.45),
            ("UNIFIED MEMORY: \(memGB)GB \u{2014} MAPPED", cyanBright, 0.50),
            ("THERMAL ENVELOPE: NOMINAL", cyan, 0.55),
            ("CONFIGURING TELEMETRY STREAM...", cyan, 0.60),
            ("TELEMETRY ACTIVE \u{2014} 1Hz REFRESH", cyanBright, 0.65),
            ("ALL SYSTEMS NOMINAL", cyanBright, 0.72),
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Spacer()

            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                if progress >= line.threshold {
                    let age = progress - line.threshold
                    let opacity = min(1.0, age / 0.02)
                    let charsToShow = min(line.text.count, Int(age * 800))
                    let displayText = String(line.text.prefix(charsToShow))

                    HStack(spacing: 6) {
                        // Status indicator dot
                        Circle()
                            .fill(line.color.opacity(opacity * 0.8))
                            .frame(width: 4, height: 4)
                            .shadow(color: line.color.opacity(opacity * 0.4), radius: 3)

                        Text(displayText)
                            .font(.custom("Menlo", size: 10)).tracking(2)
                            .foregroundColor(line.color.opacity(opacity * 0.75))
                            .shadow(color: line.color.opacity(opacity * 0.35), radius: 5)
                    }
                }
            }

            Spacer().frame(height: 55)
        }
        .padding(.leading, 45)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
