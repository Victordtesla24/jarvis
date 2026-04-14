// File: Sources/JarvisTelemetry/BatteryMonitor.swift
// Native IOKit battery state polling at 2 Hz (500ms interval).
// Reads battery percentage, charging state, and power source
// via IOPSCopyPowerSourcesInfo() — compatible with Apple Silicon.
// Ref: R-01.1, R-01.2

import Foundation
import Combine
import IOKit.ps

/// Monitors battery state using IOKit power source APIs at 2 Hz.
/// Publishes battery percentage, charging state, and power source type.
/// Performs edge detection on charging state transitions.
@MainActor
final class BatteryMonitor: ObservableObject {

    // MARK: - Published State

    /// Current battery charge percentage (0-100)
    @Published var batteryPercent: Int = 100

    /// Whether the battery is currently charging
    @Published var isCharging: Bool = false

    /// Power source type: "AC Power" or "Battery Power"
    @Published var powerSource: String = "AC Power"

    /// True when battery is in dying state (≤ threshold, not charging, on battery)
    @Published var isDying: Bool = false

    /// True for one cycle when charging transitions from false → true
    @Published var chargingJustAttached: Bool = false

    // MARK: - Private

    /// Previous charging state for edge detection
    private var previousChargingState: Bool = false

    /// Debounce: timestamp of last charging-attach event
    private var lastChargingAttachTime: Date = .distantPast

    /// Polling timer — fires at 2 Hz (500ms)
    private var timer: AnyCancellable?

    /// Minimum interval between charging-attach triggers (debounce)
    private let debounceInterval: TimeInterval = 0.5

    // MARK: - Lifecycle

    /// Start polling battery state at 2 Hz
    func start() {
        // Initial read
        poll()

        // Poll at 2 Hz (500ms)
        timer = Timer.publish(every: 0.5, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.poll()
            }
    }

    /// Stop polling
    func stop() {
        timer?.cancel()
        timer = nil
    }

    deinit {
        timer?.cancel()
    }

    // MARK: - IOKit Polling

    /// Read current battery state from IOKit power source info
    private func poll() {
        // Reset single-frame triggers
        chargingJustAttached = false

        guard let snapshot = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
              let sources = IOPSCopyPowerSourcesList(snapshot)?.takeRetainedValue() as? [Any],
              let firstSource = sources.first else {
            // No power source info available (desktop Mac, or API failure)
            // Default to AC power / fully charged
            batteryPercent = 100
            isCharging = false
            powerSource = "AC Power"
            isDying = false
            return
        }

        guard let desc = IOPSGetPowerSourceDescription(snapshot, firstSource as CFTypeRef)?
            .takeUnretainedValue() as? [String: Any] else {
            return
        }

        // Extract kIOPSCurrentCapacityKey
        if let capacity = desc[kIOPSCurrentCapacityKey] as? Int {
            batteryPercent = capacity
        }

        // Extract kIOPSIsChargingKey
        let nowCharging: Bool
        if let charging = desc[kIOPSIsChargingKey] as? Bool {
            nowCharging = charging
        } else {
            nowCharging = false
        }

        // Extract kIOPSPowerSourceStateKey
        if let state = desc[kIOPSPowerSourceStateKey] as? String {
            powerSource = state
        }

        // Edge detection: charging false → true
        if nowCharging && !previousChargingState {
            let now = Date()
            if now.timeIntervalSince(lastChargingAttachTime) > debounceInterval {
                chargingJustAttached = true
                lastChargingAttachTime = now
            }
        }

        previousChargingState = nowCharging
        isCharging = nowCharging

        // Dying state detection
        isDying = batteryPercent <= JARVISNominalState.batteryDyingThreshold
            && !isCharging
            && powerSource == "Battery Power"
    }
}
