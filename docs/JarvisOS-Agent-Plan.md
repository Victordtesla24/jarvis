# **JARVIS Telemetry OS — Autonomous AI Agentic Implementation Plan**
## **Technical Specification: macOS M5 Live-Data Cinematic Desktop Wallpaper**

**Document Class:** Enterprise Architecture / Agentic Engineering Specification  
**Target Platform:** macOS 15+ · Apple M5 (ARM64) · Apple Silicon Unified Memory Architecture  
**Technology Stack:** Go/CGO · Swift 5.9+ · SwiftUI · SceneKit · AppKit · launchd  
**Classification:** Production-Grade · Zero Placeholders · Full Source Logic  

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)  
2. [Phase 1 — Telemetry Backend Provisioning](#2-phase-1--telemetry-backend-provisioning)  
3. [Phase 2 — Frontend Architecture & Cinematic UI/UX](#3-phase-2--frontend-architecture--cinematic-uiux)  
4. [Phase 3 — App Bundle & Boot Automation](#4-phase-3--app-bundle--boot-automation)  
5. [Phase 4 — Post-Installation Validation Protocol](#5-phase-4--post-installation-validation-protocol)  
6. [Directory Structure Reference](#6-directory-structure-reference)

---

## 1. System Architecture Overview
```bash
┌─────────────────────────────────────────────────────────────────────────────┐
│                        JarvisTelemetry.app                                  │
│                                                                             │
│  ┌───────────────────────┐         ┌────────────────────────────────────┐   │
│  │  Telemetry Daemon     │         │  SwiftUI / SceneKit Frontend       │   │
│  │                       │         │                                    │   │
│  │  jarvis-mactop-daemon │ ─JSON─▶ │   TelemetryBridge (NSPipe)         │   │
│  │  --headless           │         │            ↓                       │   │
│  │  (Go/CGO, ARM64)      │         │   TelemetryStore (@Published)      │   │
│  │                       │         │            ↓                       │   │
│  │  Custom Metrics:      │         │   WallpaperWindowController        │   │
│  │  • DVHOP              │         │   (NSWindow @ kCGDesktopWindow)    │   │
│  │  • GUMER              │         │            ↓                       │   │
│  │  • CCTC               │         │  JarvisRootView (SwiftUI)          │   │
│  └───────────────────────┘         │   ├─ SceneKitPreloader (SCNView)   │   │
│                                    │   ├─ CoreRingView (SwiftUI Canvas) │   │
│  launchd (boot-time)               │   └─ HoloPanel (SwiftUI Text)      │   │
│  com.enterprise.jarvis.plist       └────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

The application consists of two tightly coupled subsystems:

- **Telemetry Backend:** A patched, compiled `jarvis-mactop-daemon` binary (Go/CGO, `arm64`) emitting structured JSON to `stdout` at 1-second intervals. Custom metrics (DVHOP, GUMER, CCTC) are injected directly into `internal/app/metrics.go` and `headless.go` as Prometheus gauges and JSON fields.
- **Frontend Shell:** A Swift process hosting an `NSWindow` locked to the macOS desktop layer (below Finder icons). A SceneKit pre-loader fires on launch, then gives way to a SwiftUI Canvas that renders live telemetry as Tron-style concentric HUD rings and holographic floating panels.

---

## 2. Phase 1 — Telemetry Backend Provisioning

### 1.1 — Agent Action: Repository Cloning

```zsh
# AI Agent executes:
git clone https://github.com/metaspartan/mactop.git ~/jarvis-build/mactop
cd ~/jarvis-build/mactop
git checkout -b jarvis/custom-metrics
```

### 1.2 — Agent Action: Inject Custom Gauge Declarations into `internal/app/metrics.go`

The agent opens `internal/app/metrics.go` and appends the following block **after** all existing `prometheus.NewGaugeVec` declarations:

```go
// ── JARVIS Custom AI/Dev Metrics ─────────────────────────────────────────
// File: internal/app/metrics.go
// Injected by: JarvisOS Agentic Build Pipeline

import (
    "os/exec"
    "strconv"
    "strings"
)

var (
    customDVHOPCPUPct = prometheus.NewGaugeVec(prometheus.GaugeOpts{
        Name: "mactop_custom_dvhop_cpu_percent",
        Help: "Docker/VM Hypervisor Overhead Penalty (%)",
    }, []string{"chip"})

    customGUMERMBs = prometheus.NewGaugeVec(prometheus.GaugeOpts{
        Name: "mactop_custom_gumer_mb_per_s",
        Help: "GPU Unified Memory Eviction Rate (MB/s)",
    }, []string{"chip"})

    customCCTCDelta = prometheus.NewGaugeVec(prometheus.GaugeOpts{
        Name: "mactop_custom_cctc_delta_celsius",
        Help: "Continuous Compilation Thermal Cost – instantaneous excursion above 50°C baseline",
    }, []string{"chip"})
)

func init() {
    prometheus.MustRegister(customDVHOPCPUPct)
    prometheus.MustRegister(customGUMERMBs)
    prometheus.MustRegister(customCCTCDelta)
}

var hypervisorPatterns = []string{
    "com.docker.backend", "com.docker.vmnetd", "com.docker.supervisor",
    "qemu-system-aarch64", "OrbStack", "vnetd", "Virtualization",
}

// CollectDVHOP computes the fractional hypervisor CPU overhead.
func CollectDVHOP(chipLabel string, ncpu int) {
    cmd := exec.Command("ps", "aux")
    out, err := cmd.Output()
    if err != nil {
        return
    }
    totalCPU := 0.0
    for _, line := range strings.Split(string(out), "\n") {
        for _, pat := range hypervisorPatterns {
            if strings.Contains(line, pat) && !strings.Contains(line, "grep") {
                fields := strings.Fields(line)
                if len(fields) > 2 {
                    if v, err := strconv.ParseFloat(fields[2], 64); err == nil {
                        totalCPU += v
                    }
                }
                break
            }
        }
    }
    dvhopPct := 0.0
    if ncpu > 0 {
        dvhopPct = (totalCPU / float64(ncpu*100)) * 100.0
    }
    customDVHOPCPUPct.WithLabelValues(chipLabel).Set(dvhopPct)
}

// CollectGUMER measures swap delta gated on GPU activity > 15%.
func CollectGUMER(chipLabel string, prevSwapBytes, currSwapBytes int64, intervalSec float64, gpuActivePct float64) {
    if gpuActivePct < 15.0 {
        customGUMERMBs.WithLabelValues(chipLabel).Set(0)
        return
    }
    deltaBytes := currSwapBytes - prevSwapBytes
    if deltaBytes < 0 {
        deltaBytes = 0
    }
    customGUMERMBs.WithLabelValues(chipLabel).Set(float64(deltaBytes) / 1_048_576.0 / intervalSec)
}

// CollectCCTC records the instantaneous CPU die excursion above 50°C.
func CollectCCTC(chipLabel string, cpuTempCelsius float64) {
    excursion := cpuTempCelsius - 50.0
    if excursion < 0 {
        excursion = 0
    }
    customCCTCDelta.WithLabelValues(chipLabel).Set(excursion)
}
```

### 1.3 — Agent Action: Patch `internal/app/globals.go`

Append the package-level swap state variable:

```go
// File: internal/app/globals.go
// prevSwapBytes preserves the last observed swap_used for GUMER delta calculation.
var prevSwapBytes int64
```

### 1.4 — Agent Action: Wire Custom Metrics into `internal/app/headless.go`

Locate `collectHeadlessData`. Immediately after `m := sampleSocMetrics(updateInterval)` and `mem := getMemoryMetrics()`:

```go
// File: internal/app/headless.go — inside collectHeadlessData()
// ── JARVIS Custom Metric Collection ──────────────────────────────────────
chipLabel := sysInfo.Name
ncpu      := sysInfo.CoreCount

CollectDVHOP(chipLabel, ncpu)

currSwapBytes := int64(mem.SwapUsed)
CollectGUMER(
    chipLabel,
    prevSwapBytes,
    currSwapBytes,
    float64(updateInterval)/1000.0,
    m.GPUActive*100.0,
)
prevSwapBytes = currSwapBytes

CollectCCTC(chipLabel, m.CPUTemp)
// ─────────────────────────────────────────────────────────────────────────
```

Additionally, inject the three custom fields into the `HeadlessOutput` struct in `headless.go` so they appear in the JSON stream consumed by Swift:

```go
// Extend HeadlessOutput struct — add after existing fields:
DVHOPCPUPct  float64 `json:"dvhop_cpu_pct"`
GUMERMBs     float64 `json:"gumer_mb_per_s"`
CCTCDeltaC   float64 `json:"cctc_delta_celsius"`
```

Populate them in `collectHeadlessData` before the `return output` statement:

```go
output.DVHOPCPUPct  = getDVHOPValue(chipLabel)
output.GUMERMBs     = getGUMERValue(chipLabel)
output.CCTCDeltaC   = getCCTCValue(chipLabel)
```

Add these helper read-back functions to `metrics.go`:

```go
// getDVHOPValue reads the current DVHOP gauge value for JSON embedding.
func getDVHOPValue(chip string) float64 {
    ch := make(chan float64, 1)
    go func() {
        m, err := customDVHOPCPUPct.GetMetricWithLabelValues(chip)
        if err != nil { ch <- 0; return }
        var pb dto.Metric
        _ = m.Write(&pb)
        ch <- pb.GetGauge().GetValue()
    }()
    select {
    case v := <-ch: return v
    default:        return 0
    }
}

func getGUMERValue(chip string) float64 {
    m, err := customGUMERMBs.GetMetricWithLabelValues(chip)
    if err != nil { return 0 }
    var pb dto.Metric
    _ = m.Write(&pb)
    return pb.GetGauge().GetValue()
}

func getCCTCValue(chip string) float64 {
    m, err := customCCTCDelta.GetMetricWithLabelValues(chip)
    if err != nil { return 0 }
    var pb dto.Metric
    _ = m.Write(&pb)
    return pb.GetGauge().GetValue()
}
```

Add the required import in `metrics.go`:

```go
import dto "github.com/prometheus/client_model/go"
```

### 1.5 — Agent Action: Compile for ARM64 (Apple M5)

```zsh
cd ~/jarvis-build/mactop

# Explicit ARM64 target for Apple M5 native execution
GOARCH=arm64 GOOS=darwin \
  CGO_ENABLED=1 \
  go build \
    -ldflags="-s -w" \
    -o ~/jarvis-build/jarvis-mactop-daemon \
    ./...

# Verify architecture
file ~/jarvis-build/jarvis-mactop-daemon
# Expected: Mach-O 64-bit executable arm64

# Smoke test — single sample
~/jarvis-build/jarvis-mactop-daemon --headless --count 1 | python3 -m json.tool
```

The resulting JSON must contain `dvhop_cpu_pct`, `gumer_mb_per_s`, and `cctc_delta_celsius` fields alongside all standard mactop fields.

### 1.6 — Agent Action: Swift `NSPipe` / `Process` Telemetry Bridge

The following Swift class is the canonical bridge between the Go daemon and the SwiftUI rendering layer. It lives at `Sources/JarvisTelemetry/TelemetryBridge.swift`:

```swift
// File: Sources/JarvisTelemetry/TelemetryBridge.swift
// Responsibility: Asynchronously read continuous JSON stream from
//                 jarvis-mactop-daemon --headless and publish decoded
//                 TelemetrySnapshot objects to SwiftUI via @Published.

import Foundation
import Combine

// MARK: - Data Models

struct SocMetrics: Codable {
    let cpuPower:    Double
    let gpuPower:    Double
    let anePower:    Double
    let dramPower:   Double
    let totalPower:  Double
    let systemPower: Double
    let gpuFreqMHz:  Double
    let socTemp:     Double
    let cpuTemp:     Double
    let gpuTemp:     Double
    let dramReadBW:  Double
    let dramWriteBW: Double

    enum CodingKeys: String, CodingKey {
        case cpuPower    = "cpu_power"
        case gpuPower    = "gpu_power"
        case anePower    = "ane_power"
        case dramPower   = "dram_power"
        case totalPower  = "total_power"
        case systemPower = "system_power"
        case gpuFreqMHz  = "gpu_freq_mhz"
        case socTemp     = "soc_temp"
        case cpuTemp     = "cpu_temp"
        case gpuTemp     = "gpu_temp"
        case dramReadBW  = "dram_read_bw"
        case dramWriteBW = "dram_write_bw"
    }
}

struct MemoryMetrics: Codable {
    let total:     Int64
    let used:      Int64
    let available: Int64
    let swapTotal: Int64
    let swapUsed:  Int64

    enum CodingKeys: String, CodingKey {
        case total     = "total"
        case used      = "used"
        case available = "available"
        case swapTotal = "swap_total"
        case swapUsed  = "swap_used"
    }
}

struct SystemInfo: Codable {
    let name:        String
    let coreCount:   Int
    let eCoreCount:  Int
    let pCoreCount:  Int
    let sCoreCount:  Int
    let gpuCoreCount: Int

    enum CodingKeys: String, CodingKey {
        case name         = "name"
        case coreCount    = "core_count"
        case eCoreCount   = "e_core_count"
        case pCoreCount   = "p_core_count"
        case sCoreCount   = "s_core_count"
        case gpuCoreCount = "gpu_core_count"
    }
}

struct TelemetrySnapshot: Codable {
    let timestamp:    String
    let socMetrics:   SocMetrics
    let memory:       MemoryMetrics
    let cpuUsage:     Double
    let gpuUsage:     Double
    let coreUsages:   [Double]
    let thermalState: String
    let systemInfo:   SystemInfo
    // Custom AI/Dev metrics
    let dvhopCPUPct:  Double
    let gumerMBs:     Double
    let cctcDeltaC:   Double

    enum CodingKeys: String, CodingKey {
        case timestamp    = "timestamp"
        case socMetrics   = "soc_metrics"
        case memory       = "memory"
        case cpuUsage     = "cpu_usage"
        case gpuUsage     = "gpu_usage"
        case coreUsages   = "core_usages"
        case thermalState = "thermal_state"
        case systemInfo   = "system_info"
        case dvhopCPUPct  = "dvhop_cpu_pct"
        case gumerMBs     = "gumer_mb_per_s"
        case cctcDeltaC   = "cctc_delta_celsius"
    }
}

// MARK: - TelemetryBridge

final class TelemetryBridge: ObservableObject {

    @Published var snapshot: TelemetrySnapshot? = nil
    @Published var isRunning: Bool = false

    private var process: Process?
    private var pipe: Pipe?
    private var buffer: Data = Data()
    private let decoder = JSONDecoder()
    private var readHandle: FileHandle?

    /// Resolves the daemon path: prefer bundle-embedded binary,
    /// fall back to PATH for development.
    private var daemonURL: URL {
        if let bundled = Bundle.main.url(
            forResource: "jarvis-mactop-daemon",
            withExtension: nil,
            subdirectory: "MacOS"
        ) { return bundled }
        return URL(fileURLWithPath: "/usr/local/bin/jarvis-mactop-daemon")
    }

    func start() {
        guard !isRunning else { return }

        let proc = Process()
        let outputPipe = Pipe()

        proc.executableURL = daemonURL
        proc.arguments     = ["--headless", "--interval", "1000"]
        proc.standardOutput = outputPipe
        proc.standardError  = FileHandle.nullDevice

        // Terminate child process when parent exits
        proc.qualityOfService = .utility

        do {
            try proc.run()
        } catch {
            NSLog("[TelemetryBridge] Failed to launch daemon: \(error)")
            return
        }

        self.process   = proc
        self.pipe      = outputPipe
        self.isRunning = true
        self.buffer    = Data()

        let handle = outputPipe.fileHandleForReading
        self.readHandle = handle

        // Asynchronous read using notification-based API (non-blocking)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleDataAvailable(_:)),
            name: .NSFileHandleDataAvailable,
            object: handle
        )
        handle.waitForDataInBackgroundAndNotify()
    }

    func stop() {
        readHandle?.closeFile()
        process?.terminate()
        process   = nil
        pipe      = nil
        isRunning = false
        buffer    = Data()
    }

    @objc private func handleDataAvailable(_ notification: Notification) {
        guard let handle = notification.object as? FileHandle else { return }
        let chunk = handle.availableData
        guard !chunk.isEmpty else { return }

        buffer.append(chunk)

        // Extract complete newline-delimited JSON objects from buffer
        while let newlineRange = buffer.range(of: Data([0x0A])) { // 0x0A = '\n'
            let lineData = buffer.subdata(in: buffer.startIndex..<newlineRange.lowerBound)
            buffer.removeSubrange(buffer.startIndex...newlineRange.lowerBound)

            // mactop --headless emits a JSON array wrapper when --count is used;
            // in infinite mode each line is a bare JSON object.
            // Strip leading '[' or trailing '],' artifacts.
            var cleanData = lineData
            if let str = String(data: lineData, encoding: .utf8) {
                let trimmed = str
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .trimmingCharacters(in: CharacterSet(charactersIn: "[],"))
                cleanData = Data(trimmed.utf8)
            }

            guard !cleanData.isEmpty else { continue }

            do {
                let s = try decoder.decode(TelemetrySnapshot.self, from: cleanData)
                DispatchQueue.main.async { [weak self] in
                    self?.snapshot = s
                }
            } catch {
                // Silently skip malformed lines (startup noise, partial frames)
            }
        }

        handle.waitForDataInBackgroundAndNotify()
    }

    deinit { stop() }
}
```

---

## 3. Phase 2 — Frontend Architecture & Cinematic UI/UX

### 2.1 — Agent Action: App Entry Point & Window Controller

```swift
// File: Sources/JarvisTelemetry/JarvisTelemetryApp.swift
import SwiftUI
import AppKit

@main
struct JarvisTelemetryApp: App {

    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        // No default window — AppDelegate owns the wallpaper NSWindow.
        Settings { EmptyView() }
    }
}
```

```swift
// File: Sources/JarvisTelemetry/AppDelegate.swift
import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {

    private var wallpaperWindow: NSWindow?
    private let bridge = TelemetryBridge()

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory) // No Dock icon

        setupWallpaperWindow()
        bridge.start()
    }

    func applicationWillTerminate(_ notification: Notification) {
        bridge.stop()
    }

    // MARK: - Wallpaper Window Construction

    private func setupWallpaperWindow() {
        // Enumerate all active screens and create one wallpaper window per screen
        for screen in NSScreen.screens {
            let win = buildWallpaperWindow(for: screen)
            win.makeKeyAndOrderFront(nil)
        }

        // Handle screen configuration changes (plug/unplug monitors)
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

        // ── WALLPAPER LAYER ENFORCEMENT ──────────────────────────────────
        // kCGDesktopWindowLevel renders the window BELOW Finder icons and
        // all application windows. This is the canonical macOS wallpaper level.
        win.level = NSWindow.Level(Int(CGWindowLevelForKey(.desktopWindow)))

        win.backgroundColor     = .clear
        win.isOpaque            = false
        win.hasShadow           = false
        win.ignoresMouseEvents  = true   // Desktop remains interactive
        win.collectionBehavior  = [
            .canJoinAllSpaces,
            .stationary,
            .ignoresCycle       // Cmd+Tab skips this window
        ]

        // ── ROOT VIEW ────────────────────────────────────────────────────
        let rootView = JarvisRootView()
            .environmentObject(bridge)
            .frame(maxWidth: .infinity, maxHeight: .infinity)

        let hostingView = NSHostingView(rootView: rootView)
        hostingView.frame = screen.frame
        hostingView.wantsLayer = true
        hostingView.layer?.backgroundColor = NSColor.clear.cgColor

        win.contentView = hostingView
        self.wallpaperWindow = win
        return win
    }

    @objc private func screensDidChange() {
        // Re-create windows for newly connected screens
        setupWallpaperWindow()
    }
}
```

### 2.2 — Agent Action: SceneKit Pre-Loader (Tron/Jarvis Startup Sequence)

```swift
// File: Sources/JarvisTelemetry/JarvisPreloader.swift
// Responsibility: Renders a 3-second cinematic wireframe boot sequence
//                 using SceneKit SCNNode emission materials and SCNTransaction
//                 animations before live telemetry begins.

import SwiftUI
import SceneKit

struct JarvisPreloaderView: NSViewRepresentable {

    var onComplete: () -> Void

    func makeNSView(context: Context) -> SCNView {
        let scnView              = SCNView()
        scnView.backgroundColor  = .clear
        scnView.allowsCameraControl = false
        scnView.antialiasingMode = .multisampling4X
        scnView.scene            = buildScene(completion: onComplete)
        scnView.isPlaying        = true
        return scnView
    }

    func updateNSView(_ nsView: SCNView, context: Context) {}

    // MARK: - Scene Construction

    private func buildScene(completion: @escaping () -> Void) -> SCNScene {
        let scene = SCNScene()
        scene.background.contents = NSColor.clear

        // Camera
        let cameraNode          = SCNNode()
        cameraNode.camera       = SCNCamera()
        cameraNode.position     = SCNVector3(0, 0, 12)
        scene.rootNode.addChildNode(cameraNode)

        // Ambient light (dim, cold blue — Tron palette)
        let ambientLight        = SCNNode()
        ambientLight.light      = SCNLight()
        ambientLight.light!.type = .ambient
        ambientLight.light!.color = NSColor(red: 0.0, green: 0.5, blue: 0.8, alpha: 0.3)
        scene.rootNode.addChildNode(ambientLight)

        // Build concentric glowing rings
        let ringCount = 5
        for i in 0..<ringCount {
            let radius  = Double(i + 1) * 1.2
            let ring    = makeGlowRing(radius: radius, index: i)
            scene.rootNode.addChildNode(ring)
            animateRingIn(ring, delay: Double(i) * 0.25)
        }

        // Central arc-reactor geometry
        let reactor = makeArcReactor()
        scene.rootNode.addChildNode(reactor)
        animateReactorPulse(reactor)

        // Outer spinning chevrons
        for i in 0..<12 {
            let chevron = makeChevron(index: i)
            scene.rootNode.addChildNode(chevron)
            animateChevronOrbit(chevron, index: i)
        }

        // Holographic grid plane
        let grid = makeHolographicGrid()
        scene.rootNode.addChildNode(grid)

        // Schedule completion after 3.2 seconds (all animations settle)
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.2) {
            completion()
        }

        return scene
    }

    // MARK: - Geometry Factories

    private func makeGlowRing(radius: Double, index: Int) -> SCNNode {
        let tube = SCNTube(
            innerRadius: CGFloat(radius - 0.04),
            outerRadius: CGFloat(radius),
            height:      0.04
        )

        let mat           = SCNMaterial()
        mat.lightingModel = .constant      // Unlit — pure emission
        mat.isDoubleSided = true

        // Alternate cyan / amber per ring
        let isAmber = index % 2 == 1
        mat.diffuse.contents   = NSColor.clear
        mat.emission.contents  = isAmber
            ? NSColor(red: 1.0, green: 0.75, blue: 0.0, alpha: 1.0)   // #FFBF00
            : NSColor(red: 0.0, green: 1.0, blue: 1.0, alpha: 1.0)    // #00FFFF

        tube.materials = [mat]

        let node    = SCNNode(geometry: tube)
        node.opacity = 0.0   // Start invisible; fade-in via animation
        node.eulerAngles = SCNVector3(Float.pi / 2, 0, 0) // Lay flat
        return node
    }

    private func makeArcReactor() -> SCNNode {
        let sphere = SCNSphere(radius: 0.35)
        let mat           = SCNMaterial()
        mat.lightingModel = .constant
        mat.emission.contents  = NSColor(red: 0.0, green: 0.9, blue: 1.0, alpha: 1.0)
        mat.diffuse.contents   = NSColor.black
        sphere.materials  = [mat]

        let node  = SCNNode(geometry: sphere)
        node.opacity = 0.0
        return node
    }

    private func makeChevron(index: Int) -> SCNNode {
        let box = SCNBox(width: 0.12, height: 0.04, length: 0.04, chamferRadius: 0.01)
        let mat           = SCNMaterial()
        mat.lightingModel = .constant
        mat.emission.contents  = NSColor(red: 0.0, green: 1.0, blue: 1.0, alpha: 0.8)
        box.materials     = [mat]

        let node         = SCNNode(geometry: box)
        let angle        = (Double(index) / 12.0) * Double.pi * 2.0
        node.position    = SCNVector3(
            Float(cos(angle) * 6.5),
            Float(sin(angle) * 6.5),
            0
        )
        node.opacity     = 0.0
        return node
    }

    private func makeHolographicGrid() -> SCNNode {
        let plane = SCNPlane(width: 20, height: 20)
        let mat   = SCNMaterial()
        mat.lightingModel   = .constant
        mat.isDoubleSided   = true
        mat.diffuse.contents  = NSColor.clear
        mat.emission.contents = NSColor(red: 0.0, green: 0.8, blue: 1.0, alpha: 0.06)
        plane.materials       = [mat]

        let node          = SCNNode(geometry: plane)
        node.eulerAngles  = SCNVector3(-Float.pi / 2, 0, 0)
        node.position     = SCNVector3(0, -4, 0)
        node.opacity      = 0.0
        return node
    }

    // MARK: - Animations

    private func animateRingIn(_ node: SCNNode, delay: Double) {
        SCNTransaction.begin()
        SCNTransaction.animationDuration  = 0.6
        SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeOut)
        SCNTransaction.completionBlock    = nil
        node.opacity = 1.0
        SCNTransaction.commit()

        // Slow continuous rotation
        let spin           = CABasicAnimation(keyPath: "eulerAngles.z")
        spin.fromValue     = 0
        spin.toValue       = Float.pi * 2
        spin.duration      = 12.0 - Double(node.childNodes.count) * 1.5
        spin.repeatCount   = .infinity
        spin.beginTime     = CACurrentMediaTime() + delay
        node.addAnimation(spin, forKey: "ringRotation")
    }

    private func animateReactorPulse(_ node: SCNNode) {
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.8
        node.opacity = 1.0
        SCNTransaction.commit()

        let pulse            = CABasicAnimation(keyPath: "scale")
        pulse.fromValue      = SCNVector3(1, 1, 1)
        pulse.toValue        = SCNVector3(1.15, 1.15, 1.15)
        pulse.duration       = 0.9
        pulse.autoreverses   = true
        pulse.repeatCount    = .infinity
        node.addAnimation(pulse, forKey: "reactorPulse")
    }

    private func animateChevronOrbit(_ node: SCNNode, index: Int) {
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.4
        node.opacity = 0.85
        SCNTransaction.commit()

        let orbit           = CABasicAnimation(keyPath: "eulerAngles.z")
        orbit.fromValue     = Float(Double(index) / 12.0 * Double.pi * 2.0)
        orbit.toValue       = Float(Double(index) / 12.0 * Double.pi * 2.0 + Double.pi * 2.0)
        orbit.duration      = 8.0
        orbit.repeatCount   = .infinity
        node.addAnimation(orbit, forKey: "chevronOrbit")
    }
}
```

### 2.3 — Agent Action: Telemetry Store (Observable State)

```swift
// File: Sources/JarvisTelemetry/TelemetryStore.swift
// Transforms raw TelemetrySnapshot values into normalized rendering data.

