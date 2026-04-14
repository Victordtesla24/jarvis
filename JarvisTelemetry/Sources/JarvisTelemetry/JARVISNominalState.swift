// File: Sources/JarvisTelemetry/JARVISNominalState.swift
// Single source of truth for all JARVIS animation constants.
// Every animation parameter references these values — no magic numbers inline.
// Ref: R-01.3 · 2026-04-09-jarvis-cinematic-hud-design.md §3

import CoreGraphics

/// Nominal steady-state values for all JARVIS animation parameters.
/// Used as the baseline to which all reactive animations return.
struct JARVISNominalState {

    // MARK: - Core Reactor Bloom

    /// Bloom intensity at steady state (0.0 = off, 1.0 = maximum)
    static let bloomIntensity:    CGFloat = 0.72
    /// Bloom radius in points at steady state
    static let bloomRadius:       CGFloat = 150.0

    // MARK: - Ring Rotation (RPM)

    /// Outer ring nominal rotation speed
    static let outerRingRPM:      Double  = 60.0
    /// Middle ring nominal rotation speed
    static let middleRingRPM:     Double  = 45.0
    /// Inner ring nominal rotation speed
    static let innerRingRPM:      Double  = 30.0

    // MARK: - Chatter

    /// Characters per second for diagnostic text streams
    static let chatCharRate:      Double  = 12.0
    /// Seconds between new chatter lines at calm mood
    static let chatterInterval:   Double  = 2.0

    // MARK: - Particles

    /// Ambient particle birth rate (particles/sec)
    static let particleBirthRate: Float   = 24.0
    /// Ambient particle count on screen
    static let particleCount:     Int     = 40

    // MARK: - Core Heartbeat

    /// Nominal heartbeat BPM at calm load
    static let coreBPM:           Double  = 60.0

    // MARK: - Ring Speed Multiplier

    /// Base ring speed multiplier (1.0 = design doc baseline)
    static let ringSpeedMultiplier: Double = 1.0

    // MARK: - Phase Durations (seconds)

    /// Full boot sequence duration (first launch) — SC-3.1 exact value
    static let bootDurationFull:  Double  = 8.0
    /// Wake boot duration (after unlock/sleep wake)
    static let bootDurationWake:  Double  = 3.5
    /// Shutdown sequence duration — SC-3.2 exact value
    static let shutdownDuration:  Double  = 5.0
    /// Lock screen unlock animation duration
    static let unlockDuration:    Double  = 1.5

    // MARK: - Boot Cluster Stagger Thresholds (bootProgress scalar 0→1)

    /// E-Core arcs materialise at this bootProgress value
    static let bootClusterECore:    Double = 0.25
    /// P-Core arcs materialise at this bootProgress value
    static let bootClusterPCore:    Double = 0.45
    /// GPU arc materialises at this bootProgress value
    static let bootClusterGPUArc:   Double = 0.60
    /// Remaining structural rings materialise at this bootProgress value
    static let bootClusterRings:    Double = 0.75
    /// Each cluster fade-in window (local 0→1 over this bootProgress span)
    static let bootClusterFadeSpan: Double = 0.20

    // MARK: - Shutdown Ring Stagger Offsets (seconds, relative to shutdownStartTime)

    /// Ring 5 (0.35R innermost) begins fade at t=0.0 s
    static let shutdownRing5Start:    Double = 0.0
    /// Ring 4 (0.48R) begins fade at t=0.4 s
    static let shutdownRing4Start:    Double = 0.4
    /// Ring 3 (0.62R) begins fade at t=0.8 s
    static let shutdownRing3Start:    Double = 0.8
    /// Ring 2 (0.78R) begins fade at t=1.2 s
    static let shutdownRing2Start:    Double = 1.2
    /// Ring 1 (0.95R outermost structural) begins fade at t=1.6 s
    static let shutdownRing1Start:    Double = 1.6
    /// Core pulse begins fade at t=2.0 s
    static let shutdownCoreFadeStart: Double = 2.0
    /// Each structural ring fades over this many seconds
    static let shutdownRingFadeDur:   Double = 0.4
    /// Core pulse fades over this many seconds
    static let shutdownCoreFadeDur:   Double = 2.0

    // MARK: - Chip Name Constants

    /// Default chip name emitted by TelemetryStore before daemon data arrives
    static let chipNameDefault: String = "Apple Silicon"

    // MARK: - Battery Thresholds

    /// Battery percentage at which DYING_STATE triggers
    static let batteryDyingThreshold: Int = 5
    /// CPU load fraction (0-1) above which outerRingRPM increases
    static let cpuLoadHighThreshold: Double = 0.80

    // MARK: - Dying State Values

    /// Bloom intensity during power-critical dying state
    static let dyingBloomIntensity:    CGFloat = 0.08
    /// Bloom radius during dying state
    static let dyingBloomRadius:       CGFloat = 30.0
    /// Duration of dying state bloom dim animation
    static let dyingBloomDuration:     Double  = 4.0
    /// Duration of dying chatter fade
    static let dyingChatterDuration:   Double  = 6.0
    /// Duration of dying ring deceleration
    static let dyingRingDuration:      Double  = 8.0

    // MARK: - Charging Wake Values

    /// Peak bloom intensity during charging surge
    static let chargingSurgeBloom:     CGFloat = 1.0
    /// Surge bloom hold duration before normalizing
    static let chargingSurgeHold:      Double  = 1.5
    /// Outer ring surge RPM during charging wake
    static let chargingSurgeOuterRPM:  Double  = 220.0
    /// Middle ring surge RPM
    static let chargingSurgeMiddleRPM: Double  = 180.0
    /// Inner ring surge RPM
    static let chargingSurgeInnerRPM:  Double  = 140.0

    // MARK: - Lock Screen

    /// Reactor scale on lock screen (subdued)
    static let lockScreenReactorScale: CGFloat = 0.6
    /// Bloom intensity on lock screen
    static let lockScreenBloomIntensity: CGFloat = 0.45
    /// Ring speed fraction of nominal on lock screen
    static let lockScreenRingSpeedFraction: Double = 0.5

    // MARK: - Color Palette

    /// Primary cyan — rings, ticks, data arcs, chatter text, particles
    static let primaryCyan    = (r: 0.102, g: 0.902, b: 0.961)  // #1AE6F5
    /// Bright cyan — hero readouts, highlights, core glow
    static let brightCyan     = (r: 0.41, g: 0.95, b: 0.95)  // #69F1F1
    /// Dim cyan — subtle accents, far-depth elements
    static let dimCyan        = (r: 0.00, g: 0.55, b: 0.70)  // #008CB3
    /// Amber — P-Core arcs, thermal warnings
    static let amber          = (r: 1.00, g: 0.78, b: 0.00)  // #FFC800
    /// Crimson — S-Core arcs, critical alerts
    static let crimson        = (r: 1.00, g: 0.15, b: 0.20)  // #FF2633
    /// Steel — structural rings, bezels
    static let steel          = (r: 0.40, g: 0.52, b: 0.58)  // #668494
    /// Background dark blue
    static let background     = (r: 0.02, g: 0.04, b: 0.08)  // #050A14
    /// Lock screen auth text color (cyan with alpha)
    static let lockTextCyan   = (r: 0.00, g: 0.78, b: 1.00, a: 0.85)  // rgba(0, 200, 255, 0.85)
}
