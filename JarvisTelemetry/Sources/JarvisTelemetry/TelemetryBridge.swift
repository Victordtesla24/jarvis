// File: Sources/JarvisTelemetry/TelemetryBridge.swift
// Responsibility: Asynchronously read continuous JSON stream from
//                 jarvis-mactop-daemon --headless and publish decoded
//                 TelemetrySnapshot objects to SwiftUI via @Published.

import Foundation
import Combine

// MARK: - Data Models

struct SocMetrics: Codable {
    let cpuPower:    Double
    let gpuPower:    Double
    let anePower:    Double
    let dramPower:   Double
    let totalPower:  Double
    let systemPower: Double
    let gpuFreqMHz:  Double
    let socTemp:     Double
    let cpuTemp:     Double
    let gpuTemp:     Double
    let dramReadBW:  Double
    let dramWriteBW: Double

    enum CodingKeys: String, CodingKey {
        case cpuPower    = "cpu_power"
        case gpuPower    = "gpu_power"
        case anePower    = "ane_power"
        case dramPower   = "dram_power"
        case totalPower  = "total_power"
        case systemPower = "system_power"
        case gpuFreqMHz  = "gpu_freq_mhz"
        case socTemp     = "soc_temp"
        case cpuTemp     = "cpu_temp"
        case gpuTemp     = "gpu_temp"
        case dramReadBW  = "dram_read_bw_gbs"
        case dramWriteBW = "dram_write_bw_gbs"
    }
}

struct MemoryMetrics: Codable {
    let total:     Int64
    let used:      Int64
    let available: Int64
    let swapTotal: Int64
    let swapUsed:  Int64

    enum CodingKeys: String, CodingKey {
        case total     = "total"
        case used      = "used"
        case available = "available"
        case swapTotal = "swap_total"
        case swapUsed  = "swap_used"
    }
}

/// Network + disk rate metrics from the daemon `net_disk` object.
/// All packet/ops fields are optional because older daemon builds may not
/// emit them; byte rates are required for any network/disk spike detection.
struct NetDiskMetrics: Codable {
    let outBytesPerSec:     Double
    let inBytesPerSec:      Double
    let readKBytesPerSec:   Double
    let writeKBytesPerSec:  Double
    let outPacketsPerSec:   Double?
    let inPacketsPerSec:    Double?
    let readOpsPerSec:      Double?
    let writeOpsPerSec:     Double?

    enum CodingKeys: String, CodingKey {
        case outBytesPerSec    = "out_bytes_per_sec"
        case inBytesPerSec     = "in_bytes_per_sec"
        case readKBytesPerSec  = "read_kbytes_per_sec"
        case writeKBytesPerSec = "write_kbytes_per_sec"
        case outPacketsPerSec  = "out_packets_per_sec"
        case inPacketsPerSec   = "in_packets_per_sec"
        case readOpsPerSec     = "read_ops_per_sec"
        case writeOpsPerSec    = "write_ops_per_sec"
    }
}

struct SystemInfo: Codable {
    let name:        String
    let coreCount:   Int
    let eCoreCount:  Int
    let pCoreCount:  Int
    let sCoreCount:  Int
    let gpuCoreCount: Int

    enum CodingKeys: String, CodingKey {
        case name         = "name"
        case coreCount    = "core_count"
        case eCoreCount   = "e_core_count"
        case pCoreCount   = "p_core_count"
        case sCoreCount   = "s_core_count"
        case gpuCoreCount = "gpu_core_count"
    }
}

struct TelemetrySnapshot: Codable {
    let timestamp:    String
    let socMetrics:   SocMetrics
    let memory:       MemoryMetrics
    let cpuUsage:     Double
    let gpuUsage:     Double
    let coreUsages:   [Double]
    let thermalState: String
    let systemInfo:   SystemInfo
    // Optional network + disk sub-object. Older snapshots without this field
    // will decode cleanly as nil so nothing in the harness breaks.
    let netDisk:      NetDiskMetrics?
    // Custom AI/Dev metrics
    let dvhopCPUPct:  Double
    let gumerMBs:     Double
    let cctcDeltaC:   Double

    enum CodingKeys: String, CodingKey {
        case timestamp    = "timestamp"
        case socMetrics   = "soc_metrics"
        case memory       = "memory"
        case cpuUsage     = "cpu_usage"
        case gpuUsage     = "gpu_usage"
        case coreUsages   = "core_usages"
        case thermalState = "thermal_state"
        case systemInfo   = "system_info"
        case netDisk      = "net_disk"
        case dvhopCPUPct  = "dvhop_cpu_pct"
        case gumerMBs     = "gumer_mb_per_s"
        case cctcDeltaC   = "cctc_delta_celsius"
    }
}

// MARK: - TelemetryBridge

final class TelemetryBridge: ObservableObject {

    @Published var snapshot: TelemetrySnapshot? = nil
    @Published var isRunning: Bool = false

    private var process: Process?
    private var pipe: Pipe?
    private var buffer: Data = Data()
    private let decoder = JSONDecoder()
    private var readHandle: FileHandle?

