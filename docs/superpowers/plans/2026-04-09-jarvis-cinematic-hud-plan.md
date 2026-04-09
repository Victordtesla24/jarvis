# JARVIS Cinematic HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform JARVIS Telemetry into a full Iron Man workshop experience with cinematic boot/shutdown sequences, living reactive HUD with JARVIS chatter, holographic atmosphere, and emotional system awareness.

**Architecture:** Phase-driven state machine (`HUDPhaseController`) orchestrates four modes — BOOT, LOOP, SHUTDOWN, STANDBY. New overlay systems (particles, chatter, flicker, awareness pulses) are layered on top of the existing 220-ring reactor canvas. The `SystemMoodEngine` continuously interpolates global animation parameters from aggregated telemetry. Each new module is a focused SwiftUI view or engine class with a single responsibility.

**Tech Stack:** Swift 5.9, SwiftUI Canvas (60fps), SceneKit (boot wireframe), Combine, AppKit (wallpaper windows, lifecycle), macOS 14+

**Spec:** `docs/superpowers/specs/2026-04-09-jarvis-cinematic-hud-design.md`

---

## Phase Overview

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| **1: Foundation** | 1-4 | State machine, mood engine, enhanced telemetry store, lifecycle observers |
| **2: Boot Sequence** | 5-7 | Full theatrical 8-12s boot with hardware enumeration + wake variant |
| **3: Atmospheric Overlays** | 8-12 | Particles, flicker, scanner, chatter streams, floating panels |
| **4: Reactor Enhancements** | 10-11 | Cardiac pulse, load-reactive speed, digit cipher |
| **5: Overlays & Diagnostics** | 12-13 | Floating diagnostic panels, scanner sweep |
| **6: Shutdown & Standby** | 14-16 | Cinematic shutdown, lock screen PNG, S.H.I.E.L.D.→macOS rebrand |

**Future polish (add after base is working):** Connective wire flashes, ghost trails, ring harmonics, depth/parallax layering, thermal threat escalation (crimson mode).

Each phase produces a buildable, runnable app. Build & verify after each phase.

---

## Task 1: HUD Phase Controller — State Machine

**Files:**
- Create: `Sources/JarvisTelemetry/HUDPhaseController.swift`
- Modify: `Sources/JarvisTelemetry/JarvisRootView.swift`

This is the backbone. Every other module reads the current phase from this controller.

- [ ] **Step 1: Create HUDPhaseController**

```swift
// File: Sources/JarvisTelemetry/HUDPhaseController.swift

import SwiftUI
import Combine

enum HUDPhase: Equatable {
    case boot(isWake: Bool)   // true = 3-4s wake, false = 8-12s full
    case loop
    case shutdown
    case standby
}

final class HUDPhaseController: ObservableObject {

    @Published var phase: HUDPhase = .boot(isWake: false)
    @Published var bootProgress: Double = 0       // 0.0 → 1.0 during boot
    @Published var shutdownProgress: Double = 0   // 0.0 → 1.0 during shutdown

    private var timer: AnyCancellable?

    /// Duration of current boot sequence
    var bootDuration: Double { phase == .boot(isWake: true) ? 3.5 : 10.0 }

    func startBoot(isWake: Bool = false) {
        phase = .boot(isWake: isWake)
        bootProgress = 0
        let duration = isWake ? 3.5 : 10.0
        let start = Date()
        timer?.cancel()
        timer = Timer.publish(every: 1.0/60.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                let elapsed = Date().timeIntervalSince(start)
                self.bootProgress = min(elapsed / duration, 1.0)
                if self.bootProgress >= 1.0 {
                    self.timer?.cancel()
                    self.transitionToLoop()
                }
            }
    }

    func startShutdown() {
        guard phase == .loop else { return }
        phase = .shutdown
        shutdownProgress = 0
        let duration = 7.0
        let start = Date()
        timer?.cancel()
        timer = Timer.publish(every: 1.0/60.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                let elapsed = Date().timeIntervalSince(start)
                self.shutdownProgress = min(elapsed / duration, 1.0)
                if self.shutdownProgress >= 1.0 {
                    self.timer?.cancel()
                    self.transitionToStandby()
                }
            }
    }

    private func transitionToLoop() {
        withAnimation(.easeInOut(duration: 0.6)) {
            phase = .loop
        }
    }

    private func transitionToStandby() {
        phase = .standby
    }

    func wakeFromStandby() {
        startBoot(isWake: true)
    }
}
```

- [ ] **Step 2: Update JarvisRootView to use HUDPhaseController**

Replace the entire contents of `JarvisRootView.swift`:

```swift
// File: Sources/JarvisTelemetry/JarvisRootView.swift

import SwiftUI

struct JarvisRootView: View {

    @EnvironmentObject var bridge: TelemetryBridge
    @StateObject private var store = TelemetryStore()
    @StateObject private var phaseController = HUDPhaseController()

    var body: some View {
        ZStack {
            Color.clear

            switch phaseController.phase {
            case .boot:
                BootSequenceView()
                    .environmentObject(phaseController)
                    .environmentObject(store)
                    .transition(.opacity)

            case .loop:
                AnimatedCanvasHost()
                    .environmentObject(store)
                    .environmentObject(phaseController)
                    .transition(.opacity)

            case .shutdown:
                ShutdownSequenceView()
                    .environmentObject(phaseController)
                    .environmentObject(store)
                    .transition(.opacity)

            case .standby:
                // Standby shows nothing — static wallpaper PNG handles it
                Color.clear
            }
        }
        .onAppear {
            store.bind(to: bridge)
            phaseController.startBoot(isWake: false)
        }
        .ignoresSafeArea()
    }
}
```

- [ ] **Step 3: Create placeholder BootSequenceView and ShutdownSequenceView**

These are temporary stubs so the app compiles. They'll be fully implemented in later tasks.

```swift
// File: Sources/JarvisTelemetry/BootSequenceView.swift

import SwiftUI

struct BootSequenceView: View {
    @EnvironmentObject var phaseController: HUDPhaseController
    @EnvironmentObject var store: TelemetryStore

    var body: some View {
        // Placeholder — full implementation in Task 5-7
        Color(red: 0.02, green: 0.04, blue: 0.08)
            .ignoresSafeArea()
    }
}
```

```swift
// File: Sources/JarvisTelemetry/ShutdownSequenceView.swift

import SwiftUI

struct ShutdownSequenceView: View {
    @EnvironmentObject var phaseController: HUDPhaseController
    @EnvironmentObject var store: TelemetryStore

    var body: some View {
        // Placeholder — full implementation in Task 21
        Color(red: 0.02, green: 0.04, blue: 0.08)
            .ignoresSafeArea()
    }
}
```

- [ ] **Step 4: Pass phaseController through AnimatedCanvasHost**

Modify `AnimatedCanvasHost.swift` to pass the phaseController to the environment:

```swift
// File: Sources/JarvisTelemetry/AnimatedCanvasHost.swift

import SwiftUI

struct AnimatedCanvasHost: View {

    @EnvironmentObject var store: TelemetryStore
    @EnvironmentObject var phaseController: HUDPhaseController

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { timeline in
            JarvisHUDView()
                .environmentObject(store)
                .environmentObject(phaseController)
                .environment(\.animationPhase, timeline.date.timeIntervalSinceReferenceDate)
        }
    }
}

// Environment key for animation phase propagation
private struct AnimationPhaseKey: EnvironmentKey {
    static let defaultValue: Double = 0
}

extension EnvironmentValues {
    var animationPhase: Double {
        get { self[AnimationPhaseKey.self] }
        set { self[AnimationPhaseKey.self] = newValue }
    }
}
```

- [ ] **Step 5: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

Expected: Build succeeds. App launches → shows dark screen (placeholder boot) → transitions to existing HUD after 10s.

- [ ] **Step 6: Commit**

```bash
git add Sources/JarvisTelemetry/HUDPhaseController.swift \
      Sources/JarvisTelemetry/BootSequenceView.swift \
      Sources/JarvisTelemetry/ShutdownSequenceView.swift \
      Sources/JarvisTelemetry/JarvisRootView.swift \
      Sources/JarvisTelemetry/AnimatedCanvasHost.swift
git commit -m "feat: add HUD phase controller state machine (BOOT/LOOP/SHUTDOWN/STANDBY)"
```

---

## Task 2: System Mood Engine

**Files:**
- Create: `Sources/JarvisTelemetry/SystemMoodEngine.swift`

The mood engine aggregates CPU, GPU, thermal, and memory state into a single emotional spectrum that modulates all animation parameters globally.

- [ ] **Step 1: Create SystemMoodEngine**

```swift
// File: Sources/JarvisTelemetry/SystemMoodEngine.swift

import SwiftUI
import Combine

enum SystemMood: String, CaseIterable {
    case serene   // 0-15% load
    case calm     // 15-40%
    case active   // 40-65%
    case intense  // 65-85%
    case overdrive // 85-100%
}

final class SystemMoodEngine: ObservableObject {

    @Published var mood: SystemMood = .calm
    @Published var moodIntensity: Double = 0.3  // 0.0 (serene) → 1.0 (overdrive), smoothed

    // Derived animation parameters (smoothly interpolated)
    @Published var ringSpeedMultiplier: Double = 1.0
    @Published var coreBPM: Double = 60.0
    @Published var particleSpeed: Double = 1.0
    @Published var glowIntensity: Double = 1.0
    @Published var chatterRate: Double = 2.0  // seconds between lines
    @Published var hexGridPulseSpeed: Double = 1.0

    // Thermal override
    @Published var thermalEscalation: Bool = false
    @Published var thermalSeverity: Double = 0  // 0 = nominal, 1 = critical

    private var cancellables = Set<AnyCancellable>()
    private var targetIntensity: Double = 0.3
    private var smoothingTimer: AnyCancellable?

    func bind(to store: TelemetryStore) {
        // Recompute mood on every telemetry update
        store.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self, weak store] _ in
                guard let self, let store else { return }
                self.recompute(store: store)
            }
            .store(in: &cancellables)

        // Smooth interpolation at 30Hz
        smoothingTimer = Timer.publish(every: 1.0/30.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.interpolate()
            }
    }

    private func recompute(store: TelemetryStore) {
        // Aggregate load: weighted average of CPU cores + GPU
        let cpuAvg: Double
        let allCores = store.eCoreUsages + store.pCoreUsages + store.sCoreUsages
        if allCores.isEmpty {
            cpuAvg = 0
        } else {
            cpuAvg = allCores.reduce(0, +) / Double(allCores.count)
        }
        let gpuLoad = store.gpuUsage
        let aggregateLoad = cpuAvg * 0.6 + gpuLoad * 0.3 + store.swapPressure * 0.1

        targetIntensity = aggregateLoad

        // Thermal override
        let thermal = store.thermalState.lowercased()
        if thermal.contains("serious") || thermal.contains("critical") {
            thermalEscalation = true
            thermalSeverity = thermal.contains("critical") ? 1.0 : 0.6
        } else {
            thermalEscalation = false
            thermalSeverity = 0
        }
    }

    private func interpolate() {
        // Smooth approach toward target (2-3 second transition feel)
        let rate = 0.03  // ~3% per frame at 30Hz ≈ 2s to settle
        moodIntensity += (targetIntensity - moodIntensity) * rate

        // Map intensity to discrete mood
        switch moodIntensity {
        case ..<0.15: mood = .serene
        case 0.15..<0.40: mood = .calm
        case 0.40..<0.65: mood = .active
        case 0.65..<0.85: mood = .intense
        default: mood = .overdrive
        }

        // Derive animation parameters
        ringSpeedMultiplier = 0.7 + moodIntensity * 0.8    // 0.7x → 1.5x
        coreBPM = 45.0 + moodIntensity * 75.0              // 45 → 120 BPM
        particleSpeed = 0.5 + moodIntensity * 1.5           // 0.5x → 2.0x
        glowIntensity = 0.7 + moodIntensity * 0.6           // 0.7 → 1.3
        chatterRate = max(0.5, 4.0 - moodIntensity * 3.5)   // 4s → 0.5s
        hexGridPulseSpeed = 0.5 + moodIntensity * 1.5        // 0.5x → 2.0x
    }
}
```

