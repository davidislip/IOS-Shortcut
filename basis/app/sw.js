// Replaced with content-derived values by build.mjs.
const VERSION = '__BASIS_BUILD__';
const ASSETS = __BASIS_ASSETS__;
const CACHE = `basis-${VERSION}`;
const scopedURL = path => new URL(path, self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const existed = (await caches.keys()).includes(CACHE);
    const cache = await caches.open(CACHE);
    try { await cache.addAll(ASSETS.map(path => new Request(scopedURL(path), { cache: 'reload' }))); }
    catch (error) { if (!existed) await caches.delete(CACHE); throw error; }
    // Updates wait for an explicit reload, preserving an open editing session.
  })());
});
self.addEventListener('activate', event => {
  // Retain older complete packs: other open tabs may still run their old build.
  event.waitUntil(self.clients.claim());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') { self.skipWaiting(); return; }
  if (event.data?.type === 'CHECK_CACHE') event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const complete = (await Promise.all(ASSETS.map(path => cache.match(scopedURL(path))))).every(Boolean);
    event.ports[0]?.postMessage({ version: VERSION, complete });
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.href.startsWith(self.registration.scope)) return;
  const relative = url.href.slice(self.registration.scope.length).split(/[?#]/)[0];
  const path = relative === '' || relative === 'index.html' ? './index.html' : `./${relative}`;
  if (!ASSETS.includes(path)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(scopedURL(path));
    return cached || fetch(event.request);
  })());
});
