// Minimal service worker for PWA installability with network-only strategy

self.addEventListener('install', () => {
  // Activate worker immediately after installation
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim control over all open client tabs immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS requests to avoid browser extension errors
  if (!event.request.url.startsWith('http')) return;

  // Pass directly through to the network
  event.respondWith(
    fetch(event.request).catch((error) => {
      // Optional: Handle network failure gracefully
      console.error('[SW] Fetch failed:', error);
      throw error;
    })
  );
});
