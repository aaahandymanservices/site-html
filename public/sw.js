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
// v17 lands the AI Repair Estimator (/ai-estimate) and its icons (camera,
// wand-magic-sparkles, microchip, image, cloud-arrow-up, triangle-exclamation,
// xmark) on /css/icons.css behind its unchanged pathname. The asset cache key
// drops ?v=, so bumping both the icons.css stamp (update-static-pages.mjs and
// the service/city generators) and this version refetches the stylesheet and
// its newly subsetted fonts for every client, so the new glyphs don't render
// blank on a returning visitor's first page view.
// v21 fixes the large blank white space above "Popular Handyman Services" on
// the city landing pages. The .ambient-glow-hero rule on site-theme.css now
// declares a plain-CSS navy gradient + background-color fallback so the hero
// is never white-with-white-text if the Tailwind gradient utilities are slow
// to parse or stripped by an extension, and .reveal-on-scroll is now guarded
// behind .js-reveal so the intro/pricing section is visible without JS
// instead of sitting at opacity:0 as a blank gap. Both live on site-theme.css
// behind its unchanged pathname; the asset cache key drops ?v=, so a returning
// visitor holding v20 would keep last deploy's stylesheet and still see the
// gap. Only this bump refetches it.
// v22 fixes the city landing pages where the intro/pricing section stayed
// invisible after JS ran. site.js's initScrollReveal() set up the
// .reveal-on-scroll observer only after an `if (!units.length) return` guard,
// and city pages have no <section> elements, so the guard returned early --
// leaving .reveal-on-scroll at opacity:0 (js-reveal had already been added to
// <html>) with no observer to add is-visible and no safety-net fallback. The
// observer and safety net now run regardless of whether any <section> units
// were found. The fix lives on /js/site.js behind its unchanged pathname; the
// asset cache key drops ?v=, so bumping both the site.js stamp
// (update-static-pages.mjs) and this version refetches the script for every
// client.
// v23 lands the upgraded AI Repair Estimator upload flow, which introduced two
// new icons (images, plus) on /css/icons.css behind its unchanged pathname.
// The asset cache key drops ?v=, so a returning visitor holding v22 keeps last
// deploy's icons.css and subsetted fonts -- the ones without those glyphs --
// and the dropzone's images icon and the empty-slot plus placeholder render
// blank. Bumping this version refetches the stylesheet and its newly subsetted
// fonts for every client, so the new glyphs don't render blank on a returning
// visitor's first page view.
// v24 lands the /reviews layout fixes (map pin styling, FAB clearance, form and
// card grid responsiveness) on /css/site-theme.css behind its unchanged pathname.
// The asset cache key drops ?v=, so bumping both the stylesheet's ?v= stamp in
// update-static-pages.mjs and this version refetches the new CSS for every
// client; otherwise a returning visitor keeps last deploy's stylesheet and the
// review page's pins and grids keep their old, broken layout.
// v25 lands the contact form photo upload: the new /api/contact-quote function,
// the photo-serving /api/contact-quote/photo/:key, and the drag-and-drop widget
// on /contact. The behaviour and the markup ship together, and contact-page.js
// keeps its pathname, so a returning visitor holding v24 would otherwise pair
// the new form with the old script and see the dropzone render inert. Bumping
// this version (and the contact-page.js stamp above) refetches the script for
// every client.
// v26 removes the last window.alert/confirm/prompt calls from the customer
// site: the home page quote form, the /reviews owner access flow, and the
// aging-in-place checklist reset now use inline <dialog> elements instead.
// The behaviour and markup ship together, and reviews-page.js keeps its
// pathname, so a returning visitor holding v25 would otherwise pair the new
// /reviews page with the old script and find the Owner Access button inert.
// Bumping this version (and the ASSET_VERSION stamp in update-static-
// pages.mjs) refetches the script for every client.
// v27 fixes the /contact photo upload: the dropzone is a <div role=button>,
// not a <label>, so a click on it never opened the file picker -- only
// drag-and-drop and keyboard activation worked. A click handler is added to
// the dropzone so tapping "Browse Files" or anywhere on it opens the picker.
// The fix lives on /js/contact-page.js behind its unchanged pathname, and the
// asset cache key drops ?v=, so bumping both the contact-page.js stamp in
// contact.html and this version refetches the script for every client;
// otherwise a returning visitor holding v26 would keep the old script and the
// dropzone stays inert on click.
// v28 fixes the /customer-care photo upload: the native file input was styled
// with ::file-selector-button pseudo-element classes on a dark background, and
// the browser painted the "Browse..." button label in the input's own white
// text on the navy field, so the button text was invisible. The input is now a
// styled dropzone <label> with its own "Browse Files" pill and a chosen-state
// row, mirroring the booking and contact forms. The behaviour lives on
// /js/customer-care-page.js, so bumping this version (and the ASSET_VERSION
// stamp in update-static-pages.mjs) refetches the script for every client;
// otherwise a returning visitor holding v27 would keep the old script and the
// dropzone's chosen-state UI would never render.
// v29 lands the narrow-phone overflow fixes. The pages were being cut off at
// the right edge on a 320-360px screen -- the contact, customer care, booking,
// and service area layouts all had a child whose intrinsic minimum width was
// wider than the screen, and <body> is `overflow-x: hidden`, so the excess was
// clipped rather than reachable. The repairs are in /css/site-theme.css, in
// /js/site.js (which now keeps the fee tooltips inside the viewport), and in
// the markup of the affected pages. Cached bytes change behind unchanged
// pathnames once again, so a returning visitor holding v28 would otherwise
// pair this deploy's markup with last deploy's stylesheet and stay cut off.
// v30 gives every photo uploader the same rule -- JPG, PNG, WebP or GIF, 10 MB
// max each -- where the six forms previously disagreed on both the accepted
// formats and the ceiling. The shared accept list, validation messages, and
// browser-side resizing now live on the new /js/photo-upload.js, which every
// page with an upload loads ahead of its own script, and each of those page
// scripts changed to read from it. New file plus changed bytes behind unchanged
// pathnames, so a returning visitor holding v29 would otherwise run last
// deploy's page scripts against this deploy's labels and be told 7 MB by one
// form and 10 MB by the next.
// v31 inlines a critical palette block in every page's <head> (see
// scripts/update-static-pages.mjs): the body grey, the sticky header's white
// with its crimson hairline, the seasonal banner's warm gradient, and the
// booking hero's navy gradient with white text. Tailwind and site-theme.css
// stay render-blocking on purpose, but ~170kB of minified CSS is several
// seconds of dead-white first paint on slow mobile, which reads as a broken
// page -- especially on /book, whose hero is dark navy. The inline block
// paints the brand palette the moment the HTML parses, so the first frame is
// the right colours instead of white-on-white. The pages themselves changed
// behind their unchanged pathnames, and a returning visitor holding v30 would
// otherwise keep last deploy's HTML (the navigation cache is network-first, so
// this only matters for the brief window before the revalidation lands). Only
// this bump evicts the old shell for every client.
// v32 reserved the icon glyph boxes in site-theme.css so the asynchronous icon
// stylesheet's arrival did not re-flow the nav and hero rows. v33 expands the
// inline critical palette block to carry those icon box reservations plus the
// sticky header, seasonal banner, and hero backgrounds itself (painting the
// brand palette the moment the HTML parses, before the render-blocking
// stylesheets' round trips finish on a slow first visit) and purges ~360 lines
// of dead CSS from site-theme.css. site-theme.css stays render-blocking: a
// prior pass tried the media="print" + onload async swap, but that pattern is
// fragile (a cached response or a CSP that forbids inline event handlers
// leaves the page unstyled), so it was reverted to the bulletproof blocking
// link. The pages and the stylesheet changed behind unchanged pathnames, and
// a returning visitor holding v32 would otherwise pair this deploy's HTML
// with last deploy's stylesheet. This bump evicts the old shell and assets for
// every client.
// v35 ships the revised package and menu pricing — every bundle and
// Good/Better/Best menu now carries a 10% package discount, replacing the
// previous 15% and 20% tiers. The booking widget, book-page, and contact-page
// scripts all carry the new prices behind unchanged pathnames, so a returning
// visitor holding v34 would pair this deploy's HTML with last deploy's
// scripts and quote stale prices. This bump evicts the old shell and assets
// for every client.
// v36 unifies the ?v= stamps on the shared stylesheets and scripts. The three
// page builders each carried their own literal, so tailwind.css, site-theme.css,
// and site.js were requested under two different URLs depending on which
// section of the site a visitor landed in, and a stamp bump only ever retired
// half of them. chat-loader.js also changed behind an unchanged pathname: it
// now reads its own stamp and passes it to chat-widget.js instead of hardcoding
// one. It is precached here, so a returning visitor holding v35 would keep the
// old loader and its frozen widget URL indefinitely. This bump evicts the old
// shell and assets for every client.
// v37 ships the new-customer promotion banner across every page except the
// Terms and Privacy pages. The banner lives in the navigation shell markup,
// so a returning visitor holding v36 would keep the prior, banner-less shell
// cached and never see the offer until they reloaded. This bump evicts the old
// shell for every client.
// v38 swaps the offline page's logo image for the new round logo
// (/logo-round-nbg.png) and adds it to the precache list so the offline page
// renders with the new mark even on a fully cold start. The offline page is
// served from the shell cache and its HTML changed behind its unchanged
// pathname, so a returning visitor holding v37 would keep the old page with its
// reference to /icons/icon-192.png. This bump evicts the old shell for every
// client.
// v39 hides the new-customer banner once the $50 first-service gift
// certificate has been redeemed. The banner ships in the navigation shell
// markup, and the redemption state is read in a prepaint guard inside that same
// shell, so a returning visitor holding v38 would keep the prior shell (whose
// guard only checked the banner's own dismissal key) and keep seeing the offer
// bar after they spent the certificate. This bump evicts the old shell and
// assets for every client.
// v41 retires the floating "Call Now!" button and moves the AI Chat launcher to
// the bottom-left corner. The launcher and its panel live in chat-loader.js and
// chat-widget.js, and the loader is precached here, so a returning visitor
// holding v40 would keep the old loader and go on seeing the retired call
// button beside a right-hand chat launcher. site-theme.css also changed --
// the call button's styles are gone and the footer now reserves room for the
// launcher -- and the city and service pages no longer ship the button in
// their markup. This bump evicts the old shell and assets for every client.
// v44 integrates the emoji trigger icon inside the chat input box capsule
// directly alongside the textarea, followed cleanly by the send button.
// This resolves the layout where the input box was positioned between the emoji
// and send controls or separating the buttons.
// v45 follows the cleanup pass: site-theme.css lost the retired seasonal offer
// bar and a batch of dead and duplicated rules, tailwind.css gained the promo
// bar's styles that used to be inlined in every page, and the per-page inline
// service-worker/analytics/promo scripts became /js/page-boot.js. Clients
// holding v44 would keep the old stylesheets and never fetch the new module.
// holding v44 would keep the old stylesheets and never fetch the new module.
// v46 follows the asset-version bump to 20260823b.
// v47 ships the centered chat launcher icon on mobile: chat-loader.js's
// mobile media query now sets justify-content/align-items to center so the
// fa-comments glyph sits in the middle of the 54px round FAB instead of
// pinned to the top-left, which happened because the base rule kept
// justify-content:flex-start for the desktop pill with its visible label.
// The loader is precached here, so a returning visitor holding v46 would
// keep serving the off-center icon until the next deploy.
// v51 clears the crimson letter outline from the hero headline
// (header.hero.ambient-glow-hero h1.hero-title): site-theme.css used to paint a
// 1.5px red -webkit-text-stroke around the white headline glyphs, and the
// headline now renders solid pure white with no stroke, no text shadow, and no
// drop-shadow filter. The rule lives on site-theme.css behind its unchanged
// pathname, and the asset cache key drops ?v=, so a returning visitor holding
// v50 would keep last deploy's stylesheet and keep seeing the red outline.
// Bumping both the site-theme.css stamp (ASSET_VERSION) and this version
// refetches the stylesheet for every client.
// v52 completes the floating-control swap: the Back to Top button now sits at
// bottom-left and the chat launcher at bottom-right. The button's position
// moved in the pages' markup, but the launcher's position lives in
// /js/chat-loader.js -- which is precached in the shell above -- and the shell
// cache is keyed on CACHE_VERSION alone. A returning visitor holding v51 would
// pair this deploy's markup with last deploy's loader, putting both controls at
// bottom-left with the Back to Top button covering the chat button. Bumping
// this version (and the ASSET_VERSION stamp to 20260827a, since /js/* is served
// immutable) refetches the loader and the widget for every client.
// v53 carries the photo-preview fix on the /contact, /book and /emergency
// uploaders. The URL behind each thumbnail is now built by
// /js/photo-upload.js -- precached in the shell above -- and read from there
// by contact-page.js, book-page.js and emergency-page.js. The shell cache is
// keyed on CACHE_VERSION alone and the asset cache drops ?v=, so a returning
// visitor holding v52 would pair this deploy's page scripts with last
// deploy's photo-upload.js, which has no previewUrl for them to call, and
// picking a photo would throw instead of showing a thumbnail. Bumping this
// version (and ASSET_VERSION to 20260827b, since /js/* is served immutable)
// refetches the whole set together.
// v55 consolidates the /service-areas zone lists into one city list per zone
// (map/checker up top, reviews after) and reworks the list styles inside
// site-theme.css. Markup and stylesheet ship together here: a returning
// visitor holding v54 would pair the new zone-list markup with the old
// stylesheet and render the cities unstyled. Bumping this version (and
// ASSET_VERSION to 20260830a) refetches the stylesheet for every client.
// v56 wires the city chips on '/' to the embedded map: /js/service-areas-page.js
// now binds to any [data-city][data-lat][data-lng] chip instead of only the
// links on /service-areas, and site-theme.css adds the pin hover states that
// advertise the behaviour. Both files moved behind unchanged pathnames (the
// asset cache drops ?v=), so a returning visitor holding v55 would keep the
// old script and stylesheet for another year. Bumping this version (and
// ASSET_VERSION to 20260830b) refetches them for every client.
// v57 finishes the interactive map: /service-areas renders its zone lists as
// pill buttons instead of navigation links, so the fly-to actually runs there,
// the header label carries the zone ("Waterford, MI · Zone A"), the checker
// fixes its city matching (exact name before prefix: "rochester hills" no
// longer lands on Rochester), and site-theme.css restyles the pills with a
// crimson selected state. Markup, script and stylesheet ship together here --
// a returning visitor holding v56 would pair the new chips with the old
// stylesheet and the old matcher. Bumping this version (and ASSET_VERSION to
// 20260831a) refetches the set for every client.
// v58 combines two changes from this branch and the latest changes from the
// main project: (1) the home hero is painted with the new banner photo
// (public/logo-banner.jpg) from the first frame — the inline critical block on
// '/' now lays the image under its translucent veil instead of the flat navy
// gradient, and the page preloads the same AVIF renditions it always pointed
// at; the hero markup and inline block changed behind the unchanged '/'
// pathname, so a returning visitor holding v57 would keep last deploy's
// flat-navy hero. (2) form notifications were repaired: /book, /services,
// /contact and /emergency mirror their submissions into Netlify Forms now, and
// the bookings, home-care-plans and emergency forms dropped
// data-netlify-recaptcha so those mirrors can succeed. /js/book-page.js,
// /js/home-care-plans.js, /js/contact-page.js and /js/emergency-page.js all
// changed; /js/* is served immutable and the asset cache keys drop ?v=, so a
// returning visitor holding v57 would keep the old scripts for a year. Both
// changes share this single bump so every client refetches the new shell and
// the new scripts together.
// v59 retints the commercial quote CTAs: the "Request a Commercial Quote"
// buttons on /rates and /commercial moved to a named .commercial-quote-btn
// skin (#B91C1C with white text) that lives on site-theme.css behind its
// unchanged pathname. On /rates the button had also been relying on
// bg-[#b91c1c] and hover:bg-[#991b1b] utilities that the shipped
// tailwind.css never contained, so it was silently falling back to the
// default .aaa-btn gradient; the retint fixes that too. The asset cache key
// drops ?v=, so a returning visitor holding v58 would keep last deploy's
// stylesheet. Bumping this version (and ASSET_VERSION to 20260901a) refetches
// the stylesheet for every client.
// v61 removes the /gallery page: its footer links are gone from every page,
// the sitemap entry is dropped, and the review photos that used to deep-link
// to /gallery now open in a lightbox on /reviews itself. reviews-page.js
// changed behind its unchanged pathname and /js/* is served immutable with
// ?v= dropped from the asset cache key, so a returning visitor holding v60
// would keep the old script for a year. Bumping this version (and
// ASSET_VERSION to 20260901c) refetches it for every client.
// v62 swaps booking over to Google Calendar Appointment Scheduling: the
// multi-step form on /book was replaced by the Google Calendar iframe and
// every booking CTA now opens the Google scheduler via a button that
// /js/page-boot.js renders. page-boot.js changed behind its unchanged
// pathname and /js/* is served immutable with ?v= dropped from the asset
// cache key, so a returning visitor holding v61 would keep the old script
// (which still navigated /book links to the removed form). Bumping this
// version (and ASSET_VERSION to 20260902a) refetches it for every client.
// v63 demotes the footer "Book Online Now" button: every page's footer now
// ships it as a plain text link (data-plain-booking-link) instead of the
// solid red button classes, and page-boot.js skips those links when it
// converts booking CTAs into the Google Calendar scheduling button. Every
// page's markup and page-boot.js changed, so a returning visitor holding
// v62 would keep the old script and button markup. Bumping this version
// (and ASSET_VERSION to 20260902b) refetches them for every client.
// v64 marks the Explore menu's "Book Online" footer link as a plain booking
// link (data-plain-booking-link) on every page, so page-boot.js leaves it as
// an ordinary text link beside the other footer links instead of converting
// it into the Google Calendar scheduling button like the page CTAs. Every
// page's footer markup changed, so a returning visitor holding v63 would
// keep last deploy's footers in the shell cache. This bump evicts the old
// shell for every client.
// v65 raises the Google Calendar booking iframe on /book from 600px to 900px
// so the full scheduler renders without an internal vertical scrollbar. The
// page's markup changed, so a returning visitor holding v64 would keep last
// deploy's booking page in the shell cache. This bump evicts the old shell
// for every client.
const CACHE_VERSION = 'v65';
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
  // Registers this worker, boots analytics, and wires the promo bar dismiss --
  // every page loads it, so it belongs in the shell alongside site.js.
  '/js/page-boot.js',
  '/js/site.js',
  // Everything the precached start_url needs to be interactive offline. The
  // other pages' behaviour files are picked up by the asset cache on first use.
  '/js/home.js',
  // The home page's quote form takes photos, and home.js validates them
  // against the rule this file defines.
  '/js/photo-upload.js',
  '/js/gift-certificate.js',
  '/js/chat-loader.js',
  '/fonts/archivo-latin.woff2',
  '/fonts/roboto-latin.woff2',
  '/fonts/fa-solid-900.woff2',
  // Two glyphs' worth of brand icons, and every page preloads it.
  '/fonts/fa-brands-400.woff2',
  '/icons/icon-192.png',
  '/logo-round-nbg.png',
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
