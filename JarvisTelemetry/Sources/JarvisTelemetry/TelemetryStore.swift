// File: Sources/JarvisTelemetry/TelemetryStore.swift
// Transforms raw TelemetrySnapshot values into normalized rendering data.

import Foundation
import Combine

/// Represents a significant change in a telemetry value
struct TelemetryDelta {
    let metric: String
    let oldValue: Double
    let newValue: Double
    let label: String
    let severity: DeltaSeverity
}

enum DeltaSeverity {
    case info, warning, critical
}

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
    @Published var dramWriteBW:  Double = 0
    @Published var swapPressure: Double = 0
    @Published var thermalState: String = "Nominal"

    // Custom metrics
    @Published var dvhopCPUPct:  Double = 0
    @Published var gumerMBs:     Double = 0
    @Published var cctcDeltaC:   Double = 0

    // Memory (raw GB)
    @Published var memoryUsedGB:  Double = 0
    @Published var memoryTotalGB: Double = 0
    @Published var swapUsedGB:    Double = 0

    // System info
    @Published var chipName:       String = "Apple Silicon"
    @Published var eCoreCount:     Int = 0
    @Published var pCoreCount:     Int = 0
    @Published var sCoreCount:     Int = 0
    @Published var gpuCoreCount:   Int = 0
    @Published var totalCoreCount: Int = 0

    // Display strings
    @Published var timeString:   String = "--:--"

    // Aggregate metrics
    @Published var cpuUsagePercent: Double = 0
    @Published var gpuFreqMHz:     Double = 0

    // Delta events (consumed by ChatterEngine)
    @Published var latestDeltas: [TelemetryDelta] = []

    // Snapshot counter
    @Published var frameCount: Int = 0

    private var cancellables = Set<AnyCancellable>()

    // Previous values for delta detection
    private var prevTotalPower: Double = 0
    private var prevCpuTemp: Double = 0
    private var prevGpuTemp: Double = 0
    private var prevSwapPressure: Double = 0

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

        // System info
        chipName = info.name
        eCoreCount = info.eCoreCount
        pCoreCount = info.pCoreCount
        sCoreCount = info.sCoreCount
        gpuCoreCount = info.gpuCoreCount
        totalCoreCount = info.coreCount

        // Partition cores by cluster type
        eCoreUsages = Array(allCores.prefix(info.eCoreCount)).map { $0 / 100.0 }
        pCoreUsages = Array(allCores.dropFirst(info.eCoreCount).prefix(info.pCoreCount)).map { $0 / 100.0 }
        sCoreUsages = Array(allCores.dropFirst(info.eCoreCount + info.pCoreCount).prefix(info.sCoreCount)).map { $0 / 100.0 }

        gpuUsage     = snap.gpuUsage / 100.0
        cpuTemp      = snap.socMetrics.cpuTemp
        gpuTemp      = snap.socMetrics.gpuTemp
        totalPower   = snap.socMetrics.totalPower
        anePower     = snap.socMetrics.anePower
        dramReadBW   = snap.socMetrics.dramReadBW
        dramWriteBW  = snap.socMetrics.dramWriteBW
        thermalState = snap.thermalState
        gpuFreqMHz   = snap.socMetrics.gpuFreqMHz
        cpuUsagePercent = snap.cpuUsage

        let swapUsed  = Double(snap.memory.swapUsed)
        let swapTotal = Double(snap.memory.swapTotal)
        swapPressure  = swapTotal > 0 ? swapUsed / swapTotal : 0

        memoryUsedGB  = Double(snap.memory.used) / 1_073_741_824.0
        memoryTotalGB = Double(snap.memory.total) / 1_073_741_824.0
        swapUsedGB    = swapUsed / 1_073_741_824.0

        dvhopCPUPct  = snap.dvhopCPUPct
        gumerMBs     = snap.gumerMBs
        cctcDeltaC   = snap.cctcDeltaC

        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        timeString = formatter.string(from: Date())

        frameCount += 1

        // Delta detection
        var deltas: [TelemetryDelta] = []

        let powerDelta = abs(totalPower - prevTotalPower)
        if powerDelta > 3 {
            let pct = prevTotalPower > 0 ? ((totalPower - prevTotalPower) / prevTotalPower * 100) : 0
            deltas.append(TelemetryDelta(
                metric: "TOTAL_POWER", oldValue: prevTotalPower, newValue: totalPower,
                label: String(format: "TOTAL POWER: %.0fW → %.0fW (%+.0f%%)", prevTotalPower, totalPower, pct),
                severity: totalPower > 40 ? .warning : .info
            ))
        }

        if abs(cpuTemp - prevCpuTemp) > 2 {
            deltas.append(TelemetryDelta(
                metric: "CPU_TEMP", oldValue: prevCpuTemp, newValue: cpuTemp,
                label: String(format: "CPU TEMP: %.1f°C → %.1f°C", prevCpuTemp, cpuTemp),
                severity: cpuTemp > 50 ? .warning : .info
            ))
        }

        if abs(gpuTemp - prevGpuTemp) > 2 {
            deltas.append(TelemetryDelta(
                metric: "GPU_TEMP", oldValue: prevGpuTemp, newValue: gpuTemp,
                label: String(format: "GPU TEMP: %.1f°C → %.1f°C", prevGpuTemp, gpuTemp),
                severity: gpuTemp > 50 ? .warning : .info
            ))
        }

        if abs(swapPressure - prevSwapPressure) > 0.05 {
            deltas.append(TelemetryDelta(
                metric: "SWAP", oldValue: prevSwapPressure, newValue: swapPressure,
                label: String(format: "SWAP PRESSURE: %.0f%% → %.0f%%", prevSwapPressure * 100, swapPressure * 100),
                severity: swapPressure > 0.25 ? .warning : .info
            ))
        }

        // Per-core spike detection (any core > 90%)
        for (i, u) in allCores.enumerated() {
            if u > 90 {
                let cluster: String
                if i < info.eCoreCount { cluster = "E-CORE \(i)" }
                else if i < info.eCoreCount + info.pCoreCount { cluster = "P-CORE \(i - info.eCoreCount)" }
                else { cluster = "S-CORE \(i - info.eCoreCount - info.pCoreCount)" }
                deltas.append(TelemetryDelta(
                    metric: "CORE_SPIKE", oldValue: 0, newValue: u,
                    label: String(format: "%@: %.0f%% UTILIZATION", cluster, u),
                    severity: .info
                ))
            }
        }

        latestDeltas = deltas

        prevTotalPower = totalPower
        prevCpuTemp = cpuTemp
        prevGpuTemp = gpuTemp
        prevSwapPressure = swapPressure
    }
}
