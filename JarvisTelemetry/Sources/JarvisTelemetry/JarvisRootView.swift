// File: Sources/JarvisTelemetry/JarvisRootView.swift

import SwiftUI

struct JarvisRootView: View {

    @EnvironmentObject var bridge: TelemetryBridge
    @EnvironmentObject var phaseController: HUDPhaseController
    @StateObject private var store = TelemetryStore()
    @StateObject private var moodEngine = SystemMoodEngine()

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
                    .environmentObject(moodEngine)
                    .transition(.opacity)

            case .shutdown:
                ShutdownSequenceView()
                    .environmentObject(phaseController)
                    .environmentObject(store)
                    .environmentObject(moodEngine)
                    .transition(.opacity)

            case .standby:
                Color.clear
            }
        }
        .onAppear {
            store.bind(to: bridge)
            moodEngine.bind(to: store)
            phaseController.startBoot(isWake: false)
        }
        .ignoresSafeArea()
    }
}
