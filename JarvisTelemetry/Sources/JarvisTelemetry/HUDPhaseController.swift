// File: Sources/JarvisTelemetry/HUDPhaseController.swift

import SwiftUI
import Combine

enum HUDPhase: Equatable {
    case boot(isWake: Bool)   // true = 3-4s wake, false = 8-12s full
    case loop
    case shutdown
    case standby
}

final class HUDPhaseController: ObservableObject {

    @Published var phase: HUDPhase = .boot(isWake: false)
    @Published var bootProgress: Double = 0       // 0.0 → 1.0 during boot
    @Published var shutdownProgress: Double = 0   // 0.0 → 1.0 during shutdown

    private var timer: AnyCancellable?

    /// Duration of current boot sequence
    var bootDuration: Double { phase == .boot(isWake: true) ? 3.5 : 10.0 }

    func startBoot(isWake: Bool = false) {
        phase = .boot(isWake: isWake)
        bootProgress = 0
        let duration = isWake ? 3.5 : 10.0
        let start = Date()
        timer?.cancel()
        timer = Timer.publish(every: 1.0/60.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                self.bootProgress = min(Date().timeIntervalSince(start) / duration, 1.0)
                if self.bootProgress >= 1.0 {
                    self.timer?.cancel()
                    self.transitionToLoop()
                }
            }
    }

    func startShutdown() {
        guard phase == .loop else { return }
        phase = .shutdown
        shutdownProgress = 0
        let duration = 7.0
        let start = Date()
        timer?.cancel()
        timer = Timer.publish(every: 1.0/60.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                self.shutdownProgress = min(Date().timeIntervalSince(start) / duration, 1.0)
                if self.shutdownProgress >= 1.0 {
                    self.timer?.cancel()
                    self.transitionToStandby()
                }
            }
    }

    private func transitionToLoop() {
        withAnimation(.easeInOut(duration: 0.6)) {
            phase = .loop
        }
    }

    private func transitionToStandby() {
        phase = .standby
    }

    func wakeFromStandby() {
        startBoot(isWake: true)
    }
}
