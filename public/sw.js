/*
 * Service worker for AAA Handyman Services LLC.
 *
 * Goals, in order: never serve stale content to an online visitor, keep the
 * shell instant on repeat visits, and show a branded page instead of the
 * browser's error screen when the connection drops.
 *
 * Strategies:
 *   - navigations      network first, fall back to cache, then /offline.html
 *   - static assets    stale-while-revalidate, keyed on the URL minus ?v=
 *   - everything else  straight to the network, uncached
 *
 * Bump CACHE_VERSION to force every client onto a fresh cache.
 */
// v2 evicted the v1 asset cache, where every /.netlify/images request shared a
// single entry and served one image in place of all the others. v3 lands the
// seasonal offer bar: its markup, styles, and behaviour have to arrive
// together, and the asset cache is keyed on the URL minus ?v=, so bumping the
// stamp on the stylesheet and script alone would still have served a returning
// visitor last deploy's pair for one more page view. v4 lands the one-time gate
// on the first-service gift certificate for the same reason: a cached page
// without the `data-gift-certificate` hooks would keep offering it. v5 lands the
// minified scripts and the trimmed stylesheets, which change the bytes behind
// every /js/ and /css/ entry without changing a pathname. v6 lands the
// render-blocking Tailwind link, the card layers dropped from tailwind.css, and
// the home page behaviour lifted out into /js/home.js: the stylesheet's bytes
// change behind an unchanged pathname again, and a returning visitor holding v5
// would otherwise pair this deploy's markup with last deploy's CSS. v7 moves
// the tablet navigation back to the drawer breakpoint and repairs shared form,
// tab, and gift-certificate behavior, so the shell and assets update together.
// v8 reserves the icon glyph boxes in site-theme.css so the asynchronous icon
// stylesheet stops shifting the nav and hero as it lands. That is another
// change to the bytes behind an unchanged /css/ pathname, and the asset cache
// is keyed on the URL minus ?v=, so a returning visitor holding v7 would be
// served last deploy's stylesheet -- and the shift it causes -- for one more
// page view before the revalidation caught up.
// v9 rebuilds /contact on the brand navy: the page's field colours moved into
// site-theme.css and its validation moved into contact-page.js, so the markup
// only reads correctly against this deploy's copy of both. Same pathnames, new
// bytes, so a returning visitor holding v8 would get navy fields wearing the
// old gray autofill fill and a form that still answered with alert() boxes.
// v10 lands the rebuilt /book page: the trust strip, progress rail, quick-pick
// service tiles, live cost estimate, and real-availability badge are markup and
// behaviour that only work together, and /js/book-page.js keeps its pathname
// across the change, so a returning visitor holding v9 would otherwise pair the
// new page with the old script for one more view.
// v11 lands the booking modal, the route-day banner, and the quarterly home
// care plans. The three new behaviour files arrive under new pathnames and are
// picked up cleanly, but every rule that styles them -- the modal shell, the
// bundle tooltips, the plan cards -- was added to site-theme.css and
// tailwind.css behind their unchanged pathnames, so a returning visitor holding
// v10 would open an unstyled modal over last deploy's stylesheet.
// v12 lands the side-by-side pricing and package cards. The layout is entirely
// new rules on site-theme.css behind its unchanged pathname, and an asset
// request's cache key drops ?v= (see assetCacheKey), so the stamp in the page's
// <link> cannot reach a visitor holding v11 -- they would keep last deploy's
// stylesheet, where .pricing-card-row matches nothing and the row falls back to
// a block, stacking the cards down the page. Only this bump refetches it.
// v13 rewrites the service-area zone cards to pin their colours as literal
// values on explicit .zone-card-a / .zone-card-b rules, replacing the
// --zone-accent custom properties that rendered blank in production. Every
// styling rule for the cards lives on site-theme.css behind its unchanged
// pathname, and an asset request's cache key drops ?v= (see assetCacheKey), so
// the stamp in the page's <link> cannot reach a visitor holding v12 -- they
// would keep last deploy's stylesheet, where the cards render as plain white
// with no accent borders or tints. Only this bump refetches it.
// v16 lands the expanded service catalog: seventeen new icon rules were added
// to /css/icons.css (sign-hanging, window-restore, grip-lines, paw, and friends
// used by the new service detail pages), but the cache-buster stamp on the
// <link> was not bumped and neither was this version. An asset request's cache
// key drops ?v= (see assetCacheKey), so a returning visitor holding v15 kept
// last deploy's icons.css -- the one without those rules -- behind the same
// cache key, and every new icon rendered blank. Bumping both the stamp in the
// page (scripts/update-static-pages.mjs) and this version refetches the
// stylesheet and its fonts for every client.
// v17 ships the upgraded AI chat widget: a guided in-chat estimator (zone +
// task selection with live ballpark totals) and inline repair-photo upload.
// chat-loader.js and chat-widget.js are both cached by pathname here, so the
// bumped ?v= stamps alone cannot reach a returning visitor — this bump does.
const CACHE_VERSION = 'v17';
const SHELL_CACHE = `aaa-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `aaa-assets-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// The start_url and offline page must be available with no network at all;
// the rest is what every page needs to render its first frame.
const PRECACHE_URLS = [
  '/',
  OFFLINE_URL,
  '/css/tailwind.css',
  '/css/site-theme.css',
  '/css/icons.css',
  '/js/site.js',
  // Everything the precached start_url needs to be interactive offline. The
  // other pages' behaviour files are picked up by the asset cache on first use.
  '/js/home.js',
  '/js/gift-certificate.js',
  '/js/chat-loader.js',
  '/fonts/archivo-latin.woff2',
  '/fonts/roboto-latin.woff2',
  '/fonts/fa-solid-900.woff2',
  // Two glyphs' worth of brand icons, and every page preloads it.
  '/fonts/fa-brands-400.woff2',
  '/icons/icon-192.png',
  '/manifest.webmanifest',
];

