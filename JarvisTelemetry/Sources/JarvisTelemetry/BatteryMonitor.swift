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

    // MARK: - Replay mode (promo video only)

    /// Frame in a battery replay timeline. Internal so tests can construct.
    struct ReplayFrame: Decodable, Equatable {
        let t: Double       // seconds from replay start
        let pct: Int        // battery percent 0-100
        let charging: Bool
    }

    /// Parsed replay frames (nil in live mode). Internal for tests.
    var replayFrames: [ReplayFrame]? = nil

    /// Wall-clock start of replay playback. Internal for tests.
    var replayStartTime: Date? = nil

    /// Index of the current frame. Internal for tests.
    var replayCursor: Int = 0

    /// Test hook — inject replay frames directly, bypassing env var + JSON.
    func injectReplayForTesting(frames: [ReplayFrame], startTime: Date = Date()) {
        replayFrames = frames
        replayStartTime = startTime
        replayCursor = 0
        previousChargingState = false
        lastChargingAttachTime = .distantPast
    }

    /// Load replay frames from JSON file if env var is set.
    /// Returns true if replay mode is active. Internal so tests can exercise
    /// the branches directly.
    func loadReplayIfRequested() -> Bool {
        guard let path = ProcessInfo.processInfo.environment["JARVIS_BATTERY_REPLAY"],
              !path.isEmpty else { return false }
        let url = URL(fileURLWithPath: path)
        guard let data = try? Data(contentsOf: url) else {
            NSLog("[BatteryMonitor] JARVIS_BATTERY_REPLAY set but cannot read \(path)")
            return false
        }
        guard let frames = try? JSONDecoder().decode([ReplayFrame].self, from: data),
              !frames.isEmpty else {
            NSLog("[BatteryMonitor] JARVIS_BATTERY_REPLAY set but failed to parse \(path)")
            return false
        }
        replayFrames = frames
        replayStartTime = Date()
        replayCursor = 0
        NSLog("[BatteryMonitor] Replay mode: \(frames.count) frames from \(path)")
        return true
    }

    /// Advance replay cursor and emit the current frame. Internal for tests.
    func pollReplay() {
        chargingJustAttached = false
        guard let frames = replayFrames,
              let start = replayStartTime else { return }
        let now = Date().timeIntervalSince(start)

        // Advance cursor to the latest frame whose t ≤ now
        while replayCursor + 1 < frames.count && frames[replayCursor + 1].t <= now {
            replayCursor += 1
        }
        let frame = frames[replayCursor]

        // Apply ±1% jitter so the value doesn't look suspiciously static.
        let jitter = Int.random(in: -1...1)
        let displayPct = max(0, min(100, frame.pct + jitter))

        let nowCharging = frame.charging

        // Reuse the live-mode edge detection logic for chargingJustAttached
        if nowCharging && !previousChargingState {
            let wallNow = Date()
            if wallNow.timeIntervalSince(lastChargingAttachTime) > debounceInterval {
                chargingJustAttached = true
                lastChargingAttachTime = wallNow
            }
        }

        batteryPercent = displayPct
        isCharging = nowCharging
        previousChargingState = nowCharging
        powerSource = nowCharging ? "AC Power" : "Battery Power"
        // R-56: evaluate isDying against the RAW frame.pct (no display
        // jitter) so the dying flag doesn't flicker at the threshold boundary.
        isDying = frame.pct <= JARVISNominalState.batteryDyingThreshold
            && !nowCharging
            && powerSource == "Battery Power"
    }

    // MARK: - Lifecycle

    /// Start polling battery state at 2 Hz (live IOKit) or from a replay
    /// file if JARVIS_BATTERY_REPLAY is set.
    func start() {
        let replayActive = loadReplayIfRequested()

        // Initial read
        if replayActive { pollReplay() } else { poll() }

        // Poll at 2 Hz (500ms)
        timer = Timer.publish(every: 0.5, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                if self.replayFrames != nil {
                    self.pollReplay()
                } else {
                    self.poll()
                }
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
