// File: Sources/JarvisTelemetry/CoreReactorMetalView.swift
// JARVIS — Metal fragment shader for physically-based core reactor bloom.
// Multi-layer Gaussian + exponential falloff creates the signature MCU
// arc reactor volumetric glow. Reactive to live telemetry via the
// ReactorAnimationController — load, flare, power flow, and breathing
// all modulate the bloom in real time.

import SwiftUI
import AppKit
import Metal
import MetalKit

// MARK: - SwiftUI Bridge

/// Metal-rendered core reactor bloom overlay.
/// This is THE core bloom — the massive volumetric light that makes
/// the reactor look like it contains a star. Layered on top of the
/// Canvas reactor drawing, below particles and pulse ring.
struct CoreReactorMetalView: NSViewRepresentable {
    @EnvironmentObject var reactorController: ReactorAnimationController

    /// Bloom intensity (0.0 = off, 1.0 = maximum)
    var bloomIntensity: CGFloat = JARVISNominalState.bloomIntensity

    /// Bloom radius in normalised units (0.0-1.0 of screen height)
    var bloomRadius: CGFloat = 0.15

    /// Core color tint (false = cyan, true = red for wrong-auth)
    var redTint: Bool = false

    func makeCoordinator() -> BloomRenderer {
        BloomRenderer()
    }

