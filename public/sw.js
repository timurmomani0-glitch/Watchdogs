// ctOS service worker — offline shell only. API responses are NEVER cached:
// stale device/scope data would be misleading, and the registry must always be
// read live from the server.
const CACHE = 'ctos-shell-v1';
const SHELL = ['/', '/index.html', '/ctos.css', '/ctos.js',
  '/dedsec-logo.png', '/dedsec-skull.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) =>
    Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/') || u.pathname === '/ws') return; // always live
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
