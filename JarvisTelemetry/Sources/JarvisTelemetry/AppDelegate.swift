// File: Sources/JarvisTelemetry/AppDelegate.swift
// JARVIS wallpaper window lifecycle — manages wallpaper-level windows,
// telemetry bridge, battery monitor, reactor animation controller,
// and CIBloom post-processing.

import AppKit
import SwiftUI
import CoreImage
import Darwin

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {

    private var wallpaperWindows: [NSWindow] = []
    private let bridge = TelemetryBridge()
    private let phaseController = HUDPhaseController()
    private let reactorController = ReactorAnimationController()
    private let batteryMonitor = BatteryMonitor()
    private var lifecycleObserver: ProcessLifecycleObserver?
    private var sigtermSource: DispatchSourceSignal?
    private var sigintSource: DispatchSourceSignal?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory) // No Dock icon

        installSignalHandlers()

        lifecycleObserver = ProcessLifecycleObserver(
            phaseController: phaseController,
            bridge: bridge
        )

        setupWallpaperWindows()
        bridge.start()
    }

    // MARK: - Signal Handling
    //
    // Route SIGTERM/SIGINT through NSApp.terminate so applicationWillTerminate
    // actually runs (stopping the daemon bridge and the battery monitor) and
    // the process exits cleanly without needing SIGKILL. Without this the
    // default signal action kills the process before any teardown happens.

    private func installSignalHandlers() {
        sigtermSource = makeSignalSource(SIGTERM)
        sigintSource  = makeSignalSource(SIGINT)
    }

    private func makeSignalSource(_ sig: Int32) -> DispatchSourceSignal {
        signal(sig, SIG_IGN) // Required so DispatchSource observes the signal.
        let src = DispatchSource.makeSignalSource(signal: sig, queue: .main)
        src.setEventHandler {
            NSApp.terminate(nil)
        }
        src.resume()
        return src
    }

    func applicationWillTerminate(_ notification: Notification) {
        batteryMonitor.stop()
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
            .environmentObject(reactorController)
            .environmentObject(batteryMonitor)
            .frame(maxWidth: .infinity, maxHeight: .infinity)

        let hostingView = NSHostingView(rootView: rootView)
        hostingView.frame = screen.frame
        hostingView.wantsLayer = true
        hostingView.layer?.backgroundColor = NSColor.clear.cgColor

        // ── Global Bloom Shader — CIBloom post-processing pass ──
        // Makes every cyan element glow simultaneously for volumetric feel
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