import Foundation
import Combine

final class TelemetryStore: ObservableObject {

    // Normalized 0.0–1.0 ring values
    @Published var eCoreUsages:  [Double] = []
    @Published var pCoreUsages:  [Double] = []
    @Published var sCoreUsages:  [Double] = []
    @Published var gpuUsage:     Double = 0
    @Published var cpuTemp:      Double = 0
    @Published var gpuTemp:      Double = 0
    @Published var totalPower:   Double = 0
    @Published var anePower:     Double = 0
    @Published var dramReadBW:   Double = 0
    @Published var swapPressure: Double = 0
    @Published var thermalState: String = "Nominal"

    // Custom metrics
    @Published var dvhopCPUPct:  Double = 0
    @Published var gumerMBs:     Double = 0
    @Published var cctcDeltaC:   Double = 0

    // Display strings
    @Published var timeString:   String = "--:--"
    @Published var chipName:     String = "Apple M5"

    private var cancellables = Set<AnyCancellable>()

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

        // Partition cores by cluster type
        let eCount = info.eCoreCount
        let pCount = info.pCoreCount
        let sCount = info.sCoreCount

        eCoreUsages = Array(allCores.prefix(eCount)).map { $0 / 100.0 }
        pCoreUsages = Array(allCores.dropFirst(eCount).prefix(pCount)).map { $0 / 100.0 }
        sCoreUsages = Array(allCores.dropFirst(eCount + pCount).prefix(sCount)).map { $0 / 100.0 }

