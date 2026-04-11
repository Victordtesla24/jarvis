// File: Sources/JarvisTelemetry/ReactiveOverlayView.swift
// Topmost SwiftUI overlay layer for R-02 reactive text events.
// Renders every ReactiveOverlayEvent queued on ReactorAnimationController
// as a positioned, fading text label at the event's specified ring radius.
//
// Positioned at the centre of the reactor with a size large enough to
// contain all possible overlay radii. The overlay is allowsHitTesting(false)
// so it never interferes with any other layer.

import SwiftUI

struct ReactiveOverlayView: View {

    @EnvironmentObject var reactorController: ReactorAnimationController

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let cx = w / 2
            let cy = h / 2
            let maxRadius = min(w, h) * 0.42  // Matches JarvisHUDView R

            ZStack {
                ForEach(reactorController.activeOverlays) { event in
                    let r = event.ringRadius * maxRadius
                    Text(event.text)
                        .font(.custom("Menlo", size: 11).weight(.bold))
                        .tracking(2)
                        .foregroundColor(event.color)
                        .shadow(color: event.color.opacity(0.8), radius: 6)
                        .shadow(color: event.color.opacity(0.25), radius: 14)
                        .position(x: cx, y: cy - r - 18)
                        .transition(.opacity.combined(with: .scale(scale: 0.9)))
                        .animation(.easeInOut(duration: 0.3), value: event.opacity)
                }
            }
        }
        .allowsHitTesting(false)
    }
}
