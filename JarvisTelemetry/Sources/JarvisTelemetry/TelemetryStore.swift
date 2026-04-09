// File: Sources/JarvisTelemetry/TelemetryStore.swift
// Transforms raw TelemetrySnapshot values into normalized rendering data.

import Foundation
import Combine

final class TelemetryStore: ObservableObject {

    // Normalized 0.0-1.0 ring values
    @Published var eCoreUsages:  [Double] = []
    @Published var pCoreUsages:  [Double] = []
    @Published var sCoreUsages:  [Double] = []
    @Published var gpuUsage:     Double = 0
    @Published var cpuTemp:      Double = 0
    @Published var gpuTemp:      Double = 0
    @Published var totalPower:   Double = 0
    @Published var anePower:     Double = 0
    @Published var dramReadBW:   Double = 0
    @Published var swapPressure: Double = 0
    @Published var thermalState: String = "Nominal"

    // Custom metrics
    @Published var dvhopCPUPct:  Double = 0
    @Published var gumerMBs:     Double = 0
    @Published var cctcDeltaC:   Double = 0

    // Display strings
    @Published var timeString:   String = "--:--"
    @Published var chipName:     String = "Apple M5"

    private var cancellables = Set<AnyCancellable>()

    func bind(to bridge: TelemetryBridge) {
        bridge.$snapshot
            .compactMap { $0 }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] snap in
                self?.ingest(snap)
            }
            .store(in: &cancellables)
    }

    private func ingest(_ snap: TelemetrySnapshot) {
        let info = snap.systemInfo
        let allCores = snap.coreUsages

        // Partition cores by cluster type
        let eCount = info.eCoreCount
        let pCount = info.pCoreCount
        let sCount = info.sCoreCount

        eCoreUsages = Array(allCores.prefix(eCount)).map { $0 / 100.0 }
        pCoreUsages = Array(allCores.dropFirst(eCount).prefix(pCount)).map { $0 / 100.0 }
        sCoreUsages = Array(allCores.dropFirst(eCount + pCount).prefix(sCount)).map { $0 / 100.0 }

        gpuUsage     = snap.gpuUsage / 100.0
        cpuTemp      = snap.socMetrics.cpuTemp
        gpuTemp      = snap.socMetrics.gpuTemp
        totalPower   = snap.socMetrics.totalPower
        anePower     = snap.socMetrics.anePower
        dramReadBW   = snap.socMetrics.dramReadBW
        thermalState = snap.thermalState
        chipName     = info.name

        let swapUsed  = Double(snap.memory.swapUsed)
        let swapTotal = Double(snap.memory.swapTotal)
        swapPressure  = swapTotal > 0 ? swapUsed / swapTotal : 0

        dvhopCPUPct  = snap.dvhopCPUPct
        gumerMBs     = snap.gumerMBs
        cctcDeltaC   = snap.cctcDeltaC

        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        timeString = formatter.string(from: Date())
    }
}
