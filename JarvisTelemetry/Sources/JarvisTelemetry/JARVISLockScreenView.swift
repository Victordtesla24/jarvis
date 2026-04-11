// File: Sources/JarvisTelemetry/JARVISLockScreenView.swift
// JARVIS Lock Screen — animated overlay when system session resigns.
// Subdued reactor at 60% scale, scan lines, lock status text.
// Ref: R-04

import SwiftUI
import AppKit

/// Lock screen view with subdued reactor and authentication status
struct JARVISLockScreenView: View {

    @EnvironmentObject var reactorController: ReactorAnimationController
    @EnvironmentObject var phaseController: HUDPhaseController

    @State private var scanLineOffset: CGFloat = 0
    @State private var unlockProgress: Double = 0
    @State private var isUnlocking: Bool = false
    @State private var wrongAuthFlash: Bool = false

    private let cyan      = Color(red: JARVISNominalState.primaryCyan.r,
                                   green: JARVISNominalState.primaryCyan.g,
                                   blue: JARVISNominalState.primaryCyan.b)
    private let cyanBright = Color(red: JARVISNominalState.brightCyan.r,
                                    green: JARVISNominalState.brightCyan.g,
                                    blue: JARVISNominalState.brightCyan.b)
    private let lockText   = Color(red: JARVISNominalState.lockTextCyan.r,
                                    green: JARVISNominalState.lockTextCyan.g,
                                    blue: JARVISNominalState.lockTextCyan.b,
                                    opacity: JARVISNominalState.lockTextCyan.a)

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let cx = w / 2
            let cy = h / 2
            let R = min(w, h) * 0.42

            TimelineView(.animation(minimumInterval: 1.0/60.0)) { timeline in
                let phase = timeline.date.timeIntervalSinceReferenceDate

                ZStack {
                    // ── Background: Black with slight transparency ──
                    Color.black.opacity(0.92)
                        .ignoresSafeArea()

                    // ── Scan Line Overlay ──
                    LockScanLines(phase: phase, width: w, height: h, cyan: cyan)

                    // ── Subdued Reactor Core ──
                    LockReactorCore(
                        phase: phase, cx: cx, cy: cy, R: R,
                        bloomIntensity: reactorController.bloomIntensity,
                        wrongAuthFlash: wrongAuthFlash,
                        cyan: cyan, cyanBright: cyanBright
                    )
                    .scaleEffect(isUnlocking
                        ? 1.0
                        : JARVISNominalState.lockScreenReactorScale)
                    .animation(.spring(response: 0.8, dampingFraction: 0.6), value: isUnlocking)

                    // ── Subdued Rings ──
                    LockRings(
                        phase: phase, cx: cx, cy: cy, R: R,
                        speedFraction: JARVISNominalState.lockScreenRingSpeedFraction,
                        cyan: cyan
                    )
                    .scaleEffect(isUnlocking
                        ? 1.0
                        : JARVISNominalState.lockScreenReactorScale)
                    .animation(.spring(response: 0.8, dampingFraction: 0.6), value: isUnlocking)

                    // ══════════════════════════════════════════════════════════
                    //  R-03 · LOCK SCREEN CINEMATIC ANIMATIONS
                    //  Three layered animation effects inspired by the three
                    //  reference images:
                    //    1. ParticleWireframeSphere  — translucent sphere with
                    //       latitude/longitude mesh, wavy perturbed rings, and
                    //       particle cloud. Sits at reactor centre, scales with
                    //       lock screen.
                    //    2. RadialTextMenu           — 16 rotating text labels
                    //       around the sphere with a bright inner cyan ring.
                    //    3. MonochromeArrowsOverlay  — two directional arrow
                    //       triangles at R × 0.95 pulsing white.
                    // ══════════════════════════════════════════════════════════

                    ParticleWireframeSphere(
                        phase: phase, cx: cx, cy: cy,
                        sphereRadius: R * 0.36,
                        cyan: cyan, cyanBright: cyanBright
                    )
                    .scaleEffect(isUnlocking ? 1.0 : JARVISNominalState.lockScreenReactorScale)
                    .animation(.spring(response: 0.8, dampingFraction: 0.6), value: isUnlocking)

                    RadialTextMenu(
                        phase: phase, cx: cx, cy: cy,
                        radius: R * 0.58,
                        cyan: cyan, cyanBright: cyanBright
                    )
                    .scaleEffect(isUnlocking ? 1.0 : JARVISNominalState.lockScreenReactorScale)
                    .animation(.spring(response: 0.8, dampingFraction: 0.6), value: isUnlocking)

                    MonochromeArrowsOverlay(
                        phase: phase, cx: cx, cy: cy, R: R * 0.75
                    )
                    .scaleEffect(isUnlocking ? 1.0 : JARVISNominalState.lockScreenReactorScale)
                    .animation(.spring(response: 0.8, dampingFraction: 0.6), value: isUnlocking)

                    // ── Lock Status Text ──
                    if !isUnlocking {
                        VStack(spacing: 8) {
                            Text("SYSTEM LOCKED · AUTHENTICATION REQUIRED")
                                .font(.custom("Menlo", size: 14))
                                .tracking(3.6)
                                .foregroundColor(lockText)
                                .shadow(color: cyan.opacity(0.4), radius: 8)
                                .shadow(color: cyan.opacity(0.15), radius: 24)
                        }
                        .position(x: cx, y: cy + R * JARVISNominalState.lockScreenReactorScale + 120)
                        .transition(.opacity)
                    }

                    // ── Unlock Text ──
                    if isUnlocking {
                        Text("IDENTITY CONFIRMED · WELCOME BACK")
                            .font(.custom("Menlo", size: 14))
                            .tracking(3.6)
                            .foregroundColor(cyanBright.opacity(min(1.0, unlockProgress * 2)))
                            .shadow(color: cyan.opacity(0.6), radius: 12)
                            .position(x: cx, y: cy + R + 80)
                            .transition(.opacity)
                    }
                }
            }
        }
        .onAppear {
            reactorController.enterLockMode()
        }
    }

    /// Called when unlock is confirmed (session becomes active)
    func performUnlock() {
        isUnlocking = true
        let start = Date()
        let duration = JARVISNominalState.unlockDuration

        Timer.scheduledTimer(withTimeInterval: 1.0/60.0, repeats: true) { timer in
            let elapsed = Date().timeIntervalSince(start)
            unlockProgress = min(elapsed / duration, 1.0)
            if unlockProgress >= 1.0 {
                timer.invalidate()
                reactorController.returnToNominal()
            }
        }
    }

    /// Called on wrong authentication attempt
    func performWrongAuth() {
        wrongAuthFlash = true
        reactorController.triggerWrongAuth()

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            wrongAuthFlash = false
        }
    }
}

