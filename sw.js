// Daybook service worker. Cache-first for same-origin GET requests.
// VERSION is updated by scripts/bump-version.mjs together with config.js.
const VERSION = '1.7.1';
const CACHE = `daybook-v${VERSION}`;

const FILES = [
  './',
  './index.html',
  './styles.css',
  './config.js',
  './manifest.webmanifest',
  './js/app.js',
  './js/auth.js',
  './js/dates.js',
  './js/logic.js',
  './js/merge.js',
  './js/store.js',
  './js/sync.js',
  './js/ui.js',
  './js/sections/account.js',
  './js/sections/daily.js',
  './js/sections/events.js',
  './js/sections/meals.js',
  './js/sections/money.js',
  './js/sections/notes.js',
  './js/sections/shopping.js',
  './js/sections/tasks.js',
  './js/sections/waste.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })));
    // Take over straight away: the open app reloads itself, no "Reload" tap needed.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Only touch Daybook caches: other apps share this origin.
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('daybook-v') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never handle Google / accounts / API requests, or anything cross-origin.
  if (url.origin !== self.location.origin) return;
  // Only this app's own scope (other GitHub Pages projects share the origin).
  if (!url.href.startsWith(self.registration.scope)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const isNav = req.mode === 'navigate';
    const cached = await cache.match(isNav ? './index.html' : req, { ignoreSearch: isNav });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (isNav) {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
