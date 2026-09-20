const CACHE_NAME = 'cgpr-pwa-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/app.html',
  '/landing.css?v=20260920-1',
  '/styles.css?v=20260920-4',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(url.pathname === '/app.html' ? '/app.html' : '/index.html')));
    return;
  }
  event.respondWith(caches.match(req).then(cached => {
    const network = fetch(req).then(response => {
      if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || network;
  }));
});