// MARK: - Lock Screen Sub-Components

/// Horizontal scan lines scrolling downward at 12pt/sec
struct LockScanLines: View {
    let phase: Double
    let width: CGFloat
    let height: CGFloat
    let cyan: Color

    var body: some View {
        Canvas { ctx, size in
            let lineSpacing: CGFloat = 6  // 2px line + 4px gap
            let scrollOffset = CGFloat(phase * 12.0).truncatingRemainder(dividingBy: lineSpacing)
            let lineCount = Int(height / lineSpacing) + 2

            for i in 0..<lineCount {
                let y = CGFloat(i) * lineSpacing + scrollOffset
                guard y >= 0 && y < height else { continue }
                let rect = CGRect(x: 0, y: y, width: width, height: 2)
                ctx.fill(Path(rect), with: .color(cyan.opacity(0.04)))
            }
        }
        .allowsHitTesting(false)
    }
}

/// Subdued reactor core with bloom for lock screen
struct LockReactorCore: View {
    let phase: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let bloomIntensity: CGFloat
    let wrongAuthFlash: Bool
    let cyan: Color, cyanBright: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)

            // Determine bloom color — red during wrong auth flash
            let bloomColor = wrongAuthFlash
                ? Color(red: 1.0, green: 0.1, blue: 0.1)
                : cyan

            let slowPulse = 0.9 + sin(phase * 1.2) * 0.1  // Subdued pulse

            // Volumetric glow layers
            for layer in 0..<Int(bloomIntensity * 20) {
                let lr = R * 0.01 + Double(layer) * R * 0.015
                let falloff = 1.0 - Double(layer) / 20.0
                let lo = (0.20 * falloff * falloff) * Double(bloomIntensity) * slowPulse
                guard lo > 0.005 else { continue }
                let rect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                ctx.fill(Path(ellipseIn: rect), with: .color(bloomColor.opacity(lo)))
            }

            // Hot core center
            let hotR = R * 0.03 * Double(bloomIntensity) * slowPulse
            let hotRect = CGRect(x: c.x - hotR, y: c.y - hotR, width: hotR * 2, height: hotR * 2)
            ctx.fill(Path(ellipseIn: hotRect), with: .color(cyanBright.opacity(0.6 * Double(bloomIntensity))))
            ctx.fill(Path(ellipseIn: hotRect), with: .color(Color.white.opacity(0.3 * Double(bloomIntensity) * slowPulse)))
        }
        .allowsHitTesting(false)
    }
}

