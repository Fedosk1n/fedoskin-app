// Service worker: makes the app installable ("Add to Home Screen") and shows notifications about new lessons.
// It does not cache anything, so new lessons always load fresh.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

// a push from our server (server/push-worker.js): {title, body, id, tag}
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let msg = null;
    try { msg = e.data ? e.data.json() : null; } catch (_) {}
    if (!msg) msg = { title: 'Fedoskin', body: 'New lesson in the app', id: '' };
    await self.registration.showNotification(msg.title || 'Fedoskin', {
      body: msg.body || '',
      icon: 'icons/icon2-192.png',
      badge: 'icons/icon2-192.png',
      tag: msg.tag || 'new-lesson',
      data: { id: msg.id || '' }
    });
  })());
});

// tap on the notification: open the app on that lesson
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const id = (e.notification.data && e.notification.data.id) || '';
  const url = new URL('./' + (id ? '?lesson=' + encodeURIComponent(id) : ''), self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        await w.focus();
        try { w.postMessage({ type: 'open-lesson', id }); return; } catch (_) {}
      }
    }
    await self.clients.openWindow(url);
  })());
});