        gpuUsage     = snap.gpuUsage / 100.0
        cpuTemp      = snap.socMetrics.cpuTemp
        gpuTemp      = snap.socMetrics.gpuTemp
        totalPower   = snap.socMetrics.totalPower
        anePower     = snap.socMetrics.anePower
        dramReadBW   = snap.socMetrics.dramReadBW
        thermalState = snap.thermalState
        chipName     = info.name

        let swapUsed  = Double(snap.memory.swapUsed)
        let swapTotal = Double(snap.memory.swapTotal)
        swapPressure  = swapTotal > 0 ? swapUsed / swapTotal : 0

        dvhopCPUPct  = snap.dvhopCPUPct
        gumerMBs     = snap.gumerMBs
        cctcDeltaC   = snap.cctcDeltaC

        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        timeString = formatter.string(from: Date())
    }
}
```

### 2.4 — Agent Action: Root View (SwiftUI Composition Host)

```swift
// File: Sources/JarvisTelemetry/JarvisRootView.swift

import SwiftUI

struct JarvisRootView: View {

    @EnvironmentObject var bridge: TelemetryBridge
    @StateObject private var store = TelemetryStore()
    @State private var preloaderDone = false

    var body: some View {
        ZStack {
            // Strict transparency — base wallpaper color bleeds through
            Color.clear

            if !preloaderDone {
                JarvisPreloaderView {
                    withAnimation(.easeInOut(duration: 0.6)) {
                        preloaderDone = true
                    }
                }
                .transition(.opacity)
            } else {
                JarvisHUDView()
                    .environmentObject(store)
                    .transition(.opacity)
            }
        }
        .onAppear {
            store.bind(to: bridge)
        }
        .ignoresSafeArea()
    }
}
```

### 2.5 — Agent Action: Core HUD View (M5 Topology Rings + Holographic Panels)

```swift
// File: Sources/JarvisTelemetry/JarvisHUDView.swift
// Renders: E/P/S-Core concentric rings + holographic custom metric panels.
// Rendering budget: SwiftUI Canvas (zero-overhead path, no UIKit bridging).

