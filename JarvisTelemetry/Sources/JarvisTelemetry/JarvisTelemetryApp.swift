// File: Sources/JarvisTelemetry/JarvisTelemetryApp.swift
import SwiftUI
import AppKit
import Foundation

@main
struct JarvisTelemetryApp: App {

    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        // Verification helpers — post the real distributed lock/unlock
        // notifications without needing to actually lock the screen.
        // These flags exit immediately after posting and never launch the
        // GUI, so they can be invoked from shell scripts while the
        // wallpaper app is already running in the user's session.
        let args = CommandLine.arguments
        if args.contains("--post-lock-signal") {
            DistributedNotificationCenter.default().postNotificationName(
                NSNotification.Name("com.apple.screenIsLocked"),
                object: nil,
                userInfo: nil,
                deliverImmediately: true
            )
            print("[JARVIS] posted com.apple.screenIsLocked")
            exit(0)
        }
        if args.contains("--post-unlock-signal") {
            DistributedNotificationCenter.default().postNotificationName(
                NSNotification.Name("com.apple.screenIsUnlocked"),
                object: nil,
                userInfo: nil,
                deliverImmediately: true
            )
            print("[JARVIS] posted com.apple.screenIsUnlocked")
            exit(0)
        }

        // R-51: --post-shutdown-signal mirrors the --post-lock-signal handler.
        // Posts com.jarvis.shutdown so the running instance can play its
        // HTML shutdown sequence without needing a real SIGTERM.
        if args.contains("--post-shutdown-signal") {
            DistributedNotificationCenter.default().postNotificationName(
                NSNotification.Name("com.jarvis.shutdown"),
                object: nil,
                userInfo: nil,
                deliverImmediately: true
            )
            print("[JARVIS] posted com.jarvis.shutdown")
            exit(0)
        }

        // R-52: --toggle-panel posts com.jarvis.hud.togglePanel. Observed by
        // AppDelegate.installTriggerObservers() in any build.
        if args.contains("--toggle-panel") {
            DistributedNotificationCenter.default().postNotificationName(
                NSNotification.Name("com.jarvis.hud.togglePanel"),
                object: nil,
                userInfo: nil,
                deliverImmediately: true
            )
            print("[JARVIS] posted com.jarvis.hud.togglePanel")
            exit(0)
        }

        // --trigger KEY : posts a distributed notification that the running
        // JARVIS instance listens for, firing the reactive recipe and
        // saving a snapshot to /tmp/jarvis-trigger-<KEY>.png. Used by the
        // reactive-animation verification harness to prove that every
        // RECIPE actually changes the rendered canvas.
        if let idx = args.firstIndex(of: "--trigger"), idx + 1 < args.count {
            let key = args[idx + 1]
            let allowed = ["cpu","gpu","thermal","power","charge","memory","network","disk","nominal"]
            guard allowed.contains(key) else {
                print("[JARVIS] --trigger: unknown key '\(key)' — allowed: \(allowed)")
                exit(2)
            }
            DistributedNotificationCenter.default().postNotificationName(
                NSNotification.Name("com.jarvis.test.trigger"),
                object: nil,
                userInfo: ["key": key],
                deliverImmediately: true
            )
            print("[JARVIS] posted com.jarvis.test.trigger key=\(key)")
            exit(0)
        }

        // --snapshot-now : posts a distributed notification that tells the
        // running JARVIS to snapshot the primary WKWebView right now and
        // save to /tmp/jarvis-snapshot.png (regardless of lock state).
        if args.contains("--snapshot-now") {
            DistributedNotificationCenter.default().postNotificationName(
                NSNotification.Name("com.jarvis.test.snapshot"),
                object: nil,
                userInfo: nil,
                deliverImmediately: true
            )
            print("[JARVIS] posted com.jarvis.test.snapshot")
            exit(0)
        }
    }

    var body: some Scene {
        // No default window — AppDelegate owns the wallpaper NSWindow.
        Settings { EmptyView() }
    }
}
