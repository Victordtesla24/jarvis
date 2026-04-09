// File: Sources/JarvisTelemetry/SystemMoodEngine.swift

import SwiftUI
import Combine

enum SystemMood: String, CaseIterable {
    case serene   // 0-15% load
    case calm     // 15-40%
    case active   // 40-65%
    case intense  // 65-85%
    case overdrive // 85-100%
}

final class SystemMoodEngine: ObservableObject {

    @Published var mood: SystemMood = .calm
    @Published var moodIntensity: Double = 0.3  // 0.0 (serene) -> 1.0 (overdrive), smoothed

    // Derived animation parameters (smoothly interpolated)
    @Published var ringSpeedMultiplier: Double = 1.0
    @Published var coreBPM: Double = 60.0
    @Published var particleSpeed: Double = 1.0
    @Published var glowIntensity: Double = 1.0
    @Published var chatterRate: Double = 2.0  // seconds between lines
    @Published var hexGridPulseSpeed: Double = 1.0

    // Thermal override
    @Published var thermalEscalation: Bool = false
    @Published var thermalSeverity: Double = 0  // 0 = nominal, 1 = critical

    private var cancellables = Set<AnyCancellable>()
    private var targetIntensity: Double = 0.3
    private var smoothingTimer: AnyCancellable?

    func bind(to store: TelemetryStore) {
        // Recompute mood on every telemetry update
        store.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self, weak store] _ in
                guard let self, let store else { return }
                self.recompute(store: store)
            }
            .store(in: &cancellables)

        // Smooth interpolation at 30Hz
        smoothingTimer = Timer.publish(every: 1.0/30.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.interpolate()
            }
    }

    private func recompute(store: TelemetryStore) {
        let cpuAvg: Double
        let allCores = store.eCoreUsages + store.pCoreUsages + store.sCoreUsages
        if allCores.isEmpty {
            cpuAvg = 0
        } else {
            cpuAvg = allCores.reduce(0, +) / Double(allCores.count)
        }
        let gpuLoad = store.gpuUsage
        let aggregateLoad = cpuAvg * 0.6 + gpuLoad * 0.3 + store.swapPressure * 0.1

        targetIntensity = aggregateLoad

        let thermal = store.thermalState.lowercased()
        if thermal.contains("serious") || thermal.contains("critical") {
            thermalEscalation = true
            thermalSeverity = thermal.contains("critical") ? 1.0 : 0.6
        } else {
            thermalEscalation = false
            thermalSeverity = 0
        }
    }

    private func interpolate() {
        let rate = 0.03
        moodIntensity += (targetIntensity - moodIntensity) * rate

        switch moodIntensity {
        case ..<0.15: mood = .serene
        case 0.15..<0.40: mood = .calm
        case 0.40..<0.65: mood = .active
        case 0.65..<0.85: mood = .intense
        default: mood = .overdrive
        }

        ringSpeedMultiplier = 0.7 + moodIntensity * 0.8
        coreBPM = 45.0 + moodIntensity * 75.0
        particleSpeed = 0.5 + moodIntensity * 1.5
        glowIntensity = 0.7 + moodIntensity * 0.6
        chatterRate = max(0.5, 4.0 - moodIntensity * 3.5)
        hexGridPulseSpeed = 0.5 + moodIntensity * 1.5
    }
}
