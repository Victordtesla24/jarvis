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

    // Right-side trigger panel — normal window level (visible on desktop, behind apps)
    private var sidePanelWindow: NSPanel?
    private var sidePanelWebView: WKWebView?
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
        buildSidePanel()
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
        win.level = NSWindow.Level(Int(CGWindowLevelForKey(.desktopWindow)))
        win.backgroundColor = NSColor(red: 0.02, green: 0.04, blue: 0.08, alpha: 1.0)
        win.isOpaque      = true
        win.hasShadow     = false
        win.ignoresMouseEvents  = true
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
        sidePanelWindow?.close()
        sidePanelWindow  = nil
        sidePanelWebView = nil
        buildSidePanel()
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
        // Notify the side panel that live telemetry is flowing (one-shot)
        if !_daemonLive {
            _daemonLive = true
            sidePanelWebView?.evaluateJavaScript("if(typeof setLive==='function'){setLive(true)}") { _, _ in }
        }
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

    // MARK: - Trigger Side Panel

    /// Builds a partial-height transparent NSPanel anchored at the bottom-right of the
    /// main screen.  Window level = kCGDesktopWindowLevel + 1 so it is:
    ///   • Rendered directly above the JARVIS wallpaper — visually part of the animation
    ///   • BELOW every normal app window (level 0+) — can NEVER overlap other windows
    ///   • Clickable when the desktop is exposed (ignoresMouseEvents = false)
    /// Clicks on the buttons post WKScriptMessages → Swift forwards via evaluateJavaScript
    /// to the main wallpaper WKWebViews where JT.trigger() runs inside the animation.
    private func buildSidePanel() {
        guard let screen = NSScreen.main else { return }

        let panelW: CGFloat = 232
        let visible = screen.visibleFrame          // rect above Dock, below menu bar

        // Cap height at 530 pt so the panel only occupies the bottom-right corner.
        // This prevents it from covering the JARVIS right data panels in the top-right area.
        let panelH: CGFloat = min(530, visible.height * 0.40)
        let panelRect = NSRect(
            x: visible.maxX - panelW,
            y: visible.minY,          // anchored at bottom of visible area (above Dock)
            width:  panelW,
            height: panelH
        )

        let panel = NSPanel(
            contentRect: panelRect,
            styleMask:   [.borderless, .nonactivatingPanel],
            backing:     .buffered,
            defer:       false
        )
        // Desktop window level + 1: renders directly above the JARVIS wallpaper
        // but BELOW every normal app window (level 0+). The panel is visually
        // part of the main animation and can never overlap other windows.
        panel.level              = NSWindow.Level(Int(CGWindowLevelForKey(.desktopWindow)) + 1)
        panel.backgroundColor    = .clear
        panel.isOpaque           = false
        panel.hasShadow          = false
        panel.ignoresMouseEvents = false
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        panel.isFloatingPanel    = true          // no key-window steal on click

        let config = WKWebViewConfiguration()
        let ucc    = WKUserContentController()
        ucc.add(self, name: "jarvisAction")
        config.userContentController = ucc
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        let wv = WKWebView(frame: NSRect(origin: .zero, size: panelRect.size),
                           configuration: config)
        wv.autoresizingMask = [.width, .height]
        wv.setValue(false, forKey: "drawsBackground")
        wv.loadHTMLString(triggerSidePanelHTML(), baseURL: nil)

        panel.contentView = wv
        panel.orderFront(nil)                    // don't makeKey — don't steal focus
        sidePanelWindow  = panel
        sidePanelWebView = wv
        NSLog("[AppDelegate] trigger side panel %.0fx%.0f at x=%.0f (bottom-right only)",
              panelW, panelH, panelRect.minX)
    }

    // swiftlint:disable function_body_length
    private func triggerSidePanelHTML() -> String {
        """
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        <style>
          *{margin:0;padding:0;box-sizing:border-box;}
          html,body{
            width:100%;height:100%;
            background:rgba(2,5,15,0.96);
            overflow:hidden;
            -webkit-user-select:none;user-select:none;
            border-left:1px solid rgba(26,230,245,0.20);
          }
          #panel{
            display:flex;flex-direction:column;
            height:100%;padding:14px 10px 10px;gap:5px;
            overflow-y:auto;overflow-x:hidden;
          }
          #panel::-webkit-scrollbar{width:3px;}
          #panel::-webkit-scrollbar-track{background:transparent;}
          #panel::-webkit-scrollbar-thumb{background:rgba(26,230,245,0.20);border-radius:2px;}
          .logo{
            font-family:'Courier New',monospace;
            font-size:11px;letter-spacing:4px;
            color:#1AE6F5;text-align:center;padding-bottom:2px;
          }
          .sub{
            font-family:'Courier New',monospace;
            font-size:6.5px;letter-spacing:2.5px;
            color:rgba(26,230,245,0.38);text-align:center;
            text-transform:uppercase;margin-bottom:2px;
          }
          .status-row{
            display:flex;align-items:center;justify-content:center;
            gap:6px;margin-bottom:3px;
          }
          .dot{
            width:6px;height:6px;border-radius:50%;
            background:#1AE6F5;box-shadow:0 0 6px #1AE6F5;
            animation:dp 2s ease-in-out infinite;
          }
          .dot.sim{background:#668494;box-shadow:0 0 4px #668494;animation:none;}
          @keyframes dp{0%,100%{opacity:0.4;}50%{opacity:1;}}
          .stxt{
            font-family:'Courier New',monospace;
            font-size:7px;letter-spacing:2px;
            color:rgba(26,230,245,0.55);
          }
          .div{height:1px;background:rgba(26,230,245,0.11);margin:1px 0;}
          .sec{
            font-family:'Courier New',monospace;
            font-size:6.5px;letter-spacing:2px;
            color:rgba(26,230,245,0.28);text-transform:uppercase;
            padding:3px 0 2px;
          }
          button{
            width:100%;
            background:rgba(26,230,245,0.06);
            border:1px solid rgba(26,230,245,0.20);
            color:rgba(26,230,245,0.72);
            font-family:'Courier New',monospace;
            font-size:8.5px;letter-spacing:1.4px;
            padding:7px 8px;border-radius:2px;
            cursor:pointer;text-transform:uppercase;
            text-align:left;display:flex;align-items:center;gap:7px;
            position:relative;overflow:hidden;transition:all 0.15s;
          }
          button:hover{
            background:rgba(26,230,245,0.14);
            border-color:rgba(26,230,245,0.55);
            color:#1AE6F5;box-shadow:0 0 8px rgba(26,230,245,0.15);
          }
          button.amber{
            border-color:rgba(255,200,0,0.20);
            color:rgba(255,200,0,0.72);background:rgba(255,200,0,0.06);
          }
          button.amber:hover{
            background:rgba(255,200,0,0.14);
            border-color:rgba(255,200,0,0.55);color:#FFC800;
          }
          button.crimson{
            border-color:rgba(255,38,51,0.20);
            color:rgba(255,38,51,0.72);background:rgba(255,38,51,0.06);
          }
          button.crimson:hover{
            background:rgba(255,38,51,0.14);
            border-color:rgba(255,38,51,0.55);color:#FF2633;
          }
          button.active{animation:bl 0.65s ease-in-out infinite alternate;}
          @keyframes bl{from{opacity:0.60;}to{opacity:1;}}
          button.active::after{
            content:'';position:absolute;bottom:0;left:0;
            height:2px;width:100%;background:currentColor;
            transform-origin:left;animation:cd 4s linear forwards;
          }
          @keyframes cd{from{transform:scaleX(1);}to{transform:scaleX(0);}}
          .ico{font-size:10px;flex-shrink:0;}
          .lbl{flex:1;}
        </style>
        </head>
        <body>
        <div id="panel">
          <div class="logo">⚡ JARVIS</div>
          <div class="sub">REACTIVE TRIGGERS</div>
          <div class="status-row">
            <div id="dot" class="dot sim"></div>
            <span id="stxt" class="stxt">SIM</span>
          </div>
          <div class="div"></div>

          <div class="sec">[ system animation demos ]</div>
          <button id="b-cpu"     class="amber"
            onclick="trig('cpu')"><span class="ico">▲</span><span class="lbl">CPU SPIKE</span></button>
          <button id="b-gpu"     class="amber"
            onclick="trig('gpu')"><span class="ico">▲</span><span class="lbl">GPU SURGE</span></button>
          <button id="b-thermal" class="crimson"
            onclick="trig('thermal')"><span class="ico">🌡</span><span class="lbl">THERMAL</span></button>
          <button id="b-power"
            onclick="trig('power')"><span class="ico">⚡</span><span class="lbl">POWER SURGE</span></button>
          <button id="b-charge"
            onclick="trig('charge')"><span class="ico">🔋</span><span class="lbl">CHARGE SURGE</span></button>
          <button id="b-memory"  class="amber"
            onclick="trig('memory')"><span class="ico">▲</span><span class="lbl">MEM PRESSURE</span></button>
          <button id="b-network"
            onclick="trig('network')"><span class="ico">◈</span><span class="lbl">NET BURST</span></button>
          <button id="b-disk"
            onclick="trig('disk')"><span class="ico">◉</span><span class="lbl">DISK I/O</span></button>

          <div class="div"></div>
          <div class="sec">[ phase transitions ]</div>
          <button id="b-boot"
            onclick="phase('booting')"><span class="ico">⚡</span><span class="lbl">BOOT</span></button>
          <button id="b-lock"
            onclick="phase('lock')"><span class="ico">🔒</span><span class="lbl">LOCK  (6s demo)</span></button>
          <button id="b-shut" class="crimson"
            onclick="phase('shutdown')"><span class="ico">💀</span><span class="lbl">SHUTDOWN (8s)</span></button>
        </div>
        <script>
        var _t={};
        function setLive(v){
          document.getElementById('dot').className='dot'+(v?'':' sim');
          document.getElementById('stxt').textContent=v?'LIVE':'SIM';
        }
        function trig(k){
          var b=document.getElementById('b-'+k);
          if(_t[k]){
            clearTimeout(_t[k]);delete _t[k];
            if(b)b.classList.remove('active');
            window.webkit.messageHandlers.jarvisAction.postMessage({action:'cancel',key:k});
            return;
          }
          window.webkit.messageHandlers.jarvisAction.postMessage({action:'trigger',key:k});
          if(b){
            b.classList.add('active');
            _t[k]=setTimeout(function(){b.classList.remove('active');delete _t[k];},4000);
          }
        }
        function phase(ph){
          window.webkit.messageHandlers.jarvisAction.postMessage({action:'phase',phase:ph});
          // Grey out phase buttons briefly while demo plays
          var dur=ph==='shutdown'?8500:ph==='lock'?6500:3000;
          var bids=['b-boot','b-lock','b-shut'];
          bids.forEach(function(id){
            var el=document.getElementById(id);
            if(el){el.disabled=true;el.style.opacity='0.35';}
          });
          setTimeout(function(){
            bids.forEach(function(id){
              var el=document.getElementById(id);
              if(el){el.disabled=false;el.style.opacity='';}
            });
          },dur);
        }
        </script>
        </body>
        </html>
        """
    }
    // swiftlint:enable function_body_length

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

        default:
            break
        }
    }
}

extension Notification.Name {
    static let jarvisShutdown = Notification.Name("jarvisShutdown")
}
