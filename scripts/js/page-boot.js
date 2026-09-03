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
  // --- Service worker -----------------------------------------------------
  // Registered on `load` rather than immediately: the install fetches the
  // precache list, and doing that while the page is still laying itself out
  // competes with the resources the visitor is actually waiting for.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
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

  // --- Google Calendar booking CTAs ----------------------------------------
  // Every booking CTA on the site is a plain link to /book. Bookings now run
  // through Google Calendar Appointment Scheduling, so each of those links is
  // wrapped and converted in place into a Google "Book an appointment"
  // scheduling button: the styled, accessible button Google's script renders
  // keeps the surrounding button skin (the anchor stays in the DOM inside a
  // wrapper, hidden by the stylesheet), and the iframe flow opens in a Google
  // hosted window. The scheduler assets are injected once, on first use, and
  // a single load() call drains the whole queue so every CTA on the page is
  // bound together.
  (function initGoogleSchedulingButtons() {
    var SCHEDULE_URL = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ2PQiyPqkFAPQnWdMC3jwuicLPQKJyDsd9dhHzU_bz3uMipGzpQiEE_lT-KIQd29P_yfAwSg4ac?gv=true';
    var BUTTON_COLOR = '#b91c1c';
    var CSS_ID = 'aaa-gcal-scheduling-css';
    var SCRIPT_ID = 'aaa-gcal-scheduling-script';
    var FONT_SWAP_ID = 'aaa-gcal-font-swap';
    var pendingTargets = [];

    // Footer booking links are plain text links, not CTAs. The data attribute
    // below is how they opt out of the scheduling-button conversion so they
    // keep rendering as an ordinary underlined-on-hover link alongside the
    // other footer links.
    function isPlainBookingLink(link) {
      return link.hasAttribute('data-plain-booking-link');
    }

    function flushPending() {
      var calendar = window.calendar;
      if (!calendar || !calendar.schedulingButton) return;
      while (pendingTargets.length) {
        calendar.schedulingButton.load({
          url: SCHEDULE_URL,
          color: BUTTON_COLOR,
          label: 'Book an appointment',
          target: pendingTargets.shift(),
        });
      }
    }

    function requestScheduler(target) {
      pendingTargets.push(target);

      if (!document.getElementById(CSS_ID)) {
        var css = document.createElement('link');
        css.id = CSS_ID;
        css.rel = 'stylesheet';
        css.href = 'https://calendar.google.com/calendar/scheduling-button-script.css';
        document.head.appendChild(css);
      }

      // The scheduler's stylesheet pulls Google Sans and Material Icons from
      // fonts.googleapis.com. Without &display=swap the returned @font-face
      // rules carry no font-display, so browsers hold the button's label
      // invisible (font-display: block behaviour) while those faces load --
      // exactly what Lighthouse's font-display audit flags. Appending the
      // query rewrites those requests so every face swaps instead. Idempotent:
      // a copy carrying the parameter short-circuits the guard below.
      if (!document.getElementById(FONT_SWAP_ID)) {
        var swap = document.createElement('link');
        swap.id = FONT_SWAP_ID;
        swap.rel = 'stylesheet';
        swap.href = 'https://fonts.googleapis.com/css?family=Google+Sans:400,500|Material+Icons&display=swap';
        document.head.appendChild(swap);
      }

      var script = document.getElementById(SCRIPT_ID);
      if (!script) {
        script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = 'https://calendar.google.com/calendar/scheduling-button-script.js';
        script.async = true;
        script.onload = flushPending;
        document.head.appendChild(script);
      } else if (script.onload === null) {
        // The library is already cached and executed; load() again directly.
        flushPending();
      } else {
        flushPending();
      }
    }

    var bookingLinks = document.querySelectorAll('a[href^="/book"]');
    for (var i = 0; i < bookingLinks.length; i += 1) {
      var link = bookingLinks[i];
      if (isPlainBookingLink(link)) continue;
      var wrapper = document.createElement('span');
      wrapper.className = 'gcal-cta';
      link.replaceWith(wrapper);
      wrapper.appendChild(link);
      requestScheduler(wrapper);
    }


    // Booking CTAs are also rendered after load by the zone lookup and the
    // quote calculator, so the same conversion runs for nodes added later.
    var linkObserver = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m += 1) {
        var added = mutations[m].addedNodes;
        for (var n = 0; n < added.length; n += 1) {
          var node = added[n];
          if (node.nodeType !== 1) continue;
          var candidates = [];
          if (node.matches && node.matches('a[href^="/book"]')) candidates.push(node);
          if (node.querySelectorAll) {
            var found = node.querySelectorAll('a[href^="/book"]');
            for (var f = 0; f < found.length; f += 1) candidates.push(found[f]);
          }
          for (var c = 0; c < candidates.length; c += 1) {
            var dynLink = candidates[c];
            if (isPlainBookingLink(dynLink)) continue;
            if (dynLink.parentElement && dynLink.parentElement.closest('.gcal-cta')) continue;
            var dynWrap = document.createElement('span');
            dynWrap.className = 'gcal-cta';
            dynLink.replaceWith(dynWrap);
            dynWrap.appendChild(dynLink);
            requestScheduler(dynWrap);
          }
        }
      }
    });
    linkObserver.observe(document.body, { childList: true, subtree: true });

    var explicitTarget = document.getElementById('gcal-scheduling-button');
    if (explicitTarget) requestScheduler(explicitTarget);
  })();
})();