/// Subdued rotating rings for lock screen
struct LockRings: View {
    let phase: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let speedFraction: Double
    let cyan: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let pi2 = Double.pi * 2.0

            // Draw a subset of rings at reduced speed and opacity
            for i in stride(from: 0, to: 220, by: 6) {
                let frac = Double(i) / 220.0
                let r = R * (0.06 + frac * 0.91)

                let rotSpeed = (0.02 + frac * 0.05) * speedFraction
                let altDir: Double = i % 2 == 0 ? 1.0 : -1.0
                let rotAngle = phase * rotSpeed * altDir

                let baseOp = (0.06 + (1.0 - frac) * 0.08)

                let path = Path { p in
                    p.addArc(center: c, radius: r,
                             startAngle: .radians(rotAngle),
                             endAngle: .radians(rotAngle + pi2), clockwise: false)
                }

                let isStructural = i % 18 == 0
                if isStructural {
                    ctx.stroke(path, with: .color(cyan.opacity(baseOp * 0.6)),
                               style: StrokeStyle(lineWidth: 1.5))
                } else {
                    ctx.stroke(path, with: .color(cyan.opacity(baseOp * 0.3)),
                               style: StrokeStyle(lineWidth: 0.4))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - R-03 · Lock Screen Cinematic Animations

/// Radial menu of rotating text labels with a bright inner cyan core ring.
/// Inspired by the Image #4 reference — "Debug / Email / Settings / Customize /
/// Music / Alarm / SMS / Info / Keyboard / Gaming / None ×4 / Test Alarm /
/// Emulate" arranged around a glowing cyan annulus, counter-rotating slowly.
struct RadialTextMenu: View {
    let phase: Double
    let cx: CGFloat
    let cy: CGFloat
    let radius: CGFloat
    let cyan: Color
    let cyanBright: Color

    private let labels = [
        "Debug", "Email", "Settings", "Customize",
        "Music", "Alarm", "SMS", "Info",
        "Keyboard", "Gaming", "None", "None",
        "Test Alarm", "Emulate", "None", "None"
    ]

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let pi2 = Double.pi * 2.0
            let n = labels.count
            let rotationRate: Double = 0.04   // ~2.3 deg/sec counter-clockwise
            let baseRot = -phase * rotationRate

            // Bright inner cyan ring (the Image #4 "core ring")
            let innerR = radius * 0.72
            let innerPath = Path { p in
                p.addArc(center: c, radius: innerR,
                         startAngle: .zero, endAngle: .radians(pi2),
                         clockwise: false)
            }
            ctx.stroke(innerPath, with: .color(cyan.opacity(0.10)), style: StrokeStyle(lineWidth: 22))
            ctx.stroke(innerPath, with: .color(cyan.opacity(0.25)), style: StrokeStyle(lineWidth: 12))
            ctx.stroke(innerPath, with: .color(cyan.opacity(0.75)), style: StrokeStyle(lineWidth: 4))
            ctx.stroke(innerPath, with: .color(cyanBright),         style: StrokeStyle(lineWidth: 1.5))

            // Outer structural ring for the menu boundary
            let outerR = radius + 26
            let outerPath = Path { p in
                p.addArc(center: c, radius: outerR,
                         startAngle: .zero, endAngle: .radians(pi2),
                         clockwise: false)
            }
            ctx.stroke(outerPath, with: .color(cyan.opacity(0.22)), style: StrokeStyle(lineWidth: 1.2))

            // Dashed mid ring between labels and inner core
            let dashPath = Path { p in
                p.addArc(center: c, radius: radius - 8,
                         startAngle: .zero, endAngle: .radians(pi2),
                         clockwise: false)
            }
            ctx.stroke(dashPath,
                       with: .color(cyanBright.opacity(0.35)),
                       style: StrokeStyle(lineWidth: 0.8, dash: [6, 4]))

            // Radial tick marks between each label
            for i in 0..<n {
                let angle = (Double(i) / Double(n)) * pi2 + baseRot - .pi / 2
                let tickInner = CGPoint(
                    x: c.x + cos(angle) * (radius + 10),
                    y: c.y + sin(angle) * (radius + 10)
                )
                let tickOuter = CGPoint(
                    x: c.x + cos(angle) * (radius + 24),
                    y: c.y + sin(angle) * (radius + 24)
                )
                let tp = Path { p in p.move(to: tickInner); p.addLine(to: tickOuter) }
                ctx.stroke(tp, with: .color(cyan.opacity(0.55)), style: StrokeStyle(lineWidth: 1.0))
            }

            // Labels — placed at slot angles. SwiftUI Canvas can't rotate text
            // in-place, but at this radius with a slow rotation the labels
            // still read naturally as they orbit. Label angle offsets the
            // slot index by 0.5 so labels sit BETWEEN ticks, matching the
            // reference layout.
            for (i, label) in labels.enumerated() {
                let angle = ((Double(i) + 0.5) / Double(n)) * pi2 + baseRot - .pi / 2
                let lx = c.x + cos(angle) * radius
                let ly = c.y + sin(angle) * radius
                ctx.draw(
                    Text(label)
                        .font(.custom("Menlo", size: 10).weight(.medium))
                        .foregroundColor(cyanBright.opacity(0.88)),
                    at: CGPoint(x: lx, y: ly)
                )
            }
        }
        .allowsHitTesting(false)
    }
}

/// Translucent wireframe sphere with wavy perturbed outer rings and a
/// particle cloud. Inspired by the Image #5 reference. Drawn as latitude
/// and longitude great-circle approximations plus 4 wavy concentric rings
/// and a fixed-seed 120-particle halo that orbits slowly.
struct ParticleWireframeSphere: View {
    let phase: Double
    let cx: CGFloat
    let cy: CGFloat
    let sphereRadius: CGFloat
    let cyan: Color
    let cyanBright: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let pi2 = Double.pi * 2.0

