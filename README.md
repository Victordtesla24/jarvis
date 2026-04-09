  
  


```
     ╔═══════════════════════════════════════════════════════════╗
     ║                                                           ║
     ║       ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗             ║
     ║       ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝             ║
     ║       ██║███████║██████╔╝██║   ██║██║███████╗             ║
     ║  ██   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║             ║
     ║  ╚█████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║             ║
     ║   ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝             ║
     ║                                                           ║
     ║          Just A Rather Very Intelligent System            ║
     ║                                                           ║
     ╚═══════════════════════════════════════════════════════════╝
```

  




  
  


> *"Good evening, sir. I've prepared a full diagnostic of your system."*

  




  
  


---

  


```
┌─────────────────────────────────────────────────────────────┐
│  SYSTEM: ONLINE    REACTOR: NOMINAL    TELEMETRY: STREAMING │
└─────────────────────────────────────────────────────────────┘
```



  


## `> SYSTEM.OVERVIEW`

**JARVIS Telemetry** is a cinema-grade macOS heads-up display that transforms your desktop into a real-time Iron Man–style reactor interface. It renders a full-screen arc reactor HUD at wallpaper level — sitting beneath all windows while streaming live Apple Silicon telemetry data from CPU, GPU, memory, and thermal sensors.

Every ring, tick mark, bezel panel, and data arc is drawn at **60fps** in a SwiftUI `Canvas` — no images, no WebKit, no Electron. Pure GPU-accelerated vector rendering.

  




```
╔═══════════════════════════════════════════════════════════════╗
║                    ◆ CORE ARCHITECTURE ◆                      ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ┌──────────────┐    JSON Stream    ┌──────────────────────┐  ║
║  │  Go Daemon   │ ───────────────── │  TelemetryBridge     │  ║
║  │  (mactop)    │   stdout pipe     │  (Swift Combine)     │  ║
║  └──────────────┘                   └──────────┬───────────┘  ║
║                                                │              ║
║                                     @Published │              ║
║                                                ▼              ║
║                                    ┌───────────────────────┐  ║
║                                    │   TelemetryStore      │  ║
║                                    │  (ObservableObject)   │  ║
║                                    └──────────┬────────────┘  ║
║                                               │               ║
║                            ┌──────────────────┼────────┐      ║
║                            ▼                  ▼        ▼      ║
║                   ┌──────────────┐  ┌─────────────┐ ┌──────┐  ║
║                   │ ReactorCanvas│  │ Side Panels │ │ Bars │  ║
║                   │  (220 rings  │  │ (Gauges +   │ │(Time │  ║
║                   │   + bezels   │  │  HoloPanels)│ │+Date)│  ║
║                   │   + arcs)    │  │             │ │      │  ║
║                   └──────────────┘  └─────────────┘ └──────┘  ║
║                                                               ║
║              All rendered in NSWindow @ desktopWindow level   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```



  


## `> SUBSYSTEMS`

  





| Module          | File                       | Role                                                                |
| --------------- | -------------------------- | ------------------------------------------------------------------- |
| `◈ App Entry`   | `JarvisTelemetryApp.swift` | `@main` — delegates to `AppDelegate` for wallpaper window           |
| `◈ Window Mgr`  | `AppDelegate.swift`        | Creates borderless `NSWindow` at `kCGDesktopWindowLevel` per screen |
| `◈ Root View`   | `JarvisRootView.swift`     | Orchestrates preloader → HUD transition with phase animation        |
| `◈ Preloader`   | `JarvisPreloader.swift`    | 3.2s SceneKit cinematic wireframe boot sequence                     |
| `◈ HUD`         | `JarvisHUDView.swift`      | **1400+ lines** — Full reactor canvas, 15+ view structs             |
| `◈ Canvas Host` | `AnimatedCanvasHost.swift` | `TimelineView` wrapper driving 60fps phase propagation              |
| `◈ Bridge`      | `TelemetryBridge.swift`    | Async JSON stream reader from Go daemon via `Process` pipe          |
| `◈ Store`       | `TelemetryStore.swift`     | `@Published` properties — CPU, GPU, memory, thermals                |
| `◈ Daemon`      | `mactop/`                  | Go-based Apple Silicon telemetry collector (`--headless` mode)      |




  


## `> REACTOR.ANATOMY`

The central reactor is built from **220+ concentric rings** with layered structural detail:

