// ==================== J.A.R.V.I.S. SYSTEM MONITOR v3.0 ====================
// Real browser API access: Battery, Network, Memory, Storage, GPU, Permissions, Media

const SystemMonitor = {

    // ========== BATTERY HEALTH ==========
    battery: {
        supported: false,
        data: null,
        history: [],
        MAX_HISTORY: 120,

        async init() {
            if (!('getBattery' in navigator)) {
                this.supported = false;
                addLog('Battery API not supported on this device', 'warn');
                return;
            }
            try {
                this.data = await navigator.getBattery();
                this.supported = true;
                this.data.addEventListener('chargingchange', () => this._record());
                this.data.addEventListener('levelchange', () => this._record());
                this.data.addEventListener('chargingtimechange', () => this._record());
                this.data.addEventListener('dischargingtimechange', () => this._record());
                this._record();
                addLog('Battery monitoring initialized', 'success');
            } catch (e) {
                this.supported = false;
                addLog('Battery API access denied', 'warn');
            }
        },

        _record() {
            if (!this.data) return;
            this.history.push({
                ts: Date.now(),
                level: Math.round(this.data.level * 100),
                charging: this.data.charging,
                chargingTime: this.data.chargingTime,
                dischargingTime: this.data.dischargingTime
            });
            if (this.history.length > this.MAX_HISTORY) this.history.shift();
        },

        getReport() {
            if (!this.supported || !this.data) return 'Battery API not available on this device.';
            const b = this.data;
            const level = Math.round(b.level * 100);
            const charging = b.charging ? 'CHARGING' : 'DISCHARGING';
            let timeLeft = '';
            if (b.charging && isFinite(b.chargingTime) && b.chargingTime > 0) {
                timeLeft = ' | Full in: ' + this._formatTime(b.chargingTime);
            } else if (!b.charging && isFinite(b.dischargingTime) && b.dischargingTime > 0) {
                timeLeft = ' | Remaining: ' + this._formatTime(b.dischargingTime);
            }
            const health = this._estimateHealth();
            return `Battery: ${level}% [${charging}]${timeLeft} | Health: ${health}`;
        },

        getDetailedReport() {
            if (!this.supported || !this.data) return 'Battery API not available. Likely a desktop system or restricted browser.';
            const b = this.data;
            const level = Math.round(b.level * 100);
            const lines = [];
            lines.push('=== BATTERY DIAGNOSTICS ===');
            lines.push(`Charge Level: ${level}%`);
            lines.push(`Status: ${b.charging ? 'CHARGING' : 'ON BATTERY'}`);
            if (b.charging && isFinite(b.chargingTime) && b.chargingTime > 0) {
                lines.push(`Time to Full: ${this._formatTime(b.chargingTime)}`);
            }
            if (!b.charging && isFinite(b.dischargingTime) && b.dischargingTime > 0) {
                lines.push(`Time Remaining: ${this._formatTime(b.dischargingTime)}`);
            }
            lines.push(`Health Estimate: ${this._estimateHealth()}`);
            lines.push(`Drain Rate: ${this._getDrainRate()}`);
            if (level <= 20 && !b.charging) {
                lines.push('⚠ WARNING: Low power — recommend connecting charger');
            }
            if (level <= 5 && !b.charging) {
                lines.push('🔴 CRITICAL: System may shut down imminently');
            }
            return lines.join('\n');
        },

        _estimateHealth() {
            if (this.history.length < 5) return 'Gathering data...';
            const recent = this.history.slice(-30);
            const drops = [];
            for (let i = 1; i < recent.length; i++) {
                if (!recent[i].charging && !recent[i - 1].charging) {
                    const dt = (recent[i].ts - recent[i - 1].ts) / 1000;
                    const dl = recent[i - 1].level - recent[i].level;
                    if (dt > 0 && dl >= 0) drops.push(dl / dt);
                }
            }
            if (drops.length === 0) return 'NOMINAL (no drain data yet)';
            const avgDrain = drops.reduce((a, b) => a + b, 0) / drops.length;
            if (avgDrain < 0.005) return 'EXCELLENT';
            if (avgDrain < 0.015) return 'GOOD';
            if (avgDrain < 0.03) return 'FAIR';
            return 'DEGRADED — high drain rate detected';
        },

        _getDrainRate() {
            const recent = this.history.slice(-10);
            if (recent.length < 2) return 'Calculating...';
            const first = recent[0], last = recent[recent.length - 1];
            const dt = (last.ts - first.ts) / 60000; // minutes
            if (dt <= 0) return 'Calculating...';
            const dl = first.level - last.level;
            if (dl <= 0) return 'Charging (no drain)';
            return (dl / dt).toFixed(2) + '% per minute';
        },

        _formatTime(seconds) {
            if (!isFinite(seconds) || seconds <= 0) return 'Unknown';
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            if (h > 0) return h + 'h ' + m + 'm';
            return m + 'm';
        }
    },

    // ========== NETWORK INFORMATION ==========
    network: {
        supported: false,
        connection: null,

        init() {
            this.connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            this.supported = !!this.connection;
            if (this.supported) {
                this.connection.addEventListener('change', () => {
                    addLog('Network conditions changed: ' + this.getType(), 'info');
                });
                addLog('Network Information API active', 'success');
            }
        },

        getType() {
            if (!this.supported) return 'Unknown';
            return (this.connection.effectiveType || 'unknown').toUpperCase();
        },

        getReport() {
            if (!this.supported) return 'Network Information API not available.';
            const c = this.connection;
            const parts = [];
            parts.push('Type: ' + (c.effectiveType || 'N/A').toUpperCase());
            if (c.downlink !== undefined) parts.push('Downlink: ' + c.downlink + ' Mbps');
            if (c.rtt !== undefined) parts.push('RTT: ' + c.rtt + 'ms');
            if (c.saveData) parts.push('Data Saver: ON');
            parts.push('Online: ' + (navigator.onLine ? 'YES' : 'NO'));
            return parts.join(' | ');
        },

        getDetailedReport() {
            const lines = ['=== NETWORK DIAGNOSTICS ==='];
            lines.push('Online Status: ' + (navigator.onLine ? 'CONNECTED' : 'OFFLINE'));
            if (this.supported) {
                const c = this.connection;
                lines.push('Connection Type: ' + (c.effectiveType || 'N/A').toUpperCase());
                if (c.type) lines.push('Physical Type: ' + c.type);
                if (c.downlink !== undefined) lines.push('Downlink Speed: ' + c.downlink + ' Mbps');
                if (c.downlinkMax !== undefined) lines.push('Max Downlink: ' + c.downlinkMax + ' Mbps');
                if (c.rtt !== undefined) lines.push('Round Trip Time: ' + c.rtt + 'ms');
                lines.push('Data Saver: ' + (c.saveData ? 'ENABLED' : 'DISABLED'));
            } else {
                lines.push('Detailed network info not available in this browser');
            }
            // External data from existing diagnostics
            if (typeof realIP !== 'undefined') lines.push('External IP: ' + realIP);
            if (typeof realISP !== 'undefined') lines.push('ISP: ' + realISP);
            if (typeof realRegion !== 'undefined') lines.push('Region: ' + realRegion);
            return lines.join('\n');
        }
    },

    // ========== MEMORY / PERFORMANCE ==========
    memory: {
        supported: false,

        init() {
            this.supported = !!(performance && performance.memory);
            if (this.supported) addLog('Memory monitoring active (Chrome)', 'success');
        },

        getReport() {
            if (!this.supported) return 'Memory API not available (works in Chromium browsers).';
            const m = performance.memory;
            const used = (m.usedJSHeapSize / 1048576).toFixed(1);
            const total = (m.totalJSHeapSize / 1048576).toFixed(1);
            const limit = (m.jsHeapSizeLimit / 1048576).toFixed(0);
            const pct = ((m.usedJSHeapSize / m.jsHeapSizeLimit) * 100).toFixed(1);
            return `JS Heap: ${used}MB / ${total}MB (${pct}% of ${limit}MB limit)`;
        },

        getDetailedReport() {
            const lines = ['=== MEMORY DIAGNOSTICS ==='];
            if (this.supported) {
                const m = performance.memory;
                lines.push('Used JS Heap: ' + (m.usedJSHeapSize / 1048576).toFixed(2) + ' MB');
                lines.push('Total JS Heap: ' + (m.totalJSHeapSize / 1048576).toFixed(2) + ' MB');
                lines.push('Heap Limit: ' + (m.jsHeapSizeLimit / 1048576).toFixed(0) + ' MB');
                lines.push('Utilization: ' + ((m.usedJSHeapSize / m.jsHeapSizeLimit) * 100).toFixed(1) + '%');
                if (m.usedJSHeapSize / m.jsHeapSizeLimit > 0.8) {
                    lines.push('⚠ HIGH MEMORY USAGE — possible memory leak');
                }
            } else {
                lines.push('Detailed memory info not available in this browser');
            }
            // Hardware memory
            if (navigator.deviceMemory) {
                lines.push('Device RAM: ' + navigator.deviceMemory + ' GB');
            }
            lines.push('CPU Cores: ' + (navigator.hardwareConcurrency || 'Unknown'));
            return lines.join('\n');
        }
    },

    // ========== STORAGE ANALYSIS ==========
    storage: {
        async getReport() {
            if (!navigator.storage || !navigator.storage.estimate) {
                return 'Storage API not available.';
            }
            try {
                const est = await navigator.storage.estimate();
                const used = (est.usage / 1048576).toFixed(1);
                const quota = (est.quota / 1073741824).toFixed(2);
                const pct = ((est.usage / est.quota) * 100).toFixed(2);
                return `Storage: ${used}MB used / ${quota}GB quota (${pct}%)`;
            } catch {
                return 'Storage estimate failed.';
            }
        },

        async getDetailedReport() {
            const lines = ['=== STORAGE DIAGNOSTICS ==='];
            if (navigator.storage && navigator.storage.estimate) {
                try {
                    const est = await navigator.storage.estimate();
                    lines.push('Used: ' + (est.usage / 1048576).toFixed(2) + ' MB');
                    lines.push('Quota: ' + (est.quota / 1073741824).toFixed(2) + ' GB');
                    lines.push('Utilization: ' + ((est.usage / est.quota) * 100).toFixed(3) + '%');
                } catch {
                    lines.push('Could not estimate storage');
                }
            }
            // localStorage usage
            try {
                let lsSize = 0;
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    lsSize += key.length + localStorage.getItem(key).length;
                }
                lines.push('LocalStorage: ' + (lsSize * 2 / 1024).toFixed(1) + ' KB (approx)');
                lines.push('LocalStorage Keys: ' + localStorage.length);
            } catch {
                lines.push('LocalStorage: access restricted');
            }
            // sessionStorage
            try {
                lines.push('SessionStorage Keys: ' + sessionStorage.length);
            } catch { /* ignored */ }
            // Cookies
            lines.push('Cookies Enabled: ' + (navigator.cookieEnabled ? 'YES' : 'NO'));
            return lines.join('\n');
        }
    },

    // ========== GPU / GRAPHICS INFO ==========
    gpu: {
        info: null,

        init() {
            try {
                const cvs = document.createElement('canvas');
                const gl = cvs.getContext('webgl2') || cvs.getContext('webgl') || cvs.getContext('experimental-webgl');
                if (gl) {
                    const ext = gl.getExtension('WEBGL_debug_renderer_info');
                    this.info = {
                        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'Unknown',
                        vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'Unknown',
                        version: gl.getParameter(gl.VERSION),
                        shadingVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                        maxViewport: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
                        webgl2: !!cvs.getContext('webgl2')
                    };
                    addLog('GPU info acquired: ' + this.info.renderer.substring(0, 40), 'success');
                }
            } catch { /* WebGL not available */ }
        },

        getReport() {
            if (!this.info) return 'GPU info not available (WebGL not supported).';
            return `GPU: ${this.info.renderer} | ${this.info.version}`;
        },

        getDetailedReport() {
            const lines = ['=== GPU DIAGNOSTICS ==='];
            if (this.info) {
                lines.push('Renderer: ' + this.info.renderer);
                lines.push('Vendor: ' + this.info.vendor);
                lines.push('WebGL Version: ' + this.info.version);
                lines.push('GLSL Version: ' + this.info.shadingVersion);
                lines.push('Max Texture Size: ' + this.info.maxTextureSize + 'px');
                lines.push('WebGL 2.0: ' + (this.info.webgl2 ? 'SUPPORTED' : 'NOT AVAILABLE'));
            } else {
                lines.push('WebGL not available on this device');
            }
            lines.push('Screen: ' + screen.width + 'x' + screen.height + ' @ ' + screen.colorDepth + '-bit');
            lines.push('Pixel Ratio: ' + window.devicePixelRatio.toFixed(1) + 'x');
            lines.push('Color Gamut: ' + (matchMedia('(color-gamut: p3)').matches ? 'P3 Wide' : matchMedia('(color-gamut: srgb)').matches ? 'sRGB' : 'Unknown'));
            lines.push('HDR: ' + (matchMedia('(dynamic-range: high)').matches ? 'SUPPORTED' : 'STANDARD'));
            return lines.join('\n');
        }
    },

    // ========== PERFORMANCE METRICS ==========
    performance: {
        getReport() {
            if (!performance || !performance.getEntriesByType) return 'Performance API not available.';
            const nav = performance.getEntriesByType('navigation')[0];
            if (!nav) return 'Navigation timing not available.';
            const pageLoad = Math.round(nav.loadEventEnd - nav.startTime);
            const domReady = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
            const ttfb = Math.round(nav.responseStart - nav.requestStart);
            return `Page Load: ${pageLoad}ms | DOM Ready: ${domReady}ms | TTFB: ${ttfb}ms`;
        },

        getDetailedReport() {
            const lines = ['=== PERFORMANCE DIAGNOSTICS ==='];
            const nav = performance.getEntriesByType('navigation')[0];
            if (nav) {
                lines.push('Page Load Time: ' + Math.round(nav.loadEventEnd - nav.startTime) + 'ms');
                lines.push('DOM Content Loaded: ' + Math.round(nav.domContentLoadedEventEnd - nav.startTime) + 'ms');
                lines.push('Time to First Byte: ' + Math.round(nav.responseStart - nav.requestStart) + 'ms');
                lines.push('DNS Lookup: ' + Math.round(nav.domainLookupEnd - nav.domainLookupStart) + 'ms');
                lines.push('TCP Connection: ' + Math.round(nav.connectEnd - nav.connectStart) + 'ms');
                lines.push('DOM Processing: ' + Math.round(nav.domComplete - nav.domInteractive) + 'ms');
            }
            // Resource count
            const resources = performance.getEntriesByType('resource');
            lines.push('Loaded Resources: ' + resources.length);
            const totalBytes = resources.reduce((a, r) => a + (r.transferSize || 0), 0);
            lines.push('Total Transfer: ' + (totalBytes / 1024).toFixed(1) + ' KB');
            // FPS estimate
            lines.push('Reported FPS: ' + ($('top-fps') ? $('top-fps').textContent : 'N/A'));
            return lines.join('\n');
        }
    },

    // ========== PERMISSIONS CHECKER ==========
    permissions: {
        async checkAll() {
            const perms = ['camera', 'microphone', 'geolocation', 'notifications', 'clipboard-read', 'clipboard-write'];
            const results = [];
            for (const name of perms) {
                try {
                    const status = await navigator.permissions.query({ name });
                    results.push({ name, state: status.state });
                } catch {
                    results.push({ name, state: 'unsupported' });
                }
            }
            return results;
        },

        async getReport() {
            const results = await this.checkAll();
            return results.map(r => r.name.toUpperCase() + ': ' + r.state.toUpperCase()).join(' | ');
        },

        async getDetailedReport() {
            const lines = ['=== PERMISSIONS STATUS ==='];
            const results = await this.checkAll();
            results.forEach(r => {
                const icon = r.state === 'granted' ? '✅' : r.state === 'denied' ? '🔴' : r.state === 'prompt' ? '🟡' : '⚪';
                lines.push(icon + ' ' + r.name.toUpperCase() + ': ' + r.state.toUpperCase());
            });
            return lines.join('\n');
        }
    },

    // ========== MEDIA DEVICES ==========
    media: {
        async getDevices() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                return [];
            }
            try {
                return await navigator.mediaDevices.enumerateDevices();
            } catch {
                return [];
            }
        },

        async getReport() {
            const devices = await this.getDevices();
            if (devices.length === 0) return 'Media Devices API not available.';
            const audio = devices.filter(d => d.kind === 'audioinput').length;
            const video = devices.filter(d => d.kind === 'videoinput').length;
            const output = devices.filter(d => d.kind === 'audiooutput').length;
            return `Devices: ${audio} mic(s), ${video} camera(s), ${output} speaker(s)`;
        },

        async getDetailedReport() {
            const lines = ['=== MEDIA DEVICES ==='];
            const devices = await this.getDevices();
            if (devices.length === 0) {
                lines.push('No media devices detected or API not available');
                return lines.join('\n');
            }
            const kinds = { audioinput: 'MICROPHONE', videoinput: 'CAMERA', audiooutput: 'SPEAKER' };
            devices.forEach((d, i) => {
                const label = d.label || 'Device ' + (i + 1);
                lines.push((kinds[d.kind] || d.kind) + ': ' + label);
            });
            return lines.join('\n');
        }
    },

    // ========== GEOLOCATION (if permitted) ==========
    geolocation: {
        lastPosition: null,

        getPosition() {
            return new Promise((resolve) => {
                if (!('geolocation' in navigator)) {
                    resolve(null);
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    pos => {
                        this.lastPosition = pos;
                        resolve(pos);
                    },
                    () => resolve(null),
                    { timeout: 5000, maximumAge: 60000 }
                );
            });
        },

        async getReport() {
            const pos = await this.getPosition();
            if (!pos) return 'Geolocation not available or denied.';
            const c = pos.coords;
            return `Location: ${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)} | Accuracy: ${Math.round(c.accuracy)}m`;
        }
    },

    // ========== MASTER SYSTEM HEALTH CHECK ==========
    async fullSystemCheck() {
        const checks = [];
        let passed = 0, warnings = 0, failures = 0;

        // Battery
        if (this.battery.supported && this.battery.data) {
            const level = Math.round(this.battery.data.level * 100);
            if (level < 10 && !this.battery.data.charging) { failures++; checks.push({ name: 'BATTERY', status: 'critical', detail: level + '% — CRITICAL' }); }
            else if (level < 20 && !this.battery.data.charging) { warnings++; checks.push({ name: 'BATTERY', status: 'warning', detail: level + '% — LOW' }); }
            else { passed++; checks.push({ name: 'BATTERY', status: 'ok', detail: level + '%' + (this.battery.data.charging ? ' CHARGING' : '') }); }
        } else {
            checks.push({ name: 'BATTERY', status: 'unknown', detail: 'Not available' });
        }

        // Network
        if (navigator.onLine) {
            if (this.network.supported && this.network.connection.rtt > 500) {
                warnings++; checks.push({ name: 'NETWORK', status: 'warning', detail: 'High latency: ' + this.network.connection.rtt + 'ms' });
            } else {
                passed++; checks.push({ name: 'NETWORK', status: 'ok', detail: 'Connected' + (this.network.supported ? ' — ' + this.network.getType() : '') });
            }
        } else {
            failures++; checks.push({ name: 'NETWORK', status: 'critical', detail: 'OFFLINE' });
        }

        // Memory
        if (this.memory.supported) {
            const m = performance.memory;
            const pct = m.usedJSHeapSize / m.jsHeapSizeLimit;
            if (pct > 0.9) { failures++; checks.push({ name: 'MEMORY', status: 'critical', detail: (pct * 100).toFixed(0) + '% heap used' }); }
            else if (pct > 0.7) { warnings++; checks.push({ name: 'MEMORY', status: 'warning', detail: (pct * 100).toFixed(0) + '% heap used' }); }
            else { passed++; checks.push({ name: 'MEMORY', status: 'ok', detail: (pct * 100).toFixed(0) + '% heap used' }); }
        } else {
            checks.push({ name: 'MEMORY', status: 'unknown', detail: 'API not available' });
        }

        // Storage
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const est = await navigator.storage.estimate();
                const pct = est.usage / est.quota;
                if (pct > 0.9) { warnings++; checks.push({ name: 'STORAGE', status: 'warning', detail: (pct * 100).toFixed(0) + '% used' }); }
                else { passed++; checks.push({ name: 'STORAGE', status: 'ok', detail: (pct * 100).toFixed(1) + '% used' }); }
            }
        } catch { /* ignored */ }

        // GPU
        if (this.gpu.info) {
            passed++; checks.push({ name: 'GPU', status: 'ok', detail: this.gpu.info.renderer.substring(0, 35) });
        } else {
            checks.push({ name: 'GPU', status: 'unknown', detail: 'WebGL not available' });
        }

        // Performance (FPS)
        const fpsText = $('top-fps') ? $('top-fps').textContent : '';
        const fps = parseInt(fpsText);
        if (fps && fps < 20) { warnings++; checks.push({ name: 'FPS', status: 'warning', detail: fps + ' FPS — Low' }); }
        else if (fps) { passed++; checks.push({ name: 'FPS', status: 'ok', detail: fps + ' FPS' }); }

        // CPU cores
        const cores = navigator.hardwareConcurrency;
        if (cores) { passed++; checks.push({ name: 'CPU', status: 'ok', detail: cores + ' cores' }); }

        return { checks, passed, warnings, failures, total: checks.length };
    },

    // ========== INITIALIZE ALL MONITORS ==========
    async init() {
        await this.battery.init();
        this.network.init();
        this.memory.init();
        this.gpu.init();
        addLog('System Monitor v3.0 — all subsystems initialized', 'success');

        // Start periodic battery & memory monitoring
        setInterval(() => {
            if (this.battery.supported) this.battery._record();
        }, 30000);
    }
};
