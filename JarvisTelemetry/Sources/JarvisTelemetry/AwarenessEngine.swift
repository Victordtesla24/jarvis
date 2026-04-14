// File: Sources/JarvisTelemetry/AwarenessEngine.swift

import SwiftUI
import Combine

struct AwarenessPulse: Identifiable {
    let id = UUID()
    let color: Color
    let startTime: Date
    let duration: Double = 0.8
}

final class AwarenessEngine: ObservableObject {
    @Published var activePulses: [AwarenessPulse] = []

    private var cancellables = Set<AnyCancellable>()
    private var lastPulseTime = Date.distantPast
    private let cooldown: TimeInterval = 5.0

    private let cyan = Color(red: 0.102, green: 0.902, blue: 0.961)
    private let amber = Color(red: 1.00, green: 0.78, blue: 0.00)

    private var prevTempBucket = 0
    private var prevCpuBucket = 0
    private var prevGpuBucket = 0

    func bind(to store: TelemetryStore) {
        store.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self, weak store] _ in
                guard let self, let store else { return }
                self.checkThresholds(store: store)
            }
            .store(in: &cancellables)

        Timer.publish(every: 0.5, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.activePulses.removeAll { Date().timeIntervalSince($0.startTime) > $0.duration }
            }
            .store(in: &cancellables)
    }

    private func checkThresholds(store: TelemetryStore) {
        let tempBucket = store.cpuTemp > 55 ? 3 : store.cpuTemp > 50 ? 2 : store.cpuTemp > 45 ? 1 : 0
        if tempBucket != prevTempBucket {
            firePulse(color: tempBucket > prevTempBucket ? amber : cyan)
            prevTempBucket = tempBucket
        }

        let cpuAvg = (store.eCoreUsages + store.pCoreUsages + store.sCoreUsages)
            .reduce(0, +) / max(1, Double(store.eCoreUsages.count + store.pCoreUsages.count + store.sCoreUsages.count))
        let cpuBucket = cpuAvg > 0.8 ? 2 : cpuAvg > 0.5 ? 1 : 0
        if cpuBucket != prevCpuBucket {
            firePulse(color: cyan)
            prevCpuBucket = cpuBucket
        }

        let gpuBucket = store.gpuUsage > 0.9 ? 2 : store.gpuUsage > 0.6 ? 1 : 0
        if gpuBucket != prevGpuBucket {
            firePulse(color: cyan)
            prevGpuBucket = gpuBucket
        }
    }

    private func firePulse(color: Color) {
        let now = Date()
        guard now.timeIntervalSince(lastPulseTime) >= cooldown else { return }
        lastPulseTime = now
        activePulses.append(AwarenessPulse(color: color, startTime: now))
    }
}

struct AwarenessPulseOverlay: View {
    @ObservedObject var engine: AwarenessEngine
    let cx: CGFloat, cy: CGFloat

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0/60.0)) { timeline in
            Canvas { ctx, size in
                let now = timeline.date
                for pulse in engine.activePulses {
                    let elapsed = now.timeIntervalSince(pulse.startTime)
                    let progress = elapsed / pulse.duration
                    guard progress >= 0, progress < 1.0 else { continue }

                    let maxR = max(size.width, size.height) * 0.8
                    let r = progress * maxR
                    let opacity = (1.0 - progress) * 0.25
                    let width = 3.0 + progress * 2.0

                    let path = Path { p in
                        p.addArc(center: CGPoint(x: cx, y: cy), radius: r,
                                 startAngle: .zero, endAngle: .radians(.pi * 2), clockwise: false)
                    }
                    ctx.stroke(path, with: .color(pulse.color.opacity(opacity)),
                               style: StrokeStyle(lineWidth: width))
                    ctx.stroke(path, with: .color(Color.white.opacity(opacity * 0.15)),
                               style: StrokeStyle(lineWidth: width * 0.3))
                }
            }
        }
        .allowsHitTesting(false)
    }
}
