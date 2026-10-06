/* Service worker. The point is that this guide keeps working on the Hana
   highway and above 7,000 ft on Haleakala, where there is no signal.

   Strategy is stale-while-revalidate for our own files, not cache-first:
   you get the cached copy instantly (and offline), while a fresh copy is
   fetched in the background for next time. Plain cache-first meant an
   edited file could be invisible until the cache version was bumped, which
   is exactly the kind of thing that makes you distrust the whole page. */

const CACHE = 'maui-v5';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './data.js', './vault.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request, { ignoreSearch: true });

    const network = fetch(request)
      .then((res) => {
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      })
      .catch(() => null);

    // Serve the cached copy immediately when we have one; the network copy
    // lands in the cache for the next load. With no cache, wait on the network.
    return hit || (await network) || new Response('Offline', { status: 503 });
  })());
});
