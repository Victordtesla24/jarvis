// File: Sources/JarvisTelemetry/HolographicFlicker.swift

import SwiftUI

struct HolographicFlickerModifier: ViewModifier {
    let phase: Double

    private var isFlickering: Bool {
        let flickerSeed = sin(phase * 0.037) * cos(phase * 0.023)
        return flickerSeed > 0.997
    }

    private var flickerType: Int {
        Int(abs(sin(phase * 7.3)) * 2) % 2
    }

    func body(content: Content) -> some View {
        if isFlickering {
            if flickerType == 0 {
                let shift = sin(phase * 100) * 3
                content
                    .offset(x: shift)
                    .colorMultiply(Color(red: 0.9, green: 1.0, blue: 1.1))
            } else {
                content
                    .overlay(
                        FlickerBandView(phase: phase)
                    )
            }
        } else {
            content
        }
    }
}

struct FlickerBandView: View {
    let phase: Double

    var body: some View {
        GeometryReader { geo in
            let bandY = abs(sin(phase * 13.7)) * geo.size.height
            let bandH: CGFloat = 40 + CGFloat(abs(sin(phase * 7.1))) * 40

            Rectangle()
                .fill(Color(red: 0, green: 0.83, blue: 1.0).opacity(0.03))
                .frame(height: bandH)
                .offset(x: sin(phase * 200) * 4, y: bandY)
        }
        .allowsHitTesting(false)
    }
}

extension View {
    func holographicFlicker(phase: Double) -> some View {
        modifier(HolographicFlickerModifier(phase: phase))
    }
}
