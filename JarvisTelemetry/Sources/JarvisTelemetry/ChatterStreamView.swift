// File: Sources/JarvisTelemetry/ChatterStreamView.swift

import SwiftUI

enum ChatterAlignment {
    case left, right
}

struct ChatterStreamView: View {
    @ObservedObject var engine: ChatterEngine
    let alignment: ChatterAlignment
    let phase: Double

    private var lines: [ChatterLine] {
        alignment == .left ? engine.primaryLines : engine.secondaryLines
    }

    var body: some View {
        VStack(alignment: alignment == .left ? .leading : .trailing, spacing: 3) {
            ForEach(Array(lines.suffix(12).enumerated()), id: \.element.id) { _, line in
                let age = Date().timeIntervalSince(line.timestamp)
                let fadeIn = min(1.0, age * 3)
                let fadeOut = age > 10 ? max(0, 1.0 - (age - 10) / 3) : 1.0
                let baseOpacity = alignment == .left ? 0.75 : 0.5
                let opacity = fadeIn * fadeOut * baseOpacity
                let charsToShow = age < 1.0 ? min(line.text.count, Int(age * 67)) : line.text.count

                Text(String(line.text.prefix(charsToShow)))
                    .font(.custom("Menlo", size: alignment == .left ? 9 : 8))
                    .tracking(alignment == .left ? 1 : 2)
                    .foregroundColor(line.color.opacity(opacity))
                    .shadow(color: line.color.opacity(opacity * 0.3), radius: 3)
                    .lineLimit(1)
            }
        }
    }
}
