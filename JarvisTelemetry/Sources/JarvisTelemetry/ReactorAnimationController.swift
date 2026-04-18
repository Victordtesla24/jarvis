// File: Sources/JarvisTelemetry/ReactorAnimationController.swift
// Telemetry-reactive state machine that converts raw hardware data
// into animation parameters for the JARVIS Core Reactor.
// Consumes TelemetryStore + BatteryMonitor, publishes derived values.
// Ref: R-01.1, R-01.2, R-01.3, R-02 (reactive events)

import SwiftUI
import Combine

/// An expanding energy ripple drawn as a concentric ring on the reactor.
/// Triggered by sudden load spikes, each ripple expands from core to
/// outer ring over ~1.0s with fading opacity.
struct EnergyRipple: Identifiable {
    let id = UUID()
    var progress: Double = 0.0   // 0→1 expansion
    let intensity: Double        // birth brightness (0.3–1.0)
    let birthTime: Date = Date()
    let duration: Double = 1.0   // seconds to fully expand
}

/// Reactor animation states
enum ReactorState: Equatable {
    /// Normal operating state — parameters at JARVISNominalState values
    case nominal
    /// Battery ≤ 5%, not charging, on battery power — dimming sequence
    case dying
    /// Charging just attached — 6-phase power surge animation
    case chargingWake
    /// CPU load > 80% — elevated ring speed
    case cpuOverdrive
}

/// A transient text overlay positioned on the reactor that fades in, holds
/// for `duration` seconds, then fades out. The reactive animation controller
/// queues these and enforces a maximum of 2 concurrent overlays (oldest
/// dropped when a third arrives). Consumed by ReactiveOverlayView.
struct ReactiveOverlayEvent: Identifiable, Equatable {
    let id: UUID
    let text: String
    let color: Color
    /// Radius as a fraction of reactor max radius (0-1).
    let ringRadius: Double
    let createdAt: Date
    let duration: TimeInterval
    var opacity: Double

    init(
        id: UUID = UUID(),
        text: String,
        color: Color,
        ringRadius: Double,
        duration: TimeInterval = 1.5,
        opacity: Double = 1.0
    ) {
        self.id = id
        self.text = text
        self.color = color
        self.ringRadius = ringRadius
        self.createdAt = Date()
        self.duration = duration
        self.opacity = opacity
    }

    static func == (lhs: ReactiveOverlayEvent, rhs: ReactiveOverlayEvent) -> Bool {
        lhs.id == rhs.id
    }
}

/// Controls all reactor animation parameters based on live telemetry.
/// Consumed by JarvisHUDView and CoreReactorView to drive reactive visuals.
@MainActor
final class ReactorAnimationController: ObservableObject {

    // MARK: - Published Animation State

    /// Current reactor state
    @Published var currentState: ReactorState = .nominal

    /// Core bloom intensity (0.0 = off, 1.0 = maximum)
    @Published var bloomIntensity: CGFloat = JARVISNominalState.bloomIntensity

    /// Core bloom radius in points
    @Published var bloomRadius: CGFloat = JARVISNominalState.bloomRadius

    /// Outer ring RPM
    @Published var outerRingRPM: Double = JARVISNominalState.outerRingRPM

    /// Middle ring RPM
    @Published var middleRingRPM: Double = JARVISNominalState.middleRingRPM

    /// Inner ring RPM
    @Published var innerRingRPM: Double = JARVISNominalState.innerRingRPM

    /// Chatter character rate (chars/sec)
    @Published var chatCharRate: Double = JARVISNominalState.chatCharRate

    /// Particle birth rate
    @Published var particleBirthRate: Float = JARVISNominalState.particleBirthRate

    /// Chatter text opacity (0-1)
    @Published var chatTextOpacity: Double = 1.0

    /// Active chatter message (set during state transitions)
    @Published var statusMessage: String = ""

    /// Charging wake animation progress (0.0 = not started, 1.0 = complete)
    @Published var chargingWakeProgress: Double = 0.0

    /// Lightning effect active (for charging wake Phase 1)
    @Published var lightningActive: Bool = false

    /// Reactor shake active (for charging wake Phase 2)
    @Published var reactorShakeActive: Bool = false

    /// Reactor shake offset in points
    @Published var reactorShakeOffset: CGFloat = 0.0

    /// Bloom tint for wrong-auth (red flash)
    @Published var bloomTintRed: Bool = false

    // MARK: - Reactive Event Animation State (R-02)
    //
    // Everything below this line is consumed by JarvisReactorCanvas draw calls
    // and ReactiveOverlayView. Targets are set by `reactToTelemetry(_:)` based
    // on the classifiers on TelemetryStore, with priority ordering and
    // attack/decay interpolation described in the docs for that method.

    /// Multiplier applied to the Canvas-side ring rotation speed (1.0 = nominal).
    /// CPU/GPU spike → >1, idle → <1.
    @Published var ringSpeedMultiplier: Double = 1.0

