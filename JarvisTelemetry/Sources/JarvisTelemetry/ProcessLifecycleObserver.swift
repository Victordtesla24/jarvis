// File: Sources/JarvisTelemetry/ProcessLifecycleObserver.swift
// Listens for macOS lifecycle events (sleep/wake, lock/unlock, SIGTERM/SIGINT)
// and triggers appropriate HUD phase transitions.
// Ref: 2026-04-09-jarvis-cinematic-hud-design.md §1

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
    }

    private func setupNotifications() {
        let ws = NSWorkspace.shared.notificationCenter

        // Sleep → shutdown sequence
        ws.publisher(for: NSWorkspace.willSleepNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.phaseController.startShutdown() }
            .store(in: &cancellables)

        // Wake → boot (wake variant)
        ws.publisher(for: NSWorkspace.didWakeNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.phaseController.wakeFromStandby() }
            .store(in: &cancellables)

        // Session resign / become active drive the lock-screen phase. These
        // are suppressed when the integration test sets JARVIS_DISABLE_LOCKSCREEN=1
        // so the reactive animations on JarvisReactorCanvas stay visible for
        // the full capture window. The app still honours the environment's
        // actual lock state — it just doesn't re-render the lock-screen view
        // inside JARVIS while the flag is set.
        let disableLockScreen = ProcessInfo.processInfo
            .environment["JARVIS_DISABLE_LOCKSCREEN"] != nil
        if disableLockScreen {
            NSLog("[ProcessLifecycleObserver] JARVIS_DISABLE_LOCKSCREEN set — ignoring session resign/active notifications")
        } else {
            ws.publisher(for: NSWorkspace.sessionDidResignActiveNotification)
                .receive(on: DispatchQueue.main)
                .sink { [weak self] _ in self?.phaseController.enterLockScreen() }
                .store(in: &cancellables)

            ws.publisher(for: NSWorkspace.sessionDidBecomeActiveNotification)
                .receive(on: DispatchQueue.main)
                .sink { [weak self] _ in self?.phaseController.exitLockScreen() }
                .store(in: &cancellables)
        }

        // R-03 integration test hook: JARVIS_AUTO_LOCK_AFTER_MS schedules
        // a one-shot auto-transition to .lockScreen after N ms, and
        // JARVIS_AUTO_UNLOCK_AFTER_MS schedules a one-shot exit back to .loop
        // after M ms. Used by tests/run_reactive_demo.sh to capture a
        // seamless reactor -> lock screen -> reactor sequence without
        // actually locking the user's macOS session.
        if let raw = ProcessInfo.processInfo.environment["JARVIS_AUTO_LOCK_AFTER_MS"],
           let ms = Int(raw), ms > 0 {
            NSLog("[ProcessLifecycleObserver] JARVIS_AUTO_LOCK_AFTER_MS=\(ms) — scheduling lock screen")
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(ms) / 1000.0) { [weak self] in
                self?.phaseController.enterLockScreen()
            }
        }
        if let raw = ProcessInfo.processInfo.environment["JARVIS_AUTO_UNLOCK_AFTER_MS"],
           let ms = Int(raw), ms > 0 {
            NSLog("[ProcessLifecycleObserver] JARVIS_AUTO_UNLOCK_AFTER_MS=\(ms) — scheduling unlock")
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(ms) / 1000.0) { [weak self] in
                self?.phaseController.exitLockScreen()
            }
        }
        // JARVIS_AUTO_SHUTDOWN_AFTER_MS schedules a one-shot transition to
        // .shutdown phase so the integration test can capture frames of
        // ShutdownSequenceView as part of the seamless boot → live → lock
        // → shutdown demo sequence. The shutdown animation itself runs for
        // JARVISNominalState.shutdownDuration (7s) and then the app terminates.
        if let raw = ProcessInfo.processInfo.environment["JARVIS_AUTO_SHUTDOWN_AFTER_MS"],
           let ms = Int(raw), ms > 0 {
            NSLog("[ProcessLifecycleObserver] JARVIS_AUTO_SHUTDOWN_AFTER_MS=\(ms) — scheduling shutdown")
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(ms) / 1000.0) { [weak self] in
                self?.phaseController.startShutdown()
            }
        }
    }

}

extension Notification.Name {
    static let jarvisGracefulShutdown = Notification.Name("jarvisGracefulShutdown")
}
