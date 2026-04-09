// File: Sources/JarvisTelemetry/ChatterEngine.swift

import SwiftUI
import Combine

struct ChatterLine: Identifiable {
    let id = UUID()
    let text: String
    let color: Color
    let timestamp: Date
    let severity: DeltaSeverity
}

final class ChatterEngine: ObservableObject {
    @Published var primaryLines: [ChatterLine] = []
    @Published var secondaryLines: [ChatterLine] = []

    private var cancellables = Set<AnyCancellable>()
    private var ambientTimer: AnyCancellable?
    private var lastAmbientIndex = 0
    private let maxLines = 15
    private let cyan = Color(red: 0.00, green: 0.83, blue: 1.00)
    private let amber = Color(red: 1.00, green: 0.78, blue: 0.00)
    private let crimson = Color(red: 1.00, green: 0.15, blue: 0.20)

    func bind(to store: TelemetryStore) {
        store.$latestDeltas
            .receive(on: DispatchQueue.main)
            .sink { [weak self] deltas in
                for delta in deltas {
                    let color: Color
                    switch delta.severity {
                    case .info: color = self?.cyan ?? .cyan
                    case .warning: color = self?.amber ?? .yellow
                    case .critical: color = self?.crimson ?? .red
                    }
                    self?.addPrimary(delta.label, color: color, severity: delta.severity)
                }
            }
            .store(in: &cancellables)

        ambientTimer = Timer.publish(every: 4.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self, weak store] _ in
                guard let self, let store else { return }
                self.generateAmbientLine(store: store)
            }
    }

    private func addPrimary(_ text: String, color: Color, severity: DeltaSeverity) {
        let line = ChatterLine(text: text, color: color, timestamp: Date(), severity: severity)
        primaryLines.append(line)
        if primaryLines.count > maxLines {
            primaryLines.removeFirst(primaryLines.count - maxLines)
        }
    }

    private func addSecondary(_ text: String, color: Color = Color(red: 0, green: 0.83, blue: 1.0)) {
        let line = ChatterLine(text: text, color: color, timestamp: Date(), severity: .info)
        secondaryLines.append(line)
        if secondaryLines.count > 10 {
            secondaryLines.removeFirst(secondaryLines.count - 10)
        }
    }

    private func generateAmbientLine(store: TelemetryStore) {
        let lines: [String] = [
            String(format: "MEMORY PRESSURE: %.1f GB / %.0f GB ALLOCATED", store.memoryUsedGB, store.memoryTotalGB),
            String(format: "THERMAL COST: +%.1f\u{00B0}C ABOVE 50\u{00B0}C BASELINE", store.cctcDeltaC),
            String(format: "UMA EVICTION RATE: %.2f MB/s — %@", store.gumerMBs, store.gumerMBs < 2.0 ? "NOMINAL" : "ELEVATED"),
            String(format: "GPU COMPLEX: %.0f%% UTILIZATION — %d CORES", store.gpuUsage * 100, store.gpuCoreCount),
            String(format: "ANE SUBSYSTEM: %.2fW — %@", store.anePower, store.anePower < 0.1 ? "STANDBY" : "ACTIVE"),
            String(format: "DRAM READ BW: %.1f GB/s", store.dramReadBW),
            String(format: "DRAM WRITE BW: %.1f GB/s", store.dramWriteBW),
            String(format: "HYPERVISOR TAX: %.2f%% — DVHOP %@", store.dvhopCPUPct, store.dvhopCPUPct < 1.0 ? "NOMINAL" : "ELEVATED"),
            String(format: "TELEMETRY FRAME: #%d", store.frameCount),
            String(format: "SWAP UTILIZATION: %.1f GB ACTIVE", store.swapUsedGB),
            String(format: "CPU AGGREGATE: %.0f%% — %d CORES ACTIVE", store.cpuUsagePercent, store.totalCoreCount),
            String(format: "GPU FREQ: %.0f MHz", store.gpuFreqMHz),
        ]

        let idx = lastAmbientIndex % lines.count
        addSecondary(lines[idx])
        lastAmbientIndex += 1
    }
}
