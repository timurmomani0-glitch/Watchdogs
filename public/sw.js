// ctOS service worker — NETWORK-FIRST.
//
// This app is updated by `git pull`, and the server is on localhost/LAN, so the
// network is both authoritative and fast. A cache-first shell (the previous
// design) meant a pulled update was NEVER served until the worker version was
// bumped by hand — users kept seeing stale JS/CSS after updating. The cache is
// therefore an OFFLINE FALLBACK only, never the preferred source.
//
// API responses are never cached at all: stale device/scope data would be
// actively misleading, and the registry must always be read live.
const CACHE = 'ctos-shell-v2';
const SHELL = ['/', '/index.html', '/ctos.css', '/ctos.js',
  '/dedsec-logo.png', '/dedsec-skull.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  // Prime the offline fallback, then take over immediately.
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/') || u.pathname === '/ws') return; // always live
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Refresh the offline copy with whatever the server just gave us.
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request)) // offline: fall back to last known good
  );
});
