// File: Tests/JarvisTelemetryTests/ReactorAnimationTests.swift
// Comprehensive tests for the Marvel-grade reactive animation system.
// Tests verify: continuous reactive engine, energy ripples, per-ring
// intensities, flare detection, breathing, asymmetric attack/decay,
// telemetry store classifiers, and particle/pulse parameter mapping.

import XCTest
import Combine
@testable import JarvisTelemetry

// ═══════════════════════════════════════════════════════════════════════════
//  MARK: - Test Helpers
// ═══════════════════════════════════════════════════════════════════════════

/// Create a TelemetryStore pre-loaded with specified values.
/// Avoids needing TelemetryBridge / snapshot decoding in tests.
@MainActor
func makeStore(
    eCoreUsages: [Double] = [0.1, 0.1, 0.1, 0.1],
    pCoreUsages: [Double] = [0.1, 0.1, 0.1, 0.1],
    sCoreUsages: [Double] = [],
    gpuUsage: Double = 0.1,
    cpuTemp: Double = 45.0,
    gpuTemp: Double = 40.0,
    totalPower: Double = 8.0,
    memoryUsedGB: Double = 8.0,
    memoryTotalGB: Double = 36.0,
    thermalState: String = "Nominal",
    netOutBytesPerSec: Double? = nil,
    netInBytesPerSec: Double? = nil,
    diskReadBytesPerSec: Double? = nil,
    diskWriteBytesPerSec: Double? = nil
) -> TelemetryStore {
    let store = TelemetryStore()
    store.eCoreUsages = eCoreUsages
    store.pCoreUsages = pCoreUsages
    store.sCoreUsages = sCoreUsages
    store.gpuUsage = gpuUsage
    store.cpuTemp = cpuTemp
    store.gpuTemp = gpuTemp
    store.totalPower = totalPower
    store.memoryUsedGB = memoryUsedGB
    store.memoryTotalGB = memoryTotalGB
    store.thermalState = thermalState
    store.netOutBytesPerSec = netOutBytesPerSec
    store.netInBytesPerSec = netInBytesPerSec
    store.diskReadBytesPerSec = diskReadBytesPerSec
    store.diskWriteBytesPerSec = diskWriteBytesPerSec
    return store
}

/// Run the continuous update loop N times with a deterministic dt.
/// R-31: each tick backdates `lastContinuousUpdate` by exactly `dtMs` so
/// the controller always observes a fixed synthetic dt regardless of real
/// wall-clock jitter. Test runs are deterministic without needing a global
/// synthetic-time anchor that would go backwards across tickController calls.
@MainActor
func tickController(
    _ controller: ReactorAnimationController,
    store: TelemetryStore,
    times: Int = 1,
    dtMs: Double = 16.667  // ~60fps
) {
    for _ in 0..<times {
        let now = Date()
        controller.lastContinuousUpdate = now.addingTimeInterval(-dtMs / 1000.0)
        controller.continuousReactiveUpdate(store: store, now: now)
    }
}


// ═══════════════════════════════════════════════════════════════════════════
//  MARK: - TelemetryStore Classifier Tests
// ═══════════════════════════════════════════════════════════════════════════

final class TelemetryStoreClassifierTests: XCTestCase {

    @MainActor
    func testCPUPCoreSpikeDetection() {
        let store = makeStore(pCoreUsages: [0.50, 0.60, 0.85, 0.70])
        XCTAssertTrue(store.cpuPCoreSpikeActive, "P-core spike should trigger when any P-core > 80%")

        let storeIdle = makeStore(pCoreUsages: [0.10, 0.20, 0.30, 0.15])
        XCTAssertFalse(storeIdle.cpuPCoreSpikeActive, "P-core spike should NOT trigger when all below 80%")
    }

