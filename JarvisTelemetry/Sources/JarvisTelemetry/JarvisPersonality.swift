// File: Sources/JarvisTelemetry/JarvisPersonality.swift
// JARVIS Living System — Battery-reactive personality with cinematic state machine
// Marvel Studios quality — every state transition is a visual event

import Foundation
import Combine
import SwiftUI
import AppKit

enum JarvisPersonalityState: String {
    case nominal       = "NOMINAL"
    case attentive     = "ATTENTIVE"
    case strained      = "STRAINED"
    case powerLow      = "POWER LOW"
    case critical      = "CRITICAL"
    case powerCritical = "POWER CRITICAL"
    case sleep         = "SLEEP"
    case shutdown      = "SHUTDOWN"
}

extension JarvisPersonalityState: Comparable {
    static func < (lhs: JarvisPersonalityState, rhs: JarvisPersonalityState) -> Bool {
        let order: [JarvisPersonalityState] = [
            .nominal, .attentive, .strained, .powerLow, .critical, .powerCritical, .sleep, .shutdown
        ]
        return order.firstIndex(of: lhs)! < order.firstIndex(of: rhs)!
    }
}

// MARK: - Cinematic Wake Phase Machine
/// Five-phase cinematic sequence that plays when charger connects after power-depleted state
enum CinematicWakePhase: Equatable {
    case inactive
    case lightningBurst       // 0.0–1.5s: high-voltage lightning sparks across screen
    case shakeAndMaxBloom     // 1.5–4.5s: max core bloom, violent shake, all systems surge
    case ringOverdrive        // 4.5–7.5s: rings at 5x speed, overdrive color
    case normalizing          // 7.5–9.5s: smooth interpolation back to nominal
}

final class JarvisPersonality: ObservableObject {
    @Published var state: JarvisPersonalityState = .nominal

    // ─── Animation modifiers consumed by view layer ────────────────────────────
    @Published var rotationSpeedMultiplier: Double = 1.0
    @Published var particleBirthRate: Float = 12
    @Published var coreGlowColor: Color = Color(red: 0.102, green: 0.902, blue: 0.961)
    @Published var scanLineFrequencyMultiplier: Double = 1.0
    @Published var isPulsing: Bool = false
    @Published var coreOpacity: Double = 1.0
    @Published var outerRingStutter: Bool = false
    @Published var isFlickering: Bool = false
    @Published var reverseScan: Bool = false
    @Published var shouldHideChatter: Bool = false
    @Published var isShaking: Bool = false
    @Published var shakeIntensity: Double = 0.0       // 0.0–1.0 drives offset magnitude

    // ─── Cinematic Charging Wake ───────────────────────────────────────────────
    /// Current phase of the cinematic wake sequence (inactive when no event is playing)
    @Published var cinematicWakePhase: CinematicWakePhase = .inactive
    /// Toggled true for ~100ms when lightning burst should fire (CAEmitterLayer trigger)
    @Published var triggerLightningSparkBurst: Bool = false
    /// Multiplier on core bloom radius/intensity (1.0 nominal → 3.0 peak overdrive)
    @Published var coreBloomOverdriveScale: Double = 1.0

    // ─── Private state ─────────────────────────────────────────────────────────
    private var wasPowerDepletedBeforeCharge: Bool = false
    private var cinematicWakeStartDate: Date?
    private var lastChargingState: Bool?
    private var cancellables = Set<AnyCancellable>()
    private weak var store: TelemetryStore?

    init(store: TelemetryStore? = nil) {
        self.store = store
        // 30Hz evaluation — fast enough for animation reactivity, cheap on CPU
        Timer.publish(every: 1.0 / 30.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in self?.evaluateState() }
            .store(in: &cancellables)
    }

    func bind(to store: TelemetryStore) {
        self.store = store
    }

    // MARK: - State Machine

    private func evaluateState() {
        guard let store = store else { return }

        let cpuLoad = store.cpuUsagePercent / 100.0
        let thermal = store.thermalState.lowercased()

        // ── Battery reading via pmset (debounced at 30Hz, ~1ms overhead) ──────
        var batteryPercent: Double = 100.0
        var isCharging: Bool = true
        let battOutput = shell("pmset -g batt")
        if let pctRange = battOutput.range(of: "(\\d+)%", options: .regularExpression),
           let pct = Double(battOutput[pctRange].dropLast()) {
            batteryPercent = pct
        }
        if battOutput.contains("discharging") { isCharging = false }

        let idleTime = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: CGEventType(rawValue: 14)!)

