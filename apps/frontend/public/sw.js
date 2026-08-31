/*
 * humatter Leads — Service Worker (minimal, hand-rolled).
 *
 * - App-Shell: network-first mit Cache-Fallback (offline nutzbar)
 * - /_next/static & Assets: stale-while-revalidate
 * - /api/*: NIE cachen. Schreibzugriffe scheitern offline -> die App legt
 *   sie in die IndexedDB-Warteschlange (src/lib/outbox.ts).
 */
const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const OFFLINE_URLS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(OFFLINE_URLS))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // niemals cachen

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(staleWhileRevalidate(request, ASSETS));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL));
  }
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put("/", res.clone());
    return res;
  } catch {
    return (await cache.match("/")) ?? Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached ?? network;
}
