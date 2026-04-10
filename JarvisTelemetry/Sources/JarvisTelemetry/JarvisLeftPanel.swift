// File: Sources/JarvisTelemetry/JarvisLeftPanel.swift
// Left-side HUD panel overlay — clock ring, storage, power arc gauge, comm radar
// GAP-04: Redesigned panels with left cyan border, dark bg, dot rows
// GAP-05: Circular ring date/clock widget
// GAP-06: Circular arc power gauge
// GAP-07: Communication radar with sweep animation

import SwiftUI
import Foundation

// MARK: - Left Panel ──────────────────────────────────────────────────────────

struct JarvisLeftPanel: View {

    @EnvironmentObject var store: TelemetryStore
    @Environment(\.animationPhase) var phase: Double

    private let cyan      = Color(red: 0.00, green: 0.83, blue: 1.00)   // #00D4FF
    private let panelBg   = Color(red: 0.004, green: 0.059, blue: 0.118) // #010F1E

    var body: some View {
        HStack {
            VStack(spacing: 14) {
                ClockRingWidget(cyan: cyan, panelBg: panelBg)
                StorageWidget(cyan: cyan, panelBg: panelBg)
                PowerArcGauge(cyan: cyan, panelBg: panelBg)
                    .environmentObject(store)
                RadarWidget(cyan: cyan, panelBg: panelBg, phase: phase)
            }
            .frame(width: 220)
            .padding(20)

            Spacer()
        }
        .allowsHitTesting(false)
    }
}

// MARK: - GAP-04 Panel Container ─────────────────────────────────────────────

private struct HUDPanel<Content: View>: View {
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
            // Title: SF Mono Bold 9pt, #00D4FF, ALL CAPS, tracking 2pt
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
            // Left border: 3pt solid cyan
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

// MARK: - GAP-04 Data Row ────────────────────────────────────────────────────

private struct PanelDataRow: View {
    let text: String
    let cyan: Color

    var body: some View {
        HStack(spacing: 6) {
            // Leading cyan dot (Circle 4pt, fill #00D4FF)
            Circle()
                .fill(cyan)
                .frame(width: 4, height: 4)

            // Data: SF Mono Regular 8pt, #00D4FF.opacity(0.8)
            Text(text)
                .font(.system(size: 8, design: .monospaced))
                .foregroundColor(cyan.opacity(0.8))
        }
    }
}

// MARK: - GAP-05: Clock Ring Widget ──────────────────────────────────────────

private struct ClockRingWidget: View {
    let cyan: Color
    let panelBg: Color

    private static let dayFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "d"; return f
    }()
    private static let monthFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "MMMM"; return f
    }()
    private static let weekdayFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "EEEE"; return f
    }()
    private static let timeFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "HH:mm:ss"; return f
    }()

    var body: some View {
        HUDPanel(cyan: cyan, panelBg: panelBg, title: "DATE / TIME") {
            TimelineView(.periodic(from: .now, by: 1.0)) { timeline in
                let now = timeline.date
                HStack(spacing: 12) {
                    // Circular ring widget wrapping date
                    ZStack {
                        // Outer ring: Circle stroke #00D4FF, lineWidth 2pt, ~140pt diameter (scaled)
                        Circle()
                            .stroke(cyan, lineWidth: 2)
                            .frame(width: 90, height: 90)

                        // Inner decorative arc at 85% diameter
                        Circle()
                            .trim(from: 0.1, to: 0.9)
                            .stroke(cyan.opacity(0.4), lineWidth: 1)
                            .frame(width: 76, height: 76)

                        VStack(spacing: 2) {
                            // Large day number: SF Mono Bold 48pt → scaled to 32pt for panel
                            Text(ClockRingWidget.dayFmt.string(from: now))
                                .font(.system(size: 32, design: .monospaced).bold())
                                .foregroundColor(cyan)

                            // Month text: SF Mono Medium 14pt → 10pt
                            Text(ClockRingWidget.monthFmt.string(from: now).uppercased())
                                .font(.system(size: 8, design: .monospaced).weight(.medium))
                                .tracking(3)
                                .foregroundColor(cyan)
                                .lineLimit(1)
                                .minimumScaleFactor(0.6)
                        }
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        // Day name: SF Mono Light 10pt
                        Text(ClockRingWidget.weekdayFmt.string(from: now).uppercased())
                            .font(.system(size: 9, design: .monospaced).weight(.light))
                            .foregroundColor(cyan.opacity(0.7))

                        // Digital time
                        Text(ClockRingWidget.timeFmt.string(from: now))
                            .font(.system(size: 18, design: .monospaced))
                            .foregroundColor(cyan)
                            .shadow(color: cyan.opacity(0.5), radius: 4)
                    }
                }
            }
        }
    }
}

