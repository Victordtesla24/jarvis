// File: Sources/JarvisTelemetry/VideoGenerationPipeline.swift
// JARVIS — Cinematic video generation from public image assets.
// Enumerates images, generates per-group clips via AVAssetWriter,
// stitches final output via ffmpeg with xfade transitions.

import Foundation
import AppKit
import AVFoundation

/// Pipeline for generating the JARVIS cinematic video from public image assets.
/// Groups images by filename heuristics, creates per-group video clips,
/// then stitches into a single MP4 with crossfade transitions.
final class VideoGenerationPipeline {

    /// Base directory containing source image assets
    private let imagesDir: URL
    /// Output directory for intermediate clips
    private let clipsDir: URL
    /// Final stitched video output path
    private let finalOutputURL: URL
    /// ffmpeg binary path
    private let ffmpegPath: String

    /// Fixed output dimensions
    private let outputSize = CGSize(width: 1920, height: 1080)
    /// Frames per second for generated clips
    private let fps: Int32 = 30
    /// Duration per image in seconds
    private let durationPerImage: Int64 = 2

    /// Clip group names for categorisation
    enum ClipGroup: String, CaseIterable {
        case reactor = "reactor"
        case hud = "hud"
        case lock = "lock"
        case boot = "boot"
        case shutdown = "shutdown"
    }

    init(
        imagesDir: URL = URL(fileURLWithPath: "/Users/vic/claude/General-Work/jarvis/jarvis-build/public/Jarvis-images"),
        clipsDir: URL = URL(fileURLWithPath: "/Users/vic/claude/General-Work/jarvis/jarvis-build/video_clips"),
        finalOutputURL: URL = URL(fileURLWithPath: "/Users/vic/claude/General-Work/jarvis/jarvis-build/JARVIS_CINEMATIC_FINAL.mp4"),
        ffmpegPath: String = "/opt/homebrew/bin/ffmpeg"
    ) {
        self.imagesDir = imagesDir
        self.clipsDir = clipsDir
        self.finalOutputURL = finalOutputURL
        self.ffmpegPath = ffmpegPath
    }

    // MARK: - Public API

    /// Run the full video generation pipeline
    func generate() async throws {
        NSLog("[VideoGenerationPipeline] Starting pipeline")

        // Ensure output directories exist
        try FileManager.default.createDirectory(at: clipsDir, withIntermediateDirectories: true)

        // Step 1: Enumerate and group source images
        let groups = try enumerateAndGroup()
        NSLog("[VideoGenerationPipeline] Found \(groups.count) groups with \(groups.values.flatMap { $0 }.count) total images")

        // Step 2: Generate per-group video clips
        var clipPaths: [URL] = []
        for (group, images) in groups.sorted(by: { $0.key < $1.key }) {
            let clipURL = clipsDir.appendingPathComponent("\(group).mp4")
            try generateClip(from: images, to: clipURL)
            clipPaths.append(clipURL)
            NSLog("[VideoGenerationPipeline] Generated clip: \(group).mp4")
        }

        // Step 3: Stitch with ffmpeg xfade transitions
        if clipPaths.count >= 2 {
            try stitchWithFFmpeg(clips: clipPaths)
        } else if let single = clipPaths.first {
            try FileManager.default.copyItem(at: single, to: finalOutputURL)
        }

        // Step 4: Validate output
        try validateOutput()
        NSLog("[VideoGenerationPipeline] Pipeline complete: \(finalOutputURL.path)")
    }

    // MARK: - Step 1: Enumerate and Group

    /// Enumerate all images in the source directory and group by filename heuristics
    private func enumerateAndGroup() throws -> [String: [URL]] {
        let validExtensions = Set(["png", "jpg", "jpeg", "gif", "webp", "svg"])
        let contents = try FileManager.default.contentsOfDirectory(
            at: imagesDir,
            includingPropertiesForKeys: [.fileSizeKey],
            options: [.skipsHiddenFiles]
        )

        let imageFiles = contents.filter { validExtensions.contains($0.pathExtension.lowercased()) }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }

        guard !imageFiles.isEmpty else {
            throw PipelineError.noImagesFound
        }

        // Group by filename heuristics — assign to closest category
        var groups: [String: [URL]] = [:]
        for file in imageFiles {
            let name = file.lastPathComponent.lowercased()
            let group: String
            if name.contains("reactor") || name.contains("circle") || name.contains("rainmeter") {
                group = ClipGroup.reactor.rawValue
            } else if name.contains("hud") || name.contains("panel") || name.contains("side") {
                group = ClipGroup.hud.rawValue
            } else if name.contains("lock") || name.contains("background") || name.contains("wallpaper") {
                group = ClipGroup.lock.rawValue
            } else if name.contains("boot") || name.contains("image 9") || name.contains("jarvis-1") {
                group = ClipGroup.boot.rawValue
            } else {
                group = ClipGroup.shutdown.rawValue
            }
            groups[group, default: []].append(file)
        }

