// File: Sources/JarvisTelemetry/LockScreenManager.swift

import AppKit

final class LockScreenManager {

    private let supportDir: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("JarvisTelemetry")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    func setStandbyWallpaper() {
        let pngURL = supportDir.appendingPathComponent("jarvis-standby.png")
        guard let screen = NSScreen.main else { return }
        let width = Int(screen.frame.width)
        let height = Int(screen.frame.height)

        guard let image = renderStandbyImage(width: width, height: height) else { return }
        guard let tiffData = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData),
              let pngData = bitmap.representation(using: .png, properties: [:]) else { return }

        do {
            try pngData.write(to: pngURL)
            for s in NSScreen.screens {
                try NSWorkspace.shared.setDesktopImageURL(pngURL, for: s, options: [:])
            }
            NSLog("[LockScreenManager] Standby wallpaper set")
        } catch {
            NSLog("[LockScreenManager] Failed: \(error)")
        }
    }

    private func renderStandbyImage(width: Int, height: Int) -> NSImage? {
        let image = NSImage(size: NSSize(width: width, height: height))
        image.lockFocus()
        guard let ctx = NSGraphicsContext.current?.cgContext else { image.unlockFocus(); return nil }

        let w = CGFloat(width), h = CGFloat(height)
        let cx = w / 2, cy = h / 2, R = min(w, h) * 0.42
        let steel = NSColor(red: 0.40, green: 0.52, blue: 0.58, alpha: 1.0)
        let cyanColor = NSColor(red: 0.102, green: 0.902, blue: 0.961, alpha: 1.0)

        ctx.setFillColor(NSColor(red: 0.02, green: 0.04, blue: 0.08, alpha: 1.0).cgColor)
        ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))

        for i in stride(from: 0, to: 220, by: 3) {
            let frac = Double(i) / 220.0
            let r = R * (0.06 + frac * 0.91)
            let opacity = (0.08 + (1.0 - frac) * 0.12) * 0.5
            ctx.setStrokeColor(steel.withAlphaComponent(opacity).cgColor)
            ctx.setLineWidth(0.5)
            ctx.addArc(center: CGPoint(x: cx, y: cy), radius: r, startAngle: 0, endAngle: .pi * 2, clockwise: false)
            ctx.strokePath()
        }

        ctx.setFillColor(cyanColor.withAlphaComponent(0.04).cgColor)
        ctx.fillEllipse(in: CGRect(x: cx - 18, y: cy - 18, width: 36, height: 36))
        ctx.setFillColor(cyanColor.withAlphaComponent(0.08).cgColor)
        ctx.fillEllipse(in: CGRect(x: cx - 6, y: cy - 6, width: 12, height: 12))

        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont(name: "Menlo", size: 12) ?? NSFont.monospacedSystemFont(ofSize: 12, weight: .regular),
            .foregroundColor: cyanColor.withAlphaComponent(0.25),
            .kern: 6.0
        ]
        let text = "SYSTEM STANDBY" as NSString
        let textSize = text.size(withAttributes: attrs)
        text.draw(at: CGPoint(x: cx - textSize.width / 2, y: cy - R - 40), withAttributes: attrs)

        image.unlockFocus()
        return image
    }
}
