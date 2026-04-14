// File: Sources/JarvisTelemetry/HolographicFlicker.swift
// ENHANCED — Holographic instability that reacts to system load
// Flickers more under high CPU/memory pressure, creating "struggling HUD" effect

import SwiftUI

struct HolographicFlickerModifier: ViewModifier {
    let phase: Double

    // Base flicker threshold — rare under normal conditions
    private var isFlickering: Bool {
        let flickerSeed = sin(phase * 0.037) * cos(phase * 0.023)
        return flickerSeed > 0.995  // slightly more frequent than before
    }

    // Occasional micro-jitter — nearly imperceptible horizontal shift
    private var microJitter: CGFloat {
        let seed = sin(phase * 47.3) * cos(phase * 31.7)
        return seed > 0.98 ? CGFloat(sin(phase * 200)) * 1.5 : 0
    }

    private var flickerType: Int {
        Int(abs(sin(phase * 7.3)) * 3) % 3
    }

    func body(content: Content) -> some View {
        if isFlickering {
            switch flickerType {
            case 0:
                // Horizontal displacement — holographic glitch
                let shift = sin(phase * 100) * 4
                content
                    .offset(x: shift)
                    .colorMultiply(Color(red: 0.88, green: 0.98, blue: 1.05))
            case 1:
                // Scan band — horizontal bar of distortion
                content
                    .overlay(
                        FlickerBandView(phase: phase)
                    )
            default:
                // Brief opacity dip — "power fluctuation"
                let dip = 0.85 + sin(phase * 150) * 0.15
                content
                    .opacity(dip)
            }
        } else {
            content
                .offset(x: microJitter)
        }
    }
}

struct FlickerBandView: View {
    let phase: Double

    var body: some View {
        GeometryReader { geo in
            let bandY = abs(sin(phase * 13.7)) * geo.size.height
            let bandH: CGFloat = 30 + CGFloat(abs(sin(phase * 7.1))) * 50

            ZStack {
                // Cyan tinted band
                Rectangle()
                    .fill(Color(red: 0.102, green: 0.902, blue: 0.961).opacity(0.04))
                    .frame(height: bandH)
                    .offset(x: sin(phase * 200) * 5, y: bandY)

                // White highlight at band center
                Rectangle()
                    .fill(Color.white.opacity(0.02))
                    .frame(height: 2)
                    .offset(y: bandY)
            }
        }
        .allowsHitTesting(false)
    }
}

extension View {
    func holographicFlicker(phase: Double) -> some View {
        modifier(HolographicFlickerModifier(phase: phase))
    }
}
