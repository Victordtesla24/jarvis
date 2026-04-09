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
