// File: Sources/JarvisTelemetry/JarvisRootView.swift

import SwiftUI

struct JarvisRootView: View {

    @EnvironmentObject var bridge: TelemetryBridge
    @StateObject private var store = TelemetryStore()
    @State private var preloaderDone = false

    var body: some View {
        ZStack {
            // Strict transparency — base wallpaper color bleeds through
            Color.clear

            if !preloaderDone {
                JarvisPreloaderView {
                    withAnimation(.easeInOut(duration: 0.6)) {
                        preloaderDone = true
                    }
                }
                .transition(.opacity)
            } else {
                AnimatedCanvasHost()
                    .environmentObject(store)
                    .transition(.opacity)
            }
        }
        .onAppear {
            store.bind(to: bridge)
        }
        .ignoresSafeArea()
    }
}