    @MainActor
    func testCPUECoreSpikeDetection() {
        let store = makeStore(eCoreUsages: [0.30, 0.65, 0.20, 0.40])
        XCTAssertTrue(store.cpuECoreSpikeActive, "E-core spike should trigger when any E-core > 60%")

        let storeIdle = makeStore(eCoreUsages: [0.10, 0.20, 0.15, 0.05])
        XCTAssertFalse(storeIdle.cpuECoreSpikeActive)
    }

    @MainActor
    func testGPUSurgeDetection() {
        let store = makeStore(gpuUsage: 0.75)
        XCTAssertTrue(store.gpuSurgeActive, "GPU surge should trigger when GPU > 70%")

        let storeIdle = makeStore(gpuUsage: 0.30)
        XCTAssertFalse(storeIdle.gpuSurgeActive)
    }

    @MainActor
    func testMemoryPressureLevels() {
        let nominal = makeStore(memoryUsedGB: 20.0, memoryTotalGB: 36.0)
        XCTAssertEqual(nominal.memoryPressureLevel, MemoryPressureLevel.nominal)

        let warning = makeStore(memoryUsedGB: 28.0, memoryTotalGB: 36.0)
        XCTAssertEqual(warning.memoryPressureLevel, MemoryPressureLevel.warning)

        let critical = makeStore(memoryUsedGB: 33.0, memoryTotalGB: 36.0)
        XCTAssertEqual(critical.memoryPressureLevel, MemoryPressureLevel.critical)
    }

    @MainActor
    func testThermalStateLevels() {
        let nominal = makeStore(cpuTemp: 50.0, thermalState: "Nominal")
        XCTAssertEqual(nominal.thermalStateLevel, ThermalStateLevel.nominal)

        let warningText = makeStore(cpuTemp: 50.0, thermalState: "Serious")
        XCTAssertEqual(warningText.thermalStateLevel, ThermalStateLevel.warning)

        let criticalText = makeStore(cpuTemp: 50.0, thermalState: "Critical")
        XCTAssertEqual(criticalText.thermalStateLevel, ThermalStateLevel.critical)

        // Falls back to temp thresholds when thermal string is nominal
        let warningTemp = makeStore(cpuTemp: 85.0, thermalState: "Nominal")
        XCTAssertEqual(warningTemp.thermalStateLevel, ThermalStateLevel.warning)

        let criticalTemp = makeStore(cpuTemp: 98.0, thermalState: "Nominal")
        XCTAssertEqual(criticalTemp.thermalStateLevel, ThermalStateLevel.critical)

        // R-65: explicit boundary tests around 80°C and 95°C transitions.
        let atEightyNominal = makeStore(cpuTemp: 80.0, thermalState: "Nominal")
        XCTAssertEqual(atEightyNominal.thermalStateLevel, ThermalStateLevel.nominal,
            "cpuTemp=80.0 exactly must classify as nominal (warning begins > 80)")

        let justAboveEightyWarning = makeStore(cpuTemp: 80.001, thermalState: "Nominal")
        XCTAssertEqual(justAboveEightyWarning.thermalStateLevel, ThermalStateLevel.warning,
            "cpuTemp=80.001 must classify as warning")

        let atNinetyFiveWarning = makeStore(cpuTemp: 95.0, thermalState: "Nominal")
        XCTAssertEqual(atNinetyFiveWarning.thermalStateLevel, ThermalStateLevel.warning,
            "cpuTemp=95.0 exactly must remain warning")

        let justAboveNinetyFiveCritical = makeStore(cpuTemp: 95.001, thermalState: "Nominal")
        XCTAssertEqual(justAboveNinetyFiveCritical.thermalStateLevel, ThermalStateLevel.critical,
            "cpuTemp=95.001 must escalate to critical")
    }

