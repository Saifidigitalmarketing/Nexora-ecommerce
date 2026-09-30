/* NEXORA service worker
 * - precaches the offline page and app icons
 * - network-first for pages (falls back to cache, then /offline.html)
 * - stale-while-revalidate for static assets and images
 * - never caches Supabase API/auth traffic, admin or rider pages
 */
const VERSION = "nexora-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const PRECACHE = ["/offline.html", "/fonts/material-symbols-outlined.woff2", "/icons/icon-192.png", "/icons/icon-512.png", "/brand/nexora-logo.svg", "/brand/nexora-mark.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const PRIVATE_PREFIXES = ["/admin", "/rider", "/account", "/checkout", "/auth", "/login", "/signup", "/api"];

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Only handle our own origin + product images; never Supabase REST/Auth.
  const isImage = request.destination === "image";
  if (url.origin !== self.location.origin && !isImage) return;
  if (url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/v1")) return;

  if (request.mode === "navigate") {
    const isPrivate = PRIVATE_PREFIXES.some((p) => url.pathname.startsWith(p));
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (!isPrivate && res.ok) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => (!isPrivate && (await caches.match(request))) || (await caches.match("/offline.html")) || Response.error()),
    );
    return;
  }

  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/fonts/");
  if (isStatic || isImage) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok || res.type === "opaque") cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
