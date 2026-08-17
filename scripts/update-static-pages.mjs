import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getUnifiedNav } from './unified-nav.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const STATIC_NAV_PAGES = [
  { path: 'public/index.html', active: 'none' },
  { path: 'public/services.html', active: 'services' },
  { path: 'public/service-areas.html', active: 'service-areas' },
  { path: 'public/rates.html', active: 'rates', removeSectionNav: false },
  { path: 'public/guarantee.html', active: 'guarantee' },
  { path: 'public/reviews.html', active: 'reviews' },
  { path: 'public/careers.html', active: 'careers' },
  { path: 'public/contact.html', active: 'contact' },
  { path: 'public/ai-estimate.html', active: 'ai-estimate' },
  { path: 'public/customer-care.html', active: 'none' },
  { path: 'public/pricing-policy.html', active: 'none' },
  { path: 'public/book.html', active: 'none' },
  { path: 'public/privacy.html', active: 'none' },
  { path: 'public/terms.html', active: 'none' },
  { path: 'public/services/aging-in-place-guide.html', active: 'services' }
];

/**
 * Normalise asset loading: fonts and icons are self-hosted now, so strip any
 * page that still reaches out to fonts.googleapis.com or cdnjs and point it at
 * the local subset instead. See scripts/site-theme.css for the @font-face
 * rules and scripts/build-icon-css.mjs for the icon stylesheet.
 */
const ICONS_CSS = '/css/icons.css?v=20260815a';
/*
 * Bump this whenever the theme stylesheet or a versioned script changes.
 * netlify.toml serves /css/* and /js/* as `immutable, max-age=31536000`, so the
 * stamp in the URL is the only thing that can retire a cached copy: a
 * stylesheet fix shipped without a bump reaches new visitors and no one else,
 * which is how the previous pass at the dark form fields appeared to land and
 * then not to.
 *
 * Note that this stamp alone is not enough for a returning visitor: the service
 * worker keys assets by pathname with ?v= removed, so public/sw.js has its own
 * CACHE_VERSION that has to move with a stylesheet change as well.
 */
