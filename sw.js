// Minimal service worker: makes the alpha installable as an app ("Add to Home Screen").
// It does not cache anything yet, so new lessons always load fresh.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