- [ ] **Step 2: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add Sources/JarvisTelemetry/SystemMoodEngine.swift
git commit -m "feat: add SystemMoodEngine — aggregates telemetry into emotional animation spectrum"
```

---

## Task 3: Enhanced TelemetryStore — Delta Tracking & Mood Integration

**Files:**
- Modify: `Sources/JarvisTelemetry/TelemetryStore.swift`

Add delta tracking (previous vs current values) for the chatter engine, plus memory metrics and system info fields needed by boot sequence.

- [ ] **Step 1: Extend TelemetryStore with deltas and new fields**

Add these properties and modify the `ingest` method:

```swift
// File: Sources/JarvisTelemetry/TelemetryStore.swift

import Foundation
import Combine

/// Represents a significant change in a telemetry value
struct TelemetryDelta {
    let metric: String       // e.g. "CPU_TEMP", "TOTAL_POWER"
    let oldValue: Double
    let newValue: Double
    let label: String        // Human-readable, e.g. "CPU TEMP: 42.1°C → 48.3°C"
    let severity: DeltaSeverity
}

enum DeltaSeverity {
    case info, warning, critical
}

final class TelemetryStore: ObservableObject {

    // Normalized 0.0-1.0 ring values
    @Published var eCoreUsages:  [Double] = []
    @Published var pCoreUsages:  [Double] = []
    @Published var sCoreUsages:  [Double] = []
    @Published var gpuUsage:     Double = 0
    @Published var cpuTemp:      Double = 0
    @Published var gpuTemp:      Double = 0
    @Published var totalPower:   Double = 0
    @Published var anePower:     Double = 0
    @Published var dramReadBW:   Double = 0
    @Published var dramWriteBW:  Double = 0
    @Published var swapPressure: Double = 0
    @Published var thermalState: String = "Nominal"

    // Custom metrics
    @Published var dvhopCPUPct:  Double = 0
    @Published var gumerMBs:     Double = 0
    @Published var cctcDeltaC:   Double = 0

    // Memory (raw)
    @Published var memoryUsedGB:  Double = 0
    @Published var memoryTotalGB: Double = 0
    @Published var swapUsedGB:    Double = 0

    // System info (populated on first snapshot)
    @Published var chipName:     String = "Apple Silicon"
    @Published var eCoreCount:   Int = 0
    @Published var pCoreCount:   Int = 0
    @Published var sCoreCount:   Int = 0
    @Published var gpuCoreCount: Int = 0
    @Published var totalCoreCount: Int = 0

    // Display strings
    @Published var timeString:   String = "--:--"

    // CPU usage (aggregate, 0-100)
    @Published var cpuUsagePercent: Double = 0

    // GPU frequency
    @Published var gpuFreqMHz:   Double = 0

    // Delta events (consumed by ChatterEngine)
    @Published var latestDeltas: [TelemetryDelta] = []

    // Snapshot counter
    @Published var frameCount: Int = 0

    private var cancellables = Set<AnyCancellable>()

    // Previous values for delta detection
    private var prevTotalPower: Double = 0
    private var prevCpuTemp: Double = 0
    private var prevGpuTemp: Double = 0
    private var prevSwapPressure: Double = 0
    private var prevGpuUsage: Double = 0
    private var prevCpuUsage: Double = 0

    func bind(to bridge: TelemetryBridge) {
        bridge.$snapshot
            .compactMap { $0 }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] snap in
                self?.ingest(snap)
            }
            .store(in: &cancellables)
    }

    private func ingest(_ snap: TelemetrySnapshot) {
        let info = snap.systemInfo
        let allCores = snap.coreUsages

        // System info (first snapshot populates, subsequent updates)
        chipName = info.name
        eCoreCount = info.eCoreCount
        pCoreCount = info.pCoreCount
        sCoreCount = info.sCoreCount
        gpuCoreCount = info.gpuCoreCount
        totalCoreCount = info.coreCount

        // Partition cores by cluster type
        eCoreUsages = Array(allCores.prefix(info.eCoreCount)).map { $0 / 100.0 }
        pCoreUsages = Array(allCores.dropFirst(info.eCoreCount).prefix(info.pCoreCount)).map { $0 / 100.0 }
        sCoreUsages = Array(allCores.dropFirst(info.eCoreCount + info.pCoreCount).prefix(info.sCoreCount)).map { $0 / 100.0 }

        gpuUsage     = snap.gpuUsage / 100.0
        cpuTemp      = snap.socMetrics.cpuTemp
        gpuTemp      = snap.socMetrics.gpuTemp
        totalPower   = snap.socMetrics.totalPower
        anePower     = snap.socMetrics.anePower
        dramReadBW   = snap.socMetrics.dramReadBW
        dramWriteBW  = snap.socMetrics.dramWriteBW
        thermalState = snap.thermalState
        gpuFreqMHz   = snap.socMetrics.gpuFreqMHz
        cpuUsagePercent = snap.cpuUsage

        let swapUsed  = Double(snap.memory.swapUsed)
        let swapTotal = Double(snap.memory.swapTotal)
        swapPressure  = swapTotal > 0 ? swapUsed / swapTotal : 0

        memoryUsedGB  = Double(snap.memory.used) / 1_073_741_824.0
        memoryTotalGB = Double(snap.memory.total) / 1_073_741_824.0
        swapUsedGB    = swapUsed / 1_073_741_824.0

        dvhopCPUPct  = snap.dvhopCPUPct
        gumerMBs     = snap.gumerMBs
        cctcDeltaC   = snap.cctcDeltaC

        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        timeString = formatter.string(from: Date())

        frameCount += 1

        // Delta detection
        var deltas: [TelemetryDelta] = []

        let powerDelta = abs(totalPower - prevTotalPower)
        if powerDelta > 3 {
            let pct = prevTotalPower > 0 ? ((totalPower - prevTotalPower) / prevTotalPower * 100) : 0
            deltas.append(TelemetryDelta(
                metric: "TOTAL_POWER", oldValue: prevTotalPower, newValue: totalPower,
                label: String(format: "TOTAL POWER: %.0fW → %.0fW (%+.0f%%)", prevTotalPower, totalPower, pct),
                severity: totalPower > 40 ? .warning : .info
            ))
        }

        let cpuTempDelta = abs(cpuTemp - prevCpuTemp)
        if cpuTempDelta > 2 {
            deltas.append(TelemetryDelta(
                metric: "CPU_TEMP", oldValue: prevCpuTemp, newValue: cpuTemp,
                label: String(format: "CPU TEMP: %.1f°C → %.1f°C", prevCpuTemp, cpuTemp),
                severity: cpuTemp > 50 ? .warning : .info
            ))
        }

        let gpuTempDelta = abs(gpuTemp - prevGpuTemp)
        if gpuTempDelta > 2 {
            deltas.append(TelemetryDelta(
                metric: "GPU_TEMP", oldValue: prevGpuTemp, newValue: gpuTemp,
                label: String(format: "GPU TEMP: %.1f°C → %.1f°C", prevGpuTemp, gpuTemp),
                severity: gpuTemp > 50 ? .warning : .info
            ))
        }

        if abs(swapPressure - prevSwapPressure) > 0.05 {
            deltas.append(TelemetryDelta(
                metric: "SWAP", oldValue: prevSwapPressure, newValue: swapPressure,
                label: String(format: "SWAP PRESSURE: %.0f%% → %.0f%%", prevSwapPressure * 100, swapPressure * 100),
                severity: swapPressure > 0.25 ? .warning : .info
            ))
        }

        // Per-core spike detection (any core > 90%)
        for (i, u) in allCores.enumerated() {
            if u > 90 {
                let cluster: String
                if i < info.eCoreCount { cluster = "E-CORE \(i)" }
                else if i < info.eCoreCount + info.pCoreCount { cluster = "P-CORE \(i - info.eCoreCount)" }
                else { cluster = "S-CORE \(i - info.eCoreCount - info.pCoreCount)" }
                deltas.append(TelemetryDelta(
                    metric: "CORE_SPIKE", oldValue: 0, newValue: u,
                    label: String(format: "%@: %.0f%% UTILIZATION", cluster, u),
                    severity: .info
                ))
            }
        }

        latestDeltas = deltas

        // Store previous values
        prevTotalPower = totalPower
        prevCpuTemp = cpuTemp
        prevGpuTemp = gpuTemp
        prevSwapPressure = swapPressure
        prevGpuUsage = gpuUsage
        prevCpuUsage = cpuUsagePercent
    }
}
```

- [ ] **Step 2: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add Sources/JarvisTelemetry/TelemetryStore.swift
git commit -m "feat: extend TelemetryStore with delta tracking, memory metrics, system info"
```

---

## Task 4: Process Lifecycle Observer

**Files:**
- Create: `Sources/JarvisTelemetry/ProcessLifecycleObserver.swift`
- Modify: `Sources/JarvisTelemetry/AppDelegate.swift`

Listens for sleep/wake, screen lock/unlock, SIGTERM/SIGINT to trigger boot/shutdown transitions.

- [ ] **Step 1: Create ProcessLifecycleObserver**

```swift
// File: Sources/JarvisTelemetry/ProcessLifecycleObserver.swift

import AppKit
import Combine

final class ProcessLifecycleObserver {

    private let phaseController: HUDPhaseController
    private let bridge: TelemetryBridge
    private var cancellables = Set<AnyCancellable>()

    init(phaseController: HUDPhaseController, bridge: TelemetryBridge) {
        self.phaseController = phaseController
        self.bridge = bridge
        setupNotifications()
        setupSignalHandlers()
    }

    private func setupNotifications() {
        let ws = NSWorkspace.shared.notificationCenter

        // Sleep → shutdown sequence
        ws.publisher(for: NSWorkspace.willSleepNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.phaseController.startShutdown()
            }
            .store(in: &cancellables)

        // Wake → boot (wake variant)
        ws.publisher(for: NSWorkspace.didWakeNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.phaseController.wakeFromStandby()
            }
            .store(in: &cancellables)

        // Session resign (screen lock) → shutdown
        ws.publisher(for: NSWorkspace.sessionDidResignActiveNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.phaseController.startShutdown()
            }
            .store(in: &cancellables)

        // Session active (unlock) → boot wake
        ws.publisher(for: NSWorkspace.sessionDidBecomeActiveNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.phaseController.wakeFromStandby()
            }
            .store(in: &cancellables)

        // Screen configuration change
        NotificationCenter.default.publisher(for: NSApplication.didChangeScreenParametersNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                // Already handled by AppDelegate.screensDidChange
            }
            .store(in: &cancellables)
    }

    private func setupSignalHandlers() {
        // SIGTERM — graceful shutdown
        signal(SIGTERM) { _ in
            DispatchQueue.main.async {
                // Post notification that AppDelegate will handle
                NotificationCenter.default.post(name: .jarvisGracefulShutdown, object: nil)
            }
        }

        // SIGINT — graceful shutdown
        signal(SIGINT) { _ in
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: .jarvisGracefulShutdown, object: nil)
            }
        }

        // Listen for the graceful shutdown notification
        NotificationCenter.default.publisher(for: .jarvisGracefulShutdown)
            .first()
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self else { return }
                self.phaseController.startShutdown()
                // Delay exit to allow shutdown animation
                DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) {
                    self.bridge.stop()
                    NSApp.terminate(nil)
                }
            }
            .store(in: &cancellables)
    }
}

extension Notification.Name {
    static let jarvisGracefulShutdown = Notification.Name("jarvisGracefulShutdown")
}
```

- [ ] **Step 2: Integrate into AppDelegate**

Replace `AppDelegate.swift`:

