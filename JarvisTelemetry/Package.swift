// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "JarvisTelemetry",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(url: "https://github.com/beltex/SMCKit.git", from: "0.3.0")
    ],
    targets: [
        .executableTarget(
            name: "JarvisTelemetry",
            dependencies: [
                .product(name: "SMCKit", package: "SMCKit")
            ],
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
                .linkedFramework("MetalKit")
            ]
        )
    ]
)
