// JARVIS Screen Saver — loadable NSBundle that ScreenSaverEngine (macOS
// loginwindow-owned screen saver host) loads when the screen is locked or
// idle. This is the only user-mode mechanism macOS supports for rendering
// animated content during a real locked session, because loginwindow runs
// ScreenSaverEngine in its trust boundary and composes it above the login
// window shield.
//
// Implementation: subclass ScreenSaverView and host a WKWebView that loads
// the existing jarvis-full-animation.html bundled into the .saver's
// Resources. The HTML engine drives its own requestAnimationFrame loop so
// we don't need animateOneFrame — we set animationTimeInterval to 1/60 to
// keep ScreenSaverEngine's internal scheduler alive.

import ScreenSaver
import WebKit
import AppKit

@objc(JarvisSaverView)
public final class JarvisSaverView: ScreenSaverView {

    private var webView: WKWebView?

    public override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        self.animationTimeInterval = 1.0 / 60.0
        self.wantsLayer = true
        self.layer?.backgroundColor = CGColor(red: 0.02, green: 0.04, blue: 0.08, alpha: 1.0)
        setupWebView(frame: frame)
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        self.animationTimeInterval = 1.0 / 60.0
        self.wantsLayer = true
        self.layer?.backgroundColor = CGColor(red: 0.02, green: 0.04, blue: 0.08, alpha: 1.0)
        setupWebView(frame: self.bounds)
    }

    private func setupWebView(frame: NSRect) {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        if let prefs = config.value(forKey: "preferences") as? NSObject {
            prefs.setValue(true, forKey: "allowFileAccessFromFileURLs")
        }

        let wv = WKWebView(frame: frame, configuration: config)
        wv.autoresizingMask = [.width, .height]
        wv.setValue(false, forKey: "drawsBackground")
        wv.underPageBackgroundColor = NSColor(calibratedRed: 0.02, green: 0.04, blue: 0.08, alpha: 1.0)

        let bundle = Bundle(for: type(of: self))
        if let htmlURL = bundle.url(forResource: "jarvis-full-animation", withExtension: "html") {
            let dir = htmlURL.deletingLastPathComponent()
            wv.loadFileURL(htmlURL, allowingReadAccessTo: dir)
            NSLog("[JarvisSaverView] loaded HTML from %@", htmlURL.path)
        } else {
            let fallback = """
            <!doctype html><html><head><meta charset="utf-8">
            <style>
              html,body{margin:0;padding:0;background:#050a14;color:#1AE6F5;font-family:Menlo,monospace;}
              .c{display:flex;align-items:center;justify-content:center;height:100vh;font-size:24px;letter-spacing:4px;}
            </style></head><body>
            <div class="c">JARVIS · BUNDLE RESOURCE NOT FOUND</div>
            </body></html>
            """
            wv.loadHTMLString(fallback, baseURL: nil)
            NSLog("[JarvisSaverView] WARNING: jarvis-full-animation.html not bundled — loaded fallback")
        }

        self.addSubview(wv)
        self.webView = wv
    }

    public override func draw(_ rect: NSRect) {
        NSColor(calibratedRed: 0.02, green: 0.04, blue: 0.08, alpha: 1.0).setFill()
        rect.fill()
        super.draw(rect)
    }

    public override func animateOneFrame() {
        // HTML's own requestAnimationFrame loop drives animation.
        // animationTimeInterval of 1/60 keeps ScreenSaverEngine scheduler alive.
    }

    // Intentionally omit hasConfigureSheet/configureSheet override.
    // The ScreenSaverView base class exposes them differently across Swift
    // API versions (sometimes method, sometimes property) and the default
    // implementations return `false` / `nil` which is exactly what we want.

    public override func startAnimation() {
        super.startAnimation()
        NSLog("[JarvisSaverView] startAnimation")
    }

    public override func stopAnimation() {
        super.stopAnimation()
        NSLog("[JarvisSaverView] stopAnimation")
    }
}
