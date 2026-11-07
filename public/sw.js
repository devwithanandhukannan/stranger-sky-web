// Untold PWA Service Worker
const CACHE_NAME = 'untold-cache-v3';

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
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  // Only intercept same-origin requests; NEVER hijack external third-party URLs (Unsplash, APIs, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Bypass dynamic Next.js chunks, server APIs, and WebSockets
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response('', { status: 408, statusText: 'Request Timeout' });
    })
  );
});
