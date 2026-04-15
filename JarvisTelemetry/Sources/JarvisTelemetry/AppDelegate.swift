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
            NSLog("[AppDelegate] triggering HTML shutdown phase in %d webview(s)", self.webViews.count)
            for wv in self.webViews {
                wv.evaluateJavaScript("setPhase('shutdown')") { _, _ in }
            }
        }

        setupWallpaperWindows()
        startBatteryTelemetry()
        startFullTelemetry()
        installSessionNotifications()
        buildTriggerOverlay()
    }

    func applicationWillTerminate(_ notification: Notification) {}

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

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screensDidChange),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
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

        let eCoresStr = eCores.map { String(format: "%.1f", $0) }.joined(separator: ",")
        let pCoresStr = pCores.map { String(format: "%.1f", $0) }.joined(separator: ",")

        let memUsedGB  = Double(snap.memory.used)      / 1_073_741_824.0
        let memTotalGB = Double(snap.memory.total)     / 1_073_741_824.0
        let swapUsedGB = Double(snap.memory.swapUsed)  / 1_073_741_824.0
        let swapTotalGB = Double(snap.memory.swapTotal) / 1_073_741_824.0

        let netIn   = snap.netDisk?.inBytesPerSec     ?? 0
        let netOut  = snap.netDisk?.outBytesPerSec    ?? 0
        let diskR   = snap.netDisk?.readKBytesPerSec  ?? 0
        let diskW   = snap.netDisk?.writeKBytesPerSec ?? 0

        // Escape any apostrophes in the thermal state string
        let thermal = snap.thermalState.replacingOccurrences(of: "'", with: "\\'")

        let js = """
        updateTelemetry({
          cpuECores:[\(eCoresStr)],
          cpuPCores:[\(pCoresStr)],
          gpuPct:\(String(format: "%.1f", snap.gpuUsage)),
          cpuTempC:\(String(format: "%.1f", snap.socMetrics.cpuTemp)),
          gpuTempC:\(String(format: "%.1f", snap.socMetrics.gpuTemp)),
          totalPowerW:\(String(format: "%.1f", snap.socMetrics.totalPower)),
          anePowerW:\(String(format: "%.1f", snap.socMetrics.anePower)),
          dramReadBW:\(String(format: "%.2f", snap.socMetrics.dramReadBW)),
          dramWriteBW:\(String(format: "%.2f", snap.socMetrics.dramWriteBW)),
          memUsedGB:\(String(format: "%.2f", memUsedGB)),
          memTotalGB:\(String(format: "%.0f", memTotalGB)),
          swapUsedGB:\(String(format: "%.2f", swapUsedGB)),
          swapTotalGB:\(String(format: "%.2f", swapTotalGB)),
          netInBps:\(String(format: "%.0f", netIn)),
          netOutBps:\(String(format: "%.0f", netOut)),
          diskReadKBps:\(String(format: "%.0f", diskR)),
          diskWriteKBps:\(String(format: "%.0f", diskW)),
          thermalState:'\(thermal)'
        })
        """
        for wv in webViews {
            wv.evaluateJavaScript(js) { _, _ in }
        }
        NSLog("[AppDelegate] telemetry injected: cpu=%.0f%% gpu=%.0f%% mem=%.1f/%.0fGB temp=%.0f°C",
              snap.cpuUsage, snap.gpuUsage, memUsedGB, memTotalGB, snap.socMetrics.cpuTemp)
        // #jt-status badge lives in the main HTML — updateTelemetry() drives it directly.
        // No separate panel needs notifying.
    }

    // MARK: - Lock / Unlock Session Notifications

    private func installSessionNotifications() {
        let wsCenter = NSWorkspace.shared.notificationCenter

        // Screen locked (session resigned active) → PHASE.LOCK
        wsCenter.addObserver(
            forName: NSWorkspace.sessionDidResignActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            NSLog("[AppDelegate] session resigned — triggering lock phase")
            for wv in self.webViews {
                wv.evaluateJavaScript("setPhase('lock')") { _, _ in }
            }
        }

        // Screen unlocked (session became active) → abbreviated wake boot
        wsCenter.addObserver(
            forName: NSWorkspace.sessionDidBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            NSLog("[AppDelegate] session became active — triggering wake boot")
            for wv in self.webViews {
                wv.evaluateJavaScript(
                    "if(window.JARVIS&&JARVIS.unlock){JARVIS.unlock()}else{setPhase('booting')}"
                ) { _, _ in }
            }
        }

        NSLog("[AppDelegate] session lock/unlock notifications installed")
    }

    // MARK: - Battery Telemetry

    private func startBatteryTelemetry() {
        let bm = BatteryMonitor()
        batteryMonitor = bm
        bm.start()

        // Inject real battery data into the HTML canvas at 2 Hz
        let t = Timer(timeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.injectBatteryData()
        }
        RunLoop.main.add(t, forMode: .common)
        batteryTimer = t
        NSLog("[AppDelegate] battery telemetry started")
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
        NSLog("[AppDelegate] signal received — triggering HTML shutdown + scheduling exit")
        // Ask the HTML animation to play its shutdown sequence.
        NotificationCenter.default.post(name: .jarvisShutdown, object: nil)
        // Hard exit after shutdown animation (HTML shutdownDur = 6s, +1s buffer).
        // Using exit(0) on a global queue avoids the @MainActor scheduling issue
        // that would block NSApp.terminate(nil) via DispatchQueue.main.async.
        DispatchQueue.global(qos: .userInteractive).asyncAfter(deadline: .now() + 7.0) {
            NSLog("[AppDelegate] shutdown timer elapsed — exit(0)")
            exit(0)
        }
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
                // Show lock screen for 6 s then return to NOMINAL
                DispatchQueue.main.asyncAfter(deadline: .now() + 6.0) { [weak self] in
                    guard let self else { return }
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
