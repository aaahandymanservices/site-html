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
 */
export const ASSET_VERSION = '20260820b';

/*
 * The icon stylesheet is generated from the glyphs the pages actually use
 * (scripts/build-icon-css.mjs), so it moves on its own schedule rather than
 * with the theme.
 */
export const ICONS_CSS_VERSION = '20260815a';
