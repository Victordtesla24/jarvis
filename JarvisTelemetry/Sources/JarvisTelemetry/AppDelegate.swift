// File: Sources/JarvisTelemetry/AppDelegate.swift
// JARVIS — WKWebView wallpaper renderer.
// Loads jarvis-full-animation.html at desktop window level.
// All animation is handled by the HTML canvas/JS engine — no SwiftUI render stack.

import AppKit
import WebKit
import Darwin
import Combine

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {

    private var wallpaperWindows: [NSWindow] = []
    private var webViews: [WKWebView] = []
    private var sigtermSource: DispatchSourceSignal?
    private var sigintSource: DispatchSourceSignal?

    // Battery telemetry (2 Hz — edge-detects chargingJustAttached)
    private var batteryMonitor: BatteryMonitor?
    private var batteryTimer: Timer?

    // Full daemon telemetry (1 Hz — CPU, GPU, memory, thermal, power, net, disk)
    private var telemetryBridge: TelemetryBridge?
    private var telemetryCancellable: AnyCancellable?

    // Transparent click-catcher overlay for #jt-root in the main HTML.
    // Centred at the bottom of the screen (above the Dock).
    // Level = kCGDesktopWindowLevel+1 — above wallpaper, below every normal app.
    // Sized to cover only the toggle button (collapsed) or full panel (expanded).
    private var triggerOverlayWindow: NSPanel?
    private var triggerOverlayWebView: WKWebView?
    private var _triggerPanelOpen = false
    private var _daemonLive = false

    // Lock-screen animation state.
    //
    // macOS locks the screen by rendering loginwindow.app in a separate
    // security context. Our WKWebView at .desktop window level is HIDDEN
    // behind loginwindow and cannot draw above it. The ONLY pixels the
    // user sees behind the password prompt is the desktop wallpaper PNG.
    //
    // EMPIRICAL FINDING (verified by rapid color-rotation test during a
    // physical lock): NSWorkspace.setDesktopImageURL() DOES refresh the
    // real lock-screen wallpaper in near-real time. So we can animate the
    // lock screen by calling setDesktopImageURL with a new PNG every
    // ~300 ms. macOS requires a DIFFERENT file path to refresh, so we
    // alternate between frame-A.png and frame-B.png.
    private var priorWallpaperURLs: [ObjectIdentifier: URL] = [:]
    private let supportDir: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory,
                                           in: .userDomainMask).first!
            .appendingPathComponent("JarvisTelemetry", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()
    private lazy var lockFrameURLs: [URL] = [
        supportDir.appendingPathComponent("jarvis-lock-frame-A.png"),
        supportDir.appendingPathComponent("jarvis-lock-frame-B.png"),
        supportDir.appendingPathComponent("jarvis-lock-frame-C.png"),
        supportDir.appendingPathComponent("jarvis-lock-frame-D.png")
    ]
    private var lockFrameIndex: Int = 0
    private var isScreenLocked = false
    private var lockAnimationTimer: Timer?
    /// How many milliseconds between successive wallpaper updates during lock.
    /// Empirically the real lock screen accepts updates at ≥ 250 ms latency.
    private let lockAnimationPeriod: TimeInterval = 0.30
    /// Snapshot-in-flight guard so we don't pile up takeSnapshot calls.
    private var lockSnapshotInFlight = false

    /// R-17: reentrancy guard so a double-SIGTERM (or SIGTERM+SIGINT) cannot
    /// schedule NSApp.terminate(*:) twice. Starts with one available signal,
    /// consumed on first signal entry. No release — shutdown is one-way.
    private let shutdownLatch = DispatchSemaphore(value: 1)

    /// R-54: sticky capture state — used by exit/signal handlers which run
    /// outside MainActor context.
    private static let wasPromoCapture: Bool =
        ProcessInfo.processInfo.environment["JARVIS_PROMO_CAPTURE"] == "1"

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory) // No Dock icon

        installSignalHandlers()

        // Observer that triggers the HTML shutdown animation when a signal fires.
        // WKWebView runs out-of-process so the @MainActor is not saturated by
        // rendering; this DispatchQueue.main.async block will actually execute.
        NotificationCenter.default.addObserver(
            forName: .jarvisShutdown,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                NSLog("[AppDelegate] triggering HTML shutdown phase in %d webview(s)", self.webViews.count)
                for wv in self.webViews {
                    _ = try? await wv.evaluateJavaScript("setPhase('shutdown')")
                }
            }
        }

        // R-14: register the screen-parameters observer ONCE at launch.
        NotificationCenter.default.removeObserver(
            self,
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screensDidChange),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )

        // R-54: when running for promo capture, ensure any exit path restores
        // the wallpaper window level back to .desktop.
        if Self.wasPromoCapture {
            Self.installPromoCaptureRestoreHandlers()
        }

        setupWallpaperWindows()
        startBatteryTelemetry()
        startFullTelemetry()
        installSessionNotifications()
        startLockStatePolling()
        // R-16: test-only triggers are only registered in DEBUG builds. A
        // release .app bundle must not expose com.jarvis.test.* notifications
        // to the wider distributed-notification bus.
        #if DEBUG
        installTestTriggerObservers()
        #endif
        // R-52: production-safe HUD toggle observer.
        installTriggerObservers()
        buildTriggerOverlay()
    }

    func applicationWillTerminate(_ notification: Notification) {
        NSLog("[AppDelegate] applicationWillTerminate — cleaning up")

        // 1. Stop lock-screen animation loop first so no more snapshots fire.
        lockAnimationTimer?.invalidate()
        lockAnimationTimer = nil
        lockSnapshotInFlight = false
        lockPollTimer?.invalidate()
        lockPollTimer = nil

        // 2. Stop battery telemetry loop and Combine subscriptions.
        batteryTimer?.invalidate()
        batteryTimer = nil
        batteryCancellables.removeAll()
        batteryMonitor?.stop()
        batteryMonitor = nil

        // 3. Stop daemon subprocess (synchronous, with kill fallback).
        telemetryCancellable?.cancel()
        telemetryCancellable = nil
        telemetryBridge?.stop()
        telemetryBridge = nil

        // 4. Cancel signal dispatch sources.
        sigtermSource?.cancel()
        sigtermSource = nil
        sigintSource?.cancel()
        sigintSource = nil

        // 5. If the screen was locked, restore prior wallpapers so the user
        //    doesn't wake up with a JARVIS frame PNG frozen on the desktop.
        if isScreenLocked {
            for screen in NSScreen.screens {
                if let prior = priorWallpaperURLs[ObjectIdentifier(screen)] {
                    try? NSWorkspace.shared.setDesktopImageURL(prior, for: screen, options: [:])
                }
            }
            priorWallpaperURLs.removeAll()
            isScreenLocked = false
        }

        // 6. Tear down trigger-overlay panel.
        triggerOverlayWindow?.close()
        triggerOverlayWindow  = nil
        triggerOverlayWebView = nil

        // 7. Tear down wallpaper windows and their web-views.
        for wv in webViews { wv.stopLoading() }
        webViews.removeAll()
        for win in wallpaperWindows { win.orderOut(nil) }
        wallpaperWindows.removeAll()

        NSLog("[AppDelegate] cleanup complete — terminating")
    }

    // MARK: - Wallpaper Windows

    private func setupWallpaperWindows() {
        for win in wallpaperWindows { win.orderOut(nil) }
        wallpaperWindows.removeAll()
        webViews.removeAll()

        for screen in NSScreen.screens {
            let (win, wv) = buildWallpaperWindow(for: screen)
            win.makeKeyAndOrderFront(nil)
            wallpaperWindows.append(win)
            webViews.append(wv)
        }
        // R-14: observer registration is now a one-shot in
        // applicationDidFinishLaunching. No per-screens-change re-register.
    }

    private func buildWallpaperWindow(for screen: NSScreen) -> (NSWindow, WKWebView) {
        let win = NSWindow(
            contentRect:  screen.frame,
            styleMask:    .borderless,
            backing:      .buffered,
            defer:        false,
            screen:       screen
        )
        // Promo capture mode raises the window above everything so ffmpeg
        // screen capture can actually see it. In normal use, the window is
        // glued to the desktop wallpaper layer.
        if ProcessInfo.processInfo.environment["JARVIS_PROMO_CAPTURE"] == "1" {
            win.level = .floating
            win.ignoresMouseEvents = false
        } else {
            win.level = NSWindow.Level(Int(CGWindowLevelForKey(.desktopWindow)))
            win.ignoresMouseEvents = true
        }
        win.backgroundColor = NSColor(red: 0.02, green: 0.04, blue: 0.08, alpha: 1.0)
        win.isOpaque      = true
        win.hasShadow     = false
        win.collectionBehavior  = [.canJoinAllSpaces, .stationary, .ignoresCycle]

        let config = WKWebViewConfiguration()
        // Allow JS + WebGL (required by the canvas animation and optional HiFi core)
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        let wv = WKWebView(frame: screen.frame, configuration: config)
        wv.autoresizingMask = [.width, .height]
        // Make WKWebView background transparent so the window colour shows if
        // the HTML takes a moment to paint on first load.
        wv.setValue(false, forKey: "drawsBackground")

        if let url = htmlFileURL() {
            // allowingReadAccessTo: parent dir so the HTML can load web fonts
            // from the same directory (none needed for bundled file, but safe).
            wv.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }

        win.contentView = wv
        return (win, wv)
    }

    /// Locates jarvis-full-animation.html.
    /// Search order:
    ///   1. Bundle resources  — for .app bundle deployment (Contents/Resources/)
    ///   2. Repo-relative     — for `swift build -c release` dev use
    ///      Executable: jarvis-build/JarvisTelemetry/.build/release/JarvisTelemetry
    ///      HTML file:  jarvis-build/jarvis-full-animation.html  (4 components up)
    private func htmlFileURL() -> URL? {
        // 1. Bundle resources (works when packaged as JarvisWallpaper.app)
        if let bundled = Bundle.main.url(forResource: "jarvis-full-animation", withExtension: "html") {
            NSLog("[AppDelegate] loading bundled: %@", bundled.path)
            return bundled
        }

        // 2. Repo-relative fallback (works with swift build direct binary)
        guard let execURL = Bundle.main.executableURL else { return nil }
        let candidate = execURL
            .deletingLastPathComponent()  // → .build/release/
            .deletingLastPathComponent()  // → .build/
            .deletingLastPathComponent()  // → JarvisTelemetry/  (Swift package dir)
            .deletingLastPathComponent()  // → jarvis-build/     (repo root)
            .appendingPathComponent("jarvis-full-animation.html")
            .standardized
        guard FileManager.default.fileExists(atPath: candidate.path) else {
            NSLog("[AppDelegate] ERROR: jarvis-full-animation.html not found at %@", candidate.path)
            return nil
        }
        NSLog("[AppDelegate] loading %@", candidate.path)
        return candidate
    }

    @objc private func screensDidChange() {
        setupWallpaperWindows()
        triggerOverlayWindow?.close()
        triggerOverlayWindow  = nil
        triggerOverlayWebView = nil
        _triggerPanelOpen     = false
        buildTriggerOverlay()
    }

    // MARK: - Full Daemon Telemetry (1 Hz)

    private func startFullTelemetry() {
        let bridge = TelemetryBridge()
        telemetryBridge = bridge
        bridge.start()
        telemetryCancellable = bridge.$snapshot
            .compactMap { $0 }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] snap in
                self?.injectFullTelemetry(snap)
            }
        NSLog("[AppDelegate] full telemetry bridge started")
    }

    private func injectFullTelemetry(_ snap: TelemetrySnapshot) {
        let info = snap.systemInfo
        let allCores = snap.coreUsages

        let eCores = Array(allCores.prefix(info.eCoreCount))
        let pCores = Array(allCores.dropFirst(info.eCoreCount).prefix(info.pCoreCount))

        let memUsedGB  = Double(snap.memory.used)      / 1_073_741_824.0
        let memTotalGB = Double(snap.memory.total)     / 1_073_741_824.0
        let swapUsedGB = Double(snap.memory.swapUsed)  / 1_073_741_824.0
        let swapTotalGB = Double(snap.memory.swapTotal) / 1_073_741_824.0

        let netIn   = snap.netDisk?.inBytesPerSec     ?? 0
        let netOut  = snap.netDisk?.outBytesPerSec    ?? 0
        let diskR   = snap.netDisk?.readKBytesPerSec  ?? 0
        let diskW   = snap.netDisk?.writeKBytesPerSec ?? 0

        // R-15: build the payload as a dictionary, serialise via
        // JSONSerialization, then escape for embedding in a JS string
        // literal passed to JSON.parse(). Any pathological thermalState
        // characters ("'; alert(1);//") are now inert.
        let payload: [String: Any] = [
            "cpuECores":     eCores.map { Double(String(format: "%.1f", $0)) ?? 0.0 },
            "cpuPCores":     pCores.map { Double(String(format: "%.1f", $0)) ?? 0.0 },
            "gpuPct":        snap.gpuUsage,
            "cpuTempC":      snap.socMetrics.cpuTemp,
            "gpuTempC":      snap.socMetrics.gpuTemp,
            "totalPowerW":   snap.socMetrics.totalPower,
            "anePowerW":     snap.socMetrics.anePower,
            "dramReadBW":    snap.socMetrics.dramReadBW,
            "dramWriteBW":   snap.socMetrics.dramWriteBW,
            "memUsedGB":     memUsedGB,
            "memTotalGB":    memTotalGB,
            "swapUsedGB":    swapUsedGB,
            "swapTotalGB":   swapTotalGB,
            "netInBps":      netIn,
            "netOutBps":     netOut,
            "diskReadKBps":  diskR,
            "diskWriteKBps": diskW,
            "thermalState":  snap.thermalState,
        ]
        let js = Self.telemetryInjectionScript(payload: payload)
        for wv in webViews {
            wv.evaluateJavaScript(js) { _, _ in }
        }
        NSLog("[AppDelegate] telemetry injected: cpu=%.0f%% gpu=%.0f%% mem=%.1f/%.0fGB temp=%.0f°C",
              snap.cpuUsage, snap.gpuUsage, memUsedGB, memTotalGB, snap.socMetrics.cpuTemp)

        // ── Reactive threshold firing ────────────────────────────────────
        // After the raw telemetry is injected, evaluate real-metric
        // thresholds and call JT.trigger(key) to fire the full RECIPES
        // animation whenever a metric crosses into critical territory.
        // Each key has its own cooldown window so we don't spam the HUD.
        fireReactiveThresholds(snap: snap, memUsedGB: memUsedGB, memTotalGB: memTotalGB)
    }

    /// R-15: builds `updateTelemetry(JSON.parse('…'))` where `…` is a safely
    /// escaped JSON string. Exposed `static` + `internal` for unit tests.
    static func telemetryInjectionScript(payload: [String: Any]) -> String {
        let raw: Data = (try? JSONSerialization.data(
            withJSONObject: payload, options: [.sortedKeys])) ?? Data("{}".utf8)
        guard let jsonStr = String(data: raw, encoding: .utf8) else {
            return "updateTelemetry({})"
        }
        // Two-step escape so the JSON can live inside a single-quoted JS string:
        //   1. backslashes must be escaped first
        //   2. single-quotes must be escaped next
        //   3. U+2028 / U+2029 line separators (legal in JSON, illegal as raw
        //      characters inside a JS string literal) are escaped to \u escapes
        var escaped = jsonStr
        escaped = escaped.replacingOccurrences(of: "\\", with: "\\\\")
        escaped = escaped.replacingOccurrences(of: "'", with: "\\'")
        escaped = escaped.replacingOccurrences(of: "\u{2028}", with: "\\u2028")
        escaped = escaped.replacingOccurrences(of: "\u{2029}", with: "\\u2029")
        return "updateTelemetry(JSON.parse('\(escaped)'))"
    }

    // MARK: - Reactive Threshold Firing

    /// Per-trigger cooldowns so the same alert can't re-fire more than
    /// once every N seconds, even if the underlying metric keeps crossing
    /// the threshold tick after tick.
    private var lastTriggerFireAt: [String: Date] = [:]
    private let triggerCooldown: TimeInterval = 25.0

    /// Evaluates every real-telemetry threshold and calls `JT.trigger(key)`
    /// on the HTML engine for any that cross. This is what makes the HUD
    /// *reactive* — it ties the Iron-Man-style surge animations to live
    /// hardware behaviour instead of just the manual demo buttons.
    private func fireReactiveThresholds(snap: TelemetrySnapshot,
                                        memUsedGB: Double,
                                        memTotalGB: Double)
    {
        let memPct: Double = memTotalGB > 0 ? (memUsedGB / memTotalGB) * 100.0 : 0.0
        let swapActive: Bool = snap.memory.swapUsed > 0

        // CPU spike — any core over 85% OR aggregate usage > 85%
        let maxCore = snap.coreUsages.max() ?? 0.0
        if snap.cpuUsage >= 85.0 || maxCore >= 95.0 {
            maybeFireTrigger("cpu",
                reason: "cpu=\(Int(snap.cpuUsage))% maxCore=\(Int(maxCore))%")
        }

        // GPU surge — >= 85% utilisation
        if snap.gpuUsage >= 85.0 {
            maybeFireTrigger("gpu",
                reason: "gpu=\(Int(snap.gpuUsage))%")
        }

        // Thermal critical — CPU temp >= 85°C, OR thermal state != Nominal
        let thermalStr = snap.thermalState
        if snap.socMetrics.cpuTemp >= 85.0 ||
           snap.socMetrics.gpuTemp >= 85.0 ||
           (thermalStr != "Nominal" && thermalStr != "Normal") {
            maybeFireTrigger("thermal",
                reason: "cpuT=\(Int(snap.socMetrics.cpuTemp))°C thermalState=\(thermalStr)")
        }

        // Power surge — total package power >= 45W
        if snap.socMetrics.totalPower >= 45.0 {
            maybeFireTrigger("power",
                reason: "power=\(Int(snap.socMetrics.totalPower))W")
        }

        // Memory pressure — >= 90% used OR swap active + > 25% swap
        if memPct >= 90.0 || swapActive {
            maybeFireTrigger("memory",
                reason: "mem=\(Int(memPct))% swap=\(swapActive)")
        }

        // Network burst — >= 10 MB/s in or out
        if let nd = snap.netDisk {
            let maxNet = max(nd.inBytesPerSec, nd.outBytesPerSec)
            if maxNet >= 10_485_760 {  // 10 MB/s
                maybeFireTrigger("network",
                    reason: "netMax=\(Int(maxNet/1_048_576))MB/s")
            }

            // Disk I/O spike — >= 500 MB/s read or write
            let maxDisk = max(nd.readKBytesPerSec, nd.writeKBytesPerSec)
            if maxDisk >= 512_000 {  // 500 MB/s in KB/s
                maybeFireTrigger("disk",
                    reason: "diskMax=\(Int(maxDisk/1024))MB/s")
            }
        }
    }

    private func maybeFireTrigger(_ key: String, reason: String) {
        let now = Date()
        if let last = lastTriggerFireAt[key],
           now.timeIntervalSince(last) < triggerCooldown {
            return
        }
        lastTriggerFireAt[key] = now
        NSLog("[AppDelegate] 🔥 reactive trigger '%@' — %@", key, reason)
        let safe = key.filter { $0.isLetter || $0.isNumber }
        let js  = "if(typeof JT!=='undefined'){JT.trigger('\(safe)')}"
        for wv in webViews {
            wv.evaluateJavaScript(js) { _, _ in }
        }
    }

    // MARK: - Lock / Unlock Session Notifications
    //
    // Three detection paths (belt + braces for cross-version reliability):
    //
    //   1. DistributedNotificationCenter "com.apple.screenIsLocked" / "screenIsUnlocked"
    //      → Primary event-driven signal. Sometimes throttled on Sonoma+.
    //
    //   2. CGSession polling @ 1 Hz via kCGSSessionScreenIsLockedKey.
    //      → Belt-and-braces fallback. Rock solid across every macOS version
    //        because it reads the same kernel flag the Dock uses.
    //
    //   3. NSWorkspace.sessionDidResignActive / sessionDidBecomeActive
    //      → Fires on fast-user-switching, NOT lock — kept as a tertiary HUD
    //        cue only (no wallpaper rotation).

    /// 1 Hz timer that polls CGSessionCopyCurrentDictionary for the real
    /// kernel-level lock flag. Compensates for any missed distributed
    /// notifications (known issue on Sonoma+ when a process is launched
    /// via launchd before the user has unlocked for the first time).
    private var lockPollTimer: Timer?

    private func startLockStatePolling() {
        lockPollTimer?.invalidate()
        let t = Timer(timeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.pollLockState() }
        }
        RunLoop.main.add(t, forMode: .common)
        lockPollTimer = t
        NSLog("[AppDelegate] lock-state poll timer armed @ 1 Hz")
    }

    /// Reads CGSessionCopyCurrentDictionary and bridges its locked flag into
    /// handleScreenLock/Unlock. Idempotent — the handlers guard on
    /// isScreenLocked so duplicates are ignored.
    private func pollLockState() {
        guard let dict = CGSessionCopyCurrentDictionary() as? [String: Any] else { return }
        // kCGSSessionScreenIsLockedKey is a private key string "CGSSessionScreenIsLocked".
        // It is present (Bool true) when the session is locked.
        let locked = (dict["CGSSessionScreenIsLocked"] as? Bool) ?? false
        if locked && !isScreenLocked {
            NSLog("[AppDelegate] CGSession poll detected LOCK — entering lock phase")
            handleScreenLock()
        } else if !locked && isScreenLocked {
            NSLog("[AppDelegate] CGSession poll detected UNLOCK — exiting lock phase")
            handleScreenUnlock()
        }
    }

    // MARK: - Test Triggers (reactive-animation verification harness)
    //
    // The app listens on DistributedNotificationCenter for two notifications
    // that a companion CLI invocation can post:
    //
    //   com.jarvis.test.trigger   userInfo: {"key": "cpu"}  (or gpu, thermal, …)
    //       → Calls JT.trigger(key) on the primary webview, waits 700 ms
    //         for the RECIPE animation to visibly take hold, snapshots the
    //         canvas to /tmp/jarvis-trigger-<key>.png and NSLog's a marker.
    //
    //   com.jarvis.test.snapshot  (no userInfo)
    //       → Snapshots the primary webview immediately to
    //         /tmp/jarvis-snapshot.png. Used to capture a baseline PNG.
    //
    // The reactive-validation shell script invokes these via
    //   JarvisTelemetry --trigger cpu
    //   JarvisTelemetry --snapshot-now
    // which run in a side process whose only job is posting the
    // distributed notification — the real work happens in the long-lived
    // LaunchAgent instance observing here.

    private func installTestTriggerObservers() {
        let dnc = DistributedNotificationCenter.default()

        dnc.addObserver(
            forName: NSNotification.Name("com.jarvis.test.trigger"),
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let self else { return }
            let key = (note.userInfo?["key"] as? String) ?? ""
            Task { @MainActor in self.handleTestTrigger(key: key) }
        }

        dnc.addObserver(
            forName: NSNotification.Name("com.jarvis.test.snapshot"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in self.handleTestSnapshot(path: "/tmp/jarvis-snapshot.png") }
        }
        NSLog("[AppDelegate] test-trigger observers installed")
    }

    /// Fires the named RECIPE via JT.trigger() on the primary webview,
    /// waits ~700 ms for the animation to visibly take hold, then
    /// snapshots the canvas to /tmp/jarvis-trigger-<key>.png.
    private func handleTestTrigger(key: String) {
        let safeKey = key.filter { $0.isLetter || $0.isNumber }
        guard !safeKey.isEmpty else { return }
        NSLog("[AppDelegate] test trigger ← key=%@", safeKey)

        let js: String
        if safeKey == "nominal" {
            // Cancel any live trigger and return to baseline.
            js = "(function(){if(typeof JT!=='undefined'){['cpu','gpu','thermal','power','charge','memory','network','disk'].forEach(k=>{try{JT.trigger(k)}catch(e){}})}setPhase('nominal');})()"
        } else {
            js = "if(typeof JT!=='undefined'){JT.trigger('\(safeKey)')}"
        }
        for wv in webViews {
            wv.evaluateJavaScript(js) { _, _ in }
        }

        // Give the RECIPE ~700 ms to visibly take hold before snapshotting.
        let path = "/tmp/jarvis-trigger-\(safeKey).png"
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { [weak self] in
            self?.handleTestSnapshot(path: path)
        }
    }

    /// Snapshots the primary webview and writes a PNG to `path`.
    private func handleTestSnapshot(path: String) {
        guard let primaryWV = webViews.first else {
            NSLog("[AppDelegate] test snapshot: no webview")
            return
        }
        let config = WKSnapshotConfiguration()
        config.afterScreenUpdates = true
        primaryWV.takeSnapshot(with: config) { [weak self] image, error in
            Task { @MainActor in
                guard let self else { return }
                if let error = error {
                    NSLog("[AppDelegate] test snapshot error: %@", error.localizedDescription)
                    return
                }
                guard let image = image, image.size.width > 0 else {
                    NSLog("[AppDelegate] test snapshot: nil/empty image")
                    return
                }
                let url = URL(fileURLWithPath: path)
                self.writePNG(image, to: url)
                NSLog("[AppDelegate] test snapshot written → %@", path)
            }
        }
    }

    private func installSessionNotifications() {
        // ── Primary: real screen lock (distributed notification) ──
        let dnc = DistributedNotificationCenter.default()
        dnc.addObserver(
            forName: NSNotification.Name("com.apple.screenIsLocked"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.handleScreenLock() }
        }
        dnc.addObserver(
            forName: NSNotification.Name("com.apple.screenIsUnlocked"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.handleScreenUnlock() }
        }
        NSLog("[AppDelegate] distributed lock/unlock observers installed (com.apple.screenIsLocked/Unlocked)")

        // ── Secondary: fast user switching ──
        let wsCenter = NSWorkspace.shared.notificationCenter
        wsCenter.addObserver(
            forName: NSWorkspace.sessionDidResignActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                NSLog("[AppDelegate] session resigned (fast user switch) — setPhase('lock')")
                for wv in self.webViews {
                    _ = try? await wv.evaluateJavaScript("setPhase('lock')")
                }
            }
        }
        wsCenter.addObserver(
            forName: NSWorkspace.sessionDidBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                NSLog("[AppDelegate] session became active (fast user switch) — wake boot")
                for wv in self.webViews {
                    _ = try? await wv.evaluateJavaScript(
                        "if(window.JARVIS&&JARVIS.unlock){JARVIS.unlock()}else{setPhase('booting')}"
                    )
                }
            }
        }
        NSLog("[AppDelegate] fast-user-switch observers installed")
    }

    // MARK: - Real Screen-Lock Handler (animated wallpaper rotation path)

    /// Called on com.apple.screenIsLocked. Starts a continuous animation
    /// loop that captures the live reactor WKWebView and rotates the
    /// desktop wallpaper on every screen at ~3 fps. Real macOS lock
    /// screen observes this and refreshes.
    private func handleScreenLock() {
        guard !isScreenLocked else {
            NSLog("[AppDelegate] handleScreenLock: already locked — ignoring duplicate")
            return
        }
        isScreenLocked = true
        NSLog("[AppDelegate] 🔒 SCREEN LOCKED — starting animated wallpaper loop (period=%.2fs)",
              lockAnimationPeriod)

        // Tell the HTML engine to transition to lock phase so the snapshot
        // captures the subdued lock overlay (wireframe sphere + SYSTEM LOCKED
        // status text) rather than the nominal HUD.
        for wv in webViews {
            wv.evaluateJavaScript("setPhase('lock')") { _, _ in }
        }

        // Remember current wallpaper URLs so we can restore them on unlock.
        // Skip our own frame URLs so repeat lock/unlock cycles don't lose
        // the user's real wallpaper.
        priorWallpaperURLs.removeAll()
        let frameSet = Set(lockFrameURLs.map { $0.standardizedFileURL })
        for screen in NSScreen.screens {
            if let url = NSWorkspace.shared.desktopImageURL(for: screen) {
                if frameSet.contains(url.standardizedFileURL) {
                    NSLog("[AppDelegate] prior URL for %@ is our own frame — keeping existing priorURL (stale state)",
                          "\(screen.localizedName)")
                    // Don't overwrite with a stale JARVIS frame
                } else {
                    priorWallpaperURLs[ObjectIdentifier(screen)] = url
                }
            }
        }
        NSLog("[AppDelegate] stored %d prior wallpaper URL(s)", priorWallpaperURLs.count)

        // Kick off the first capture immediately so the user doesn't see a
        // stale wallpaper for the first 300 ms of the lock.
        lockFrameIndex = 0
        captureAndRotateFrame()

        // Schedule the continuous loop. The Timer fires on the main run loop.
        lockAnimationTimer?.invalidate()
        let timer = Timer(timeInterval: lockAnimationPeriod, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.captureAndRotateFrame() }
        }
        RunLoop.main.add(timer, forMode: .common)
        lockAnimationTimer = timer
        NSLog("[AppDelegate] lock animation timer armed")
    }

    /// One tick of the lock animation loop. Captures the live reactor
    /// WKWebView, writes to the next frame PNG slot, and updates the
    /// desktop wallpaper to that slot. macOS refreshes the lock screen.
    private func captureAndRotateFrame() {
        guard isScreenLocked else { return }
        guard !lockSnapshotInFlight else {
            NSLog("[AppDelegate] captureAndRotateFrame: previous snapshot still in flight — skip")
            return
        }
        guard let primaryWV = webViews.first else {
            NSLog("[AppDelegate] captureAndRotateFrame: no webview — fallback standby")
            let url = lockFrameURLs[lockFrameIndex % lockFrameURLs.count]
            writeStandbyImageAndInstall(to: url)
            lockFrameIndex &+= 1
            return
        }

        lockSnapshotInFlight = true
        let config = WKSnapshotConfiguration()
        // afterScreenUpdates: false lets the snapshot return immediately
        // even when the wallpaper window is occluded by loginwindow.
        config.afterScreenUpdates = false

        let targetURL = lockFrameURLs[lockFrameIndex % lockFrameURLs.count]
        lockFrameIndex &+= 1

        // Safety: if the snapshot callback never fires (web process crashed,
        // snapshot lost), clear the in-flight flag after 2× the animation
        // period so the next tick isn't silently dropped forever.
        let snapshotDeadline = DispatchTime.now() + (lockAnimationPeriod * 2)
        DispatchQueue.main.asyncAfter(deadline: snapshotDeadline) { [weak self] in
            guard let self = self else { return }
            if self.lockSnapshotInFlight {
                NSLog("[AppDelegate] snapshot watchdog fired — clearing in-flight flag")
                self.lockSnapshotInFlight = false
                // Draw a fallback frame so the lock screen still updates.
                if self.isScreenLocked {
                    self.writeStandbyImageAndInstall(to: targetURL)
                }
            }
        }

        primaryWV.takeSnapshot(with: config) { [weak self] image, error in
            Task { @MainActor in
                guard let self else { return }
                defer { self.lockSnapshotInFlight = false }
                guard self.isScreenLocked else { return }

                if let error = error {
                    NSLog("[AppDelegate] snapshot error: %@ — fallback standby", error.localizedDescription)
                    self.writeStandbyImageAndInstall(to: targetURL)
                    return
                }
                guard let image = image, image.size.width > 0 else {
                    NSLog("[AppDelegate] snapshot nil/empty — fallback standby")
                    self.writeStandbyImageAndInstall(to: targetURL)
                    return
                }
                self.writePNG(image, to: targetURL)
                self.installWallpaperOnAllScreens(url: targetURL)
            }
        }
    }

    /// Fallback path — draws a static SYSTEM STANDBY reactor image programmatically.
    private func writeStandbyImageAndInstall(to url: URL) {
        guard let screen = NSScreen.main else { return }
        let w = Int(screen.frame.width)
        let h = Int(screen.frame.height)
        guard let image = renderStandbyImage(width: w, height: h) else {
            NSLog("[AppDelegate] writeStandbyImageAndInstall: render failed")
            return
        }
        writePNG(image, to: url)
        installWallpaperOnAllScreens(url: url)
    }

    private func renderStandbyImage(width: Int, height: Int) -> NSImage? {
        let img = NSImage(size: NSSize(width: width, height: height))
        img.lockFocus()
        defer { img.unlockFocus() }
        guard let ctx = NSGraphicsContext.current?.cgContext else { return nil }

        let w = CGFloat(width), h = CGFloat(height)
        let cx = w / 2, cy = h / 2, R = min(w, h) * 0.42

        // Dark background (matches HUD background)
        ctx.setFillColor(NSColor(red: 0.02, green: 0.04, blue: 0.08, alpha: 1.0).cgColor)
        ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))

        // Concentric structural rings
        let steel = NSColor(red: 0.40, green: 0.52, blue: 0.58, alpha: 1.0)
        for i in stride(from: 0, to: 220, by: 3) {
            let frac = Double(i) / 220.0
            let r = R * (0.06 + frac * 0.91)
            let opacity = (0.08 + (1.0 - frac) * 0.12) * 0.55
            ctx.setStrokeColor(steel.withAlphaComponent(opacity).cgColor)
            ctx.setLineWidth(0.6)
            ctx.addArc(center: CGPoint(x: cx, y: cy), radius: r,
                       startAngle: 0, endAngle: .pi * 2, clockwise: false)
            ctx.strokePath()
        }

        // Cyan core glow
        let cyan = NSColor(red: 0.102, green: 0.902, blue: 0.961, alpha: 1.0)
        for layer in 0..<30 {
            let lr = R * 0.01 + CGFloat(layer) * R * 0.012
            let falloff = 1.0 - Double(layer) / 30.0
            let lo = (0.22 * falloff * falloff) * 0.8
            ctx.setFillColor(cyan.withAlphaComponent(CGFloat(lo)).cgColor)
            ctx.fillEllipse(in: CGRect(x: cx - lr, y: cy - lr, width: lr * 2, height: lr * 2))
        }

        // Hot white-cyan core
        ctx.setFillColor(NSColor.white.withAlphaComponent(0.75).cgColor)
        ctx.fillEllipse(in: CGRect(x: cx - 8, y: cy - 8, width: 16, height: 16))

        // Status text
        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont(name: "Menlo", size: 14) ?? NSFont.monospacedSystemFont(ofSize: 14, weight: .regular),
            .foregroundColor: cyan.withAlphaComponent(0.65),
            .kern: 6.0
        ]
        let text = "SYSTEM LOCKED · JARVIS STANDBY" as NSString
        let textSize = text.size(withAttributes: attrs)
        text.draw(at: CGPoint(x: cx - textSize.width / 2, y: cy - R - 60), withAttributes: attrs)

        return img
    }

    private func writePNG(_ image: NSImage, to url: URL) {
        guard let tiff = image.tiffRepresentation,
              let rep  = NSBitmapImageRep(data: tiff),
              let png  = rep.representation(using: .png, properties: [:]) else {
            NSLog("[AppDelegate] writePNG: encoding failed")
            return
        }
        do {
            try png.write(to: url, options: .atomic)
            NSLog("[AppDelegate] wrote %d bytes → %@", png.count, url.path)
        } catch {
            NSLog("[AppDelegate] writePNG failed: %@", error.localizedDescription)
        }
    }

    private func installWallpaperOnAllScreens(url: URL) {
        for screen in NSScreen.screens {
            do {
                try NSWorkspace.shared.setDesktopImageURL(url, for: screen, options: [:])
                NSLog("[AppDelegate] setDesktopImageURL OK for screen %@", "\(screen.localizedName)")
            } catch {
                NSLog("[AppDelegate] setDesktopImageURL FAILED for screen %@: %@",
                      "\(screen.localizedName)", error.localizedDescription)
            }
        }
    }

    /// Called on com.apple.screenIsUnlocked. Stops the animation timer and
    /// restores the prior wallpapers.
    private func handleScreenUnlock() {
        guard isScreenLocked else {
            NSLog("[AppDelegate] handleScreenUnlock: not locked — ignoring")
            return
        }
        isScreenLocked = false

        lockAnimationTimer?.invalidate()
        lockAnimationTimer = nil
        lockSnapshotInFlight = false
        NSLog("[AppDelegate] 🔓 SCREEN UNLOCKED — animation timer stopped, restoring %d prior wallpaper(s)",
              priorWallpaperURLs.count)

        for screen in NSScreen.screens {
            if let prior = priorWallpaperURLs[ObjectIdentifier(screen)] {
                do {
                    try NSWorkspace.shared.setDesktopImageURL(prior, for: screen, options: [:])
                    NSLog("[AppDelegate] restored wallpaper for %@ → %@", "\(screen.localizedName)", prior.path)
                } catch {
                    NSLog("[AppDelegate] restore wallpaper FAILED for %@: %@",
                          "\(screen.localizedName)", error.localizedDescription)
                }
            }
        }
        priorWallpaperURLs.removeAll()

        // Return the HTML engine to nominal so the in-app view resumes.
        for wv in webViews {
            wv.evaluateJavaScript(
                "if(window.JARVIS&&JARVIS.unlock){JARVIS.unlock()}else{setPhase('booting')}"
            ) { _, _ in }
        }
    }

    // MARK: - Battery Telemetry

    /// Combine subscriptions for reactive battery events. Kept alive for
    /// the life of AppDelegate; cancelled in applicationWillTerminate.
    private var batteryCancellables = Set<AnyCancellable>()

    private func startBatteryTelemetry() {
        let bm = BatteryMonitor()
        batteryMonitor = bm
        bm.start()

        // R-19: charge-event fan-out is intentionally single-source to avoid
        // double-firing. The sole subscriber watches $chargingJustAttached
        // — the BatteryMonitor-computed edge flag — and relies on the 2-second
        // dedup inside fireChargeReactiveAnimation as a final safety net.
        //
        // Why not $isCharging as a fallback? BatteryMonitor asserts the
        // chargingJustAttached edge the moment IOKit flips isCharging true,
        // and the Combine publisher fires synchronously on the main queue.
        // A duplicate $isCharging subscriber would double-fire on every plug
        // event; its only "safety" was covering a BatteryMonitor bug that
        // no longer exists after the replay timeline tests (R-22) cover
        // every branch.
        bm.$chargingJustAttached
            .filter { $0 }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.fireChargeReactiveAnimation(reason: "chargingJustAttached edge")
            }
            .store(in: &batteryCancellables)

        // Inject real battery data into the HTML canvas at 2 Hz (keeps
        // DOM panels up to date — numeric pct, AC/BATT label, etc.).
        let t = Timer(timeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.injectBatteryData() }
        }
        RunLoop.main.add(t, forMode: .common)
        batteryTimer = t
        NSLog("[AppDelegate] battery telemetry started (reactive + 2Hz poll)")
    }

    /// Debounce: timestamp of the last charge animation we fired. Two
    /// Combine subscribers (`chargingJustAttached` and `isCharging`) can
    /// both observe the same underlying physical plug event, so we
    /// collapse any re-fires within 2 s into a single visual reaction.
    private var lastChargeFireAt: Date = .distantPast

    /// Fires the full reactive charge animation immediately via the HTML
    /// `JT.trigger('charge')` entry point. This runs the RECIPE —
    /// `overdriveBloom/Rings = 3.0`, spawnSparks(), shake, firePulse —
    /// which is what the user's "reactive animation" requirement demands
    /// on a real cable plug-in.
    private func fireChargeReactiveAnimation(reason: String) {
        let now = Date()
        if now.timeIntervalSince(lastChargeFireAt) < 2.0 {
            NSLog("[AppDelegate] ⚡ CHARGE EVENT (%@) — deduped (<2s since last)", reason)
            return
        }
        lastChargeFireAt = now
        NSLog("[AppDelegate] ⚡ CHARGE EVENT (%@) — firing JT.trigger('charge') on %d webview(s)",
              reason, webViews.count)
        // Two-step injection: ensure updateTelemetry sees the raw flag
        // (so the DOM battery label flips to AC immediately) AND invoke
        // the full reactive recipe.
        let js = """
        (function(){
            updateTelemetry({batteryCharging:true,chargingJustAttached:true});
            if (typeof JT !== 'undefined') { JT.trigger('charge'); }
        })();
        """
        for wv in webViews {
            wv.evaluateJavaScript(js) { _, _ in }
        }
    }

    private func injectBatteryData() {
        guard let bm = batteryMonitor else { return }
        let pct         = bm.batteryPercent
        let charging    = bm.isCharging     ? "true" : "false"
        let dying       = bm.isDying        ? "true" : "false"
        let justAttached = bm.chargingJustAttached ? "true" : "false"
        let js = "updateTelemetry({batteryPct:\(pct),batteryCharging:\(charging),isDying:\(dying),chargingJustAttached:\(justAttached)})"
        for wv in webViews {
            wv.evaluateJavaScript(js) { _, _ in }
        }
    }

    // MARK: - Trigger Overlay (transparent click-catcher)

    /// Builds a tiny transparent NSPanel centred at the bottom of the screen.
    /// Visual trigger buttons live in jarvis-full-animation.html at #jt-root (bottom:94px).
    /// This overlay is an INVISIBLE click-catcher directly on top of those HTML buttons.
    /// • Level = kCGDesktopWindowLevel+1 — above wallpaper, below every app window.
    /// • Never overlaps any JARVIS data panel (centre-bottom area is clear).
    /// • Starts sized to toggle button only (160×40); expands to 340×280 when open.
    private func buildTriggerOverlay() {
        guard let screen = NSScreen.main else { return }
        // Sized to the toggle button only (collapsed). Expands when user opens panel.
        let panelW: CGFloat = 160
        let panelH: CGFloat = 40
        let panelRect = NSRect(
            x: (screen.frame.width - panelW) / 2,
            y: 94,   // 94pt above bottom edge — aligns with #jt-root bottom:94px in HTML
            width:  panelW,
            height: panelH
        )
        let panel = NSPanel(
            contentRect: panelRect,
            styleMask:   [.borderless, .nonactivatingPanel],
            backing:     .buffered,
            defer:       false
        )
        panel.level              = NSWindow.Level(Int(CGWindowLevelForKey(.desktopWindow)) + 1)
        panel.backgroundColor    = .clear
        panel.isOpaque           = false
        panel.hasShadow          = false
        panel.ignoresMouseEvents = false
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        panel.isFloatingPanel    = true
        let config = WKWebViewConfiguration()
        let ucc    = WKUserContentController()
        ucc.add(self, name: "jarvisAction")
        config.userContentController = ucc
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        let wv = WKWebView(frame: NSRect(origin: .zero, size: panelRect.size), configuration: config)
        wv.autoresizingMask = [.width, .height]
        wv.setValue(false, forKey: "drawsBackground")
        wv.loadHTMLString(triggerOverlayHTML(), baseURL: nil)
        panel.contentView = wv
        panel.orderFront(nil)
        triggerOverlayWindow  = panel
        triggerOverlayWebView = wv
        NSLog("[AppDelegate] trigger overlay 160x40 center-bottom y=94 (collapsed)")
    }

    private func resizeTriggerOverlay(open: Bool) {
        guard let screen = NSScreen.main, let panel = triggerOverlayWindow else { return }
        let w: CGFloat = open ? 340 : 160
        let h: CGFloat = open ? 280 : 40
        let x = (screen.frame.width - w) / 2
        panel.setFrame(NSRect(x: x, y: 94, width: w, height: h), display: true, animate: false)
        NSLog("[AppDelegate] trigger overlay %.0fx%.0f (open=%@)", w, h, open ? "true" : "false")
    }

    private func triggerOverlayHTML() -> String {
        // Invisible click-catcher that mirrors the #jt-root layout in the main HTML.
        // All elements are fully transparent — the visual buttons are drawn by the
        // main HTML at #jt-root. This overlay just captures clicks and forwards them.
        """
        <!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          *{margin:0;padding:0;box-sizing:border-box;}
          html,body{width:100%;height:100%;background:transparent;overflow:hidden;
                    -webkit-user-select:none;}
          #ov-root{position:fixed;bottom:0;left:50%;transform:translateX(-50%);
                   display:flex;flex-direction:column;align-items:center;gap:5px;}
          #ov-toggle{background:rgba(0,0,0,0.01);border:none;color:transparent;
                     width:140px;height:30px;cursor:pointer;}
          #ov-panel{display:none;flex-direction:column;gap:5px;align-items:stretch;
                    padding:10px 12px 8px;background:rgba(0,0,0,0.01);min-width:310px;}
          #ov-panel.open{display:flex;}
          .ov-row{display:flex;gap:5px;}
          .ov-btn{flex:1;background:rgba(0,0,0,0.01);border:none;color:transparent;
                  padding:6px 8px 8px;cursor:pointer;min-height:26px;}
          .ov-lbl{height:20px;pointer-events:none;}
        </style></head><body>
        <div id="ov-root">
          <div id="ov-panel">
            <div class="ov-lbl"></div>
            <div class="ov-row">
              <button class="ov-btn" onclick="T('cpu')"> </button>
              <button class="ov-btn" onclick="T('gpu')"> </button>
              <button class="ov-btn" onclick="T('thermal')"> </button>
            </div>
            <div class="ov-row">
              <button class="ov-btn" onclick="T('power')"> </button>
              <button class="ov-btn" onclick="T('charge')"> </button>
              <button class="ov-btn" onclick="T('memory')"> </button>
            </div>
            <div class="ov-row">
              <button class="ov-btn" onclick="T('network')"> </button>
              <button class="ov-btn" onclick="T('disk')"> </button>
            </div>
            <div class="ov-lbl"></div>
            <div class="ov-row">
              <button class="ov-btn" onclick="P('booting')"> </button>
              <button class="ov-btn" onclick="P('lock')"> </button>
              <button class="ov-btn" onclick="P('shutdown')"> </button>
            </div>
          </div>
          <button id="ov-toggle" onclick="G()"> </button>
        </div>
        <script>
          function G(){window.webkit.messageHandlers.jarvisAction.postMessage({action:'toggle'});}
          function setOpen(v){var p=document.getElementById('ov-panel');
            if(v)p.classList.add('open');else p.classList.remove('open');}
          function T(k){window.webkit.messageHandlers.jarvisAction.postMessage({action:'trigger',key:k});}
          function P(ph){window.webkit.messageHandlers.jarvisAction.postMessage({action:'phase',phase:ph});}
        </script>
        </body></html>
        """
    }

    // MARK: - Signal Handling

    private func installSignalHandlers() {
        // Block signals at the POSIX level; DispatchSource observes via kqueue EVFILT_SIGNAL.
        var mask = sigset_t()
        sigemptyset(&mask)
        sigaddset(&mask, SIGTERM)
        sigaddset(&mask, SIGINT)
        sigprocmask(SIG_BLOCK, &mask, nil)

        let sigQ = DispatchQueue.global(qos: .userInteractive)

        let termSrc = DispatchSource.makeSignalSource(signal: SIGTERM, queue: sigQ)
        termSrc.setEventHandler { [weak self] in self?.signalShutdown() }
        termSrc.resume()
        sigtermSource = termSrc

        let intSrc = DispatchSource.makeSignalSource(signal: SIGINT, queue: sigQ)
        intSrc.setEventHandler { [weak self] in self?.signalShutdown() }
        intSrc.resume()
        sigintSource = intSrc

        NSLog("[AppDelegate] signal handlers installed (SIGTERM=%d SIGINT=%d)", SIGTERM, SIGINT)
    }

    // nonisolated — called directly from the background DispatchSource queue.
    nonisolated private func signalShutdown() {
        // R-17: DispatchSemaphore(value: 1). First entry consumes the signal;
        // every subsequent entry bounces immediately so terminate() is called
        // at most once even under SIGTERM+SIGINT races.
        guard shutdownLatch.wait(timeout: .now()) == .success else {
            NSLog("[AppDelegate] signalShutdown re-entered — already shutting down")
            return
        }
        NSLog("[AppDelegate] signal received — triggering HTML shutdown + NSApp.terminate")
        // Ask the HTML animation to play its shutdown sequence.
        NotificationCenter.default.post(name: .jarvisShutdown, object: nil)

        // Graceful path: NSApp.terminate fires applicationWillTerminate which
        // cleans up timers, daemon, signal sources, wallpapers. macOS shutdown
        // gives apps ~5s total before SIGKILL, so we keep the animation budget
        // to 3s and trigger terminate at 3s — cleanup must complete in <2s.
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            NSLog("[AppDelegate] shutdown animation elapsed — NSApp.terminate(nil)")
            NSApp.terminate(nil)
        }

        // Hard-fail safety net: if NSApp.terminate deadlocks for any reason,
        // force exit at 5s. This runs on a background queue so it bypasses
        // any main-thread deadlock.
        DispatchQueue.global(qos: .userInteractive).asyncAfter(deadline: .now() + 5.0) {
            NSLog("[AppDelegate] hard-fail fallback — exit(0)")
            exit(0)
        }
    }

    // MARK: - R-52 Production trigger observers
    //
    // com.jarvis.hud.togglePanel — observable in any build, not gated on DEBUG.
    // Mirrors the behaviour of the in-app trigger button so external callers
    // (CLI, Shortcuts, Automator) can show/hide the reactive panel.

    private func installTriggerObservers() {
        let dnc = DistributedNotificationCenter.default()
        dnc.addObserver(
            forName: NSNotification.Name("com.jarvis.hud.togglePanel"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in self.toggleTriggerPanel() }
        }
        // R-51: distributed shutdown signal → internal .jarvisShutdown.
        dnc.addObserver(
            forName: NSNotification.Name("com.jarvis.shutdown"),
            object: nil,
            queue: .main
        ) { _ in
            NSLog("[AppDelegate] received com.jarvis.shutdown — bridging to internal")
            NotificationCenter.default.post(name: .jarvisShutdown, object: nil)
        }
        NSLog("[AppDelegate] production trigger observers installed (togglePanel, shutdown)")
    }

    private func toggleTriggerPanel() {
        _triggerPanelOpen = !_triggerPanelOpen
        let open = _triggerPanelOpen
        triggerOverlayWebView?.evaluateJavaScript(
            "setOpen(\(open ? "true" : "false"))"
        ) { _, _ in }
        resizeTriggerOverlay(open: open)
        NSLog("[AppDelegate] togglePanel → open=%@", open ? "true" : "false")
    }

    // MARK: - R-54 Promo-capture cleanup

    /// Re-level every wallpaper window back to `.desktop` level and disable
    /// click pass-through. Callable from any thread (DispatchQueue.main.async).
    nonisolated private static func restorePromoCaptureWindowLevels() {
        DispatchQueue.main.async {
            NSLog("[AppDelegate] R-54 restore: setting wallpaper windows → .desktop")
            for window in NSApp.windows {
                // Any borderless window we own with colour-matching background
                // is a wallpaper window. Restore regardless.
                window.level = NSWindow.Level(Int(CGWindowLevelForKey(.desktopWindow)))
                window.ignoresMouseEvents = true
            }
        }
    }

    /// Installs atexit + POSIX signal handlers that restore window levels.
    /// atexit() handlers run on normal process exit; signal() handlers catch
    /// SIGTERM / SIGINT for forceful-but-clean shutdown.
    nonisolated private static func installPromoCaptureRestoreHandlers() {
        atexit { AppDelegate.restorePromoCaptureWindowLevels() }
        signal(SIGTERM) { _ in AppDelegate.restorePromoCaptureWindowLevels() }
        signal(SIGINT)  { _ in AppDelegate.restorePromoCaptureWindowLevels() }
        NSLog("[AppDelegate] R-54 promo-capture restore handlers installed")
    }
}

