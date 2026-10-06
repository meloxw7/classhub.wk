const CACHE = 'classhub-v3';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return r;
      })
      .catch(() => caches.match(e.request).then((x) => x || caches.match('/index.html')))
  );
});

self.addEventListener('push', (e) => {
  if (!e.data) return;
  let data = {};
  try {
    data = e.data.json();
  } catch {
    data = { title: 'ClassHub', body: e.data.text() };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'ClassHub', {
      body: data.body || '',
      tag: 'classhub-' + (data.type || 'info'),
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) return client.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});