```
    ┌─────────────────────────────────────────────────────────┐
    │                                                         │
    │   1.08R ─── ▓▓▓ OUTER BEZEL (thick industrial steel) ▓▓▓
    │   0.94R ─── ═══ Amber accent ring ═══                   │
    │   0.93R ─── ~~~ Rotating glow arcs ~~~                  │
    │   0.91R ─── ▬▬▬ GPU data arc ▬▬▬                        │
    │   0.89R ─── ▓▓▓ INTERMEDIATE BEZEL 1 ▓▓▓                │
    │   0.84R ─── ─── E-Core data ring (cyan) ───             │
    │   0.78R ─── ▓▓▓ INTERMEDIATE BEZEL 2 ▓▓▓                │
    │   0.74R ─── ─── P-Core data ring (amber) ───            │
    │   0.68R ─── ~~~ Mid rotating arcs ~~~                   │
    │   0.64R ─── ─── S-Core data ring (crimson) ───          │
    │   0.58R ─── ~~~ Inner rotating arcs ~~~                 │
    │   0.44R ─── ═══ Reactor boundary glow ═══               │
    │   0.34R ─── ··· Deep core detail ···                    │
    │   0.02R ─── ● Core pinpoint glow ●                      │
    │                                                         │
    │   + 150-tick outer ring (CW rotation)                   │
    │   + 100-tick secondary ring (CCW rotation)              │
    │   + 80/60/48/36/24 tick rings (various speeds)          │
    │   + Radial spokes at every bezel boundary               │
    │   + Radar sweep line with trailing glow wedge           │
    │   + Degree markers at 45° intervals                     │
    │   + Hex grid background + CRT scan lines                │
    │                                                         │
    └─────────────────────────────────────────────────────────┘
```

  


## `> COLOR.PALETTE`




| Swatch  | Name            | Hex       | Role                                            |
| ------- | --------------- | --------- | ----------------------------------------------- |
| #00D4FF | **Cyan**        | `#00D4FF` | Primary HUD color — rings, ticks, data arcs     |
| #69F1F1 | **Cyan Bright** | `#69F1F1` | Highlights, central watt display, glow peaks    |
| #008CB3 | **Cyan Dim**    | `#008CB3` | Subtle accents, background glow arcs            |
| #FFC800 | **Amber**       | `#FFC800` | P-Core arcs, bezel accent ring, warm highlights |
| #FF2633 | **Crimson**     | `#FF2633` | S-Core arcs, thermal alerts, warning state      |
| #668494 | **Steel**       | `#668494` | Structural rings, bezels, tick marks, spokes    |
| #050A14 | **Dark Blue**   | `#050A14` | Background — deep space black                   |
| #00334D | **Grid Blue**   | `#00334D` | Hex grid pattern overlay                        |




  


## `> TELEMETRY.CHANNELS`

```
┌─────────────────────────────────────────────────────────┐
│ CHANNEL              SOURCE           UPDATE RATE       │
├─────────────────────────────────────────────────────────┤
│ CPU Usage (%)        IOKit/HID        1 Hz              │
│ GPU Usage (%)        IOKit/HID        1 Hz              │
│ E-Core Usage []      per-core HID     1 Hz              │
│ P-Core Usage []      per-core HID     1 Hz              │
│ S-Core Usage []      per-core HID     1 Hz              │
│ CPU Power (W)        SMC sensors      1 Hz              │
│ GPU Power (W)        SMC sensors      1 Hz              │
│ Total Power (W)      SMC sensors      1 Hz              │
│ SoC Temperature (°C) SMC sensors      1 Hz              │
│ DRAM Read BW (GB/s)  IOKit counters   1 Hz              │
│ DRAM Write BW (GB/s) IOKit counters   1 Hz              │
│ Memory Used (GB)     host_statistics  1 Hz              │
│ Thermal State        processorSpeed   1 Hz              │
│ DVHOP CPU Tax (%)    custom metric    1 Hz              │
│ GUMER UMA Rate (MB/s) custom metric  1 Hz               │
│ CCTC Thermal Δ (°C)  custom metric    1 Hz              │
└─────────────────────────────────────────────────────────┘
```

  


## `> INSTALLATION`

### Prerequisites

```bash
# Required
→ macOS 14.0+ (Sonoma or later)
→ Apple Silicon (M1/M2/M3/M4)
→ Xcode 15+ or Swift 5.9+ toolchain
→ Go 1.21+ (for daemon compilation)
```

### Build & Run

```bash
# ── 1. Clone ──────────────────────────────────────────────
git clone https://github.com/Victordtesla24/jarvis.git
cd jarvis

# ── 2. Build the Go telemetry daemon ─────────────────────
cd mactop
go build -o ../JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon .
cd ..

# ── 3. Build the Swift HUD application ───────────────────
cd JarvisTelemetry
swift build -c release

# ── 4. Run (requires sudo for IOKit sensor access) ───────
sudo .build/release/JarvisTelemetry
```

### Launch at Login (Optional)

```bash
# Create a launchd plist for auto-start
cat > ~/Library/LaunchAgents/com.jarvis.telemetry.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.jarvis.telemetry</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/sudo</string>
        <string>/path/to/JarvisTelemetry</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.jarvis.telemetry.plist
```

  


## `> RENDERING.PIPELINE`

