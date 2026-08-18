const CACHE_NAME = 'pnorth-pilotage-v1';

const APP_SHELL = [
  './',
  './index.html',
  './css/tailwind.css',
  './js/signature_pad.min.js',
  './js/localforage.min.js',
  './js/jspdf.umd.min.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Pre-cache every app shell file so the very first offline load still works.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Drop any old versioned caches from a previous deploy.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for the app shell: instant load, works offline. Anything not
// pre-cached falls back to the network, and a successful response for a
// same-origin GET is stashed for next time too.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (response && response.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline and not cached - if it's a navigation, fall back to the app shell.
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
