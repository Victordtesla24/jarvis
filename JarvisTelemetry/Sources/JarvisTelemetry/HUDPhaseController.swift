// File: Sources/JarvisTelemetry/HUDPhaseController.swift
// State machine governing JARVIS HUD lifecycle phases.
// BOOT → LOOP → SHUTDOWN → STANDBY, plus LOCK_SCREEN for
// animated lock overlay.
// Ref: 2026-04-09-jarvis-cinematic-hud-design.md §1

import SwiftUI
import Combine

/// HUD lifecycle phases
enum HUDPhase: Equatable {
    /// Boot sequence — isWake: true = 3-4s abbreviated, false = 8-12s theatrical
    case boot(isWake: Bool)
    /// Main live HUD phase — reactor spinning, telemetry active
    case loop
    /// Cinematic shutdown sequence
    case shutdown
    /// Static standby — wallpaper PNG set, app window transparent
    case standby
    /// Animated lock screen overlay
    case lockScreen
}

/// Central controller for HUD phase transitions.
/// Drives boot/shutdown progress for timed animation sequences.
final class HUDPhaseController: ObservableObject {

    @Published var phase: HUDPhase = .boot(isWake: false)
    /// 0.0 → 1.0 progress during boot sequence
    @Published var bootProgress: Double = 0
    /// 0.0 → 1.0 progress during shutdown sequence
    @Published var shutdownProgress: Double = 0

    let lockScreenManager = LockScreenManager()
    private var timer: AnyCancellable?

    /// Completion callback — fired when boot sequence finishes
    var onBootComplete: (() -> Void)?
    /// Completion callback — fired when shutdown sequence finishes
    var onShutdownComplete: (() -> Void)?

    /// Duration of current boot sequence
    var bootDuration: Double {
        phase == .boot(isWake: true)
            ? JARVISNominalState.bootDurationWake
            : JARVISNominalState.bootDurationFull
    }

    // MARK: - Boot

    /// Start boot sequence
    func startBoot(isWake: Bool = false) {
        phase = .boot(isWake: isWake)
        bootProgress = 0
        let duration = isWake
            ? JARVISNominalState.bootDurationWake
            : JARVISNominalState.bootDurationFull
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

    // MARK: - Shutdown

    /// Start shutdown sequence (only from LOOP phase)
    func startShutdown() {
        NSLog("[HUDPhaseController] startShutdown() called, current phase=\(phase)")
        guard phase == .loop else {
            NSLog("[HUDPhaseController]   guard failed — phase is not .loop, ignoring")
            return
        }
        phase = .shutdown
        NSLog("[HUDPhaseController]   phase now .shutdown")
        shutdownProgress = 0
        let duration = JARVISNominalState.shutdownDuration
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

    // MARK: - Lock Screen

    /// Enter lock screen phase (animated overlay)
    func enterLockScreen() {
        NSLog("[HUDPhaseController] enterLockScreen() called, current phase=\(phase)")
        guard phase == .loop || phase == .standby else {
            NSLog("[HUDPhaseController]   guard failed — phase is not .loop or .standby, ignoring")
            return
        }
        withAnimation(.easeInOut(duration: 0.3)) {
            phase = .lockScreen
        }
        NSLog("[HUDPhaseController]   phase now .lockScreen")
    }

    /// Exit lock screen — return directly to .loop without the 3.5s wake-boot
    /// detour, so integration tests can drive the phase back to live reactor
    /// without re-entering BootSequenceView.
    func exitLockScreen() {
        NSLog("[HUDPhaseController] exitLockScreen() called, current phase=\(phase)")
        guard phase == .lockScreen else {
            NSLog("[HUDPhaseController]   guard failed — phase is not .lockScreen, ignoring")
            return
        }
        withAnimation(.easeInOut(duration: 0.4)) {
            phase = .loop
        }
        NSLog("[HUDPhaseController]   phase now .loop (direct exit, no wake boot)")
    }

    // MARK: - Transitions

    private func transitionToLoop() {
        withAnimation(.easeInOut(duration: 0.6)) {
            phase = .loop
        }
        onBootComplete?()
    }

    private func transitionToStandby() {
        lockScreenManager.setStandbyWallpaper()
        phase = .standby
        onShutdownComplete?()
    }

    /// Wake from standby — start abbreviated boot
    func wakeFromStandby() {
        startBoot(isWake: true)
    }
}
