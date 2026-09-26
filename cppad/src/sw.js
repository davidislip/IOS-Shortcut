// Service worker: makes the app work offline and adds the cross-origin
// isolation headers (COOP/COEP) that SharedArrayBuffer, and therefore
// interactive stdin, requires. GitHub Pages can't set headers itself.
//
// The VERSION, SHELL and CLANG_CACHE placeholders are filled in by build.mjs.
const VERSION = "__VERSION__";
const SHELL = __SHELL__;
const SHELL_CACHE = `cppad-shell-${VERSION}`;
const LESSON_CACHE = "cppad-lessons";
const CLANG_CACHE = "cppad-clang-__CLANG_VERSION__";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // no-cache: revalidate with the server, so a new worker never stores the
    // previous version from the HTTP cache (GitHub Pages sends max-age=600).
    await cache.addAll(SHELL.map((url) => new Request(url, { cache: "no-cache" })));
    // Prefetch every lesson so they're readable offline.
    try {
      const res = await fetch("lessons/index.json", { cache: "no-cache" });
      const index = await res.clone().json();
      const lessons = await caches.open(LESSON_CACHE);
      await lessons.put("lessons/index.json", res);
      await Promise.all(index.map((l) => lessons.add(new Request(`lessons/${l.file}`, { cache: "no-cache" })).catch(() => {})));
    } catch {}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("cppad-shell-") && key !== SHELL_CACHE) await caches.delete(key);
      if (key.startsWith("cppad-clang-") && key !== CLANG_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

function isolate(response) {
  if (!response || response.status === 0 || response.type === "opaque") return response;
  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

async function networkFirst(request, cacheName, timeoutMs = 4000) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([
      fetch(request, { cache: "no-cache" }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  const path = url.pathname.slice(scope.pathname.length);

  let handler;
  if (path.startsWith("clang/")) {
    handler = cacheFirst(event.request, CLANG_CACHE);
  } else if (path.startsWith("lessons/")) {
    handler = networkFirst(event.request, LESSON_CACHE);
  } else {
    const key = path === "" ? "index.html" : path;
    handler = caches.open(SHELL_CACHE)
      .then((c) => c.match(key, { ignoreSearch: true }))
      .then((hit) => hit ?? fetch(event.request));
  }
  event.respondWith(handler.then(isolate));
});
