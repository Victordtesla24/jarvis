// File: Sources/JarvisTelemetry/JarvisRootView.swift

import SwiftUI

struct JarvisRootView: View {

    @EnvironmentObject var bridge: TelemetryBridge
    @StateObject private var phaseController = HUDPhaseController()
    @StateObject private var store = TelemetryStore()

    var body: some View {
        ZStack {
            Color.clear

            switch phaseController.phase {
            case .boot:
                BootSequenceView()
                    .environmentObject(phaseController)
                    .environmentObject(store)
                    .transition(.opacity)

            case .loop:
                AnimatedCanvasHost()
                    .environmentObject(store)
                    .environmentObject(phaseController)
                    .transition(.opacity)

            case .shutdown:
                ShutdownSequenceView()
                    .environmentObject(phaseController)
                    .environmentObject(store)
                    .transition(.opacity)

            case .standby:
                Color.clear
            }
        }
        .onAppear {
            store.bind(to: bridge)
            phaseController.startBoot(isWake: false)
        }
        .ignoresSafeArea()
    }
}
