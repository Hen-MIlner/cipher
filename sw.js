// Minimal service worker for PWA installability with fresh network loads

self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through directly to the network without caching
  event.respondWith(fetch(event.request));
});
