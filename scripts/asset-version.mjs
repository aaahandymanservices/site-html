/*
 * The single source of truth for the ?v= stamps on shared stylesheets and
 * scripts.
 *
 * netlify.toml serves /css/* and /js/* as `immutable, max-age=31536000`, so the
 * query string is the whole cache key: two pages that link the same file under
 * two different stamps do not share a cache entry, and a visitor who crosses
 * from one to the other re-downloads bytes they already have. That is exactly
 * what happened while the three page builders each carried their own literal --
 * public/handyman/* asked for tailwind.css?v=20260817b and site.js?v=20260814e
 * while the static pages asked for ?v=20260817d, so tailwind.css (73kB),
 * site-theme.css (95kB), and site.js were all fetched twice by anyone who
 * visited a city page and then the home page.
 *
 * Every builder now imports from here instead:
 *
 *   scripts/update-static-pages.mjs   public/*.html
 *   scripts/build-service-pages.mjs   public/services/*.html
 *   scripts/build-city-pages.mjs      public/handyman/*.html
 *
 * Bump ASSET_VERSION whenever scripts/site-theme.css, scripts/tailwind-input.css,
 * or anything in scripts/js/ changes. A stylesheet fix shipped without a bump
 * reaches new visitors and no one else.
 *
 * Note that this stamp alone is not enough for a returning visitor: the service
 * worker keys assets by pathname with ?v= removed, so public/sw.js has its own
 * CACHE_VERSION that has to move with a stylesheet change as well.
 *
 * 20260831b — form notification repair: bookings, home care plans, contact and
 * emergency now mirror into Netlify Forms (contact and emergency for the first
 * time), and bookings/home-care-plans/emergency dropped
 * data-netlify-recaptcha so those mirrors can succeed; book-page.js and
 * home-care-plans.js stopped forwarding a reCAPTCHA token to the API. Scripts
 * on the /book, /services, /contact and /emergency submission paths changed,
 * so this bump and the matching CACHE_VERSION move in public/sw.js refetch
 * them for returning visitors.
 *
 * 20260901a — commercial quote button skin: the "Request a Commercial Quote"
 * CTAs moved to a named .commercial-quote-btn class (#B91C1C on white) that
 * lives in site-theme.css, replacing the ad-hoc bg-[#b91c1c] utility on the
 * rates page (a utility the previously shipped tailwind.css never contained,
 * so that button silently fell back to the default .aaa-btn gradient) and the
 * red-600 pair on the commercial page. site-theme.css changed behind its
 * unchanged pathname, so this bump and the matching CACHE_VERSION move in
 * public/sw.js refetch the stylesheet for every client.
 *
 * 20260901b — the /gallery page rendered real customer photos from
 * /api/reviews instead of stock placeholders, and its lightbox linked back to
 * the review on /reviews; reviews-page.js gained the matching deep-link
 * scroll for /reviews#review-<id>. gallery-page.js and reviews-page.js both
 * changed behind their unchanged pathnames, so this bump and the matching
 * CACHE_VERSION move in public/sw.js refetch them for returning visitors.
 *
 * 20260901c — the /gallery page was removed entirely. Its footer links are
 * gone from every page, the sitemap entry is dropped, and the review photos
 * that used to deep-link to /gallery now open in a lightbox on /reviews
 * itself (reviews-page.js changed behind its unchanged pathname). This bump
 * and the matching CACHE_VERSION move in public/sw.js refetch that script
 * and every page's updated markup for returning visitors.
 *
 * 20260902a — bookings switched to Google Calendar Appointment Scheduling: the
 * multi-step booking form on /book was replaced by the Google Calendar
 * scheduling iframe, and every booking CTA across the site now renders a
 * Google Calendar scheduling button via page-boot.js instead of opening the
 * old form. page-boot.js changed behind its unchanged pathname, so this bump
 * and the matching CACHE_VERSION move in public/sw.js refetch it for
 * returning visitors.
 */
export const ASSET_VERSION = '20260902a';

/*
 * The icon stylesheet is generated from the glyphs the pages actually use
 * (scripts/build-icon-css.mjs), so it moves on its own schedule rather than
 * with the theme.
 */
export const ICONS_CSS_VERSION = '20260815a';
