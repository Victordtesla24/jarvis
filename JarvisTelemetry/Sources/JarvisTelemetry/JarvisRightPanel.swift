// File: Sources/JarvisTelemetry/JarvisRightPanel.swift
// RIGHT-side panel overlay — Iron Man JARVIS HUD style
// GAP-04: Redesigned with left cyan border, dark bg, dot rows, sharp corners
// Folder shortcuts, arc reactor mini-widget, app shortcuts, system name, weather

import SwiftUI
import Foundation
import AppKit

// MARK: - GAP-04 Panel Container (Right) ─────────────────────────────────────

private struct HUDPanelRight<Content: View>: View {
    let cyan: Color
    let panelBg: Color
    let title: String
    let content: Content

    init(cyan: Color, panelBg: Color, title: String, @ViewBuilder content: () -> Content) {
        self.cyan = cyan
        self.panelBg = panelBg
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 9, design: .monospaced).bold())
                .tracking(2)
                .foregroundColor(cyan)

            content
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(panelBg.opacity(0.85))
        )
        .overlay(
            HStack {
                Rectangle()
                    .fill(cyan)
                    .frame(width: 3)
                Spacer()
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

private struct PanelDotRow: View {
    let text: String
    let cyan: Color

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(cyan)
                .frame(width: 4, height: 4)
            Text(text)
                .font(.system(size: 8, design: .monospaced))
                .foregroundColor(cyan.opacity(0.8))
        }
    }
}

// MARK: - JarvisRightPanel ───────────────────────────────────────────────────

struct JarvisRightPanel: View {
    @EnvironmentObject var store: TelemetryStore
    @Environment(\.animationPhase) var phase: Double

    private let cyan      = Color(red: 0.00, green: 0.83, blue: 1.00)
    private let panelBg   = Color(red: 0.004, green: 0.059, blue: 0.118)

    var body: some View {
        HStack {
            Spacer()

            VStack(spacing: 20) {
                Spacer()

                DirectoriesWidget(cyan: cyan, panelBg: panelBg)
                ArcReactorMiniWidget(phase: phase, cyan: cyan, panelBg: panelBg)
                AppShortcutsWidget(cyan: cyan, panelBg: panelBg)
                SystemNameWidget(cyan: cyan)
                WeatherWidget(phase: phase, cyan: cyan, panelBg: panelBg)

                Spacer()
            }
            .frame(width: 320)
            .padding(24)
        }
        .allowsHitTesting(true)
    }
}

// MARK: - A. Directories Widget ──────────────────────────────────────────────

private struct DirectoriesWidget: View {
    let cyan: Color
    let panelBg: Color

    private struct FolderEntry {
        let name: String
        let dir: FileManager.SearchPathDirectory
    }

    private let folders: [FolderEntry] = [
        FolderEntry(name: "Documents", dir: .documentDirectory),
        FolderEntry(name: "Downloads", dir: .downloadsDirectory),
        FolderEntry(name: "Images",    dir: .picturesDirectory),
        FolderEntry(name: "Music",     dir: .musicDirectory),
        FolderEntry(name: "Videos",    dir: .moviesDirectory),
    ]

    var body: some View {
        HUDPanelRight(cyan: cyan, panelBg: panelBg, title: "DIRECTORIES") {
            ForEach(folders, id: \.name) { entry in
                HStack(spacing: 6) {
                    Circle()
                        .fill(cyan)
                        .frame(width: 4, height: 4)
                    Text(entry.name)
                        .font(.system(size: 8, design: .monospaced))
                        .foregroundColor(cyan.opacity(0.8))
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    if let url = FileManager.default.urls(for: entry.dir, in: .userDomainMask).first {
                        NSWorkspace.shared.open(url)
                    }
                }
            }
        }
    }
}

// MARK: - B. Arc Reactor Mini-Widget ─────────────────────────────────────────

private struct ArcReactorMiniWidget: View {
    let phase: Double
    let cyan: Color
    let panelBg: Color

    var body: some View {
        ZStack {
            // Background radial gradient — white core to gray edge (3D orb)
            Circle()
                .fill(
                    RadialGradient(
                        gradient: Gradient(colors: [
                            Color.white.opacity(0.30),
                            Color(red: 0.25, green: 0.32, blue: 0.38).opacity(0.65),
                            Color(red: 0.12, green: 0.16, blue: 0.20).opacity(0.30)
                        ]),
                        center: .center,
                        startRadius: 2,
                        endRadius: 40
                    )
                )
                .frame(width: 80, height: 80)

            // 8 segmented arc notches
            ForEach(0..<8, id: \.self) { i in
                let startFraction = Double(i) / 8.0
                Circle()
                    .trim(from: startFraction + 0.01, to: startFraction + 0.08)
                    .stroke(Color.white.opacity(0.85), style: StrokeStyle(lineWidth: 3, lineCap: .butt))
                    .frame(width: 62, height: 62)
            }

            // Inner glow ring
            Circle()
                .stroke(cyan.opacity(0.35 + sin(phase * 1.5) * 0.10), lineWidth: 1.0)
                .frame(width: 50, height: 50)

            // Core bright dot
            Circle()
                .fill(Color.white.opacity(0.65 + sin(phase * 2.0) * 0.15))
                .frame(width: 8, height: 8)
                .shadow(color: Color.white.opacity(0.5), radius: 4)

            // Outer cyan border ring
            Circle()
                .stroke(cyan.opacity(0.75), lineWidth: 1.5)
                .frame(width: 78, height: 78)
        }
        .frame(width: 80, height: 80)
        .shadow(color: cyan.opacity(0.3), radius: 8)
    }
}

