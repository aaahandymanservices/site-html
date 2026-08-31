import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getUnifiedNav } from './unified-nav.mjs';
import { ASSET_VERSION, ICONS_CSS_VERSION } from './asset-version.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const STATIC_NAV_PAGES = [
  // promoCtaHref points the new-customer banner CTA at the closest booking/
  // quote form on the page so the button scrolls in-page instead of navigating
  // away. promoBanner:false keeps the promo off the legal pages (Terms/Privacy),
  // which intentionally carry no marketing banners.
  { path: 'public/index.html', active: 'none', promoCtaHref: '#quote' },
  { path: 'public/services.html', active: 'services', promoCtaHref: '/book#booking-form' },
  { path: 'public/service-areas.html', active: 'service-areas', promoCtaHref: '/book#booking-form' },
  { path: 'public/rates.html', active: 'rates', removeSectionNav: false, promoCtaHref: '/book#booking-form' },
  { path: 'public/guarantee.html', active: 'guarantee', promoCtaHref: '/book#booking-form' },
  { path: 'public/reviews.html', active: 'reviews', promoCtaHref: '/book#booking-form' },
  { path: 'public/careers.html', active: 'careers', promoCtaHref: '/book#booking-form' },
  { path: 'public/contact.html', active: 'contact', promoCtaHref: '#contact-form' },
  { path: 'public/ai-estimate.html', active: 'ai-estimate', promoCtaHref: '/book#booking-form' },
  { path: 'public/customer-care.html', active: 'none', promoCtaHref: '/book#booking-form' },
  { path: 'public/pricing-policy.html', active: 'none', promoCtaHref: '/book#booking-form' },
  { path: 'public/book.html', active: 'none', promoCtaHref: '#booking-form' },
  { path: 'public/privacy.html', active: 'none', promoBanner: false },
  { path: 'public/terms.html', active: 'none', promoBanner: false },
  { path: 'public/services/aging-in-place-guide.html', active: 'services', promoCtaHref: '/book#booking-form' }
];

/**
 * Normalise asset loading: fonts and icons are self-hosted now, so strip any
 * page that still reaches out to fonts.googleapis.com or cdnjs and point it at
 * the local subset instead. See scripts/site-theme.css for the @font-face
 * rules and scripts/build-icon-css.mjs for the icon stylesheet.
 */
const ICONS_CSS = `/css/icons.css?v=${ICONS_CSS_VERSION}`;
const SITE_THEME_CSS = `/css/site-theme.css?v=${ASSET_VERSION}`;
const SCRIPT_VERSIONS = new Map([
  // Service worker registration, the gtag.js bootstrap, and the promo bar's
  // dismiss handler all live here now instead of in three inline blocks per
  // page, so this file is on the critical path of every page's analytics and
  // offline support -- a stale copy is worse than no copy.
  ['page-boot.js', ASSET_VERSION],
  ['site.js', ASSET_VERSION],
  ['home.js', ASSET_VERSION],
  // The one accept list and 10 MB rule that all six photo uploaders read, plus
  // the resizing that lets a phone picture fit the wire. Every page carrying an
  // upload loads it ahead of its own script, so a stale copy would take the
  // whole set of forms out at once -- it moves with ASSET_VERSION always.
  ['photo-upload.js', ASSET_VERSION],
  ['contact-page.js', ASSET_VERSION],
  // The issue intake form is inert without its script: validation messages, the
  // photo size guard, and the multipart submit all live there, so a stale copy
  // would leave a visitor's report going nowhere.
  ['customer-care-page.js', ASSET_VERSION],
  ['gift-certificate.js', ASSET_VERSION],
  // The booking page's markup and its behaviour ship as a pair -- the progress
  // rail, quick-pick tiles, estimator, and availability badge are all inert
  // markup until this file runs -- so its stamp has to move with the rest.
  ['book-page.js', ASSET_VERSION],
  // The booking modal, the route-day banner, and the home care plan cards are
  // the same deal: the markup that triggers them is inert without the script,
  // so a stale cached copy is worse than no copy.
  ['booking-widget.js', ASSET_VERSION],
  ['service-zone-selector.js', ASSET_VERSION],
  // The ZIP/city lookup and the review filters on /service-areas. Its source
  // only joined scripts/js recently -- before that the served copy was the
  // only copy, and it carried a stamp of its own that sat out every deploy the
  // other scripts took part in.
  ['service-areas-page.js', ASSET_VERSION],
  ['home-care-plans.js', ASSET_VERSION],
  // The AI estimator page's upload, ZIP→zone lookup, analyze call, and submit-
  // to-dispatch flow are all inert markup until this runs, so a stale cached
  // copy leaves a visitor's photo going nowhere -- same reason contact-page.js
  // is versioned here. It used to carry its own stamp, from a deploy the other
  // scripts sat out; now that it reads the shared photo rule from
  // photo-upload.js it has to move whenever that does.
  ['ai-estimate-page.js', ASSET_VERSION],
  // Owner access and review deletion use inline <dialog> elements instead of
  // window.prompt/confirm, and the submitter reads the shared photo rule, so a
  // stale cached copy would leave the Owner Access button inert and the
  // uploader out of step with the label beneath it.
  ['reviews-page.js', ASSET_VERSION],
  /*
   * The last three used to sit outside this map, each frozen on a stamp from
   * whichever deploy last touched it by hand. /js/* is served `immutable,
   * max-age=31536000`, so an unmanaged stamp means an edit to the file reaches
   * new visitors and no one else for a year -- the same trap the comment above
   * ASSET_VERSION describes, just harder to notice because nothing points at
   * these three from anywhere else.
   */
  ['careers-page.js', ASSET_VERSION],
  ['quote-calculator.js', ASSET_VERSION],
  // The emergency intake form is the fourth of these: its photo previews,
  // phone formatting and submit all live in emergency-page.js, and until now
  // the page asked for it under a literal stamp of its own, frozen on
  // whichever deploy last edited the file by hand. /js/* is immutable for a
  // year, so an edit under an unchanged stamp reaches new visitors only.
  ['emergency-page.js', ASSET_VERSION],
  // chat-loader.js runs on all 90 pages, and chat-widget.js now inherits
  // whatever stamp the loader was requested with (see scripts/js/chat-loader.js),
  // so moving this one carries the widget along with it.
  ['chat-loader.js', ASSET_VERSION],
]);
const ASYNC_ICONS_CSS =
  `    <link rel="preload" href="${ICONS_CSS}" as="style" fetchpriority="low" onload="this.onload=null;this.rel='stylesheet'">\n` +
  `    <noscript><link rel="stylesheet" href="${ICONS_CSS}"></noscript>`;