    @MainActor
    func testNetworkSpikeDetection() {
        let txSpike = makeStore(netOutBytesPerSec: 6_000_000)
        XCTAssertTrue(txSpike.networkTxSpikeActive, "TX spike at 6 MB/s should trigger (threshold 5 MB/s)")

        let rxSpike = makeStore(netInBytesPerSec: 12_000_000)
        XCTAssertTrue(rxSpike.networkRxSpikeActive, "RX spike at 12 MB/s should trigger (threshold 10 MB/s)")

        let noSpike = makeStore(netOutBytesPerSec: 1_000_000, netInBytesPerSec: 2_000_000)
        XCTAssertFalse(noSpike.networkTxSpikeActive)
        XCTAssertFalse(noSpike.networkRxSpikeActive)
    }

    @MainActor
    func testDiskIOSpikeDetection() {
        let spike = makeStore(diskReadBytesPerSec: 150_000_000, diskWriteBytesPerSec: 60_000_000)
        XCTAssertTrue(spike.diskIOSpikeActive, "Combined 210 MB/s should trigger (threshold 200 MB/s)")

        let noSpike = makeStore(diskReadBytesPerSec: 50_000_000, diskWriteBytesPerSec: 30_000_000)
        XCTAssertFalse(noSpike.diskIOSpikeActive)
    }

    @MainActor
    func testSystemIdleDetection() {
        let idle = makeStore(
            eCoreUsages: [0.01, 0.02, 0.01, 0.02],
            pCoreUsages: [0.01, 0.01, 0.02, 0.01],
            gpuUsage: 0.01
        )
        XCTAssertTrue(idle.systemIdleActive, "All cores < 5% should trigger idle")

        let busy = makeStore(
            eCoreUsages: [0.01, 0.02, 0.30, 0.02],
            pCoreUsages: [0.01, 0.01, 0.02, 0.01]
        )
        XCTAssertFalse(busy.systemIdleActive, "Any core > 5% should not be idle")
    }
}


// ═══════════════════════════════════════════════════════════════════════════
//  MARK: - Continuous Reactive Engine Tests
// ═══════════════════════════════════════════════════════════════════════════

final class ContinuousReactiveEngineTests: XCTestCase {

    @MainActor
    func testReactorLoadTracksAggregateLoad() {
        let controller = ReactorAnimationController()
        let store = makeStore(
            eCoreUsages: [0.80, 0.80, 0.80, 0.80],
            pCoreUsages: [0.80, 0.80, 0.80, 0.80],
            gpuUsage: 0.80
        )

        // Initial state: reactorLoad should be 0
        XCTAssertEqual(controller.reactorLoad, 0.0, accuracy: 0.01)

        // Run several ticks — reactorLoad should ramp up toward aggregate
        tickController(controller, store: store, times: 30)

        XCTAssertGreaterThan(controller.reactorLoad, 0.3,
            "After 30 ticks (~0.5s) under 80% load, reactorLoad should be rising")
    }

    @MainActor
    func testAsymmetricAttackDecay() {
        let controller = ReactorAnimationController()

        // Phase 1: ramp up under heavy load
        let heavyStore = makeStore(
            eCoreUsages: [0.90, 0.90, 0.90, 0.90],
            pCoreUsages: [0.90, 0.90, 0.90, 0.90],
            gpuUsage: 0.90
        )
        tickController(controller, store: heavyStore, times: 60)
        let peakLoad = controller.reactorLoad
        XCTAssertGreaterThan(peakLoad, 0.5, "Should reach high load after 60 ticks")

        // Phase 2: drop to idle — decay should be SLOWER than attack
        let idleStore = makeStore(
            eCoreUsages: [0.01, 0.01, 0.01, 0.01],
            pCoreUsages: [0.01, 0.01, 0.01, 0.01],
            gpuUsage: 0.01
        )

        // Tick same number of frames
        tickController(controller, store: idleStore, times: 60)
        let decayedLoad = controller.reactorLoad

        // After same number of ticks, decayed load should still be well above 0
        // because decay rate (2/s) is much slower than attack rate (12/s)
        XCTAssertGreaterThan(decayedLoad, 0.05,
            "Decay should be slower than attack — load shouldn't reach zero as fast as it rose")
    }

