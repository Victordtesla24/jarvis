// File: Sources/JarvisTelemetry/ProcessLifecycleObserver.swift

import AppKit
import Combine

final class ProcessLifecycleObserver {

    private let phaseController: HUDPhaseController
    private let bridge: TelemetryBridge
    private var cancellables = Set<AnyCancellable>()

    init(phaseController: HUDPhaseController, bridge: TelemetryBridge) {
        self.phaseController = phaseController
        self.bridge = bridge
        setupNotifications()
        setupSignalHandlers()
    }

    private func setupNotifications() {
        let ws = NSWorkspace.shared.notificationCenter

        ws.publisher(for: NSWorkspace.willSleepNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.phaseController.startShutdown() }
            .store(in: &cancellables)

        ws.publisher(for: NSWorkspace.didWakeNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.phaseController.wakeFromStandby() }
            .store(in: &cancellables)

        ws.publisher(for: NSWorkspace.sessionDidResignActiveNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.phaseController.startShutdown() }
            .store(in: &cancellables)

        ws.publisher(for: NSWorkspace.sessionDidBecomeActiveNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.phaseController.wakeFromStandby() }
            .store(in: &cancellables)
    }

    private func setupSignalHandlers() {
        signal(SIGTERM) { _ in
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: .jarvisGracefulShutdown, object: nil)
            }
        }

        signal(SIGINT) { _ in
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: .jarvisGracefulShutdown, object: nil)
            }
        }

        NotificationCenter.default.publisher(for: .jarvisGracefulShutdown)
            .first()
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self else { return }
                self.phaseController.startShutdown()
                DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) {
                    self.bridge.stop()
                    NSApp.terminate(nil)
                }
            }
            .store(in: &cancellables)
    }
}

extension Notification.Name {
    static let jarvisGracefulShutdown = Notification.Name("jarvisGracefulShutdown")
}
