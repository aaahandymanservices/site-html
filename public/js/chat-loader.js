(function () {
  "use strict";

  if (window.__aaaChatLoaderReady || window.__aaaChatWidgetLoaded) return;

  // The contact page already shows the phone number and a full contact form,
  // so the floating chat/call buttons are redundant there and can crowd the
  // form. Bail out before creating the .aaa-fab group on that page only.
  var path = location.pathname.replace(/\.html$/, "").replace(/\/+$/, "");
  if (path === "/contact") return;

  window.__aaaChatLoaderReady = true;

  var style = document.createElement("style");
  style.id = "aaa-chat-loader-style";
  style.textContent = [
    ".aaa-fab{position:fixed;bottom:20px;right:20px;z-index:40;display:flex;flex-direction:column;gap:12px;align-items:flex-end}",
    ".aaa-fab .aaa-fab-btn{min-width:126px;height:60px;padding:0 20px;border-radius:9999px;border:2px solid #fff;display:flex;align-items:center;justify-content:center;gap:10px;box-sizing:border-box;font:700 16px/1 'Roboto',system-ui,-apple-system,'Segoe UI',sans-serif;white-space:nowrap;color:#fff;cursor:pointer;text-decoration:none;box-shadow:0 8px 24px rgba(13,34,55,.35);transition:transform .15s ease,background .15s ease}",
    ".aaa-fab .aaa-fab-btn i{font-size:20px}",
    ".aaa-fab .aaa-fab-btn:hover{transform:scale(1.06)}",
    ".aaa-fab .aaa-fab-btn:focus-visible{outline:3px solid #9fb1ca;outline-offset:2px}",
    ".aaa-chat-launch{background:#A61F2E}",
    ".aaa-chat-launch:hover{background:#751a1e}",
    ".aaa-chat-launch[aria-busy='true']{cursor:progress;opacity:.8}",
    ".aaa-call{background:#16a34a}",
    ".aaa-call:hover{background:#15803d}",
    "@media(max-width:767px){.aaa-fab{right:max(16px,env(safe-area-inset-right,0px));bottom:calc(20px + env(safe-area-inset-bottom,0px));gap:14px}.aaa-fab .aaa-fab-btn{min-width:0;width:54px;height:54px;padding:0;border-radius:50%;gap:0;flex:0 0 54px}.aaa-fab .aaa-fab-btn i{font-size:21px;line-height:1}.aaa-fab .aaa-fab-label{display:none!important}}"
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

  var loadPromise;
  function loadChat() {
    if (window.__aaaChatWidgetLoaded && window.__aaaOpenChat !== openChat) {
      return Promise.resolve();
    }
    if (loadPromise) return loadPromise;

    launch.disabled = true;
    launch.setAttribute("aria-busy", "true");

    loadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "/js/chat-widget.js?v=20260724-2";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    }).then(function () {
      group.remove();
      style.remove();
    }).catch(function () {
      loadPromise = null;
      launch.disabled = false;
      launch.removeAttribute("aria-busy");
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
  launch.addEventListener("click", openChat);
})();
