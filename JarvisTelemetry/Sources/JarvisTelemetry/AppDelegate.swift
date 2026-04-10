// File: Sources/JarvisTelemetry/AppDelegate.swift

import AppKit
import SwiftUI
import CoreImage

final class AppDelegate: NSObject, NSApplicationDelegate {

    private var wallpaperWindows: [NSWindow] = []
    private let bridge = TelemetryBridge()
    private let phaseController = HUDPhaseController()
    private var lifecycleObserver: ProcessLifecycleObserver?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)

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

        // ── GAP-15: Global Bloom Shader ─────────────────────────────────
        // CIBloom post-processing pass makes every cyan element glow simultaneously
        if let bloomFilter = CIFilter(name: "CIBloom", parameters: [
            kCIInputRadiusKey: 8.0,
            kCIInputIntensityKey: 0.85
        ]) {
            hostingView.layer?.filters = [bloomFilter]
        }

        win.contentView = hostingView
        return win
    }

    @objc private func screensDidChange() {
        setupWallpaperWindows()
    }
}
