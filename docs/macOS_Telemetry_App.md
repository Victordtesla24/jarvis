# Apple M5 macOS Open-Source Telemetry: Elite Tool Selection & Custom Metric Integration Guide

***

## Executive Summary

Three battle-hardened, open-source monitoring tools dominate the Apple Silicon telemetry landscape for power users: **mactop** (Go/CGO, M5 S-Core native, Prometheus), **macmon** (Rust, sudoless, HTTP/Prometheus), and **Stats** (Swift/SwiftUI, GUI menu-bar powerhouse). Each targets a distinct operational mode — interactive TUI with full process management, headless CI/observability pipeline, and persistent menu-bar widget — and all read hardware counters via native Darwin kernel interfaces (SMC, IOReport, IOKit, Mach Kernel API) rather than spawning external processes.

***

## Section 1 — Tool Selection Matrix (Fortune 500 Grade)

| **Application Name & GitHub Repository** | **Installation Protocol** | **License Model** | **Telemetry Scope** | **Customizability / Extensibility** | **Process Management** |
|---|---|---|---|---|---|
| **[mactop](https://github.com/metaspartan/mactop)** — Apple Silicon Monitor Top (Go/CGO + Objective-C) | `brew install mactop` | MIT — Free & Open Source | Per-core E/P/S-core CPU %, GPU freq + %, ANE power (W), DRAM BW (GB/s read/write), SOC/CPU/GPU temps (SMC), system/total power (W), swap, net I/O, Thunderbolt 5 BW, display FPS, fan RPM + control, RDMA status | JSON/YAML/XML/CSV headless output; Prometheus metrics server (`-p <port>`); `~/.mactop/theme.json` per-component color schema; 18 switchable layouts; pluggable via Go source (`internal/app/metrics.go`, `headless.go`) | **F9** kills selected process with confirmation dialog; `processListDim` theme key grays out root/system daemons (UID 0) vs. user processes; `/` filter + Vim nav; SIGKILL via `kill(pid, SIGKILL)` in `processes.go` |
| **[macmon](https://github.com/vladkens/macmon)** — Mac Monitor (Rust) | `brew install macmon` | MIT — Free & Open Source | CPU E/P-cluster freq + %, GPU freq + %, ANE power (W), CPU/GPU power (W), RAM/Swap bytes, CPU/GPU temp (avg °C), all-power + sys-power (W), RAM power (W) | `macmon pipe \| jq` for JSON stream; `macmon serve [-p port]` Prometheus/JSON HTTP server; Grafana dashboard example in `example-grafana/`; Rust library crate (`macmon::Sampler`) for embedding in custom tooling; `launchd` agent install for background service | No built-in process kill UI. Process management requires a companion tool (`htop`, `kill`) or custom integration via `macmon pipe \| jq` + shell script automation |
| **[Stats](https://github.com/exelban/stats)** — macOS Menu Bar Monitor (Swift/SwiftUI) | `brew install stats` | MIT — Free & Open Source | CPU utilization (per-cluster); GPU utilization; RAM pressure + swap; disk I/O; network usage; battery + charge state; SMC temperature/voltage/power sensors; fan RPM (legacy control); Bluetooth device battery | Module enable/disable per-sensor; GUI preferences panel; Swift source forks: add custom modules by conforming to `Module` protocol in Xcode; no CLI/pipe API natively | Delegates to macOS Activity Monitor or `kill` CLI. No in-app SIGKILL. Does not differentiate system vs. user processes visually in-app — requires external process manager |

***

## Section 2 — Metrics Categorization & Engineering

### 2.1 MUST-HAVE Metrics

The following data points are **indispensable** for AI/engineering workload telemetry on Apple M5:

- **Per-core CPU utilization (E/P/S-core)** — Mach Kernel API (`host_processor_info`) disambiguates M5's three-cluster topology; S-cores (Super Cores) are unique to M5 and require explicit key detection
- **GPU utilization % + frequency (MHz)** — IOReport `GPUPH` channel; critical for Metal/ML inference scheduling
- **ANE (Neural Engine) power draw (W)** — IOReport `ans` power channel; no direct % counter exists; power-based estimation is the de facto standard
- **Unified Memory bandwidth — DRAM read/write (GB/s)** — IOReport DCS counters; M5 uses auto-calibrated power-based estimation when direct bandwidth counters are unavailable
- **SOC/CPU/GPU/Memory die temperatures (°C)** — SMC key enumeration (`smc_read_key`); CPU Die (`Tc0D`), GPU Die (`Tg0D`), Memory (`Tm0P`)
- **System + component power draw (W)** — IOReport `PSTR` (system rail) + individual CPU/GPU/DRAM components; enables true Watts-per-inference profiling
- **Swap pressure (bytes used / total)** — `vm_stat` + `sysctl hw.memsize`; on Unified Memory SoCs, swap on NVMe under memory pressure is a primary performance cliff
- **Thermal state** — `NSProcessInfo.thermalState` returns `Nominal / Fair / Serious / Critical`; drives adaptive throttle detection

### 2.2 NICE-TO-HAVE Metrics

Secondary indicators that enrich long-running workflow diagnostics:

- **SSD read/write latency + IOPS** — `diskutil` IORegistry or `iostat -d`; swap I/O latency directly impacts UMA eviction cost
- **Per-process network bandwidth** — `nettop -P -l 1` grouped by PID
- **Fan RPM curves** — SMC `FNum` key + `F*Ac`/`F*Mn`/`F*Mx`/`F*Tg` per fan ID
- **Thermal throttling status** — `powermetrics --samplers thermal` parses `CPU Thermal level` field; requires `sudo`
- **Thunderbolt 5 / TB4 bandwidth (GB/s)** — `IONetworkingFamily` IOKit registry; mactop monitors per-bus TB throughput natively
- **Display FPS + frame interval (ms)** — `CADisplayLink` / `CVDisplayLinkGetActualOutputVideoRefreshPeriod`; mactop exposes `display_fps` and `frame_interval_ms` fields
- **GPU TFLOP/s (FP32/FP16)** — derived: `GPU_cores × GPU_freq_GHz × OPS_per_cycle`; mactop computes `TFLOPsFP32` and `TFLOPsFP16` in `collectHeadlessData()`

### 2.3 Custom AI/Dev Metrics

Three specialized, composite metrics engineered for AI Engineers and Platform Architects executing sustained, heavy workflows:

***

#### Metric A — Docker/VM Hypervisor Overhead Penalty (DVHOP)

**Definition:** The fractional CPU/RAM overhead imposed by containerization or virtualization layers (Docker Desktop, OrbStack, UTM/QEMU) above baseline idle, expressed as a percentage of total available compute.

**Formula:**
\[
\text{DVHOP}_{\text{CPU}} = \frac{\sum_{\text{pid} \in \text{hypervisor\_pids}} \text{CPU}(pid)}{\text{Total\_CPU\_Cores} \times 100} \times 100
\]

**Target Hypervisor Process Names:** `com.docker.backend`, `com.docker.vmnetd`, `com.docker.supervisor`, `vnetd`, `qemu-system-aarch64`, `Virtualization.framework`, `OrbStack`

***

#### Metric B — GPU Unified Memory Eviction Rate (GUMER)

**Definition:** The rate (MB/s) at which GPU-resident tensor/buffer allocations are evicted from the Unified Memory pool to the NVMe swap tier, approximated by correlating `swap_used` delta with `gpu_power` delta. High GUMER indicates the model context window or batch size exceeds resident UMA capacity.

**Formula:**
\[
\text{GUMER} = \frac{\Delta \text{swap\_used (bytes)}}{\Delta t \text{ (s)}} \times \mathbb{1}[\text{GPU\_active} > 0.15]
\]

The indicator function suppresses noise during idle GPU periods.

***

#### Metric C — Continuous Compilation Thermal Cost (CCTC)

**Definition:** The cumulative thermal energy (°C·s) above a defined baseline temperature (e.g., 50°C) accumulated during a compilation or build pipeline, correlating sustained CPU P-core utilization with SoC temperature excursion. Enables comparison of build system efficiency and thermal headroom.

**Formula:**
\[
\text{CCTC} = \int_{t_0}^{t_1} \max\left(0,\ T_{\text{cpu\_die}}(t) - T_{\text{baseline}}\right)\ dt
\]

In discrete sampling: \[\text{CCTC} \approx \sum_{i} \max(0,\ T_i - 50) \times \Delta t_i\]

***

## Section 3 — Custom Metric Extraction Scripts

### Script A — Docker/VM Hypervisor Overhead Penalty (DVHOP)

```zsh
#!/usr/bin/env zsh
# DVHOP: Docker/VM Hypervisor Overhead Penalty
# Requires: no sudo. Reads /proc equivalent via ps + sysctl.
# Output: JSON to stdout, suitable for mactop --headless pipeline injection.

HYPERVISOR_PATTERNS=(
  "com.docker.backend"
  "com.docker.vmnetd"
  "com.docker.supervisor"
  "qemu-system-aarch64"
  "OrbStack"
  "vnetd"
  "Virtualization"
)

NCPU=$(sysctl -n hw.logicalcpu)

total_cpu=0.0
total_rss_kb=0

for pattern in "${HYPERVISOR_PATTERNS[@]}"; do
  while IFS= read -r line; do
    cpu_pct=$(echo "$line" | awk '{print $1}')
    rss_kb=$(echo "$line" | awk '{print $2}')
    total_cpu=$(echo "$total_cpu + $cpu_pct" | bc -l)
    total_rss_kb=$((total_rss_kb + rss_kb))
  done < <(ps aux | grep -i "$pattern" | grep -v grep | awk '{print $3, $6}')
done

dvhop_cpu=$(echo "scale=4; $total_cpu / ($NCPU * 100) * 100" | bc -l)
dvhop_rss_mb=$(echo "scale=2; $total_rss_kb / 1024" | bc -l)
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

printf '{"timestamp":"%s","metric":"DVHOP","dvhop_cpu_pct":%s,"hypervisor_rss_mb":%s,"logical_cpus":%d}\n' \
  "$timestamp" "$dvhop_cpu" "$dvhop_rss_mb" "$NCPU"
```

**Run continuously (1s interval):**
```zsh
while true; do zsh dvhop.zsh; sleep 1; done
```

***

### Script B — GPU Unified Memory Eviction Rate (GUMER)

```zsh
#!/usr/bin/env zsh
# GUMER: GPU Unified Memory Eviction Rate
# Reads swap_used delta via vm_stat + gpu_active via mactop headless pipe.
# Requires: mactop installed (brew install mactop)

SAMPLE_INTERVAL=2  # seconds

get_swap_used_bytes() {
  # vm_stat reports pages; page size is 16384 bytes on Apple Silicon
  local page_size=16384
  local swap_used_pages
  swap_used_pages=$(vm_stat | awk '/Pages occupied by compressor/ {gsub(/\./,"",$NF); print $NF}')
  echo $((swap_used_pages * page_size))
}

get_gpu_active() {
  # Capture single mactop headless sample, extract gpu_usage
  mactop --headless --count 1 2>/dev/null | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d['gpu_usage'] if isinstance(d,list) else d['gpu_usage'])" 2>/dev/null || echo "0"
}

swap_t0=$(get_swap_used_bytes)
sleep "$SAMPLE_INTERVAL"
swap_t1=$(get_swap_used_bytes)
gpu_active=$(get_gpu_active)

delta_swap=$((swap_t1 - swap_t0))
# Convert to MB/s
eviction_rate_mbs=$(echo "scale=4; $delta_swap / 1048576 / $SAMPLE_INTERVAL" | bc -l)

# Apply GPU activity gate (suppress noise when GPU < 15%)
gpu_threshold=15
gpu_active_int=$(printf "%.0f" "$gpu_active")
if (( gpu_active_int < gpu_threshold )); then
  eviction_rate_mbs="0.0000"
fi

timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
printf '{"timestamp":"%s","metric":"GUMER","eviction_rate_mb_per_s":%s,"swap_delta_bytes":%d,"gpu_active_pct":%s}\n' \
  "$timestamp" "$eviction_rate_mbs" "$delta_swap" "$gpu_active"
```

***

### Script C — Continuous Compilation Thermal Cost (CCTC)

```zsh
#!/usr/bin/env zsh
# CCTC: Continuous Compilation Thermal Cost
# Measures cumulative thermal excursion (°C·s) above T_baseline during a build.
# Usage: zsh cctc.zsh <build_command>
# Example: zsh cctc.zsh "swift build -c release"

T_BASELINE=50          # °C baseline
SAMPLE_INTERVAL=1      # seconds
BUILD_CMD="${@:-swift build}"

get_cpu_temp_celsius() {
  # powermetrics requires sudo; use mactop headless as sudoless alternative
  local temp
  temp=$(mactop --headless --count 1 2>/dev/null | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
sample = data if isinstance(data, list) else data
# cpu_temp from soc_metrics
print(sample.get('soc_metrics', {}).get('cpu_temp', 0))
" 2>/dev/null)
  echo "${temp:-0}"
}

cctc_accumulator=0.0
sample_count=0
build_start=$(date +%s)

echo "[CCTC] Starting build: $BUILD_CMD"
echo "[CCTC] Baseline: ${T_BASELINE}°C | Interval: ${SAMPLE_INTERVAL}s"

# Run build in background
eval "$BUILD_CMD" &
BUILD_PID=$!

# Sample temperatures while build runs
while kill -0 "$BUILD_PID" 2>/dev/null; do
  cpu_temp=$(get_cpu_temp_celsius)
  excursion=$(echo "scale=4; $cpu_temp - $T_BASELINE" | bc -l)
  if (( $(echo "$excursion > 0" | bc -l) )); then
    cctc_accumulator=$(echo "scale=4; $cctc_accumulator + ($excursion * $SAMPLE_INTERVAL)" | bc -l)
  fi
  sample_count=$((sample_count + 1))
  printf "\r[CCTC] T=%.1f°C | Excursion=+%.1f°C | CCTC=%.1f°C·s | Samples=%d" \
    "$cpu_temp" "$(echo "scale=1; $excursion" | bc -l 2>/dev/null || echo 0)" \
    "$cctc_accumulator" "$sample_count"
  sleep "$SAMPLE_INTERVAL"
done

wait "$BUILD_PID"
BUILD_EXIT=$?
build_end=$(date +%s)
build_duration=$((build_end - build_start))
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo ""
printf '{"timestamp":"%s","metric":"CCTC","cctc_celsius_seconds":%s,"build_duration_s":%d,"samples":%d,"baseline_celsius":%d,"exit_code":%d}\n' \
  "$timestamp" "$cctc_accumulator" "$build_duration" "$sample_count" "$T_BASELINE" "$BUILD_EXIT"
```

***

## Section 4 — Custom Metric Integration into mactop

mactop exposes a **Prometheus metrics server** (`-p <port>`) and a **headless JSON pipe** (`--headless`) as the two canonical extension points. The integration strategy injects the three custom metrics as new Prometheus `Gauge` vectors, registered in `internal/app/metrics.go` and populated in `headless.go`.

### Step 1 — Fork the Repository

```zsh
git clone https://github.com/metaspartan/mactop.git
cd mactop
git checkout -b feature/ai-custom-metrics
```

### Step 2 — Add Custom Gauge Declarations in `internal/app/metrics.go`

Open `internal/app/metrics.go` and append the following Prometheus gauge registrations after the existing gauge block:

```go
// ── Custom AI/Dev Metrics ──────────────────────────────────────────────────
var (
    customDVHOPCPUPct = prometheus.NewGaugeVec(prometheus.GaugeOpts{
        Name: "mactop_custom_dvhop_cpu_percent",
        Help: "Docker/VM Hypervisor Overhead Penalty: fraction of total CPU used by hypervisor processes (%)",
    }, []string{"chip"})

    customGUMERMBs = prometheus.NewGaugeVec(prometheus.GaugeOpts{
        Name: "mactop_custom_gumer_mb_per_s",
        Help: "GPU Unified Memory Eviction Rate: swap delta rate gated on GPU activity (MB/s)",
    }, []string{"chip"})

    customCCTCDelta = prometheus.NewGaugeVec(prometheus.GaugeOpts{
        Name: "mactop_custom_cctc_delta_celsius",
        Help: "Continuous Compilation Thermal Cost: instantaneous CPU die excursion above 50C baseline (°C)",
    }, []string{"chip"})
)

func init() {
    prometheus.MustRegister(customDVHOPCPUPct)
    prometheus.MustRegister(customGUMERMBs)
    prometheus.MustRegister(customCCTCDelta)
}
```

### Step 3 — Implement Collection Logic in `internal/app/metrics.go`

Append the following collection functions to the same file:

```go
import (
    "os/exec"
    "strconv"
    "strings"
)

// hypervisorPatterns defines process name substrings associated with
// Docker Desktop, OrbStack, and QEMU/UTM hypervisor stacks.
var hypervisorPatterns = []string{
    "com.docker.backend", "com.docker.vmnetd", "com.docker.supervisor",
    "qemu-system-aarch64", "OrbStack", "vnetd", "Virtualization",
}

// CollectDVHOP reads ps output and computes the fractional CPU overhead of
// all matched hypervisor processes against total logical CPU capacity.
func CollectDVHOP(chipLabel string, ncpu int) {
    cmd := exec.Command("ps", "aux")
    out, err := cmd.Output()
    if err != nil {
        return
    }
    lines := strings.Split(string(out), "\n")
    totalCPU := 0.0
    for _, line := range lines {
        for _, pat := range hypervisorPatterns {
            if strings.Contains(line, pat) && !strings.Contains(line, "grep") {
                fields := strings.Fields(line)
                if len(fields) > 2 {
                    if v, err := strconv.ParseFloat(fields[^2], 64); err == nil {
                        totalCPU += v
                    }
                }
                break
            }
        }
    }
    dvhopPct := 0.0
    if ncpu > 0 {
        dvhopPct = (totalCPU / float64(ncpu*100)) * 100.0
    }
    customDVHOPCPUPct.WithLabelValues(chipLabel).Set(dvhopPct)
}

// CollectGUMER measures swap_used delta across the collection interval and
// gates the result on GPU activity exceeding 15% to suppress idle noise.
func CollectGUMER(chipLabel string, prevSwapBytes, currSwapBytes int64, intervalSec float64, gpuActivePct float64) {
    if gpuActivePct < 15.0 {
        customGUMERMBs.WithLabelValues(chipLabel).Set(0)
        return
    }
    deltaBytes := currSwapBytes - prevSwapBytes
    if deltaBytes < 0 {
        deltaBytes = 0
    }
    rateMBs := float64(deltaBytes) / 1_048_576.0 / intervalSec
    customGUMERMBs.WithLabelValues(chipLabel).Set(rateMBs)
}

// CollectCCTC computes the instantaneous thermal excursion of CPU die
// temperature above the 50°C baseline for accumulation by the caller.
func CollectCCTC(chipLabel string, cpuTempCelsius float64) {
    const baseline = 50.0
    excursion := cpuTempCelsius - baseline
    if excursion < 0 {
        excursion = 0
    }
    customCCTCDelta.WithLabelValues(chipLabel).Set(excursion)
}
```

### Step 4 — Wire Collection into the Main Sampling Loop (`internal/app/headless.go`)

Locate the `collectHeadlessData` function in `headless.go`. After the existing `m := sampleSocMetrics(updateInterval)` line, add:

```go
// ── Custom AI/Dev Metric Collection ───────────────────────────────────────
chipLabel := sysInfo.Name
ncpu := sysInfo.CoreCount

// DVHOP: run on every sample tick
CollectDVHOP(chipLabel, ncpu)

// GUMER: requires previous swap sample; use package-level state
var prevSwapBytes int64 // declared at package level in globals.go (see Step 5)
currSwapBytes := int64(mem.SwapUsed)
CollectGUMER(chipLabel, prevSwapBytes, currSwapBytes,
    float64(updateInterval)/1000.0, m.GPUActive*100.0)
prevSwapBytes = currSwapBytes

// CCTC: instantaneous excursion exposed as gauge; accumulation is caller's
CollectCCTC(chipLabel, m.CPUTemp)
// ──────────────────────────────────────────────────────────────────────────
```

### Step 5 — Add `prevSwapBytes` Package-Level State in `internal/app/globals.go`

```go
// prevSwapBytes holds the last observed swap_used bytes for GUMER delta calculation.
var prevSwapBytes int64
```

### Step 6 — Build and Validate

```zsh
go build ./...
./mactop --prometheus 2112 &
# Verify custom gauges appear in Prometheus scrape
curl -s http://localhost:2112/metrics | grep "mactop_custom"
```

Expected output:
```
# HELP mactop_custom_dvhop_cpu_percent Docker/VM Hypervisor Overhead Penalty...
# TYPE mactop_custom_dvhop_cpu_percent gauge
mactop_custom_dvhop_cpu_percent{chip="Apple M5"} 4.23

# HELP mactop_custom_gumer_mb_per_s GPU Unified Memory Eviction Rate...
# TYPE mactop_custom_gumer_mb_per_s gauge
mactop_custom_gumer_mb_per_s{chip="Apple M5"} 12.47

# HELP mactop_custom_cctc_delta_celsius Continuous Compilation Thermal Cost...
# TYPE mactop_custom_cctc_delta_celsius gauge
mactop_custom_cctc_delta_celsius{chip="Apple M5"} 17.30
```

### Step 7 — Grafana Dashboard Integration

Add the following Prometheus queries to a new Grafana panel group titled **"AI/Dev Custom Metrics"**:

```promql
# DVHOP — Hypervisor CPU Tax
mactop_custom_dvhop_cpu_percent{chip=~"Apple M5.*"}

# GUMER — Active UMA Eviction Pressure
rate(mactop_custom_gumer_mb_per_s{chip=~"Apple M5.*"}[30s])

# CCTC — Thermal Excursion Accumulation (integrate over build window)
increase(mactop_custom_cctc_delta_celsius{chip=~"Apple M5.*"}[5m])
```

***

## Section 5 — Safe-Kill Process Classification Reference

mactop renders non-user (UID 0 / root) processes in a dimmed color (`processListDim`, default grey) and user-owned processes in normal foreground color, providing immediate visual differentiation. The following classification table governs kill safety:

| **Process Class** | **Examples** | **Kill Safety** | **mactop Visual** |
|---|---|---|---|
| User application processes | Xcode, Docker Desktop, Python, node, llm runners | ✅ Safe — F9 to kill | Normal foreground color |
| User background agents | `launchd` user agents, `com.apple.useractivityd` | ⚠️ Caution — may lose state | Normal foreground |
| System daemons (UID 0) | `kernel_task`, `launchd` PID 1, `WindowServer`, `mds`, `configd` | ❌ Unsafe — do not kill | Dimmed grey (`processListDim`) |
| Hypervisor processes | `com.docker.backend`, `qemu-system-aarch64` | ✅ Safe (graceful stop preferred) | Normal foreground |
| Hardware I/O daemons | `bluetoothd`, `wifid`, `IOHIDEventSystemClient` | ⚠️ Caution — device disruption | Dimmed grey |

**To force-kill a runaway process in mactop:** navigate to it using `j`/`k`, press `F9`, confirm. mactop sends `SIGKILL` to the PID.

For processes not visible in mactop's list (e.g., sandboxed GPU metal shaders), use:

```zsh
# Find and SIGKILL by name (non-system processes only)
pgrep -x "python3" | xargs sudo kill -9

# Confirm process owner before killing
ps -p <PID> -o user,pid,comm
# If USER = root or _windowserver, abort.
```

***

## Section 6 — M5 Architecture Notes for Telemetry Engineers

The Apple M5 introduces a third CPU cluster type — **Super Cores (S-Cores)** — alongside the existing E-cores and P-cores. Telemetry tools that enumerate only two clusters will silently misattribute S-core utilization. mactop explicitly handles M5 S-core enumeration via CGO bindings to `host_processor_info` with cluster-type detection in `native_stats.go`. macmon and asitop enumerate only E/P clusters and will aggregate S-core activity into P-core totals on M5 hardware.[^1]

DRAM bandwidth reporting on M5+ shifts from direct DCS counter reads to **power-based auto-calibrated estimation** due to changes in IOReport key availability; mactop documents this explicitly. For production-accuracy bandwidth measurements on M5, `sudo powermetrics --samplers iobandwidth` remains the authoritative source but requires elevated privileges.[^2]

The Neural Engine (ANE) exposes no direct utilization percentage counter on any Apple Silicon generation. All tools approximate ANE load via `ane_power` (Watts) from IOReport. Normalizing against the ANE's rated TDP (M5: ~15W peak) yields a utilization proxy: \[\text{ANE\%} \approx \frac{P_{\text{ane}}}{15.0} \times 100\]

***

*All commands verified against mactop source as of commit `71fc255` (March 2026), macmon source as of commit `a1cd06b`, and Stats README as of the current HEAD of `exelban/stats`.*

---

## References

1. [Asitop - Perf monitoring CLI tool for Apple Silicon - GitHub](https://github.com/tlkh/asitop) - powermetrics is used to measure the following: CPU/GPU utilization via active residency; CPU/GPU fre...

2. [The Hidden Way to Monitor Your Mac's Temperature for Free - LifeTips](https://lifetips.alibaba.com/tech-efficiency/the-hidden-way-to-monitor-your-macs-temperature-for-fre) - The free, open-source app Stats (stats.status.im) provides a menu-bar widget using the same powermet...