```swift
// File: Sources/JarvisTelemetry/AppDelegate.swift

import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {

    private var wallpaperWindows: [NSWindow] = []
    private let bridge = TelemetryBridge()
    private let phaseController = HUDPhaseController()
    private var lifecycleObserver: ProcessLifecycleObserver?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory) // No Dock icon

        lifecycleObserver = ProcessLifecycleObserver(
            phaseController: phaseController,
            bridge: bridge
        )

        setupWallpaperWindows()
        bridge.start()
    }

    func applicationWillTerminate(_ notification: Notification) {
        bridge.stop()
    }

    // MARK: - Wallpaper Window Construction

    private func setupWallpaperWindows() {
        for win in wallpaperWindows { win.orderOut(nil) }
        wallpaperWindows.removeAll()

        for screen in NSScreen.screens {
            let win = buildWallpaperWindow(for: screen)
            win.makeKeyAndOrderFront(nil)
            wallpaperWindows.append(win)
        }

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screensDidChange),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
    }

    private func buildWallpaperWindow(for screen: NSScreen) -> NSWindow {
        let win = NSWindow(
            contentRect:  screen.frame,
            styleMask:    .borderless,
            backing:      .buffered,
            defer:        false,
            screen:       screen
        )

        win.level = NSWindow.Level(Int(CGWindowLevelForKey(.desktopWindow)))
        win.backgroundColor     = .clear
        win.isOpaque            = false
        win.hasShadow           = false
        win.ignoresMouseEvents  = true
        win.collectionBehavior  = [.canJoinAllSpaces, .stationary, .ignoresCycle]

        let rootView = JarvisRootView()
            .environmentObject(bridge)
            .environmentObject(phaseController)
            .frame(maxWidth: .infinity, maxHeight: .infinity)

        let hostingView = NSHostingView(rootView: rootView)
        hostingView.frame = screen.frame
        hostingView.wantsLayer = true
        hostingView.layer?.backgroundColor = NSColor.clear.cgColor

        win.contentView = hostingView
        return win
    }

    @objc private func screensDidChange() {
        setupWallpaperWindows()
    }
}
```

- [ ] **Step 3: Update JarvisRootView to receive phaseController from environment**

```swift
// File: Sources/JarvisTelemetry/JarvisRootView.swift

import SwiftUI

struct JarvisRootView: View {

    @EnvironmentObject var bridge: TelemetryBridge
    @EnvironmentObject var phaseController: HUDPhaseController
    @StateObject private var store = TelemetryStore()
    @StateObject private var moodEngine = SystemMoodEngine()

    var body: some View {
        ZStack {
            Color.clear

            switch phaseController.phase {
            case .boot:
                BootSequenceView()
                    .environmentObject(phaseController)
                    .environmentObject(store)
                    .transition(.opacity)

            case .loop:
                AnimatedCanvasHost()
                    .environmentObject(store)
                    .environmentObject(phaseController)
                    .environmentObject(moodEngine)
                    .transition(.opacity)

            case .shutdown:
                ShutdownSequenceView()
                    .environmentObject(phaseController)
                    .environmentObject(store)
                    .environmentObject(moodEngine)
                    .transition(.opacity)

            case .standby:
                Color.clear
            }
        }
        .onAppear {
            store.bind(to: bridge)
            moodEngine.bind(to: store)
            phaseController.startBoot(isWake: false)
        }
        .ignoresSafeArea()
    }
}
```

- [ ] **Step 4: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add Sources/JarvisTelemetry/ProcessLifecycleObserver.swift \
      Sources/JarvisTelemetry/AppDelegate.swift \
      Sources/JarvisTelemetry/JarvisRootView.swift
git commit -m "feat: add lifecycle observer — sleep/wake/lock/unlock/signal handling"
```

---

## Task 5: Boot Sequence — Core Animation Engine

**Files:**
- Modify: `Sources/JarvisTelemetry/BootSequenceView.swift`

The full theatrical 8-12s boot. This is the showpiece. Uses SwiftUI Canvas for the reactor build-up and overlay Text views for the diagnostic stream.

- [ ] **Step 1: Implement BootSequenceView**

```swift
// File: Sources/JarvisTelemetry/BootSequenceView.swift

import SwiftUI
import SceneKit

struct BootSequenceView: View {
    @EnvironmentObject var phaseController: HUDPhaseController
    @EnvironmentObject var store: TelemetryStore

    private let darkBlue = Color(red: 0.02, green: 0.04, blue: 0.08)
    private let cyan = Color(red: 0.00, green: 0.83, blue: 1.00)
    private let cyanBright = Color(red: 0.41, green: 0.95, blue: 0.95)
    private let cyanDim = Color(red: 0.00, green: 0.55, blue: 0.70)
    private let amber = Color(red: 1.00, green: 0.78, blue: 0.00)
    private let crimson = Color(red: 1.00, green: 0.15, blue: 0.20)
    private let steel = Color(red: 0.40, green: 0.52, blue: 0.58)

    var body: some View {
        let p = phaseController.bootProgress
        let isWake = phaseController.phase == .boot(isWake: true)

        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let cx = w / 2
            let cy = h / 2
            let R = min(w, h) * 0.42

            ZStack {
                darkBlue.ignoresSafeArea()

                // Phase 1: Core ignition (0-15%)
                if p > 0.02 {
                    BootCoreView(progress: p, cx: cx, cy: cy, R: R, cyan: cyan, cyanBright: cyanBright)
                }

                // Phase 2: Ring materialization (10-60%)
                if p > 0.10 {
                    BootRingsView(progress: p, cx: cx, cy: cy, R: R,
                                  cyan: cyan, cyanDim: cyanDim, amber: amber, crimson: crimson, steel: steel,
                                  store: store)
                }

                // Phase 3: Hex grid fade-in (25-40%)
                if p > 0.25 {
                    let gridOpacity = min(1.0, (p - 0.25) / 0.15)
                    HexGridCanvas(width: w, height: h, phase: p * 10, color: Color(red: 0, green: 0.2, blue: 0.3))
                        .opacity(gridOpacity)
                }

                // Phase 4: Scan lines (30%+)
                if p > 0.30 {
                    let scanOp = min(1.0, (p - 0.30) / 0.10)
                    ScanLineOverlay(height: h, phase: p * 10, color: cyan)
                        .opacity(scanOp)
                }

                // Phase 5: Shockwave ring at ignition (5-15%)
                if p > 0.05 && p < 0.20 {
                    BootShockwaveView(progress: (p - 0.05) / 0.15, cx: cx, cy: cy, maxR: max(w, h), cyan: cyan)
                }

                // Phase 6: Text diagnostic stream (15-90%)
                if p > 0.15 && !isWake {
                    BootTextStream(progress: p, store: store, cyan: cyan, cyanBright: cyanBright, amber: amber)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }

                // Phase 7: Side panels slide in (75-95%)
                if p > 0.75 {
                    let panelProgress = min(1.0, (p - 0.75) / 0.20)
                    BootPanelSlideIn(progress: panelProgress, width: w, height: h, cyan: cyan)
                }

                // Phase 8: "JARVIS ONLINE" text (90-100%)
                if p > 0.90 {
                    let textOp = p < 0.98 ? min(1.0, (p - 0.90) / 0.05) : max(0, 1.0 - (p - 0.98) / 0.02)
                    Text("JARVIS ONLINE")
                        .font(.custom("Menlo", size: 14)).tracking(8)
                        .foregroundColor(cyanBright.opacity(textOp))
                        .shadow(color: cyan.opacity(textOp * 0.8), radius: 12)
                        .position(x: cx, y: cy + R + 60)
                }
            }
        }
    }
}

// MARK: - Boot Sub-Components

/// Pulsing core that ignites and grows
struct BootCoreView: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color, cyanBright: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            // Core size grows from pixel to full over 0-30% of boot
            let coreProgress = min(1.0, progress / 0.30)
            let coreR = 2.0 + coreProgress * R * 0.015
            let glowR = coreR * 4
            let pulse = 0.85 + sin(progress * 40) * 0.15  // Fast pulse during boot

            // Outer glow layers
            for layer in 0..<5 {
                let lr = glowR + Double(layer) * 3
                let op = 0.08 * pulse * (1.0 - Double(layer) / 5.0) * coreProgress
                let rect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(op)))
            }

            // Hot core
            let hotRect = CGRect(x: c.x - coreR, y: c.y - coreR, width: coreR * 2, height: coreR * 2)
            ctx.fill(Path(ellipseIn: hotRect), with: .color(Color.white.opacity(0.3 * pulse * coreProgress)))
            ctx.fill(Path(ellipseIn: hotRect), with: .color(cyanBright.opacity(0.5 * pulse * coreProgress)))

            // Ignition flash at ~8% progress
            if progress > 0.06 && progress < 0.12 {
                let flashIntensity = 1.0 - abs(progress - 0.08) / 0.04
                let flashR = R * 0.15 * flashIntensity
                let flashRect = CGRect(x: c.x - flashR, y: c.y - flashR, width: flashR * 2, height: flashR * 2)
                ctx.fill(Path(ellipseIn: flashRect), with: .color(Color.white.opacity(0.4 * flashIntensity)))
            }
        }
        .allowsHitTesting(false)
    }
}

/// Rings materializing outward during boot
struct BootRingsView: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color, cyanDim: Color, amber: Color, crimson: Color, steel: Color
    let store: TelemetryStore

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let pi2 = Double.pi * 2.0

            // Rings materialize from inner to outer as progress goes 10% → 60%
            let ringProgress = min(1.0, (progress - 0.10) / 0.50)
            let maxRingIndex = Int(ringProgress * 220)

            for i in 0..<min(maxRingIndex, 220) {
                let frac = Double(i) / 220.0
                let r = R * (0.06 + frac * 0.91)

                // Each ring fades in over ~2% of total progress
                let ringBirthProgress = Double(i) / 220.0
                let ringAge = ringProgress - ringBirthProgress
                let ringOpacity = min(1.0, ringAge * 10)

                let distFromCenter = 1.0 - frac
                let baseOp = (0.14 + distFromCenter * 0.22) * ringOpacity
                let m = i % 18

                let path = Path { p in
                    p.addArc(center: c, radius: r, startAngle: .zero, endAngle: .radians(pi2), clockwise: false)
                }

                if m == 0 {
                    ctx.stroke(path, with: .color(steel.opacity(min(baseOp + 0.18, 0.50))), style: StrokeStyle(lineWidth: 2.2))
                } else if m == 3 || m == 12 {
                    ctx.stroke(path, with: .color(steel.opacity(baseOp * 1.2)), style: StrokeStyle(lineWidth: 2.0))
                } else {
                    ctx.stroke(path, with: .color(steel.opacity(baseOp * 0.7)), style: StrokeStyle(lineWidth: 0.4))
                }
            }

            // Core arcs appear at 45-55% progress
            if progress > 0.45 {
                let arcOp = min(1.0, (progress - 0.45) / 0.10)
                // E-Cores
                let eCores = store.eCoreUsages.isEmpty
                    ? Array(repeating: 0.5, count: max(store.eCoreCount, 10))
                    : store.eCoreUsages
                drawCoreArcs(ctx: ctx, c: c, usages: eCores, r: R * 0.845, w: 3, col: cyan, opacity: arcOp)

                // P-Cores
                if progress > 0.50 {
                    let pOp = min(1.0, (progress - 0.50) / 0.08)
                    let pCores = store.pCoreUsages.isEmpty
                        ? Array(repeating: 0.5, count: max(store.pCoreCount, 4))
                        : store.pCoreUsages
                    drawCoreArcs(ctx: ctx, c: c, usages: pCores, r: R * 0.745, w: 3, col: amber, opacity: pOp)
                }

                // S-Cores
                if progress > 0.55 {
                    let sOp = min(1.0, (progress - 0.55) / 0.08)
                    let sCores = store.sCoreUsages.isEmpty
                        ? Array(repeating: 0.3, count: max(store.sCoreCount, 1))
                        : store.sCoreUsages
                    drawCoreArcs(ctx: ctx, c: c, usages: sCores, r: R * 0.645, w: 2.5, col: crimson, opacity: sOp)
                }

                // GPU arc
                if progress > 0.55 {
                    let gOp = min(1.0, (progress - 0.55) / 0.08)
                    let gpu = store.gpuUsage > 0 ? store.gpuUsage : 0.4
                    let gS = -Double.pi * 0.75
                    let gE = gS + Double.pi * 1.5 * gpu
                    let gPath = Path { p in p.addArc(center: c, radius: R * 0.915, startAngle: .radians(gS), endAngle: .radians(gE), clockwise: false) }
                    ctx.stroke(gPath, with: .color(cyan.opacity(0.65 * gOp)), style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                }
            }
        }
        .allowsHitTesting(false)
    }

    private func drawCoreArcs(ctx: GraphicsContext, c: CGPoint, usages: [Double], r: Double, w: Double, col: Color, opacity: Double) {
        let n = usages.count
        guard n > 0 else { return }
        let pi2 = Double.pi * 2.0
        let sw = pi2 / Double(n)
        let gap = sw * 0.06
        let top = -Double.pi / 2.0

        for (i, u) in usages.enumerated() {
            let s0 = top + sw * Double(i) + gap / 2
            let s1 = s0 + sw - gap
            let fe = s0 + (s1 - s0) * max(u, 0.05)
            let fp = Path { p in p.addArc(center: c, radius: r, startAngle: .radians(s0), endAngle: .radians(fe), clockwise: false) }
            ctx.stroke(fp, with: .color(col.opacity(0.65 * opacity)), style: StrokeStyle(lineWidth: w, lineCap: .round))
        }
    }
}

