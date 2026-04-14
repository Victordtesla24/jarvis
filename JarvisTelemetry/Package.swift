// swift-tools-version: 5.9
// JARVIS Telemetry — macOS cinematic HUD with live Apple Silicon telemetry
// Platform: macOS 15.0+ (Sequoia) · Apple Silicon only
// Telemetry: Go daemon (mactop) via JSON pipe + native IOKit battery polling
// Rendering: SwiftUI Canvas (60fps) + Metal shaders + CIBloom post-processing

import PackageDescription

let package = Package(
    name: "JarvisTelemetry",
    platforms: [.macOS("15.0")],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "JarvisTelemetry",
            dependencies: [],
            path: "Sources/JarvisTelemetry",
            exclude: [
                "Resources/LightningArcEmitter.sks",
                "Resources/bloom_fragment.metal"
            ],
            resources: [
                // Bundle the compiled Go daemon inside the app
                .copy("Resources/jarvis-mactop-daemon")
            ],
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("SwiftUI"),
                .linkedFramework("WebKit"),
                .linkedFramework("SceneKit"),
                .linkedFramework("CoreGraphics"),
                .linkedFramework("Combine"),
                .linkedFramework("Metal"),
                .linkedFramework("MetalKit"),
                .linkedFramework("IOKit"),
                .linkedFramework("AVFoundation"),
                .linkedFramework("CoreImage"),
                .linkedFramework("SpriteKit")
            ]
        ),
        .testTarget(
            name: "JarvisTelemetryTests",
            dependencies: ["JarvisTelemetry"],
            path: "Tests/JarvisTelemetryTests"
        )
    ]
)