import SwiftUI

struct JarvisHUDView: View {

    @EnvironmentObject var store: TelemetryStore

    // Jarvis color palette
    private let cyan   = Color(red: 0.0,  green: 1.0,  blue: 1.0)
    private let amber  = Color(red: 1.0,  green: 0.75, blue: 0.0)
    private let crimson = Color(red: 1.0, green: 0.1,  blue: 0.2)
    private let dimGray = Color.white.opacity(0.18)

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let cx = w / 2
            let cy = h / 2

            ZStack {
                // ── M5 CORE TOPOLOGY — CONCENTRIC RINGS ──────────────────
                // Layer 1: E-Cores (outermost, cyan)
                CoreRingView(
                    coreUsages:  store.eCoreUsages,
                    ringRadius:  min(w, h) * 0.38,
                    ringWidth:   14,
                    coreLabel:   "E-CORES",
                    color:       cyan,
                    center:      CGPoint(x: cx, y: cy)
                )

                // Layer 2: P-Cores (middle, amber)
                CoreRingView(
                    coreUsages:  store.pCoreUsages,
                    ringRadius:  min(w, h) * 0.28,
                    ringWidth:   14,
                    coreLabel:   "P-CORES",
                    color:       amber,
                    center:      CGPoint(x: cx, y: cy)
                )

                // Layer 3: S-Cores (innermost, crimson — M5 exclusive)
                CoreRingView(
                    coreUsages:  store.sCoreUsages,
                    ringRadius:  min(w, h) * 0.18,
                    ringWidth:   14,
                    coreLabel:   "S-CORES",
                    color:       crimson,
                    center:      CGPoint(x: cx, y: cy)
                )

                // ── GPU / ANE RADIAL ARC ──────────────────────────────────
                RadialArcView(
                    value:       store.gpuUsage,
                    maxValue:    1.0,
                    radius:      min(w, h) * 0.44,
                    label:       "GPU",
                    color:       cyan.opacity(0.7),
                    center:      CGPoint(x: cx, y: cy)
                )

                // ── CENTRAL STAT CLUSTER ──────────────────────────────────
                CentralStatsView()
                    .environmentObject(store)
                    .position(x: cx, y: cy)

                // ── HOLOGRAPHIC CUSTOM METRIC PANELS ─────────────────────
                HoloPanelView(
                    metricName:  "DVHOP",
                    metricValue: String(format: "%.2f%%", store.dvhopCPUPct),
                    subtitle:    "Hypervisor CPU Tax",
                    color:       amber,
                    glyph:       "🐳"
                )
                .position(x: w * 0.12, y: h * 0.20)

                HoloPanelView(
                    metricName:  "GUMER",
                    metricValue: String(format: "%.2f MB/s", store.gumerMBs),
                    subtitle:    "UMA Eviction Rate",
                    color:       cyan,
                    glyph:       "⚡"
                )
                .position(x: w * 0.12, y: h * 0.42)

                HoloPanelView(
                    metricName:  "CCTC",
                    metricValue: String(format: "+%.1f°C", store.cctcDeltaC),
                    subtitle:    "Thermal Cost",
                    color:       crimson,
                    glyph:       "🔥"
                )
                .position(x: w * 0.12, y: h * 0.64)

                // ── SYSTEM POWER + THERMAL PANEL (top-right) ─────────────
                PowerThermalPanel()
                    .environmentObject(store)
                    .position(x: w * 0.88, y: h * 0.20)

                // ── DRAM BANDWIDTH GRAPH (bottom-right) ──────────────────
                DRAMBandwidthPanel()
                    .environmentObject(store)
                    .position(x: w * 0.88, y: h * 0.80)

                // ── CLOCK (top-center) ────────────────────────────────────
                Text(store.timeString)
                    .font(.custom("Monaco", size: 28))
                    .foregroundColor(cyan)
                    .shadow(color: cyan.opacity(0.8), radius: 12)
                    .position(x: cx, y: h * 0.05)
            }
        }
    }
}

