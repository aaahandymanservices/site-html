/*
 * Runtime reCAPTCHA v2 loader for the custom-function forms (booking, reviews).
 *
 * On load it asks /api/captcha-config for the public site key. If a key is
 * configured it injects Google's reCAPTCHA script and renders a checkbox widget
 * into every [data-captcha] container on the page. If no key is configured (or
 * the config request fails) it stays dormant and the forms submit exactly as
 * before — so bookings are never blocked before the owner provisions keys.
 *
 * Exposes window.SiteCaptcha:
 *   isEnabled()      -> true once a widget has been rendered
 *   getToken(form)   -> the solved response token for the widget inside `form` ("" if none)
 *   reset(form)      -> clears the widget inside `form` (call after a failed submit)
 */
(function () {
  var state = { enabled: false, siteKey: "", ready: false };
  var widgets = new WeakMap();

  function findContainer(form) {
    return form ? form.querySelector("[data-captcha]") : null;
  }

  function renderAll() {
    state.ready = true;
    var holders = document.querySelectorAll("[data-captcha]");
    for (var i = 0; i < holders.length; i++) {
      var el = holders[i];
      if (widgets.has(el)) continue;
      try {
        var id = window.grecaptcha.render(el, { sitekey: state.siteKey });
        widgets.set(el, id);
        el.classList.remove("hidden");
      } catch (err) {
        /* already rendered or not ready — ignore */
      }
    }
  }

  function loadWidget() {
    // Called by Google's script once the API is ready.
    window.__siteCaptchaOnload = renderAll;
    var s = document.createElement("script");
    s.src = "https://www.google.com/recaptcha/api.js?onload=__siteCaptchaOnload&render=explicit";
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  function init() {
    if (!document.querySelector("[data-captcha]")) return;

    fetch("/api/captcha-config")
      .then(function (res) { return res.json(); })
      .then(function (cfg) {
        if (!cfg || !cfg.enabled || !cfg.siteKey) return; // not provisioned — stay dormant
        state.enabled = true;
        state.siteKey = cfg.siteKey;
        loadWidget();
      })
      .catch(function () { /* config unreachable — leave forms captcha-free */ });
  }

  window.SiteCaptcha = {
    isEnabled: function () { return state.enabled && state.ready; },
    getToken: function (form) {
      if (!state.enabled || !state.ready) return "";
      var el = findContainer(form);
      if (!el || !widgets.has(el)) return "";
      return window.grecaptcha.getResponse(widgets.get(el)) || "";
    },
    reset: function (form) {
      if (!state.enabled || !state.ready) return;
      var el = findContainer(form);
      if (!el || !widgets.has(el)) return;
      window.grecaptcha.reset(widgets.get(el));
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
