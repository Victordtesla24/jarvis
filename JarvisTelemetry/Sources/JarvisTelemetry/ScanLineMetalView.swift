// File: Sources/JarvisTelemetry/ScanLineMetalView.swift
// JARVIS — Metal fragment shader scan-line sweep.
// A horizontal white→transparent gradient band (4 pt, opacity 0.18) sweeps
// from y=0 to y=screenHeight over 3.5 s, then resets.
// MTKView provides the CADisplayLink-equivalent 60fps driver.
// Shader source is compiled inline at runtime — no .metal bundle resource needed.

import SwiftUI
import AppKit
import Metal
import MetalKit

// MARK: - SwiftUI bridge ──────────────────────────────────────────────────────

struct ScanLineMetalView: NSViewRepresentable {

    func makeCoordinator() -> ScanLineRenderer {
        ScanLineRenderer()
    }

    func makeNSView(context: Context) -> MTKView {
        guard let device = MTLCreateSystemDefaultDevice() else {
            // Metal unavailable — return empty transparent view
            return MTKView()
        }

        let view = MTKView(frame: .zero, device: device)
        view.delegate                  = context.coordinator
        view.preferredFramesPerSecond  = 60
        view.isPaused                  = false
        view.enableSetNeedsDisplay     = false
        view.colorPixelFormat          = .bgra8Unorm
        view.clearColor                = MTLClearColorMake(0, 0, 0, 0)
        view.layer?.isOpaque           = false
        view.framebufferOnly           = false

        context.coordinator.setup(device: device, pixelFormat: .bgra8Unorm)
        return view
    }

    func updateNSView(_ nsView: MTKView, context: Context) {}
}

// MARK: - Metal renderer ──────────────────────────────────────────────────────

final class ScanLineRenderer: NSObject, MTKViewDelegate {

    private var commandQueue: MTLCommandQueue?
    private var pipeline: MTLRenderPipelineState?
    private let startTime: CFTimeInterval = CACurrentMediaTime()

    // ── Inline Metal shader source ───────────────────────────────────────────
    //
    // scan_vertex:   full-screen quad (2 triangles, 6 vertices, no VBO)
    // scan_fragment: renders one thin gradient band at the scan Y position.
    //
    // params.x = scan Y as fraction 0 (top) → 1 (bottom)
    // params.y = unused (padding for 8-byte alignment)
    //
    // UV convention:
    //   NDC y=+1 → top of screen → uv.y = 0
    //   NDC y=-1 → bottom        → uv.y = 1
    // Metal's in.position.y increases downward from viewport top, which
    // matches this convention without additional flipping.
    private static let shaderSource = """
    #include <metal_stdlib>
    using namespace metal;

    struct VertOut {
        float4 position [[position]];
        float2 uv;
    };

    // Six vertices for two triangles covering the full NDC quad.
    constant float2 kQuad[6] = {
        float2(-1, -1), float2(1, -1), float2(-1,  1),
        float2(-1,  1), float2(1, -1), float2( 1,  1)
    };

    vertex VertOut scan_vertex(uint vid [[vertex_id]]) {
        VertOut out;
        float2 pos  = kQuad[vid];
        out.position = float4(pos, 0.0, 1.0);
        // uv.y=0 at top (pos.y=+1), uv.y=1 at bottom (pos.y=-1)
        out.uv = float2(pos.x * 0.5 + 0.5,
                        1.0 - (pos.y * 0.5 + 0.5));
        return out;
    }

    fragment float4 scan_fragment(VertOut        in     [[stage_in]],
                                  constant float2 &params [[buffer(0)]]) {
        float scanFrac = params.x;          // 0=top … 1=bottom
        float bandHalf = 0.003;             // half-width ≈ 4 pt at 1440p

        float dist  = abs(in.uv.y - scanFrac);
        if (dist > bandHalf) { return float4(0, 0, 0, 0); }

        // Soft falloff: brightest at centre, fades to transparent at edges
        float t     = 1.0 - (dist / bandHalf);
        float alpha = t * t * 0.18;         // max opacity 0.18 per spec
        return float4(1.0, 1.0, 1.0, alpha);
    }
    """

    // ── One-time setup ───────────────────────────────────────────────────────

    func setup(device: MTLDevice, pixelFormat: MTLPixelFormat) {
        commandQueue = device.makeCommandQueue()

        do {
            let lib  = try device.makeLibrary(source: Self.shaderSource,
                                              options: nil)
            let vert = lib.makeFunction(name: "scan_vertex")!
            let frag = lib.makeFunction(name: "scan_fragment")!

            let desc = MTLRenderPipelineDescriptor()
            desc.vertexFunction   = vert
            desc.fragmentFunction = frag
            desc.colorAttachments[0].pixelFormat             = pixelFormat
            desc.colorAttachments[0].isBlendingEnabled       = true
            // Standard pre-multiplied-alpha source-over blend
            desc.colorAttachments[0].sourceRGBBlendFactor    = .sourceAlpha
            desc.colorAttachments[0].destinationRGBBlendFactor = .oneMinusSourceAlpha
            desc.colorAttachments[0].sourceAlphaBlendFactor  = .sourceAlpha
            desc.colorAttachments[0].destinationAlphaBlendFactor = .oneMinusSourceAlpha

            pipeline = try device.makeRenderPipelineState(descriptor: desc)
        } catch {
            // If Metal setup fails the view stays blank (no crash)
            assertionFailure("ScanLine Metal pipeline failed: \(error)")
        }
    }

    // ── MTKViewDelegate ──────────────────────────────────────────────────────

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

    func draw(in view: MTKView) {
        guard
            let pipeline,
            let queue     = commandQueue,
            let rpd       = view.currentRenderPassDescriptor,
            let drawable  = view.currentDrawable
        else { return }

        // Clear to fully transparent each frame
        rpd.colorAttachments[0].loadAction  = .clear
        rpd.colorAttachments[0].clearColor  = MTLClearColorMake(0, 0, 0, 0)
        rpd.colorAttachments[0].storeAction = .store

        // ── Compute scan Y fraction ──────────────────────────────────────────
        let elapsed  = CACurrentMediaTime() - startTime
        let sweepDur: Double = 3.5
        // Fraction 0 (top) → 1 (bottom) every 3.5s, then resets
        let scanFrac = Float(elapsed.truncatingRemainder(dividingBy: sweepDur) / sweepDur)

        var params = SIMD2<Float>(scanFrac, 0)

        // ── Encode & commit ──────────────────────────────────────────────────
        guard
            let cmd = queue.makeCommandBuffer(),
            let enc = cmd.makeRenderCommandEncoder(descriptor: rpd)
        else { return }

        enc.setRenderPipelineState(pipeline)
        enc.setFragmentBytes(&params,
                             length: MemoryLayout<SIMD2<Float>>.stride,
                             index: 0)
        enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 6)
        enc.endEncoding()

        cmd.present(drawable)
        cmd.commit()
    }
}