    @MainActor
    func testCoreFlareOnSuddenSpike() {
        let controller = ReactorAnimationController()

        // Start at low load to establish baseline
        let idleStore = makeStore(
            eCoreUsages: [0.05, 0.05, 0.05, 0.05],
            pCoreUsages: [0.05, 0.05, 0.05, 0.05],
            gpuUsage: 0.05
        )
        tickController(controller, store: idleStore, times: 10)
        XCTAssertLessThan(controller.coreFlare, 0.01, "No flare at idle")

        // Sudden spike — load jumps from ~5% to ~90%
        let spikeStore = makeStore(
            eCoreUsages: [0.95, 0.95, 0.95, 0.95],
            pCoreUsages: [0.95, 0.95, 0.95, 0.95],
            gpuUsage: 0.95
        )
        tickController(controller, store: spikeStore, times: 1)

        XCTAssertGreaterThan(controller.coreFlare, 0.1,
            "Sudden load spike (>12% delta) should trigger coreFlare")
    }

    @MainActor
    func testCoreFlareDecaysOverTime() {
        let controller = ReactorAnimationController()

        // Trigger a flare
        let idleStore = makeStore(
            eCoreUsages: [0.05, 0.05, 0.05, 0.05],
            pCoreUsages: [0.05, 0.05, 0.05, 0.05],
            gpuUsage: 0.05
        )
        tickController(controller, store: idleStore, times: 10)

        let spikeStore = makeStore(
            eCoreUsages: [0.95, 0.95, 0.95, 0.95],
            pCoreUsages: [0.95, 0.95, 0.95, 0.95],
            gpuUsage: 0.95
        )
        tickController(controller, store: spikeStore, times: 1)
        let flareAfterSpike = controller.coreFlare

        // Continue at same load (no new delta) — flare should decay
        tickController(controller, store: spikeStore, times: 60)
        XCTAssertLessThan(controller.coreFlare, flareAfterSpike * 0.5,
            "Flare should decay significantly after ~1s of sustained load (no new deltas)")
    }

    @MainActor
    func testNoFlareOnGradualIncrease() {
        let controller = ReactorAnimationController()

        // Gradually increase load in small increments (< 12% per tick)
        for step in stride(from: 0.05, through: 0.90, by: 0.05) {
            let store = makeStore(
                eCoreUsages: [step, step, step, step],
                pCoreUsages: [step, step, step, step],
                gpuUsage: step
            )
            tickController(controller, store: store, times: 5)
        }

        // Should NOT have significant flare because each increment is small
        XCTAssertLessThan(controller.coreFlare, 0.15,
            "Gradual load increase should not trigger large flares")
    }

    @MainActor
    func testEnergyRipplesOnMajorSpike() {
        let controller = ReactorAnimationController()

        // Establish baseline at very low load
        let idleStore = makeStore(
            eCoreUsages: [0.02, 0.02, 0.02, 0.02],
            pCoreUsages: [0.02, 0.02, 0.02, 0.02],
            gpuUsage: 0.02
        )
        tickController(controller, store: idleStore, times: 15)
        XCTAssertTrue(controller.energyRipples.isEmpty, "No ripples at idle")

        // Major spike — >18% delta should spawn a ripple
        let spikeStore = makeStore(
            eCoreUsages: [0.99, 0.99, 0.99, 0.99],
            pCoreUsages: [0.99, 0.99, 0.99, 0.99],
            gpuUsage: 0.99
        )
        tickController(controller, store: spikeStore, times: 1)

        XCTAssertGreaterThanOrEqual(controller.energyRipples.count, 1,
            "Major load spike (>18% delta) should spawn at least one energy ripple")
    }

