// swift-tools-version: 5.9
// JarvisWallpaper — Cinema-grade live wallpaper for macOS
// Renders the JARVIS Cinematic Reactor Core via WKWebView at desktop window level

import PackageDescription

let package = Package(
    name: "JarvisWallpaper",
    platforms: [.macOS("14.0")],
    targets: [
        .executableTarget(
            name: "JarvisWallpaper",
            path: "Sources/JarvisWallpaper",
            resources: [
                .copy("Resources/jarvis-reactor.html")
            ],
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("SwiftUI"),
                .linkedFramework("WebKit")
            ]
        )
    ]
)
