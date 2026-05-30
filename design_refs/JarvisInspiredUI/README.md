# J.A.R.V.I.S. MARK VII HUD

A fully client-side Iron Man inspired heads-up display built with vanilla HTML, CSS, and JavaScript. No frameworks, no build tools, no dependencies — just open `index.html` in a modern browser.

---

## Table of Contents

- [Features](#features)
- [File Structure](#file-structure)
- [Architecture Diagram](#architecture-diagram)
- [HTML Element ID Reference](#html-element-id-reference)
- [CSS File Reference](#css-file-reference)
- [JavaScript File Reference](#javascript-file-reference)
- [Feature-to-File Mapping](#feature-to-file-mapping)
- [Command Reference](#command-reference)
- [AI Conversational Engine](#ai-conversational-engine)
- [AI System Monitor](#ai-system-monitor)
- [AI Learning Engine](#ai-learning-engine)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [External APIs](#external-apis)
- [Browser APIs Used](#browser-apis-used)
- [How to Run](#how-to-run)
- [Use as a Live Desktop Wallpaper](#use-as-a-live-desktop-wallpaper)
- [Configuration](#configuration)
- [Statistics](#statistics)
- [JARVIS.exe Guide & Download](README-jarvis-exe.md)

---

## JARVIS.exe Direct Download

[Download JARVIS.exe](dist/win-unpacked/J.A.R.V.I.S.exe)

For setup, features, and usage instructions, see the [JARVIS.exe Guide](README-jarvis-exe.md).

---

## Features

### Core HUD
- **Particle System** — 80 animated particles with proximity-based interconnecting lines.
- **Arc Reactor** — Rotating ring segments, orbiting particles, dashed rings, coils, pulsing core.
- **Radar** — Rotating sweep line, concentric rings, randomised blips, border frame.
- **Chronometer** — Live date/time, day of week, and time-based greeting.
- **Weather Panel** — Temperature, humidity, wind speed via Open-Meteo API.
- **FPS Counter** — Real-time frames-per-second readout.
- **Scrolling Ticker** — Status text scrolling across the top bar.

### Data Panels
- **System Stats** — CPU, RAM, GPU temp, network speed, disk I/O, battery level with animated progress bars.
- **Threat Assessment** — Calculates threat from 9+ factors (CPU load, GPU temp, connectivity, latency, security, battery, health, online status, RF noise). Levels: MINIMAL / GUARDED / ELEVATED / HIGH.
- **System Log** — Timestamped info/warn/error/success log entries with auto-scroll.

### Network Intelligence
- **External IP / ISP / Geolocation** — Fetched from ipapi.co.
- **DNS Status / Latency** — Probes 4 endpoints with timing.
- **Throughput & Latency Sparklines** — 60-point canvas line charts.
- **Security Audit** — 6 modules: Firewall, SSL/TLS, Port Scan, IDS, Malware DB, Data Integrity.
- **SHA-512 Integrity Hash** — Generated with Web Crypto API.
- **Collapsible Panel** — Minimize/expand with collapse button.

### Process Monitor
- **Process Table** — 12 simulated processes with fluctuating CPU/memory values.
- **Subsystem Health Matrix** — 16-cell grid (CORE, NET, CRPT, THRT, SAT, HUD, etc.) with animated scanning effects.
- **Circular Gauges** — Canvas arc gauges for CPU, RAM, and temperature.
- **Uptime Counter** — Hours, minutes, seconds since boot.
- **Collapsible Panel** — Minimize/expand; uptime and gauges stay visible when collapsed.

### Satellite Tracker
- **3D Wireframe Globe** — Canvas-rendered rotating Earth with latitude/longitude lines, highlighted equator, 5 labeled satellite dots (BASE, NYC, LDN, TKY, SYD) connected by dashed lines.

### Diagnostic Overlay
- **Full System Diagnostic** — 12-module scan overlay (Core Kernel, Neural Net, Arc Reactor, Encryption, Firewall, SAT Link, Radar, Voice AI, Data Integrity, Threat DB, HUD Engine, Biometrics).
- **Automated Background Cycles** — 10 rotating checks every 45 seconds: memory leak scanner, process watchdog, S.M.A.R.T. disk health, certificate expiry, entropy pool, DNS resolution, thermal throttle, packet loss, auth token refresh, backup verification.

### Command System
- 50+ typed commands with AI conversational fallback.
- Parameterised commands: `speak`, `open`, `search`, `calc`, `timer`, `theme`, `memo`, `alias`, `whois`.
- Command history navigation with Up/Down arrows.

### Advanced AI Engine (v3.0)
- **Intent Classification** — 12+ intent categories with confidence scoring.
- **Context Memory** — 20-turn sliding window with topic/entity/sentiment tracking.
- **Fuzzy Matching** — Levenshtein-distance command correction with suggestions.
- **Sentiment Analysis** — Detects positive/negative/neutral tone and adjusts responses.
- **Chained Commands** — Execute multiple commands with `&&` or `then`.
- **Natural Language Processing** — 80+ natural language mappings to commands.
- **Personality Bank** — 30 response categories with multiple variants per category.
- **Time-Aware Responses** — Greetings and behaviour adapts to time of day.

### Real System Monitoring
- **Battery Health** — Real-time level, charging state, drain rate history, health estimation via Battery API.
- **Memory Usage** — Heap size, used/total JS heap, allocation tracking (Chrome).
- **Storage Analysis** — Quota/usage via Storage API, localStorage item count and size.
- **GPU Detection** — Renderer, vendor, GLSL version, HDR/color-gamut support via WebGL.
- **Performance Metrics** — Page load timing, DOM processing, resource fetch duration.
- **Permission Audit** — Checks camera, microphone, geolocation, notifications, clipboard access status.
- **Media Devices** — Enumerates audio/video input/output devices.
- **Geolocation** — Real GPS coordinates via Geolocation API.
- **Network Info** — Connection type, downlink speed, RTT, data saver status.
- **Full System Check** — Comprehensive scan of all subsystems with pass/warn/fail grading and visual report panel.

### Adaptive Learning Engine
- **User Profiling** — Tracks command frequency, active hours, topic interests, session count.
- **Command Prediction** — Predicts next command based on sequential usage patterns.
- **Custom Aliases** — User-defined command shortcuts (e.g., `alias set s = systemcheck`).
- **Proactive Suggestions** — Context-aware follow-up recommendations.
- **Tone Detection** — Learns preferred communication style (formal/casual/brief).
- **Persistent Memory** — All learning data saved to localStorage across sessions.
- **Analytics Report** — View personal usage statistics and peak activity hours.

### Voice Interaction
- **Voice Recognition** — Web Speech API `SpeechRecognition`. Activate with `V` or mic button.
- **Voice Synthesis** — `SpeechSynthesis` with British voice preference. Toggled via speech button (OFF by default).

### Theme Modes
- **Standard** — Cyan/blue (default).
- **Combat** — Red/orange with increased scanline intensity.
- **Stealth** — Green with visible matrix rain and softened scanlines.
- Switch with `theme standard`, `theme combat`, `theme stealth` or press `T` to cycle.

### Visual Effects
- **HUD Mouse Reticle** — Spinning rings, crosshairs, center dot, live coordinate readout.
- **Target Lock** — Red pulsing ring with rotating inner square.
- **Screen Shake** — Triggered on HIGH threat and critical events.
- **Power Surge Flash** — Full-screen brightness flash.
- **Glitch Effect** — Periodic text glitch on random HUD elements.
- **Matrix Digital Rain** — Canvas falling characters.
- **Floating Data Streams** — Hex/binary strings floating upwards.
- **Holographic Grid** — Perspective-transformed background grid.
- **Notification Toasts** — Slide-in colour-coded alerts.

### Widgets
- **Device Intelligence** — Platform, CPU cores, memory, screen, GPU, browser info.
- **Crypto Ticker** — Live Bitcoin, Ethereum, Solana prices from CoinGecko.
- **World Clock** — 6 cities: NYC, London, Tokyo, Sydney, Kathmandu, Dubai.
- **Countdown Timer** — Configurable with audio alerts.
- **Memo System** — localStorage-based notes (save/list/clear/delete).
- **Log Export** — Download system log as text file.
- **URL/App Launcher** — 30+ mapped sites, domain detection, Google search fallback.
- **Calculator** — Safe math expression evaluation.

### Audio
- **Power-Up Sound** — Plays on system initialisation.
- **Ambient Reactor Hum** — Web Audio API 60Hz + 120Hz sine waves.
- **Game Sounds** — Synthesised shoot, explosion, hit, and game-over effects.

### Bot Shooter Game
- Top-down shooter with spawning bots, repulsor bullets, wave progression, scoring, collision detection, and game-over screen. Launched via `game` command.

### Easter Egg
- Enter the Konami Code (↑↑↓↓←→←→BA) for a temporary gold theme.

---

## File Structure

```
Election/
├── index.html              — HTML markup (~420 lines), links all CSS/JS
├── README.md               — This documentation file
├── css/
│   ├── base.css            — CSS variables, reset, background effects
│   ├── boot.css            — Boot sequence overlay styles
│   ├── layout.css          — HUD panel positioning and layout
│   ├── command.css         — Command bar, voice buttons, notifications
│   ├── diagnostics.css     — Diagnostics, security, health, processes, gauges
│   ├── effects.css         — Visual effects, themes, reticle, target lock
│   ├── widgets.css         — Device panel, crypto ticker, world clock, timer
│   ├── game.css            — Bot shooter game overlay and HUD
│   └── ai-engine.css       — AI suggestion chips, system report panel
└── js/
    ├── utils.js            — DOM selectors, helpers, global flags
    ├── canvas.js           — Particle system, Arc Reactor, Radar
    ├── core.js             — Speech, terminal, time, weather, stats, log, toasts
    ├── boot.js             — Boot sequence, panel reveal, system activation
    ├── threat.js           — Threat level calculation, alerts, impact effects
    ├── effects.js          — Parallax, glitch, matrix, reticle, themes, globe, audio
    ├── tools.js            — URL launcher, calc, timer, memos, device, crypto, clock
    ├── diagnostics.js      — Network intel, security, processes, health, gauges
    ├── commands.js         — Command engine, AI responses, voice, shortcuts
    ├── init.js             — Post-boot initialization, interval scheduling
    ├── game.js             — Bot shooter game engine
    ├── ai-personality.js   — 30-category personality response bank
    ├── ai-time.js          — Time-aware greeting and schedule logic
    ├── ai-system-monitor.js — Real browser API system monitoring
    ├── ai-learning.js      — Adaptive learning engine with persistence
    ├── ai-engine.js        — AI Engine v3.0: NLP, intent, context, sentiment
    └── ai-advanced-commands.js — 20+ new commands + NL mappings
```

**Script load order** (dependency chain):
`utils.js` → `canvas.js` → `core.js` → `boot.js` → `threat.js` → `effects.js` → `tools.js` → `diagnostics.js` → `commands.js` → `init.js` → `game.js` → `ai-personality.js` → `ai-time.js` → `ai-system-monitor.js` → `ai-learning.js` → `ai-engine.js` → `ai-advanced-commands.js`

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          index.html                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │  9 CSS Files  │  │ HTML Markup  │  │       17 JS Files            │  │
│  │  (styling)    │  │ (structure)  │  │   (behaviour + logic)        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │  utils.js   │  DOM helpers, global flags
                    └──────┬──────┘
                           │ provides $(), qs(), qsa(), sleep()
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌────────────┐  ┌────────────┐   ┌────────────┐
   │ canvas.js  │  │  core.js   │   │ effects.js │
   │ Particles  │  │ speak()    │   │ Themes     │
   │ Reactor    │  │ Terminal   │   │ Globe      │
   │ Radar      │  │ Weather    │   │ Matrix     │
   └────────────┘  │ Stats      │   │ Reticle    │
                   │ Log/Toast  │   │ Audio      │
                   └─────┬──────┘   └────────────┘
                         │
          ┌──────────────┼──────────────────┐
          ▼              ▼                  ▼
   ┌────────────┐ ┌──────────────┐  ┌────────────┐
   │  boot.js   │ │  threat.js   │  │  tools.js  │
   │ Boot seq   │ │ Threat calc  │  │ URL open   │
   │ Panel show │ │ Alert system │  │ Calc/Timer │
   └────────────┘ └──────────────┘  │ Memos      │
                                    │ Crypto     │
                                    └────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────┐
     │diagnostics.js│ │commands.js│ │ game.js  │
     │ Net Intel    │ │ Cmd parse │ │ Bot class│
     │ Security     │ │ AI engine │ │ Spawning │
     │ Processes    │ │ Voice I/O │ │ Collision│
     │ Health       │ │ Shortcuts │ │ Waves    │
     └──────────────┘ └──────────┘ └──────────┘
                         │
                    ┌────┴────┐
                    │ init.js │  Startup orchestrator
                    │ Reveals │  Schedules all intervals
                    │ Panels  │
                    └─────────┘
                         │
       ┌─────────────────┼─────────────────────┐
       ▼                 ▼                     ▼
┌───────────────┐ ┌──────────────┐  ┌───────────────────┐
│ai-personality │ │  ai-time.js  │  │ai-system-monitor  │
│  30 response  │ │ Time-aware   │  │ Battery, Memory   │
│  categories   │ │ greetings    │  │ Storage, GPU, Net │
│  with PB bank │ │ & schedules  │  │ Permissions, Geo  │
└───────────────┘ └──────────────┘  └───────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌──────────────┐ ┌──────────┐ ┌─────────────────┐
   │ai-learning.js│ │ai-engine │ │ai-advanced-cmds │
   │ User profile │ │ v3.0 NLP │ │ 20+ new commands│
   │ Predictions  │ │ Intent   │ │ NL mappings     │
   │ Aliases      │ │ Context  │ │ System report   │
   │ Persistence  │ │ Sentiment│ │ panel builder   │
   └──────────────┘ └──────────┘ └─────────────────┘
```

### Data Flow

```
User Input ──► ai-engine.js (capture phase) ──► handleJarvisInput()
                                                       │
                                              Alias resolution
                                        (JarvisLearning.resolveAlias)
                                                       │
                                              Split chained commands
                                                       │
                                              ┌── processSingle() ──┐
                                              │                     │
                                        Record learning data   Extract entities
                                        (intent, topic,        Classify intent
                                         sentiment)            Analyze sentiment
                                              │                     │
                                        NL map lookup ──► Command match?
                                              │               │
                                              │          Yes: Execute + record
                                              │               + proactive suggest
                                              │          No:
                                              │          Fuzzy match? ──► suggest
                                              │               │
                                              │          enhancedAI() ──► NL patterns
                                              │          (battery, memory, storage,
                                              │           GPU, system check, etc.)
                                              │               │
                                              │          Pattern match? ──► respond
                                              │               │
                                              │          No ──► "I don't understand"
                                              │               + suggestion chip
                                              └───────────────┘
```

### Shared Global Variables

```
utils.js exports:
  $(), qs(), qsa(), sleep()
  systemActive, targetLockActive, speechEnabled, mouseX, mouseY

core.js exports:
  speak(), addLog(), showToast(), smoothStats(), countFps()
  targets, current, logMessages

canvas.js exports:
  radarBlips

threat.js exports:
  lastThreatLevel, threatScore, threatFactors

effects.js exports:
  themes, currentTheme, themeNames
  setTheme(), cycleTheme(), screenShake(), triggerPowerSurge()
  createDataStream(), startAmbientHum(), initGlobe()

diagnostics.js exports:
  realIP, realISP, realRegion, realCoords
  netHistory, latencyHistory, processes, subsystems

ai-personality.js exports:
  PB (personality bank — 30 response categories)
  pick(arr) (random array selector)

ai-time.js exports:
  jarvisSchedule (time-of-day greeting/tone/energy/suggestion)

ai-system-monitor.js exports:
  SystemMonitor (battery, network, memory, storage, gpu,
    performance, permissions, media, geolocation, fullSystemCheck)

ai-learning.js exports:
  JarvisLearning (profile, flags, recordCommand, recordTopic,
    recordInsight, predictNextCommand, aliases, getUserReport)

ai-engine.js exports:
  jarvisContext, detectTopic, classifyIntent, enhancedAI,
  processSingle, handleJarvisInput, nlMap, suggestionMap

ai-advanced-commands.js exports:
  buildSystemReportPanel(), handleAlias()
  (extends commands, nlMap, suggestionMap)
```

---

## HTML Element ID Reference

### Boot Sequence
| ID | Element | Purpose |
|----|---------|---------|
| `init-screen` | div | Boot sequence overlay container |
| `boot-bar` | div | Progress bar fill |
| `boot-stages` | div | Container for boot stage messages |
| `init-btn` | button | "ENGAGE SYSTEMS" button |

### Audio
| ID | Element | Purpose |
|----|---------|---------|
| `power-up-sound` | audio | Startup sound effect |

### Top Bar
| ID | Element | Purpose |
|----|---------|---------|
| `top-bar` | div | Status bar at top of screen |
| `ticker-text` | span | Scrolling ticker text |
| `top-time` | span | Time display |
| `top-fps` | span | FPS counter |
| `network-dot` | span | Network status indicator dot |

### Left Panel (Chronometer + Weather)
| ID | Element | Purpose |
|----|---------|---------|
| `left-panel` | div | Left data panel container |
| `big-date` | div | Large date number |
| `time` | div | Clock time |
| `full-date` | div | Full date (DD.MM.YYYY) |
| `day` | div | Day of week |
| `greeting` | div | Time-based greeting |
| `terminal-boot` | div | Terminal boot output area |
| `temp-big` | span | Large temperature display |
| `humidity` | span | Humidity percentage |
| `wind-speed` | span | Wind speed reading |
| `weather-desc` | span | Weather status description |

### Center Panel (Arc Reactor)
| ID | Element | Purpose |
|----|---------|---------|
| `center-panel` | div | Center reactor display |
| `reactor-canvas` | canvas | Reactor animation |
| `reactor-output` | span | Power output (GJ/s) |

### Right Panel (System Stats + Threat)
| ID | Element | Purpose |
|----|---------|---------|
| `right-panel` | div | Right status panel |
| `cpu-val` / `cpu-bar` | span / div | CPU percentage + bar |
| `ram-val` / `ram-bar` | span / div | RAM percentage + bar |
| `gpu-val` / `gpu-bar` | span / div | GPU temperature + bar |
| `net-val` / `net-bar` | span / div | Network speed + bar |
| `disk-val` / `disk-bar` | span / div | Disk I/O + bar |
| `bat-val` / `bat-bar` | span / div | Battery level + bar |
| `threat-bars` | div | Threat level bar container |
| `threat-label` | div | Threat level text |

### Bottom Left (Radar)
| ID | Element | Purpose |
|----|---------|---------|
| `bl-panel` | div | Bottom-left panel |
| `radar-canvas` | canvas | Radar visualisation |
| `radar-info` | div | Radar blip count |

### Bottom Right (System Log)
| ID | Element | Purpose |
|----|---------|---------|
| `br-panel` | div | Bottom-right panel |
| `log-container` | div | Log entries container |

### Audio Visualiser
| ID | Element | Purpose |
|----|---------|---------|
| `audio-canvas` | canvas | Audio spectrum bars |

### Command Bar
| ID | Element | Purpose |
|----|---------|---------|
| `command-bar` | div | Bottom command bar container |
| `cmd-input` | input | Text input for commands |
| `cmd-response` | div | Response display area |
| `voice-btn` | button | Voice recognition mic button |
| `speech-toggle` | button | Speech output toggle button |
| `speech-icon` | svg | Speech button icon |
| `key-hint` | div | Keyboard shortcuts hint |

### Mid-Left Panel (Network Intelligence)
| ID | Element | Purpose |
|----|---------|---------|
| `ml-panel` | div | Network intelligence panel |
| `ml-collapse` | button | Collapse/expand button |
| `ml-content` | div | Collapsible content wrapper |
| `ext-ip` | span | External IP address |
| `isp-name` | span | ISP name |
| `geo-region` | span | Geolocation region |
| `geo-coords` | span | Latitude/longitude |
| `dns-status` | span | DNS resolution status |
| `ping-latency` | span | Network latency |
| `endpoints-up` | span | Endpoint connectivity count |
| `net-sparkline` | canvas | Network throughput sparkline |
| `latency-sparkline` | canvas | Latency sparkline |
| `sec-firewall` | span | Firewall status dot |
| `sec-ssl` | span | SSL/TLS status dot |
| `sec-ports` | span | Port scan status dot |
| `sec-intrusion` | span | IDS status dot |
| `sec-malware` | span | Malware DB status dot |
| `sec-integrity` | span | Data integrity status dot |
| `integrity-hash` | div | SHA-512 hash display |

### Mid-Right Panel (Process Monitor)
| ID | Element | Purpose |
|----|---------|---------|
| `mr-panel` | div | Process monitor panel |
| `mr-collapse` | button | Collapse/expand button |
| `mr-content` | div | Collapsible content wrapper |
| `proc-list` | div | Process table container |
| `health-matrix` | div | 16-cell health grid |
| `up-h` / `up-m` / `up-s` | span | Uptime hours/minutes/seconds |
| `gauge-cpu` | canvas | CPU gauge |
| `gauge-ram` | canvas | RAM gauge |
| `gauge-temp` | canvas | Temperature gauge |

### Auto-Scan Indicator
| ID | Element | Purpose |
|----|---------|---------|
| `scan-indicator` | div | Auto-diagnostic running indicator |
| `scan-indicator-text` | span | Current scan task label |

### Diagnostic Overlay
| ID | Element | Purpose |
|----|---------|---------|
| `diag-overlay` | div | Full diagnostic scan overlay |
| `diag-grid` | div | 12-module diagnostic grid |
| `diag-progress` | div | Scan progress text |
| `diag-close` | button | Close diagnostic overlay |

### Notifications
| ID | Element | Purpose |
|----|---------|---------|
| `notif-float` | div | Floating notification container |

### Visual Effects
| ID | Element | Purpose |
|----|---------|---------|
| `matrix-canvas` | canvas | Digital rain effect |
| `hud-reticle` | div | Mouse reticle container |
| `reticle-coords` | span | Reticle coordinate display |
| `target-lock` | div | Target lock indicator |
| `data-streams` | div | Floating data stream container |
| `power-surge` | div | Power surge flash overlay |
| `theme-indicator` | div | Current theme mode indicator |
| `holo-grid` | div | Holographic background grid |

### System Report Panel
| ID | Element | Purpose |
|----|---------|---------|
| `system-report-panel` | div | Full system check overlay container |
| `system-report-close` | button | Close the report overlay |
| `system-report-grid` | div | Grid of check result cards |
| `system-report-summary` | div | Summary line (passed/warnings/failures) |

### Satellite Tracker
| ID | Element | Purpose |
|----|---------|---------|
| `globe-panel` | div | Globe panel container |
| `globe-canvas` | canvas | Wireframe Earth |
| `globe-label` | div | Satellite count label |

### Device Intelligence
| ID | Element | Purpose |
|----|---------|---------|
| `device-panel` | div | Device hardware info panel |
| `device-grid` | div | Device info grid |

### Crypto Ticker
| ID | Element | Purpose |
|----|---------|---------|
| `crypto-ticker` | div | Crypto price ticker |
| `btc-price` / `btc-change` | span | Bitcoin price + change % |
| `eth-price` / `eth-change` | span | Ethereum price + change % |
| `sol-price` / `sol-change` | span | Solana price + change % |

### World Clock
| ID | Element | Purpose |
|----|---------|---------|
| `wclock-panel` | div | World clock panel |
| `wclock-list` | div | Clock cities container |

### Timer
| ID | Element | Purpose |
|----|---------|---------|
| `timer-display` | div | Timer display container |
| `timer-value` | span | Countdown MM:SS display |

### Game
| ID | Element | Purpose |
|----|---------|---------|
| `game-overlay` | div | Game container overlay |
| `game-canvas` | canvas | Game rendering canvas |
| `game-score` | span | Score display |
| `game-wave` | span | Current wave |
| `game-kills` | span | Kill count |
| `game-hp` | span | Shield integrity |
| `game-hp-bar` | div | Shield health bar fill |
| `game-msg` | div | Game message display |

---

## CSS File Reference

### base.css — Variables, Reset, Background Effects

| Class / Selector | Purpose |
|-----------------|---------|
| `:root` | CSS custom properties: `--cyan`, `--cyan-dim`, `--cyan-glow`, `--gold`, `--red`, `--green`, `--bg`, `--panel-bg` |
| `*` | Global reset (margin, padding, box-sizing, font-family, colour, user-select) |
| `body` | Viewport sizing, overflow hidden, background |
| `#particle-canvas` | Full-screen particle canvas (fixed, z-index 0) |
| `.hex-grid` | Hexagonal SVG background pattern overlay |
| `.scanlines` | Horizontal scan line effect overlay |
| `.vignette` | Radial darkening gradient overlay |
| `.scan-sweep` | Horizontal light sweep bar |

| @keyframes | Duration | Effect |
|-----------|----------|--------|
| `scan-down` | 8s | Sweep line travels top to bottom |

---

### boot.css — Boot Sequence

| Class / Selector | Purpose |
|-----------------|---------|
| `#init-screen` | Full-screen boot overlay |
| `.boot-logo` | Large "J.A.R.V.I.S." title |
| `.boot-subtitle` | Subtitle text |
| `.boot-progress-wrap` | Progress bar container |
| `.boot-progress-track` | Progress bar background track |
| `.boot-progress-bar` | Animated progress bar fill |
| `.boot-stages` | Boot stage messages container |
| `.boot-stage-line` | Individual boot stage message |
| `.boot-stage-line.visible` | Fade-in animation state |
| `.boot-stage-line.error` | Warning/error stage (gold colour) |
| `#init-btn` | "ENGAGE SYSTEMS" button |
| `#init-btn.ready` | Button glow-pulse ready state |

| @keyframes | Duration | Effect |
|-----------|----------|--------|
| `fadeInUp` | 1s | Fade in + translate up |
| `pulse-btn` | 2s ∞ | Button glow pulse |

---

### layout.css — Panel Positioning & Layout

| Class / Selector | Purpose |
|-----------------|---------|
| `.hud-corner` (`.tl`, `.tr`, `.bl`, `.br`) | Corner bracket decoration elements |
| `.top-bar` / `.top-bar.show` | Top status bar (hidden → revealed) |
| `.top-bar-left`, `-center`, `-right` | Top bar sections |
| `.status-dot` | Status indicator dots (coloured) |
| `.ticker` | Scrolling text ticker container |
| `.panel` / `.panel.show` | Base panel (hidden → revealed with transition) |
| `.panel-border` / `::before` | Panel container with clip-path + gradient top border |
| `.panel-title` / `.live-dot` | Panel header + live indicator dot |
| `.left-panel`, `.right-panel`, `.center-panel` | Panel absolute positions |
| `#big-date`, `#time`, `#full-date`, `#day`, `#greeting` | Date/time text styles |
| `.terminal` / `::after` | Terminal boot output box + cursor blink |
| `.weather-panel`, `.weather-row`, `.weather-stat` | Weather section layout |
| `.stat-group`, `.stat-header`, `.stat-value` | System stat display |
| `.progress-bg`, `.progress-fill` / `::after` | Progress bar with glow dot |
| `.stat-warning`, `.stat-critical` | Warning/critical stat colours |
| `.threat-section`, `.threat-level`, `.threat-bar` | Threat level bars |
| `.threat-bar.active-green`, `.active-gold`, `.active-red` | Threat colour states |
| `.bottom-left`, `.bottom-right` | Bottom panel positions |
| `.radar-info` | Radar text info |
| `.log-container`, `.log-entry` | System log container + entries |

| @keyframes | Duration | Effect |
|-----------|----------|--------|
| `ticker-scroll` | 40s | Horizontal text scroll |
| `border-pulse` | 3s | Panel border glow pulse |
| `blink` | 1.5s | Live dot blink |
| `cursor-blink` | 0.8s | Terminal cursor blink |

---

### command.css — Command Bar, Notifications

| Class / Selector | Purpose |
|-----------------|---------|
| `.command-bar` / `.show` | Bottom command bar |
| `.command-input-wrap` | Input wrapper with border |
| `.cmd-prefix` | "JARVIS>" prompt text |
| `#cmd-input` | Text input field |
| `.voice-btn` / `.listening` | Voice recognition button + active state |
| `.speech-toggle-btn` / `.active` | Speech output toggle button + enabled state |
| `.cmd-response` | Command response display area |
| `.notif-float` | Toast notification container |
| `.notif-toast` / `.show` / `.warn` / `.error` | Notification toasts |
| `#audio-canvas` | Audio visualiser canvas |
| `.key-hint` / `.show` / `kbd` | Keyboard shortcuts hint + key styling |
| `.glitch-text` | Glitch distortion animation |
| `.parallax-layer` | Mouse parallax transformation base |

| @keyframes | Duration | Effect |
|-----------|----------|--------|
| `pulse-voice` | 1s | Voice button glow pulse |
| `glitch` | 0.1s | Text glitch distortion |

---

### diagnostics.css — Diagnostics, Security, Processes, Health

| Class / Selector | Purpose |
|-----------------|---------|
| `.diag-overlay` / `.active` | Full-screen diagnostic overlay |
| `.diag-title` | "FULL SYSTEM DIAGNOSTIC" title |
| `.diag-grid` | 3×4 diagnostic module grid |
| `.diag-cell` / `.scanning` / `.pass` / `.fail` / `.warn` | Module cell states |
| `.diag-cell-label`, `-value`, `-icon` | Cell content elements |
| `.scan-bar` | Scanning progress bar inside cell |
| `.diag-progress-text` | Scan progress message |
| `.diag-close` | Close diagnostic button |
| `.health-matrix` | 4×4 subsystem health grid |
| `.health-cell` / `.ok` / `.warn` / `.crit` / `.scanning-cell` | Health cell states |
| `.mid-left-panel`, `.mid-right-panel` | Side diagnostic panels |
| `.panel-collapse-btn` | Panel collapse/expand button |
| `.panel-collapsible` / `.collapsed` | Collapsible content (max-height transition) |
| `.net-intel-row`, `-label`, `-val` | Network intelligence data row |
| `.sparkline-wrap`, `-label`, `-canvas` | Sparkline charts |
| `.proc-list`, `.proc-row` | Process table |
| `.proc-name`, `.proc-cpu`, `.proc-mem` | Process table columns |
| `.gauge-row`, `.gauge-wrap`, `.gauge-canvas`, `.gauge-label` | Circular gauge displays |
| `.uptime-bar`, `.uptime-segment`, `.uptime-num`, `.uptime-label` | Uptime counter display |
| `.auto-scan-indicator` / `.active` | Auto-scan running indicator |
| `.scan-spinner` | Spinning indicator element |
| `.integrity-hash` | SHA-512 hash display |
| `.sec-row`, `.sec-dot` / `.ok` / `.warn` / `.fail` / `.scanning` | Security audit status |

| @keyframes | Duration | Effect |
|-----------|----------|--------|
| `diag-scan-pulse` | 0.8s | Diagnostic cell pulse |
| `scan-fill` | 1.5s | Scan progress bar fill |
| `cell-scan` | 1.5s | Health cell scanning sweep |
| `spin-fast` | 0.6s | Spinner rotation |

---

### effects.css — Visual Effects, Themes, Reticle, Globe

| Class / Selector | Purpose |
|-----------------|---------|
| `#matrix-canvas` | Matrix digital rain canvas |
| `.hud-reticle` / `.active` | Mouse reticle container (hidden → visible) |
| `.reticle-ring` (`.outer`, `.mid`, `.inner`) | Concentric reticle rings |
| `.reticle-cross` / `::before` / `::after` | Crosshair elements |
| `.reticle-dot` | Centre reticle dot |
| `.reticle-coords` | Coordinate display text |
| `body.theme-combat` | Combat theme CSS variable overrides (reds/oranges) |
| `body.theme-stealth` | Stealth theme CSS variable overrides (greens) |
| `.globe-panel` / `.show` | 3D globe panel |
| `.globe-label` | Satellite tracker label |
| `.power-surge-overlay` / `.active` | Power surge flash |
| `.data-stream-container`, `.data-stream` | Floating hex/binary streams |
| `.theme-indicator` / `.show` | Theme mode indicator text |
| `.holo-grid` | Holographic perspective grid |
| `.target-lock` / `.active` | Target lock indicator |
| `.target-lock-ring` | Outer lock ring |
| `.target-lock-inner` | Inner rotating lock element |
| `.target-lock-label` | "LOCKED" label |
| `body.shaking` | Screen shake animation |

| @keyframes | Duration | Effect |
|-----------|----------|--------|
| `reticle-spin` | ∞ | Reticle ring rotation |
| `stream-float` | variable | Data stream floating upward |
| `power-surge` | — | Power surge fade flash |
| `screen-shake` | — | Screen shake vibration |
| `lock-pulse` | ∞ | Target lock ring pulse |
| `lock-rotate` | ∞ | Target lock inner rotation |

---

### widgets.css — Device Panel, Crypto, World Clock, Timer

| Class / Selector | Purpose |
|-----------------|---------|
| `.device-panel` / `.show` | Device hardware info panel |
| `.device-grid` | Device info grid layout |
| `.device-item`, `-label`, `-val` | Device info cells |
| `.crypto-ticker` / `.show` | Cryptocurrency price ticker |
| `.crypto-item`, `-name`, `-price` | Crypto display elements |
| `.crypto-change.up` / `.down` | Price change colour (green/red) |
| `.world-clock-panel` / `.show` | World clock panel |
| `.wclock-row`, `-city`, `-time` | Clock row layout |
| `.timer-display` / `.active` | Countdown timer display |
| `.timer-label` | "COUNTDOWN" label |

---

### ai-engine.css — AI Suggestion Chips & System Report Panel

| Class / Selector | Purpose |
|-----------------|---------|
| `.jarvis-suggestion-chip` | Inline command suggestion chip (animated entry) |
| `.jarvis-suggestion-chip:hover` | Chip hover glow state |
| `.system-report-panel` / `.active` | Full-screen system check overlay |
| `#system-report-grid` | Auto-fill responsive grid for check cards |
| `.sys-report-item` | Individual check card (name + status + detail) |
| `.sys-report-status` | Coloured status indicator dot |
| `.sys-ok`, `.sys-warn`, `.sys-crit`, `.sys-unknown` | Status colour classes (green/amber/red/grey) |
| `.sys-report-name` | Check name label |
| `.sys-report-detail` | Detail/value text |
| `#system-report-summary` | Summary text under the grid |
| `#system-report-close` | Close button (top-right) |

| @keyframes | Duration | Effect |
|-----------|----------|--------|
| `chipIn` | 0.4s | Suggestion chip fade-in + slide |
| `panelFadeIn` | 0.3s | Report panel fade in |

---

### game.css — Bot Shooter Game

| Class / Selector | Purpose |
|-----------------|---------|
| `#game-overlay` / `.active` | Game overlay container |
| `#game-canvas` | Game rendering canvas |
| `.game-hud` / `.game-hud-item` | In-game HUD bar |
| `.game-hud-label`, `.game-hud-value` | HUD text |
| `.game-hud-value.health` / `.low` / `.critical` | Health display colours |
| `.game-health-bar`, `.game-health-fill` | Health bar |
| `.game-health-fill.low` / `.critical` | Health bar warning colours |
| `.game-msg` / `.show` | Game message display |
| `.game-exit-hint` | Game control hint text |

---

## JavaScript File Reference

### utils.js — DOM Helpers & Global Flags

| Function | Description |
|----------|-------------|
| `$(id)` | Selects element by ID (`document.getElementById`) |
| `qs(sel)` | Selects first element matching CSS selector |
| `qsa(sel)` | Selects all elements matching CSS selector |
| `sleep(ms)` | Returns a Promise that resolves after `ms` milliseconds |

| Global Variable | Type | Purpose |
|----------------|------|---------|
| `systemActive` | boolean | `true` after boot sequence completes |
| `targetLockActive` | boolean | `true` when target lock is engaged |
| `speechEnabled` | boolean | `true` when speech output toggle is ON (default: `false`) |
| `mouseX` / `mouseY` | number | Current mouse cursor coordinates |

---

### canvas.js — Particle System, Arc Reactor, Radar

| Function / IIFE | Description |
|-----------------|-------------|
| `initParticles()` | Creates 80 particles with random position/velocity; runs `requestAnimationFrame` loop that updates positions, draws particles, and draws proximity lines between nearby particles |
| `initReactor()` | Draws the Arc Reactor on `#reactor-canvas`: rotating outer ring segments, orbiting particles, dashed mid-ring, coil segments, pulsing core glow. Updates `#reactor-output` GJ/s value |
| `initRadar()` | Draws radar on `#radar-canvas`: concentric rings, rotating sweep line, blips with fade, border frame. Updates `#radar-info` blip count |

| Global Variable | Type | Purpose |
|----------------|------|---------|
| `radarBlips` | Array | Array of radar blip objects `{x, y, alpha}` |

---

### core.js — Speech, Terminal, Time, Weather, Stats, Log

| Function | Description |
|----------|-------------|
| `speak(text)` | Synthesises speech via Web Speech API. Uses British English voice if available. **Gated by `speechEnabled` flag** — returns immediately if `false` |
| `runTerminal()` | Displays boot terminal messages in `#terminal-boot` with staggered delays (50–80ms per line) |
| `updateTime()` | Updates `#time`, `#big-date`, `#full-date`, `#day`, `#greeting`, `#top-time` every second. Greeting changes by hour of day |
| `fetchWeather()` | Fetches weather from Open-Meteo API (Pokhara, Nepal by default). Updates `#temp-big`, `#humidity`, `#wind-speed`, `#weather-desc` |
| `smoothStats()` | Eases `current` values toward `targets` values at 5% per frame. Updates all stat bars and values. Randomly fluctuates `targets` every ~4 seconds. Reads battery via Battery API |
| `addLog(text, type)` | Adds timestamped log entry to `#log-container`. Types: info, warn, error, success. Auto-scrolls. Limits to last 80 entries |
| `startSystemLog()` | Starts interval that adds random log messages every 3–7 seconds from `logMessages` templates |
| `countFps()` | Calculates FPS via `requestAnimationFrame` timing, updates `#top-fps` |
| `showToast(text, type)` | Creates notification toast in `#notif-float`. Auto-removes after 4 seconds. Types affect border colour |

| Global Variable | Type | Purpose |
|----------------|------|---------|
| `targets` | Object | Target stat values `{cpu, ram, gpu, net, disk}` |
| `current` | Object | Current smoothed stat values `{cpu, ram, gpu, net, disk}` |
| `logMessages` | Array | Pre-defined log message templates with type |

---

### boot.js — Boot Sequence & System Activation

| Function | Description |
|----------|-------------|
| `runBoot()` | Displays boot stages sequentially from `bootStages` array. Updates progress bar `#boot-bar`. Stages have configurable delay (300–800ms) and optional `warn` flag |
| Init button handler | On `#init-btn` click: plays power-up sound, runs `runTerminal()`, reveals panels with staggered 200ms delays, starts canvas systems, stats, log, FPS, weather. Sets `systemActive = true`. Calls `startAdvancedSystems()` after 2s |

| Global Variable | Type | Purpose |
|----------------|------|---------|
| `bootStages` | Array | Boot stage objects `{text, delay, warn?}` |
| `bootIndex` | number | Current boot stage index |
| `bootProgress` | number | Current boot progress percentage |

---

### threat.js — Threat Level Calculation & Alerts

| Function | Description |
|----------|-------------|
| `calculateThreatLevel()` | Computes threat score (0–N) from 9+ factors. Maps to level: 0 = MINIMAL, 1 = GUARDED, 2 = ELEVATED, 3+ = HIGH. Updates threat bars and label. Logs level changes. Triggers `screenShake()` on HIGH |
| `playThreatImpact(severity)` | **DISABLED** (commented out). Was: Web Audio synthesised impact sounds at different frequencies based on severity |

**Threat Factors:**
- CPU load >85% (+3) or >70% (+1)
- GPU temp >85° (+2) or >70° (+1)
- Network endpoints down (0 = +4, 1 = +2, 2 = +1)
- Latency >500ms (+3) or >300ms (+1)
- Security audit failures (+2 each) or warnings (+1 each)
- Battery <10% (+3) or <20% (+1)
- Health matrix critical cells (+1 each)
- Offline status (+3)
- Random RF noise (0–2)

| Interval | Period | Action |
|----------|--------|--------|
| Threat recalc | 8s | Recalculates threat level |
| Critical alert | 9s | On HIGH: triggers surge + shake + toast + log |

| Global Variable | Type | Purpose |
|----------------|------|---------|
| `lastThreatLevel` | number | Previous threat level for change detection |
| `threatScore` | number | Current computed threat score |
| `threatFactors` | Array | Active threat reason strings |

---

### effects.js — Visual Effects, Themes, Globe, Audio

| Function | Description |
|----------|-------------|
| Parallax handler | `mousemove` listener: translates `.parallax-layer` elements based on mouse offset from center |
| `initAudioVis()` | Draws simulated ambient spectrum bars on `#audio-canvas` with smooth height animation (no microphone) |
| Glitch interval | Every 2–5s: applies `.glitch-text` class to random HUD elements for 200ms |
| Toast interval | Every 15s: shows random system notification toast |
| `initMatrix()` | Draws vertical falling green characters on `#matrix-canvas` with fade-in/out. Characters: Latin + Katakana |
| `updateReticle()` | Eases `#hud-reticle` position toward mouse with lerp. Updates `#reticle-coords` text. Syncs `#target-lock` position when active |
| `setTheme(name)` | Sets theme by name ('standard', 'combat', 'stealth'). Swaps `body` classes, triggers power surge + toast + log. Updates `#theme-indicator` |
| `cycleTheme()` | Cycles to next theme in sequence (calls `setTheme`) |
| `initGlobe()` | Renders 3D wireframe Earth on `#globe-canvas`: longitude/latitude lines, equator highlight, 5 satellite points with labels, dashed connection lines. Rotates continuously |
| `screenShake()` | Adds `body.shaking` class for 400ms |
| `triggerPowerSurge()` | Activates `#power-surge` overlay flash for 500ms |
| `createDataStream()` | Creates floating hex/binary string element in `#data-streams`. Animates upward. Auto-removes after animation |
| `startAmbientHum()` | Creates Web Audio oscillators: 60Hz fundamental + 120Hz harmonic. Very low gain (0.015). Toggle on/off |
| Konami code handler | Detects ↑↑↓↓←→←→BA key sequence → temporarily sets gold CSS variables for 5 seconds |

| Global Variable | Type | Purpose |
|----------------|------|---------|
| `themes` | Array | `['default', 'combat', 'stealth']` |
| `currentTheme` | number | Current theme index (0–2) |
| `themeNames` | Array | Display names `['STANDARD', 'COMBAT', 'STEALTH']` |
| `audioCtx` | AudioContext | Web Audio API context for ambient hum |
| `hummingActive` | boolean | Whether ambient hum is playing |
| `konamiCode` | Array | Expected key sequence |
| `konamiIndex` | number | Current progress in Konami code |

---

### tools.js — URL Launcher, Calculator, Timer, Memos, Widgets

| Function | Description |
|----------|-------------|
| `openURL(url, label)` | Opens URL in new tab. Logs action and shows toast |
| `handleOpen(target)` | Parses target string: checks `siteMap` first, then URL patterns, then domain detection, finally falls back to Google search |
| `safeCalc(expr)` | Evaluates math expression safely. Validates input contains only digits, operators, parentheses, decimal points. Returns result or error string |
| `startTimer(seconds)` | Starts countdown timer. Shows `#timer-display`. Updates `#timer-value` every second. Speaks alerts at 10s, 5s, and 0. Logs completion |
| `handleMemo(sub)` | Manages memos in `localStorage`. Sub-commands: `save <text>`, `list`, `clear`, `delete <n>`. Returns formatted response |
| `exportLog()` | Gathers all log entries from `#log-container`, creates text file download |
| `populateDeviceIntel()` | Fills `#device-grid` with: Platform, Language, CPU Cores, Memory, Screen Resolution, GPU (via WebGL), Browser |
| `fetchCrypto()` | Fetches BTC/ETH/SOL prices from CoinGecko API. Updates price displays and change % with colour coding |
| `updateWorldClock()` | Updates 6-city clock display using `Intl.DateTimeFormat`. Cities: NYC, London, Tokyo, Sydney, Kathmandu, Dubai |

| Global Variable | Type | Purpose |
|----------------|------|---------|
| `siteMap` | Object | Maps 30+ site names to URLs (youtube, google, github, stackoverflow, reddit, etc.) |
| `timerInterval` | number | Active countdown timer interval ID |
| `worldClockZones` | Array | Timezone configuration objects `{city, tz}` |

---

### diagnostics.js — Network Intel, Security, Processes, Health, Gauges

| Function | Description |
|----------|-------------|
| `fetchNetIntel()` | Fetches IP/ISP/geolocation from ipapi.co. Updates `#ext-ip`, `#isp-name`, `#geo-region`, `#geo-coords`. Stores in `realIP`, `realISP`, etc. |
| `checkConnectivity()` | Pings 4 endpoints (httpbin.org, worldtimeapi.org + 2 others). Measures latency. Updates `#dns-status`, `#ping-latency`, `#endpoints-up`. Pushes to `netHistory`/`latencyHistory`. Redraws sparklines |
| `drawSparkline(canvasId, data, maxVal, color)` | Draws 60-point line chart with gradient area fill on a canvas element |
| `runSecurityAudit()` | Sequentially scans 6 modules (Firewall → SSL → Ports → IDS → Malware → Integrity). Each takes 400–800ms. Updates status dots with pass/warn/fail. Generates SHA-512 hash |
| `updateProcessList()` | Refreshes `#proc-list` with 12 processes. CPU/memory values fluctuate randomly around base values |
| `updateHealthMatrix()` | Refreshes `#health-matrix` 16 cells. Each cell randomly ok (85%) / warn (10%) / crit (5%). Counts in global tracking |
| `drawGauge(canvasId, value, max, color)` | Draws circular arc gauge on canvas with value text in center |
| `updateUptime()` | Calculates elapsed time since `uptimeStart`. Updates `#up-h`, `#up-m`, `#up-s` |
| `openDiagOverlay()` | Opens `#diag-overlay`, calls `runDiagnosticScan()` |
| `runDiagnosticScan()` | Scans 12 modules sequentially (800–1400ms each). Animates cells through scanning → pass/fail/warn states. Shows progress percentage |
| `runAutoDiagCycle()` | Runs 3–4 random checks from `autoDiagChecks` array. Shows `#scan-indicator` during active scans. Logs results |
| `triggerHealthScan()` | Adds `.scanning-cell` animation to all health cells, then refreshes matrix |

| Global Variable | Type | Purpose |
|----------------|------|---------|
| `netHistory` | Array(60) | Network throughput history for sparkline |
| `latencyHistory` | Array(60) | Latency measurement history for sparkline |
| `realIP` | string | Fetched external IP address |
| `realISP` | string | Fetched ISP name |
| `realRegion` | string | Fetched geolocation region |
| `realCoords` | string | Fetched latitude/longitude |
| `healthEndpoints` | Array | 4 test endpoint URLs for connectivity |
| `processes` | Array | 12 process objects `{name, cpuBase, memBase}` |
| `subsystems` | Array | 16 subsystem names for health matrix |
| `diagModules` | Array | 12 diagnostic module objects for full scan |
| `uptimeStart` | Date | System boot timestamp |
| `autoDiagChecks` | Array | 10 background diagnostic check definitions |

---

### commands.js — Command Engine, AI Response, Voice, Shortcuts

| Function | Description |
|----------|-------------|
| `helpWalkthrough()` | Speaks 35+ feature descriptions line by line using `speak()`. Displays full tutorial text in `#cmd-response` |
| `getAIResponse(input)` | Pattern-matches user input against conversational templates: greetings, compliments, identity questions, status inquiries, capability questions, jokes, shutdown requests, references to Tony Stark/Friday/music/weather/danger. Returns response string or `null` |
| `typeResponse(text)` | Character-by-character typing animation into `#cmd-response`. 20ms per character. Also calls `speak(text)` if speech enabled |
| `setupCollapse(btnId, contentId)` | Attaches click handler to collapse button. Toggles `.collapsed` class on button and content wrapper |
| Voice recognition handler | On `#voice-btn` click: starts `SpeechRecognition`. On result: inserts text into `#cmd-input` and dispatches Enter key |
| Speech toggle handler | On `#speech-toggle` click: toggles `speechEnabled` flag and `.active` class on button |
| Command history | ArrowUp/ArrowDown navigates through `commandHistory` array |
| Enter handler | On Enter key in `#cmd-input`: parses command. Checks parameterised prefixes (`speak`, `open`, `search`, `calc`, `timer`, `theme`, `memo`) first, then exact command match, then AI response fallback |

**Keyboard Shortcuts:**

| Key | Handler | Action |
|-----|---------|--------|
| `Escape` | keydown | Toggle fullscreen |
| `/` | keydown | Focus command bar |
| `V` | keydown | Start voice recognition |
| `T` | keydown | Cycle theme |
| `L` | keydown | Toggle target lock |
| `↑` / `↓` | keydown (in input) | Command history navigation |

| Global Variable | Type | Purpose |
|----------------|------|---------|
| `cmdInput` | Element | Reference to `#cmd-input` |
| `cmdResponse` | Element | Reference to `#cmd-response` |
| `commandHistory` | Array | Recent command strings |
| `historyIndex` | number | Current history position (-1 = none) |
| `commands` | Object | Map of command name → handler function |

---

### init.js — System Initialisation & Interval Scheduling

| Function | Description |
|----------|-------------|
| `startAdvancedSystems()` | Main post-boot startup. Reveals mid-left/mid-right/globe panels. Activates reticle and ambient hum. Fetches initial network intel, runs connectivity check, security audit, process + health updates. Sets up all recurring intervals. Shows device/crypto/clock panels |

**Commands registered by init.js** (added to `commands` object via `Object.assign`):

| Command | Handler |
|---------|---------|
| `diag` | Opens diagnostic overlay |
| `netinfo` | Displays IP, ISP, region, coords |
| `security` | Runs security audit |
| `integrity` | Generates SHA-512 hash |
| `processes` | Refreshes process list |
| `uptime` | Displays uptime |
| `health` | Triggers health scan |
| `autoscan` | Runs auto-diagnostic cycle |
| `ip` | Displays external IP |
| `reboot` | Reloads page |
| `help` | Lists all commands |
| `helpwalkthrough` | Speaks feature tour |
| `theme` | Shows current theme (no arg) or cycles |
| `globe` | Shows satellite count |
| `lock` | Toggles target lock |
| `hum` | Toggles ambient reactor hum |
| `surge` | Triggers power surge |
| `device` | Shows device intelligence panel |
| `crypto` | Fetches crypto prices |
| `clock` | Shows world clock |
| `export` | Exports system log |
| `youtube` | Opens YouTube |
| `google` | Opens Google |
| `github` | Opens GitHub |
| `news` | Opens Google News |
| `maps` | Opens Google Maps |
| `game` | Starts bot shooter game |
| `battery` | Battery level, charging, drain rate |
| `batterydetail` | Full battery health report |
| `networkdetail` | Network connection details |
| `memorycheck` | JS heap memory usage |
| `memorydetail` | Detailed heap breakdown |
| `storagecheck` | Storage quota & usage |
| `storagedetail` | Full storage analysis |
| `gpuinfo` | GPU renderer & vendor |
| `gpudetail` | WebGL capabilities |
| `perfcheck` | Page load performance |
| `perfdetail` | Full navigation timing |
| `permissions` | Browser permission status |
| `devices` | Connected media devices |
| `systemcheck` | Full system check + report panel |
| `whatworks` | What's working / what's broken |
| `mystats` | Personal usage analytics |
| `verbose` / `brief` | Toggle response detail mode |
| `proactive` | Toggle proactive suggestions |
| `locate` | GPS geolocation |
| `tabinfo` | Current tab URL & title |
| `screeninfo` | Screen resolution & details |
| `clipboard` | Read clipboard contents |
| `colorscheme` | System dark/light mode |
| `benchmark` | CPU benchmark suite |
| `speedtest` | Download speed test |
| `helpadvanced` | List all v3.0 commands |
| `resetlearning` | Clear all learning data |

**Recurring Intervals (set in `startAdvancedSystems`):**

| Function | Interval | Purpose |
|----------|----------|---------|
| `updateUptime()` | 1s | Uptime counter |
| `updateTime()` | 1s | Clock/date |
| `updateWorldClock()` | 1s | World clock cities |
| `checkConnectivity()` | 30s | Ping endpoints + sparklines |
| `runSecurityAudit()` | 90s | Security module scan |
| `updateProcessList()` | 5s | Refresh process table |
| `runAutoDiagCycle()` | 45s | Background diagnostic checks |
| `triggerHealthScan()` | 60s | Health matrix scan |
| `fetchNetIntel()` | 2min | IP/ISP/geolocation refresh |
| `fetchWeather()` | 5min | Weather data refresh |
| `fetchCrypto()` | 2min | Crypto prices refresh |
| `smoothStats()` | rAF | Continuous stat bar animation |

---

### ai-personality.js — Personality Response Bank

| Export | Type | Description |
|--------|------|-------------|
| `PB` | Object | Personality bank with 30 response categories, each an array of variant strings |
| `pick(arr)` | Function | Returns random element from array |

**Response Categories (30):**

| Category | Count | Triggered By |
|----------|-------|-------------|
| `greet` | 5 | Hello, hey, hi |
| `thanks` | 5 | Thanks, compliments |
| `identity` | 5 | Who are you |
| `status` | 5 | How are you doing |
| `capabilities` | 5 | What can you do |
| `jokes` | 5 | Tell me a joke |
| `shutdown` | 4 | Shut down, power off |
| `stark` | 4 | Tony, Stark |
| `friday` | 3 | Friday |
| `weather` | 4 | Weather queries |
| `danger` | 4 | Threats, danger |
| `motivate` | 5 | Motivational requests |
| `music` | 4 | Music requests |
| `philosophy` | 4 | Deep questions |
| `compliment` | 4 | Flattery |
| `bored` | 4 | Boredom |
| `unknown` | 5 | Unrecognised input fallback |
| `systemHealthGood` | 5 | All systems passing |
| `systemHealthBad` | 5 | System failures detected |
| `batteryGood` | 5 | Battery level healthy |
| `batteryLow` | 5 | Battery level low |
| `learningAck` | 5 | Learning-related |
| `performanceGood` | 4 | Good performance metrics |
| `performanceBad` | 4 | Poor performance metrics |
| `networkGood` | 4 | Network healthy |
| `networkBad` | 4 | Network issues |
| `security_clear` | 4 | Security checks clear |
| `whois_response` | 3 | WHOIS lookup results |
| `benchmark_response` | 3 | Benchmark completion |
| `clipboard_response` | 3 | Clipboard access |

---

### ai-time.js — Time-Aware Greeting & Schedule

| Export | Type | Description |
|--------|------|-------------|
| `jarvisSchedule` | Object | Maps time periods to `{greeting, tone, energy, suggestion}` |

**Time Periods:**

| Period | Hours | Greeting | Tone | Energy |
|--------|-------|----------|------|--------|
| `lateNight` | 0–4 | "Burning the midnight oil..." | calm | low |
| `earlyMorning` | 5–7 | "Early start today, Sir." | gentle | rising |
| `morning` | 8–11 | "Good morning, Sir." | energetic | high |
| `midday` | 12–13 | "It's midday, Sir." | balanced | peak |
| `afternoon` | 14–17 | "Good afternoon, Sir." | focused | steady |
| `evening` | 18–20 | "Good evening, Sir." | warm | winding |
| `night` | 21–23 | "It's getting late, Sir." | calm | low |

---

### ai-system-monitor.js — Real Browser API System Monitoring

| Object | Description |
|--------|-------------|
| `SystemMonitor` | Master monitoring object with subsystem modules |

**Subsystems:**

| Subsystem | API Used | Functions |
|-----------|----------|----------|
| `battery` | Battery API | `init()`, `getReport()`, `getDetailedReport()`, `_estimateHealth()`, `_getDrainRate()` |
| `network` | Network Information API | `init()`, `getReport()`, `getDetailedReport()` |
| `memory` | `performance.memory` (Chrome) | `init()`, `getReport()`, `getDetailedReport()` |
| `storage` | Storage API + localStorage | `getReport()`, `getDetailedReport()` |
| `gpu` | WebGL `debug_renderer_info` | `init()`, `getReport()`, `getDetailedReport()` |
| `performance` | Performance Navigation Timing | `getReport()`, `getDetailedReport()` |
| `permissions` | Permissions API | `checkAll()`, `getReport()`, `getDetailedReport()` |
| `media` | MediaDevices API | `getDevices()`, `getReport()`, `getDetailedReport()` |
| `geolocation` | Geolocation API | `getPosition()`, `getReport()` |

| Function | Description |
|----------|-------------|
| `SystemMonitor.fullSystemCheck()` | Runs all subsystem checks, returns `{checks[], passed, warnings, failures, total}` |
| `SystemMonitor.init()` | Initialises all subsystems, starts periodic battery history recording |

---

### ai-learning.js — Adaptive Learning Engine

| Object | Description |
|--------|-------------|
| `JarvisLearning` | User profiling, pattern recognition, and persistence engine |

**Profile Data (persisted to localStorage):**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | User name (default: "Sir") |
| `preferredTone` | string | Detected tone preference (formal/casual/brief) |
| `favoriteCommands` | Object | Command → frequency count map |
| `topicInterests` | Object | Topic → frequency count map |
| `activeHours` | Array(24) | Activity count per hour of day |
| `sessionCount` | number | Total sessions since first use |
| `totalCommands` | number | Lifetime command count |
| `customAliases` | Object | User-defined alias → command map |

**Key Functions:**

| Function | Description |
|----------|-------------|
| `recordCommand(cmd, raw)` | Tracks frequency, sequential patterns, time-of-day patterns |
| `recordTopic(topic)` | Increments topic interest counter |
| `recordInsight(intent, sentiment, length)` | Tracks conversation characteristics |
| `predictNextCommand()` | Predicts based on `commandPairs` frequency |
| `getProactiveSuggestion()` | Returns context-aware suggestion or null |
| `setAlias(name, target)` | Creates custom alias |
| `resolveAlias(input)` | Returns aliased command or null |
| `getContextualGreeting()` | Session-count and time-aware greeting |
| `getUserReport()` | Formatted analytics summary |
| `save()` / `load()` | Persist to / load from `localStorage` key `jarvis_learning_v3` |

---

### ai-engine.js — AI Engine v3.0 (NLP, Intent, Context, Sentiment)

| Function | Description |
|----------|-------------|
| `detectTopic(input)` | Maps input to 25 topics via regex (weather, battery, storage, gpu, benchmark, alias, etc.) |
| `classifyIntent(input)` | Scores input against 12 intent definitions, returns `{best, confidence, scores}` |
| `resolveContext(input, intent)` | Expands pronouns ("it", "that", "again") using conversation context history |
| `extractEntities(input)` | Extracts URLs, emails, numbers, IPs, time references, @mentions, key=value pairs |
| `analyzeSentiment(input)` | Returns `positive` / `negative` / `neutral` based on word lists |
| `adjustTone(text, sentiment)` | Prepends tone markers based on sentiment |
| `levenshtein(a, b)` | String distance calculation for fuzzy matching |
| `fuzzyMatchCommand(input)` | Finds closest command within distance ≤3, returns suggestion |
| `getSuggestion(cmd)` | Looks up command in `suggestionMap` for follow-up suggestion |
| `splitChainedCommands(input)` | Splits on `&&`, `then`, `and then`, `also` |
| `typeResponseV2(text, suggestion)` | Typing animation with optional suggestion chip |
| `enhancedAI(input, entities, sentiment, intent)` | NL pattern matcher for 40+ conversational patterns including system monitoring queries |
| `processSingle(raw)` | Full command pipeline: alias resolve → entity extract → intent classify → NL map → fuzzy match → AI fallback. Records learning data |
| `handleJarvisInput()` | Capture-phase keydown handler on cmd-input, chains commands |

**Intent Categories (12):**

| Intent | Example Patterns |
|--------|------------------|
| `COMMAND` | help, status, scan, diag, battery, systemcheck |
| `QUESTION` | what, how, why, when, where, who, is, are, can |
| `GREETING` | hi, hello, hey, good morning, yo |
| `COMPLIMENT` | good job, amazing, brilliant, nice work |
| `COMPLAINT` | slow, broken, wrong, terrible, fix |
| `REQUEST` | please, can you, could you, I need, show me |
| `FAREWELL` | bye, goodbye, see you, good night |
| `GRATITUDE` | thanks, thank you, appreciate |
| `IDENTITY` | who are you, your name, what are you |
| `OPINION` | think, opinion, feel, believe, prefer |
| `SMALLTALK` | bored, lonely, weather talk, how's it going |
| `SYSTEM_MONITOR` | battery, memory, storage, gpu, benchmark, speed test |

| Global Variable | Type | Description |
|----------------|------|-------------|
| `jarvisContext` | Object | 20-turn sliding window conversation memory |
| `nlMap` | Object | 80+ natural language phrase → command mappings |
| `suggestionMap` | Object | Command → follow-up suggestion text mappings |

---

### ai-advanced-commands.js — New Commands & NL Extensions

**Commands registered (via `Object.assign(commands, ...)`):**

| Command | Description |
|---------|-------------|
| `battery` | Battery level, charging status, drain rate |
| `batterydetail` | Full battery health report with history |
| `networkdetail` | Connection type, downlink, RTT, data saver |
| `memorycheck` | JS heap usage summary |
| `memorydetail` | Detailed heap breakdown with limits |
| `storagecheck` | Storage quota and usage |
| `storagedetail` | Full storage analysis with localStorage stats |
| `gpuinfo` | GPU renderer and vendor |
| `gpudetail` | WebGL capabilities, HDR, colour gamut |
| `perfcheck` | Page load performance timing |
| `perfdetail` | Full navigation timing breakdown |
| `permissions` | Camera, mic, geo, notification, clipboard status |
| `devices` | Connected audio/video devices |
| `systemcheck` | Full system check with visual report panel |
| `whatworks` | Lists what's working and what's broken |
| `mystats` | Personal usage analytics |
| `verbose` / `brief` | Toggle verbose/brief response mode |
| `proactive` | Toggle proactive suggestions |
| `locate` | GPS geolocation |
| `tabinfo` | Current tab URL and title |
| `screeninfo` | Screen resolution, colour depth, pixel ratio |
| `clipboard` | Read clipboard contents |
| `colorscheme` | Detect system dark/light mode preference |
| `benchmark` | CPU benchmark (math, string, array operations) |
| `speedtest` | Real download speed test |
| `helpadvanced` | Lists all new v3.0 commands |
| `resetlearning` | Clears all learning data |

**Also provides:**

| Function | Description |
|----------|-------------|
| `buildSystemReportPanel(data)` | Builds visual grid in `#system-report-panel` from check results |
| `handleAlias(sub)` | Handles `alias set/remove/list` subcommands |

**NL Map Extensions (50+ new mappings):**
Phrases like "check battery", "how much memory", "what's broken", "run benchmark", "test speed", "where am I", "my stats", etc. → mapped to appropriate commands.

---

### game.js — Bot Shooter Game Engine

**Class: `Bot`**

| Property | Type | Description |
|----------|------|-------------|
| `x`, `y` | number | Position on canvas |
| `size` | number | Bot radius |
| `hp`, `maxHp` | number | Health points |
| `speed` | number | Movement speed |
| `angle` | number | Direction angle (radians) |
| `type` | string | `'standard'` or `'heavy'` |

| Method | Description |
|--------|-------------|
| `update(dt)` | Moves bot along angle, bounces off walls |
| `draw(ctx)` | Renders bot on canvas (hexagonal shape, HP bar, glow) |

**Functions:**

| Function | Description |
|----------|-------------|
| `resizeGameCanvas()` | Resizes `#game-canvas` to match window dimensions |
| `playShootSound()` | Web Audio: short high-frequency pulse (800Hz, 0.1s) |
| `playExplosionSound()` | Web Audio: low rumble (100Hz, 0.3s) |
| `playHitSound()` | Web Audio: mid-frequency blip (400Hz, 0.05s) |
| `playGameOverSound()` | Web Audio: descending tone (300→100Hz, 0.5s) |
| `spawnExplosion(x, y, color)` | Creates 20 particle explosion with momentum and fade |
| `startBotGame()` | Initialises game state (HP, score, wave), starts game loop. Exposed as `window.startBotGame` for command access |
| `stopGame()` | Exits game overlay, logs final score, clears game state |
| `updateGameHUD()` | Updates `#game-score`, `#game-wave`, `#game-kills`, `#game-hp`, `#game-hp-bar` |
| `showGameMsg(text, duration)` | Shows temporary message overlay (e.g., "WAVE 2") |
| `gameLoop(ts)` | Main 60 FPS loop: spawns bots (progressive difficulty), moves bullets, checks bullet↔bot collisions, handles enemy fire at player, progresses waves (5+ kills), tracks damage, triggers game over |
| `drawGameGrid()` | Draws grid background pattern on canvas |
| `drawPlayerIndicator()` | Draws player shield radius circle and ship icon at canvas center |
| `drawCrosshair()` | Draws targeting crosshair at mouse position |

**Game Input Handlers:**

| Event | Action |
|-------|--------|
| Canvas `mousemove` | Updates crosshair position |
| Canvas `click` | Fires repulsor bullet toward crosshair |
| `Escape` key | Exit game |
| `R` key | Restart on game over |

| Global Variable | Type | Purpose |
|----------------|------|---------|
| `gameActive` | boolean | Game currently running |
| `gameOver` | boolean | Game over state |
| `gScore` | number | Current score |
| `gWave` | number | Current wave number |
| `gKills` | number | Total kills |
| `gHP` | number | Player shield HP (0–100) |
| `bots` | Array | Active Bot instances |
| `bullets` | Array | Active bullet objects |
| `explosions` | Array | Active explosion particle systems |
| `crosshair` | Object | `{x, y}` mouse position on canvas |

---

## Feature-to-File Mapping

| Feature / System | CSS File | JS File | Key Functions |
|-----------------|----------|---------|---------------|
| **Boot Sequence** | boot.css | boot.js | `runBoot()`, init button handler |
| **Particle System** | base.css | canvas.js | `initParticles()` |
| **Arc Reactor** | layout.css | canvas.js | `initReactor()` |
| **Radar** | layout.css | canvas.js | `initRadar()` |
| **Date / Time / Greeting** | layout.css | core.js | `updateTime()` |
| **Weather** | layout.css | core.js | `fetchWeather()` |
| **System Stats** | layout.css | core.js | `smoothStats()` |
| **System Log** | layout.css | core.js | `addLog()`, `startSystemLog()` |
| **FPS Counter** | layout.css | core.js | `countFps()` |
| **Notifications** | command.css | core.js | `showToast()` |
| **Voice Synthesis** | — | core.js | `speak()` |
| **Threat Assessment** | layout.css | threat.js | `calculateThreatLevel()` |
| **Theme System** | effects.css | effects.js | `setTheme()`, `cycleTheme()` |
| **3D Globe** | effects.css | effects.js | `initGlobe()` |
| **Matrix Rain** | effects.css | effects.js | `initMatrix()` |
| **HUD Reticle** | effects.css | effects.js | `updateReticle()` |
| **Target Lock** | effects.css | effects.js | via keyboard `L` handler |
| **Screen Shake** | effects.css | effects.js | `screenShake()` |
| **Power Surge** | effects.css | effects.js | `triggerPowerSurge()` |
| **Data Streams** | effects.css | effects.js | `createDataStream()` |
| **Ambient Hum** | — | effects.js | `startAmbientHum()` |
| **Parallax** | command.css | effects.js | mousemove handler |
| **Audio Visualiser** | command.css | effects.js | `initAudioVis()` |
| **Glitch Effect** | command.css | effects.js | glitch interval |
| **Konami Code** | — | effects.js | keydown handler |
| **URL Launcher** | — | tools.js | `openURL()`, `handleOpen()` |
| **Calculator** | — | tools.js | `safeCalc()` |
| **Countdown Timer** | widgets.css | tools.js | `startTimer()` |
| **Memo System** | — | tools.js | `handleMemo()` |
| **Log Export** | — | tools.js | `exportLog()` |
| **Device Intelligence** | widgets.css | tools.js | `populateDeviceIntel()` |
| **Crypto Ticker** | widgets.css | tools.js | `fetchCrypto()` |
| **World Clock** | widgets.css | tools.js | `updateWorldClock()` |
| **Network Intelligence** | diagnostics.css | diagnostics.js | `fetchNetIntel()`, `checkConnectivity()` |
| **Security Audit** | diagnostics.css | diagnostics.js | `runSecurityAudit()` |
| **Process Monitor** | diagnostics.css | diagnostics.js | `updateProcessList()` |
| **Health Matrix** | diagnostics.css | diagnostics.js | `updateHealthMatrix()`, `triggerHealthScan()` |
| **Circular Gauges** | diagnostics.css | diagnostics.js | `drawGauge()` |
| **Uptime Counter** | diagnostics.css | diagnostics.js | `updateUptime()` |
| **Diagnostic Overlay** | diagnostics.css | diagnostics.js | `openDiagOverlay()`, `runDiagnosticScan()` |
| **Auto-Diagnostics** | diagnostics.css | diagnostics.js | `runAutoDiagCycle()` |
| **Sparklines** | diagnostics.css | diagnostics.js | `drawSparkline()` |
| **Command Engine** | command.css | commands.js | Enter handler, `typeResponse()` |
| **AI Conversation** | command.css | commands.js | `getAIResponse()` |
| **Voice Recognition** | command.css | commands.js | voice-btn handler |
| **Speech Toggle** | command.css | commands.js | speech-toggle handler |
| **Panel Collapse** | diagnostics.css | commands.js | `setupCollapse()` |
| **Help Walkthrough** | — | commands.js | `helpWalkthrough()` |
| **Command History** | — | commands.js | ArrowUp/Down handler |
| **System Init** | — | init.js | `startAdvancedSystems()` |
| **Bot Shooter Game** | game.css | game.js | `startBotGame()`, `gameLoop()` |
| **AI Personality Bank** | — | ai-personality.js | `PB`, `pick()` |
| **Time-Aware AI** | — | ai-time.js | `jarvisSchedule` |
| **Battery Monitor** | ai-engine.css | ai-system-monitor.js | `SystemMonitor.battery` |
| **Memory Monitor** | — | ai-system-monitor.js | `SystemMonitor.memory` |
| **Storage Monitor** | — | ai-system-monitor.js | `SystemMonitor.storage` |
| **GPU Detection** | — | ai-system-monitor.js | `SystemMonitor.gpu` |
| **Permission Audit** | — | ai-system-monitor.js | `SystemMonitor.permissions` |
| **Full System Check** | ai-engine.css | ai-system-monitor.js, ai-advanced-commands.js | `fullSystemCheck()`, `buildSystemReportPanel()` |
| **Adaptive Learning** | — | ai-learning.js | `JarvisLearning` |
| **Custom Aliases** | — | ai-learning.js, ai-advanced-commands.js | `setAlias()`, `handleAlias()` |
| **AI Engine v3.0** | ai-engine.css | ai-engine.js | `processSingle()`, `enhancedAI()`, `handleJarvisInput()` |
| **Suggestion Chips** | ai-engine.css | ai-engine.js | `typeResponseV2()` |
| **NL Command Map** | — | ai-engine.js, ai-advanced-commands.js | `nlMap` (80+ mappings) |
| **Benchmark / Speedtest** | — | ai-advanced-commands.js | `commands.benchmark()`, `commands.speedtest()` |

---

## Command Reference

### Direct Commands

| Command | Response |
|---------|----------|
| `help` | Lists all available commands |
| `helpwalkthrough` | JARVIS speaks a full feature tour |
| `status` | Current CPU, RAM, GPU, network stats |
| `time` | Current date and time |
| `weather` | Temperature, humidity, wind speed |
| `threat` | Current threat assessment level + factors |
| `scan` | Triggers full-spectrum scan animation |
| `reactor` | Arc reactor power output status |
| `clear` | Clears command response area |
| `diag` | Opens full diagnostic overlay |
| `netinfo` | External IP, ISP, geolocation |
| `security` | Runs 6-module security audit |
| `integrity` | Generates SHA-512 integrity hash |
| `processes` | Refreshes process monitor |
| `uptime` | Displays system uptime |
| `health` | Refreshes and scans health matrix |
| `autoscan` | Triggers manual auto-diagnostic cycle |
| `ip` | Displays external IP address |
| `globe` | Satellite tracker status |
| `lock` | Toggles target lock on cursor |
| `hum` | Toggles ambient reactor hum |
| `surge` | Triggers power surge effect |
| `device` | Shows device intelligence panel |
| `crypto` | Fetches live crypto prices |
| `clock` | Shows world clock panel |
| `export` | Downloads system log as text file |
| `reboot` | Reloads the HUD |
| `youtube` | Opens YouTube |
| `google` | Opens Google |
| `github` | Opens GitHub |
| `news` | Opens Google News |
| `maps` | Opens Google Maps |
| `game` | Launches bot shooter game |
| `battery` | Battery level, charging, drain rate |
| `batterydetail` | Full battery health report |
| `networkdetail` | Network connection details |
| `memorycheck` | JS heap memory usage |
| `memorydetail` | Detailed heap breakdown |
| `storagecheck` | Storage quota & usage |
| `storagedetail` | Full storage analysis |
| `gpuinfo` | GPU renderer & vendor |
| `gpudetail` | WebGL capabilities |
| `perfcheck` | Page load performance |
| `perfdetail` | Full navigation timing |
| `permissions` | Browser permission status |
| `devices` | Connected media devices |
| `systemcheck` | Full system check + visual report panel |
| `whatworks` | Lists working/broken subsystems |
| `mystats` | Personal usage analytics |
| `verbose` / `brief` | Toggle response detail level |
| `proactive` | Toggle proactive AI suggestions |
| `locate` | GPS geolocation |
| `tabinfo` | Current tab URL & title |
| `screeninfo` | Screen resolution & details |
| `clipboard` | Read clipboard contents |
| `colorscheme` | System dark/light mode preference |
| `benchmark` | CPU benchmark suite |
| `speedtest` | Download speed test |
| `helpadvanced` | Lists all v3.0 commands |
| `resetlearning` | Clears all learning data |

### Parameterised Commands

| Command | Syntax | Example |
|---------|--------|---------|
| `speak` | `speak <text>` | `speak Good morning sir` |
| `open` | `open <site/url>` | `open youtube`, `open github.com` |
| `search` | `search <query>` | `search javascript canvas` |
| `calc` | `calc <expression>` | `calc 2 * (3 + 4)` |
| `timer` | `timer <seconds>` | `timer 60` |
| `theme` | `theme <name>` | `theme combat`, `theme stealth`, `theme standard` |
| `memo` | `memo <sub-command>` | `memo save Buy groceries`, `memo list`, `memo delete 1`, `memo clear` |
| `alias` | `alias <sub-command>` | `alias set s = systemcheck`, `alias remove s`, `alias list` |
| `whois` | `whois <IP/domain>` | `whois 8.8.8.8`, `whois google.com` |

---

## AI Conversational Engine

If a typed message doesn't match any command, JARVIS uses a multi-layer AI pipeline:

1. **Alias Resolution** — Checks `JarvisLearning.resolveAlias()` for user-defined shortcuts.
2. **NL Map Lookup** — 80+ natural language phrases mapped to commands (e.g., "check battery" → `battery`).
3. **Fuzzy Matching** — Levenshtein distance ≤3 suggests closest valid command.
4. **Intent Classification** — Classifies into 12 categories with confidence scoring.
5. **Enhanced AI Patterns** — 40+ regex patterns with contextual responses.
6. **Learning Integration** — Records every interaction for prediction and suggestions.

**Conversational Patterns:**

| Pattern | Example Input | Response Category |
|---------|--------------|-------------------|
| Greetings | "hello", "hey", "hi" | Polite greeting |
| Compliments | "good job", "amazing" | Grateful acknowledgment |
| Identity | "who are you", "what are you" | Self-introduction |
| Status | "how are you doing" | System status report |
| Capabilities | "what can you do" | Feature summary |
| Jokes | "tell me a joke" | JARVIS-style humour |
| Shutdown | "shut down", "turn off" | Denial with personality |
| Tony Stark | "tony", "stark" | In-character reference |
| Friday | "friday" | Playful rivalry |
| Music | "play music" | Opens YouTube music |
| Weather | "is it cold", "raining" | Weather data reference |
| Danger | "danger", "threat", "attack" | Screen shake + alert |
| Battery | "check battery", "power level" | Real battery status via API |
| Memory | "how much memory", "ram usage" | JS heap usage report |
| Storage | "how much space", "disk" | Storage quota/usage via API |
| GPU | "what gpu", "graphics card" | WebGL renderer info |
| System Check | "is everything working" | Full subsystem scan + report panel |
| Broken | "what's broken", "what's not working" | Lists failing subsystems |
| Performance | "benchmark", "how fast" | Performance timing or benchmark |
| Speed Test | "internet speed", "test speed" | Real download speed test |
| Permissions | "what's allowed", "check permissions" | Browser permission audit |
| Location | "where am I", "locate me" | GPS geolocation |
| Screen | "screen info", "resolution" | Display details |
| Clipboard | "what's copied", "clipboard" | Clipboard contents |
| My Stats | "my usage", "analytics" | Personal usage report |
| Color Scheme | "dark mode", "light mode" | System preference detection |

Responses are delivered with character-by-character typing animation, spoken aloud (if speech toggle is ON), and include contextual suggestion chips for follow-up actions.

---

## AI System Monitor

The `SystemMonitor` object (in `ai-system-monitor.js`) provides real-time access to browser hardware APIs:

| Subsystem | API | What It Reports |
|-----------|-----|----------------|
| Battery | `navigator.getBattery()` | Level %, charging state, time to charge/discharge, drain rate history, estimated health |
| Network | `navigator.connection` | Effective type (4g/3g/2g), downlink Mbps, RTT, data saver status |
| Memory | `performance.memory` | Used JS heap, total heap, heap limit (Chrome only) |
| Storage | `navigator.storage.estimate()` | Quota, usage, localStorage item count and byte size |
| GPU | WebGL `WEBGL_debug_renderer_info` | Renderer, vendor, GLSL version, HDR support, colour gamut |
| Performance | `PerformanceNavigationTiming` | Page load time, DOM processing, fetch duration |
| Permissions | `navigator.permissions.query()` | Camera, microphone, geolocation, notifications, clipboard-read |
| Media | `navigator.mediaDevices` | Audio input/output count, video input count, device labels |
| Geolocation | `navigator.geolocation` | Latitude, longitude, accuracy |

The `fullSystemCheck()` function audits all subsystems and returns a structured report with pass/warning/failure counts, displayed in a visual overlay panel.

---

## AI Learning Engine

The `JarvisLearning` object (in `ai-learning.js`) adapts to user behaviour over time:

| Feature | Description |
|---------|-------------|
| **Command Tracking** | Records every command with frequency counting |
| **Sequential Patterns** | Tracks command pairs ("A then B") for prediction |
| **Time-of-Day Patterns** | Records which commands are used at which hours |
| **Active Hours** | Builds a 24-hour activity profile |
| **Topic Interests** | Counts topic mentions to understand focus areas |
| **Tone Detection** | Infers preferred style from input patterns |
| **Predictions** | Predicts next likely command based on history |
| **Custom Aliases** | User-defined shortcuts (persisted across sessions) |
| **Proactive Suggestions** | Offers contextual follow-up commands |
| **Analytics** | Full usage report with top commands, peak hours, session count |

All data is persisted to `localStorage` under key `jarvis_learning_v3` and survives page reloads and browser restarts.

---

## Keyboard Shortcuts

| Key | Action | Handled In |
|-----|--------|-----------|
| `Escape` | Toggle fullscreen | commands.js |
| `/` | Focus command bar | commands.js |
| `V` | Toggle voice recognition | commands.js |
| `T` | Cycle theme (Standard → Combat → Stealth) | commands.js |
| `L` | Toggle target lock | commands.js |
| `↑` / `↓` | Command history navigation | commands.js |
| Konami Code | Gold theme easter egg | effects.js |

---

## External APIs

| API | Endpoint | Purpose | Refresh |
|-----|----------|---------|---------|
| [Open-Meteo](https://api.open-meteo.com) | `/v1/forecast` | Weather data (Pokhara, Nepal) | 5 min |
| [ipapi.co](https://ipapi.co) | `/json/` | IP geolocation, ISP info | 2 min |
| [httpbin.org](https://httpbin.org) | `/get` | Connectivity probe | 30s |
| [worldtimeapi.org](https://worldtimeapi.org) | `/api/ip` | Connectivity probe | 30s |
| [CoinGecko](https://api.coingecko.com) | `/api/v3/simple/price` | BTC/ETH/SOL prices | 2 min |

All API calls are read-only GET requests. No API keys required.

---

## Browser APIs Used

| API | Usage |
|-----|-------|
| Canvas 2D | Particles, reactor, radar, globe, matrix rain, sparklines, gauges, audio visualiser, game |
| Web Speech API | `SpeechRecognition` (voice input), `SpeechSynthesis` (voice output) |
| Web Audio API | Ambient reactor hum (60Hz + 120Hz), game sound effects |
| Battery API | Real-time battery level, charging state, drain rate tracking, health estimation |
| Web Crypto API | `getRandomValues` for SHA-512 hash generation |
| Fullscreen API | Toggle fullscreen on Escape |
| localStorage | Memo storage, learning data persistence (`jarvis_learning_v3`) |
| WebGL | GPU renderer, vendor, GLSL version, HDR/colour-gamut detection |
| Network Information API | Connection type, downlink speed, RTT, data saver status |
| `performance.memory` | JS heap usage monitoring (Chrome) |
| Storage API | `navigator.storage.estimate()` for quota/usage analysis |
| Permissions API | Query camera, microphone, geolocation, notification, clipboard permissions |
| MediaDevices API | Enumerate audio/video input/output devices |
| Geolocation API | GPS latitude/longitude positioning |
| Clipboard API | Read clipboard contents |
| Performance Navigation Timing | Page load, DOM processing, resource fetch duration |

---

## How to Run

Open `index.html` in any modern browser (Chrome, Edge, Firefox).

---

## Use as a Live Desktop Wallpaper

Set this HUD as an animated desktop wallpaper on Windows using **Lively Wallpaper** (free, open-source, Microsoft Store):

1. Install [Lively Wallpaper](https://apps.microsoft.com/store/detail/lively-wallpaper/9NTM2QC6QWS7).
2. Click **+** (Add Wallpaper) → **Open File** → browse to `index.html`.
3. Lively renders the HUD as your live desktop wallpaper with full animations.

> **Note:** Interactivity (commands, voice, keyboard) won't work as a wallpaper since it doesn't receive input focus. All visual elements and data panels continue running.

---

## Configuration

To change the weather location, edit the latitude and longitude in `fetchWeather()` inside `js/core.js`:

```javascript
const lat = 28.2096, lon = 83.9856; // Pokhara, Nepal
```

---

## Statistics

| Category | Count |
|----------|-------|
| Total HTML Element IDs | 140+ |
| Total CSS Classes | 220+ |
| CSS @keyframes Animations | 22+ |
| JavaScript Functions | 120+ |
| Global Variables | 50+ |
| Command Handlers | 55+ |
| AI Response Categories | 30 |
| Natural Language Mappings | 80+ |
| Canvas Systems | 7 (particles, reactor, radar, globe, matrix, audio vis, game) |
| API Integrations | 7 |
| Browser APIs Used | 16 |
| Total Source Files | 26 (1 HTML + 9 CSS + 16 JS) |

No external JavaScript libraries or CSS frameworks are used.