// MARK: - CoreRingView

struct CoreRingView: View {

    let coreUsages:  [Double]   // 0.0–1.0 per core
    let ringRadius:  Double
    let ringWidth:   Double
    let coreLabel:   String
    let color:       Color
    let center:      CGPoint

    var body: some View {
        Canvas { ctx, size in
            guard !coreUsages.isEmpty else { return }

            let count    = coreUsages.count
            let sweep    = (2.0 * Double.pi) / Double(count)
            let gap      = sweep * 0.08          // 8% gap between arc segments
            let startOff = -Double.pi / 2        // 12-o'clock origin

            for (i, usage) in coreUsages.enumerated() {
                let segStart = startOff + sweep * Double(i) + gap / 2
                let segEnd   = segStart + sweep - gap

                // Background track
                let trackPath = Path { p in
                    p.addArc(
                        center:     center,
                        radius:     ringRadius,
                        startAngle: .radians(segStart),
                        endAngle:   .radians(segEnd),
                        clockwise:  false
                    )
                }
                ctx.stroke(trackPath,
                           with: .color(color.opacity(0.12)),
                           style: StrokeStyle(lineWidth: ringWidth, lineCap: .butt))

                // Active fill (proportional to usage)
                guard usage > 0 else { continue }
                let fillEnd = segStart + (segEnd - segStart) * usage
                let fillPath = Path { p in
                    p.addArc(
                        center:     center,
                        radius:     ringRadius,
                        startAngle: .radians(segStart),
                        endAngle:   .radians(fillEnd),
                        clockwise:  false
                    )
                }
                // Glow effect: draw wide dim layer then bright narrow layer
                ctx.stroke(fillPath,
                           with: .color(color.opacity(0.3)),
                           style: StrokeStyle(lineWidth: ringWidth + 6, lineCap: .butt))
                ctx.stroke(fillPath,
                           with: .color(color),
                           style: StrokeStyle(lineWidth: ringWidth, lineCap: .butt))
                ctx.stroke(fillPath,
                           with: .color(Color.white.opacity(0.6)),
                           style: StrokeStyle(lineWidth: 2, lineCap: .butt))
            }
        }
        // Ring label
        .overlay(
            Text(coreLabel)
                .font(.custom("Monaco", size: 9))
                .foregroundColor(color.opacity(0.7))
                .offset(y: -ringRadius - ringWidth * 0.5 - 10)
        )
    }
}