// MARK: - Storage Widget ─────────────────────────────────────────────────────

private struct StorageWidget: View {
    let cyan: Color
    let panelBg: Color

    private var diskInfo: (totalGB: Double, freeGB: Double) {
        let home = FileManager.default.homeDirectoryForCurrentUser
        guard let attrs = try? FileManager.default.attributesOfFileSystem(forPath: home.path) else {
            return (0, 0)
        }
        let total = (attrs[.systemSize] as? Int64 ?? 0)
        let free  = (attrs[.systemFreeSize] as? Int64 ?? 0)
        return (Double(total) / 1_073_741_824, Double(free) / 1_073_741_824)
    }

    var body: some View {
        let info = diskInfo
        let usedFraction = info.totalGB > 0
            ? (info.totalGB - info.freeGB) / info.totalGB
            : 0

        HUDPanel(cyan: cyan, panelBg: panelBg, title: "PRIMARY STORAGE") {
            PanelDataRow(text: "Full Capacity: \(Int(info.totalGB)) G", cyan: cyan)
            PanelDataRow(text: "Free Capacity: \(Int(info.freeGB)) G", cyan: cyan)

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(panelBg)
                        .frame(height: 6)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(cyan)
                        .frame(width: geo.size.width * min(usedFraction, 1.0), height: 6)
                }
            }
            .frame(height: 6)
        }
    }
}

// MARK: - GAP-06: Power Arc Gauge ────────────────────────────────────────────

private struct PowerArcGauge: View {
    @EnvironmentObject var store: TelemetryStore

    let cyan: Color
    let panelBg: Color

    // Map total power to a percentage (0-100 scale, 60W = full)
    private var powerPercent: Double {
        min(store.totalPower / 60.0, 1.0) * 100
    }

    private var gaugeColor: Color {
        let pct = powerPercent
        if pct > 20 { return cyan }             // #00D4FF > 20%
        if pct > 10 { return Color(red: 1.0, green: 0.584, blue: 0.0) }  // #FF9500
        return Color(red: 1.0, green: 0.231, blue: 0.188)  // #FF3B30
    }

    private var statusLabel: String {
        let pct = powerPercent
        if pct > 50 { return "HIGH" }
        if pct > 20 { return "NOMINAL" }
        if pct > 10 { return "LOW" }
        return "CRITICAL"
    }

    var body: some View {
        HUDPanel(cyan: cyan, panelBg: panelBg, title: "POWER OUTPUT") {
            ZStack {
                // Arc gauge: startAngle -220°, endAngle +40° (260° sweep)
                // Track
                Circle()
                    .trim(from: 0, to: 260.0 / 360.0)
                    .stroke(panelBg.opacity(0.8), style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(140))  // start at -220° → 140° in SwiftUI coords
                    .frame(width: 80, height: 80)

                // Bloom behind fill
                Circle()
                    .trim(from: 0, to: (260.0 / 360.0) * (powerPercent / 100.0))
                    .stroke(gaugeColor.opacity(0.15), style: StrokeStyle(lineWidth: 14, lineCap: .round))
                    .rotationEffect(.degrees(140))
                    .frame(width: 80, height: 80)

                // Fill arc
                Circle()
                    .trim(from: 0, to: (260.0 / 360.0) * (powerPercent / 100.0))
                    .stroke(gaugeColor, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(140))
                    .frame(width: 80, height: 80)

                // Centre text: percentage, SF Mono Bold 16pt
                VStack(spacing: 1) {
                    Text("\(Int(powerPercent))%")
                        .font(.system(size: 16, design: .monospaced).bold())
                        .foregroundColor(gaugeColor)

                    // Subtitle: "Power HIGH/LOW/CRITICAL" SF Mono 8pt
                    Text("Power \(statusLabel)")
                        .font(.system(size: 8, design: .monospaced))
                        .foregroundColor(gaugeColor.opacity(0.7))
                }
            }
            .frame(height: 90)
        }
    }
}

