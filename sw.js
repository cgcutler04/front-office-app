/* Front Office service worker — app shell only. Cross-origin requests (api.sleeper.app, *.espn.com, api.fantasycalc.com,
   api.open-meteo.com, sleepercdn.com, a.espncdn.com) are never intercepted: the app keeps its own multi-hour JSON caches in
   IndexedDB, and a second cache here would defeat its online detection and its live ticks. */
const VERSION = 'fo-20260906-141305';                 // stamped by Deploy-Phone.ps1 on every build
const SHELL = ['./', './index.html', './front-office.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  // cache:'reload' bypasses the HTTP cache (GitHub Pages serves max-age=600) so a new VERSION never precaches the previous build.
  // No skipWaiting() here — the page decides (silent swap on a fresh launch, a Reload prompt mid-session) and posts SKIP_WAITING.
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;   // APIs + images: the browser's own path, never cached here
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });   // cache-first shell, versioned by VERSION
    if (hit) return hit;
    try { return await fetch(req); }
    catch (err) {
      if (req.mode === 'navigate') { const shell = await caches.match('./front-office.html'); if (shell) return shell; }
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('notificationclick', e => { e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(cs => { const c = cs.find(x => 'focus' in x); return c ? c.focus() : self.clients.openWindow('./front-office.html'); })); });