    @MainActor
    func testEnergyRippleProgressAndPruning() {
        let controller = ReactorAnimationController()

        // Force-spawn a ripple by creating a spike
        let idleStore = makeStore(
            eCoreUsages: [0.01, 0.01, 0.01, 0.01],
            pCoreUsages: [0.01, 0.01, 0.01, 0.01],
            gpuUsage: 0.01
        )
        tickController(controller, store: idleStore, times: 10)

        let spikeStore = makeStore(
            eCoreUsages: [0.99, 0.99, 0.99, 0.99],
            pCoreUsages: [0.99, 0.99, 0.99, 0.99],
            gpuUsage: 0.99
        )
        tickController(controller, store: spikeStore, times: 1)

        // R-31: the previous `guard !isEmpty else { return }` made the test
        // silently pass when no ripple spawned — a debug footgun. Inject
        // a ripple directly so the downstream progression check is always
        // exercised.
        if controller.energyRipples.isEmpty {
            controller.energyRipples.append(EnergyRipple(intensity: 0.8))
        }

        let initialProgress = controller.energyRipples[0].progress

        // Advance time by ticking many frames (simulates ripple expanding)
        // Each tick advances time by ~16ms, ripple duration is 1.0s
        // After 60+ ticks (1 second), ripple should be pruned
        tickController(controller, store: spikeStore, times: 80)

        // Either the ripple progressed or was pruned
        if !controller.energyRipples.isEmpty {
            XCTAssertGreaterThan(controller.energyRipples[0].progress, initialProgress,
                "Ripple progress should advance over time")
        }
        // If empty, it was correctly pruned — also a pass
    }

    @MainActor
    func testMaxThreeRipplesCap() {
        let controller = ReactorAnimationController()

        // Create conditions for multiple ripples by doing repeated spikes
        for _ in 0..<5 {
            let idleStore = makeStore(
                eCoreUsages: [0.01, 0.01, 0.01, 0.01],
                pCoreUsages: [0.01, 0.01, 0.01, 0.01],
                gpuUsage: 0.01
            )
            // Reset prevReactorLoad to allow spike detection
            controller.prevReactorLoad = 0.01
            tickController(controller, store: idleStore, times: 2)

            let spikeStore = makeStore(
                eCoreUsages: [0.99, 0.99, 0.99, 0.99],
                pCoreUsages: [0.99, 0.99, 0.99, 0.99],
                gpuUsage: 0.99
            )
            tickController(controller, store: spikeStore, times: 1)
        }

        XCTAssertLessThanOrEqual(controller.energyRipples.count, 3,
            "Energy ripples should be capped at 3 concurrent")
    }
}


// ═══════════════════════════════════════════════════════════════════════════
//  MARK: - Per-Ring Reactive Intensity Tests
// ═══════════════════════════════════════════════════════════════════════════

final class PerRingIntensityTests: XCTestCase {

    @MainActor
    func testRingIntensitiesInitialValues() {
        let controller = ReactorAnimationController()
        XCTAssertEqual(controller.ringIntensities.count, 5)
        for intensity in controller.ringIntensities {
            XCTAssertEqual(intensity, 1.0, accuracy: 0.01,
                "All ring intensities should start at 1.0")
        }
    }

    @MainActor
    func testGPURingRespondsToGPULoad() {
        let controller = ReactorAnimationController()
        let store = makeStore(
            eCoreUsages: [0.10, 0.10, 0.10, 0.10],
            pCoreUsages: [0.10, 0.10, 0.10, 0.10],
            gpuUsage: 0.90  // GPU cranked up
        )

        tickController(controller, store: store, times: 30)

        // Ring 0 (GPU) should be notably higher than Ring 1-4
        let gpuRing = controller.ringIntensities[0]
        let eCoreRing = controller.ringIntensities[1]

        XCTAssertGreaterThan(gpuRing, eCoreRing + 0.2,
            "GPU ring intensity should be higher when GPU is loaded and cores are idle")
    }

    @MainActor
    func testECoreRingRespondsToECoreLoad() {
        let controller = ReactorAnimationController()
        let store = makeStore(
            eCoreUsages: [0.95, 0.90, 0.88, 0.92],  // E-cores hot
            pCoreUsages: [0.10, 0.10, 0.10, 0.10],
            gpuUsage: 0.10
        )

        tickController(controller, store: store, times: 30)

        let eCoreRing = controller.ringIntensities[1]
        let pCoreRing = controller.ringIntensities[2]

        XCTAssertGreaterThan(eCoreRing, pCoreRing + 0.2,
            "E-core ring should respond to high E-core utilization")
    }

