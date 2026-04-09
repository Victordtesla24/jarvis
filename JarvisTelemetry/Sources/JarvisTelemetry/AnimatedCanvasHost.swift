// File: Sources/JarvisTelemetry/AnimatedCanvasHost.swift
// Wraps JarvisHUDView in a SwiftUI TimelineView for a smooth, CADisplayLink-
// synchronized refresh at exactly 60fps, independent of the 1s mactop tick.
// Data updates come from TelemetryStore @Published properties.
// Animation (ring rotations, glow pulses) is driven by TimelineView.Date.

import SwiftUI

struct AnimatedCanvasHost: View {

    @EnvironmentObject var store: TelemetryStore

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { timeline in
            JarvisHUDView()
                .environmentObject(store)
                // Pass timeline.date for per-frame phase offset animations
                .environment(\.animationPhase, timeline.date.timeIntervalSinceReferenceDate)
        }
    }
}

// Environment key for animation phase propagation
private struct AnimationPhaseKey: EnvironmentKey {
    static let defaultValue: Double = 0
}

extension EnvironmentValues {
    var animationPhase: Double {
        get { self[AnimationPhaseKey.self] }
        set { self[AnimationPhaseKey.self] = newValue }
    }
}
