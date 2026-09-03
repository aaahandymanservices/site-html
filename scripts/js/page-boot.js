/*
 * Page boot: the three things every page needs that used to be pasted inline.
 *
 * Before this file existed, each of the 90 pages carried its own copy of the
 * service-worker registration, the Google Analytics bootstrap, and the promo
 * bar's dismiss handler as inline <script> blocks -- roughly 2.6kB of identical
 * JavaScript re-sent with every HTML response, on a document that is served
 * network-first and so is never cached for long. Here it is one file behind an
 * immutable ?v= stamp: fetched once, parsed once, and reused across the whole
 * site.
 *
 * Loaded with `defer`, so none of it competes with the first paint. What could
 * not move is still inline and still has to be: the reCAPTCHA createElement
 * shim (it has to run before Netlify's injected api.js tag) and the two
 * prepaint guards that hide the promo bar and the gift badge before the first
 * frame.
 */
(function () {
  // Activate deferred stylesheets after HTML parsing.
  //
  // Only icons.css ships this way now. tailwind.css and site-theme.css were
  // briefly deferred here too and are deliberately render-blocking again: they
  // carry the layout for everything below the hero, so flipping them on after
  // first paint repainted the entire document a moment after it rendered,
  // which showed up as a stale/half-styled frame between navigations. Icons are
  // decorative and their glyph boxes are reserved in the inline critical block,
  // so this swap cannot shift layout. See scripts/update-static-pages.mjs.
  var deferredStyles = document.querySelectorAll('link[data-deferred-style]');
  for (var styleIndex = 0; styleIndex < deferredStyles.length; styleIndex += 1) {
    deferredStyles[styleIndex].media = 'all';
  }

  // --- Service worker -----------------------------------------------------
  // Registered on `load` rather than immediately: the install fetches the
  // precache list, and doing that while the page is still laying itself out
  // competes with the resources the visitor is actually waiting for.
  //
  // `updateViaCache: 'none'` keeps the browser's HTTP cache out of the update
  // check for the worker script itself, so a new sw.js is always seen on the
  // next load. netlify.toml already serves /sw.js as `max-age=0,
  // must-revalidate`; this makes the guarantee independent of the header.
  //
  // Any *other* worker registered on this origin is then unregistered. A
  // service worker outlives the code that installed it, so a script left over
  // from an earlier setup under a different filename would keep control of
  // navigations indefinitely -- serving whatever its own cache held, from a
  // file no longer in this repository. Only registrations that are not the
  // current /sw.js are removed, so the site's own worker (offline page,
  // precache, installable app) is untouched.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .catch(function () {});

      if (!navigator.serviceWorker.getRegistrations) return;
      navigator.serviceWorker
        .getRegistrations()
        .then(function (registrations) {
          var currentUrl = new URL('/sw.js', window.location.origin).href;
          registrations.forEach(function (registration) {
            var worker = registration.active || registration.installing || registration.waiting;
            if (!worker || worker.scriptURL === currentUrl) return;
            registration.unregister().catch(function () {});
          });
        })
        .catch(function () {});
    });
  }

  // --- Google Analytics ---------------------------------------------------
  // gtag.js is ~90kB of third-party JavaScript and about a quarter second of
  // main-thread parse. None of it is needed to render the page, and a visitor
  // who bounces in the first few seconds was never going to be measured
  // usefully anyway, so the tag is queued now and the library is only fetched
  // once the visitor touches the page -- or, failing that, five seconds of
  // idle time after load, so a page left open still reports.
  var MEASUREMENT_ID = 'G-VRMCPNEQC3';

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID);

  var gtagInjected = false;

  function injectGtag() {
    if (gtagInjected) return;
    gtagInjected = true;
    window.__gtagLoaded = true;

    var script = document.createElement('script');
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
    script.async = true;
    document.head.appendChild(script);
  }

  function scheduleGtag() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(function () { setTimeout(injectGtag, 5000); }, { timeout: 10000 });
    } else {
      setTimeout(injectGtag, 6000);
    }
  }

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (event) {
    window.addEventListener(event, injectGtag, { once: true, passive: true });
  });

  if (document.readyState === 'complete') {
    scheduleGtag();
  } else {
    window.addEventListener('load', scheduleGtag, { once: true });
  }

  // --- New-customer promo bar ---------------------------------------------
  // The bar is hidden before the first paint by a tiny inline guard in the
  // markup (see scripts/unified-nav.mjs); this is only the dismissal, which
  // cannot happen until the visitor clicks and so has no reason to be inline.
  (function initPromoBanner() {
    var banner = document.getElementById('new-customer-banner');
    if (!banner) return;

    var cta = banner.querySelector('[data-ncb-cta]');
    if (!cta) return;

    var STORAGE_KEY = 'aaa-new-customer-banner';
    var prefersReduced = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function dismiss() {
      try {
        localStorage.setItem(STORAGE_KEY, 'dismissed');
      } catch (err) {
        // Private browsing refuses the write; the bar still closes for now.
      }

      if (prefersReduced) {
        banner.hidden = true;
        return;
      }

      // Collapse rather than snap out, so the page below settles instead of
      // jumping. The rendered height has to be pinned inline first: the
      // stylesheet's `height: 0` cannot animate away from `auto`.
      banner.style.height = banner.offsetHeight + 'px';
      banner.classList.add('is-dismissing');

      var finish = function () {
        window.clearTimeout(timer);
        banner.removeEventListener('transitionend', onTransitionEnd);
        banner.hidden = true;
        banner.classList.remove('is-dismissing');
        banner.style.height = '';
      };

      var onTransitionEnd = function (event) {
        if (event.target === banner && event.propertyName === 'height') finish();
      };

      banner.addEventListener('transitionend', onTransitionEnd);
      var timer = window.setTimeout(finish, 650);

      requestAnimationFrame(function () {
        banner.style.height = '0px';
      });
    }

    cta.addEventListener('click', function (event) {
      dismiss();

      // An in-page target scrolls; anything else is left to the browser.
      var href = cta.getAttribute('href') || '';
      if (href.indexOf('#') !== 0) return;

      var target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', href);
      }

      var field = target.querySelector('input:not([type=hidden]),select,textarea');
      if (field) {
        window.setTimeout(
          function () { field.focus({ preventScroll: true }); },
          prefersReduced ? 0 : 520
        );
      }
    });
  })();

})();