    @MainActor
    func testMemoryRingRespondsToMemoryPressure() {
        let controller = ReactorAnimationController()
        let store = makeStore(
            eCoreUsages: [0.10, 0.10, 0.10, 0.10],
            pCoreUsages: [0.10, 0.10, 0.10, 0.10],
            gpuUsage: 0.10,
            memoryUsedGB: 33.0,   // 92% of 36GB = high pressure
            memoryTotalGB: 36.0
        )

        tickController(controller, store: store, times: 30)

        let memRing = controller.ringIntensities[4]
        XCTAssertGreaterThan(memRing, 1.3,
            "Memory ring (index 4) should be elevated under high memory pressure")
    }

    @MainActor
    func testAllRingsRespondProportionally() {
        let controller = ReactorAnimationController()

        // Everything at ~50%, including S-cores
        let store = makeStore(
            eCoreUsages: [0.50, 0.50, 0.50, 0.50],
            pCoreUsages: [0.50, 0.50, 0.50, 0.50],
            sCoreUsages: [0.50, 0.50],
            gpuUsage: 0.50,
            memoryUsedGB: 18.0,
            memoryTotalGB: 36.0
        )

        tickController(controller, store: store, times: 40)

        // All rings should be above baseline but none should be at max
        for (i, intensity) in controller.ringIntensities.enumerated() {
            XCTAssertGreaterThan(intensity, 0.8,
                "Ring \(i) should be above minimum at 50% load")
            XCTAssertLessThan(intensity, 1.8,
                "Ring \(i) should be below maximum at 50% load")
        }
    }
}


// ═══════════════════════════════════════════════════════════════════════════
//  MARK: - Power Flow & Breathing Tests
// ═══════════════════════════════════════════════════════════════════════════

final class PowerFlowBreathingTests: XCTestCase {

    @MainActor
    func testPowerFlowTracksTotalPower() {
        let controller = ReactorAnimationController()

        // Low power
        let lowPower = makeStore(totalPower: 5.0)
        tickController(controller, store: lowPower, times: 30)
        let lowFlowVal = controller.powerFlowIntensity

        // High power
        let highPower = makeStore(totalPower: 50.0)
        tickController(controller, store: highPower, times: 30)
        let highFlowVal = controller.powerFlowIntensity

        XCTAssertGreaterThan(highFlowVal, lowFlowVal + 0.2,
            "Power flow should be higher at 50W than at 5W")
    }

    @MainActor
    func testPowerFlowClampedToOne() {
        let controller = ReactorAnimationController()

        // Extreme power (>60W TDP)
        let extremePower = makeStore(totalPower: 120.0)
        tickController(controller, store: extremePower, times: 60)

        XCTAssertLessThanOrEqual(controller.powerFlowIntensity, 1.0,
            "Power flow should be clamped to 1.0")
    }

    @MainActor
    func testBreathingPhaseAdvances() {
        let controller = ReactorAnimationController()
        let store = makeStore()

        let initialPhase = controller.breathingPhase
        tickController(controller, store: store, times: 30)

        XCTAssertGreaterThan(controller.breathingPhase, initialPhase,
            "Breathing phase should advance over time")
    }

    @MainActor
    func testBreathingPhaseWrapsAround() {
        let controller = ReactorAnimationController()
        let store = makeStore()

        // Tick many times to force wrap
        tickController(controller, store: store, times: 600)

        // Phase should stay within 0..2π
        XCTAssertGreaterThanOrEqual(controller.breathingPhase, 0.0)
        XCTAssertLessThan(controller.breathingPhase, Double.pi * 2.0 + 0.01,
            "Breathing phase should wrap around at 2π")
    }
}


