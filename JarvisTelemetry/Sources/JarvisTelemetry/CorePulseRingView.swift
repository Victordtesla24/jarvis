// File: Sources/JarvisTelemetry/CorePulseRingView.swift
// JARVIS — Core pulse ring at reactor centre.
// CALayer + CASpringAnimation: scale 1.0→1.6→1.0, duration=2.2s, damping=0.6.
// CABasicAnimation: opacity 1.0→0.0 synced on same timing.
// Both animations repeat infinite.

import SwiftUI
import AppKit
import QuartzCore

// MARK: - SwiftUI bridge ──────────────────────────────────────────────────────

struct CorePulseRingView: NSViewRepresentable {
    func makeNSView(context: Context) -> CorePulseNSView {
        CorePulseNSView()
    }
    func updateNSView(_ nsView: CorePulseNSView, context: Context) {}
}

// MARK: - NSView implementation ───────────────────────────────────────────────

final class CorePulseNSView: NSView {

    private var pulseLayer: CALayer?
    private var didSetup = false

    override func makeBackingLayer() -> CALayer { CALayer() }
    override var isFlipped: Bool { true }

    override func layout() {
        super.layout()
        guard !didSetup, bounds.width > 0, bounds.height > 0 else { return }
        didSetup = true
        buildPulse()
    }

    // ── Build the pulse ring + animations ────────────────────────────────────

    private func buildPulse() {
        wantsLayer = true
        layer?.backgroundColor = CGColor.clear

        let cx = bounds.midX
        let cy = bounds.midY
        let R  = min(bounds.width, bounds.height) * 0.42

        // Core ring sits just outside the reactor's inner glow (~8% of R)
        let ringR: CGFloat = R * 0.09
        let ringD           = ringR * 2

        let ring = CALayer()
        ring.bounds       = CGRect(x: 0, y: 0, width: ringD, height: ringD)
        ring.position     = CGPoint(x: cx, y: cy)
        ring.anchorPoint  = CGPoint(x: 0.5, y: 0.5)
        ring.cornerRadius = ringR
        ring.borderColor  = CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(),
                                    components: [0.0, 0.831, 1.0, 1.0])
        ring.borderWidth  = 2.0
        ring.backgroundColor = CGColor.clear
        ring.shadowColor  = CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(),
                                    components: [0.0, 0.831, 1.0, 1.0])
        ring.shadowRadius = 8
        ring.shadowOpacity = 0.6
        ring.shadowOffset  = .zero

        layer?.addSublayer(ring)
        self.pulseLayer = ring

        // ── Scale: 1.0 → 1.6 (spring) → 1.0 (reversed), 2.2s each way ────
        let scaleAnim                    = CASpringAnimation(keyPath: "transform.scale")
        scaleAnim.fromValue              = 1.0
        scaleAnim.toValue               = 1.6
        scaleAnim.duration              = 2.2
        scaleAnim.damping               = 0.6
        scaleAnim.repeatCount           = .infinity
        scaleAnim.autoreverses          = true
        scaleAnim.isRemovedOnCompletion = false
        scaleAnim.timingFunction        = CAMediaTimingFunction(name: .easeInEaseOut)

        // ── Opacity: 1.0 → 0.0 → 1.0 synchronized with scale cycle ─────────
        // Total cycle = 2.2s (forward) + 2.2s (reverse) = 4.4s
        let opacityAnim                    = CAKeyframeAnimation(keyPath: "opacity")
        opacityAnim.values                 = [1.0, 0.0, 1.0]
        opacityAnim.keyTimes               = [0, 0.5, 1.0]
        opacityAnim.duration               = 4.4
        opacityAnim.repeatCount            = .infinity
        opacityAnim.isRemovedOnCompletion  = false
        opacityAnim.calculationMode        = .linear
        // Explicit timing per keyframe segment (3 values = 2 segments)
        opacityAnim.timingFunctions        = [
            CAMediaTimingFunction(name: .easeIn),
            CAMediaTimingFunction(name: .easeOut)
        ]

        ring.add(scaleAnim,   forKey: "pulse.scale")
        ring.add(opacityAnim, forKey: "pulse.opacity")
    }
}