    /// 0 = cyan (#1AE6F5), 1 = amber (#FFC800). Linearly shifts all ring
    /// fill colours via HSV hue lerp.
    @Published var ringHueShift: Double = 0.0

    /// Core glow opacity multiplier (1.0 = nominal). Idle → breathing sine,
    /// thermal critical → slight dimming.
    @Published var coreIntensity: Double = 1.0

    /// Ambient particle birth-rate multiplier. GPU surge → >1, idle → <1.
    @Published var particleDensityMultiplier: Double = 1.0

    /// Left-panel radar sweep speed multiplier. Spikes to ~3 on network events.
    @Published var radarSpeedMultiplier: Double = 1.0

    /// Expanding cyan shockwave ring drawn after all telemetry arcs.
    /// `shockwaveProgress` animates 0 → 1 across 1.2 s, then `shockwaveActive`
    /// is cleared.
    @Published var shockwaveActive: Bool = false
    @Published var shockwaveProgress: Double = 0.0

    /// When true, the Canvas applies a small jitter transform around the
    /// reactor core. `thermalDistortionAmount` controls amplitude (0-1).
    @Published var thermalDistortionActive: Bool = false
    @Published var thermalDistortionAmount: Double = 0.0

    /// Battery ring drawn at reactor R × 0.92. Progress = 0..1 charge level,
    /// hue interpolates 0 (amber, discharging) → 0.33 (green, fully charged).
    @Published var batteryRingProgress: Double = 1.0
    @Published var batteryRingHue: Double = 0.33

    /// Two-pulse scan strobe fired on disk I/O spikes.
    @Published var scanStrobeActive: Bool = false

    /// Active overlay events, displayed by ReactiveOverlayView. Capped at 2.
    @Published var activeOverlays: [ReactiveOverlayEvent] = []

    // MARK: - Continuous Reactive State (Marvel-grade)
    //
    // These properties are updated EVERY telemetry tick (1 Hz) with smooth
    // interpolation so the reactor feels organically alive — not just
    // firing discrete events but continuously breathing with the machine.

    /// Smoothed aggregate system load (0.0–1.0). Blends CPU + GPU + memory
    /// with momentum so sudden spikes ramp up fast (attack ~200ms) and
    /// decay slowly (release ~1.5s) — like a real arc reactor's energy field.
    @Published var reactorLoad: Double = 0.0

    /// Instantaneous flare intensity (0.0–1.0). Spikes to ~1.0 on sudden
    /// load deltas (>15% jump between ticks), then decays exponentially
    /// over ~0.8s. Drives core white-hot flash and ring brightness surge.
    @Published var coreFlare: Double = 0.0

    /// Per-ring-layer reactive intensity multipliers (0.0–2.0).
    /// Each ring responds to different telemetry: ring1 (outer) = GPU,
    /// ring2 = E-cores, ring3 = P-cores, ring4 = S-cores, ring5 = memory.
    @Published var ringIntensities: [Double] = [1.0, 1.0, 1.0, 1.0, 1.0]

    /// Energy ripple queue — expanding concentric rings triggered by load
    /// spikes. Each ripple has progress (0→1) and birth intensity.
    @Published var energyRipples: [EnergyRipple] = []

    /// Idle breathing phase (0→2π, continuous). When system is idle, drives
    /// a slow sine-wave modulation on core glow and ring opacity.
    @Published var breathingPhase: Double = 0.0

    /// Power flow intensity — tracks total system power draw normalized
    /// to chip TDP. Drives the brightness of structural ring bloom.
    @Published var powerFlowIntensity: Double = 0.0

    /// Spec §3.1 Ring Harmonics: 0 = normal differentiated speeds, 1 = all rings
    /// briefly synchronized. Ramps 0→1→0 over a ~2s window every 45-60s.
    /// Used by JarvisReactorCanvas to lerp per-ring `rot` multipliers toward 0.
    @Published var harmonicBlend: Double = 0.0

    // MARK: - Private

    private var cancellables = Set<AnyCancellable>()
    private var chargingWakeTimer: AnyCancellable?
    private var harmonicTimer: AnyCancellable?
    private var harmonicAnimTimer: AnyCancellable?
    private var dyingTimer: AnyCancellable?
    private var shakeTimer: AnyCancellable?
    private var continuousTimer: AnyCancellable?

    /// Previous aggregate load for delta detection (internal for testing)
    var prevReactorLoad: Double = 0.0
    /// Timestamp of last continuous update for dt calculation (internal for testing)
    var lastContinuousUpdate: Date = Date()

    // MARK: - Reactive Event State (debounce + in-flight tracking)
    //
    // `lastFiredAt` prevents a sustained high-utilisation condition from
    // re-firing the same event every telemetry tick. Each event type has
    // its own minimum re-fire interval. In-flight flags prevent concurrent
    // animations on the same property from fighting each other.

