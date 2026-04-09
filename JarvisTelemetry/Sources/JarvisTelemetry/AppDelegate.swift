// File: Sources/JarvisTelemetry/AppDelegate.swift
import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {

    private var wallpaperWindows: [NSWindow] = []
    private let bridge = TelemetryBridge()

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory) // No Dock icon

        setupWallpaperWindows()
        bridge.start()
    }

    func applicationWillTerminate(_ notification: Notification) {
        bridge.stop()
    }

    // MARK: - Wallpaper Window Construction

    private func setupWallpaperWindows() {
        // Remove existing wallpaper windows
        for win in wallpaperWindows {
            win.orderOut(nil)
        }
        wallpaperWindows.removeAll()

        // Enumerate all active screens and create one wallpaper window per screen
        for screen in NSScreen.screens {
            let win = buildWallpaperWindow(for: screen)
            win.makeKeyAndOrderFront(nil)
            wallpaperWindows.append(win)
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
        return win
    }

    @objc private func screensDidChange() {
        // Re-create windows for newly connected screens
        setupWallpaperWindows()
    }
}