// MARK: - GAP-07: Communication Radar Widget ─────────────────────────────────

private struct RadarWidget: View {
    let cyan: Color
    let panelBg: Color
    let phase: Double

    private var hostName: String {
        ProcessInfo.processInfo.hostName
    }

    // Get active network interface name
    private var networkInterface: String {
        // Simple detection — just use hostname for now
        "en0"
    }

    var body: some View {
        HUDPanel(cyan: cyan, panelBg: panelBg, title: "COMMUNICATION") {
            VStack(spacing: 6) {
                // Circular radar widget, diameter 80pt
                ZStack {
                    // 4 range rings at 25%, 50%, 75%, 100% radius
                    ForEach([0.25, 0.50, 0.75, 1.00], id: \.self) { frac in
                        Circle()
                            .stroke(cyan.opacity(0.2), lineWidth: 0.5)
                            .frame(width: 80 * frac, height: 80 * frac)
                    }

                    // Crosshairs
                    Path { p in
                        p.move(to: CGPoint(x: 0, y: 40))
                        p.addLine(to: CGPoint(x: 80, y: 40))
                    }
                    .stroke(cyan.opacity(0.1), lineWidth: 0.5)
                    .frame(width: 80, height: 80)

                    Path { p in
                        p.move(to: CGPoint(x: 40, y: 0))
                        p.addLine(to: CGPoint(x: 40, y: 80))
                    }
                    .stroke(cyan.opacity(0.1), lineWidth: 0.5)
                    .frame(width: 80, height: 80)

                    // Rotating sweep line: gradient #00D4FF.opacity(0.8)→transparent
                    // 4s rotation period
                    let sweepAngle = phase.truncatingRemainder(dividingBy: 4.0) / 4.0 * 360.0
                    Path { p in
                        p.move(to: CGPoint(x: 40, y: 40))
                        let rad = sweepAngle * Double.pi / 180.0
                        p.addLine(to: CGPoint(x: 40 + cos(rad) * 40, y: 40 + sin(rad) * 40))
                    }
                    .stroke(
                        LinearGradient(colors: [cyan.opacity(0.8), Color.clear],
                                       startPoint: .init(x: 0.5, y: 0.5),
                                       endPoint: .init(x: 1.0, y: 0.0)),
                        lineWidth: 1
                    )
                    .frame(width: 80, height: 80)

                    // Sweep trail (fading wedge)
                    ForEach(1..<8, id: \.self) { trail in
                        let trailAngle = (sweepAngle - Double(trail) * 5.0) * Double.pi / 180.0
                        let trailOp = (1.0 - Double(trail) / 8.0) * 0.15
                        Path { p in
                            p.move(to: CGPoint(x: 40, y: 40))
                            p.addLine(to: CGPoint(x: 40 + cos(trailAngle) * 38,
                                                  y: 40 + sin(trailAngle) * 38))
                        }
                        .stroke(cyan.opacity(trailOp), lineWidth: 0.5)
                        .frame(width: 80, height: 80)
                    }

                    // Center dot
                    Circle()
                        .fill(cyan.opacity(0.5))
                        .frame(width: 3, height: 3)
                }
                .frame(width: 80, height: 80)

                // Active network interface name, SF Mono 7pt
                Text(hostName)
                    .font(.system(size: 7, design: .monospaced))
                    .foregroundColor(cyan.opacity(0.6))
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
        }
    }
}
