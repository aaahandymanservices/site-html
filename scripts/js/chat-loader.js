(function () {
  "use strict";

  if (window.__aaaChatLoaderReady || window.__aaaChatWidgetLoaded) return;

  var path = location.pathname.replace(/\.html$/, "").replace(/\/+$/, "");
  if (path === "/contact") return;

  window.__aaaChatLoaderReady = true;

  /*
   * chat-widget.js is requested from inside loadChat() rather than from a
   * <script> tag, so its ?v= stamp is invisible to the rewrite in
   * scripts/update-static-pages.mjs that keeps every other script's stamp
   * current. It used to be hardcoded here, which meant the widget could keep
   * being served from a year-long immutable cache entry after the loader that
   * asks for it had already been retired.
   *
   * Reading the stamp off this file's own URL keeps the pair in step for free:
   * both files move with ASSET_VERSION, so whatever stamp got us here is the
   * one the widget should be asked for. currentScript is read at top level,
   * while it still refers to this script -- by the time loadChat() runs on a
   * click it would be null. A copy served by the service worker under its
   * unversioned precache name yields an empty stamp, which is exactly the key
   * the worker stores the widget under too.
   */
  var ownSrc = (document.currentScript && document.currentScript.src) || "";
  var queryIndex = ownSrc.indexOf("?");
  var assetStamp = queryIndex === -1 ? "" : ownSrc.slice(queryIndex);

  function initChatFab() {
    if (document.getElementById("aaa-chat-loader")) return;

    var style = document.createElement("style");
    style.id = "aaa-chat-loader-style";
    style.textContent = [
      ".aaa-fab{position:fixed;bottom:20px;right:20px;z-index:40;display:flex;flex-direction:column;gap:12px;align-items:flex-end}",
      ".aaa-fab .aaa-fab-btn{min-width:130px;height:56px;padding:0 22px;border-radius:9999px;border:2px solid #ffffff;display:flex;align-items:center;justify-content:flex-start;gap:10px;box-sizing:border-box;font:700 15px/1 'Roboto','Archivo',system-ui,-apple-system,sans-serif;white-space:nowrap;color:#ffffff;cursor:pointer;text-decoration:none;box-shadow:0 10px 25px -5px rgba(15,23,42,0.25);transition:transform .18s cubic-bezier(.16,1,.3,1),background .18s ease,box-shadow .18s ease;will-change:transform}",
      ".aaa-fab .aaa-fab-btn i{font-size:19px;line-height:1;flex-shrink:0}",
      ".aaa-fab .aaa-fab-btn:hover{transform:translateY(-2px) scale(1.03)}",
      ".aaa-fab .aaa-fab-btn:focus-visible{outline:3px solid #9fb1ca;outline-offset:2px}",
      ".aaa-chat-launch{background:#A61F2E;box-shadow:0 10px 25px -5px rgba(166,31,46,0.35)}",
      ".aaa-chat-launch:hover{background:#781925;box-shadow:0 14px 28px -4px rgba(166,31,46,0.45)}",
      ".aaa-chat-launch[aria-busy='true']{cursor:progress;opacity:.8}",
      "@media(max-width:767px){.aaa-fab{right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));gap:12px}.aaa-fab .aaa-fab-btn{min-width:0;width:54px;height:54px;padding:0;border-radius:50%;gap:0;flex:0 0 54px;justify-content:center;align-items:center}.aaa-fab .aaa-fab-btn i{font-size:21px;line-height:1}.aaa-fab .aaa-fab-label{display:none!important}}"
    ].join("");
    document.head.appendChild(style);

    var group = document.createElement("div");
    group.id = "aaa-chat-loader";
    group.className = "aaa-fab";

    var launch = document.createElement("button");
    launch.type = "button";
    launch.className = "aaa-fab-btn aaa-chat-launch";
    launch.setAttribute("aria-label", "Open chat with AAA Handyman Services LLC");
    launch.innerHTML = '<i class="fas fa-comments" aria-hidden="true"></i><span class="aaa-fab-label">AI Chat</span>';

    group.appendChild(launch);
    document.body.appendChild(group);

    launch.addEventListener("click", openChat);
  }

  var loadPromise;
  function loadChat() {
    if (window.__aaaChatWidgetLoaded && window.__aaaOpenChat !== openChat) {
      return Promise.resolve();
    }
    if (loadPromise) return loadPromise;

    var launch = document.querySelector(".aaa-chat-launch");
    if (launch) {
      launch.disabled = true;
      launch.setAttribute("aria-busy", "true");
    }

    loadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "/js/chat-widget.js" + assetStamp;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    }).then(function () {
      var group = document.getElementById("aaa-chat-loader");
      var style = document.getElementById("aaa-chat-loader-style");
      if (group) group.remove();
      if (style) style.remove();
    }).catch(function () {
      loadPromise = null;
      if (launch) {
        launch.disabled = false;
        launch.removeAttribute("aria-busy");
      }
      throw new Error("Unable to load chat");
    });

    return loadPromise;
  }

  function openChat() {
    return loadChat().then(function () {
      if (window.__aaaOpenChat !== openChat) window.__aaaOpenChat();
    }).catch(function () {
      window.location.href = "/contact.html";
    });
  }

  window.__aaaOpenChat = openChat;

  function scheduleInit() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(function () { setTimeout(initChatFab, 2000); }, { timeout: 5000 });
    } else {
      setTimeout(initChatFab, 2500);
    }
  }

  if (document.readyState === 'complete') {
    scheduleInit();
  } else {
    window.addEventListener('load', scheduleInit, { once: true });
  }

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (e) {
    window.addEventListener(e, function () {
      initChatFab();
    }, { once: true, passive: true });
  });
})();