            // Outer volumetric glow
            let glowRect = CGRect(
                x: c.x - sphereRadius * 2.4, y: c.y - sphereRadius * 2.4,
                width: sphereRadius * 4.8, height: sphereRadius * 4.8
            )
            ctx.fill(Path(ellipseIn: glowRect), with: .radialGradient(
                Gradient(colors: [
                    cyan.opacity(0.14),
                    cyan.opacity(0.06),
                    cyan.opacity(0.02),
                    Color.clear
                ]),
                center: c, startRadius: sphereRadius * 0.5, endRadius: sphereRadius * 2.4
            ))

            // Wavy perturbed concentric rings (the undulating energy band)
            for ringIdx in 0..<4 {
                let baseR = sphereRadius * (1.25 + Double(ringIdx) * 0.13)
                let wavePhase = phase * (0.4 + Double(ringIdx) * 0.1)
                let waveAmp = sphereRadius * 0.05
                let segments = 96
                var path = Path()
                for s in 0...segments {
                    let t = Double(s) / Double(segments)
                    let angle = t * pi2
                    // Higher-frequency perturbation gives the "liquid" look
                    let perturb = sin(angle * 5 + wavePhase) * waveAmp
                                + cos(angle * 3 - wavePhase * 0.7) * waveAmp * 0.4
                    let r = baseR + perturb
                    let x = c.x + cos(angle) * r
                    let y = c.y + sin(angle) * r
                    if s == 0 { path.move(to: CGPoint(x: x, y: y)) }
                    else       { path.addLine(to: CGPoint(x: x, y: y)) }
                }
                let opacity = 0.6 - Double(ringIdx) * 0.12
                ctx.stroke(path, with: .color(cyan.opacity(opacity * 0.25)),
                           style: StrokeStyle(lineWidth: 8, lineCap: .round))
                ctx.stroke(path, with: .color(cyan.opacity(opacity * 0.8)),
                           style: StrokeStyle(lineWidth: 1.8, lineCap: .round))
            }

            // Wireframe sphere — latitudes (8 horizontal elliptical rings)
            let sphereOp = 0.55
            let latCount = 8
            for i in 1..<latCount {
                let latT = Double(i) / Double(latCount)          // 0..1
                let latAngle = latT * .pi                          // 0..pi
                let latR = sphereRadius * sin(latAngle)
                let latY = c.y - sphereRadius * cos(latAngle)
                // Squish the horizontal ring to simulate 3D perspective.
                let squish: CGFloat = 0.15 + 0.85 * CGFloat(abs(sin(latAngle)))
                let rect = CGRect(
                    x: c.x - latR,
                    y: latY - latR * squish,
                    width: latR * 2,
                    height: latR * squish * 2
                )
                ctx.stroke(Path(ellipseIn: rect),
                           with: .color(cyanBright.opacity(sphereOp * 0.45)),
                           style: StrokeStyle(lineWidth: 0.7))
            }

