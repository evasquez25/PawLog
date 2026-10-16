/* Built by vite-plugin-pwa. Only this release's static app files are cached. */
const manifest = self.__WB_MANIFEST;
const ASSETS = manifest.map((entry) => `/${entry.url.replace(/^\//, '')}`);
// Include both content revisions and hashed asset names in the cache identity.
const version = Array.from(JSON.stringify(manifest)).reduce(
  (hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) | 0,
  0,
);
const CACHE = `pawlog-shell-${version}`;
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key.startsWith('pawlog-shell-') && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    }),
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Supabase, API calls and user photos always use the network.
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/')
  )
    return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const shell = await (await caches.open(CACHE)).match('/index.html');
        return shell || Response.error();
      }),
    );
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches
        .open(CACHE)
        .then(async (cache) => (await cache.match(url.pathname)) || fetch(event.request)),
    );
  }
});