    /// Resolves the daemon path using the most reliable method:
    /// derive from CommandLine.arguments[0] (works with launchd),
    /// then try Bundle.main, then fallback.
    private var daemonURL: URL {
        // Most reliable: derive from our own executable path via CommandLine
        let selfPath = CommandLine.arguments[0]
        let selfURL = URL(fileURLWithPath: selfPath)
        let siblingURL = selfURL.deletingLastPathComponent().appendingPathComponent("jarvis-mactop-daemon")
        if FileManager.default.fileExists(atPath: siblingURL.path) {
            NSLog("[TelemetryBridge] Daemon found via CommandLine sibling: \(siblingURL.path)")
            return siblingURL
        }
        // Try Bundle.main
        if let execDir = Bundle.main.executableURL?.deletingLastPathComponent() {
            let bundleSibling = execDir.appendingPathComponent("jarvis-mactop-daemon")
            if FileManager.default.fileExists(atPath: bundleSibling.path) {
                NSLog("[TelemetryBridge] Daemon found via Bundle.main sibling: \(bundleSibling.path)")
                return bundleSibling
            }
        }
        // SPM resource bundle
        if let bundled = Bundle.main.url(forResource: "jarvis-mactop-daemon", withExtension: nil) {
            NSLog("[TelemetryBridge] Daemon found via Bundle resource: \(bundled.path)")
            return bundled
        }
        NSLog("[TelemetryBridge] WARNING: Daemon not found, falling back to /usr/local/bin")
        return URL(fileURLWithPath: "/usr/local/bin/jarvis-mactop-daemon")
    }

    func start() {
        guard !isRunning else { return }

        let url = daemonURL
        NSLog("[TelemetryBridge] Launching daemon at: \(url.path)")
        NSLog("[TelemetryBridge] File exists: \(FileManager.default.fileExists(atPath: url.path))")
        NSLog("[TelemetryBridge] Is executable: \(FileManager.default.isExecutableFile(atPath: url.path))")

        let proc = Process()
        let outputPipe = Pipe()
        let errorPipe = Pipe()

        proc.executableURL = url
        proc.arguments     = ["--headless", "--interval", "1000"]
        proc.standardOutput = outputPipe
        proc.standardError  = errorPipe

        // Ensure child process has full system PATH (launchd restricts it)
        var env = ProcessInfo.processInfo.environment
        let fullPath = "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin"
        env["PATH"] = fullPath
        proc.environment = env

        // Terminate child process when parent exits
        proc.qualityOfService = .utility

        do {
            try proc.run()
            NSLog("[TelemetryBridge] Daemon launched successfully with PID: \(proc.processIdentifier)")
        } catch {
            NSLog("[TelemetryBridge] Failed to launch daemon: \(error)")
            return
        }

        // Log daemon stderr for diagnostics
        errorPipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if let str = String(data: data, encoding: .utf8), !str.isEmpty {
                NSLog("[TelemetryBridge:daemon-stderr] \(str)")
            }
        }

        self.process   = proc
        self.pipe      = outputPipe
        self.isRunning = true
        self.buffer    = Data()

        let handle = outputPipe.fileHandleForReading
        self.readHandle = handle

        // Asynchronous read using notification-based API (non-blocking)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleDataAvailable(_:)),
            name: .NSFileHandleDataAvailable,
            object: handle
        )
        handle.waitForDataInBackgroundAndNotify()
    }

    func stop() {
        readHandle?.closeFile()
        process?.terminate()
        process   = nil
        pipe      = nil
        isRunning = false
        buffer    = Data()
    }

    @objc private func handleDataAvailable(_ notification: Notification) {
        guard let handle = notification.object as? FileHandle else { return }
        let chunk = handle.availableData
        guard !chunk.isEmpty else { return }

        buffer.append(chunk)

        // Extract complete newline-delimited JSON objects from buffer
        while let newlineRange = buffer.range(of: Data([0x0A])) { // 0x0A = '\n'
            let lineData = buffer.subdata(in: buffer.startIndex..<newlineRange.lowerBound)
            buffer.removeSubrange(buffer.startIndex...newlineRange.lowerBound)

            // mactop --headless emits a JSON array wrapper when --count is used;
            // in infinite mode each line is a bare JSON object.
            // Strip leading '[' or trailing '],' artifacts.
            var cleanData = lineData
            if let str = String(data: lineData, encoding: .utf8) {
                let trimmed = str
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .trimmingCharacters(in: CharacterSet(charactersIn: "[],"))
                cleanData = Data(trimmed.utf8)
            }

            guard !cleanData.isEmpty else { continue }

            do {
                let s = try decoder.decode(TelemetrySnapshot.self, from: cleanData)
                DispatchQueue.main.async { [weak self] in
                    self?.snapshot = s
                }
            } catch {
                // Silently skip malformed lines (startup noise, partial frames)
            }
        }

        handle.waitForDataInBackgroundAndNotify()
    }

    deinit { stop() }
}
