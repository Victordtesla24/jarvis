// File: Sources/JarvisTelemetry/FloatingPanelManager.swift

import SwiftUI
import Combine

struct FloatingPanel: Identifiable {
    let id = UUID()
    let content: FloatingPanelContent
    let position: CGPoint
    let startTime: Date
    let lifetime: Double
}

enum FloatingPanelContent {
    case coreTopo([Double], [Double], [Double])
    case thermalGradient(Double, Double)
    case memoryBreakdown(Double, Double, Double)
    case powerBudget(Double, Double, Double)
    case systemSnapshot(String, Int, Double, String)
}

final class FloatingPanelManager: ObservableObject {
    @Published var panels: [FloatingPanel] = []

    private var cancellables = Set<AnyCancellable>()
    private var contentIndex = 0

    func bind(to store: TelemetryStore) {
        Timer.publish(every: 10.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self, weak store] _ in
                guard let self, let store else { return }
                self.spawnPanel(store: store)
            }
            .store(in: &cancellables)

        Timer.publish(every: 1.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.panels.removeAll { Date().timeIntervalSince($0.startTime) > $0.lifetime + 1.0 }
            }
            .store(in: &cancellables)
    }

    private func spawnPanel(store: TelemetryStore) {
        guard panels.count < 2 else { return }

        let contents: [FloatingPanelContent] = [
            .coreTopo(store.eCoreUsages, store.pCoreUsages, store.sCoreUsages),
            .thermalGradient(store.cpuTemp, store.gpuTemp),
            .memoryBreakdown(store.memoryUsedGB, store.memoryTotalGB, store.swapUsedGB),
            .powerBudget(store.totalPower, store.anePower, store.gpuFreqMHz),
            .systemSnapshot(store.chipName, store.totalCoreCount, store.memoryTotalGB, store.thermalState),
        ]

        let content = contents[contentIndex % contents.count]
        contentIndex += 1

        let screenW = NSScreen.main?.frame.width ?? 1920
        let screenH = NSScreen.main?.frame.height ?? 1080
        let x = screenW * (0.30 + Double.random(in: 0...0.40))
        let y = screenH * (0.25 + Double.random(in: 0...0.30))

        panels.append(FloatingPanel(
            content: content,
            position: CGPoint(x: x, y: y),
            startTime: Date(),
            lifetime: Double.random(in: 5...8)
        ))
    }
}

struct FloatingPanelOverlay: View {
    @ObservedObject var manager: FloatingPanelManager
    let cyan: Color
    let amber: Color

    var body: some View {
        ForEach(manager.panels) { panel in
            FloatingPanelView(panel: panel, cyan: cyan, amber: amber)
        }
    }
}

struct FloatingPanelView: View {
    let panel: FloatingPanel
    let cyan: Color
    let amber: Color

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0/30.0)) { timeline in
            let elapsed = timeline.date.timeIntervalSince(panel.startTime)
            let materialize = min(1.0, elapsed / 0.5)
            let dissolveStart = panel.lifetime - 0.5
            let dissolve = elapsed > dissolveStart ? min(1.0, (elapsed - dissolveStart) / 0.5) : 0.0
            let opacity = materialize * (1.0 - dissolve)
            let scale = 0.7 + materialize * 0.3

            VStack(alignment: .leading, spacing: 4) {
                panelContent
            }
            .padding(10)
            .background(Color.black.opacity(0.55 * opacity))
            .overlay(
                RoundedRectangle(cornerRadius: 3)
                    .stroke(cyan.opacity(0.25 * opacity), lineWidth: 0.5)
            )
            .scaleEffect(scale)
            .opacity(opacity)
            .position(panel.position)
        }
    }

    @ViewBuilder
    private var panelContent: some View {
        switch panel.content {
        case .coreTopo(let e, let p, _):
            Text("CORE TOPOLOGY")
                .font(.custom("Menlo", size: 7)).tracking(3).foregroundColor(cyan.opacity(0.5))
            HStack(spacing: 2) {
                ForEach(Array(e.enumerated()), id: \.offset) { _, val in
                    Rectangle().fill(cyan.opacity(val * 0.6)).frame(width: 3, height: max(1, CGFloat(val * 20)))
                }
                Spacer().frame(width: 4)
                ForEach(Array(p.enumerated()), id: \.offset) { _, val in
                    Rectangle().fill(amber.opacity(val * 0.6)).frame(width: 3, height: max(1, CGFloat(val * 20)))
                }
            }
            .frame(height: 20, alignment: .bottom)

        case .thermalGradient(let cpu, let gpu):
            Text("THERMAL").font(.custom("Menlo", size: 7)).tracking(3).foregroundColor(cyan.opacity(0.5))
            Text(String(format: "CPU: %.1f\u{00B0}C  GPU: %.1f\u{00B0}C", cpu, gpu))
                .font(.custom("Menlo", size: 10)).foregroundColor(cpu > 50 ? amber : cyan)

        case .memoryBreakdown(let used, let total, let swap):
            Text("MEMORY").font(.custom("Menlo", size: 7)).tracking(3).foregroundColor(cyan.opacity(0.5))
            Text(String(format: "%.1f / %.0f GB", used, total))
                .font(.custom("Menlo", size: 10)).foregroundColor(cyan.opacity(0.7))
            if swap > 0.01 {
                Text(String(format: "SWAP: %.2f GB", swap))
                    .font(.custom("Menlo", size: 8)).foregroundColor(amber.opacity(0.5))
            }

        case .powerBudget(let total, let ane, _):
            Text("POWER BUDGET").font(.custom("Menlo", size: 7)).tracking(3).foregroundColor(cyan.opacity(0.5))
            Text(String(format: "TOTAL: %.1fW  ANE: %.2fW", total, ane))
                .font(.custom("Menlo", size: 10)).foregroundColor(cyan.opacity(0.7))

        case .systemSnapshot(let chip, let cores, let mem, let thermal):
            Text("SYSTEM").font(.custom("Menlo", size: 7)).tracking(3).foregroundColor(cyan.opacity(0.5))
            Text("\(chip) \u{2022} \(cores) CORES")
                .font(.custom("Menlo", size: 9)).foregroundColor(cyan.opacity(0.6))
            Text(String(format: "%.0f GB \u{2022} %@", mem, thermal.uppercased()))
                .font(.custom("Menlo", size: 9)).foregroundColor(cyan.opacity(0.5))
        }
    }
}