```
┌──────────────┐      ┌──────────────┐     ┌───────────────────┐
│  TimelineView │ ──► │ Phase Clock  │ ──► │ Canvas { ctx in   │
│  (.animation) │     │ (continuous) │     │   // 220 rings    │
└──────────────┘      └──────────────┘     │   // 8 tick sets  │
                                           │   // 3 bezels     │
                                           │   // 4 glow arcs  │
                                           │   // 3 data rings │
                                           │   // sweep + core │
                                           │ }                 │
                                           └───────────────────┘
                                                    │
                                                    ▼
                                           GPU-composited frame
                                           @ 60 fps per screen
```

Every visual element is a `Path` stroke or fill — no `Image`, no `UIBezierPath`, no external textures. The `Canvas` renderer draws **700+ paths per frame** with layered bloom effects achieved through multiple strokes at decreasing opacity and increasing line width.

  


## `> PROJECT.STRUCTURE`

```
jarvis/
├── JarvisTelemetry/
│   ├── Package.swift                          # SPM manifest (macOS 14+)
│   └── Sources/JarvisTelemetry/
│       ├── JarvisTelemetryApp.swift           # @main entry point
│       ├── AppDelegate.swift                  # Wallpaper window manager
│       ├── JarvisRootView.swift               # Preloader → HUD orchestrator
│       ├── JarvisPreloader.swift              # SceneKit 3.2s boot sequence
│       ├── AnimatedCanvasHost.swift           # 60fps TimelineView wrapper
│       ├── JarvisHUDView.swift                # ◆ Full reactor + 15 view structs
│       ├── TelemetryBridge.swift              # JSON stream from Go daemon
│       ├── TelemetryStore.swift               # @Published telemetry properties
│       └── Resources/
│           └── jarvis-mactop-daemon           # Compiled Go binary (build artifact)
├── mactop/                                     # Go telemetry daemon source
│   ├── main.go
│   ├── go.mod
│   ├── go.sum
│   ├── Makefile
│   └── internal/                               # IOKit + SMC sensor readers
├── jarvis-hud-preview.html                     # HTML Canvas mirror for previews
├── hud-preview-screenshot.png                  # Latest rendered preview
├── real-jarvis-01.jpg                          # Reference: Iron Man HUD
├── real-jarvis-02.jpg                          # Reference: Iron Man HUD
├── real-jarvis-03.jpg                          # Reference: Iron Man HUD
└── README.md                                   # ◄ You are here
```

  


## `> DESIGN.PHILOSOPHY`

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║    "The interface should feel like it was built by        ║
║     Tony Stark — not rendered by a computer."             ║
║                                                           ║
║  ┌─ STEEL OVER NEON ──────────────────────────────────┐   ║
║  │ Structural gray-steel dominates. Cyan is accent,   │   ║
║  │ not protagonist. The bezel is dark and industrial. │   ║
║  └────────────────────────────────────────────────────┘   ║
║                                                           ║
║  ┌─ PRECISION OVER GLOW ──────────────────────────────┐   ║
║  │ Data arcs are thin (3px). Bloom is restrained.     │   ║
║  │ Every line serves a purpose. No decorative excess. │   ║
║  └────────────────────────────────────────────────────┘   ║
║                                                           ║
║  ┌─ DENSITY CREATES AUTHORITY ────────────────────────┐   ║
║  │ 220 concentric rings. 700+ paths per frame.        │   ║
║  │ The complexity IS the aesthetic.                   │   ║
║  └────────────────────────────────────────────────────┘   ║
║                                                           ║
║  ┌─ REAL DATA, REAL TIME ────────────────────────────┐    ║
║  │ Every colored arc maps to actual sensor data.     │    ║
║  │ This is a monitoring tool, not a screensaver.     │    ║
║  └───────────────────────────────────────────────────┘    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

  


## `> REFERENCES`

This project's visual language is inspired by the JARVIS/F.R.I.D.A.Y. interfaces from the **Iron Man** and **Avengers** film series by Marvel Studios, and draws from the open-source sci-fi UI ecosystem:

- **[Arwes](https://arwes.dev/)** — Futuristic sci-fi UI framework (design philosophy reference)
- **[mactop](https://github.com/context-labs/mactop)** — Apple Silicon telemetry backend
- **[Encom Boardroom](https://github.com/arscan/enern-boardroom)** — TRON-inspired WebGL globe

  




---

  


```
┌─────────────────────────────────────────────────┐
│                                                 │
│   S Y S T E M    S T A T U S :   O N L I N E    │
│                                                 │
│          ◈  All reactors nominal  ◈             │
│          ◈  Telemetry streaming   ◈             │
│          ◈  HUD rendering @ 60fps ◈             │
│                                                 │
└─────────────────────────────────────────────────┘
```

  




  
  


*"Will that be all, sir?"*

  