const ASSET_VERSION = '20260817a';
const SITE_THEME_CSS = `/css/site-theme.css?v=${ASSET_VERSION}`;
const SCRIPT_VERSIONS = new Map([
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

  // Font Awesome from cdnjs -> generated local subset.
  html = html.replace(/[ \t]*<!-- FontAwesome icons -->\r?\n/gi, '');
  html = html.replace(
    /[ \t]*<link\s+rel="stylesheet"\s+href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^"]*"[^>]*>\r?\n/gi,
    `    <link rel="stylesheet" href="${ICONS_CSS}">\n`,
  );
  html = html.replace(/[ \t]*<link\s+rel="preload"\s+href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^"]*"[^>]*>\r?\n/gi, '');
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
   * Inline critical palette block.
   *
   * Tailwind and site-theme.css are render-blocking on purpose (see the note
   * above), and together they are ~170kB minified. On a slow mobile connection
   * that is several seconds of dead-white first paint, which reads as a broken
   * page -- especially on /book, whose hero is a dark navy section. The fix is
   * not to defer the stylesheets (that trades the white screen for a layout
   * shift the comments above already paid to remove) but to inline a tiny
   * block that paints the brand palette the moment the HTML is parsed: the
   * body's pale grey, the sticky header's white with its crimson hairline, the
   * seasonal banner's warm gradient, and the booking hero's navy gradient with
   * white text. Tailwind then lands and refines, but the first frame is already
   * the right colours instead of white-on-white.
   *
   * The rules use the same literal hex values the source stylesheets declare,
   * kept low-specificity so Tailwind's utilities and site-theme's rules win
   * cleanly once they arrive. `id` selectors are used only because the page's
   * own markup already carries them. This is idempotent: any prior
   * #aaa-critical-palette block is stripped first so re-runs never stack.
   */
  const CRITICAL_PALETTE =
    '    <style id="aaa-critical-palette">' +
    'body{background:#f9fafb;color:#111827;margin:0}' +
    '#site-header{background:#fff;border-bottom:3px solid #a61f2e;box-shadow:0 6px 22px rgba(27,42,74,.08)}' +
    '#seasonal-banner{background:linear-gradient(100deg,#fff8ef,#fdeedd 48%,#fff6ec);border-bottom:1px solid rgba(27,42,74,.1)}' +
    '#booking-section.ambient-glow-hero{background-color:#1b2a4a;background-image:linear-gradient(to right,#101b31 0%,#1b2a4a 50%,#020617 100%);color:#fff}' +
    '#booking-section.ambient-glow-hero h1{color:#fff}' +
    '</style>';
  html = html.replace(/[ \t]*<style id="aaa-critical-palette">[\s\S]*?<\/style>\r?\n?/gi, '');
  html = html.replace(
    /(<link\s+rel=["']?preload["']?\s+href=["']?\/fonts\/roboto-latin\.woff2["']?\s+as=font[^>]*>\r?\n)/i,
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
      /(href=["']?\/fonts\/roboto-latin\.woff2["']?\s+as=font[^>]*>\r?\n)/i,
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
  html = html.replace(
    /href="\/css\/site-theme\.css(?:\?v=[^"]*)?"/gi,
    `href="${SITE_THEME_CSS}"`,
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
    /[ \t]*<link\s+rel="preload"\s+href="\/css\/tailwind\.css(?:\?v=[^"]*)?"\s+as="style"[^>]*>\r?\n?(?:[ \t]*<noscript><link\s+rel="stylesheet"\s+href="\/css\/tailwind\.css(?:\?v=[^"]*)?"><\/noscript>\r?\n?)?/gi,
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
    /<link\s+rel="stylesheet"\s+href="\/css\/tailwind\.css(?:\?v=[^"]*)?">/gi,
    `<link rel="stylesheet" href="${TAILWIND_CSS}">`,
  );

  html = html.replace(/src="\/js\/([^"?]+\.js)(?:\?v=[^"]*)?"/gi, (match, fileName) => {
    const version = SCRIPT_VERSIONS.get(fileName);
    return version ? `src="/js/${fileName}?v=${version}"` : match;
  });

  // Defer GTM script until user interaction or 5s idle post-load
  const oldGtmPattern = /\(function\s*\(\)\s*\{\s*var\s+injected\s*=\s*false,\s*armed\s*=\s*false;[\s\S]*?\['pointerdown',\s*'keydown',\s*'scroll',\s*'touchstart'\][\s\S]*?\}\)\(\);/gi;
  const newGtmCode = `(function () {
        var injected = false;

        function inject() {
          if (injected) return;
          injected = true;
          window.__gtagLoaded = true;
          var s = document.createElement('script');
          s.src = 'https://www.googletagmanager.com/gtag/js?id=G-VRMCPNEQC3';
          s.async = true;
          document.head.appendChild(s);
        }

        function trigger() {
          if (document.readyState === 'complete') {
            if ('requestIdleCallback' in window) {
              requestIdleCallback(function () { setTimeout(inject, 5000); }, { timeout: 10000 });
            } else {
              setTimeout(inject, 6000);
            }
          } else {
            window.addEventListener('load', function () {
              if ('requestIdleCallback' in window) {
                requestIdleCallback(function () { setTimeout(inject, 5000); }, { timeout: 10000 });
              } else {
                setTimeout(inject, 6000);
              }
            }, { once: true });
          }
        }

        ['pointerdown', 'keydown', 'touchstart'].forEach(function (e) {
          window.addEventListener(e, inject, { once: true, passive: true });
        });

        trigger();
      })();`;

  html = html.replace(oldGtmPattern, newGtmCode);

  return html;
}

// 1. Update Navigation on key static pages
for (const { path, active, removeSectionNav } of STATIC_NAV_PAGES) {
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
  // getUnifiedNav also emits the seasonal offer bar that sits under the nav, so
  // an existing one has to be part of the match for the same reason the skip
  // link is: replacing only the <nav> would leave last build's bar in place and
  // stack a second one on top of it. The id may be quoted (`id="seasonal-banner"`)
  // or unquoted (`id=seasonal-banner`) depending on whether the source file has
  // been through the minifier, so both forms are matched, and one or more stale
  // banners are consumed so duplicates never accumulate across builds.
  const SEASONAL_BANNER_TAIL = '(?:\\s*<aside[^>]*id=(?:"seasonal-banner"|seasonal-banner)[\\s\\S]*?<\\/aside>)*';
  const mainNavRegex = new RegExp(
    '(?:<a[^>]*class="[^"]*skip-link[^"]*"[^>]*>[\\s\\S]*?<\\/a>\\s*)?' +
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
    const unifiedNavHtml = getUnifiedNav(active);
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
