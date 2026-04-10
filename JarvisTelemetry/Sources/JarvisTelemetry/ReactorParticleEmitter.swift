// File: Sources/JarvisTelemetry/ReactorParticleEmitter.swift
// JARVIS — CAEmitterLayer centred on reactor core.
// Spec: birthRate=12, lifetime=2.8s, velocity=140, velocityRange=60,
//       emissionRange=2π, color=#00D4FF, scale=0.04

import SwiftUI
import AppKit
import QuartzCore

// MARK: - SwiftUI bridge ──────────────────────────────────────────────────────

struct ReactorParticleEmitter: NSViewRepresentable {
    func makeNSView(context: Context) -> ParticleEmitterNSView {
        ParticleEmitterNSView()
    }
    func updateNSView(_ nsView: ParticleEmitterNSView, context: Context) {
        // Re-centre the emitter if the view resizes
        nsView.recenter()
    }
}

// MARK: - NSView implementation ───────────────────────────────────────────────

final class ParticleEmitterNSView: NSView {

    private var emitter: CAEmitterLayer?
    private var didSetup = false

    override func makeBackingLayer() -> CALayer { CALayer() }
    override var isFlipped: Bool { true }

    override func layout() {
        super.layout()
        if !didSetup, bounds.width > 0, bounds.height > 0 {
            didSetup = true
            buildEmitter()
        }
        recenter()
    }

    func recenter() {
        emitter?.emitterPosition = CGPoint(x: bounds.midX, y: bounds.midY)
    }

    // ── Build the emitter once ───────────────────────────────────────────────

    private func buildEmitter() {
        wantsLayer = true
        layer?.backgroundColor = CGColor.clear

        let layer = CAEmitterLayer()
        layer.emitterPosition = CGPoint(x: bounds.midX, y: bounds.midY)
        layer.emitterShape    = .point
        layer.renderMode      = .additive

        let cell = CAEmitterCell()
        cell.birthRate     = 12          // particles/s
        cell.lifetime      = 2.8         // seconds
        cell.velocity      = 140         // pt/s
        cell.velocityRange = 60          // ±60 pt/s
        cell.emissionRange = .pi * 2        // full 360° (CGFloat)
        cell.scale         = 0.04        // fraction of particle-image size
        cell.scaleRange    = 0.008       // slight size variation
        cell.alphaSpeed    = -0.35       // fade to transparent over lifetime
        cell.color         = CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(),
                                     components: [0.0, 0.831, 1.0, 0.85])

        // Particle image: glowing cyan disc, 200×200 px.
        // At scale=0.04 the rendered particle is 200 × 0.04 = 8 pt wide.
        cell.contents = makeParticleImage(size: 200)

        layer.emitterCells = [cell]
        self.layer?.addSublayer(layer)
        self.emitter = layer
    }

    // ── CGImage factory — glowing cyan circle ────────────────────────────────

    private func makeParticleImage(size: Int) -> CGImage? {
        let s = CGFloat(size)
        guard let ctx = CGContext(
            data:             nil,
            width:            size,
            height:           size,
            bitsPerComponent: 8,
            bytesPerRow:      0,
            space:            CGColorSpaceCreateDeviceRGB(),
            bitmapInfo:       CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }

        // Outer soft glow — large, very transparent
        let glowSteps = 6
        for i in 0..<glowSteps {
            let t      = CGFloat(i) / CGFloat(glowSteps)
            let radius = s * 0.5 * (0.5 + t * 0.5)
            let alpha  = CGFloat(0.15) * (1.0 - t)
            ctx.setFillColor(CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(),
                                     components: [0.0, 0.831, 1.0, alpha])!)
            ctx.fillEllipse(in: CGRect(x: s/2 - radius, y: s/2 - radius,
                                       width: radius * 2, height: radius * 2))
        }

        // Bright core — solid cyan dot in the centre (20% of total size)
        let coreR = s * 0.10
        ctx.setFillColor(CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(),
                                  components: [0.0, 0.831, 1.0, 1.0])!)
        ctx.fillEllipse(in: CGRect(x: s/2 - coreR, y: s/2 - coreR,
                                   width: coreR * 2, height: coreR * 2))

        // White-hot centre highlight
        let hotR = s * 0.04
        ctx.setFillColor(CGColor(gray: 1.0, alpha: 0.9))
        ctx.fillEllipse(in: CGRect(x: s/2 - hotR, y: s/2 - hotR,
                                   width: hotR * 2, height: hotR * 2))

        return ctx.makeImage()
    }
}
