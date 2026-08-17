/* OrbitBills Service Worker — full offline shell + asset cache */
const CACHE_NAME = 'orbitbills-web-v4';
const PRECACHE = [
  './',
  './index.html',
  './signin.html',
  './billing.html',
  './admin-dashboard.html',
  './accountant-dashboard.html',
  './offline.html',
  './404error.html',
  './aboutus.html',
  './contact.html',
  './privacy-policy.html',
  './terms-of-use.html',
  './splash-boot.html',
  './client-portal.html',
  './display.html',
  './support-dashboard.html',
  './Db.js',
  './orbit-native.js',
  './orbit-assets.js',
  './qrcode.min.js',
  './favicon.ico',
  './app-icon-96.png',
  './app-icon-192.png',
  './app-icon-512.png',
  './calc.png',
  './calc-256.png',
  './splash-boot.png',
  './splash-loading.png',
  './ts-element-512.png',
  './manifest.webmanifest',
  './techserenia_users.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isNav(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept') && request.headers.get('accept').includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (isNav(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          let hit = await cache.match(req) || await cache.match(url.pathname);
          if (hit) return hit;
          const path = (url.pathname.replace(/^\//, '') || 'index.html');
          for (const c of ['./' + path, path, './billing.html', './signin.html', './index.html', './offline.html']) {
            hit = await cache.match(c);
            if (hit) return hit;
          }
          return cache.match('./offline.html') || new Response(
            '<!DOCTYPE html><html><body style="font-family:system-ui;padding:24px;text-align:center"><h1>Offline</h1><p>OrbitBills still works on this device.</p><p><a href="./billing.html">Billing</a> · <a href="./signin.html">Sign in</a></p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && /\.(js|css|png|jpg|jpeg|gif|ico|svg|webp|json|webmanifest|html)$/i.test(url.pathname)) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req));
    })
  );
});

/* Show notifications from SW so they feel more "app-like" when granted */
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'NOTIFY' && self.registration && self.registration.showNotification) {
    const title = data.title || 'OrbitBills';
    const opts = {
      body: data.body || '',
      icon: data.icon || './app-icon-192.png',
      badge: './app-icon-96.png',
      tag: data.tag || ('orbit-' + (data.id || Date.now())),
      renotify: !!data.renotify,
      data: data.extra || {}
    };
    event.waitUntil(self.registration.showNotification(title, opts));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = './billing.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url && 'focus' in c) {
          c.focus();
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