    func makeNSView(context: Context) -> MTKView {
        guard let device = MTLCreateSystemDefaultDevice() else {
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

    func updateNSView(_ nsView: MTKView, context: Context) {
        // Push reactive telemetry into the renderer every frame
        let load = Float(reactorController.reactorLoad)
        let flare = Float(reactorController.coreFlare)
        let power = Float(reactorController.powerFlowIntensity)
        let breath = Float(sin(reactorController.breathingPhase))

        // Reactive bloom: intensity surges with load + flare
        let reactiveIntensity = Float(bloomIntensity) + load * 0.25 + flare * 0.35 + power * 0.10
        // Reactive radius: bloom expands under load, flare makes it pulse outward
        let reactiveRadius = Float(bloomRadius) + load * 0.04 + flare * 0.08 + breath * 0.01 * (1.0 - load)

        context.coordinator.bloomIntensity = min(reactiveIntensity, 1.2)
        context.coordinator.bloomRadius = min(reactiveRadius, 0.30)
        context.coordinator.coreFlare = flare
        context.coordinator.powerFlow = power
        context.coordinator.redTint = redTint
    }
}

// MARK: - Metal Bloom Renderer

/// Renders a multi-layer physically-based bloom effect centred on screen.
/// Three nested Gaussian kernels with different sigmas create:
///   1. Tight white-hot core (σ = small, very bright)
///   2. Medium cyan glow (σ = medium, main bloom)
///   3. Wide atmospheric haze (σ = large, subtle volumetric fill)
/// Plus a flare spike layer for telemetry-driven energy surges.
final class BloomRenderer: NSObject, MTKViewDelegate {

    var bloomIntensity: Float = Float(JARVISNominalState.bloomIntensity)
    var bloomRadius: Float = 0.15
    var coreFlare: Float = 0.0
    var powerFlow: Float = 0.0
    var redTint: Bool = false

    private var commandQueue: MTLCommandQueue?
    private var pipeline: MTLRenderPipelineState?
    private let startTime: CFTimeInterval = CACurrentMediaTime()

    /// Inline Metal shader — multi-layer volumetric bloom with reactive flare.
    ///
    /// Uniforms (packed into two float4):
    ///   params.x  = bloom intensity
    ///   params.y  = bloom radius (normalised)
    ///   params.z  = time (seconds)
    ///   params.w  = red tint flag
    ///   extra.x   = coreFlare (0-1, spike intensity)
    ///   extra.y   = powerFlow (0-1, sustained brightness)
    ///   extra.z   = reserved
    ///   extra.w   = reserved
    private static let shaderSource = """
    #include <metal_stdlib>
    using namespace metal;

    struct VertOut {
        float4 position [[position]];
        float2 uv;
    };

    struct BloomParams {
        float4 params;
        float4 extra;
    };

    constant float2 kQuad[6] = {
        float2(-1, -1), float2(1, -1), float2(-1,  1),
        float2(-1,  1), float2(1, -1), float2( 1,  1)
    };

    vertex VertOut bloom_vertex(uint vid [[vertex_id]]) {
        VertOut out;
        float2 pos = kQuad[vid];
        out.position = float4(pos, 0.0, 1.0);
        out.uv = float2(pos.x * 0.5 + 0.5, 1.0 - (pos.y * 0.5 + 0.5));
        return out;
    }

    fragment float4 bloom_fragment(VertOut in [[stage_in]],
                                    constant BloomParams &bp [[buffer(0)]]) {
        float intensity = bp.params.x;
        float radius    = bp.params.y;
        float time      = bp.params.z;
        float redFlag   = bp.params.w;
        float flare     = bp.extra.x;
        float power     = bp.extra.y;

        // Centre of screen
        float2 centre = float2(0.5, 0.5);
        float2 delta = in.uv - centre;

        // Aspect ratio correction (assume 16:10 widescreen)
        delta.x *= 1.6;

        float dist = length(delta);

        // ═══════════════════════════════════════════════════════════════
        //  LAYER 1: White-hot core — very tight, very bright
        //  This is the "star inside the reactor" look
        // ═══════════════════════════════════════════════════════════════
        float sigma1 = radius * 0.03;
        float core = exp(-(dist * dist) / (2.0 * sigma1 * sigma1));
        // Core pulses with heartbeat + power flow
        float heartbeat = 0.90 + 0.10 * sin(time * 4.5) + power * 0.08;
        core *= intensity * heartbeat * 1.4;

        // ═══════════════════════════════════════════════════════════════
        //  LAYER 2: Main cyan bloom — medium spread, signature glow
        //  This is the primary visible reactor bloom
        // ═══════════════════════════════════════════════════════════════
        float sigma2 = radius * 0.10;
        float bloom = exp(-(dist * dist) / (2.0 * sigma2 * sigma2));
        bloom *= intensity * 0.85;

        // ═══════════════════════════════════════════════════════════════
        //  LAYER 3: Wide atmospheric haze — fills the room with light
        //  Subtle but crucial for the "reactor lights up the space" feel
        // ═══════════════════════════════════════════════════════════════
        float sigma3 = radius * 0.35;
        float haze = exp(-(dist * dist) / (2.0 * sigma3 * sigma3));
        haze *= intensity * 0.20;

        // ═══════════════════════════════════════════════════════════════
        //  LAYER 4: Flare spike — telemetry-reactive energy surge
        //  Expands rapidly on CPU/GPU spikes, then fades
        // ═══════════════════════════════════════════════════════════════
        float sigmaFlare = radius * (0.06 + flare * 0.15);
        float flareBoom = exp(-(dist * dist) / (2.0 * sigmaFlare * sigmaFlare));
        flareBoom *= flare * 1.2;

        // ═══════════════════════════════════════════════════════════════
        //  COLOUR COMPOSITING
        // ═══════════════════════════════════════════════════════════════
        float3 coreColor;
        if (redFlag > 0.5) {
            coreColor = float3(1.0, 0.1, 0.1);
        } else {
            float3 white = float3(1.0, 1.0, 1.0);
            float3 cyan  = float3(0.102, 0.902, 0.961);
            float3 cyanDim = float3(0.055, 0.565, 0.659);

            // Layer 1: white-hot centre
            float3 col1 = mix(white, cyan, smoothstep(0.0, 0.5, dist / (sigma1 * 4.0)));
            // Layer 2: cyan bloom
            float3 col2 = cyan;
            // Layer 3: dimmer cyan haze
            float3 col3 = cyanDim;
            // Layer 4: bright white-cyan flare
            float3 col4 = mix(white, cyan, 0.3);

            // Composite all layers (additive)
            float totalAlpha = core + bloom + haze + flareBoom;
            if (totalAlpha < 0.001) { return float4(0, 0, 0, 0); }

            coreColor = (col1 * core + col2 * bloom + col3 * haze + col4 * flareBoom) / totalAlpha;
            float alpha = min(totalAlpha, 1.0);
            return float4(coreColor * alpha, alpha);
        }

        float totalAlpha = min(core + bloom + haze + flareBoom, 1.0);
        return float4(coreColor * totalAlpha, totalAlpha);
    }
    """

    // Uniform struct matching the shader
    private struct BloomParams {
        var params: SIMD4<Float>
        var extra: SIMD4<Float>
    }

    func setup(device: MTLDevice, pixelFormat: MTLPixelFormat) {
        commandQueue = device.makeCommandQueue()

        do {
            let lib  = try device.makeLibrary(source: Self.shaderSource, options: nil)
            let vert = lib.makeFunction(name: "bloom_vertex")!
            let frag = lib.makeFunction(name: "bloom_fragment")!

            let desc = MTLRenderPipelineDescriptor()
            desc.vertexFunction   = vert
            desc.fragmentFunction = frag
            // Additive blending — bloom adds light, never subtracts
            desc.colorAttachments[0].pixelFormat             = pixelFormat
            desc.colorAttachments[0].isBlendingEnabled       = true
            desc.colorAttachments[0].sourceRGBBlendFactor    = .one
            desc.colorAttachments[0].destinationRGBBlendFactor = .one
            desc.colorAttachments[0].sourceAlphaBlendFactor  = .one
            desc.colorAttachments[0].destinationAlphaBlendFactor = .oneMinusSourceAlpha

            pipeline = try device.makeRenderPipelineState(descriptor: desc)
        } catch {
            assertionFailure("Bloom Metal pipeline failed: \(error)")
        }
    }

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

    func draw(in view: MTKView) {
        guard
            let pipeline,
            let queue    = commandQueue,
            let rpd      = view.currentRenderPassDescriptor,
            let drawable = view.currentDrawable
        else { return }

        rpd.colorAttachments[0].loadAction  = .clear
        rpd.colorAttachments[0].clearColor  = MTLClearColorMake(0, 0, 0, 0)
        rpd.colorAttachments[0].storeAction = .store

        let elapsed = Float(CACurrentMediaTime() - startTime)
        var bp = BloomParams(
            params: SIMD4<Float>(bloomIntensity, bloomRadius, elapsed, redTint ? 1.0 : 0.0),
            extra: SIMD4<Float>(coreFlare, powerFlow, 0, 0)
        )

        guard
            let cmd = queue.makeCommandBuffer(),
            let enc = cmd.makeRenderCommandEncoder(descriptor: rpd)
        else { return }

        enc.setRenderPipelineState(pipeline)
        enc.setFragmentBytes(&bp,
                             length: MemoryLayout<BloomParams>.stride,
                             index: 0)
        enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 6)
        enc.endEncoding()

        cmd.present(drawable)
        cmd.commit()
    }
}