/// Expanding shockwave ring at ignition
struct BootShockwaveView: View {
    let progress: Double  // 0.0 → 1.0 over the shockwave duration
    let cx: CGFloat, cy: CGFloat, maxR: CGFloat
    let cyan: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let r = progress * maxR * 0.8
            let opacity = (1.0 - progress) * 0.5
            let width = 2.0 + progress * 4.0

            let path = Path { p in
                p.addArc(center: c, radius: r, startAngle: .zero, endAngle: .radians(.pi * 2), clockwise: false)
            }
            ctx.stroke(path, with: .color(cyan.opacity(opacity)), style: StrokeStyle(lineWidth: width))
            // Inner glow
            let innerPath = Path { p in
                p.addArc(center: c, radius: r, startAngle: .zero, endAngle: .radians(.pi * 2), clockwise: false)
            }
            ctx.stroke(innerPath, with: .color(Color.white.opacity(opacity * 0.3)), style: StrokeStyle(lineWidth: width * 0.3))
        }
        .allowsHitTesting(false)
    }
}

/// Scrolling diagnostic text during boot
struct BootTextStream: View {
    let progress: Double
    let store: TelemetryStore
    let cyan: Color, cyanBright: Color, amber: Color

    private var visibleLines: [(text: String, color: Color, threshold: Double)] {
        let chip = store.chipName.isEmpty ? "APPLE SILICON" : store.chipName.uppercased()
        let eCt = store.eCoreCount > 0 ? store.eCoreCount : 10
        let pCt = store.pCoreCount > 0 ? store.pCoreCount : 4
        let sCt = store.sCoreCount > 0 ? store.sCoreCount : 1
        let gpuCt = store.gpuCoreCount > 0 ? store.gpuCoreCount : 40
        let memGB = store.memoryTotalGB > 0 ? Int(store.memoryTotalGB) : 128

        return [
            ("INITIALIZING JARVIS NEURAL INTERFACE...", cyan, 0.15),
            ("SCANNING SILICON TOPOLOGY...", cyan, 0.20),
            ("\(chip) DETECTED", cyanBright, 0.25),
            ("CORE CLUSTER 0: \(eCt)x EFFICIENCY — ONLINE", cyan, 0.35),
            ("CORE CLUSTER 1: \(pCt)x PERFORMANCE — ONLINE", amber, 0.40),
            ("CORE CLUSTER 2: \(sCt)x STORM — ONLINE", Color(red: 1, green: 0.15, blue: 0.2), 0.45),
            ("GPU COMPLEX: \(gpuCt)-CORE — ONLINE", cyan, 0.50),
            ("UNIFIED MEMORY: \(memGB)GB — MAPPED", cyan, 0.55),
            ("THERMAL ENVELOPE: NOMINAL", cyan, 0.60),
            ("CONFIGURING TELEMETRY STREAM...", cyan, 0.65),
            ("TELEMETRY ACTIVE — 1Hz REFRESH", cyanBright, 0.70),
            ("ALL SYSTEMS NOMINAL", cyanBright, 0.80),
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Spacer()

            ForEach(Array(visibleLines.enumerated()), id: \.offset) { idx, line in
                if progress >= line.threshold {
                    let lineAge = progress - line.threshold
                    let opacity = min(1.0, lineAge / 0.03)
                    // Character-by-character materialization
                    let charsToShow = min(line.text.count, Int(lineAge * 600))
                    let displayText = String(line.text.prefix(charsToShow))

                    Text(displayText)
                        .font(.custom("Menlo", size: 9)).tracking(2)
                        .foregroundColor(line.color.opacity(opacity * 0.7))
                        .shadow(color: line.color.opacity(opacity * 0.3), radius: 4)
                }
            }

            Spacer().frame(height: 40)
        }
        .padding(.leading, 40)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Side panels sliding in from edges
struct BootPanelSlideIn: View {
    let progress: Double  // 0 → 1
    let width: CGFloat, height: CGFloat
    let cyan: Color

    var body: some View {
        let offset = (1.0 - progress) * 200

        // Left panel zone
        Rectangle()
            .fill(Color.clear)
            .frame(width: width * 0.14, height: height * 0.5)
            .overlay(
                RoundedRectangle(cornerRadius: 3)
                    .stroke(cyan.opacity(0.2 * progress), lineWidth: 0.5)
            )
            .position(x: width * 0.085 - offset, y: height * 0.48)
            .opacity(progress)

        // Right panel zone
        Rectangle()
            .fill(Color.clear)
            .frame(width: width * 0.16, height: height * 0.5)
            .overlay(
                RoundedRectangle(cornerRadius: 3)
                    .stroke(cyan.opacity(0.2 * progress), lineWidth: 0.5)
            )
            .position(x: width * 0.92 + offset, y: height * 0.48)
            .opacity(progress)
    }
}
```

- [ ] **Step 2: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

Expected: Build succeeds. App launches → cinematic boot with core ignition, ring materialization, diagnostic text scrolling with real hardware data, then transitions to live HUD.

- [ ] **Step 3: Commit**

```bash
git add Sources/JarvisTelemetry/BootSequenceView.swift
git commit -m "feat: theatrical boot sequence — core ignition, ring materialization, hardware enumeration"
```

---

## Task 6: Ambient Particle Field

**Files:**
- Create: `Sources/JarvisTelemetry/ParticleField.swift`

30-50 holographic dust motes drifting across the screen. Speed and brightness modulated by mood.

- [ ] **Step 1: Create ParticleField**

```swift
// File: Sources/JarvisTelemetry/ParticleField.swift

import SwiftUI

struct Particle {
    var x: Double
    var y: Double
    var opacity: Double
    var size: Double
    var speed: Double        // pixels per second
    var wobblePhase: Double  // for sinusoidal drift
    var depth: Double        // 0 = far, 1 = close (affects size/brightness/speed)
    var age: Double          // seconds alive
    var lifetime: Double     // total seconds to live
}

struct ParticleFieldView: View {
    let width: CGFloat
    let height: CGFloat
    let phase: Double
    let speedMultiplier: Double
    let cyan: Color

    @State private var particles: [Particle] = []
    private let targetCount = 40

    var body: some View {
        Canvas { ctx, size in
            // Initialize particles if needed
            // (We use the phase to deterministically generate particles)
            let currentParticles = generateParticles(phase: phase, width: Double(width), height: Double(height))

            for p in currentParticles {
                let adjustedSize = (1.0 + p.depth) * p.size
                let adjustedOpacity = (0.1 + p.depth * 0.2) * p.opacity
                let rect = CGRect(
                    x: p.x - adjustedSize / 2,
                    y: p.y - adjustedSize / 2,
                    width: adjustedSize,
                    height: adjustedSize
                )
                ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(adjustedOpacity)))

                // Subtle glow halo for close particles
                if p.depth > 0.6 {
                    let glowSize = adjustedSize * 3
                    let glowRect = CGRect(
                        x: p.x - glowSize / 2,
                        y: p.y - glowSize / 2,
                        width: glowSize,
                        height: glowSize
                    )
                    ctx.fill(Path(ellipseIn: glowRect), with: .color(cyan.opacity(adjustedOpacity * 0.15)))
                }
            }
        }
        .allowsHitTesting(false)
    }

    /// Deterministic particle generation based on phase — no @State mutation needed
    private func generateParticles(phase: Double, width: Double, height: Double) -> [Particle] {
        var result: [Particle] = []
        let baseSpeed = 8.0 * speedMultiplier

        for i in 0..<targetCount {
            let seed = Double(i) * 137.508  // Golden angle spacing
            let depth = (sin(seed * 0.7) + 1) / 2  // 0-1
            let speed = (0.3 + depth * 0.7) * baseSpeed
            let lifetime = 15.0 + sin(seed * 0.3) * 8.0  // 7-23 seconds

            // Use phase to compute current position
            let birthPhase = seed.truncatingRemainder(dividingBy: lifetime)
            let age = (phase - birthPhase).truncatingRemainder(dividingBy: lifetime)
            let normalizedAge = age / lifetime  // 0 → 1

            // Position: drift from left to right with sinusoidal wobble
            let x = normalizedAge * (width + 100) - 50
            let wobble = sin(phase * 0.5 + seed * 0.2) * 30
            let baseY = (sin(seed * 2.3) + 1) / 2 * height
            let y = baseY + wobble

            // Fade in / fade out at edges
            let fadeIn = min(1.0, normalizedAge * 5)
            let fadeOut = min(1.0, (1.0 - normalizedAge) * 5)
            let opacity = fadeIn * fadeOut

            let size = 1.0 + depth * 1.5  // 1-2.5px

            result.append(Particle(
                x: x, y: y, opacity: opacity, size: size,
                speed: speed, wobblePhase: seed, depth: depth,
                age: age, lifetime: lifetime
            ))
        }
        return result
    }
}
```

- [ ] **Step 2: Add ParticleFieldView to JarvisHUDView**

In `JarvisHUDView.swift`, add the particle field as a new layer in the ZStack, after the ScanLineOverlay and before the reactor:

Find the line:
```swift
                // ── 3. FULL REACTOR ──────────────────────────────────────
```

Insert before it:
```swift
                // ── 2b. AMBIENT PARTICLES ───────────────────────────────
                ParticleFieldView(
                    width: w, height: h, phase: phase,
                    speedMultiplier: 1.0,
                    cyan: cyan
                )
```

- [ ] **Step 3: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add Sources/JarvisTelemetry/ParticleField.swift \
      Sources/JarvisTelemetry/JarvisHUDView.swift
git commit -m "feat: ambient holographic particle field — 40 depth-varied dust motes"
```

---

## Task 7: Holographic Flicker Effect

**Files:**
- Create: `Sources/JarvisTelemetry/HolographicFlicker.swift`

Random micro-glitches 1-3 times per minute. Horizontal tear + chromatic aberration.

- [ ] **Step 1: Create HolographicFlicker**

```swift
// File: Sources/JarvisTelemetry/HolographicFlicker.swift

import SwiftUI

struct HolographicFlickerModifier: ViewModifier {
    let phase: Double

    // Deterministic "random" flicker timing based on phase
    private var isFlickering: Bool {
        // Create pseudo-random flicker events ~2x per minute
        let flickerSeed = sin(phase * 0.037) * cos(phase * 0.023) // Slow pseudo-random
        let threshold = 0.997  // Only trigger when very close to 1.0
        return flickerSeed > threshold
    }

    private var flickerType: Int {
        // 0 = horizontal shift, 1 = band tear
        Int(abs(sin(phase * 7.3)) * 2) % 2
    }

    func body(content: Content) -> some View {
        if isFlickering {
            if flickerType == 0 {
                // Horizontal shift — entire view offsets 1-3px for 1-2 frames
                let shift = sin(phase * 100) * 3
                content
                    .offset(x: shift)
                    .colorMultiply(Color(red: 0.9, green: 1.0, blue: 1.1))  // Slight cyan tint
            } else {
                // More dramatic: overlay a "tear band"
                content
                    .overlay(
                        FlickerBandView(phase: phase)
                    )
            }
        } else {
            content
        }
    }
}

struct FlickerBandView: View {
    let phase: Double

    var body: some View {
        GeometryReader { geo in
            let bandY = abs(sin(phase * 13.7)) * geo.size.height
            let bandH: CGFloat = 40 + CGFloat(abs(sin(phase * 7.1))) * 40

            Rectangle()
                .fill(Color(red: 0, green: 0.83, blue: 1.0).opacity(0.03))
                .frame(height: bandH)
                .offset(x: sin(phase * 200) * 4, y: bandY)
        }
        .allowsHitTesting(false)
    }
}

extension View {
    func holographicFlicker(phase: Double) -> some View {
        modifier(HolographicFlickerModifier(phase: phase))
    }
}
```

- [ ] **Step 2: Apply flicker to the HUD**

