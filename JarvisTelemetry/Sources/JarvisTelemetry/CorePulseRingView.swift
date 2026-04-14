// File: Sources/JarvisTelemetry/CorePulseRingView.swift
// JARVIS — Core pulse ring at reactor centre.
// Marvel-grade: pulse speed and scale react to system load.
// Idle: gentle slow breath (3.5s). Load: faster, wider pulse (1.5s).
// Flare spikes trigger an immediate expansion burst.

import SwiftUI
import AppKit
import QuartzCore
import Combine

// MARK: - SwiftUI bridge ──────────────────────────────────────────────────────

struct CorePulseRingView: NSViewRepresentable {
    @EnvironmentObject var reactorController: ReactorAnimationController

    func makeNSView(context: Context) -> CorePulseNSView {
        CorePulseNSView()
    }
    func updateNSView(_ nsView: CorePulseNSView, context: Context) {
        nsView.updateReactiveState(
            load: reactorController.reactorLoad,
            flare: reactorController.coreFlare,
            powerFlow: reactorController.powerFlowIntensity
        )
    }
}

// MARK: - NSView implementation ───────────────────────────────────────────────

final class CorePulseNSView: NSView {

    private var pulseLayer: CALayer?
    private var didSetup = false

    // Reactive state tracking
    private var currentLoad: Double = 0.0
    private var currentFlare: Double = 0.0

    override func makeBackingLayer() -> CALayer { CALayer() }
    override var isFlipped: Bool { true }

    override func layout() {
        super.layout()
        guard !didSetup, bounds.width > 0, bounds.height > 0 else { return }
        didSetup = true
        buildPulse()
    }

    /// Update reactive animation parameters based on live telemetry
    func updateReactiveState(load: Double, flare: Double, powerFlow: Double) {
        guard let ring = pulseLayer else { return }

        // Only update animations if load changed significantly (avoid churn)
        let loadChanged = abs(load - currentLoad) > 0.05
        let flareActive = flare > 0.05

        if loadChanged {
            currentLoad = load

            // Pulse duration: 3.5s at idle → 1.5s under full load
            let duration = 3.5 - load * 2.0
            // Pulse scale: 1.4 at idle → 2.0 under full load
            let maxScale = 1.4 + load * 0.6

            // Update scale animation
            let scaleAnim = CASpringAnimation(keyPath: "transform.scale")
            scaleAnim.fromValue = 1.0
            scaleAnim.toValue = maxScale
            scaleAnim.duration = duration
            scaleAnim.damping = CGFloat(0.6 - load * 0.15)  // less damping = more bounce under load
            scaleAnim.repeatCount = .infinity
            scaleAnim.autoreverses = true
            scaleAnim.isRemovedOnCompletion = false
            scaleAnim.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)

            // Opacity: full cycle = 2× duration
            let opacityAnim = CAKeyframeAnimation(keyPath: "opacity")
            opacityAnim.values = [1.0, 0.0, 1.0]
            opacityAnim.keyTimes = [0, 0.5, 1.0]
            opacityAnim.duration = duration * 2.0
            opacityAnim.repeatCount = .infinity
            opacityAnim.isRemovedOnCompletion = false
            opacityAnim.calculationMode = .linear
            opacityAnim.timingFunctions = [
                CAMediaTimingFunction(name: .easeIn),
                CAMediaTimingFunction(name: .easeOut)
            ]

            ring.add(scaleAnim, forKey: "pulse.scale")
            ring.add(opacityAnim, forKey: "pulse.opacity")

            // Ring border brightness reacts to power
            let brightness = CGFloat(0.902 + powerFlow * 0.05)
            ring.borderColor = CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(),
                                       components: [0.102, brightness, 0.961, 1.0])
            ring.shadowRadius = CGFloat(8 + load * 8)
            ring.shadowOpacity = Float(0.6 + load * 0.3)
        }

        // Flare: immediate scale burst (non-repeating, overlays the repeating anim)
        if flareActive && currentFlare < 0.1 {
            let burstAnim = CASpringAnimation(keyPath: "transform.scale")
            burstAnim.fromValue = 1.0
            burstAnim.toValue = 2.2 + flare * 0.8
            burstAnim.duration = 0.4
            burstAnim.damping = 8.0
            burstAnim.isRemovedOnCompletion = true
            burstAnim.timingFunction = CAMediaTimingFunction(name: .easeOut)
            ring.add(burstAnim, forKey: "pulse.flare")

            // Brief white flash on border
            let colorAnim = CABasicAnimation(keyPath: "borderColor")
            colorAnim.fromValue = CGColor(gray: 1.0, alpha: 1.0)
            colorAnim.toValue = ring.borderColor
            colorAnim.duration = 0.3
            colorAnim.isRemovedOnCompletion = true
            ring.add(colorAnim, forKey: "pulse.flash")
        }
        currentFlare = flare
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
                                    components: [0.102, 0.902, 0.961, 1.0])
        ring.borderWidth  = 2.0
        ring.backgroundColor = CGColor.clear
        ring.shadowColor  = CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(),
                                    components: [0.102, 0.902, 0.961, 1.0])
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