// Requests that must always hit the origin: form posts, bookings, chat, review
// submissions, and analytics.
const NETWORK_ONLY_PATHS = ['/api/', '/.netlify/functions/', '/.netlify/identity/'];

const STATIC_ASSET_PATTERN = /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico|webmanifest|json)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Add entries individually: one 404 shouldn't void the whole precache.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [SHELL_CACHE, ASSET_CACHE];
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !keep.includes(name)).map((name) => caches.delete(name)),
      );

      // Let the browser handle range requests and back/forward navigations
      // from its own cache without waking the worker.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.disable();
      }

      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

/**
 * Cache lookup for a navigation, ignoring the query. Offline, any cached copy of
 * the page is a better answer than the offline placeholder, even if it was
 * stored under different query parameters.
 */
function matchIgnoringQuery(request) {
  return caches.match(request, { ignoreSearch: true });
}

/*
 * Cache key for an asset request.
 *
 * Only the ?v= cache-buster is dropped, so a version bump still lines up with
 * the copy stored by the precache. The rest of the query has to survive: every
 * Netlify Image CDN request shares the pathname /.netlify/images and identifies
 * the image entirely through its query, so discarding it would collapse all of
 * them onto one entry and serve a single picture for the logo, the banner, the
 * icons, and every review photo.
 */
function assetCacheKey(request) {
  const url = new URL(request.url);
  url.searchParams.delete('v');
  return url.href;
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    // Only cache real, final HTML responses.
    if (response.ok && response.type !== 'opaque' && !response.redirected) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (error) {
    const cached = await matchIgnoringQuery(request);
    if (cached) return cached;

    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;

    return new Response('You are offline.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function handleAsset(event) {
  const { request } = event;
  const key = assetCacheKey(request);
  // The format is pinned in the URL, so the key alone identifies the variant.
  // ignoreVary keeps that true if the Image CDN ever starts negotiating on
  // Accept, which would otherwise turn every lookup into a silent miss.
  const cached = await caches.match(key, { ignoreVary: true });

  const network = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type !== 'opaque') {
        const cache = await caches.open(ASSET_CACHE);
        await cache.put(key, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    // Refresh in the background; the visitor gets the cached copy immediately.
    // waitUntil keeps the worker alive long enough for that write to land.
    event.waitUntil(network);
    return cached;
  }

  const response = await network;
  if (response) return response;

  throw new Error(`Unable to fetch ${request.url}`);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }

  // Third-party requests (analytics, maps) stay entirely on the network.
  if (url.origin !== self.location.origin) return;
  if (NETWORK_ONLY_PATHS.some((path) => url.pathname.startsWith(path))) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (STATIC_ASSET_PATTERN.test(url.pathname) || url.pathname.startsWith('/.netlify/images')) {
    event.respondWith(handleAsset(event));
  }
});