// ═══════════════════════════════════════════════════════════════════════════
//  MARK: - EnergyRipple Struct Tests
// ═══════════════════════════════════════════════════════════════════════════

final class EnergyRippleTests: XCTestCase {

    func testRippleInitialState() {
        let ripple = EnergyRipple(intensity: 0.75)
        XCTAssertEqual(ripple.progress, 0.0, "Ripple should start at progress 0")
        XCTAssertEqual(ripple.intensity, 0.75, accuracy: 0.01)
        XCTAssertEqual(ripple.duration, 1.0, "Default duration should be 1.0s")
    }

    func testRippleIdentifiable() {
        let r1 = EnergyRipple(intensity: 0.5)
        let r2 = EnergyRipple(intensity: 0.5)
        XCTAssertNotEqual(r1.id, r2.id, "Each ripple should have a unique ID")
    }
}


// ═══════════════════════════════════════════════════════════════════════════
//  MARK: - Reactor State Machine Tests
// ═══════════════════════════════════════════════════════════════════════════

final class ReactorStateMachineTests: XCTestCase {

    @MainActor
    func testInitialStateIsNominal() {
        let controller = ReactorAnimationController()
        XCTAssertEqual(controller.currentState, .nominal)
        XCTAssertEqual(controller.reactorLoad, 0.0, accuracy: 0.01)
        XCTAssertEqual(controller.coreFlare, 0.0, accuracy: 0.01)
        XCTAssertEqual(controller.ringSpeedMultiplier, 1.0, accuracy: 0.01)
        XCTAssertEqual(controller.ringHueShift, 0.0, accuracy: 0.01)
    }

    @MainActor
    func testContinuousUpdateSkippedDuringDying() {
        let controller = ReactorAnimationController()
        controller.currentState = .dying

        let store = makeStore(
            eCoreUsages: [0.99, 0.99, 0.99, 0.99],
            pCoreUsages: [0.99, 0.99, 0.99, 0.99],
            gpuUsage: 0.99
        )
        tickController(controller, store: store, times: 30)

        XCTAssertEqual(controller.reactorLoad, 0.0, accuracy: 0.01,
            "Continuous update should be skipped during dying state")
    }

    @MainActor
    func testContinuousUpdateSkippedDuringChargingWake() {
        let controller = ReactorAnimationController()
        controller.currentState = .chargingWake

        let store = makeStore(
            eCoreUsages: [0.99, 0.99, 0.99, 0.99],
            pCoreUsages: [0.99, 0.99, 0.99, 0.99],
            gpuUsage: 0.99
        )
        tickController(controller, store: store, times: 30)

        XCTAssertEqual(controller.reactorLoad, 0.0, accuracy: 0.01,
            "Continuous update should be skipped during charging wake state")
    }

    @MainActor
    func testShockwaveInitialState() {
        let controller = ReactorAnimationController()
        XCTAssertFalse(controller.shockwaveActive)
        XCTAssertEqual(controller.shockwaveProgress, 0.0, accuracy: 0.01)
    }

    @MainActor
    func testBatteryRingInitialState() {
        let controller = ReactorAnimationController()
        XCTAssertEqual(controller.batteryRingProgress, 1.0, accuracy: 0.01,
            "Battery ring should start at 100%")
        XCTAssertEqual(controller.batteryRingHue, 0.33, accuracy: 0.01,
            "Battery ring should start green (hue 0.33)")
    }
}


// ═══════════════════════════════════════════════════════════════════════════
//  MARK: - Integration Tests (Full Telemetry Pipeline)
// ═══════════════════════════════════════════════════════════════════════════

final class ReactiveAnimationIntegrationTests: XCTestCase {

