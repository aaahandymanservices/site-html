/*
 * One-time gating for the $50 first-service gift certificate.
 *
 * The offer is advertised in four places -- the promo line on the home page,
 * the quote form, the contact form, and the booking form -- and each of them is
 * marked up with `data-gift-certificate`. Every visitor who has already spent
 * the certificate should stop seeing all four.
 *
 * There is no customer login on this site, so "who is this" comes from two
 * sources with different jobs:
 *
 *   Local storage (`aaa-first-service-gift`) is the fast path. It is read
 *   before paint by a small inline snippet in each page's <head> so the card
 *   never flashes into view, and it is what hides the home-page promo line,
 *   where no email has been typed yet.
 *
 *   /api/gift-certificate is the truth. Storage can be cleared and is per
 *   browser, so as soon as a real email address is available the server is
 *   asked about that specific address. A "yes" hides the card; a "no" brings it
 *   back, which is what lets a second person in the same household claim their
 *   own certificate on a shared computer.
 *
 * None of this is a security boundary -- it decides what to render. The claim
 * itself is gated server-side by a UNIQUE email in gift_certificate_redemptions
 * (see netlify/lib/gift-certificate.ts), so clearing storage or switching
 * browsers gets the card back but not a second certificate.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'aaa-first-service-gift';
  var STYLE_ID = 'gift-certificate-hidden';
  var BLOCK_SELECTOR = '[data-gift-certificate]';
  // The top-of-page promo bar carries the same offer as the gated callouts, so
  // it disappears for a redeemed visitor alongside them. It has its own
  // dismissal key (aaa-new-customer-banner) and its own prepaint guard, so we
  // only touch it once redemption is known here -- the CTA-click dismissal path
  // does not run through this script.
  var BANNER_ID = 'new-customer-banner';
  var ENDPOINT = '/api/gift-certificate';
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function normalize(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function isEmail(value) {
    return EMAIL_PATTERN.test(value);
  }

  function readState() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function writeState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* Private browsing or a full quota: the server check still applies. */
    }
  }

  function isRedeemed() {
    return readState().firstServiceGiftRedeemed === true;
  }

  // Addresses the server has confirmed as spent, so revisiting a page with the
  // same address in it doesn't re-ask. Only "yes" is cached: it is permanent,
  // whereas a "no" can turn into a "yes" at any time (a claim from another
  // device, or one the owner records by hand), and a stale "no" is the answer
  // that would wrongly put the offer back on screen.
  function cachedFor(email) {
    var known = readState().emails;
    return Boolean(known && typeof known === 'object' && known[email] === true);
  }

  function remember(email, redeemed, redeemedAt) {
    if (!redeemed) return;
    var state = readState();
    var known = state.emails && typeof state.emails === 'object' ? state.emails : {};
    if (email) known[email] = true;
    state.emails = known;
    state.firstServiceGiftRedeemed = true;
    // Do not persist cleartext personal/timestamp fields in localStorage.
    // They are not required for render gating logic.
    delete state.email;
    delete state.redeemedAt;
    writeState(state);
  }

  function blocks() {
    return Array.prototype.slice.call(document.querySelectorAll(BLOCK_SELECTOR));
  }

  function dropPrepaintStyle() {
    var style = document.getElementById(STYLE_ID);
    if (style && style.parentNode) style.parentNode.removeChild(style);
  }

  function hide() {
    blocks().forEach(function (block) {
      // Both, deliberately: `hidden` carries the meaning, and the inline display
      // is what actually wins -- Tailwind's `[hidden]` reset and its `.flex`
      // utility have equal specificity, and the utility is declared later, so
      // the promo block would stay visible on the strength of its own classes.
      block.hidden = true;
      block.style.display = 'none';
      // A checkbox that is merely out of sight still posts with the form, so
      // clear it and disable it as well.
      Array.prototype.forEach.call(block.querySelectorAll('input, button, select'), function (field) {
        if (field.type === 'checkbox' || field.type === 'radio') field.checked = false;
        field.disabled = true;
      });
    });
  }

  function show() {
    dropPrepaintStyle();
    blocks().forEach(function (block) {
      block.hidden = false;
      block.style.display = '';
      Array.prototype.forEach.call(block.querySelectorAll('input, button, select'), function (field) {
        field.disabled = false;
      });
    });
  }

  function hideBanner() {
    var banner = document.getElementById(BANNER_ID);
    if (banner) banner.hidden = true;
  }

  function showBanner() {
    var banner = document.getElementById(BANNER_ID);
    if (!banner) return;
    // Respect the banner's own dismissal: a visitor who clicked the CTA set
    // aaa-new-customer-banner=dismissed, and re-showing it here (when the email
    // check comes back "not redeemed") would override that choice. Redemption
    // state is ours to manage; the CTA dismissal is not.
    var dismissed = false;
    try {
      dismissed = localStorage.getItem('aaa-new-customer-banner') === 'dismissed';
    } catch (err) {
      dismissed = false;
    }
    if (!isRedeemed() && !dismissed) banner.hidden = false;
  }

  function apply(redeemed) {
    if (redeemed) {
      hide();
      hideBanner();
    } else {
      show();
      // Do not force the bar back on if the visitor dismissed it themselves;
      // the banner's own prepaint guard already hid it, and re-showing would
      // override that dismissal. Only the redemption state is ours to manage.
      showBanner();
    }
  }

  function fetchStatus(email) {
    return fetch(ENDPOINT + '?email=' + encodeURIComponent(email), {
      headers: { Accept: 'application/json' }
    })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .catch(function () {
        return null;
      });
  }

  /**
   * Resolves the offer against one email address and updates the page. Returns
   * a promise for the boolean, or for null when the address is unusable or the
   * lookup failed -- in which case whatever local storage decided stands.
   */
  function check(value) {
    var email = normalize(value);
    if (!isEmail(email)) return Promise.resolve(null);

    if (cachedFor(email)) {
      hide();
      return Promise.resolve(true);
    }

    return fetchStatus(email).then(function (status) {
      if (!status) return null;
      var redeemed = status.firstServiceGiftRedeemed === true;
      remember(email, redeemed, status.redeemedAt);
      apply(redeemed);
      return redeemed;
    });
  }

  /**
   * Records that this visitor has now spent their certificate: hides it here
   * and, unless the server already confirmed it as part of the submission that
   * triggered this call, persists it against their email address.
   *
   * options: { name, source, redeemedAt, serverConfirmed }
   */
  function markRedeemed(value, options) {
    var opts = options || {};
    var email = normalize(value);
    if (!isEmail(email)) return Promise.resolve(false);

    if (opts.serverConfirmed) {
      remember(email, true, opts.redeemedAt);
      hide();
      return Promise.resolve(true);
    }

    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        name: opts.name || '',
        source: opts.source || 'manual'
      })
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Unable to record gift certificate redemption.');
        remember(email, true, opts.redeemedAt);
        hide();
        return true;
      })
      .catch(function () {
        // Keep the offer available so a later submission can retry the write.
        return false;
      });
  }

  function watchEmailFields() {
    var forms = [];
    blocks().forEach(function (block) {
      var form = block.closest && block.closest('form');
      if (form && forms.indexOf(form) === -1) forms.push(form);
    });

    forms.forEach(function (form) {
      var field = form.querySelector('input[type="email"], input[name="email"]');
      if (!field) return;

      var lastChecked = '';
      var timer = null;

      var run = function () {
        var email = normalize(field.value);
        if (email === lastChecked || !isEmail(email)) return;
        lastChecked = email;
        check(email);
      };

      field.addEventListener('change', run);
      field.addEventListener('blur', run);
      // Catches browser autofill, which fires neither change nor blur reliably.
      field.addEventListener('input', function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(run, 600);
      });

      if (field.value) run();
    });
  }

  if (isRedeemed()) {
    hide();
    hideBanner();
  }
  watchEmailFields();

  window.AAAGiftCertificate = {
    isRedeemed: isRedeemed,
    check: check,
    markRedeemed: markRedeemed,
    hide: hide,
    show: show
  };
})();
