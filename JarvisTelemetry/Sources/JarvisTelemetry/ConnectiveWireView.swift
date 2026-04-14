// File: Sources/JarvisTelemetry/ConnectiveWireView.swift
// Spec §3.7: Connective Wire Flashes
// Hair-thin quadratic bezier arcs (0.5pt, cyan) that link a live data source
// on the reactor to a side panel or chatter zone. Each wire:
//   • Draws itself over 0.2s (animated path trim with bright tip dot)
//   • Holds at 0.30 opacity for 0.3s with a brief brightness pulse
//   • Fades away over 0.5s
//   • Maximum 1 active wire per 3-4 second interval

import SwiftUI
import Combine

// MARK: - Data model ──────────────────────────────────────────────────────────

struct ConnectiveWireArc: Identifiable {
    let id          = UUID()
    let from        : CGPoint   // data source on reactor ring
    let control     : CGPoint   // bezier arc midpoint
    let to          : CGPoint   // destination panel / chatter zone
    let birthTime   : Date

    static let drawDuration  = 0.20  // s — arc draws itself
    static let holdDuration  = 0.30  // s — visible at full opacity
    static let fadeDuration  = 0.50  // s — fades out
    static let totalLifetime = drawDuration + holdDuration + fadeDuration  // 1.0s

    private var elapsed: Double { Date().timeIntervalSince(birthTime) }

    /// 0→1 bezier trim progress during draw phase
    var drawProgress: Double {
        min(1.0, elapsed / ConnectiveWireArc.drawDuration)
    }

    /// Opacity including draw-in, hold, and fade
    var opacity: Double {
        let e = elapsed
        let holdEnd = ConnectiveWireArc.drawDuration + ConnectiveWireArc.holdDuration
        if e < ConnectiveWireArc.drawDuration { return 0.30 * e / ConnectiveWireArc.drawDuration }
        if e < holdEnd                         { return 0.30 }
        let fadeElapsed = e - holdEnd
        return 0.30 * max(0, 1.0 - fadeElapsed / ConnectiveWireArc.fadeDuration)
    }

    /// Brightness multiplier — peaks 3× at end of draw, returns to 1× thereafter
    var pulseBrightness: Double {
        let e        = elapsed
        let window   = 0.15
        let peakTime = ConnectiveWireArc.drawDuration - window / 2
        guard e > peakTime - window && e < peakTime + window else { return 1.0 }
        let t = (e - (peakTime - window)) / (window * 2)
        return 1.0 + sin(t * .pi) * 2.0   // 1→3→1
    }

    var isExpired: Bool { elapsed > ConnectiveWireArc.totalLifetime }
}

// MARK: - Engine ──────────────────────────────────────────────────────────────

final class ConnectiveWireEngine: ObservableObject {
    @Published var wires: [ConnectiveWireArc] = []

    // Geometry, set by the overlay on appearance
    var screenSize   : CGSize  = .zero
    var reactorCenter: CGPoint = .zero
    var reactorRadius: Double  = 0

    private var cancellables   = Set<AnyCancellable>()
    private var lastSpawnDate  = Date.distantPast
    private var nextInterval   = 3.5

    func bind(to store: TelemetryStore) {
        Timer.publish(every: 0.5, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                self.wires.removeAll { $0.isExpired }
                let sinceLastSpawn = Date().timeIntervalSince(self.lastSpawnDate)
                guard sinceLastSpawn > self.nextInterval else { return }
                self.nextInterval  = Double.random(in: 3.0...4.5)
                self.lastSpawnDate = Date()
                if let wire = self.makeWire(store: store) {
                    self.wires.append(wire)
                }
            }
            .store(in: &cancellables)
    }

