// File: Tests/JarvisTelemetryTests/ProcessLifecycleObserverTests.swift
// R-32: verify JARVIS_AUTO_LOCK/UNLOCK/SHUTDOWN_AFTER_MS env-var scheduling.

import XCTest
import Combine
@testable import JarvisTelemetry

@MainActor
final class ProcessLifecycleObserverTests: XCTestCase {

    private func withEnv(_ pairs: [String: String], _ body: () throws -> Void) rethrows {
        for (k, v) in pairs { setenv(k, v, 1) }
        defer { for k in pairs.keys { unsetenv(k) } }
        try body()
    }

    /// Bring HUDPhaseController into .loop synchronously so the guards in
    /// enterLockScreen / startShutdown are satisfied during the tests.
    private func makeLoopedController() -> HUDPhaseController {
        let c = HUDPhaseController()
        c.phase = .loop
        return c
    }

    func testAutoLockSchedulesEnterLockScreen() throws {
        try withEnv(["JARVIS_AUTO_LOCK_AFTER_MS": "50"]) {
            let phase = makeLoopedController()
            let bridge = TelemetryBridge()
            // Strong reference to the observer — the asyncAfter closures inside
            // setupNotifications capture [weak self] and would fire into the
            // void if we let the observer deallocate right after init.
            let observer = ProcessLifecycleObserver(phaseController: phase, bridge: bridge)
            withExtendedLifetime(observer) {} // touch so it can't be optimised away
            let exp = expectation(description: "enterLockScreen fires")
            var cancellable: AnyCancellable? = nil
            cancellable = phase.$phase.sink { p in
                if p == .lockScreen {
                    exp.fulfill()
                    cancellable?.cancel()
                }
            }
            wait(for: [exp], timeout: 1.5)
        }
    }

    func testAutoUnlockSchedulesExitLockScreen() throws {
        try withEnv(["JARVIS_AUTO_UNLOCK_AFTER_MS": "50"]) {
            let phase = makeLoopedController()
            phase.phase = .lockScreen  // force to lockScreen before wiring
            let bridge = TelemetryBridge()
            // Strong reference to the observer — the asyncAfter closures inside
            // setupNotifications capture [weak self] and would fire into the
            // void if we let the observer deallocate right after init.
            let observer = ProcessLifecycleObserver(phaseController: phase, bridge: bridge)
            withExtendedLifetime(observer) {} // touch so it can't be optimised away
            let exp = expectation(description: "exitLockScreen fires")
            var cancellable: AnyCancellable? = nil
            cancellable = phase.$phase.sink { p in
                if p != .lockScreen {
                    exp.fulfill()
                    cancellable?.cancel()
                }
            }
            wait(for: [exp], timeout: 1.5)
        }
    }

    func testAutoShutdownSchedulesStartShutdown() throws {
        try withEnv(["JARVIS_AUTO_SHUTDOWN_AFTER_MS": "50"]) {
            let phase = makeLoopedController()
            let bridge = TelemetryBridge()
            // Strong reference to the observer — the asyncAfter closures inside
            // setupNotifications capture [weak self] and would fire into the
            // void if we let the observer deallocate right after init.
            let observer = ProcessLifecycleObserver(phaseController: phase, bridge: bridge)
            withExtendedLifetime(observer) {} // touch so it can't be optimised away
            let exp = expectation(description: "startShutdown fires")
            var cancellable: AnyCancellable? = nil
            cancellable = phase.$phase.sink { p in
                if p == .shutdown {
                    exp.fulfill()
                    cancellable?.cancel()
                }
            }
            wait(for: [exp], timeout: 1.5)
        }
    }

    func testDisableLockScreenSuppressesObservers() throws {
        try withEnv(["JARVIS_DISABLE_LOCKSCREEN": "1"]) {
            let phase = HUDPhaseController()
            let bridge = TelemetryBridge()
            // Strong reference to the observer — the asyncAfter closures inside
            // setupNotifications capture [weak self] and would fire into the
            // void if we let the observer deallocate right after init.
            let observer = ProcessLifecycleObserver(phaseController: phase, bridge: bridge)
            withExtendedLifetime(observer) {} // touch so it can't be optimised away
            // Posting session resign should NOT flip phase to lockScreen.
            NSWorkspace.shared.notificationCenter.post(
                name: NSWorkspace.sessionDidResignActiveNotification,
                object: nil)
            // Give a run-loop spin.
            RunLoop.main.run(until: Date().addingTimeInterval(0.1))
            XCTAssertNotEqual(phase.phase, .lockScreen,
                              "JARVIS_DISABLE_LOCKSCREEN must suppress lock-phase from session resign")
        }
    }
}
