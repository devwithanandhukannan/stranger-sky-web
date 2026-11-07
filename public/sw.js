// Untold PWA Service Worker
const CACHE_NAME = 'untold-cache-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET') {
    // Never cache dynamic Next.js scripts, sky assets or API calls
    if (event.request.url.includes('/_next/') || event.request.url.includes('/api/')) {
      return;
    }
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
