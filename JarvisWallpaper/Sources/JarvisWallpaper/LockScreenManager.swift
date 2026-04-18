// LockScreenManager — JARVIS STANDBY continuity
//
// On screen lock (sessionDidResignActive) we:
//   1. Snapshot the live reactor WKWebView to a high-res PNG
//   2. Save it to Application Support
//   3. Call NSWorkspace.shared.setDesktopImageURL so the frozen reactor
//      replaces the desktop wallpaper while the session is locked.
//
// On unlock (sessionDidBecomeActive) we restore the previous wallpaper.

import AppKit
import WebKit
import Foundation

final class LockScreenManager {

    weak var primaryWebView: WKWebView?

    private var priorWallpaperURLs: [NSScreen: URL] = [:]
    private let fs = FileManager.default
    private var snapshotURL: URL {
        let dir = (try? fs.url(for: .applicationSupportDirectory,
                               in: .userDomainMask,
                               appropriateFor: nil,
                               create: true))
            ?? fs.temporaryDirectory
        let folder = dir.appendingPathComponent("JarvisWallpaper", isDirectory: true)
        try? fs.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("jarvis-standby.png")
    }

    func start() {
        let nc = NSWorkspace.shared.notificationCenter
        nc.addObserver(self,
                       selector: #selector(sessionDidResignActive(_:)),
                       name: NSWorkspace.sessionDidResignActiveNotification,
                       object: nil)
        nc.addObserver(self,
                       selector: #selector(sessionDidBecomeActive(_:)),
                       name: NSWorkspace.sessionDidBecomeActiveNotification,
                       object: nil)
    }

    /// Externally-triggered lock simulation (used by --test-lock to prove SC-4.1)
    func simulateLock() {
        sessionDidResignActive(Notification(name: NSWorkspace.sessionDidResignActiveNotification))
    }

    func simulateUnlock() {
        sessionDidBecomeActive(Notification(name: NSWorkspace.sessionDidBecomeActiveNotification))
    }

    // MARK: - Lock handler (SC-4.1)
    @objc private func sessionDidResignActive(_ note: Notification) {
        guard let webView = primaryWebView else { return }
        // Remember current wallpapers so we can restore on unlock
        priorWallpaperURLs.removeAll()
        for screen in NSScreen.screens {
            if let url = NSWorkspace.shared.desktopImageURL(for: screen) {
                priorWallpaperURLs[screen] = url
            }
        }

        let snapshotTarget = snapshotURL
        let config = WKSnapshotConfiguration()
        config.afterScreenUpdates = true
        webView.takeSnapshot(with: config) { [weak self] image, _ in
            guard let self = self, let image = image else { return }
            if let data = Self.pngData(from: image) {
                try? data.write(to: snapshotTarget, options: .atomic)
                DispatchQueue.main.async {
                    for screen in NSScreen.screens {
                        try? NSWorkspace.shared.setDesktopImageURL(
                            snapshotTarget,
                            for: screen,
                            options: [:]
                        )
                    }
                }
            }
        }
    }

    // MARK: - Unlock handler
    @objc private func sessionDidBecomeActive(_ note: Notification) {
        // Restore the prior wallpapers
        for (screen, url) in priorWallpaperURLs {
            try? NSWorkspace.shared.setDesktopImageURL(url, for: screen, options: [:])
        }
        priorWallpaperURLs.removeAll()
    }

    // MARK: - PNG encoder
    private static func pngData(from image: NSImage) -> Data? {
        guard let tiff = image.tiffRepresentation,
              let rep  = NSBitmapImageRep(data: tiff) else { return nil }
        return rep.representation(using: .png, properties: [:])
    }
}
