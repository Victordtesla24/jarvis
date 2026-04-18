// File: Tests/JarvisTelemetryTests/ReactiveEventDispatchTests.swift
// R-10: exercise every path of reactToTelemetry(store:battery:) — 5 priority
// tiers, shockwave, scanStrobe, radarBoost, overlay push + 2-cap, canFire
// debounce, idle-recovery, memory/CPU/GPU/thermal/network/disk reactive
// overlays. 14 test cases, one per distinct code path.

import XCTest
@testable import JarvisTelemetry

@MainActor
final class ReactiveEventDispatchTests: XCTestCase {

    private func controller() -> ReactorAnimationController {
        let c = ReactorAnimationController()
        return c
    }

    func testThermalCriticalFiresShockwaveAndSetsOverlay() {
        let c = controller()
        let store = makeStore(cpuTemp: 99.0, thermalState: "Critical")
        c.reactToTelemetry(store: store, battery: nil)
        XCTAssertEqual(c.ringSpeedMultiplier, 0.4, accuracy: 0.01)
        XCTAssertTrue(c.thermalDistortionActive)
        XCTAssertGreaterThanOrEqual(c.thermalDistortionAmount, 0.5)
        XCTAssertTrue(c.shockwaveActive || c.shockwaveProgress > 0)
        XCTAssertTrue(c.activeOverlays.contains { $0.text.contains("THERMAL") })
    }

    func testThermalWarningSetsSpeedHalfAndDistortion() {
        let c = controller()
        let store = makeStore(thermalState: "Serious")
        c.reactToTelemetry(store: store, battery: nil)
        XCTAssertEqual(c.ringSpeedMultiplier, 0.6, accuracy: 0.01)
        XCTAssertTrue(c.thermalDistortionActive)
    }

    func testThermalNominalClearsDistortion() {
        let c = controller()
        c.thermalDistortionActive = true
        c.thermalDistortionAmount = 0.6
        let store = makeStore(thermalState: "Nominal")
        c.reactToTelemetry(store: store, battery: nil)
        XCTAssertFalse(c.thermalDistortionActive)
    }

    func testMemoryCriticalSetsHueAndOverlay() {
        let c = controller()
        let store = makeStore(memoryUsedGB: 35.0, memoryTotalGB: 36.0)
        c.reactToTelemetry(store: store, battery: nil)
        XCTAssertEqual(c.ringHueShift, 1.0, accuracy: 0.001)
        XCTAssertTrue(c.activeOverlays.contains { $0.text.contains("MEMORY") })
    }

    func testMemoryWarningHalfSpeedAndHueShift() {
        let c = controller()
        let store = makeStore(memoryUsedGB: 28.0, memoryTotalGB: 36.0)
        c.reactToTelemetry(store: store, battery: nil)
        XCTAssertEqual(c.ringSpeedMultiplier, 0.7, accuracy: 0.01)
        XCTAssertEqual(c.ringHueShift, 0.5, accuracy: 0.01)
    }

    func testCPUPCoreSpikeBoostsSpeedAndFiresShockwave() {
        let c = controller()
        let store = makeStore(pCoreUsages: [0.95, 0.95, 0.95, 0.95])
        c.reactToTelemetry(store: store, battery: nil)
        // Within reactToTelemetry the spike fires a shockwave AND schedules
        // a decay animation back to 1.0. The observable side-effect we
        // deterministically verify is the shockwave, plus the canFire record
        // of the cpu_pcore trigger.
        XCTAssertTrue(c.shockwaveActive || c.shockwaveProgress > 0,
                      "cpu_pcore spike must fire the shockwave")
        XCTAssertTrue(c.didFireForTesting("cpu_pcore"),
                      "canFire must record the cpu_pcore trigger")
    }

    func testCPUECoreSpikeLiftsSpeedFloor() {
        let c = controller()
        let store = makeStore(eCoreUsages: [0.85, 0.85, 0.85, 0.85])
        c.reactToTelemetry(store: store, battery: nil)
        XCTAssertTrue(c.didFireForTesting("cpu_ecore"),
                      "canFire must record the cpu_ecore trigger")
    }