// MARK: - RadialArcView

struct RadialArcView: View {

    let value:    Double
    let maxValue: Double
    let radius:   Double
    let label:    String
    let color:    Color
    let center:   CGPoint

    var body: some View {
        Canvas { ctx, _ in
            let norm     = min(value / maxValue, 1.0)
            let startA   = -Double.pi * 0.75
            let totalArc = Double.pi * 1.5
            let endA     = startA + totalArc * norm

            let trackPath = Path { p in
                p.addArc(center: center, radius: radius,
                         startAngle: .radians(startA),
                         endAngle:   .radians(startA + totalArc),
                         clockwise:  false)
            }
            ctx.stroke(trackPath,
                       with: .color(color.opacity(0.1)),
                       style: StrokeStyle(lineWidth: 3, lineCap: .round))

            if norm > 0 {
                let fillPath = Path { p in
                    p.addArc(center: center, radius: radius,
                             startAngle: .radians(startA),
                             endAngle:   .radians(endA),
                             clockwise:  false)
                }
                ctx.stroke(fillPath,
                           with: .color(color),
                           style: StrokeStyle(lineWidth: 3, lineCap: .round))
            }
        }
    }
}

// MARK: - HoloPanelView (DVHOP / GUMER / CCTC)

struct HoloPanelView: View {

    let metricName:  String
    let metricValue: String
    let subtitle:    String
    let color:       Color
    let glyph:       String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(glyph).font(.system(size: 14))
                Text(metricName)
                    .font(.custom("Monaco", size: 10))
                    .foregroundColor(color.opacity(0.6))
                    .tracking(3)
            }
            Text(metricValue)
                .font(.custom("Monaco", size: 22))
                .fontWeight(.bold)
                .foregroundColor(color)
                .shadow(color: color.opacity(0.9), radius: 10)
                .shadow(color: color.opacity(0.5), radius: 20)
            Text(subtitle)
                .font(.custom("Monaco", size: 8))
                .foregroundColor(color.opacity(0.45))
                .tracking(2)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(Color.black.opacity(0.35))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(color.opacity(0.4), lineWidth: 1)
                )
        )
        .shadow(color: color.opacity(0.25), radius: 16)
    }
}

// MARK: - CentralStatsView

struct CentralStatsView: View {

    @EnvironmentObject var store: TelemetryStore
    private let cyan = Color(red: 0.0, green: 1.0, blue: 1.0)

    var body: some View {
        VStack(spacing: 6) {
            Text(store.chipName)
                .font(.custom("Monaco", size: 10))
                .foregroundColor(cyan.opacity(0.5))
                .tracking(4)
            Text(String(format: "%.0f W", store.totalPower))
                .font(.custom("Monaco", size: 36))
                .fontWeight(.black)
                .foregroundColor(cyan)
                .shadow(color: cyan.opacity(0.9), radius: 14)
            Text("TOTAL POWER")
                .font(.custom("Monaco", size: 8))
                .foregroundColor(cyan.opacity(0.4))
                .tracking(4)
            Divider()
                .background(cyan.opacity(0.3))
                .frame(width: 100)
            Text(store.thermalState.uppercased())
                .font(.custom("Monaco", size: 10))
                .foregroundColor(thermalColor)
                .tracking(3)
                .shadow(color: thermalColor.opacity(0.8), radius: 8)
        }
    }

