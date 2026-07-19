/*
 * Simple captcha widget for every form on the site (booking, reviews, contact,
 * careers). No third-party keys and no external scripts — it renders a small
 * arithmetic question fetched from /api/captcha into every [data-captcha]
 * container and hands the token + typed answer back to the page for submission.
 *
 * Exposes window.SiteCaptcha:
 *   isEnabled()        -> always true (the simple captcha needs no configuration)
 *   getResponse(form)  -> { token, answer } from the widget inside `form`
 *   reset(form)        -> loads a fresh question into the widget inside `form`
 *   verify(form)       -> Promise<boolean> server-checks the current answer
 *                         (used by the Netlify Forms pages as a pre-submit gate)
 */
(function () {
  var widgets = new WeakMap();

  function findContainer(form) {
    return form ? form.querySelector("[data-captcha]") : null;
  }

  function fetchChallenge() {
    return fetch("/api/captcha", { headers: { accept: "application/json" } })
      .then(function (res) { return res.json(); });
  }

  function render(el) {
    el.classList.remove("hidden");
    el.innerHTML =
      '<div style="width:100%;max-width:340px;background:#0f172a;border:1px solid #334155;' +
      'border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;">' +
        '<div style="flex:1 1 auto;">' +
          '<label style="display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;' +
          'color:#94a3b8;font-weight:700;margin-bottom:6px;">Spam check</label>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span data-captcha-question style="color:#e2e8f0;font-weight:600;font-size:15px;min-width:96px;">Loading…</span>' +
            '<input data-captcha-answer type="text" inputmode="numeric" autocomplete="off" ' +
            'aria-label="Answer the spam-check question" placeholder="?" ' +
            'style="width:72px;padding:8px 10px;border-radius:10px;border:2px solid #334155;' +
            'background:#1e293b;color:#fff;font-size:15px;text-align:center;outline:none;">' +
          '</div>' +
        '</div>' +
        '<button data-captcha-refresh type="button" aria-label="Get a new question" ' +
        'style="flex:0 0 auto;background:#1e293b;border:1px solid #334155;color:#94a3b8;' +
        'width:38px;height:38px;border-radius:10px;cursor:pointer;font-size:15px;">↻</button>' +
      '</div>' +
      '<input data-captcha-token type="hidden">';

    var refresh = el.querySelector("[data-captcha-refresh]");
    if (refresh) {
      refresh.addEventListener("click", function () { load(el); });
    }
    load(el);
  }

  function load(el) {
    var question = el.querySelector("[data-captcha-question]");
    var answer = el.querySelector("[data-captcha-answer]");
    var token = el.querySelector("[data-captcha-token]");
    if (question) question.textContent = "Loading…";
    if (answer) answer.value = "";
    if (token) token.value = "";

    return fetchChallenge()
      .then(function (cfg) {
        if (!cfg || !cfg.question || !cfg.token) throw new Error("no challenge");
        if (question) question.textContent = cfg.question;
        if (token) token.value = cfg.token;
      })
      .catch(function () {
        if (question) question.textContent = "Spam check unavailable";
      });
  }

  function getResponse(form) {
    var el = findContainer(form);
    if (!el) return { token: "", answer: "" };
    var token = el.querySelector("[data-captcha-token]");
    var answer = el.querySelector("[data-captcha-answer]");
    return {
      token: token ? token.value : "",
      answer: answer ? String(answer.value || "").trim() : "",
    };
  }

  function init() {
    var holders = document.querySelectorAll("[data-captcha]");
    for (var i = 0; i < holders.length; i++) {
      var el = holders[i];
      if (widgets.has(el)) continue;
      widgets.set(el, true);
      render(el);
    }
  }

  window.SiteCaptcha = {
    isEnabled: function () { return true; },
    getResponse: getResponse,
    reset: function (form) {
      var el = findContainer(form);
      if (el) load(el);
    },
    verify: function (form) {
      var res = getResponse(form);
      if (!res.answer) return Promise.resolve(false);
      return fetch("/api/captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: res.token, answer: res.answer }),
      })
        .then(function (r) { return r.ok; })
        .catch(function () { return false; });
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