    private func makeWire(store: TelemetryStore) -> ConnectiveWireArc? {
        guard screenSize != .zero, reactorRadius > 10 else { return nil }
        let cx = Double(reactorCenter.x)
        let cy = Double(reactorCenter.y)
        let R  = reactorRadius

        // Source — position on a reactor data arc (telemetry-correlated angle)
        // Prioritise the busiest data zone so the wire feels meaningful
        let allCores = store.eCoreUsages + store.pCoreUsages + store.sCoreUsages
        let avgLoad  = allCores.isEmpty ? 0.5 : allCores.reduce(0, +) / Double(allCores.count)
        let angles: [Double] = [
            -.pi / 2 + .pi / 4,            // top-right  → P-Core arc zone
             .pi / 2 - .pi / 4,            // bot-left   → E-Core arc zone
            -.pi / 6,                       // ~330°      → GPU arc zone
             .pi * 0.75,                    // ~225°      → thermal ring
             -.pi / 2 + avgLoad * .pi,      // load-biased angle
        ]
        let srcAngle  = angles.randomElement()!
        let srcRadius = R * Double.random(in: 0.62...0.84)
        let from = CGPoint(x: cx + cos(srcAngle) * srcRadius,
                           y: cy + sin(srcAngle) * srcRadius)

        // Destination — side panel or chatter region
        let w = Double(screenSize.width)
        let leftDest  = CGPoint(x: w * 0.10, y: cy + Double.random(in: -60...60))
        let rightDest = CGPoint(x: w * 0.88, y: cy + Double.random(in: -60...60))
        let to = from.x < cx ? rightDest : leftDest

        // Quadratic bezier control — perpendicular arc
        let midX = (Double(from.x) + Double(to.x)) / 2
        let midY = (Double(from.y) + Double(to.y)) / 2
        let dx   = Double(to.x - from.x)
        let dy   = Double(to.y - from.y)
        let len  = max(1, sqrt(dx*dx + dy*dy))
        let perp = Double.random(in: -50...50)
        let control = CGPoint(x: midX + (-dy / len) * perp,
                              y: midY + ( dx / len) * perp)

        return ConnectiveWireArc(from: from, control: control, to: to, birthTime: Date())
    }
}

// MARK: - Overlay View ────────────────────────────────────────────────────────

struct ConnectiveWireOverlay: View {
    @ObservedObject var engine: ConnectiveWireEngine
    let cyan: Color

    var body: some View {
        GeometryReader { geo in
            TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { _ in
                Canvas(opaque: false, colorMode: .linear) { ctx, _ in
                    for wire in engine.wires {
                        let alpha = wire.opacity
                        guard alpha > 0.005 else { continue }
                        let t = wire.drawProgress
                        guard t > 0 else { continue }

                        let from    = wire.from
                        let ctrl    = wire.control
                        let to      = wire.to

                        // Trimmed quadratic bezier path (de Casteljau at t)
                        let trimTo   = quadraticPoint(from: from, ctrl: ctrl, to: to, t: t)
                        let trimCtrl = lerp(from, ctrl, t: t)

                        var path = Path()
                        path.move(to: from)
                        path.addQuadCurve(to: trimTo, control: trimCtrl)

                        let brightness = wire.pulseBrightness
                        let finalAlpha = min(alpha * brightness, 1.0)

                        // Hair-thin line — spec: 0.5pt
                        ctx.stroke(path,
                                   with: .color(cyan.opacity(finalAlpha)),
                                   style: StrokeStyle(lineWidth: 0.5, lineCap: .round))

                        // Bright drawing tip — visible only while arc is drawing
                        if t < 0.98 {
                            let tipRect = CGRect(x: trimTo.x - 1.5, y: trimTo.y - 1.5,
                                                 width: 3, height: 3)
                            ctx.fill(Path(ellipseIn: tipRect),
                                     with: .color(cyan.opacity(min(finalAlpha * 2.0, 1.0))))
                        }
                    }
                }
            }
            .allowsHitTesting(false)
            .onAppear {
                engine.screenSize = geo.size
            }
            .onChange(of: geo.size) {
                engine.screenSize = geo.size
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private func quadraticPoint(from: CGPoint, ctrl: CGPoint, to: CGPoint, t: Double) -> CGPoint {
        let u = 1 - t
        return CGPoint(
            x: u*u*Double(from.x) + 2*u*t*Double(ctrl.x) + t*t*Double(to.x),
            y: u*u*Double(from.y) + 2*u*t*Double(ctrl.y) + t*t*Double(to.y)
        )
    }

    private func lerp(_ a: CGPoint, _ b: CGPoint, t: Double) -> CGPoint {
        CGPoint(x: Double(a.x) + (Double(b.x) - Double(a.x)) * t,
                y: Double(a.y) + (Double(b.y) - Double(a.y)) * t)
    }
}