        // ── Priority-ordered state evaluation ─────────────────────────────────
        var nextState: JarvisPersonalityState = .nominal
        if batteryPercent < 5 && !isCharging {
            nextState = .powerCritical
        } else if cpuLoad > 0.95 || thermal == "critical" {
            nextState = .critical
        } else if batteryPercent < 20 && !isCharging {
            nextState = .powerLow
        } else if cpuLoad > 0.80 || thermal == "serious" {
            nextState = .strained
        } else if idleTime > 300 {
            nextState = .attentive
        } else if thermal == "nominal" && cpuLoad < 0.60 && batteryPercent > 20 {
            nextState = .nominal
        }

        // Track whether we were power-depleted before charger connects
        if nextState == .powerCritical || nextState == .powerLow {
            wasPowerDepletedBeforeCharge = true
        }

        // ── Cinematic Charging Wake: fires when charger connects after depletion ──
        if let last = lastChargingState, !last && isCharging && wasPowerDepletedBeforeCharge {
            wasPowerDepletedBeforeCharge = false
            triggerCinematicWake()
        }
        lastChargingState = isCharging

        // ── Apply state (skip personality overrides during cinematic wake) ─────
        let inOverdrive = (cinematicWakePhase != .inactive)
        if nextState != self.state && !inOverdrive {
            logTransition(from: self.state, to: nextState)
            withAnimation(.easeInOut(duration: 0.8)) {
                self.applyStateEffects(nextState)
                self.state = nextState
            }
        } else if !inOverdrive {
            self.applyStateEffects(nextState)
        }