    private var lastFiredAt: [String: Date] = [:]
    private var shockwaveInFlight: Bool = false
    private var scanStrobeInFlight: Bool = false

    // MARK: - Binding

    /// Bind to telemetry sources and begin reactive updates
    func bind(to store: TelemetryStore, battery: BatteryMonitor) {
        startHarmonicsScheduler()
        // React to battery state changes
        battery.$isDying
            .removeDuplicates()
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isDying in
                guard let self else { return }
                if isDying && self.currentState != .dying {
                    self.triggerDyingState()
                } else if !isDying && self.currentState == .dying {
                    self.returnToNominal()
                }
            }
            .store(in: &cancellables)

        // React to charging attach
        battery.$chargingJustAttached
            .filter { $0 }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.triggerChargingWake()
            }
            .store(in: &cancellables)

        // React to CPU load for overdrive
        store.$cpuUsagePercent
            .receive(on: DispatchQueue.main)
            .sink { [weak self] cpuPercent in
                guard let self else { return }
                let cpuFraction = cpuPercent / 100.0
                if cpuFraction > JARVISNominalState.cpuLoadHighThreshold
                    && self.currentState == .nominal {
                    self.currentState = .cpuOverdrive
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        self.outerRingRPM = JARVISNominalState.outerRingRPM
                            + (cpuFraction - JARVISNominalState.cpuLoadHighThreshold) * 200.0
                    }
                } else if cpuFraction <= JARVISNominalState.cpuLoadHighThreshold
                    && self.currentState == .cpuOverdrive {
                    self.currentState = .nominal
                    withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                        self.outerRingRPM = JARVISNominalState.outerRingRPM
                    }
                } else if self.currentState == .cpuOverdrive {
                    // Continuously update RPM proportionally
                    let newRPM = JARVISNominalState.outerRingRPM
                        + (cpuFraction - JARVISNominalState.cpuLoadHighThreshold) * 200.0
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        self.outerRingRPM = newRPM
                    }
                }
            }
            .store(in: &cancellables)

        // React to every ingested snapshot for the full reactive event map
        // (R-02). `frameCount` ticks once per decoded telemetry line, so this
        // fires exactly once per daemon sample — no throttling needed beyond
        // the per-event debounce inside reactToTelemetry itself.
        store.$frameCount
            .receive(on: DispatchQueue.main)
            .sink { [weak self, weak store, weak battery] _ in
                guard let self, let store else { return }
                self.reactToTelemetry(store: store, battery: battery)
            }
            .store(in: &cancellables)

        // ── Continuous 60fps reactive update loop ──────────────────────────
        // This drives smooth interpolation of reactorLoad, coreFlare,
        // breathing, and energy ripples independent of the 1Hz telemetry tick.
        storeRef = store
        lastContinuousUpdate = Date()
        resumeContinuousTimer()

        // Battery ring progress follows BatteryMonitor directly so the R×0.92
        // ring on the Canvas always reflects the current charge level, even
        // when no other reactive event is firing.
        battery.$batteryPercent
            .removeDuplicates()
            .receive(on: DispatchQueue.main)
            .sink { [weak self, weak battery] percent in
                guard let self, let battery else { return }
                withAnimation(.easeInOut(duration: 0.6)) {
                    self.batteryRingProgress = max(0, min(1, Double(percent) / 100.0))
                    // Amber (hue≈0.10) when discharging, green (hue≈0.33) when
                    // charging or full. Charging is more calming, discharging
                    // reminds the user of the amp limit.
                    self.batteryRingHue = battery.isCharging ? 0.33 : 0.10
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - R-02 · Reactive Event Dispatcher
    //
    // Priority order (highest first): Thermal > Memory > CPU/GPU > Net/Disk > Battery
    // Attack ≤ 300ms, decay ≥ 2 × attack, all transitions via withAnimation.
    // No classifier is allowed to re-fire its event more than once per minRefire.

    /// Poll every classifier on TelemetryStore and fire events in priority order.
    /// Called once per ingested snapshot by the bind() subscription.
    func reactToTelemetry(store: TelemetryStore, battery: BatteryMonitor?) {
        // Skip when the app is already in a special lifecycle state — the
        // dying and chargingWake sequences own their own animations and we
        // do not want reactive events stomping on them.
        if currentState == .dying || currentState == .chargingWake {
            return
        }

        // ── 1. Thermal (highest priority) ────────────────────────────────
        switch store.thermalStateLevel {
        case .critical:
            if canFire("thermal_critical", minRefire: 6.0) {
                withAnimation(.easeInOut(duration: 0.3)) {
                    self.ringSpeedMultiplier = 0.4
                    self.coreIntensity = 0.7
                    self.ringHueShift = 0.8
                    self.thermalDistortionActive = true
                    self.thermalDistortionAmount = 0.6
                }
                fireShockwave()
                pushOverlay(
                    text: "THERMAL CRITICAL — THROTTLING",
                    color: .red,
                    ringRadius: 0.50,
                    duration: 2.5
                )
            }
        case .warning:
            if canFire("thermal_warning", minRefire: 4.0) {
                withAnimation(.easeInOut(duration: 0.3)) {
                    self.ringSpeedMultiplier = 0.6
                    self.thermalDistortionActive = true
                    self.thermalDistortionAmount = 0.4
                }
                pushOverlay(
                    text: "THERMAL WARN",
                    color: .orange,
                    ringRadius: 0.50,
                    duration: 1.5
                )
            }
        case .nominal:
            if thermalDistortionActive || ringSpeedMultiplier < 0.95 {
                withAnimation(.easeInOut(duration: 0.8)) {
                    self.thermalDistortionActive = false
                    self.thermalDistortionAmount = 0.0
                    // Only reset speed if no lower-priority event is holding it.
                }
            }
        }

        // ── 2. Memory pressure ───────────────────────────────────────────
        switch store.memoryPressureLevel {
        case .critical:
            if canFire("memory_critical", minRefire: 5.0) {
                withAnimation(.easeInOut(duration: 0.4)) {
                    self.ringHueShift = 1.0
                    self.ringSpeedMultiplier = max(self.ringSpeedMultiplier, 0.5)
                }
                pushOverlay(
                    text: "MEMORY CRITICAL",
                    color: .red,
                    ringRadius: 0.78,
                    duration: 2.0
                )
            }
        case .warning:
            if canFire("memory_warning", minRefire: 4.0) {
                withAnimation(.easeInOut(duration: 0.8)) {
                    self.ringHueShift = 0.5
                    self.ringSpeedMultiplier = 0.7
                }
            }
        case .nominal:
            // Release memory-pressure hue only if thermal isn't holding it.
            if store.thermalStateLevel == .nominal && ringHueShift > 0.05 {
                withAnimation(.easeInOut(duration: 0.3)) {
                    self.ringHueShift = 0.0
                }
            }
        }

        // ── 3. CPU spike (P-cores + E-cores) and GPU surge ────────────────
        if store.cpuPCoreSpikeActive && canFire("cpu_pcore", minRefire: 2.0) {
            fireShockwave()
            withAnimation(.spring(response: 0.12, dampingFraction: 0.55)) {
                self.ringSpeedMultiplier = min(self.ringSpeedMultiplier + 0.8, 2.5)
            }
            withAnimation(.easeOut(duration: 2.0).delay(0.3)) {
                self.ringSpeedMultiplier = 1.0
            }
        }

        if store.cpuECoreSpikeActive && canFire("cpu_ecore", minRefire: 2.0) {
            withAnimation(.easeInOut(duration: 0.2)) {
                self.ringSpeedMultiplier = max(self.ringSpeedMultiplier, 1.25)
            }
            withAnimation(.easeOut(duration: 1.5).delay(0.2)) {
                self.ringSpeedMultiplier = 1.0
            }
        }

        if store.gpuSurgeActive && canFire("gpu_surge", minRefire: 2.5) {
            withAnimation(.easeInOut(duration: 0.25)) {
                self.particleDensityMultiplier = 2.0
            }
            withAnimation(.easeOut(duration: 1.5).delay(0.3)) {
                self.particleDensityMultiplier = 1.0
            }
            pushOverlay(
                text: "GPU SURGE",
                color: Color(red: 0.41, green: 0.95, blue: 0.95),
                ringRadius: 0.84,
                duration: 1.2
            )
        }

        // ── 4. Network + disk ─────────────────────────────────────────────
        if store.networkTxSpikeActive && canFire("net_tx", minRefire: 1.5) {
            fireRadarBoost()
            let mbps = (store.netOutBytesPerSec ?? 0) / 1_000_000.0
            pushOverlay(
                text: String(format: "↑ %.1f MB/s", mbps),
                color: .cyan,
                ringRadius: 0.84,
                duration: 1.5
            )
        }

        if store.networkRxSpikeActive && canFire("net_rx", minRefire: 1.5) {
            fireRadarBoost()
            let mbps = (store.netInBytesPerSec ?? 0) / 1_000_000.0
            pushOverlay(
                text: String(format: "↓ %.1f MB/s", mbps),
                color: .cyan,
                ringRadius: 0.84,
                duration: 1.5
            )
        }

        if store.diskIOSpikeActive && canFire("disk_io", minRefire: 2.0) {
            fireScanStrobe()
            pushOverlay(
                text: "DISK I/O",
                color: .cyan,
                ringRadius: 0.50,
                duration: 1.0
            )
        }

        // ── 5. Idle (lowest priority — ceded by any other active event) ──
        if store.systemIdleActive {
            // Only enter idle visuals when nothing else is pulling us out of nominal.
            if !store.cpuPCoreSpikeActive && !store.cpuECoreSpikeActive && !store.gpuSurgeActive
                && store.memoryPressureLevel == .nominal
                && store.thermalStateLevel == .nominal {
                if canFire("idle_enter", minRefire: 10.0) {
                    withAnimation(.easeIn(duration: 1.0)) {
                        self.ringSpeedMultiplier = 0.3
                        self.particleDensityMultiplier = 0.2
                    }
                }
            }
        } else if lastFiredAt["idle_enter"] != nil
                    && store.cpuPCoreSpikeActive == false
                    && store.cpuECoreSpikeActive == false {
            // Recovering from idle — snap back to nominal.
            if ringSpeedMultiplier < 0.9 || particleDensityMultiplier < 0.9 {
                withAnimation(.easeOut(duration: 1.5)) {
                    self.ringSpeedMultiplier = 1.0
                    self.particleDensityMultiplier = 1.0
                }
                lastFiredAt.removeValue(forKey: "idle_enter")
            }
        }

        // Prune expired overlays
        pruneOverlays()
    }

    // MARK: - Continuous Reactive Update (60fps)
    //
    // Smooth interpolation engine that makes the reactor feel alive.
    // Attack/decay asymmetry: spikes ramp fast, decay is slow and organic.

    /// Test-only: has the named canFire key been recorded yet?
    func didFireForTesting(_ key: String) -> Bool {
        return lastFiredAt[key] != nil
    }

    /// Internal for testability — called at 60fps by the continuous timer.
    /// R-31: `now` is injectable for deterministic test clocks.
    func continuousReactiveUpdate(store: TelemetryStore, now: Date = Date()) {
        let dt = min(now.timeIntervalSince(lastContinuousUpdate), 0.1) // cap at 100ms
        lastContinuousUpdate = now

        guard currentState != .dying && currentState != .chargingWake else { return }

        // ── 1. Compute instantaneous aggregate load ────────────────────────
        let allCores = store.eCoreUsages + store.pCoreUsages + store.sCoreUsages
        let cpuAvg = allCores.isEmpty ? 0.0 : allCores.reduce(0, +) / Double(allCores.count)
        let gpuLoad = store.gpuUsage
        let memPressure = store.memoryTotalGB > 0 ? store.memoryUsedGB / store.memoryTotalGB : 0
        let instantLoad = min(cpuAvg * 0.50 + gpuLoad * 0.35 + memPressure * 0.15, 1.0)

        // ── 2. Asymmetric smoothing: fast attack, slow decay ───────────────
        // Attack: lerp toward target in ~200ms (factor ~12/s)
        // Decay:  lerp toward target in ~1.5s (factor ~2/s)
        let attackRate = 12.0 * dt
        let decayRate  = 2.0 * dt
        let rate = instantLoad > reactorLoad ? attackRate : decayRate
        reactorLoad += (instantLoad - reactorLoad) * min(rate, 1.0)

        // ── 3. Flare detection — sudden delta triggers white-hot flash ─────
        let loadDelta = instantLoad - prevReactorLoad
        if loadDelta > 0.12 {
            // Spike detected — flare proportional to the jump magnitude
            coreFlare = min(loadDelta * 4.0, 1.0)

            // Spawn an energy ripple if delta is significant
            if loadDelta > 0.18 && energyRipples.count < 3 {
                energyRipples.append(EnergyRipple(intensity: min(loadDelta * 3.0, 1.0)))
            }
        }
        // Decay flare exponentially (~0.8s half-life)
        coreFlare *= pow(0.1, dt / 0.8)
        if coreFlare < 0.01 { coreFlare = 0 }
        prevReactorLoad = instantLoad

        // ── 4. Per-ring intensity — each ring tracks its telemetry source ──
        let eMax = store.eCoreUsages.max() ?? 0
        let pMax = store.pCoreUsages.max() ?? 0
        let sMax = store.sCoreUsages.max() ?? 0
        let targetIntensities: [Double] = [
            0.6 + gpuLoad * 1.4,           // Ring 1 (outer): GPU
            0.6 + eMax * 1.4,              // Ring 2: E-cores
            0.6 + pMax * 1.4,              // Ring 3: P-cores
            0.6 + sMax * 1.4,              // Ring 4: S-cores
            0.6 + memPressure * 1.4        // Ring 5 (inner): memory
        ]
        for i in 0..<5 {
            let target = targetIntensities[i]
            let r = target > ringIntensities[i] ? attackRate : decayRate
            ringIntensities[i] += (target - ringIntensities[i]) * min(r, 1.0)
        }

        // ── 5. Power flow — normalized to ~60W TDP estimate ────────────────
        let targetPower = min(store.totalPower / 60.0, 1.0)
        let pRate = targetPower > powerFlowIntensity ? attackRate : decayRate
        powerFlowIntensity += (targetPower - powerFlowIntensity) * min(pRate, 1.0)

        // ── 6. Breathing phase — continuous sine for idle/low-load states ──
        // Speed slows as load increases (3s period at idle, 8s under load)
        let breathPeriod = 3.0 + reactorLoad * 5.0
        breathingPhase += (Double.pi * 2.0 / breathPeriod) * dt
        if breathingPhase > Double.pi * 2.0 { breathingPhase -= Double.pi * 2.0 }

        // ── 7. Advance + prune energy ripples ──────────────────────────────
        for i in energyRipples.indices.reversed() {
            let elapsed = now.timeIntervalSince(energyRipples[i].birthTime)
            energyRipples[i].progress = min(elapsed / energyRipples[i].duration, 1.0)
            if energyRipples[i].progress >= 1.0 {
                energyRipples.remove(at: i)
            }
        }
    }

    // MARK: - R-02 · Event firing helpers

    /// Returns true if enough time has passed since the last fire of `key`.
    /// Records the current time as the new "last fired" on success.
    private func canFire(_ key: String, minRefire: TimeInterval) -> Bool {
        let now = Date()
        if let prev = lastFiredAt[key], now.timeIntervalSince(prev) < minRefire {
            return false
        }
        lastFiredAt[key] = now
        return true
    }

    /// Expanding cyan shockwave. `shockwaveProgress` ramps 0 → 1 over 1.2 s
    /// via a Timer-driven update so the Canvas can pick up intermediate
    /// values; `shockwaveActive` is then cleared.
    ///
    /// R-23: the Timer subscription is retained via `shockwaveCancellable`
    /// so it can be cancelled on deinit or when a second shockwave overrides
    /// the first. Without this retention the previous implementation leaked
    /// one AnyCancellable per invocation.
    private var shockwaveCancellable: AnyCancellable?
    private func fireShockwave() {
        guard !shockwaveInFlight else { return }
        shockwaveInFlight = true
        shockwaveActive = true
        shockwaveProgress = 0.0
        let start = Date()
        let duration: TimeInterval = 1.2
        shockwaveCancellable?.cancel()
        shockwaveCancellable = Timer.publish(every: 1.0 / 60.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                let t = Date().timeIntervalSince(start) / duration
                if t >= 1.0 {
                    self.shockwaveProgress = 1.0
                    self.shockwaveActive = false
                    self.shockwaveInFlight = false
                    self.shockwaveCancellable?.cancel()
                    self.shockwaveCancellable = nil
                } else {
                    self.shockwaveProgress = t
                }
            }
    }

    /// 2 × 30 ms scan-strobe pulse, then reset.
    private func fireScanStrobe() {
        guard !scanStrobeInFlight else { return }
        scanStrobeInFlight = true
        scanStrobeActive = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.03) { [weak self] in
            self?.scanStrobeActive = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.04) { [weak self] in
                self?.scanStrobeActive = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.03) { [weak self] in
                    self?.scanStrobeActive = false
                    self?.scanStrobeInFlight = false
                }
            }
        }
    }

    /// Radar sweep acceleration for ~1.5 s on network events.
    private func fireRadarBoost() {
        withAnimation(.easeIn(duration: 0.15)) {
            self.radarSpeedMultiplier = 3.0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            withAnimation(.easeOut(duration: 0.8)) {
                self?.radarSpeedMultiplier = 1.0
            }
        }
    }

    /// Queue a transient text overlay. Enforces max 2 concurrent overlays;
    /// oldest is dropped when a third arrives.
    private func pushOverlay(
        text: String,
        color: Color,
        ringRadius: Double,
        duration: TimeInterval
    ) {
        let event = ReactiveOverlayEvent(
            text: text,
            color: color,
            ringRadius: ringRadius,
            duration: duration
        )
        if activeOverlays.count >= 2 {
            activeOverlays.removeFirst()
        }
        activeOverlays.append(event)
        // Schedule fade-out
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) { [weak self, id = event.id] in
            self?.activeOverlays.removeAll { $0.id == id }
        }
    }

    /// Remove overlays whose duration has elapsed. Called once per tick as a
    /// safety net in case the asyncAfter above is preempted by app pause/resume.
    private func pruneOverlays() {
        let now = Date()
        activeOverlays.removeAll { now.timeIntervalSince($0.createdAt) > $0.duration }
    }

    // MARK: - R-01.1 · Dying State

    /// Trigger the battery-low dying animation sequence
    private func triggerDyingState() {
        currentState = .dying
        statusMessage = "POWER... CRITICAL... SYSTEMS...FAILING"

        // Bloom dims over 4.0s
        withAnimation(.easeInOut(duration: JARVISNominalState.dyingBloomDuration)) {
            bloomIntensity = JARVISNominalState.dyingBloomIntensity
            bloomRadius = JARVISNominalState.dyingBloomRadius
        }

        // Chatter fades over 6.0s
        withAnimation(.easeOut(duration: JARVISNominalState.dyingChatterDuration)) {
            chatTextOpacity = 0.0
            chatCharRate = 0.0
        }

        // Rings decelerate over 8.0s
        withAnimation(.easeIn(duration: JARVISNominalState.dyingRingDuration)) {
            outerRingRPM = 0.0
            middleRingRPM = 0.0
            innerRingRPM = 0.0
        }

        // Particles fade over 3.0s
        withAnimation(.easeOut(duration: 3.0)) {
            particleBirthRate = 0.0
        }
    }

    // MARK: - R-01.2 · Charging Wake Sequence

    /// Trigger the 6-phase charging wake-up power surge
    private func triggerChargingWake() {
        guard currentState != .chargingWake else { return }
        currentState = .chargingWake
        chargingWakeProgress = 0.0

        let start = Date()
        let totalDuration = 7.0

        chargingWakeTimer?.cancel()
        chargingWakeTimer = Timer.publish(every: 1.0/60.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                let elapsed = Date().timeIntervalSince(start)
                self.chargingWakeProgress = min(elapsed / totalDuration, 1.0)
                self.updateChargingWakePhase(elapsed: elapsed)

                if self.chargingWakeProgress >= 1.0 {
                    self.chargingWakeTimer?.cancel()
                    self.returnToNominal()
                }
            }
    }

    /// Update animation parameters based on current charging wake phase
    private func updateChargingWakePhase(elapsed: Double) {
        // Phase 1 — Lightning Strike (0.0s – 1.5s)
        lightningActive = elapsed >= 0.0 && elapsed < 1.5

        // Phase 2 — Reactor Shake (0.8s – 2.2s)
        if elapsed >= 0.8 && elapsed < 2.2 {
            if !reactorShakeActive {
                reactorShakeActive = true
                startShakeAnimation()
            }
        } else {
            reactorShakeActive = false
            reactorShakeOffset = 0
        }

        // Phase 3 — Full Bloom Burst (1.2s – 3.0s)
        if elapsed >= 1.2 && elapsed < 2.0 {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.55, blendDuration: 0.1)) {
                bloomIntensity = JARVISNominalState.chargingSurgeBloom
                bloomRadius = 180.0
            }
        } else if elapsed >= 3.5 && elapsed < 5.3 {
            withAnimation(.easeInOut(duration: 1.8)) {
                bloomIntensity = JARVISNominalState.bloomIntensity
                bloomRadius = JARVISNominalState.bloomRadius
            }
        }

        // Phase 4 — Ring Spin-Up (1.5s – 4.5s)
        if elapsed >= 1.5 && elapsed < 2.5 {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.4)) {
                outerRingRPM = JARVISNominalState.chargingSurgeOuterRPM
            }
        }
        if elapsed >= 1.5 && elapsed < 2.7 {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.45)) {
                middleRingRPM = JARVISNominalState.chargingSurgeMiddleRPM
            }
        }
        if elapsed >= 1.5 && elapsed < 2.9 {
            withAnimation(.spring(response: 0.8, dampingFraction: 0.5)) {
                innerRingRPM = JARVISNominalState.chargingSurgeInnerRPM
            }
        }
        // Normalize rings (4.5s – 7.0s)
        if elapsed >= 4.5 {
            withAnimation(.easeInOut(duration: 2.5)) {
                outerRingRPM = JARVISNominalState.outerRingRPM
                middleRingRPM = JARVISNominalState.middleRingRPM
                innerRingRPM = JARVISNominalState.innerRingRPM
            }
        }

        // Phase 5 — Chatter Restoration (2.0s – 5.0s)
        if elapsed >= 2.0 && elapsed < 3.0 {
            withAnimation(.easeIn(duration: 1.0)) {
                chatTextOpacity = 1.0
            }
            statusMessage = "POWER RESTORED... SYSTEMS ONLINE... REACTOR NOMINAL"
        }
        if elapsed >= 3.0 && elapsed < 5.0 {
            let rampProgress = (elapsed - 3.0) / 2.0
            chatCharRate = rampProgress * JARVISNominalState.chatCharRate
        }

        // Phase 6 — Normalise (4.5s – 7.0s)
        if elapsed >= 5.0 {
            particleBirthRate = JARVISNominalState.particleBirthRate
        }
    }

    /// Animate reactor shake using keyframe values
    private func startShakeAnimation() {
        let keyframes: [CGFloat] = [0, -8, 8, -6, 6, -4, 4, -2, 2, 0]
        let frameDuration = 1.4 / Double(keyframes.count)

        shakeTimer?.cancel()
        var index = 0
        shakeTimer = Timer.publish(every: frameDuration, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self, index < keyframes.count else {
                    self?.shakeTimer?.cancel()
                    self?.reactorShakeOffset = 0
                    return
                }
                withAnimation(.easeInOut(duration: frameDuration)) {
                    self.reactorShakeOffset = keyframes[index]
                }
                index += 1
            }
    }

    // MARK: - Ring Harmonics (Spec §3.1)

    /// Schedules periodic ring-sync events every 45-60s as per spec §3.1.
    /// During each event, `harmonicBlend` ramps 0→1 (0.5s), holds 1-2s, ramps 1→0 (0.5s).
    /// JarvisReactorCanvas uses this to lerp per-ring rotation offsets toward 0
    /// so all rings briefly spin in near-unison — a visual "resonance chord."
    // R-24: pause/resume for the 60 Hz continuous reactive loop.
    /// Weak reference to the last-bound TelemetryStore so resume() can re-wire.
    private weak var storeRef: TelemetryStore?

    /// Stops the 60 Hz continuous reactive timer. Safe to call multiple times.
    func pause() {
        continuousTimer?.cancel()
        continuousTimer = nil
    }

    /// Re-arms the 60 Hz continuous reactive timer against the last-bound store.
    func resume() {
        guard continuousTimer == nil else { return }
        resumeContinuousTimer()
    }

    private func resumeContinuousTimer() {
        continuousTimer = Timer.publish(every: 1.0 / 60.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self, let store = self.storeRef else { return }
                self.continuousReactiveUpdate(store: store)
            }
    }

    /// R-25: single recursive re-randomising scheduler replaces the asymmetric
    /// two-level implementation. Every fire picks a fresh random interval so
    /// the harmonic resonance never locks into a fixed cadence.
    private func scheduleNextHarmonic() {
        let interval = Double.random(in: 45...60)
        harmonicTimer?.cancel()
        harmonicTimer = Timer.publish(every: interval, on: .main, in: .common)
            .autoconnect()
            .first()
            .sink { [weak self] _ in
                guard let self else { return }
                self.triggerHarmonicSync()
                self.scheduleNextHarmonic()  // tail-call style re-randomise
            }
    }

    private func startHarmonicsScheduler() {
        scheduleNextHarmonic()
    }

    private func triggerHarmonicSync() {
        let rampDuration = 0.5       // s — blend-in and blend-out
        let holdDuration = Double.random(in: 1.0...2.0)
        let totalFrames  = 60        // steps at ~60 fps
        let rampFrames   = Int(rampDuration * 60)
        let holdFrames   = Int(holdDuration * 60)
        var frame = 0

        harmonicAnimTimer?.cancel()
        harmonicAnimTimer = Timer.publish(every: 1.0 / 60.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                _ = totalFrames  // suppress unused warning
                if frame < rampFrames {
                    self.harmonicBlend = Double(frame) / Double(rampFrames)
                } else if frame < rampFrames + holdFrames {
                    self.harmonicBlend = 1.0
                } else {
                    let fadeFrame = frame - rampFrames - holdFrames
                    self.harmonicBlend = max(0.0, 1.0 - Double(fadeFrame) / Double(rampFrames))
                    if self.harmonicBlend <= 0 {
                        self.harmonicBlend = 0
                        self.harmonicAnimTimer?.cancel()
                    }
                }
                frame += 1
            }
    }

    // MARK: - Return to Nominal

    /// Smoothly return all parameters to nominal steady-state
    func returnToNominal() {
        currentState = .nominal
        statusMessage = ""

        withAnimation(.spring(response: 0.8, dampingFraction: 0.7)) {
            bloomIntensity = JARVISNominalState.bloomIntensity
            bloomRadius = JARVISNominalState.bloomRadius
            outerRingRPM = JARVISNominalState.outerRingRPM
            middleRingRPM = JARVISNominalState.middleRingRPM
            innerRingRPM = JARVISNominalState.innerRingRPM
            chatCharRate = JARVISNominalState.chatCharRate
            chatTextOpacity = 1.0
            particleBirthRate = JARVISNominalState.particleBirthRate
            lightningActive = false
            reactorShakeActive = false
            reactorShakeOffset = 0
            bloomTintRed = false
        }
    }

    // MARK: - Lock Screen Controls

    /// Set reactor to subdued lock-screen mode
    func enterLockMode() {
        withAnimation(.easeInOut(duration: 0.5)) {
            bloomIntensity = JARVISNominalState.lockScreenBloomIntensity
            outerRingRPM = JARVISNominalState.outerRingRPM * JARVISNominalState.lockScreenRingSpeedFraction
            middleRingRPM = JARVISNominalState.middleRingRPM * JARVISNominalState.lockScreenRingSpeedFraction
            innerRingRPM = JARVISNominalState.innerRingRPM * JARVISNominalState.lockScreenRingSpeedFraction
            chatCharRate = 0
            chatTextOpacity = 0
        }
    }

    /// Trigger wrong-auth red bloom flash
    func triggerWrongAuth() {
        bloomTintRed = true
        withAnimation(.easeOut(duration: 0.4)) {
            bloomTintRed = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
            withAnimation(.easeIn(duration: 0.2)) {
                self?.bloomTintRed = false
            }
        }

        // Haptic feedback
        NSHapticFeedbackManager.defaultPerformer.perform(
            .alignment,
            performanceTime: .now
        )
    }
}
