/* OrbitBills SW — 100% offline after first online visit */
const CACHE_NAME = 'orbitbills-web-v5';
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
  './logo.png',
  './manifest.webmanifest',
  './techserenia_users.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const u of PRECACHE) {
      try {
        await cache.add(new Request(u, { cache: 'reload' }));
      } catch (e) {
        try {
          const res = await fetch(u, { cache: 'reload' });
          if (res && res.ok) await cache.put(u, res);
        } catch (e2) {}
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isNav(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept') &&
      request.headers.get('accept').includes('text/html'));
}

async function cachedPage(cache, pathname) {
  const path = (pathname || '/').replace(/^\//, '') || 'index.html';
  const candidates = [
    './' + path, path, '/' + path, pathname,
    './billing.html', './signin.html', './index.html',
    'billing.html', 'signin.html', 'index.html'
  ];
  for (const c of candidates) {
    const hit = await cache.match(c);
    if (hit) return hit;
  }
  return (await cache.match('./offline.html')) || (await cache.match('offline.html')) || null;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (isNav(req)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          try { await cache.put(req, res.clone()); } catch (e) {}
          try {
            const p = url.pathname.replace(/^\//, '') || 'index.html';
            await cache.put('./' + p, res.clone());
          } catch (e) {}
          return res;
        }
      } catch (e) {}
      const hit = await cache.match(req) || await cachedPage(cache, url.pathname);
      if (hit) return hit;
      return new Response(
        '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b3d91"></head><body style="font-family:system-ui;padding:24px;text-align:center;background:#0b3d91;color:#fff;min-height:100vh;display:flex;flex-direction:column;justify-content:center"><h1>OrbitBills</h1><p>Open once online so the app is saved on this phone. Then it works fully offline.</p><p><a href="./billing.html" style="color:#fff">Billing</a> · <a href="./signin.html" style="color:#fff">Sign in</a></p></body></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req) || await cache.match(url.pathname) || await cache.match('.' + url.pathname);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        try { await cache.put(req, res.clone()); } catch (e) {}
      }
      return res;
    } catch (e) {
      return cached || new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (data.type === 'NOTIFY' && self.registration && self.registration.showNotification) {
    event.waitUntil(self.registration.showNotification(data.title || 'OrbitBills', {
      body: data.body || '',
      icon: data.icon || './app-icon-192.png',
      badge: './app-icon-96.png',
      tag: data.tag || ('orbit-' + (data.id || Date.now())),
      data: data.extra || {}
    }));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if (c.url && 'focus' in c) { c.focus(); return; } }
      if (self.clients.openWindow) return self.clients.openWindow('./billing.html');
    })
  );
});