        // ── Drive cinematic wake phase machine ────────────────────────────────
        updateCinematicWakePhase()
    }

    // MARK: - Cinematic Wake Sequence

    private func triggerCinematicWake() {
        cinematicWakeStartDate = Date()
        cinematicWakePhase = .lightningBurst

        // Pulse the lightning trigger flag for one brief window
        triggerLightningSparkBurst = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
            self.triggerLightningSparkBurst = false
        }

        logTransition(from: .powerCritical, to: .nominal)
    }

    private func updateCinematicWakePhase() {
        guard let start = cinematicWakeStartDate else { return }
        let elapsed = Date().timeIntervalSince(start)

        // Phase boundaries (seconds from wake trigger)
        let newPhase: CinematicWakePhase
        switch elapsed {
        case ..<1.5:   newPhase = .lightningBurst
        case ..<4.5:   newPhase = .shakeAndMaxBloom
        case ..<7.5:   newPhase = .ringOverdrive
        case ..<9.5:   newPhase = .normalizing
        default:       newPhase = .inactive
        }

        if cinematicWakePhase != newPhase {
            withAnimation(.easeInOut(duration: 0.25)) {
                cinematicWakePhase = newPhase
            }
        }

        // ── Per-phase animation overrides ─────────────────────────────────────
        switch newPhase {

        case .inactive:
            cinematicWakeStartDate = nil
            isShaking = false
            shakeIntensity = 0.0
            coreBloomOverdriveScale = 1.0
            // Smooth return to natural state via applyStateEffects on next tick

        case .lightningBurst:
            // Phase 0–1.5s: High-voltage. Micro-shaking increases. Chatter returns.
            isShaking = true
            shakeIntensity = 0.2 + sin(elapsed * 45) * 0.15
            rotationSpeedMultiplier = 1.0 + elapsed * 0.7
            coreOpacity = min(1.0, 0.1 + elapsed / 1.5 * 0.9)
            particleBirthRate = Float(15 + elapsed * 80)
            shouldHideChatter = false
            coreGlowColor = .white
            coreBloomOverdriveScale = 1.0 + elapsed * 0.6
            isFlickering = false

        case .shakeAndMaxBloom:
            // Phase 1.5–4.5s: PEAK — reactor wakes fully juiced, max shake, white core
            let phaseT = (elapsed - 1.5) / 3.0
            isShaking = true
            shakeIntensity = 1.0 - phaseT * 0.25
            rotationSpeedMultiplier = 4.5 + sin(elapsed * 10) * 0.8
            coreOpacity = 1.0
            particleBirthRate = Float(200 - phaseT * 20)
            coreGlowColor = .white
            coreBloomOverdriveScale = 3.0 - phaseT * 0.4
            shouldHideChatter = false

        case .ringOverdrive:
            // Phase 4.5–7.5s: Rings at max speed, shake tapering, color cooling
            let phaseT = (elapsed - 4.5) / 3.0
            isShaking = phaseT < 0.5
            shakeIntensity = phaseT < 0.5 ? (0.5 - phaseT) * 1.2 : 0
            rotationSpeedMultiplier = 5.0 - phaseT * 3.0   // 5x → 2x
            coreOpacity = 1.0
            particleBirthRate = Float(180 - phaseT * 100)
            coreGlowColor = Color(red: 0.7 + phaseT * 0.15, green: 0.95, blue: 1.0)
            coreBloomOverdriveScale = 2.6 - phaseT * 1.0

        case .normalizing:
            // Phase 7.5–9.5s: Smooth interpolation back to nominal
            let phaseT = (elapsed - 7.5) / 2.0
            isShaking = false
            shakeIntensity = 0
            rotationSpeedMultiplier = max(1.0, 2.0 - phaseT * 1.0)
            coreOpacity = 1.0
            particleBirthRate = Float(max(12, 80 - phaseT * 68))
            coreGlowColor = Color(red: 0.102, green: 0.902, blue: 0.961)
            coreBloomOverdriveScale = max(1.0, 1.6 - phaseT * 0.6)
        }
    }

    // MARK: - Personality State Effects

    private func applyStateEffects(_ newState: JarvisPersonalityState) {
        // Never override cinematic wake animations
        guard cinematicWakePhase == .inactive else { return }

        // Reset to nominal baseline
        rotationSpeedMultiplier = 1.0
        particleBirthRate = 12
        coreGlowColor = Color(red: 0.102, green: 0.902, blue: 0.961)
        scanLineFrequencyMultiplier = 1.0
        isPulsing = false
        coreOpacity = 1.0
        outerRingStutter = false
        isFlickering = false
        reverseScan = false
        shouldHideChatter = false
        isShaking = false
        shakeIntensity = 0.0
        coreBloomOverdriveScale = 1.0

        switch newState {
        case .nominal, .sleep, .shutdown:
            break

        case .attentive:
            isPulsing = true
            reverseScan = true

        case .strained:
            rotationSpeedMultiplier = 1.8
            particleBirthRate = 40
            coreGlowColor = Color.orange
            scanLineFrequencyMultiplier = 2.0

        case .critical:
            particleBirthRate = 80
            coreGlowColor = Color.red

        case .powerLow:
            rotationSpeedMultiplier = 0.4
            coreOpacity = 0.4
            particleBirthRate = 3
            outerRingStutter = true

        case .powerCritical:
            // JARVIS partial shutdown — dims like dying, chatter goes silent
            rotationSpeedMultiplier = 0.08
            isFlickering = true
            coreOpacity = 0.07
            shouldHideChatter = true
            particleBirthRate = 0
            coreGlowColor = Color(red: 0.0, green: 0.25, blue: 0.4)
        }
    }

    // MARK: - Logging

    private func logTransition(from: JarvisPersonalityState, to: JarvisPersonalityState) {
        let logLine = "[\(Date().description)] Transition: \(from.rawValue) -> \(to.rawValue)\n"
        let logURL = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/JarvisTelemetry/personality.log")
        do {
            let dir = logURL.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            if FileManager.default.fileExists(atPath: logURL.path) {
                let fh = try FileHandle(forWritingTo: logURL)
                fh.seekToEndOfFile()
                fh.write(logLine.data(using: .utf8)!)
                fh.closeFile()
            } else {
                try logLine.write(to: logURL, atomically: true, encoding: .utf8)
            }
        } catch {
            print("Failed to log personality transition: \(error)")
        }
    }

    @discardableResult
    private func shell(_ command: String) -> String {
        let task = Process()
        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = pipe
        task.arguments = ["-c", command]
        task.executableURL = URL(fileURLWithPath: "/bin/zsh")
        do {
            try task.run()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            return String(data: data, encoding: .utf8) ?? ""
        } catch { return "" }
    }
}
