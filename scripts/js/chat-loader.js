(function () {
  "use strict";

  if (window.__aaaChatLoaderReady || window.__aaaChatWidgetLoaded) return;

  var path = location.pathname.replace(/\.html$/, "").replace(/\/+$/, "");
  if (path === "/contact") return;

  window.__aaaChatLoaderReady = true;

  function initChatFab() {
    if (document.getElementById("aaa-chat-loader")) return;

    var style = document.createElement("style");
    style.id = "aaa-chat-loader-style";
    style.textContent = [
      ".aaa-fab{position:fixed;bottom:20px;right:20px;z-index:40;display:flex;flex-direction:column;gap:12px;align-items:flex-end}",
      ".aaa-fab .aaa-fab-btn{min-width:130px;height:56px;padding:0 22px;border-radius:9999px;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;gap:10px;box-sizing:border-box;font:700 15px/1 'Roboto','Archivo',system-ui,-apple-system,sans-serif;white-space:nowrap;color:#ffffff;cursor:pointer;text-decoration:none;box-shadow:0 10px 25px -5px rgba(15,23,42,0.25);transition:transform .18s cubic-bezier(.16,1,.3,1),background .18s ease,box-shadow .18s ease;will-change:transform}",
      ".aaa-fab .aaa-fab-btn i{font-size:19px;line-height:1;flex-shrink:0}",
      ".aaa-fab .aaa-fab-btn:hover{transform:translateY(-2px) scale(1.03)}",
      ".aaa-fab .aaa-fab-btn:focus-visible{outline:3px solid #9fb1ca;outline-offset:2px}",
      ".aaa-chat-launch{background:#A61F2E;box-shadow:0 10px 25px -5px rgba(166,31,46,0.35)}",
      ".aaa-chat-launch:hover{background:#781925;box-shadow:0 14px 28px -4px rgba(166,31,46,0.45)}",
      ".aaa-chat-launch[aria-busy='true']{cursor:progress;opacity:.8}",
      ".aaa-call{background:#16a34a;box-shadow:0 10px 25px -5px rgba(22,163,74,0.35)}",
      ".aaa-call:hover{background:#15803d;box-shadow:0 14px 28px -4px rgba(22,163,74,0.45)}",
      "@media(max-width:767px){.aaa-fab{right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));gap:12px}.aaa-fab .aaa-fab-btn{min-width:0;width:54px;height:54px;padding:0;border-radius:50%;gap:0;flex:0 0 54px}.aaa-fab .aaa-fab-btn i{font-size:21px;line-height:1}.aaa-fab .aaa-fab-label{display:none!important}}"
    ].join("");
    document.head.appendChild(style);

    var group = document.createElement("div");
    group.id = "aaa-chat-loader";
    group.className = "aaa-fab";

    var launch = document.createElement("button");
    launch.type = "button";
    launch.className = "aaa-fab-btn aaa-chat-launch";
    launch.setAttribute("aria-label", "Open chat with AAA Handyman Services");
    launch.innerHTML = '<i class="fas fa-comments" aria-hidden="true"></i><span class="aaa-fab-label">AI Chat</span>';

    var callButton = document.createElement("a");
    callButton.className = "aaa-fab-btn aaa-call";
    callButton.href = "tel:+12483853432";
    callButton.title = "Call AAA Handyman Services";
    callButton.setAttribute("aria-label", "Call AAA Handyman Services at (248) 385-3432");
    callButton.innerHTML = '<i class="fas fa-phone" aria-hidden="true"></i><span class="aaa-fab-label">Call Now!</span>';

    group.appendChild(launch);
    group.appendChild(callButton);
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
      script.src = "/js/chat-widget.js?v=20260729b";
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
