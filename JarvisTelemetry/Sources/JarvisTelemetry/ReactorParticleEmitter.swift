// File: Sources/JarvisTelemetry/ReactorParticleEmitter.swift
// JARVIS — CAEmitterLayer centred on reactor core.
// Marvel-grade: birth rate, velocity, and color reactively track system load.
// Spikes produce particle bursts; idle dims to gentle floating motes.

import SwiftUI
import AppKit
import QuartzCore
import Combine

// MARK: - SwiftUI bridge ──────────────────────────────────────────────────────

struct ReactorParticleEmitter: NSViewRepresentable {
    @EnvironmentObject var reactorController: ReactorAnimationController

    func makeNSView(context: Context) -> ParticleEmitterNSView {
        ParticleEmitterNSView()
    }
    func updateNSView(_ nsView: ParticleEmitterNSView, context: Context) {
        // Re-centre + push reactive state every frame
        nsView.recenter()
        nsView.updateReactiveState(
            load: reactorController.reactorLoad,
            flare: reactorController.coreFlare,
            powerFlow: reactorController.powerFlowIntensity,
            densityMul: reactorController.particleDensityMultiplier
        )
    }
}

// MARK: - NSView implementation ───────────────────────────────────────────────

final class ParticleEmitterNSView: NSView {

    private var emitter: CAEmitterLayer?
    private var mainCell: CAEmitterCell?
    private var flareCell: CAEmitterCell?
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

    /// Push reactive telemetry values into the emitter parameters.
    /// Called from updateNSView at display refresh rate.
    func updateReactiveState(load: Double, flare: Double, powerFlow: Double, densityMul: Double) {
        guard let mainCell, let flareCell else { return }

        // Birth rate: 8 at idle → 20 under full load, ×densityMul from events
        let baseBirth: Float = Float(8.0 + load * 12.0) * Float(densityMul)
        mainCell.birthRate = baseBirth

        // Velocity: particles drift faster under load (energy field intensifies)
        mainCell.velocity = CGFloat(100.0 + load * 80.0 + powerFlow * 40.0)
        mainCell.velocityRange = CGFloat(40.0 + load * 30.0)

        // Lifetime: shorter under heavy load (particles burn brighter, die faster)
        mainCell.lifetime = Float(3.2 - load * 0.8)

        // Alpha: brighter under load
        mainCell.alphaSpeed = Float(-0.25 - load * 0.15)

        // Color shifts slightly warmer (more white) under high power
        let g: CGFloat = 0.902 - CGFloat(powerFlow) * 0.05
        mainCell.color = CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(),
                                 components: [0.102, g, 0.961, CGFloat(0.80 + load * 0.15)])

        // Flare cell: burst particles on spikes
        if flare > 0.05 {
            flareCell.birthRate = Float(flare * 30.0)
            flareCell.velocity = CGFloat(200.0 + flare * 150.0)
            flareCell.alphaSpeed = -0.8  // fast fade
        } else {
            flareCell.birthRate = 0
        }
    }

    // ── Build the emitter once ───────────────────────────────────────────────

    private func buildEmitter() {
        wantsLayer = true
        layer?.backgroundColor = CGColor.clear

        let emitterLayer = CAEmitterLayer()
        emitterLayer.emitterPosition = CGPoint(x: bounds.midX, y: bounds.midY)
        emitterLayer.emitterShape    = .point
        emitterLayer.renderMode      = .additive

        // Main ambient particles — steady flow
        let cell = CAEmitterCell()
        cell.birthRate     = 12
        cell.lifetime      = 2.8
        cell.velocity      = 140
        cell.velocityRange = 60
        cell.emissionRange = .pi * 2
        cell.scale         = 0.04
        cell.scaleRange    = 0.008
        cell.alphaSpeed    = -0.35
        cell.color         = CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(),
                                     components: [0.102, 0.902, 0.961, 0.85])
        cell.contents = makeParticleImage(size: 200)
        self.mainCell = cell

        // Flare burst particles — only active during spikes
        let burst = CAEmitterCell()
        burst.birthRate     = 0       // dormant until spike
        burst.lifetime      = 1.2
        burst.velocity      = 250
        burst.velocityRange = 100
        burst.emissionRange = .pi * 2
        burst.scale         = 0.06
        burst.scaleRange    = 0.015
        burst.scaleSpeed    = -0.02
        burst.alphaSpeed    = -0.8
        burst.color         = CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(),
                                      components: [0.6, 0.95, 1.0, 0.95])
        burst.contents = makeParticleImage(size: 200)
        self.flareCell = burst

        emitterLayer.emitterCells = [cell, burst]
        self.layer?.addSublayer(emitterLayer)
        self.emitter = emitterLayer
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
                                     components: [0.102, 0.902, 0.961, alpha])!)
            ctx.fillEllipse(in: CGRect(x: s/2 - radius, y: s/2 - radius,
                                       width: radius * 2, height: radius * 2))
        }

        // Bright core — solid cyan dot in the centre (20% of total size)
        let coreR = s * 0.10
        ctx.setFillColor(CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(),
                                  components: [0.102, 0.902, 0.961, 1.0])!)
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
