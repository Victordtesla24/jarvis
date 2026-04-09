// File: Sources/JarvisTelemetry/BootSequenceView.swift

import SwiftUI

struct BootSequenceView: View {
    @EnvironmentObject var phaseController: HUDPhaseController
    @EnvironmentObject var store: TelemetryStore

    var body: some View {
        // Stub — full implementation in Task 5
        Color(red: 0.02, green: 0.04, blue: 0.08)
            .ignoresSafeArea()
    }
}