// MARK: - C. App Shortcuts Widget ────────────────────────────────────────────

private struct AppShortcutsWidget: View {
    let cyan: Color
    let panelBg: Color

    private struct AppLink {
        let name: String
        let urlString: String
    }

    private let appLinks: [AppLink] = [
        AppLink(name: "Gmail",      urlString: "https://mail.google.com"),
        AppLink(name: "Wikipedia",  urlString: "https://www.wikipedia.org"),
        AppLink(name: "LinkedIn",   urlString: "https://www.linkedin.com"),
        AppLink(name: "Twitter",    urlString: "https://x.com"),
        AppLink(name: "Youtube",    urlString: "https://www.youtube.com"),
        AppLink(name: "Photoshop",  urlString: "https://www.adobe.com/products/photoshop.html"),
        AppLink(name: "Word",       urlString: "https://www.office.com/launch/word"),
        AppLink(name: "Excel",      urlString: "https://www.office.com/launch/excel"),
    ]

    var body: some View {
        HUDPanelRight(cyan: cyan, panelBg: panelBg, title: "APP SHORTCUTS") {
            ForEach(appLinks, id: \.name) { app in
                HStack(spacing: 6) {
                    Circle()
                        .fill(cyan)
                        .frame(width: 4, height: 4)
                    Text(app.name)
                        .font(.system(size: 8, design: .monospaced))
                        .foregroundColor(cyan.opacity(0.8))
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    if let url = URL(string: app.urlString) {
                        NSWorkspace.shared.open(url)
                    }
                }
            }
        }
    }
}

// MARK: - D. System Name Widget ──────────────────────────────────────────────

private struct SystemNameWidget: View {
    let cyan: Color

    private var systemName: String {
        "\(NSUserName().uppercased())'S SYSTEM"
    }

    var body: some View {
        Text(systemName)
            .font(.system(size: 11, design: .monospaced))
            .tracking(4)
            .foregroundColor(cyan)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .shadow(color: cyan.opacity(0.5), radius: 4)
    }
}

// MARK: - E. Weather Widget ──────────────────────────────────────────────────

private struct WeatherWidget: View {
    let phase: Double
    let cyan: Color
    let panelBg: Color

    @State private var temperature: String = "--°C"
    @State private var condition: String   = "ACQUIRING..."

    var body: some View {
        HUDPanelRight(cyan: cyan, panelBg: panelBg, title: "ATMOSPHERIC ANALYSIS") {
            // Large temperature
            Text(temperature)
                .font(.system(size: 32, design: .monospaced).bold())
                .foregroundColor(cyan)
                .shadow(color: cyan.opacity(0.5), radius: 6)
                .shadow(color: cyan.opacity(0.15), radius: 16)

            // Condition
            Text(condition.uppercased())
                .font(.system(size: 8, design: .monospaced))
                .foregroundColor(cyan.opacity(0.7))
                .multilineTextAlignment(.center)

            // Decorative animated bars
            HStack(spacing: 2) {
                ForEach(0..<20, id: \.self) { i in
                    let barPhase = sin(phase * 1.2 + Double(i) * 0.3)
                    Rectangle()
                        .fill(cyan.opacity(0.15 + barPhase * 0.10))
                        .frame(width: 3, height: max(2, 2 + barPhase * 4))
                }
            }
            .frame(height: 10)
        }
        .task { await fetchWeather() }
        .onReceive(Timer.publish(every: 600, on: .main, in: .common).autoconnect()) { _ in
            Task { await fetchWeather() }
        }
    }

    @MainActor
    private func fetchWeather() async {
        guard let url = URL(string: "https://wttr.in/?format=%t+%C") else { return }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let raw = String(data: data, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !raw.isEmpty else { return }
            let parts = raw.components(separatedBy: " ")
            if let temp = parts.first, !temp.isEmpty {
                temperature = temp
                if parts.count > 1 {
                    condition = parts.dropFirst().joined(separator: " ")
                }
            }
        } catch {
            // Network unavailable — static fallback remains displayed
        }
    }
}