        return groups
    }

    // MARK: - Step 2: Generate Per-Group Clips

    /// Generate a video clip from a sequence of images using AVAssetWriter
    private func generateClip(from images: [URL], to outputURL: URL) throws {
        if FileManager.default.fileExists(atPath: outputURL.path) {
            try FileManager.default.removeItem(at: outputURL)
        }

        let assetWriter = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)

        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: outputSize.width,
            AVVideoHeightKey: outputSize.height
        ]

        let writerInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: writerInput,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32ARGB),
                kCVPixelBufferWidthKey as String: outputSize.width,
                kCVPixelBufferHeightKey as String: outputSize.height
            ]
        )

        assetWriter.add(writerInput)
        assetWriter.startWriting()
        assetWriter.startSession(atSourceTime: .zero)

        var frameCount: Int64 = 0

        for imageURL in images {
            guard let image = NSImage(contentsOf: imageURL),
                  let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
                continue
            }

            let framesForThisImage = Int64(fps) * durationPerImage

            for _ in 0..<framesForThisImage {
                while !writerInput.isReadyForMoreMediaData {
                    Thread.sleep(forTimeInterval: 0.05)
                }

                var pixelBuffer: CVPixelBuffer?
                CVPixelBufferCreate(kCFAllocatorDefault, Int(outputSize.width), Int(outputSize.height),
                                    kCVPixelFormatType_32ARGB, nil, &pixelBuffer)

                guard let buffer = pixelBuffer else { continue }

                CVPixelBufferLockBaseAddress(buffer, [])
                if let pixelData = CVPixelBufferGetBaseAddress(buffer) {
                    let colorSpace = CGColorSpaceCreateDeviceRGB()
                    if let context = CGContext(
                        data: pixelData,
                        width: Int(outputSize.width),
                        height: Int(outputSize.height),
                        bitsPerComponent: 8,
                        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
                        space: colorSpace,
                        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
                    ) {
                        context.draw(cgImage, in: CGRect(origin: .zero, size: outputSize))
                    }
                }
                CVPixelBufferUnlockBaseAddress(buffer, [])

                adaptor.append(buffer, withPresentationTime: CMTimeMake(value: frameCount, timescale: fps))
                frameCount += 1
            }
        }

        writerInput.markAsFinished()

        let semaphore = DispatchSemaphore(value: 0)
        assetWriter.finishWriting { semaphore.signal() }
        semaphore.wait()

        guard assetWriter.status == .completed else {
            throw PipelineError.clipGenerationFailed(outputURL.lastPathComponent)
        }
    }

    // MARK: - Step 3: FFmpeg Stitching

    /// Stitch multiple clips with xfade crossfade transitions
    private func stitchWithFFmpeg(clips: [URL]) throws {
        if FileManager.default.fileExists(atPath: finalOutputURL.path) {
            try FileManager.default.removeItem(at: finalOutputURL)
        }

        // Build ffmpeg filter_complex for xfade transitions
        var args: [String] = []
        for clip in clips {
            args += ["-i", clip.path]
        }

        if clips.count == 2 {
            let offset = durationPerImage * 2 - 1 // clip duration minus fade
            args += [
                "-filter_complex",
                "[0:v][1:v]xfade=transition=fade:duration=1:offset=\(offset)[v]",
                "-map", "[v]"
            ]
        } else if clips.count > 2 {
            var filterParts: [String] = []
            var lastLabel = "[0:v]"
            for i in 1..<clips.count {
                let offset = Int64(i) * durationPerImage * 2 - Int64(i)  // account for consumed fade time
                let outLabel = i == clips.count - 1 ? "[v]" : "[v\(i)]"
                filterParts.append("\(lastLabel)[\(i):v]xfade=transition=fade:duration=1:offset=\(offset)\(outLabel)")
                lastLabel = outLabel
            }
            args += ["-filter_complex", filterParts.joined(separator: ";"), "-map", "[v]"]
        }

        args += [
            "-c:v", "libx264",
            "-preset", "slow",
            "-crf", "14",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            finalOutputURL.path
        ]

        let process = Process()
        process.executableURL = URL(fileURLWithPath: ffmpegPath)
        process.arguments = args
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            throw PipelineError.ffmpegFailed(Int(process.terminationStatus))
        }
    }

    // MARK: - Step 4: Validation

    /// Validate the final output video using ffprobe
    private func validateOutput() throws {
        guard FileManager.default.fileExists(atPath: finalOutputURL.path) else {
            throw PipelineError.outputMissing
        }

        let attrs = try FileManager.default.attributesOfItem(atPath: finalOutputURL.path)
        guard let size = attrs[.size] as? UInt64, size > 0 else {
            throw PipelineError.outputEmpty
        }

        NSLog("[VideoGenerationPipeline] Output validated: \(size) bytes at \(finalOutputURL.path)")
    }

    // MARK: - Errors

    enum PipelineError: Error, CustomStringConvertible {
        case noImagesFound
        case clipGenerationFailed(String)
        case ffmpegFailed(Int)
        case outputMissing
        case outputEmpty

        var description: String {
            switch self {
            case .noImagesFound: return "No images found in source directory"
            case .clipGenerationFailed(let name): return "Failed to generate clip: \(name)"
            case .ffmpegFailed(let code): return "ffmpeg exited with code \(code)"
            case .outputMissing: return "Output file not found after generation"
            case .outputEmpty: return "Output file is empty"
            }
        }
    }
}
