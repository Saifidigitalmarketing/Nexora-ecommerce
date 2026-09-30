/* NEXORA service worker
 * - precaches the offline page and app icons
 * - network-first for pages via navigation preload (falls back to cache,
 *   then /offline.html)
 * - network-first for same-origin static assets (chunks, icons, fonts) with
 *   an offline fallback to Cache Storage
 * - cross-origin images are left to the browser HTTP cache
 * - never caches Supabase API/auth traffic, admin or rider pages
 */
const VERSION = "nexora-v7";
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
      // Navigation preload: the browser starts the page request in parallel with
      // SW start-up and we pass that original stream through unchanged.
      .then(() => self.registration.navigationPreload?.enable())
      .then(() => self.clients.claim()),
  );
});

const PRIVATE_PREFIXES = ["/admin", "/rider", "/account", "/checkout", "/auth", "/login", "/signup", "/api"];

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Only handle our own origin; never Supabase, product image CDNs or APIs.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const isPrivate = PRIVATE_PREFIXES.some((p) => url.pathname.startsWith(p));
    event.respondWith(
      Promise.resolve(event.preloadResponse)
        .then((preloaded) => preloaded || fetch(request))
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
  if (isStatic) {
    // Network-first (the browser HTTP cache keeps this fast) so script timing
    // matches a normal page load; Cache Storage is only the offline fallback.
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(request)) || Response.error()),
    );
  }
});
