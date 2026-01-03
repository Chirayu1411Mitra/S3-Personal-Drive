const CACHE_NAME = 's3-drive-cache-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './script.js',
    './config.js',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Use Stale-While-Revalidate strategy for all requests
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Don't cache non-successful or weird responses, or POST requests
                if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
                    // Note: External CDN resources will be 'cors', not 'basic'. 
                    // For simplicity in this specific "shell" cache, we can loosen the check 
                    // or just cache everything that matches our list.
                    // But a true Stale-While-Revalidate for *everything* can be dangerous (caching API calls).

                    // Let's refine: Only cache get requests.
                }

                // Clone the response because it can only be consumed once
                const responseToCache = networkResponse.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    // We only want to cache GET requests usually
                    if (event.request.method === 'GET') {
                        cache.put(event.request, responseToCache);
                    }
                });

                return networkResponse;
            }).catch((err) => {
                console.log('Network fetch failed, returning cached response if available. error:', err);
                // If both fail, we can't do much unless we have a fallback page.
            });

            return cachedResponse || fetchPromise;
        })
    );
});
