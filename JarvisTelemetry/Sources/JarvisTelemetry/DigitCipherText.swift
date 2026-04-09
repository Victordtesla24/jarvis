// File: Sources/JarvisTelemetry/DigitCipherText.swift

import SwiftUI

struct DigitCipherText: View {
    let value: String
    let font: Font
    let color: Color

    @State private var targetChars: [Character] = []
    @State private var settledIndices: Set<Int> = []
    @State private var flipStartTime: Date?

    private let flipDuration: Double = 0.3
    private let staggerDelay: Double = 0.03
    private let hexChars: [Character] = Array("0123456789ABCDEF")

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0/30.0)) { timeline in
            HStack(spacing: 0) {
                let chars = displayText(at: timeline.date)
                ForEach(Array(chars.enumerated()), id: \.offset) { _, char in
                    Text(String(char))
                        .font(font)
                        .foregroundColor(color)
                        .monospacedDigit()
                }
            }
        }
        .onChange(of: value) { _, newValue in
            startFlip(to: newValue)
        }
        .onAppear {
            targetChars = Array(value)
            settledIndices = Set(0..<value.count)
        }
    }

    private func startFlip(to newValue: String) {
        let newChars = Array(newValue)
        let oldChars = targetChars

        targetChars = newChars
        settledIndices = []

        for i in 0..<max(oldChars.count, newChars.count) {
            let oldChar = i < oldChars.count ? oldChars[i] : Character(" ")
            let newChar = i < newChars.count ? newChars[i] : Character(" ")
            if oldChar == newChar {
                settledIndices.insert(i)
            }
        }

        flipStartTime = Date()
    }

    private func displayText(at date: Date) -> [Character] {
        guard let start = flipStartTime else {
            return targetChars.isEmpty ? Array(value) : targetChars
        }

        let elapsed = date.timeIntervalSince(start)
        var result: [Character] = []

        for i in 0..<targetChars.count {
            if settledIndices.contains(i) {
                result.append(targetChars[i])
                continue
            }

            let digitDelay = Double(i) * staggerDelay
            let digitElapsed = elapsed - digitDelay

            if digitElapsed >= flipDuration {
                result.append(targetChars[i])
                DispatchQueue.main.async { self.settledIndices.insert(i) }
            } else if digitElapsed > 0 {
                let cycleIndex = Int(digitElapsed * 40)
                if targetChars[i].isNumber {
                    result.append(hexChars[abs(cycleIndex + i * 7) % hexChars.count])
                } else {
                    result.append(targetChars[i])
                }
            } else {
                result.append(targetChars[i])
            }
        }

        if settledIndices.count >= targetChars.count {
            DispatchQueue.main.async { self.flipStartTime = nil }
        }

        return result
    }
}