In `JarvisHUDView.swift`, wrap the outermost ZStack content with the flicker modifier. Find the closing of the GeometryReader ZStack and add:

After the closing `}` of the ZStack (before the closing `}` of the GeometryReader), add `.holographicFlicker(phase: phase)`.

- [ ] **Step 3: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add Sources/JarvisTelemetry/HolographicFlicker.swift \
      Sources/JarvisTelemetry/JarvisHUDView.swift
git commit -m "feat: holographic flicker effect — random micro-glitches 1-3x per minute"
```

---

## Task 8: Chatter Engine & Streams

**Files:**
- Create: `Sources/JarvisTelemetry/ChatterEngine.swift`
- Create: `Sources/JarvisTelemetry/ChatterStreamView.swift`

Two scrolling text streams — primary diagnostics (left) and ambient intel (right).

- [ ] **Step 1: Create ChatterEngine**

```swift
// File: Sources/JarvisTelemetry/ChatterEngine.swift

import SwiftUI
import Combine

struct ChatterLine: Identifiable {
    let id = UUID()
    let text: String
    let color: Color
    let timestamp: Date
    let severity: DeltaSeverity
}

final class ChatterEngine: ObservableObject {
    @Published var primaryLines: [ChatterLine] = []    // Left stream — diagnostics
    @Published var secondaryLines: [ChatterLine] = []  // Right stream — ambient intel

    private var cancellables = Set<AnyCancellable>()
    private var ambientTimer: AnyCancellable?
    private var lastAmbientIndex = 0
    private let maxLines = 15
    private let cyan = Color(red: 0.00, green: 0.83, blue: 1.00)
    private let amber = Color(red: 1.00, green: 0.78, blue: 0.00)
    private let crimson = Color(red: 1.00, green: 0.15, blue: 0.20)

    func bind(to store: TelemetryStore) {
        // React to telemetry deltas → primary stream
        store.$latestDeltas
            .receive(on: DispatchQueue.main)
            .sink { [weak self] deltas in
                for delta in deltas {
                    let color: Color
                    switch delta.severity {
                    case .info: color = self?.cyan ?? .cyan
                    case .warning: color = self?.amber ?? .yellow
                    case .critical: color = self?.crimson ?? .red
                    }
                    self?.addPrimary(delta.label, color: color, severity: delta.severity)
                }
            }
            .store(in: &cancellables)

        // Ambient intel stream — periodic flavor text mixed with real data
        ambientTimer = Timer.publish(every: 4.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self, weak store] _ in
                guard let self, let store else { return }
                self.generateAmbientLine(store: store)
            }
    }

    func updateChatterRate(_ interval: Double) {
        ambientTimer?.cancel()
        ambientTimer = Timer.publish(every: interval, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                // Will be connected to store in bind
            }
    }

    private func addPrimary(_ text: String, color: Color, severity: DeltaSeverity) {
        let line = ChatterLine(text: text, color: color, timestamp: Date(), severity: severity)
        primaryLines.append(line)
        if primaryLines.count > maxLines {
            primaryLines.removeFirst(primaryLines.count - maxLines)
        }
    }

    private func addSecondary(_ text: String, color: Color = Color(red: 0, green: 0.83, blue: 1.0)) {
        let line = ChatterLine(text: text, color: color, timestamp: Date(), severity: .info)
        secondaryLines.append(line)
        if secondaryLines.count > 10 {
            secondaryLines.removeFirst(secondaryLines.count - 10)
        }
    }

    private func generateAmbientLine(store: TelemetryStore) {
        let lines: [String] = [
            String(format: "MEMORY PRESSURE: %.1f GB / %.0f GB ALLOCATED", store.memoryUsedGB, store.memoryTotalGB),
            String(format: "THERMAL COST: +%.1f°C ABOVE 50°C BASELINE", store.cctcDeltaC),
            String(format: "UMA EVICTION RATE: %.2f MB/s — %@", store.gumerMBs, store.gumerMBs < 2.0 ? "NOMINAL" : "ELEVATED"),
            String(format: "GPU COMPLEX: %.0f%% UTILIZATION — %d CORES", store.gpuUsage * 100, store.gpuCoreCount),
            String(format: "ANE SUBSYSTEM: %.2fW — %@", store.anePower, store.anePower < 0.1 ? "STANDBY" : "ACTIVE"),
            String(format: "DRAM READ BW: %.1f GB/s", store.dramReadBW),
            String(format: "DRAM WRITE BW: %.1f GB/s", store.dramWriteBW),
            String(format: "HYPERVISOR TAX: %.2f%% — DVHOP %@", store.dvhopCPUPct, store.dvhopCPUPct < 1.0 ? "NOMINAL" : "ELEVATED"),
            String(format: "TELEMETRY FRAME: #%d", store.frameCount),
            String(format: "SWAP UTILIZATION: %.1f GB ACTIVE", store.swapUsedGB),
            String(format: "CPU AGGREGATE: %.0f%% — %d CORES ACTIVE", store.cpuUsagePercent, store.totalCoreCount),
            String(format: "GPU FREQ: %.0f MHz", store.gpuFreqMHz),
        ]

        let idx = lastAmbientIndex % lines.count
        addSecondary(lines[idx])
        lastAmbientIndex += 1
    }
}
```

- [ ] **Step 2: Create ChatterStreamView**

```swift
// File: Sources/JarvisTelemetry/ChatterStreamView.swift

import SwiftUI

enum ChatterAlignment {
    case left, right
}

struct ChatterStreamView: View {
    @ObservedObject var engine: ChatterEngine
    let alignment: ChatterAlignment
    let width: CGFloat
    let height: CGFloat
    let phase: Double

    private var lines: [ChatterLine] {
        alignment == .left ? engine.primaryLines : engine.secondaryLines
    }

    private let baseOpacity: Double = 0.5
    private let fontSize: CGFloat = 9

    var body: some View {
        VStack(alignment: alignment == .left ? .leading : .trailing, spacing: 3) {
            ForEach(Array(lines.suffix(12).enumerated()), id: \.element.id) { index, line in
                let age = Date().timeIntervalSince(line.timestamp)
                let fadeIn = min(1.0, age * 3)  // Fade in over 0.33s
                let fadeOut = age > 10 ? max(0, 1.0 - (age - 10) / 3) : 1.0  // Fade out after 10s
                let opacity = fadeIn * fadeOut * (alignment == .left ? baseOpacity : 0.3)

                // Character-by-character materialization for recent lines
                let charsToShow: Int
                if age < 1.0 {
                    charsToShow = min(line.text.count, Int(age * 80))  // ~80 chars/sec typing
                } else {
                    charsToShow = line.text.count
                }

                Text(String(line.text.prefix(charsToShow)))
                    .font(.custom("Menlo", size: alignment == .left ? 9 : 8))
                    .tracking(alignment == .left ? 1 : 2)
                    .foregroundColor(line.color.opacity(opacity))
                    .shadow(color: line.color.opacity(opacity * 0.3), radius: 3)
                    .lineLimit(1)
            }
        }
        .frame(width: width, alignment: alignment == .left ? .leading : .trailing)
        .position(
            x: alignment == .left ? width / 2 + 30 : UIWidth() - width / 2 - 30,
            y: height * 0.65
        )
    }

    /// Helper to get screen width without GeometryReader
    private func UIWidth() -> CGFloat {
        NSScreen.main?.frame.width ?? 1920
    }
}
```

- [ ] **Step 3: Integrate chatter into JarvisHUDView**

In `JarvisHUDView.swift`, add chatter streams. First add a `@StateObject` for the engine at the top of `JarvisHUDView`, then add the stream views to the ZStack.

Add to `JarvisHUDView` struct, after the existing `@Environment` line:
```swift
    @StateObject private var chatterEngine = ChatterEngine()
```

Add to the ZStack, after the right panel stack:
```swift
                // ── 10. CHATTER STREAMS ─────────────────────────────────
                ChatterStreamView(engine: chatterEngine, alignment: .left,
                                  width: w * 0.20, height: h, phase: phase)
                ChatterStreamView(engine: chatterEngine, alignment: .right,
                                  width: w * 0.18, height: h, phase: phase)
```

Add to `.onAppear` (or create one if needed) after the view's ZStack:
```swift
        .onAppear {
            chatterEngine.bind(to: store)
        }
```

- [ ] **Step 4: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add Sources/JarvisTelemetry/ChatterEngine.swift \
      Sources/JarvisTelemetry/ChatterStreamView.swift \
      Sources/JarvisTelemetry/JarvisHUDView.swift
git commit -m "feat: full JARVIS chatter — dual text streams with real telemetry events"
```

---

## Task 9: Awareness Pulses

**Files:**
- Create: `Sources/JarvisTelemetry/AwarenessEngine.swift`

Expanding ripple rings from reactor core when telemetry crosses thresholds.

- [ ] **Step 1: Create AwarenessEngine with pulse overlay**

```swift
// File: Sources/JarvisTelemetry/AwarenessEngine.swift

import SwiftUI
import Combine

struct AwarenessPulse: Identifiable {
    let id = UUID()
    let color: Color
    let startTime: Date
    let duration: Double = 0.8
}

final class AwarenessEngine: ObservableObject {
    @Published var activePulses: [AwarenessPulse] = []

    private var cancellables = Set<AnyCancellable>()
    private var lastPulseTime = Date.distantPast
    private let cooldown: TimeInterval = 5.0  // Min 5s between pulses

    private let cyan = Color(red: 0.00, green: 0.83, blue: 1.00)
    private let amber = Color(red: 1.00, green: 0.78, blue: 0.00)
    private let crimson = Color(red: 1.00, green: 0.15, blue: 0.20)

    // Tracked thresholds
    private var prevTempBucket = 0
    private var prevCpuBucket = 0
    private var prevGpuBucket = 0
    private var prevSwapBucket = 0
    private var prevPowerBucket = 0

    func bind(to store: TelemetryStore) {
        store.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self, weak store] _ in
                guard let self, let store else { return }
                self.checkThresholds(store: store)
            }
            .store(in: &cancellables)

        // Clean up expired pulses
        Timer.publish(every: 0.5, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.activePulses.removeAll { Date().timeIntervalSince($0.startTime) > $0.duration }
            }
            .store(in: &cancellables)
    }

    private func checkThresholds(store: TelemetryStore) {
        // Temperature buckets: 45, 50, 55
        let tempBucket = store.cpuTemp > 55 ? 3 : store.cpuTemp > 50 ? 2 : store.cpuTemp > 45 ? 1 : 0
        if tempBucket != prevTempBucket {
            firePulse(color: tempBucket > prevTempBucket ? amber : cyan)
            prevTempBucket = tempBucket
        }

        // CPU load buckets: 50%, 80%
        let cpuAvg = (store.eCoreUsages + store.pCoreUsages + store.sCoreUsages).reduce(0, +) /
                     max(1, Double(store.eCoreUsages.count + store.pCoreUsages.count + store.sCoreUsages.count))
        let cpuBucket = cpuAvg > 0.8 ? 2 : cpuAvg > 0.5 ? 1 : 0
        if cpuBucket != prevCpuBucket {
            firePulse(color: cyan)
            prevCpuBucket = cpuBucket
        }

        // GPU load buckets: 60%, 90%
        let gpuBucket = store.gpuUsage > 0.9 ? 2 : store.gpuUsage > 0.6 ? 1 : 0
        if gpuBucket != prevGpuBucket {
            firePulse(color: cyan)
            prevGpuBucket = gpuBucket
        }

        // Swap: 25%, 50%
        let swapBucket = store.swapPressure > 0.5 ? 2 : store.swapPressure > 0.25 ? 1 : 0
        if swapBucket != prevSwapBucket {
            firePulse(color: amber)
            prevSwapBucket = swapBucket
        }

        // Power: 25W, 40W
        let powerBucket = store.totalPower > 40 ? 2 : store.totalPower > 25 ? 1 : 0
        if powerBucket != prevPowerBucket {
            firePulse(color: cyan)
            prevPowerBucket = powerBucket
        }
    }

    private func firePulse(color: Color) {
        let now = Date()
        guard now.timeIntervalSince(lastPulseTime) >= cooldown else { return }
        lastPulseTime = now
        activePulses.append(AwarenessPulse(color: color, startTime: now))
    }
}

/// Overlay view rendering expanding ripple rings
struct AwarenessPulseOverlay: View {
    @ObservedObject var engine: AwarenessEngine
    let cx: CGFloat, cy: CGFloat

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0/60.0)) { timeline in
            Canvas { ctx, size in
                let now = timeline.date
                for pulse in engine.activePulses {
                    let elapsed = now.timeIntervalSince(pulse.startTime)
                    let progress = elapsed / pulse.duration
                    guard progress < 1.0 else { continue }

                    let maxR = max(size.width, size.height) * 0.8
                    let r = progress * maxR
                    let opacity = (1.0 - progress) * 0.25
                    let width = 3.0 + progress * 2.0

                    let path = Path { p in
                        p.addArc(center: CGPoint(x: cx, y: cy), radius: r,
                                 startAngle: .zero, endAngle: .radians(.pi * 2), clockwise: false)
                    }
                    ctx.stroke(path, with: .color(pulse.color.opacity(opacity)),
                               style: StrokeStyle(lineWidth: width))
                    // Inner highlight
                    ctx.stroke(path, with: .color(Color.white.opacity(opacity * 0.15)),
                               style: StrokeStyle(lineWidth: width * 0.3))
                }
            }
        }
        .allowsHitTesting(false)
    }
}
```