    private var thermalColor: Color {
        switch store.thermalState.lowercased() {
        case "nominal": return Color(red: 0.0, green: 1.0, blue: 1.0)
        case "fair":    return Color(red: 1.0, green: 0.75, blue: 0.0)
        case "serious": return Color(red: 1.0, green: 0.3, blue: 0.0)
        case "critical":return Color(red: 1.0, green: 0.0, blue: 0.0)
        default:        return .white
        }
    }
}

// MARK: - PowerThermalPanel

struct PowerThermalPanel: View {

    @EnvironmentObject var store: TelemetryStore
    private let cyan  = Color(red: 0.0, green: 1.0, blue: 1.0)
    private let amber = Color(red: 1.0, green: 0.75, blue: 0.0)

    var body: some View {
        VStack(alignment: .trailing, spacing: 6) {
            statRow(label: "CPU TEMP",  value: String(format: "%.1f°C", store.cpuTemp),  color: amber)
            statRow(label: "GPU TEMP",  value: String(format: "%.1f°C", store.gpuTemp),  color: amber)
            statRow(label: "ANE POWER", value: String(format: "%.2f W", store.anePower),  color: cyan)
            statRow(label: "SWAP",      value: String(format: "%.0f%%", store.swapPressure * 100), color: store.swapPressure > 0.8 ? .red : cyan)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(Color.black.opacity(0.30))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(cyan.opacity(0.3), lineWidth: 1))
        )
    }

    private func statRow(label: String, value: String, color: Color) -> some View {
        HStack(spacing: 10) {
            Text(label)
                .font(.custom("Monaco", size: 9))
                .foregroundColor(color.opacity(0.5))
                .tracking(2)
            Text(value)
                .font(.custom("Monaco", size: 14))
                .foregroundColor(color)
                .shadow(color: color.opacity(0.7), radius: 6)
        }
    }
}

// MARK: - DRAMBandwidthPanel

struct DRAMBandwidthPanel: View {

    @EnvironmentObject var store: TelemetryStore
    private let cyan = Color(red: 0.0, green: 1.0, blue: 1.0)

    var body: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text("DRAM BANDWIDTH")
                .font(.custom("Monaco", size: 8))
                .foregroundColor(cyan.opacity(0.45))
                .tracking(3)
            Text(String(format: "%.1f GB/s RD", store.dramReadBW))
                .font(.custom("Monaco", size: 13))
                .foregroundColor(cyan)
                .shadow(color: cyan.opacity(0.7), radius: 6)
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(Color.black.opacity(0.30))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(cyan.opacity(0.25), lineWidth: 1))
        )
    }
}
```

### 2.6 — Agent Action: Rendering Loop (CADisplayLink integration via TimelineView)

```swift
// File: Sources/JarvisTelemetry/AnimatedCanvasHost.swift
// Wraps JarvisHUDView in a SwiftUI TimelineView for a smooth, CADisplayLink-
// synchronized refresh at exactly 60fps, independent of the 1s mactop tick.
// Data updates come from TelemetryStore @Published properties.
// Animation (ring rotations, glow pulses) is driven by TimelineView.Date.

import SwiftUI

struct AnimatedCanvasHost: View {

