// ==================== J.A.R.V.I.S. SERVICE WORKER ====================
const CACHE_NAME = 'jarvis-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/base.css',
    './css/boot.css',
    './css/layout.css',
    './css/command.css',
    './css/diagnostics.css',
    './css/effects.css',
    './css/widgets.css',
    './css/game.css',
    './css/ai-engine.css',
    './js/utils.js',
    './js/canvas.js',
    './js/core.js',
    './js/boot.js',
    './js/threat.js',
    './js/effects.js',
    './js/tools.js',
    './js/diagnostics.js',
    './js/commands.js',
    './js/init.js',
    './js/game.js',
    './js/ai-personality.js',
    './js/ai-time.js',
    './js/ai-system-monitor.js',
    './js/ai-learning.js',
    './js/ai-engine.js',
    './js/ai-advanced-commands.js',
];

const API_HOSTS = [
    'api.open-meteo.com',
    'ipapi.co',
    'api.coingecko.com',
    'httpbin.org',
    'worldtimeapi.org',
];

// Install — cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — cache-first for static, network-first for API
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Network-first for API calls
    if (API_HOSTS.some((host) => url.hostname === host)) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return response;
                })
                .catch(() =>
                    caches.match(event.request).then((cached) => {
                        if (cached) {
                            // Notify clients about offline mode
                            self.clients.matchAll().then((clients) => {
                                clients.forEach((client) => client.postMessage({ type: 'OFFLINE_FALLBACK' }));
                            });
                            return cached;
                        }
                        return new Response(JSON.stringify({ error: 'offline' }), {
                            headers: { 'Content-Type': 'application/json' },
                        });
                    })
                )
        );
        return;
    }

    // Cache-first for static assets
    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
});