function optimizeFontsAndAssets(html) {
  // Resource hints for origins the site no longer contacts.
  html = html.replace(/[ \t]*<link\s+rel="preconnect"\s+href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>\r?\n/gi, '');
  html = html.replace(/[ \t]*<link\s+rel="preconnect"\s+href="https:\/\/cdnjs\.cloudflare\.com"[^>]*>\r?\n/gi, '');

  // Google Fonts, in every form these pages have used.
  html = html.replace(/[ \t]*<!-- Brand fonts?: [^\n]*-->\r?\n/gi, '');
  html = html.replace(/[ \t]*<link\s+rel="(?:preload|stylesheet)"\s+href="https:\/\/fonts\.googleapis\.com\/[^"]*"[^>]*>\r?\n/gi, '');
  html = html.replace(/[ \t]*<noscript><link\s+rel="stylesheet"\s+href="https:\/\/fonts\.googleapis\.com\/[^"]*"><\/noscript>\r?\n/gi, '');
  html = html.replace(/[ \t]*@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com\/[^)]*\);\r?\n/gi, '');

  // Font Awesome from cdnjs -> generated local subset (preserve on pages that explicitly link FA 6.5.1 all.min.css).
  html = html.replace(/[ \t]*<!-- FontAwesome icons -->\r?\n/gi, '');
  html = html.replace(
    /[ \t]*<link\s+rel="stylesheet"\s+href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/(?!6\.5\.1\/css\/all\.min\.css)[^"]*"[^>]*>\r?\n/gi,
    `    <link rel="stylesheet" href="${ICONS_CSS}">\n`,
  );
  html = html.replace(/[ \t]*<link\s+rel="preload"\s+href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/(?!6\.5\.1\/css\/all\.min\.css)[^"]*"[^>]*>\r?\n/gi, '');
  html = html.replace(/[ \t]*<noscript><link\s+rel="stylesheet"\s+href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^"]*"><\/noscript>\r?\n/gi, '');

  // Strip standalone service-areas.css link (consolidated in site-theme.css)
  html = html.replace(/[ \t]*<link\s+rel="stylesheet"\s+href="\/css\/service-areas\.css(?:\?v=[^"]*)?"[^>]*>\r?\n?/gi, '');

  // Decorative icons should not compete with the hero image or brand font in
  // the critical window. Their stylesheet and fonts can arrive after the first
  // paint, while noscript keeps the icons available without JavaScript.
  html = html.replace(/[ \t]*<link\s+rel="preload"\s+href="\/fonts\/fa-(?:solid-900|brands-400)\.woff2"[^>]*>\r?\n/gi, '');

  /*
   * Preload the two critical self-hosted body fonts. Archivo is the display
   * face (headings, brand) and Roboto is the body text -- tailwind-input.css
   * sets Roboto on <body>, so the first paint blocks on it unless the
   * browser starts the fetch early. Both are tiny variable-font woff2 files
   * served immutable for a year, so this is one round trip on a first visit
   * and free after that. The `crossorigin` attribute is required for fonts
   * (they fetch with CORS mode) or the preload is wasted and the browser
   * re-requests the file.
   *
   * This is idempotent: any existing preload for either font (with or without
   * a type attribute) is normalised to exactly one tagged copy so re-runs of
   * the build never stack duplicates. The attributes are matched quote-agnost-
   * ically (the unminified source uses `rel=preload`, the minifier writes
   * `rel="preload"`).
   */
  const FONT_PRELOADS =
    '    <link rel=preload href=/fonts/archivo-latin.woff2 as=font type=font/woff2 crossorigin>\n' +
    '    <link rel=preload href=/fonts/roboto-latin.woff2 as=font type=font/woff2 crossorigin>';
  html = html.replace(/[ \t]*<link\s+rel=["']?preload["']?\s+href=["']?\/fonts\/archivo-latin\.woff2["']?[^>]*>\r?\n/gi, '');
  html = html.replace(/[ \t]*<link\s+rel=["']?preload["']?\s+href=["']?\/fonts\/roboto-latin\.woff2["']?[^>]*>\r?\n/gi, '');
  html = html.replace(
    /(<meta\s+name=["']?viewport["']?\s+content=["']?[^"'>]*["']?>\r?\n)/i,
    `$1${FONT_PRELOADS}\n`,
  );

  /*
   * Preload the nav logo. Every page's sticky header carries the same 48px
   * /icon.jpg via the .netlify/images AVIF transform, and the <img> already
   * carries fetchpriority=high. A <link rel=preload> for the exact same URL
   * lets the browser start that fetch during HTML parsing instead of waiting
   * for the <img> element to be constructed, which keeps the logo (and the
   * header row it sizes) off the CLS budget on a first visit. The URL matches
   * the 1x srcset entry the <img> uses, so the preload and the element share a
   * single network response. This is idempotent: any existing preload for the
   * icon.jpg transform is stripped first so re-runs never stack duplicates.
   */
  const ICON_PRELOAD =
    '    <link rel=preload as=image href="/.netlify/images?url=/icon.jpg&amp;w=96&amp;fm=avif&amp;q=80" fetchpriority=high>';
  html = html.replace(/[ \t]*<link\s+rel=["']?preload["']?\s+as=["']?image["']?\s+href=["']?\/\.netlify\/images\?url=\/icon\.jpg[^>]*>\r?\n/gi, '');
  html = html.replace(
    /(<link\s+rel=["']?preload["']?\s+href=["']?\/fonts\/roboto-latin\.woff2["']?\s+as=["']?font["']?[^>]*>\r?\n)/i,
    `$1${ICON_PRELOAD}\n`,
  );

  /*
   * Preload the home hero's banner photograph on '/'.
   *
   * The hero background is the LCP image on the home page, and it lives in
   * CSS, where browsers cannot discover it early. These media-scoped preloads
   * (identical in shape to the icon preload above) hand the browser the right
   * width's rendition during HTML parsing: 640px wide on phones, 1440px on
   * tablets and small laptops, and 1760px on large screens. Each width paints
   * exactly the rendition its own preload fetched (see the #top.hero rules in
   * the critical palette below), so the preloaded response is always reused
   * and no second copy of the photo is requested. fetchpriority=high keeps it
   * ahead of everything except the two brand fonts. This is idempotent: any
   * existing banner preloads are stripped first so re-runs never stack
   * duplicates.
   */
  const BANNER_PRELOADS =
    '    <link rel=preload as=image href="/.netlify/images?url=/logo-banner.jpg&amp;w=640&amp;fm=avif&amp;q=65" media="(max-width: 767px)" fetchpriority=high>\n' +
    '    <link rel=preload as=image href="/.netlify/images?url=/logo-banner.jpg&amp;w=1440&amp;fm=avif&amp;q=65" media="(min-width: 768px) and (max-width: 1439px)" fetchpriority=high>\n' +
    '    <link rel=preload as=image href="/.netlify/images?url=/logo-banner.jpg&amp;w=1760&amp;fm=avif&amp;q=65" media="(min-width: 1440px)" fetchpriority=high>\n';
  html = html.replace(/[ \t]*<link\s+rel=["']?preload["']?\s+as=["']?image["']?\s+href=["']?\/\.netlify\/images\?url=\/logo-banner\.jpg[^>]*>\r?\n/gi, '');
  // index.html alone carries the banner hero; on other pages the three links
  // must not be added.
  if (/(<main\s+id=["']?main-content["']?[\s\S]{0,80}?<header\s+id=["']?top["']?\s+class=["']?[^"'>]*\bhero\b[^"'>]*>?)/i.test(html)) {
    html = html.replace(
      /(<link\s+rel=["']?preload["']?\s+as=["']?image["']?\s+href=["']?\/\.netlify\/images\?url=\/icon\.jpg["']?[^>]*>\r?\n)/i,
      `$1${BANNER_PRELOADS}`,
    );
  }

  /*
   * Inline critical palette block.
   *
   * Tailwind and site-theme.css are render-blocking on purpose (see the note
   * above), and together they are ~170kB minified. On a slow mobile connection
   * that is several seconds of dead-white first paint, which reads as a broken
   * page -- especially on /book, whose hero is a dark navy section. The fix is
   * not to defer the stylesheets (that trades the white screen for a layout
   * shift the comments above already paid to remove) but to inline a tiny
   * block that paints the brand palette the moment the HTML is parsed: the
   * body's pale grey, the sticky header's white with its crimson hairline, and
   * the booking hero's navy gradient with white text. Tailwind then lands and
   * refines, but the first frame is already the right colours instead of
   * white-on-white.
   *
   * The rules use the same literal hex values the source stylesheets declare,
   * kept low-specificity so Tailwind's utilities and site-theme's rules win
   * cleanly once they arrive. `id` selectors are used only because the page's
   * own markup already carries them. This is idempotent: any prior
   * #aaa-critical-palette block is stripped first so re-runs never stack.
   *
   * The block carries every rule that paints the above-the-fold chrome the
   * moment the HTML is parsed, before the render-blocking stylesheets' round
   * trips finish on a first visit: the icon glyph box reservation (so the
   * async icons.css never re-flows the nav and hero rows), the sticky header,
   * and the hero / ambient-glow backgrounds and headings. The promo bar is not
   * in here: its own stylesheet ships inside the render-blocking tailwind.css,
   * so it is already painted by the time the parser reaches the banner.
   * Tailwind and site-theme.css stay render-
   * blocking and refine this skeleton once they land; the block only buys the
   * first frame on a slow first visit, it never replaces the stylesheets.
   */
  const CRITICAL_PALETTE =
    '    <style id="aaa-critical-palette">' +
    // Element defaults Tailwind's preflight would otherwise supply after the
    // blocking tailwind.css round trip; the palette block paints first.
    'html{overflow-x:hidden}' +
    'body{background:#f9fafb;color:#111827;margin:0;overflow-x:hidden}' +
    // Reserve a 1em square for every Font Awesome glyph so the async
    // icons.css cannot cause the nav and hero icon rows to re-flow when it
    // lands. :where() keeps specificity at zero so .icon-tile / explicit
    // sizing still wins.
    ':where(.fa,.fas,.far,.fab,.fa-solid,.fa-regular,.fa-brands){display:inline-block;width:1em;line-height:1;font-style:normal;text-align:center}' +
    // Sticky header chrome.
    '#site-header{position:sticky;top:0;z-index:100;background:#fff;border-bottom:3px solid #a61f2e;box-shadow:0 6px 22px rgba(27,42,74,.08)}' +
    // Dark hero / booking section background so its first frame is navy, not
    // white. Matches .ambient-glow-hero in scripts/site-theme.css.
    '.ambient-glow-hero,#booking-section.ambient-glow-hero{position:relative;overflow:hidden;min-height:18rem;background-color:#1b2a4a;background-image:linear-gradient(to right,#101b31 0%,#1b2a4a 50%,#020617 100%);color:#fff}' +
    '.ambient-glow-hero h1,#booking-section.ambient-glow-hero h1,#top.hero h1{color:#fff}' +
    // Homepage hero: paint the banner photo (not a flat navy gradient) in the
    // first frame, mirroring the .hero media rules in site-theme.css. The
    // gradient stays as the fallback colour layer; the image loads via the
    // high-priority rel=preload links in the page head. A single flat
    // translucent veil keeps white text readable over every part of the photo,
    // matching the last frame so the hero never repaints after stylesheets
    // arrive.
    '#top.hero{position:relative;min-height:22rem;background-color:#1b2a4a;background-image:linear-gradient(rgba(3,7,11,.62),rgba(3,7,11,.62)),url(/.netlify/images?url=/logo-banner.jpg&w=1760&fm=avif&q=65);background-size:cover;background-position:center;color:#fff}' +
    // Each width paints exactly the rendition its rel=preload link already
    // fetched (640 phones / 1440 tablets+small laptops), so no second copy of
    // the photo is ever requested.
    '@media(min-width:768px) and (max-width:1439px){#top.hero{background-image:linear-gradient(rgba(3,7,11,.62),rgba(3,7,11,.62)),url(/.netlify/images?url=/logo-banner.jpg&w=1440&fm=avif&q=65)}}' +
    // Reserve the hero's inner stack height so the webfont swap and the icon
    // glyph boxes in .hero-trust / .hero-rating-bar cannot push the trust
    // badges down after first paint. The hero is the LCP element on '/', and a
    // 0.222 CLS came from its title, locale, rating badge, and trust row
    // reflowing as Archivo and the Font Awesome glyphs landed. These
    // min-heights hold the space open during that swap without altering the
    // flow, so the margins the elements already carry keep doing the spacing.
    '#top.hero .max-w-5xl{min-height:20rem}' +
    '#top.hero .hero-rating-bar{min-height:2.4rem}' +
    '#top.hero .hero-trust{min-height:2.5rem;flex-wrap:wrap}' +
    // Promo bar: hold its full painted height during the brief window before
    // tailwind.css lands so the sticky header below it does not jump up when the
    // bar's font and padding resolve. The dismissed state collapses to 0 height
    // via the inline prepaint guard, so reserving space only applies while the
    // bar is shown.
    '.new-customer-banner[hidden]{display:none}' +
    '.new-customer-banner:not([hidden]){display:block;min-height:2.85rem;background:#1b2a4a;border-bottom:3px solid #a61f2e;overflow:hidden}' +
    // Brand row: pin the logo icon's box so the late icon glyph swap and the
    // Archivo title swap cannot resize the <img> slot or reflow the tagline.
    '.site-nav__brand{align-items:center;gap:.75rem}' +
    '.site-nav__brand img{width:2.25rem;height:2.25rem;flex:0 0 auto}' +
    '@media(min-width:640px){.site-nav__brand img{width:2.75rem;height:2.75rem}}' +
    // Skip link stays usable before site-theme.css lands.
    '.skip-link{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}' +
    '.skip-link:focus,.skip-link:focus-visible{position:fixed!important;top:.75rem!important;left:50%!important;transform:translateX(-50%)!important;z-index:200!important;width:auto!important;height:auto!important;padding:.75rem 1.5rem!important;background:#a61f2e!important;color:#fff!important;font-weight:700!important;border-radius:.75rem!important;clip:auto!important;white-space:normal!important}' +
    '</style>';
  html = html.replace(/[ \t]*<style id="aaa-critical-palette">[\s\S]*?<\/style>\r?\n?/gi, '');
  html = html.replace(
    /(<link\s+rel=["']?preload["']?\s+href=["']?\/fonts\/roboto-latin\.woff2["']?\s+as=["']?font["']?[^>]*>\r?\n)/i,
    `$1${CRITICAL_PALETTE}\n`,
  );

  /*
   * Defer the Netlify-provided reCAPTCHA v2 script.
   *
   * Forms on this site carry `data-netlify-recaptcha="true"`, and Netlify's
   * build bot injects `<script src="https://www.google.com/recaptcha/api.js?
   * ...">` into the page during post-processing -- after this build step
   * runs. That script is render-blocking and parses ~490ms of reCAPTCHA /
   * gstatic JavaScript on the main thread before the visitor has even
   * looked at the form, which is the single biggest Lighthouse performance
   * bottleneck on '/'.
   *
   * The widget is not needed until the visitor interacts with the form, so
   * this tiny inline shim (runs synchronously in <head>, before any
   * reCAPTCHA script tag the build bot appends) monkey-patches
   * `document.createElement` to intercept script elements whose src points
   * at google.com/recaptcha or gstatic.com/recaptcha. The intercepted
   * script is held in a queue and only inserted into the DOM when the user
   * focuses, clicks, or types inside a `[data-netlify-recaptcha]` form, or
   * as a 6s idle fallback so the widget still renders on its own if the
   * page is left open. The reCAPTCHA API itself loads asynchronously once
   * injected, and the widget renders into the existing
   * `[data-netlify-recaptcha]` div exactly as it would without the shim.
   *
   * The guard (`window.__aaaRecaptchaDeferrer`) makes this idempotent: a
   * re-run of the build that matches the already-injected block leaves a
   * single copy in place rather than stacking a second one.
   */
  const RECAPTCHA_DEFER_MARKER = 'window.__aaaRecaptchaDeferrer';
  // Strip any prior version of the deferrer (it may have landed before
  // <meta charset> in an earlier build) so the re-insert below always puts
  // a single, current copy in the right place.
  html = html.replace(/[ \t]*<script>[^<]*__aaaRecaptchaDeferrer[^<]*<\/script>\r?\n/gi, '');
  const RECAPTCHA_DEFER_SCRIPT =
      '    <script>(()=>{if(window.__aaaRecaptchaDeferrer)return;window.__aaaRecaptchaDeferrer=true;' +
      'var pending=[],armed=false,origCreate=document.createElement.bind(document);' +
      'var RE=/^https?:\\/\\/(www\\.)?google\\.com\\/recaptcha\\/|^https?:\\/\\/(www\\.)?gstatic\\.com\\/recaptcha\\//;' +
      'var ds=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,"src"),oset=ds&&ds.set;' +
      'function flush(){if(armed)return;armed=true;var p=pending;pending=[];p.forEach(function(s){var v=s._aaaRealSrc;if(v){s._aaaRealSrc=null;oset.call(s,v)}})}' +
      'document.createElement=function(tag){var el=origCreate(tag);if(typeof tag==="string"&&tag.toLowerCase()==="script"&&ds&&oset){' +
      'Object.defineProperty(el,"src",{get:ds.get,set:function(v){if(typeof v==="string"&&RE.test(v)){el._aaaRealSrc=v;pending.push(el);' +
      'if(!armed){"requestIdleCallback"in window?requestIdleCallback(function(){setTimeout(flush,6e3)},{timeout:1e4}):setTimeout(flush,6e3);' +
      '["focusin","click","input","keydown","touchstart"].forEach(function(e){document.addEventListener(e,function h(){flush();document.removeEventListener(e,h,{capture:true})},{once:true,capture:true,passive:true})})}return}oset.call(el,v)},configurable:true,enumerable:true})}return el};' +
      '})()</script>';
    html = html.replace(
      /(href=["']?\/fonts\/roboto-latin\.woff2["']?\s+as=["']?font["']?[^>]*>\r?\n)/i,
      `$1${RECAPTCHA_DEFER_SCRIPT}\n`,
    );
  // The lookbehind matters: without it this pattern also matches the icons
  // link *inside* the <noscript> fallback it is meant to write, replacing the
  // fallback's contents with a second async block and leaving the surrounding
  // <noscript> wrapped around it. One pass over a page whose head had drifted
  // was enough to nest the block inside its own fallback.
  html = html.replace(
    /(?<!<noscript>)[ \t]*<link\s+rel="(?:stylesheet|preload)"\s+href="\/css\/icons\.css(?:\?v=[^"]*)?"[^>]*>\r?\n?(?:[ \t]*<noscript><link\s+rel="stylesheet"\s+href="\/css\/icons\.css(?:\?v=[^"]*)?"><\/noscript>\r?\n?)?/gi,
    `${ASYNC_ICONS_CSS}\n`,
  );
  /*
   * site-theme.css loads async via the preload swap.
   *
   * It carries the @font-face rules for the self-hosted brand fonts, the icon
   * glyph box reservations that keep the async icons.css from re-flowing the
   * nav and hero rows, and the component skins the first paint depends on. An earlier pass kept it render-blocking on the
   * grounds that a deferred stylesheet is fragile if the onload handler never
   * fires, but the inline #aaa-critical-palette block above already paints
   * the brand palette the moment the HTML is parsed, so a deferred
   * site-theme.css no longer trades a white screen for a layout shift -- the
   * first frame is the right colours, and site-theme.css refines once it lands.
   * The <noscript> twin keeps the stylesheet available without JavaScript, so
   * a cached response or a content blocker that drops the onload handler does
   * not leave the page unstyled. The file is served immutable for a year, so
   * the preload costs one round trip on a first visit and nothing after that.
   *
   * This is idempotent and stamp-agnostic: any prior form (a plain render-
   * blocking link, an async preload swap, or its <noscript> twin) is
   * normalised to a single current async preload pair.
   */
  const ASYNC_SITE_THEME_CSS =
    `    <link rel="preload" href="${SITE_THEME_CSS}" as="style" onload="this.onload=null;this.rel='stylesheet'">\n` +
    `    <noscript><link rel="stylesheet" href="${SITE_THEME_CSS}"></noscript>`;
  html = html.replace(
    /(?<!<noscript>)[ \t]*<link\s+rel=["']?(?:stylesheet|preload)["']?\s+href=["']?\/css\/site-theme\.css(?:\?v=[^"'>]*)?["']?[^>]*>\r?\n?(?:[ \t]*<noscript><link\s+rel=["']?stylesheet["']?\s+href=["']?\/css\/site-theme\.css(?:\?v=[^"'>]*)?["']?[^>]*><\/noscript>\r?\n?)?/gi,
    `${ASYNC_SITE_THEME_CSS}\n`,
  );

  /*
   * Tailwind is render-blocking, deliberately.
   *
   * It used to be loaded with the `rel="preload" ... onload="this.rel='style-
   * sheet'"` trick behind a six-rule inline "critical" block. That wins the
   * render-blocking-resources diagnostic, which is worth nothing, and loses
   * Cumulative Layout Shift, which is worth a quarter of the performance
   * score.
   *
   * Every above-the-fold element on this site is laid out by Tailwind
   * utilities -- `sticky top-0 z-50` on the nav bar, `flex justify-between
   * items-center` on its inner row, `h-10 w-10` on the logo, and `hidden
   * lg:flex` on both the desktop link row and the mobile drawer. Painting
   * before that stylesheet arrives does not paint an approximation of the
   * page, it paints a single unstyled column with the drawer and the desktop
   * nav stacked on top of each other, because `hidden` does not exist yet.
   * Tailwind then lands and every element on the page moves.
   *
   * The stylesheet is 11kB over the wire (64kB minified, but Brotli likes
   * utility CSS) and is pinned in cache for a year, so blocking on it costs
   * one round trip on a first visit and nothing after that. That is a far
   * cheaper way to buy a correct first paint than a hand-maintained critical
   * block could ever be.
   *
   * All three rewrites below are stamp-agnostic and idempotent, so a cache
   * bust cannot silently switch them off.
   */
  const TAILWIND_CSS = `/css/tailwind.css?v=${ASSET_VERSION}`;

  // The old async pattern, plus the <noscript> twin that would otherwise
  // become a second copy of the stylesheet.
  html = html.replace(
    /[ \t]*<link\s+rel=["']?preload["']?\s+href=["']?\/css\/tailwind\.css(?:\?v=[^\s">]*)?["']?\s+as=["']?style["']?[^>]*>\r?\n?(?:[ \t]*<noscript><link\s+rel=["']?stylesheet["']?\s+href=["']?\/css\/tailwind\.css(?:\?v=[^\s">]*)?["']?><\/noscript>\r?\n?)?/gi,
    `    <link rel="stylesheet" href="${TAILWIND_CSS}">\n`,
  );

  /*
   * The inline critical block is dead weight now: every rule in it is restated
   * by Tailwind's preflight and by the `@layer base` rules in
   * scripts/tailwind-input.css, both of which sit later in the cascade and
   * already won. Its `html { font-family: "Roboto" }` in particular has never
   * applied -- preflight's own `html { font-family: ui-sans-serif ... }` comes
   * after it, and the Roboto that visitors actually see comes from the `body`
   * rule in tailwind-input.css.
   */
  html = html.replace(/[ \t]*<style id="critical-above-the-fold">[\s\S]*?<\/style>\r?\n?/gi, '');

  // Keep the stamp current on whichever link survived the two passes above.
  html = html.replace(
    /<link\s+rel=["']?stylesheet["']?\s+href=["']?\/css\/tailwind\.css(?:\?v=[^\s">]*)?["']?>/gi,
    `<link rel="stylesheet" href="${TAILWIND_CSS}">`,
  );

  html = html.replace(/src="\/js\/([^"?]+\.js)(?:\?v=[^"]*)?"/gi, (match, fileName) => {
    const version = SCRIPT_VERSIONS.get(fileName);
    return version ? `src="/js/${fileName}?v=${version}"` : match;
  });

  /*
   * Fold the per-page inline scripts into the one deferred module.
   *
   * Every page used to carry three inline blocks: a service-worker
   * registration and a gtag.js bootstrap at the end of <body>, plus the promo
   * bar's dismiss handler nested inside its <aside>. Together that is ~2.4kB
   * of JavaScript parsed on the main thread during HTML parsing, repeated in
   * every one of the 90 documents and re-downloaded on every navigation
   * because HTML is served network-first. scripts/js/page-boot.js is the same three behaviours in one
   * `defer` script that is cached immutable for a year, so it parses after the
   * document instead of interrupting it and is fetched once per visitor rather
   * than once per page view. The gtag bootstrap keeps its interaction/idle gate
   * (see scripts/js/page-boot.js) -- deferring the block does not start loading
   * googletagmanager.com any earlier.
   *
   * The strips are anchored on markers unique to each block and stop at the
   * first `</script>`, so no neighbouring inline script can be swallowed. The
   * banner's prepaint hide guard is deliberately not matched: it has to run
   * during parsing or a dismissed banner flashes before the deferred module
   * gets a chance to hide it.
   */
  const INLINE_BLOCK = (marker) =>
    new RegExp(`[ \\t]*<script>(?:(?!<\\/script>)[\\s\\S])*?${marker}(?:(?!<\\/script>)[\\s\\S])*?<\\/script>\\r?\\n?`, 'gi');

  html = html.replace(INLINE_BLOCK('navigator\\.serviceWorker\\.register'), '');
  html = html.replace(INLINE_BLOCK('G-VRMCPNEQC3'), '');
  html = html.replace(INLINE_BLOCK("is-dismissing"), '');

  /*
   * The promo bar's styles moved out of the banner markup and into
   * scripts/tailwind-input.css, which ships in the render-blocking
   * tailwind.css. The inline copy was 1.5kB repeated in 88 documents for rules
   * the browser already had by the time it reached the banner. Matching only
   * attribute-free <style> tags keeps the #aaa-critical-palette block above
   * out of range.
   */
  html = html.replace(
    /[ \t]*<style>(?:(?!<\/style>)[\s\S])*?\.new-customer-banner\{(?:(?!<\/style>)[\s\S])*?<\/style>\r?\n?/gi,
    '',
  );

  // One tag, inserted ahead of site.js and only when the page does not already
  // carry it, so repeat builds never stack a second copy. offline.html has no
  // site.js and gets nothing -- it is a cache fallback, not a tracked page.
  if (!/src=["']?\/js\/page-boot\.js/i.test(html)) {
    html = html.replace(
      /([ \t]*)<script\s+src=["']?\/js\/site\.js(?:\?v=[^"'\s>]*)?["']?(\s+defer)?><\/script>/i,
      `$1<script src="/js/page-boot.js?v=${ASSET_VERSION}" defer></script>\n$&`,
    );
  }

  return html;
}

// 1. Update Navigation on key static pages
for (const { path, active, removeSectionNav, promoBanner = true, promoCtaHref } of STATIC_NAV_PAGES) {
  const fullPath = join(ROOT, path);
  let content = readFileSync(fullPath, 'utf8');

  // The top bar is matched as a single unit: the skip link (which getUnifiedNav
  // also emits, so leaving it unmatched would duplicate it on every run), the
  // bar itself, and any orphaned drawer tail. That tail -- stray `pt-2`/`pt-3`
  // <div>s plus an unbalanced `</div></nav>` left behind by an earlier revision
  // of the drawer -- is not inert: the parser closes the <nav> at the first
  // `</nav>`, so those <div>s become body-level siblings and render as loose
  // buttons and icons between the bar and the page content.
  const ORPHAN_DRAWER_TAIL =
    '(?:(?:\\s*<div class="pt-[23] border-t border-gray-100(?:[^<]|<(?!\\/div>))*<\\/div>)+\\s*<\\/div>\\s*<\\/nav>)?';
  // getUnifiedNav emits the new-customer promo bar above the header and used to
  // emit a seasonal offer bar below it. Both have to be part of the match for
  // the same reason the skip link is: replacing only the <header> would leave a
  // previous build's banner in place and stack a second one beside it. The ids
  // may be quoted (`id="seasonal-banner"`) or unquoted (`id=seasonal-banner`)
  // depending on whether the source file has been through the minifier, so both
  // forms are matched, and one or more stale banners of either kind are consumed
  // so duplicates never accumulate across builds.
  const NEW_CUSTOMER_BANNER_HEAD = '(?:\\s*<aside[^>]*id=(?:"new-customer-banner"|new-customer-banner)[\\s\\S]*?<\\/aside>)*';
  const SEASONAL_BANNER_TAIL = '(?:\\s*<aside[^>]*id=(?:"seasonal-banner"|seasonal-banner)[\\s\\S]*?<\\/aside>)*';
  const mainNavRegex = new RegExp(
    // Optional leading whitespace + skip-link: getUnifiedNav emits its own
    // skip-link, so an existing one has to be consumed or every build
    // duplicates it.
    '\\s*(?:<a[^>]*class="[^"]*skip-link[^"]*"[^>]*>[\\s\\S]*?<\\/a>\\s*)?' +
      NEW_CUSTOMER_BANNER_HEAD +
      '\\s*' +
      '(?:<header[^>]*id="site-header"[\\s\\S]*?<\\/header>' +
      '|<header[^>]*class="[^"]*site-header[^"]*"[\\s\\S]*?<\\/header>' +
      '|<header[^>]*class="sticky top-0 z-50 bg-white[\\s\\S]*?<\\/header>' +
      '|<nav[^>]*id="site-nav"[\\s\\S]*?<\\/nav>' + ORPHAN_DRAWER_TAIL + ')' +
      SEASONAL_BANNER_TAIL
  );

  if (mainNavRegex.test(content)) {
    const [matched] = content.match(mainNavRegex);
    if (/<\/nav>[\s\S]*<\/nav>/.test(matched)) {
      console.log(`  Removed orphaned drawer markup after the nav in ${path}`);
    }
    const unifiedNavHtml = getUnifiedNav(active, { promoBanner, promoCtaHref });
    content = content.replace(mainNavRegex, unifiedNavHtml);
  } else {
    console.warn(`Main nav regex did not match in ${path}`);
  }

  if (removeSectionNav) {
    const sectionNavRegex = /\s*<nav\s+id="section-nav"[\s\S]*?<\/nav>/;
    content = content.replace(sectionNavRegex, '');
  }

  writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated navigation in ${path}`);
}

// 2. Optimize Font & Asset links across ALL HTML files in public/
function getAllHtmlFiles(dir) {
  let results = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllHtmlFiles(filePath));
    } else if (file.endsWith('.html')) {
      results.push(filePath);
    }
  }
  return results;
}

const allHtmlFiles = getAllHtmlFiles(join(ROOT, 'public'));
let optimizedCount = 0;

for (const filePath of allHtmlFiles) {
  let content = readFileSync(filePath, 'utf8');
  const updated = optimizeFontsAndAssets(content);
  if (updated !== content) {
    writeFileSync(filePath, updated, 'utf8');
    optimizedCount++;
  }
}

console.log(`Optimized font & asset loading in ${optimizedCount} HTML file(s).`);