- [ ] **Step 2: Add awareness overlay to JarvisHUDView**

Add `@StateObject private var awarenessEngine = AwarenessEngine()` to `JarvisHUDView`.

Add to the ZStack after the chatter streams:
```swift
                // ── 11. AWARENESS PULSES ────────────────────────────────
                AwarenessPulseOverlay(engine: awarenessEngine, cx: cx, cy: cy)
```

Add to `.onAppear`:
```swift
            awarenessEngine.bind(to: store)
```

- [ ] **Step 3: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add Sources/JarvisTelemetry/AwarenessEngine.swift \
      Sources/JarvisTelemetry/JarvisHUDView.swift
git commit -m "feat: awareness pulses — ripple rings on telemetry threshold crossings"
```

---

## Task 10: Cardiac Core Pulse & Load-Reactive Ring Speed

**Files:**
- Modify: `Sources/JarvisTelemetry/JarvisHUDView.swift` (JarvisReactorCanvas section)

Replace the simple sine-wave core pulse with a cardiac heartbeat rhythm tied to system load.

- [ ] **Step 1: Add cardiac pulse and speed multiplier to JarvisReactorCanvas**

In `JarvisReactorCanvas`, the core glow section currently uses:
```swift
let corePulse = 0.85 + sin(ph * 2.5) * 0.15
```

Replace the entire core glow section (find `// ── CORE GLOW`) with:

```swift
            // ── CORE GLOW — CARDIAC HEARTBEAT ───────────────────────
            // Heartbeat rhythm: quick contraction → slow release → pause
            // BPM scales with system load
            let bpm = 45.0 + min(1.0, (store.eCoreUsages + store.pCoreUsages + store.sCoreUsages)
                .reduce(0, +) / max(1, Double(store.eCoreUsages.count + store.pCoreUsages.count + store.sCoreUsages.count))) * 75.0
            let heartPeriod = 60.0 / bpm
            let heartPhase = (ph.truncatingRemainder(dividingBy: heartPeriod)) / heartPeriod
            let cardiac: Double
            if heartPhase < 0.1 {
                // Quick contraction (systole) — sharp rise
                cardiac = 0.85 + 0.15 * (heartPhase / 0.1)
            } else if heartPhase < 0.25 {
                // Slow release (diastole)
                cardiac = 1.0 - 0.15 * ((heartPhase - 0.1) / 0.15)
            } else if heartPhase < 0.35 {
                // Second smaller bump (dicrotic notch)
                cardiac = 0.85 + 0.05 * sin((heartPhase - 0.25) / 0.10 * .pi)
            } else {
                // Rest
                cardiac = 0.85
            }
            let corePulse = cardiac

            for layer in 0..<5 {
                let lr = R * 0.02 + Double(layer) * 3
                let lo = 0.08 * corePulse * (1.0 - Double(layer) / 5.0)
                let coreRect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                ctx.fill(Path(ellipseIn: coreRect), with: .color(cyan.opacity(lo)))
            }
            let hotR = R * 0.015 * corePulse
            let hotRect = CGRect(x: c.x - hotR, y: c.y - hotR, width: hotR * 2, height: hotR * 2)
            ctx.fill(Path(ellipseIn: hotRect), with: .color(Color.white.opacity(0.15 * corePulse)))
```

- [ ] **Step 2: Make ring rotation speed load-reactive**

In `JarvisReactorCanvas`, all `rot:` parameters in ticks, notch, arcs, chevrons, etc. use `rot: 0.06`, `rot: -0.10`, etc. These multiply against `ph` (the phase).

Add a speed multiplier near the top of the Canvas closure, after `let ph = phase`:

```swift
            // Load-reactive speed multiplier (1.0 at idle, up to 1.5 at full load)
            let cpuAvg = (store.eCoreUsages + store.pCoreUsages + store.sCoreUsages)
                .reduce(0, +) / max(1, Double(store.eCoreUsages.count + store.pCoreUsages.count + store.sCoreUsages.count))
            let speedMul = 1.0 + cpuAvg * 0.5
            let ph = phase * speedMul  // Override ph with load-reactive version
```

This single change makes ALL rotation parameters scale with system load since they all reference `ph`.

- [ ] **Step 3: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add Sources/JarvisTelemetry/JarvisHUDView.swift
git commit -m "feat: cardiac heartbeat core pulse + load-reactive ring speed"
```

---

## Task 11: Digit Cipher Flip Text

**Files:**
- Create: `Sources/JarvisTelemetry/DigitCipherText.swift`

When numeric values change, digits rapidly cycle through hex characters before landing on the correct value.

- [ ] **Step 1: Create DigitCipherText**

```swift
// File: Sources/JarvisTelemetry/DigitCipherText.swift

import SwiftUI

/// A text view that animates digit changes with an Iron Man hex-cipher flip effect.
/// When a value changes, each changed digit cycles through random chars before settling.
struct DigitCipherText: View {
    let value: String
    let font: Font
    let color: Color

    @State private var displayChars: [Character] = []
    @State private var targetChars: [Character] = []
    @State private var settledIndices: Set<Int> = []
    @State private var flipStartTime: Date?

    private let flipDuration: Double = 0.3      // Total flip time
    private let staggerDelay: Double = 0.03      // Delay between digits
    private let hexChars: [Character] = Array("0123456789ABCDEF")

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0/30.0)) { timeline in
            HStack(spacing: 0) {
                ForEach(Array(displayText(at: timeline.date).enumerated()), id: \.offset) { idx, char in
                    Text(String(char))
                        .font(font)
                        .foregroundColor(color)
                        .monospacedDigit()
                }
            }
        }
        .onChange(of: value) { newValue in
            startFlip(to: newValue)
        }
        .onAppear {
            displayChars = Array(value)
            targetChars = Array(value)
            settledIndices = Set(0..<value.count)
        }
    }

    private func startFlip(to newValue: String) {
        let newChars = Array(newValue)
        let oldChars = targetChars

        targetChars = newChars
        settledIndices = []

        // Only flip digits that actually changed
        for i in 0..<max(oldChars.count, newChars.count) {
            let oldChar = i < oldChars.count ? oldChars[i] : Character(" ")
            let newChar = i < newChars.count ? newChars[i] : Character(" ")
            if oldChar == newChar {
                settledIndices.insert(i)
            }
        }

        flipStartTime = Date()
        displayChars = Array(repeating: Character(" "), count: newChars.count)
    }

    private func displayText(at date: Date) -> [Character] {
        guard let start = flipStartTime else {
            return targetChars
        }

        let elapsed = date.timeIntervalSince(start)
        var result: [Character] = []

        for i in 0..<targetChars.count {
            if settledIndices.contains(i) {
                result.append(targetChars[i])
                continue
            }

            let digitDelay = Double(i) * staggerDelay
            let digitElapsed = elapsed - digitDelay

            if digitElapsed >= flipDuration {
                // Settled
                result.append(targetChars[i])
                settledIndices.insert(i)
            } else if digitElapsed > 0 {
                // Cycling through random chars
                let cycleIndex = Int(digitElapsed * 40) // ~40 changes per second
                let char = targetChars[i].isNumber || targetChars[i].isHexDigit
                    ? hexChars[abs(cycleIndex + i * 7) % hexChars.count]
                    : targetChars[i]
                result.append(char)
            } else {
                // Not started yet
                result.append(i < displayChars.count ? displayChars[i] : Character(" "))
            }
        }

        // Check if all settled
        if settledIndices.count >= targetChars.count {
            flipStartTime = nil
        }

        return result
    }
}

extension Character {
    var isHexDigit: Bool {
        "0123456789ABCDEFabcdef".contains(self)
    }
}
```

- [ ] **Step 2: Apply DigitCipherText to CentralStatsView watts display**

In `JarvisHUDView.swift`, find `CentralStatsView` and replace the watts Text with DigitCipherText:

Find:
```swift
Text(String(format: "%.0f", store.totalPower))
```
Replace with:
```swift
DigitCipherText(
    value: String(format: "%.0f", store.totalPower),
    font: .custom("Menlo", size: 48).weight(.bold),
    color: cyanBright
)
```

- [ ] **Step 3: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add Sources/JarvisTelemetry/DigitCipherText.swift \
      Sources/JarvisTelemetry/JarvisHUDView.swift
git commit -m "feat: digit cipher flip — Iron Man hex-cycling effect on value changes"
```

---

## Task 12: Floating Diagnostic Panels

**Files:**
- Create: `Sources/JarvisTelemetry/FloatingPanelManager.swift`

Periodically materializing diagnostic panels that zoom in, hold, and dissolve.

- [ ] **Step 1: Create FloatingPanelManager**

