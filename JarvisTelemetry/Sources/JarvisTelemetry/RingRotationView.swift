// File: Sources/JarvisTelemetry/RingRotationView.swift
// JARVIS — 5 concentric CAShapeLayer rings with independent CABasicAnimation
// rotation. GAP-03 compliant: exactly 5 rings matching the reactor architecture.
// Each ring has a distinct duration and alternating CW/CCW direction.
// GAP-02: Double-shadow bloom via CALayer shadowRadius + shadowColor.

import SwiftUI
import AppKit
import QuartzCore

// MARK: - SwiftUI bridge ──────────────────────────────────────────────────────

struct RingRotationView: NSViewRepresentable {
    func makeNSView(context: Context) -> RingRotationNSView {
        RingRotationNSView()
    }
    func updateNSView(_ nsView: RingRotationNSView, context: Context) {}
}

// MARK: - NSView implementation ───────────────────────────────────────────────

final class RingRotationNSView: NSView {

    private var ringLayers: [CAShapeLayer] = []
    private var didSetup = false

    override func makeBackingLayer() -> CALayer { CALayer() }
    override var isFlipped: Bool { true }

    // GAP-03: 5 rings matching reactor architecture
    // Ring 1 (outermost, 0.95R): 45s CW — segmented dashes
    // Ring 2 (0.78R):            32s CCW — telemetry ring
    // Ring 3 (0.62R):            22s CW  — label annotation
    // Ring 4 (0.48R):            18s CCW — secondary telemetry
    // Ring 5 (0.35R, innermost): 12s CW  — thin + ticks
    private struct RingSpec {
        let radiusFraction: CGFloat
        let lineWidth: CGFloat
        let alpha: CGFloat
        let dashPattern: [NSNumber]
        let duration: CFTimeInterval
        let clockwise: Bool
        let shadowRadius: CGFloat
    }

    private let specs: [RingSpec] = [
        RingSpec(radiusFraction: 0.95, lineWidth: 2.5, alpha: 0.35,
                 dashPattern: [14, 6], duration: 45, clockwise: true, shadowRadius: 12),
        RingSpec(radiusFraction: 0.78, lineWidth: 2.0, alpha: 0.28,
                 dashPattern: [10, 5], duration: 32, clockwise: false, shadowRadius: 8),
        RingSpec(radiusFraction: 0.62, lineWidth: 1.8, alpha: 0.24,
                 dashPattern: [8, 4], duration: 22, clockwise: true, shadowRadius: 6),
        RingSpec(radiusFraction: 0.48, lineWidth: 1.5, alpha: 0.20,
                 dashPattern: [6, 3], duration: 18, clockwise: false, shadowRadius: 6),
        RingSpec(radiusFraction: 0.35, lineWidth: 1.2, alpha: 0.18,
                 dashPattern: [4, 2], duration: 12, clockwise: true, shadowRadius: 4),
    ]

    override func layout() {
        super.layout()
        guard !didSetup, bounds.width > 0, bounds.height > 0 else { return }
        didSetup = true
        buildRings()
    }

    private func buildRings() {
        wantsLayer = true
        layer?.backgroundColor = CGColor.clear

        let cx = bounds.midX
        let cy = bounds.midY
        let R = min(bounds.width, bounds.height) * 0.42

        // #00D4FF in linear sRGB
        let cyanCG = CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(),
                             components: [0.0, 0.831, 1.0, 1.0])!

        for spec in specs {
            let radius = R * spec.radiusFraction

            let shapeLayer = CAShapeLayer()
            shapeLayer.bounds = CGRect(x: 0, y: 0, width: radius * 2, height: radius * 2)
            shapeLayer.position = CGPoint(x: cx, y: cy)
            shapeLayer.anchorPoint = CGPoint(x: 0.5, y: 0.5)

            shapeLayer.path = CGPath(ellipseIn: CGRect(x: 0, y: 0,
                                                        width: radius * 2,
                                                        height: radius * 2),
                                     transform: nil)
            shapeLayer.strokeColor = cyanCG.copy(alpha: spec.alpha)
            shapeLayer.fillColor   = CGColor.clear
            shapeLayer.lineWidth   = spec.lineWidth
            shapeLayer.lineDashPattern = spec.dashPattern
            shapeLayer.lineCap     = .round

            // GAP-02: Double-shadow bloom — cyan glow behind each ring
            shapeLayer.shadowColor   = cyanCG
            shapeLayer.shadowRadius  = spec.shadowRadius
            shapeLayer.shadowOpacity = Float(spec.alpha * 0.8)
            shapeLayer.shadowOffset  = .zero

            layer?.addSublayer(shapeLayer)
            ringLayers.append(shapeLayer)

            let anim = CABasicAnimation(keyPath: "transform.rotation.z")
            anim.fromValue             = 0.0
            anim.toValue               = spec.clockwise ? Double.pi * 2 : -Double.pi * 2
            anim.duration              = spec.duration
            anim.repeatCount           = .infinity
            anim.isRemovedOnCompletion = false
            anim.timingFunction        = CAMediaTimingFunction(name: .linear)
            shapeLayer.add(anim, forKey: "ring.rotation.z")
        }
    }
}
