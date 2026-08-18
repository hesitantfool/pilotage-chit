// Bump this version string every time index.html (or any app-shell file)
// changes, so the browser detects the service worker itself has changed,
// re-runs install, and refreshes the cached copies. Forgetting to bump this
// is why updates can silently fail to reach devices that already have the
// app installed/cached.
const CACHE_NAME = 'pnorth-pilotage-v2';

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

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const isAppShellDoc =
    event.request.mode === 'navigate' ||
    event.request.url.endsWith('/index.html') ||
    event.request.url.endsWith('/');

  if (isAppShellDoc) {
    // Network-first for the HTML shell itself: whenever there's a
    // connection, always fetch the latest version and refresh the cache
    // with it, so updates are visible the moment the app is reopened.
    // Only falls back to whatever was last cached when truly offline.
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for everything else (vendored JS/CSS libraries, icons) -
  // these rarely change, and this is what makes the app load instantly
  // offline once it's been opened at least once.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (response && response.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {});
    })
  );
});