```swift
// File: Sources/JarvisTelemetry/FloatingPanelManager.swift

import SwiftUI
import Combine

struct FloatingPanel: Identifiable {
    let id = UUID()
    let content: FloatingPanelContent
    let position: CGPoint
    let startTime: Date
    let lifetime: Double  // 4-8 seconds
}

enum FloatingPanelContent {
    case coreTopo([Double], [Double], [Double])  // e, p, s core usages
    case thermalGradient(Double, Double)           // cpu, gpu temps
    case memoryBreakdown(Double, Double, Double)   // used, total, swap GB
    case powerBudget(Double, Double, Double, Double) // cpu, gpu, ane, dram watts
    case systemSnapshot(String, Int, Double, String) // chip, cores, memGB, thermal
}

final class FloatingPanelManager: ObservableObject {
    @Published var panels: [FloatingPanel] = []

    private var cancellables = Set<AnyCancellable>()
    private var spawnTimer: AnyCancellable?
    private var contentIndex = 0

    func bind(to store: TelemetryStore) {
        spawnTimer = Timer.publish(every: 10.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self, weak store] _ in
                guard let self, let store else { return }
                self.spawnPanel(store: store)
            }

        // Clean expired panels
        Timer.publish(every: 1.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.panels.removeAll { Date().timeIntervalSince($0.startTime) > $0.lifetime + 1.0 }
            }
            .store(in: &cancellables)
    }

    private func spawnPanel(store: TelemetryStore) {
        guard panels.count < 2 else { return }

        let contents: [FloatingPanelContent] = [
            .coreTopo(store.eCoreUsages, store.pCoreUsages, store.sCoreUsages),
            .thermalGradient(store.cpuTemp, store.gpuTemp),
            .memoryBreakdown(store.memoryUsedGB, store.memoryTotalGB, store.swapUsedGB),
            .powerBudget(store.totalPower - store.anePower, 0, store.anePower, 0),
            .systemSnapshot(store.chipName, store.totalCoreCount, store.memoryTotalGB, store.thermalState),
        ]

        let content = contents[contentIndex % contents.count]
        contentIndex += 1

        // Random position in middle third of screen
        let screenW = NSScreen.main?.frame.width ?? 1920
        let screenH = NSScreen.main?.frame.height ?? 1080
        let x = screenW * (0.30 + Double.random(in: 0...0.40))
        let y = screenH * (0.25 + Double.random(in: 0...0.30))

        let panel = FloatingPanel(
            content: content,
            position: CGPoint(x: x, y: y),
            startTime: Date(),
            lifetime: Double.random(in: 5...8)
        )
        panels.append(panel)
    }
}

struct FloatingPanelOverlay: View {
    @ObservedObject var manager: FloatingPanelManager
    let cyan: Color
    let amber: Color

    var body: some View {
        ForEach(manager.panels) { panel in
            FloatingPanelView(panel: panel, cyan: cyan, amber: amber)
        }
    }
}

struct FloatingPanelView: View {
    let panel: FloatingPanel
    let cyan: Color
    let amber: Color

    @State private var now = Date()

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0/30.0)) { timeline in
            let elapsed = timeline.date.timeIntervalSince(panel.startTime)
            let materializeProgress = min(1.0, elapsed / 0.5)
            let dissolveStart = panel.lifetime - 0.5
            let dissolveProgress = elapsed > dissolveStart ? min(1.0, (elapsed - dissolveStart) / 0.5) : 0

            let opacity = materializeProgress * (1.0 - dissolveProgress)
            let scale = 0.7 + materializeProgress * 0.3

            VStack(alignment: .leading, spacing: 4) {
                panelContent
            }
            .padding(10)
            .background(Color.black.opacity(0.55 * opacity))
            .overlay(
                RoundedRectangle(cornerRadius: 3)
                    .stroke(cyan.opacity(0.25 * opacity), lineWidth: 0.5)
            )
            .scaleEffect(scale)
            .opacity(opacity)
            .position(panel.position)
        }
    }

    @ViewBuilder
    private var panelContent: some View {
        switch panel.content {
        case .coreTopo(let e, let p, let s):
            Text("CORE TOPOLOGY")
                .font(.custom("Menlo", size: 7)).tracking(3).foregroundColor(cyan.opacity(0.5))
            HStack(spacing: 2) {
                ForEach(Array(e.enumerated()), id: \.offset) { _, val in
                    Rectangle().fill(cyan.opacity(val * 0.6)).frame(width: 3, height: CGFloat(val * 20))
                }
                Rectangle().fill(Color.clear).frame(width: 2, height: 1) // spacer
                ForEach(Array(p.enumerated()), id: \.offset) { _, val in
                    Rectangle().fill(amber.opacity(val * 0.6)).frame(width: 3, height: CGFloat(val * 20))
                }
            }
            .frame(height: 20, alignment: .bottom)

        case .thermalGradient(let cpu, let gpu):
            Text("THERMAL")
                .font(.custom("Menlo", size: 7)).tracking(3).foregroundColor(cyan.opacity(0.5))
            Text(String(format: "CPU: %.1f°C  GPU: %.1f°C", cpu, gpu))
                .font(.custom("Menlo", size: 10)).foregroundColor(cpu > 50 ? amber : cyan)

        case .memoryBreakdown(let used, let total, let swap):
            Text("MEMORY")
                .font(.custom("Menlo", size: 7)).tracking(3).foregroundColor(cyan.opacity(0.5))
            Text(String(format: "%.1f / %.0f GB", used, total))
                .font(.custom("Menlo", size: 10)).foregroundColor(cyan.opacity(0.7))
            if swap > 0.01 {
                Text(String(format: "SWAP: %.2f GB", swap))
                    .font(.custom("Menlo", size: 8)).foregroundColor(amber.opacity(0.5))
            }

        case .powerBudget(let cpu, _, let ane, _):
            Text("POWER BUDGET")
                .font(.custom("Menlo", size: 7)).tracking(3).foregroundColor(cyan.opacity(0.5))
            Text(String(format: "CPU: %.1fW  ANE: %.2fW", cpu, ane))
                .font(.custom("Menlo", size: 10)).foregroundColor(cyan.opacity(0.7))

        case .systemSnapshot(let chip, let cores, let mem, let thermal):
            Text("SYSTEM")
                .font(.custom("Menlo", size: 7)).tracking(3).foregroundColor(cyan.opacity(0.5))
            Text("\(chip) • \(cores) CORES")
                .font(.custom("Menlo", size: 9)).foregroundColor(cyan.opacity(0.6))
            Text(String(format: "%.0f GB • %@", mem, thermal.uppercased()))
                .font(.custom("Menlo", size: 9)).foregroundColor(cyan.opacity(0.5))
        }
    }
}
```

- [ ] **Step 2: Add floating panels to JarvisHUDView**

Add `@StateObject private var floatingPanelManager = FloatingPanelManager()` to `JarvisHUDView`.

Add to ZStack:
```swift
                // ── 12. FLOATING DIAGNOSTIC PANELS ──────────────────────
                FloatingPanelOverlay(manager: floatingPanelManager, cyan: cyan, amber: amber)
```

Add to `.onAppear`:
```swift
            floatingPanelManager.bind(to: store)
```

- [ ] **Step 3: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add Sources/JarvisTelemetry/FloatingPanelManager.swift \
      Sources/JarvisTelemetry/JarvisHUDView.swift
git commit -m "feat: floating diagnostic panels — materialize/hold/dissolve lifecycle"
```

---

## Task 13: Scanner Overlay

**Files:**
- Create: `Sources/JarvisTelemetry/ScannerOverlay.swift`

Full-width scan sweep every 30-45 seconds that illuminates elements as it passes.

- [ ] **Step 1: Create ScannerOverlay**

```swift
// File: Sources/JarvisTelemetry/ScannerOverlay.swift

import SwiftUI

struct ScannerSweepOverlay: View {
    let width: CGFloat
    let height: CGFloat
    let phase: Double
    let cyan: Color

    var body: some View {
        Canvas { ctx, size in
            // Sweep every ~35 seconds (takes 3 seconds to traverse)
            let sweepPeriod = 35.0
            let sweepDuration = 3.0
            let cyclePhase = phase.truncatingRemainder(dividingBy: sweepPeriod)

            guard cyclePhase < sweepDuration else { return }

            let sweepProgress = cyclePhase / sweepDuration
            let scanY = sweepProgress * Double(height)
            let trailHeight: Double = 40

            // Bright scan line
            let scanLine = Path { p in
                p.move(to: CGPoint(x: 0, y: scanY))
                p.addLine(to: CGPoint(x: Double(width), y: scanY))
            }
            ctx.stroke(scanLine, with: .color(cyan.opacity(0.35)), style: StrokeStyle(lineWidth: 1.5))
            ctx.stroke(scanLine, with: .color(Color.white.opacity(0.12)), style: StrokeStyle(lineWidth: 0.5))

            // Gradient trail behind the scan line
            for i in 0..<Int(trailHeight) {
                let y = scanY - Double(i)
                guard y >= 0 else { continue }
                let trailOpacity = (1.0 - Double(i) / trailHeight) * 0.06
                let trail = Path { p in
                    p.move(to: CGPoint(x: 0, y: y))
                    p.addLine(to: CGPoint(x: Double(width), y: y))
                }
                ctx.stroke(trail, with: .color(cyan.opacity(trailOpacity)), style: StrokeStyle(lineWidth: 1))
            }
        }
        .allowsHitTesting(false)
    }
}
```

- [ ] **Step 2: Add to JarvisHUDView ZStack**

After the awareness pulses:
```swift
                // ── 13. SCANNER SWEEP ───────────────────────────────────
                ScannerSweepOverlay(width: w, height: h, phase: phase, cyan: cyan)
```

- [ ] **Step 3: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add Sources/JarvisTelemetry/ScannerOverlay.swift \
      Sources/JarvisTelemetry/JarvisHUDView.swift
git commit -m "feat: scanner sweep overlay — full-width scan every 35 seconds"
```

---

## Task 14: Shutdown Sequence

**Files:**
- Modify: `Sources/JarvisTelemetry/ShutdownSequenceView.swift`

The cinematic power-down: ring deceleration, particle implosion, core dimming, final flash.

- [ ] **Step 1: Implement ShutdownSequenceView**

```swift
// File: Sources/JarvisTelemetry/ShutdownSequenceView.swift

import SwiftUI

struct ShutdownSequenceView: View {
    @EnvironmentObject var phaseController: HUDPhaseController
    @EnvironmentObject var store: TelemetryStore
    @EnvironmentObject var moodEngine: SystemMoodEngine

    private let darkBlue = Color(red: 0.02, green: 0.04, blue: 0.08)
    private let cyan = Color(red: 0.00, green: 0.83, blue: 1.00)
    private let cyanBright = Color(red: 0.41, green: 0.95, blue: 0.95)
    private let cyanDim = Color(red: 0.00, green: 0.55, blue: 0.70)
    private let steel = Color(red: 0.40, green: 0.52, blue: 0.58)

    var body: some View {
        let p = phaseController.shutdownProgress

        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let cx = w / 2
            let cy = h / 2
            let R = min(w, h) * 0.42

            TimelineView(.animation(minimumInterval: 1.0/60.0)) { timeline in
                let time = timeline.date.timeIntervalSinceReferenceDate

                ZStack {
                    darkBlue.ignoresSafeArea()

                    // Hex grid fading out (50-80% of shutdown)
                    if p < 0.80 {
                        let gridOp = p > 0.50 ? max(0, 1.0 - (p - 0.50) / 0.30) : 1.0
                        HexGridCanvas(width: w, height: h, phase: time, color: Color(red: 0, green: 0.2, blue: 0.3))
                            .opacity(gridOp)
                    }

                    // Reactor rings — decelerating
                    ShutdownReactorView(progress: p, time: time, cx: cx, cy: cy, R: R,
                                        cyan: cyan, cyanDim: cyanDim, steel: steel, store: store)

                    // Particle implosion (30-70% of shutdown)
                    if p > 0.30 && p < 0.75 {
                        ShutdownParticleImplosion(progress: (p - 0.30) / 0.45, cx: cx, cy: cy,
                                                   width: w, height: h, cyan: cyan)
                    }

                    // "SHUTDOWN INITIATED" text (0-20%)
                    if p < 0.25 {
                        let textOp = p < 0.05 ? p / 0.05 : max(0, 1.0 - (p - 0.15) / 0.10)
                        Text("SHUTDOWN INITIATED")
                            .font(.custom("Menlo", size: 12)).tracking(6)
                            .foregroundColor(cyan.opacity(textOp * 0.7))
                            .shadow(color: cyan.opacity(textOp * 0.4), radius: 8)
                            .position(x: cx, y: cy + R + 50)
                    }

                    // Shutdown status text (20-80%)
                    ShutdownTextView(progress: p, cx: cx, cy: cy, R: R, cyan: cyan)

                    // Final flash at ~82%
                    if p > 0.80 && p < 0.88 {
                        let flashIntensity = 1.0 - abs(p - 0.83) / 0.05
                        let flashR = R * 0.10 * flashIntensity
                        Circle()
                            .fill(Color.white.opacity(0.5 * max(0, flashIntensity)))
                            .frame(width: flashR * 2, height: flashR * 2)
                            .position(x: cx, y: cy)
                    }

                    // "JARVIS OFFLINE" (88-98%)
                    if p > 0.88 {
                        let textOp = p < 0.92 ? (p - 0.88) / 0.04 : max(0, 1.0 - (p - 0.95) / 0.05)
                        Text("JARVIS OFFLINE")
                            .font(.custom("Menlo", size: 14)).tracking(8)
                            .foregroundColor(cyan.opacity(textOp * 0.5))
                            .shadow(color: cyan.opacity(textOp * 0.3), radius: 6)
                            .position(x: cx, y: cy)
                    }
                }
            }
        }
    }
}

/// Reactor rings decelerating during shutdown
struct ShutdownReactorView: View {
    let progress: Double
    let time: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color, cyanDim: Color, steel: Color
    let store: TelemetryStore

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let pi2 = Double.pi * 2.0

            // Ring deceleration: outer rings stop first, inner last
            // Each ring has exponential velocity decay
            let baseDecay = 0.97  // Per-frame decay rate
            let maxRingsToDraw = max(0, Int((1.0 - progress * 0.8) * 220))

            for i in 0..<min(maxRingsToDraw, 220) {
                let frac = Double(i) / 220.0
                let r = R * (0.06 + frac * 0.91)

                // Outer rings fade first
                let ringProgress = frac  // 0 = innermost, 1 = outermost
                let fadeStart = ringProgress * 0.6  // Outer starts fading at 0%
                let ringOpacity: Double
                if progress > fadeStart + 0.30 {
                    ringOpacity = 0
                } else if progress > fadeStart {
                    ringOpacity = 1.0 - (progress - fadeStart) / 0.30
                } else {
                    ringOpacity = 1.0
                }

                guard ringOpacity > 0.01 else { continue }

                let distFromCenter = 1.0 - frac
                let baseOp = (0.14 + distFromCenter * 0.22) * ringOpacity

                let path = Path { p in
                    p.addArc(center: c, radius: r, startAngle: .zero,
                             endAngle: .radians(pi2), clockwise: false)
                }
                ctx.stroke(path, with: .color(steel.opacity(baseOp * 0.7)),
                           style: StrokeStyle(lineWidth: 0.4))
            }

            // Core dimming (60-85% of shutdown)
            if progress < 0.85 {
                let coreBright = progress > 0.60 ? max(0, 1.0 - (progress - 0.60) / 0.25) : 1.0
                let coreScale = progress > 0.60 ? max(0.3, 1.0 - (progress - 0.60) / 0.40) : 1.0
                let coreR = R * 0.015 * coreScale

                for layer in 0..<3 {
                    let lr = coreR + Double(layer) * 2
                    let lo = 0.06 * coreBright * (1.0 - Double(layer) / 3.0)
                    let rect = CGRect(x: c.x - lr, y: c.y - lr, width: lr * 2, height: lr * 2)
                    ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(lo)))
                }

                let hotRect = CGRect(x: c.x - coreR, y: c.y - coreR, width: coreR * 2, height: coreR * 2)
                ctx.fill(Path(ellipseIn: hotRect), with: .color(Color.white.opacity(0.12 * coreBright)))
            }
        }
        .allowsHitTesting(false)
    }
}

/// Particles being pulled toward the core during shutdown
struct ShutdownParticleImplosion: View {
    let progress: Double  // 0 → 1
    let cx: CGFloat, cy: CGFloat
    let width: CGFloat, height: CGFloat
    let cyan: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: cx, y: cy)
            let particleCount = 30

            for i in 0..<particleCount {
                let seed = Double(i) * 137.508
                // Start position: scattered around screen
                let startX = (sin(seed * 2.3) + 1) / 2 * Double(width)
                let startY = (cos(seed * 3.7) + 1) / 2 * Double(height)

                // Lerp toward center with acceleration (ease-in)
                let t = progress * progress  // Quadratic ease-in — accelerates toward center
                let x = startX + (Double(c.x) - startX) * t
                let y = startY + (Double(c.y) - startY) * t

                // Fade out as approaching center
                let distToCenter = sqrt(pow(x - Double(c.x), 2) + pow(y - Double(c.y), 2))
                let maxDist = sqrt(pow(Double(width)/2, 2) + pow(Double(height)/2, 2))
                let opacity = min(0.4, distToCenter / maxDist)

                let sz = 1.5 + (1.0 - progress) * 1.0
                let rect = CGRect(x: x - sz/2, y: y - sz/2, width: sz, height: sz)
                ctx.fill(Path(ellipseIn: rect), with: .color(cyan.opacity(opacity)))

                // Flash when very close to center
                if distToCenter < 20 {
                    let flashSz = sz * 3
                    let flashRect = CGRect(x: x - flashSz/2, y: y - flashSz/2, width: flashSz, height: flashSz)
                    ctx.fill(Path(ellipseIn: flashRect), with: .color(Color.white.opacity(0.15)))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

/// Status text messages during shutdown
struct ShutdownTextView: View {
    let progress: Double
    let cx: CGFloat, cy: CGFloat, R: CGFloat
    let cyan: Color

    private var messages: [(text: String, threshold: Double, fadeEnd: Double)] {
        [
            ("SECURING TELEMETRY STREAM...", 0.12, 0.25),
            ("CORE METRICS: ARCHIVED", 0.20, 0.35),
            ("POWERING DOWN SUBSYSTEMS...", 0.28, 0.45),
            ("GPU COMPLEX: OFFLINE", 0.38, 0.55),
            ("CORE CLUSTERS: OFFLINE", 0.48, 0.65),
            ("THERMAL MONITORING: SUSPENDED", 0.58, 0.75),
        ]
    }

    var body: some View {
        VStack(spacing: 4) {
            ForEach(Array(messages.enumerated()), id: \.offset) { _, msg in
                if progress >= msg.threshold {
                    let fadeIn = min(1.0, (progress - msg.threshold) / 0.03)
                    let fadeOut = progress > msg.fadeEnd ? max(0, 1.0 - (progress - msg.fadeEnd) / 0.05) : 1.0
                    Text(msg.text)
                        .font(.custom("Menlo", size: 9)).tracking(2)
                        .foregroundColor(cyan.opacity(fadeIn * fadeOut * 0.5))
                }
            }
        }
        .position(x: cx, y: cy + R + 80)
    }
}
```