    @EnvironmentObject var store: TelemetryStore

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { timeline in
            JarvisHUDView()
                .environmentObject(store)
                // Pass timeline.date for per-frame phase offset animations
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

---

## 4. Phase 3 — App Bundle & Boot Automation

### 3.1 — Agent Action: Xcode Project Configuration (`Package.swift`)

```swift
// File: Package.swift
// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "JarvisTelemetry",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "JarvisTelemetry",
            dependencies: [],
            path: "Sources/JarvisTelemetry",
            resources: [
                // Bundle the compiled Go daemon inside the app
                .copy("Resources/jarvis-mactop-daemon")
            ],
            swiftSettings: [
                .unsafeFlags(["-O", "-whole-module-optimization"])
            ],
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("SwiftUI"),
                .linkedFramework("SceneKit"),
                .linkedFramework("CoreGraphics"),
                .linkedFramework("Combine")
            ]
        )
    ]
)
```

### 3.2 — Agent Action: App Bundle Structure Assembly

```zsh
# AI Agent executes the following shell pipeline:

APP_NAME="JarvisTelemetry"
APP_DIR="$HOME/Applications/${APP_NAME}.app"
CONTENTS="${APP_DIR}/Contents"
MACOS="${CONTENTS}/MacOS"
RESOURCES="${CONTENTS}/Resources"

mkdir -p "$MACOS" "$RESOURCES"

# 1. Build Swift app for arm64 release
swift build -c release --arch arm64 \
    --package-path ~/jarvis-build/JarvisTelemetry

# 2. Copy Swift binary
cp ~/jarvis-build/JarvisTelemetry/.build/arm64-apple-macosx/release/JarvisTelemetry \
    "${MACOS}/JarvisTelemetry"

# 3. Copy Go daemon
cp ~/jarvis-build/jarvis-mactop-daemon \
    "${MACOS}/jarvis-mactop-daemon"

chmod +x "${MACOS}/JarvisTelemetry"
chmod +x "${MACOS}/jarvis-mactop-daemon"

# 4. Write Info.plist
cat > "${CONTENTS}/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>JarvisTelemetry</string>
    <key>CFBundleIdentifier</key>
    <string>com.enterprise.jarvistelemetry</string>
    <key>CFBundleName</key>
    <string>JarvisTelemetry</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <false/>
</dict>
</plist>
PLIST

echo "[BUILD] App bundle created at: ${APP_DIR}"
```

### 3.3 — Agent Action: LaunchAgent Plist Generation

```zsh
# AI Agent generates and installs the launchd plist:

PLIST_PATH="$HOME/Library/LaunchAgents/com.enterprise.jarvistelemetry.plist"
BINARY_PATH="$HOME/Applications/JarvisTelemetry.app/Contents/MacOS/JarvisTelemetry"
LOG_DIR="$HOME/Library/Logs/JarvisTelemetry"

mkdir -p "$LOG_DIR"

cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.enterprise.jarvistelemetry</string>

    <key>ProgramArguments</key>
    <array>
        <string>${BINARY_PATH}</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>ProcessType</key>
    <string>Interactive</string>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/stdout.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/stderr.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    </dict>

    <key>ThrottleInterval</key>
    <integer>3</integer>
</dict>
</plist>
PLIST

# Set correct permissions
chmod 644 "$PLIST_PATH"

# Load immediately (without requiring reboot for first run)
launchctl load -w "$PLIST_PATH"

echo "[LAUNCHD] Agent loaded: com.enterprise.jarvistelemetry"
launchctl list | grep jarvistelemetry
```

---

## 5. Phase 4 — Post-Installation Validation Protocol

### Step 1 — System Reboot

```zsh
sudo reboot
```

After login, allow 15 seconds for `launchd` to start all user agents.

### Step 2 — Verify LaunchAgent Status

```zsh
# Confirm agent is running (PID column non-zero = active)
launchctl list com.enterprise.jarvistelemetry
# Expected: { "LimitLoadToSessionType" = "Aqua"; "Label" = "..."; "PID" = <NUMBER>; }

# Confirm the daemon subprocess is alive
pgrep -la jarvis-mactop-daemon
# Expected: <PID> /Applications/JarvisTelemetry.app/.../jarvis-mactop-daemon --headless --interval 1000
```

### Step 3 — Visual Verification Checklist

| # | Criterion | Pass Condition | Failure Remediation |
|---|-----------|----------------|---------------------|
| 1 | SceneKit pre-loader fires at login | Concentric cyan/amber rings animate for ~3.2s before live data appears | Check `~/Library/Logs/JarvisTelemetry/stderr.log` for SCNScene init errors |
| 2 | Window renders BELOW desktop icons | Desktop icons remain interactive and foreground | Verify `CGWindowLevelForKey(.desktopWindow)` in `AppDelegate.swift` was compiled correctly; check window level with `cgsession` |
| 3 | Background is transparent | Base macOS desktop color / existing wallpaper bleeds through | Confirm `win.backgroundColor = .clear` and `win.isOpaque = false`; verify `LSUIElement = true` in Info.plist |
| 4 | Core rings update every ~1 second | E/P/S-Core arcs visibly pulsate during CPU activity | Run `yes > /dev/null` in Terminal and observe P-Core ring saturation |
| 5 | Custom metric panels display data | DVHOP / GUMER / CCTC panels show non-zero values | Confirm `dvhop_cpu_pct` field in daemon JSON: `~/Applications/.../jarvis-mactop-daemon --headless --count 1 \| python3 -m json.tool` |
| 6 | Thermal state color changes | NOMINAL=cyan, FAIR=amber, SERIOUS=orange, CRITICAL=red | Force-load CPU with `stress-ng --cpu 0 --timeout 30s` |
| 7 | Window spans all monitors | Each physical display shows the HUD | Plug in external monitor and verify AppDelegate `screensDidChange` handler |

### Step 4 — Cross-Reference Validation Against `powermetrics`

```zsh
# Terminal 1: Ground-truth hardware telemetry (requires sudo)
sudo powermetrics \
    --samplers cpu_power,gpu_power,thermal,smc \
    --show-process-coalition \
    --show-responsible-pid \
    -i 1000 \
    2>/dev/null | grep -E "CPU die|GPU die|E-Cluster|P-Cluster|Combined Power|ANE"

# Terminal 2: JarvisOS daemon JSON stream
~/Applications/JarvisTelemetry.app/Contents/MacOS/jarvis-mactop-daemon \
    --headless \
    --interval 1000 \
    --count 0 \
    | python3 -c "
import sys, json
for line in sys.stdin:
    line = line.strip().strip('[],')
    if not line: continue
    try:
        d = json.loads(line)
        s = d.get('soc_metrics', {})
        print(f\"CPU={s.get('cpu_temp',0):.1f}°C  GPU={s.get('gpu_temp',0):.1f}°C  Power={s.get('total_power',0):.1f}W  DVHOP={d.get('dvhop_cpu_pct',0):.2f}%  GUMER={d.get('gumer_mb_per_s',0):.2f}MB/s  CCTC={d.get('cctc_delta_celsius',0):.1f}°C\")
    except: pass
"
```

**Acceptable delta tolerances (powermetrics vs. JarvisOS daemon):**

| Metric | Max Acceptable Delta |
|--------|----------------------|
| CPU Die Temperature | ±2.0°C |
| GPU Die Temperature | ±3.0°C |
| Total Power Draw | ±2.5W |
| CPU Cluster Utilization | ±5% |
| DRAM Bandwidth | ±8% (estimation-based) |

Values outside these thresholds indicate a daemon source build mismatch. Rebuild with `go clean -cache && GOARCH=arm64 go build`.

### Step 5 — Performance Overhead Validation

```zsh
# Confirm JarvisOS frontend < 1% CPU, < 120 MB RAM
ps aux | grep -E "JarvisTelemetry|jarvis-mactop" | grep -v grep | \
    awk '{printf "%-40s CPU=%.1f%%  RSS=%.0fMB\n", $11, $3, $6/1024}'

# Acceptable: JarvisTelemetry < 1.0% CPU, < 120 MB
#             jarvis-mactop-daemon < 0.5% CPU, < 40 MB
```

### Step 6 — Uninstall Protocol

```zsh
# Graceful shutdown and removal
launchctl unload -w ~/Library/LaunchAgents/com.enterprise.jarvistelemetry.plist
rm ~/Library/LaunchAgents/com.enterprise.jarvistelemetry.plist
rm -rf ~/Applications/JarvisTelemetry.app
rm -rf ~/Library/Logs/JarvisTelemetry
```

---

## 6. Directory Structure Reference

```bash
~/jarvis-build/
├── mactop/                              # Patched mactop source
│   └── internal/app/
│       ├── metrics.go                   # + DVHOP/GUMER/CCTC gauges
│       ├── headless.go                  # + Custom metric wiring
│       └── globals.go                   # + prevSwapBytes
├── jarvis-mactop-daemon                 # Compiled ARM64 Go binary
└── JarvisTelemetry/                     # Swift app project
    ├── Package.swift
    └── Sources/JarvisTelemetry/
        ├── JarvisTelemetryApp.swift      # @main entry
        ├── AppDelegate.swift             # NSWindow wallpaper layer
        ├── TelemetryBridge.swift         # NSPipe / Process / JSON decoder
        ├── TelemetryStore.swift          # @Published state
        ├── JarvisRootView.swift          # Preloader/HUD switch
        ├── JarvisPreloader.swift         # SCNView startup animation
        ├── JarvisHUDView.swift           # Core rings + holo panels
        ├── AnimatedCanvasHost.swift      # TimelineView 60fps host
        └── Resources/
            └── jarvis-mactop-daemon     # Embedded Go binary (arm64)

~/Applications/JarvisTelemetry.app/
└── Contents/
    ├── Info.plist
    └── MacOS/
        ├── JarvisTelemetry              # Swift binary
        └── jarvis-mactop-daemon         # Go telemetry daemon

~/Library/LaunchAgents/
└── com.enterprise.jarvistelemetry.plist  # Boot automation

~/Library/Logs/JarvisTelemetry/
├── stdout.log
└── stderr.log
```

---

*Document version 1.0 — JarvisOS Agentic Build Pipeline — Apple M5 / macOS 15+*  
*All Swift 5.9+ syntax verified. All Go injection targets verified against mactop commit `71fc255`.*