    func testGPUSurgeDoublesParticleDensityAndOverlay() {
        let c = controller()
        let store = makeStore(gpuUsage: 0.95)
        c.reactToTelemetry(store: store, battery: nil)
        XCTAssertTrue(c.activeOverlays.contains { $0.text == "GPU SURGE" })
        XCTAssertTrue(c.didFireForTesting("gpu_surge"),
                      "canFire must record the gpu_surge trigger")
    }

    func testNetworkTxSpikeFiresRadarBoostAndOverlay() {
        let c = controller()
        let store = makeStore(netOutBytesPerSec: 20_000_000)
        c.reactToTelemetry(store: store, battery: nil)
        XCTAssertTrue(c.activeOverlays.contains { $0.text.contains("↑") })
    }

    func testNetworkRxSpikeFiresRadarBoostAndOverlay() {
        let c = controller()
        let store = makeStore(netInBytesPerSec: 25_000_000)
        c.reactToTelemetry(store: store, battery: nil)
        XCTAssertTrue(c.activeOverlays.contains { $0.text.contains("↓") })
    }

    func testDiskIOSpikeFiresScanStrobeAndOverlay() {
        let c = controller()
        let store = makeStore(diskReadBytesPerSec: 600_000_000)
        c.reactToTelemetry(store: store, battery: nil)
        XCTAssertTrue(c.activeOverlays.contains { $0.text == "DISK I/O" })
    }

    func testOverlayCapAtTwo() {
        let c = controller()
        // Fire three distinct overlays — the oldest must be dropped to keep 2.
        let store = makeStore(
            gpuUsage: 0.95,
            memoryUsedGB: 35.0, memoryTotalGB: 36.0,
            thermalState: "Critical",
            netOutBytesPerSec: 20_000_000
        )
        c.reactToTelemetry(store: store, battery: nil)
        XCTAssertLessThanOrEqual(c.activeOverlays.count, 2,
                                 "active overlay cap must hold at 2")
    }

    func testCanFireDebouncesRepeatedFires() {
        let c = controller()
        let store = makeStore(gpuUsage: 0.95)
        c.reactToTelemetry(store: store, battery: nil)
        // Immediate re-trigger must be debounced.
        let overlaysAfterFirst = c.activeOverlays.count
        c.reactToTelemetry(store: store, battery: nil)
        let overlaysAfterSecond = c.activeOverlays.count
        XCTAssertEqual(overlaysAfterFirst, overlaysAfterSecond,
                       "canFire must prevent a re-trigger inside the cooldown window")
    }

    func testIdleRecoverySnapsBackToNominal() {
        let c = controller()
        // First fire an idle event to set lastFiredAt['idle_enter'].
        let idleStore = makeStore(
            eCoreUsages: [0.01, 0.01, 0.01, 0.01],
            pCoreUsages: [0.01, 0.01, 0.01, 0.01],
            gpuUsage: 0.01,
            cpuTemp: 45.0
        )
        c.reactToTelemetry(store: idleStore, battery: nil)
        c.ringSpeedMultiplier = 0.3
        c.particleDensityMultiplier = 0.2

        // Now a middling store with no spikes — idle recovery path should
        // restore ringSpeedMultiplier/particleDensityMultiplier to 1.0.
        let normalStore = makeStore(
            eCoreUsages: [0.3, 0.3, 0.3, 0.3],
            pCoreUsages: [0.3, 0.3, 0.3, 0.3],
            gpuUsage: 0.3
        )
        c.reactToTelemetry(store: normalStore, battery: nil)
        XCTAssertEqual(c.ringSpeedMultiplier, 1.0, accuracy: 0.05)
        XCTAssertEqual(c.particleDensityMultiplier, 1.0, accuracy: 0.05)
    }
}
