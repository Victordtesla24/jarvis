// JarvisWallpaper — Cinema-grade JARVIS Reactor Core as macOS live wallpaper
// Architecture: WKWebView rendering the HTML5 Canvas animation at desktop window level
// One borderless, transparent, click-through window per screen

import AppKit
import WebKit
import Foundation

// ── App Delegate ─────────────────────────────────────────────────────────────

class AppDelegate: NSObject, NSApplicationDelegate {

    private var wallpaperWindows: [NSWindow] = []
    private var wallpaperWebViews: [WKWebView] = []
    private let lockScreenManager = LockScreenManager()

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)  // No Dock icon, no menu bar app

        setupWallpaperWindows()
        lockScreenManager.primaryWebView = wallpaperWebViews.first
        lockScreenManager.start()

        // Test harness: --test-lock simulates a lock event 3s after launch,
        // then unlocks after 5s, then terminates. Used for SC-4.1 validation.
        if CommandLine.arguments.contains("--test-lock") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
                self?.lockScreenManager.simulateLock()
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 6.0) { [weak self] in
                self?.lockScreenManager.simulateUnlock()
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) {
                NSApp.terminate(nil)
            }
        }

        // Re-setup when screens change (plug/unplug monitors)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screensDidChange),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )

        // Graceful shutdown on SIGTERM/SIGINT
        for sig: Int32 in [SIGTERM, SIGINT] {
            signal(sig, SIG_IGN)
            let src = DispatchSource.makeSignalSource(signal: sig, queue: .main)
            src.setEventHandler { NSApp.terminate(nil) }
            src.resume()
            // prevent dealloc
            objc_setAssociatedObject(self, "\(sig)", src, .OBJC_ASSOCIATION_RETAIN)
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        for win in wallpaperWindows { win.orderOut(nil) }
    }

    // MARK: - Window Construction

    private func setupWallpaperWindows() {
        for win in wallpaperWindows { win.orderOut(nil) }
        wallpaperWindows.removeAll()
        wallpaperWebViews.removeAll()

        for screen in NSScreen.screens {
            let (win, webView) = buildWindow(for: screen)
            win.orderFront(nil)
            wallpaperWindows.append(win)
            wallpaperWebViews.append(webView)
        }
    }

    private func buildWindow(for screen: NSScreen) -> (NSWindow, WKWebView) {
        let win = NSWindow(
            contentRect:  screen.frame,
            styleMask:    .borderless,
            backing:      .buffered,
            defer:        false,
            screen:       screen
        )

        // Desktop level — sits behind all normal windows, on top of actual wallpaper
        win.level = NSWindow.Level(Int(CGWindowLevelForKey(.desktopWindow)))
        win.backgroundColor     = .black
        win.isOpaque            = true
        win.hasShadow           = false
        win.ignoresMouseEvents  = true
        win.collectionBehavior  = [.canJoinAllSpaces, .stationary, .ignoresCycle]

        // Build the WKWebView
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.suppressesIncrementalRendering = true

        // Enable hardware-accelerated compositing and disable scrolling
        let webView = WKWebView(frame: screen.frame, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")  // Transparent background
        webView.allowsMagnification = false

        // Disable scroll bounce / overscroll
        if let scrollView = webView.enclosingScrollView ?? webView.subviews.first(where: { $0 is NSScrollView }) as? NSScrollView {
            scrollView.hasVerticalScroller = false
            scrollView.hasHorizontalScroller = false
            scrollView.verticalScrollElasticity = .none
            scrollView.horizontalScrollElasticity = .none
        }

        // Load the bundled HTML
        if let htmlURL = Bundle.module.url(forResource: "jarvis-reactor", withExtension: "html", subdirectory: "Resources") {
            webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        } else {
            // Fallback: try loading from the same directory as the executable
            let execDir = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent()
            let candidates = [
                execDir.appendingPathComponent("JarvisWallpaper_JarvisWallpaper.bundle/Contents/Resources/Resources/jarvis-reactor.html"),
                execDir.appendingPathComponent("jarvis-reactor.html"),
                URL(fileURLWithPath: "/Users/vic/claude/General-Work/jarvis/jarvis-build/jarvis-full-animation.html")
            ]
            for candidate in candidates {
                if FileManager.default.fileExists(atPath: candidate.path) {
                    webView.loadFileURL(candidate, allowingReadAccessTo: candidate.deletingLastPathComponent())
                    break
                }
            }
        }

        win.contentView = webView
        return (win, webView)
    }

    @objc private func screensDidChange() {
        setupWallpaperWindows()
    }
}

// ── Launch ───────────────────────────────────────────────────────────────────

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