    @MainActor
    func testIdleToLoadToIdleCycle() {
        let controller = ReactorAnimationController()

        // Phase 1: Idle
        let idleStore = makeStore(
            eCoreUsages: [0.02, 0.02, 0.02, 0.02],
            pCoreUsages: [0.02, 0.02, 0.02, 0.02],
            gpuUsage: 0.02,
            totalPower: 3.0
        )
        tickController(controller, store: idleStore, times: 30)

        let idleLoad = controller.reactorLoad
        let idlePower = controller.powerFlowIntensity
        XCTAssertLessThan(idleLoad, 0.15, "Idle load should be low")
        XCTAssertLessThan(idlePower, 0.20, "Idle power flow should be low")

        // Phase 2: Heavy load
        let heavyStore = makeStore(
            eCoreUsages: [0.85, 0.90, 0.88, 0.92],
            pCoreUsages: [0.95, 0.98, 0.93, 0.96],
            gpuUsage: 0.85,
            totalPower: 45.0
        )
        tickController(controller, store: heavyStore, times: 60)

        let heavyLoad = controller.reactorLoad
        let heavyPower = controller.powerFlowIntensity
        XCTAssertGreaterThan(heavyLoad, idleLoad + 0.3,
            "Load should be significantly higher under heavy workload")
        XCTAssertGreaterThan(heavyPower, idlePower + 0.2,
            "Power flow should be higher under heavy workload")

        // Phase 3: Return to idle (slower decay)
        tickController(controller, store: idleStore, times: 60)

        let recoveryLoad = controller.reactorLoad
        XCTAssertLessThan(recoveryLoad, heavyLoad,
            "Load should be decreasing after returning to idle")
        // But not fully zero yet (slow decay)
        XCTAssertGreaterThan(recoveryLoad, 0.01,
            "Load should still be decaying (not instant zero)")
    }

    @MainActor
    func testMultipleSubsystemsActiveSimultaneously() {
        let controller = ReactorAnimationController()

        // Scenario: GPU hammered, CPU mixed, memory moderate
        let mixedStore = makeStore(
            eCoreUsages: [0.30, 0.40, 0.35, 0.25],
            pCoreUsages: [0.60, 0.70, 0.55, 0.65],
            gpuUsage: 0.92,
            totalPower: 35.0,
            memoryUsedGB: 25.0,
            memoryTotalGB: 36.0
        )

        tickController(controller, store: mixedStore, times: 40)

        // GPU ring (0) should be highest
        let gpuI = controller.ringIntensities[0]
        let pCoreI = controller.ringIntensities[2]
        let eCoreI = controller.ringIntensities[1]

        XCTAssertGreaterThan(gpuI, eCoreI,
            "GPU ring should be higher than E-core ring when GPU is loaded more")
        XCTAssertGreaterThan(pCoreI, eCoreI,
            "P-core ring should be higher than E-core ring with the given utilization mix")

        // Overall load should reflect the blended state
        XCTAssertGreaterThan(controller.reactorLoad, 0.3,
            "Mixed workload should produce moderate overall load")
    }

    @MainActor
    func testRepeatedSpikesProduceRepeatedFlares() {
        let controller = ReactorAnimationController()

        var flareCount = 0

        for _ in 0..<3 {
            // Go idle
            let idleStore = makeStore(
                eCoreUsages: [0.02, 0.02, 0.02, 0.02],
                pCoreUsages: [0.02, 0.02, 0.02, 0.02],
                gpuUsage: 0.02
            )
            controller.prevReactorLoad = 0.02
            tickController(controller, store: idleStore, times: 15)

            // Spike
            let spikeStore = makeStore(
                eCoreUsages: [0.95, 0.95, 0.95, 0.95],
                pCoreUsages: [0.95, 0.95, 0.95, 0.95],
                gpuUsage: 0.95
            )
            tickController(controller, store: spikeStore, times: 1)

            if controller.coreFlare > 0.05 {
                flareCount += 1
            }

            // Let flare decay
            tickController(controller, store: spikeStore, times: 60)
        }

        XCTAssertGreaterThanOrEqual(flareCount, 2,
            "Repeated idle→spike transitions should produce repeated flares")
    }
}