// MARK: - WKScriptMessageHandler (trigger side panel → main webviews)

extension AppDelegate: WKScriptMessageHandler {
    /// Called when the side panel WKWebView posts via window.webkit.messageHandlers.jarvisAction.
    /// Forwards the action to all wallpaper WKWebViews via evaluateJavaScript.
    ///
    /// KEY BUG FIX: JT is declared as `const JT = (() => {...})()` at module scope.
    /// In WKWebView's JS context, `const`/`let` at the top level are NOT properties of
    /// `window`. So `window.JT` is always undefined. Use `typeof JT !== 'undefined'` instead.
    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard message.name == "jarvisAction",
              let body   = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        switch action {

        case "trigger":
            guard let key = body["key"] as? String else { return }
            let safeKey = key.filter { $0.isLetter || $0.isNumber }  // injection guard
            // FIX: use typeof check, not window.JT (const is not a window property)
            let js = "if(typeof JT!=='undefined'){JT.trigger('\(safeKey)')}"
            webViews.forEach { $0.evaluateJavaScript(js) { _, _ in } }
            NSLog("[AppDelegate] trigger '%@' → %d webview(s)", safeKey, webViews.count)

        case "cancel":
            // JT.trigger() when already active = cancel (toggles off and restores snapshot)
            guard let key = body["key"] as? String else { return }
            let safeKey = key.filter { $0.isLetter || $0.isNumber }
            let js = "if(typeof JT!=='undefined'){JT.trigger('\(safeKey)')}"
            webViews.forEach { $0.evaluateJavaScript(js) { _, _ in } }
            NSLog("[AppDelegate] cancel '%@' → %d webview(s)", safeKey, webViews.count)

        case "phase":
            guard let phase = body["phase"] as? String else { return }
            let safePhase = phase.filter { $0.isLetter }
            let js = "setPhase('\(safePhase)')"
            webViews.forEach { $0.evaluateJavaScript(js) { _, _ in } }
            NSLog("[AppDelegate] phase '%@' → %d webview(s)", safePhase, webViews.count)

            // Demo-safe auto-recovery: phase animations auto-revert to NOMINAL.
            // Without this, SHUTDOWN → OFFLINE (all triggers blocked) and LOCK
            // plays forever — both appear to "hang" the HUD.
            switch safePhase {
            case "shutdown":
                // shutdownDur = 6 s + 1 s transition + 1 s buffer → reboot at 8 s
                DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) { [weak self] in
                    guard let self else { return }
                    self.webViews.forEach { $0.evaluateJavaScript("setPhase('booting')") { _, _ in } }
                    NSLog("[AppDelegate] shutdown demo → auto-rebooting")
                }
            case "lock":
                // Show lock screen for 6 s then return to NOMINAL.
                // R-18: if the real screen has already locked since the demo
                // kicked off, do NOT race it by forcing the HUD back to
                // nominal — the user is staring at the password prompt.
                DispatchQueue.main.asyncAfter(deadline: .now() + 6.0) { [weak self] in
                    guard let self else { return }
                    guard !self.isScreenLocked else {
                        NSLog("[AppDelegate] lock demo elapsed but screen is REALLY locked — holding")
                        return
                    }
                    self.webViews.forEach { $0.evaluateJavaScript("setPhase('nominal')") { _, _ in } }
                    NSLog("[AppDelegate] lock demo → auto-unlocking")
                }
            default:
                break
            }

        case "toggle":
            _triggerPanelOpen = !_triggerPanelOpen
            let open = _triggerPanelOpen
            triggerOverlayWebView?.evaluateJavaScript("setOpen(\(open ? "true" : "false"))") { _, _ in }
            resizeTriggerOverlay(open: open)
            webViews.forEach {
                $0.evaluateJavaScript("if(typeof JT!=='undefined'){JT.toggle()}") { _, _ in }
            }
            NSLog("[AppDelegate] toggle → overlay %@", open ? "open" : "closed")

        default:
            break
        }
    }
}

extension Notification.Name {
    static let jarvisShutdown = Notification.Name("jarvisShutdown")
}