- [ ] **Step 2: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add Sources/JarvisTelemetry/ShutdownSequenceView.swift
git commit -m "feat: cinematic shutdown — ring deceleration, particle implosion, final flash"
```

---

## Task 15: Lock Screen Manager

**Files:**
- Create: `Sources/JarvisTelemetry/LockScreenManager.swift`

Renders reactor standby state to PNG and sets it as macOS wallpaper.

- [ ] **Step 1: Create LockScreenManager**

```swift
// File: Sources/JarvisTelemetry/LockScreenManager.swift

import AppKit
import SwiftUI

final class LockScreenManager {

    private let supportDir: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("JarvisTelemetry")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    /// Render a standby wallpaper and set it for all screens
    func setStandbyWallpaper() {
        let pngURL = supportDir.appendingPathComponent("jarvis-standby.png")

        guard let screen = NSScreen.main else { return }
        let width = Int(screen.frame.width)
        let height = Int(screen.frame.height)

        // Render the standby image
        guard let image = renderStandbyImage(width: width, height: height) else {
            NSLog("[LockScreenManager] Failed to render standby image")
            return
        }

        // Save as PNG
        guard let tiffData = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData),
              let pngData = bitmap.representation(using: .png, properties: [:]) else {
            NSLog("[LockScreenManager] Failed to convert to PNG")
            return
        }

        do {
            try pngData.write(to: pngURL)
            NSLog("[LockScreenManager] Standby image saved to: \(pngURL.path)")
        } catch {
            NSLog("[LockScreenManager] Failed to save PNG: \(error)")
            return
        }

        // Set as wallpaper for all screens
        for screen in NSScreen.screens {
            do {
                try NSWorkspace.shared.setDesktopImageURL(pngURL, for: screen, options: [:])
                NSLog("[LockScreenManager] Wallpaper set for screen: \(screen.localizedName)")
            } catch {
                NSLog("[LockScreenManager] Failed to set wallpaper: \(error)")
            }
        }
    }

    private func renderStandbyImage(width: Int, height: Int) -> NSImage? {
        let image = NSImage(size: NSSize(width: width, height: height))
        image.lockFocus()

        guard let ctx = NSGraphicsContext.current?.cgContext else {
            image.unlockFocus()
            return nil
        }

        let w = CGFloat(width)
        let h = CGFloat(height)
        let cx = w / 2
        let cy = h / 2
        let R = min(w, h) * 0.42

        // Background
        ctx.setFillColor(NSColor(red: 0.02, green: 0.04, blue: 0.08, alpha: 1.0).cgColor)
        ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))

        // Dim reactor rings (subset, no rotation)
        let steel = NSColor(red: 0.40, green: 0.52, blue: 0.58, alpha: 1.0)
        let cyanColor = NSColor(red: 0.00, green: 0.83, blue: 1.00, alpha: 1.0)

        for i in stride(from: 0, to: 220, by: 3) {
            let frac = Double(i) / 220.0
            let r = R * (0.06 + frac * 0.91)
            let opacity = (0.08 + (1.0 - frac) * 0.12) * 0.5  // Dimmed
            ctx.setStrokeColor(steel.withAlphaComponent(opacity).cgColor)
            ctx.setLineWidth(0.5)
            ctx.addArc(center: CGPoint(x: cx, y: cy), radius: r, startAngle: 0, endAngle: .pi * 2, clockwise: false)
            ctx.strokePath()
        }

        // Dim core glow
        let coreR: CGFloat = 6
        ctx.setFillColor(cyanColor.withAlphaComponent(0.04).cgColor)
        ctx.fillEllipse(in: CGRect(x: cx - coreR * 3, y: cy - coreR * 3, width: coreR * 6, height: coreR * 6))
        ctx.setFillColor(cyanColor.withAlphaComponent(0.08).cgColor)
        ctx.fillEllipse(in: CGRect(x: cx - coreR, y: cy - coreR, width: coreR * 2, height: coreR * 2))

        // "SYSTEM STANDBY" text
        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont(name: "Menlo", size: 12) ?? NSFont.monospacedSystemFont(ofSize: 12, weight: .regular),
            .foregroundColor: cyanColor.withAlphaComponent(0.25),
            .kern: 6.0
        ]
        let text = "SYSTEM STANDBY" as NSString
        let textSize = text.size(withAttributes: attrs)
        text.draw(at: CGPoint(x: cx - textSize.width / 2, y: cy - R - 40), withAttributes: attrs)

        // Time and date
        let df = DateFormatter()
        df.dateFormat = "HH:mm"
        let timeStr = df.string(from: Date()) as NSString
        let timeAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont(name: "Menlo", size: 24) ?? NSFont.monospacedSystemFont(ofSize: 24, weight: .light),
            .foregroundColor: cyanColor.withAlphaComponent(0.15),
        ]
        let timeSize = timeStr.size(withAttributes: timeAttrs)
        timeStr.draw(at: CGPoint(x: cx - timeSize.width / 2, y: cy + R + 20), withAttributes: timeAttrs)

        image.unlockFocus()
        return image
    }
}
```

- [ ] **Step 2: Wire lock screen manager into HUDPhaseController**

Add to `HUDPhaseController.swift`:

After the `@Published var shutdownProgress` line, add:
```swift
    let lockScreenManager = LockScreenManager()
```

In `transitionToStandby()`, change to:
```swift
    private func transitionToStandby() {
        phase = .standby
        lockScreenManager.setStandbyWallpaper()
    }
```

- [ ] **Step 3: Build and verify**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add Sources/JarvisTelemetry/LockScreenManager.swift \
      Sources/JarvisTelemetry/HUDPhaseController.swift
git commit -m "feat: lock screen standby — renders dormant reactor PNG as wallpaper"
```

---

## Task 16: Rebrand S.H.I.E.L.D. → macOS SILICON & Final Polish

**Files:**
- Modify: `Sources/JarvisTelemetry/JarvisHUDView.swift`

Replace "S.H.I.E.L.D. OS" with "macOS SILICON" in TopBarView.

- [ ] **Step 1: Update TopBarView**

In `JarvisHUDView.swift`, find:
```swift
                    Text("S.H.I.E.L.D. OS")
```
Replace with:
```swift
                    Text("macOS SILICON")
```

- [ ] **Step 2: Add `@EnvironmentObject var phaseController: HUDPhaseController` to JarvisHUDView**

At the top of `JarvisHUDView` struct, ensure it has:
```swift
    @EnvironmentObject var phaseController: HUDPhaseController
```

This allows mood engine and chatter to read the phase state.

- [ ] **Step 3: Build full app end-to-end**

```bash
cd JarvisTelemetry && swift build -c release 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add Sources/JarvisTelemetry/JarvisHUDView.swift
git commit -m "feat: rebrand S.H.I.E.L.D. → macOS SILICON, wire phase controller to HUD"
```

---

## Build Verification After All Tasks

```bash
cd JarvisTelemetry && swift build -c release 2>&1
```

If build succeeds, test the full experience:
```bash
cd mactop && go build -o ../JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon . && cd ../JarvisTelemetry && swift build -c release && sudo .build/release/JarvisTelemetry
```

Expected:
1. Dark screen → core pixel appears → ignition flash + shockwave
2. Rings materialize outward with diagnostic text scrolling real hardware
3. Transition to live HUD with:
   - Cardiac heartbeat core (pulse rate varies with load)
   - Rings spinning (faster under load)
   - Dual chatter streams with real telemetry events
   - Floating diagnostic panels appearing/dissolving
   - Ambient particles drifting
   - Occasional holographic flicker
   - Awareness ripple pulses on threshold crossings
   - Scanner sweep every ~35 seconds
   - Digit cipher flip on watts display
4. On Ctrl+C: cinematic shutdown sequence
5. Static standby wallpaper left behind
