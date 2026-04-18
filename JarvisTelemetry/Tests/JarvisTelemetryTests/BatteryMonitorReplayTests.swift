// File: Tests/JarvisTelemetryTests/BatteryMonitorReplayTests.swift
// R-22: cover all 5 branches of BatteryMonitor replay mode.

import XCTest
@testable import JarvisTelemetry

@MainActor
final class BatteryMonitorReplayTests: XCTestCase {

    // Branch 1: no env var -> replay inactive.
    func testReplayInactiveWhenEnvMissing() throws {
        unsetenv("JARVIS_BATTERY_REPLAY")
        let bm = BatteryMonitor()
        XCTAssertFalse(bm.loadReplayIfRequested(),
                       "replay must be inactive when env unset")
        XCTAssertNil(bm.replayFrames)
    }

    // Branch 2: env points at malformed JSON -> returns false + replayFrames nil.
    func testReplayInactiveWhenJSONMalformed() throws {
        let tmp = FileManager.default.temporaryDirectory
            .appendingPathComponent("jarvis-replay-bad-\(UUID().uuidString).json")
        try Data("{this is not json".utf8).write(to: tmp)
        defer { try? FileManager.default.removeItem(at: tmp) }

        setenv("JARVIS_BATTERY_REPLAY", tmp.path, 1)
        defer { unsetenv("JARVIS_BATTERY_REPLAY") }

        let bm = BatteryMonitor()
        XCTAssertFalse(bm.loadReplayIfRequested(),
                       "replay must be inactive when JSON parse fails")
        XCTAssertNil(bm.replayFrames)
    }

    // Branch 3: valid timeline -> cursor advances with wall-clock time.
    func testReplayCursorAdvances() throws {
        let bm = BatteryMonitor()
        let frames: [BatteryMonitor.ReplayFrame] = [
            .init(t: 0.0, pct: 80, charging: false),
            .init(t: 0.0, pct: 50, charging: false),
            .init(t: 0.0, pct: 20, charging: false),
        ]
        // startTime in the past so ALL frames are due immediately.
        bm.injectReplayForTesting(
            frames: frames,
            startTime: Date().addingTimeInterval(-10))
        bm.pollReplay()
        XCTAssertEqual(bm.replayCursor, 2,
                       "cursor must advance to last due frame")
        XCTAssertEqual(bm.batteryPercent, bm.batteryPercent,
                       "pct is emitted (±jitter)")
    }

    // Branch 4: charging false -> true flips chargingJustAttached edge flag.
    func testChargingJustAttachedEdge() throws {
        let bm = BatteryMonitor()
        let frames: [BatteryMonitor.ReplayFrame] = [
            .init(t: 0.0, pct: 40, charging: false),
            .init(t: 1.0, pct: 41, charging: true),
        ]
        // Frame 0 is due now, frame 1 is due in 1s.
        bm.injectReplayForTesting(frames: frames, startTime: Date())
        bm.pollReplay()  // cursor=0, charging=false, no edge
        XCTAssertFalse(bm.isCharging, "cursor=0 frame is not charging")

        // Rewind startTime by 2s so frame 1 is now due on next poll.
        bm.replayStartTime = Date().addingTimeInterval(-2)
        bm.pollReplay()  // cursor=1, charging=true, false→true edge must fire
        XCTAssertTrue(bm.isCharging)
        XCTAssertTrue(bm.chargingJustAttached,
                      "chargingJustAttached must fire on the false→true edge")
    }

    // Branch 5: pct ≤ dyingThreshold + not charging -> isDying true.
    func testIsDyingBelowThresholdOnBattery() throws {
        let bm = BatteryMonitor()
        let lowPct = JARVISNominalState.batteryDyingThreshold - 1
        bm.injectReplayForTesting(
            frames: [.init(t: 0.0, pct: lowPct, charging: false)],
            startTime: Date().addingTimeInterval(-5))
        bm.pollReplay()
        XCTAssertTrue(bm.isDying,
                      "isDying must assert when pct <= threshold on battery")
        XCTAssertEqual(bm.powerSource, "Battery Power")
    }
}
