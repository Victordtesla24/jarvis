// File: Sources/JarvisTelemetry/JarvisPreloader.swift
// Responsibility: Renders a 3-second cinematic wireframe boot sequence
//                 using SceneKit SCNNode emission materials and SCNTransaction
//                 animations before live telemetry begins.

import SwiftUI
import SceneKit

struct JarvisPreloaderView: NSViewRepresentable {

    var onComplete: () -> Void

    func makeNSView(context: Context) -> SCNView {
        let scnView              = SCNView()
        scnView.backgroundColor  = .clear
        scnView.allowsCameraControl = false
        scnView.antialiasingMode = .multisampling4X
        scnView.scene            = buildScene(completion: onComplete)
        scnView.isPlaying        = true
        return scnView
    }

    func updateNSView(_ nsView: SCNView, context: Context) {}

    // MARK: - Scene Construction

    private func buildScene(completion: @escaping () -> Void) -> SCNScene {
        let scene = SCNScene()
        scene.background.contents = NSColor.clear

        // Camera
        let cameraNode          = SCNNode()
        cameraNode.camera       = SCNCamera()
        cameraNode.position     = SCNVector3(0, 0, 12)
        scene.rootNode.addChildNode(cameraNode)

        // Ambient light (dim, cold blue — Tron palette)
        let ambientLight        = SCNNode()
        ambientLight.light      = SCNLight()
        ambientLight.light!.type = .ambient
        ambientLight.light!.color = NSColor(red: 0.0, green: 0.5, blue: 0.8, alpha: 0.3)
        scene.rootNode.addChildNode(ambientLight)

        // Build concentric glowing rings
        let ringCount = 5
        for i in 0..<ringCount {
            let radius  = Double(i + 1) * 1.2
            let ring    = makeGlowRing(radius: radius, index: i)
            scene.rootNode.addChildNode(ring)
            animateRingIn(ring, delay: Double(i) * 0.25)
        }

        // Central arc-reactor geometry
        let reactor = makeArcReactor()
        scene.rootNode.addChildNode(reactor)
        animateReactorPulse(reactor)

        // Outer spinning chevrons
        for i in 0..<12 {
            let chevron = makeChevron(index: i)
            scene.rootNode.addChildNode(chevron)
            animateChevronOrbit(chevron, index: i)
        }

        // Holographic grid plane
        let grid = makeHolographicGrid()
        scene.rootNode.addChildNode(grid)

        // Schedule completion after 3.2 seconds (all animations settle)
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.2) {
            completion()
        }

        return scene
    }

    // MARK: - Geometry Factories

    private func makeGlowRing(radius: Double, index: Int) -> SCNNode {
        let tube = SCNTube(
            innerRadius: CGFloat(radius - 0.04),
            outerRadius: CGFloat(radius),
            height:      0.04
        )

        let mat           = SCNMaterial()
        mat.lightingModel = .constant      // Unlit — pure emission
        mat.isDoubleSided = true

        // Alternate cyan / amber per ring
        let isAmber = index % 2 == 1
        mat.diffuse.contents   = NSColor.clear
        mat.emission.contents  = isAmber
            ? NSColor(red: 1.0, green: 0.75, blue: 0.0, alpha: 1.0)   // #FFBF00
            : NSColor(red: 0.0, green: 1.0, blue: 1.0, alpha: 1.0)    // #00FFFF

        tube.materials = [mat]

        let node    = SCNNode(geometry: tube)
        node.opacity = 0.0   // Start invisible; fade-in via animation
        node.eulerAngles = SCNVector3(Float.pi / 2, 0, 0) // Lay flat
        return node
    }

    private func makeArcReactor() -> SCNNode {
        let sphere = SCNSphere(radius: 0.35)
        let mat           = SCNMaterial()
        mat.lightingModel = .constant
        mat.emission.contents  = NSColor(red: 0.0, green: 0.9, blue: 1.0, alpha: 1.0)
        mat.diffuse.contents   = NSColor.black
        sphere.materials  = [mat]

        let node  = SCNNode(geometry: sphere)
        node.opacity = 0.0
        return node
    }

    private func makeChevron(index: Int) -> SCNNode {
        let box = SCNBox(width: 0.12, height: 0.04, length: 0.04, chamferRadius: 0.01)
        let mat           = SCNMaterial()
        mat.lightingModel = .constant
        mat.emission.contents  = NSColor(red: 0.0, green: 1.0, blue: 1.0, alpha: 0.8)
        box.materials     = [mat]

        let node         = SCNNode(geometry: box)
        let angle        = (Double(index) / 12.0) * Double.pi * 2.0
        node.position    = SCNVector3(
            Float(cos(angle) * 6.5),
            Float(sin(angle) * 6.5),
            0
        )
        node.opacity     = 0.0
        return node
    }

    private func makeHolographicGrid() -> SCNNode {
        let plane = SCNPlane(width: 20, height: 20)
        let mat   = SCNMaterial()
        mat.lightingModel   = .constant
        mat.isDoubleSided   = true
        mat.diffuse.contents  = NSColor.clear
        mat.emission.contents = NSColor(red: 0.0, green: 0.8, blue: 1.0, alpha: 0.06)
        plane.materials       = [mat]

        let node          = SCNNode(geometry: plane)
        node.eulerAngles  = SCNVector3(-Float.pi / 2, 0, 0)
        node.position     = SCNVector3(0, -4, 0)
        node.opacity      = 0.0
        return node
    }

    // MARK: - Animations

    private func animateRingIn(_ node: SCNNode, delay: Double) {
        SCNTransaction.begin()
        SCNTransaction.animationDuration  = 0.6
        SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeOut)
        SCNTransaction.completionBlock    = nil
        node.opacity = 1.0
        SCNTransaction.commit()

        // Slow continuous rotation
        let spin           = CABasicAnimation(keyPath: "eulerAngles.z")
        spin.fromValue     = 0
        spin.toValue       = Float.pi * 2
        spin.duration      = 12.0 - Double(node.childNodes.count) * 1.5
        spin.repeatCount   = .infinity
        spin.beginTime     = CACurrentMediaTime() + delay
        node.addAnimation(spin, forKey: "ringRotation")
    }

    private func animateReactorPulse(_ node: SCNNode) {
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.8
        node.opacity = 1.0
        SCNTransaction.commit()

        let pulse            = CABasicAnimation(keyPath: "scale")
        pulse.fromValue      = SCNVector3(1, 1, 1)
        pulse.toValue        = SCNVector3(1.15, 1.15, 1.15)
        pulse.duration       = 0.9
        pulse.autoreverses   = true
        pulse.repeatCount    = .infinity
        node.addAnimation(pulse, forKey: "reactorPulse")
    }

    private func animateChevronOrbit(_ node: SCNNode, index: Int) {
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.4
        node.opacity = 0.85
        SCNTransaction.commit()

        let orbit           = CABasicAnimation(keyPath: "eulerAngles.z")
        orbit.fromValue     = Float(Double(index) / 12.0 * Double.pi * 2.0)
        orbit.toValue       = Float(Double(index) / 12.0 * Double.pi * 2.0 + Double.pi * 2.0)
        orbit.duration      = 8.0
        orbit.repeatCount   = .infinity
        node.addAnimation(orbit, forKey: "chevronOrbit")
    }
}
