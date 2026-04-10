// swift-tools-version: 5.9
// SMC sensor reading is handled via native IOKit framework (built-in macOS)
// SMCKit (beltex) is Intel-only and has no Package.swift — not compatible with M-series / SPM

import PackageDescription

let package = Package(
    name: "JarvisTelemetry",
    platforms: [.macOS(.v14)],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "JarvisTelemetry",
            dependencies: [],
            path: "Sources/JarvisTelemetry",
            resources: [
                // Bundle the compiled Go daemon inside the app
                .copy("Resources/jarvis-mactop-daemon")
            ],
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("SwiftUI"),
                .linkedFramework("SceneKit"),
                .linkedFramework("CoreGraphics"),
                .linkedFramework("Combine"),
                .linkedFramework("Metal"),
                .linkedFramework("MetalKit"),
                .linkedFramework("IOKit")
            ]
        )
    ]
)