            // Wireframe sphere — longitudes (12 meridians, slowly rotating)
            let rotLongitude = phase * 0.18
            let longCount = 12
            for i in 0..<longCount {
                let longAngle = (Double(i) / Double(longCount)) * pi2 + rotLongitude
                let pp = Path { p in
                    for s in 0...30 {
                        let t = Double(s) / 30.0
                        let theta = t * .pi
                        let baseX = sin(theta) * sphereRadius
                        let baseY = -cos(theta) * sphereRadius
                        let x = c.x + baseX * cos(longAngle)
                        let y = c.y + baseY
                        if s == 0 { p.move(to: CGPoint(x: x, y: y)) }
                        else       { p.addLine(to: CGPoint(x: x, y: y)) }
                    }
                }
                let edgeFade = abs(sin(longAngle))
                ctx.stroke(pp,
                           with: .color(cyanBright.opacity(sphereOp * 0.4 * edgeFade)),
                           style: StrokeStyle(lineWidth: 0.6))
            }

            // Bright white-cyan core
            let coreR = sphereRadius * 0.18
            let corePath = Path(ellipseIn: CGRect(
                x: c.x - coreR, y: c.y - coreR,
                width: coreR * 2, height: coreR * 2
            ))
            ctx.fill(corePath, with: .radialGradient(
                Gradient(colors: [
                    Color.white.opacity(0.95),
                    cyanBright.opacity(0.70),
                    cyan.opacity(0.35),
                    Color.clear
                ]),
                center: c, startRadius: 0, endRadius: coreR
            ))

            // Fixed-seed particle cloud — 140 particles orbiting at r ≈ 1.3R…1.9R
            var seed: UInt64 = 42
            for _ in 0..<140 {
                seed = seed &* 6364136223846793005 &+ 1442695040888963407
                let angleSeed = Double(seed >> 11) / Double(1 << 53)
                seed = seed &* 6364136223846793005 &+ 1442695040888963407
                let distSeed = Double(seed >> 11) / Double(1 << 53)

                let particleAngle = angleSeed * pi2 + phase * 0.12
                let particleDist = sphereRadius * (1.3 + distSeed * 0.6)
                let px = c.x + cos(particleAngle) * particleDist
                let py = c.y + sin(particleAngle) * particleDist
                let pulse = 0.5 + 0.5 * sin(phase * 3 + angleSeed * 10)
                let sz: CGFloat = 0.6 + CGFloat(pulse) * 1.2
                let rect = CGRect(x: px - sz, y: py - sz, width: sz * 2, height: sz * 2)
                ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(0.45 * pulse)))
            }
        }
        .allowsHitTesting(false)
    }
}

/// Monochrome directional arrow pair at R × 0.95. Inspired by the Image #6
/// reference — two small white triangles on the left/right of the reactor
/// pulsing at ~0.5 Hz with subtle white glow.
struct MonochromeArrowsOverlay: View {
    let phase: Double
    let cx: CGFloat
    let cy: CGFloat
    let R: CGFloat

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let white = Color.white
            let blink = 0.65 + 0.35 * sin(phase * 3.0)

            for side in [-1.0, 1.0] {
                let centerX = c.x + CGFloat(side) * R
                let centerY = c.y
                let armLen = R * 0.08

                // Arrow triangle pointing outward
                let tip = CGPoint(x: centerX + CGFloat(side) * armLen, y: centerY)
                let top = CGPoint(x: centerX, y: centerY - armLen * 0.55)
                let bot = CGPoint(x: centerX, y: centerY + armLen * 0.55)
                let triangle = Path { p in
                    p.move(to: tip); p.addLine(to: top)
                    p.addLine(to: bot); p.closeSubpath()
                }

                // Halo + stroke + soft fill — all white, no cyan
                ctx.stroke(triangle, with: .color(white.opacity(0.10 * blink)),
                           style: StrokeStyle(lineWidth: 6, lineJoin: .round))
                ctx.stroke(triangle, with: .color(white.opacity(0.55 * blink)),
                           style: StrokeStyle(lineWidth: 1.4, lineJoin: .round))
                ctx.fill(triangle, with: .color(white.opacity(0.10 * blink)))

                // Vertical gauge stroke beside each arrow
                let gaugeX = centerX - CGFloat(side) * (armLen * 0.4)
                let gaugeTop = CGPoint(x: gaugeX, y: centerY - armLen * 1.1)
                let gaugeBot = CGPoint(x: gaugeX, y: centerY + armLen * 1.1)
                let gauge = Path { p in p.move(to: gaugeTop); p.addLine(to: gaugeBot) }
                ctx.stroke(gauge, with: .color(white.opacity(0.30 * blink)),
                           style: StrokeStyle(lineWidth: 0.8))
            }
        }
        .allowsHitTesting(false)
    }
}
