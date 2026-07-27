// Service worker for AAA Handyman Services.
// Provides installability (PWA) and basic offline support. Bump CACHE_VERSION
// whenever the precached app shell changes so clients pick up new assets.
const CACHE_VERSION = "aaa-v1";
const CACHE_NAME = `${CACHE_VERSION}`;

// Core "app shell" assets that are safe to precache. All are stable paths.
const CORE_ASSETS = [
  "/",
  "/offline.html",
  "/css/tailwind.css",
  "/js/site.js",
  "/js/chat-widget.js",
  "/js/service-area-checker.js",
  "/favicon.ico",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // addAll is atomic; use individual puts so one missing asset can't abort install.
      .then((cache) =>
        Promise.all(
          CORE_ASSETS.map((url) =>
            cache.add(url).catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests. Let the browser deal with the rest
  // (POSTs, the streaming /api/chat endpoint, cross-origin fonts/CDN, etc.).
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // HTML navigations: network-first so visitors always get fresh content when
  // online, falling back to cache and then a friendly offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/offline.html")),
        ),
    );
    return;
  }

  // Everything else (CSS, JS, images, icons): cache-first, then network.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});
