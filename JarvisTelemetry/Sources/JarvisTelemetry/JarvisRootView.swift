// File: Sources/JarvisTelemetry/JarvisRootView.swift
// Root view compositing BOOT, LOOP, SHUTDOWN, STANDBY, and LOCK phases.
// Integrates ReactorAnimationController + BatteryMonitor for telemetry-reactive animation.

import SwiftUI

struct JarvisRootView: View {

    @EnvironmentObject var bridge: TelemetryBridge
    @EnvironmentObject var phaseController: HUDPhaseController
    @EnvironmentObject var reactorController: ReactorAnimationController
    @EnvironmentObject var batteryMonitor: BatteryMonitor
    @StateObject private var store = TelemetryStore()
    @StateObject private var moodEngine = SystemMoodEngine()

    var body: some View {
        ZStack {
            Color.clear

            switch phaseController.phase {
            case .boot:
                BootSequenceView()
                    .environmentObject(phaseController)
                    .environmentObject(store)
                    .transition(.opacity)

            case .loop:
                AnimatedCanvasHost()
                    .environmentObject(store)
                    .environmentObject(phaseController)
                    .environmentObject(moodEngine)
                    .environmentObject(reactorController)
                    .offset(x: reactorController.reactorShakeOffset)
                    .transition(.opacity)

                // Lightning effect overlay during charging wake
                if reactorController.lightningActive {
                    LightningEffectView()
                        .transition(.opacity)
                        .allowsHitTesting(false)
                }

                // Status message overlay
                if !reactorController.statusMessage.isEmpty {
                    StatusMessageOverlay(message: reactorController.statusMessage)
                }

            case .shutdown:
                ShutdownSequenceView()
                    .environmentObject(phaseController)
                    .environmentObject(store)
                    .environmentObject(moodEngine)
                    .transition(.opacity)

            case .standby:
                Color.clear

            case .lockScreen:
                JARVISLockScreenView()
                    .environmentObject(reactorController)
                    .environmentObject(phaseController)
                    .transition(.opacity)
            }
        }
        .onAppear {
            store.bind(to: bridge)
            moodEngine.bind(to: store)
            reactorController.bind(to: store, battery: batteryMonitor)
            batteryMonitor.start()
            phaseController.startBoot(isWake: false)
        }
        .ignoresSafeArea()
    }
}

// MARK: - Lightning Effect for Charging Wake (R-01.2 Phase 1)

/// Canvas-drawn electric arc lightning bursts during charging wake sequence
struct LightningEffectView: View {
    @State private var burstPhase: Int = 0

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let cx = w / 2
            let cy = h / 2

            TimelineView(.animation(minimumInterval: 1.0/60.0)) { timeline in
                let phase = timeline.date.timeIntervalSinceReferenceDate

                Canvas { ctx, size in
                    let center = CGPoint(x: cx, y: cy)
                    let arcCount = 8
                    let lightningCyan = Color(
                        red: 0.6, green: 0.85, blue: 1.0
                    )

                    // Draw electric arcs radiating from center
                    for i in 0..<arcCount {
                        let baseAngle = Double(i) / Double(arcCount) * .pi * 2.0
                        let jitter = sin(phase * 20 + Double(i) * 3.7) * 0.3
                        let angle = baseAngle + jitter

                        // Lightning bolt as segmented path with random offsets
                        let segments = 6
                        var points: [CGPoint] = [center]

                        for s in 1...segments {
                            let t = Double(s) / Double(segments)
                            let r = 40.0 + t * min(w, h) * 0.15
                            let offset = sin(phase * 30 + Double(s) * 5.3 + Double(i) * 2.1) * 15 * (1.0 - t)
                            let px = cx + cos(angle) * r + cos(angle + .pi/2) * offset
                            let py = cy + sin(angle) * r + sin(angle + .pi/2) * offset
                            points.append(CGPoint(x: px, y: py))
                        }

                        let boltPath = Path { p in
                            p.move(to: points[0])
                            for pt in points.dropFirst() {
                                p.addLine(to: pt)
                            }
                        }

                        let boltOp = 0.4 + sin(phase * 15 + Double(i) * 1.5) * 0.3
                        // Glow
                        ctx.stroke(boltPath, with: .color(lightningCyan.opacity(boltOp * 0.3)),
                                   style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))
                        // Core
                        ctx.stroke(boltPath, with: .color(lightningCyan.opacity(boltOp)),
                                   style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                        // White hot center
                        ctx.stroke(boltPath, with: .color(Color.white.opacity(boltOp * 0.5)),
                                   style: StrokeStyle(lineWidth: 0.5, lineCap: .round, lineJoin: .round))
                    }
                }
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Status Message Overlay

/// Displays reactor status messages (power critical, power restored, etc.)
struct StatusMessageOverlay: View {
    let message: String

    var body: some View {
        GeometryReader { geo in
            Text(message)
                .font(.custom("Menlo", size: 12))
                .tracking(3)
                .foregroundColor(Color(red: 0.102, green: 0.902, blue: 0.961).opacity(0.7))
                .shadow(color: Color(red: 0.102, green: 0.902, blue: 0.961).opacity(0.4), radius: 8)
                .position(x: geo.size.width / 2, y: geo.size.height * 0.85)
        }
        .allowsHitTesting(false)
        .transition(.opacity)
    }
}
