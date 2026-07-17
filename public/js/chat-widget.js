/*
 * AAA Handyman Services — AI chat widget.
 *
 * A self-contained floating chat widget (bottom-right corner) that talks to the
 * streaming Netlify Function at /api/chat. Drop `<script src="/js/chat-widget.js"
 * defer></script>` onto any page and this file injects its own markup + styles,
 * so no per-page HTML is required. Styling mirrors the site palette:
 * navy #0d2237 (blue-600) and crimson #8e1f26 (red-600).
 */
(function () {
  "use strict";

  // Guard against double-injection if the script is included more than once.
  if (window.__aaaChatWidgetLoaded) return;
  window.__aaaChatWidgetLoaded = true;

  var NAVY = "#0d2237";
  var CRIMSON = "#8e1f26";

  // Conversation history in OpenAI chat format: { role, content }.
  var messages = [];
  var streaming = false;

  // --- Styles -------------------------------------------------------------
  var style = document.createElement("style");
  style.textContent = [
    // Bottom-right group of labeled buttons, stacked with chat above call:
    // the chat launcher and a call button. The site's own floating call widget
    // is hidden at runtime (see hideExistingFloating) so these don't overlap.
    ".aaa-fab{position:fixed;bottom:20px;right:20px;z-index:2147483000;display:flex;flex-direction:column;gap:12px;align-items:flex-end}",
    ".aaa-fab .aaa-fab-btn{min-width:126px;height:60px;padding:0 20px;border-radius:9999px;border:2px solid #fff;display:flex;align-items:center;justify-content:center;gap:10px;box-sizing:border-box;font:700 16px/1 'Roboto',system-ui,-apple-system,'Segoe UI',sans-serif;white-space:nowrap;color:#fff;cursor:pointer;text-decoration:none;box-shadow:0 8px 24px rgba(13,34,55,.35);transition:transform .15s ease,background .15s ease}",
    ".aaa-fab .aaa-fab-btn i{font-size:20px}",
    ".aaa-fab .aaa-fab-btn:hover{transform:scale(1.06)}",
    ".aaa-fab .aaa-fab-btn:focus-visible{outline:3px solid #9fb1ca;outline-offset:2px}",
    ".aaa-chat-launch{background:" + CRIMSON + "}",
    ".aaa-chat-launch:hover{background:#751a1e}",
    ".aaa-call{background:#16a34a}",
    ".aaa-call:hover{background:#15803d}",
    ".aaa-chat-panel{position:fixed;bottom:164px;right:20px;z-index:2147483000;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 198px);background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(13,34,55,.4);display:none;flex-direction:column;overflow:hidden;font-family:'Roboto',system-ui,-apple-system,'Segoe UI',sans-serif}",
    ".aaa-chat-panel.aaa-open{display:flex;animation:aaa-pop .18s ease}",
    "@keyframes aaa-pop{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}",
    ".aaa-chat-header{background:" + NAVY + ";color:#fff;padding:16px 18px;display:flex;align-items:center;gap:12px}",
    ".aaa-chat-header .aaa-avatar{width:38px;height:38px;border-radius:9999px;background:" + CRIMSON + ";display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}",
    ".aaa-chat-header h2{margin:0;font-size:15px;font-weight:700;line-height:1.2}",
    ".aaa-chat-header p{margin:2px 0 0;font-size:12px;opacity:.75;line-height:1.2}",
    ".aaa-chat-header-actions{margin-left:auto;display:flex;align-items:center;gap:8px}",
    ".aaa-chat-control-btn{background:none;border:none;color:#fff;font-size:16px;cursor:pointer;opacity:.8;padding:6px;line-height:1;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:opacity .15s,background-color .15s}",
    ".aaa-chat-control-btn:hover{opacity:1;background-color:rgba(255,255,255,0.15)}",
    ".aaa-chat-close{font-size:20px}",
    ".aaa-chat-log{flex:1;overflow-y:auto;padding:18px;background:#f3f6f9;display:flex;flex-direction:column;gap:12px}",
    ".aaa-msg{max-width:82%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}",
    ".aaa-msg.aaa-user{align-self:flex-end;background:" + NAVY + ";color:#fff;border-bottom-right-radius:4px}",
    ".aaa-msg.aaa-bot{align-self:flex-start;background:#fff;color:#0d2237;border:1px solid #e7ecf2;border-bottom-left-radius:4px}",
    ".aaa-msg.aaa-bot a{color:" + CRIMSON + ";text-decoration:underline}",
    ".aaa-typing{display:inline-flex;gap:4px;align-items:center}",
    ".aaa-typing span{width:7px;height:7px;border-radius:9999px;background:#9fb1ca;animation:aaa-blink 1.2s infinite ease-in-out}",
    ".aaa-typing span:nth-child(2){animation-delay:.2s}.aaa-typing span:nth-child(3){animation-delay:.4s}",
    "@keyframes aaa-blink{0%,80%,100%{opacity:.3}40%{opacity:1}}",
    ".aaa-chat-emoji-bar{display:flex;gap:8px;padding:6px 12px;background:#f8fafc;border-top:1px solid #e7ecf2;align-items:center;overflow-x:auto;scrollbar-width:none}",
    ".aaa-chat-emoji-bar::-webkit-scrollbar{display:none}",
    ".aaa-chat-emoji-bar span{font-size:18px;cursor:pointer;user-select:none;transition:transform .1s ease;padding:2px}",
    ".aaa-chat-emoji-bar span:hover{transform:scale(1.25)}",
    ".aaa-chat-form{border-top:1px solid #e7ecf2;padding:12px;display:flex;gap:8px;align-items:flex-end;background:#fff}",
    ".aaa-chat-form textarea{flex:1;resize:none;border:1px solid #c3cfde;border-radius:12px;padding:10px 12px;font-family:inherit;font-size:14px;line-height:1.4;max-height:120px;color:#0d2237}",
    ".aaa-chat-form textarea:focus{outline:none;border-color:" + NAVY + ";box-shadow:0 0 0 3px rgba(15,59,121,.15)}",
    ".aaa-chat-emoji-trigger{flex-shrink:0;width:42px;height:42px;border-radius:12px;border:1px solid #c3cfde;background:#fff;color:#5776a2;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s ease,color .15s ease}",
    ".aaa-chat-emoji-trigger:hover{background:#f3f6f9;color:" + NAVY + "}",
    ".aaa-chat-send{flex-shrink:0;width:42px;height:42px;border-radius:12px;border:none;background:" + CRIMSON + ";color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s ease}",
    ".aaa-chat-send:hover:not(:disabled){background:#751a1e}",
    ".aaa-chat-send:disabled{opacity:.5;cursor:not-allowed}",
    ".aaa-chat-disclaimer{font-size:10px;color:#5776a2;text-align:center;padding:0 12px 10px;background:#fff;line-height:1.3}"
  ].join("");
  document.head.appendChild(style);

  // --- Markup -------------------------------------------------------------
  // A bottom-right stack with chat above call, each shown as a labeled pill.
  var group = document.createElement("div");
  group.className = "aaa-fab";

  var launch = document.createElement("button");
  launch.type = "button";
  launch.className = "aaa-fab-btn aaa-chat-launch";
  launch.setAttribute("aria-label", "Open chat with AAA Handyman Services");
  launch.innerHTML = '<i class="fas fa-comments" aria-hidden="true"></i><span>AI Chat</span>';

  var callBtn = document.createElement("a");
  callBtn.className = "aaa-fab-btn aaa-call";
  callBtn.href = "tel:+12483853432";
  callBtn.title = "Call AAA Handyman Services";
  callBtn.setAttribute("aria-label", "Call AAA Handyman Services at (248) 385-3432");
  callBtn.innerHTML = '<i class="fas fa-phone" aria-hidden="true"></i><span>Call Now!</span>';

  group.appendChild(launch);
  group.appendChild(callBtn);

  var panel = document.createElement("div");
  panel.className = "aaa-chat-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chat with AAA Handyman Services");
  panel.innerHTML =
    '<div class="aaa-chat-header">' +
      '<div class="aaa-avatar"><i class="fas fa-hammer" aria-hidden="true"></i></div>' +
      '<div><h2>AAA Handyman Services</h2><p>Ask about our services &amp; areas</p></div>' +
      '<div class="aaa-chat-header-actions">' +
        '<button class="aaa-chat-control-btn aaa-chat-reset" title="Start new chat / Delete chat history" aria-label="Start new chat / Delete chat history"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>' +
        '<button class="aaa-chat-control-btn aaa-chat-close" title="Close chat" aria-label="Close chat">&times;</button>' +
      '</div>' +
    '</div>' +
    '<div class="aaa-chat-log" id="aaa-chat-log" role="log" aria-live="polite"></div>' +
    '<div class="aaa-chat-emoji-bar" id="aaa-chat-emoji-bar" style="display:none;">' +
      '<span>👋</span><span>🛠️</span><span>🏠</span><span>📞</span><span>👍</span><span>❤️</span><span>😁</span><span>🙏</span><span>✨</span><span>🔥</span>' +
    '</div>' +
    '<form class="aaa-chat-form" id="aaa-chat-form">' +
      '<button type="button" class="aaa-chat-emoji-trigger" id="aaa-chat-emoji-trigger" title="Insert emoji" aria-label="Insert emoji"><i class="far fa-smile" aria-hidden="true"></i></button>' +
      '<textarea id="aaa-chat-input" rows="1" placeholder="Type your question…" aria-label="Your message"></textarea>' +
      '<button type="submit" class="aaa-chat-send" id="aaa-chat-send" aria-label="Send message"><i class="fas fa-paper-plane" aria-hidden="true"></i></button>' +
    '</form>' +
    '<div class="aaa-chat-disclaimer">Automated assistant. For quotes or booking call (248) 385-3432.</div>';

  document.body.appendChild(group);
  document.body.appendChild(panel);

  var log = panel.querySelector("#aaa-chat-log");
  var form = panel.querySelector("#aaa-chat-form");
  var input = panel.querySelector("#aaa-chat-input");
  var sendBtn = panel.querySelector("#aaa-chat-send");
  var closeBtn = panel.querySelector(".aaa-chat-close");
  var resetBtn = panel.querySelector(".aaa-chat-reset");
  var emojiTrigger = panel.querySelector("#aaa-chat-emoji-trigger");
  var emojiBar = panel.querySelector("#aaa-chat-emoji-bar");

  var GREETING = "Hi! 👋 I'm the AAA Handyman Services assistant. Ask me about our services, the areas we cover, or how to get a quote.";

  // --- Placement ----------------------------------------------------------
  // The site ships its own floating call widget in the bottom-right corner (a
  // pill on desktop, a stacked widget on mobile). Hide it so our unified
  // labeled button group is the only thing in that corner — no overlap. We detect
  // it as a small fixed element anchored to the bottom-right quadrant, ignoring
  // our own group/panel and the bottom-left "back to top" control.
  function hideExistingFloating() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var els = document.body.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el === group || el === panel || group.contains(el) || panel.contains(el)) continue;
      var cs = window.getComputedStyle(el);
      if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden") continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Skip large fixed overlays (menus, headers, backdrops).
      if (r.width > vw * 0.6 || r.height > vh * 0.6) continue;
      // Only the bottom-right corner (where the floating call widget lives).
      if (r.right < vw * 0.5 || r.bottom < vh * 0.5) continue;
      el.style.setProperty("display", "none", "important");
    }
  }

  // --- Helpers ------------------------------------------------------------
  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Render bot text: escape, then linkify newlines and simple **bold**.
  function renderBot(el, text) {
    var html = escapeHTML(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    el.innerHTML = html;
    scrollToBottom();
  }

  function addMessage(role, text) {
    var el = document.createElement("div");
    el.className = "aaa-msg " + (role === "user" ? "aaa-user" : "aaa-bot");
    el.textContent = text;
    log.appendChild(el);
    scrollToBottom();
    return el;
  }

  function scrollToBottom() {
    log.scrollTop = log.scrollHeight;
  }

  function autoGrow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  }

  var opened = false;
  function openPanel() {
    panel.classList.add("aaa-open");
    launch.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
    if (!opened) {
      opened = true;
      addMessage("assistant", GREETING);
    }
    setTimeout(function () { input.focus(); }, 50);
  }

  function closePanel() {
    panel.classList.remove("aaa-open");
    launch.innerHTML = '<i class="fas fa-comments" aria-hidden="true"></i>';
  }

  function togglePanel() {
    panel.classList.contains("aaa-open") ? closePanel() : openPanel();
  }

  // --- Streaming request --------------------------------------------------
  async function sendMessage(text) {
    if (streaming) return;
    streaming = true;
    sendBtn.disabled = true;

    addMessage("user", text);
    messages.push({ role: "user", content: text });

    // Placeholder bubble with an animated typing indicator.
    var botEl = addMessage("assistant", "");
    botEl.innerHTML = '<span class="aaa-typing"><span></span><span></span><span></span></span>';

    var full = "";
    try {
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages, page: window.location.pathname }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });

        // SSE frames are separated by a blank line.
        var frames = buffer.split("\n\n");
        buffer = frames.pop();

        for (var i = 0; i < frames.length; i++) {
          var line = frames[i].trim();
          if (line.indexOf("data:") !== 0) continue;
          var payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            var data = JSON.parse(payload);
            if (data.error) throw new Error("stream error");
            if (data.text) {
              full += data.text;
              renderBot(botEl, full);
            }
          } catch (e) {
            if (!full) throw e;
          }
        }
      }

      if (!full) throw new Error("Empty response");
      messages.push({ role: "assistant", content: full });
    } catch (err) {
      renderBot(
        botEl,
        "Sorry, I couldn't reach the assistant just now. Please call us at (248) 385-3432 or email contact@aaahandyman.services."
      );
    } finally {
      streaming = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // --- Events -------------------------------------------------------------
  launch.addEventListener("click", togglePanel);
  closeBtn.addEventListener("click", closePanel);

  resetBtn.addEventListener("click", function () {
    if (confirm("Are you sure you want to clear your chat history and start a new session?")) {
      messages = [];
      log.innerHTML = "";
      addMessage("assistant", GREETING);
      emojiBar.style.display = "none";
      input.value = "";
      autoGrow();
    }
  });

  emojiTrigger.addEventListener("click", function () {
    if (emojiBar.style.display === "none") {
      emojiBar.style.display = "flex";
    } else {
      emojiBar.style.display = "none";
    }
  });

  emojiBar.addEventListener("click", function (e) {
    if (e.target.tagName === "SPAN") {
      var emoji = e.target.textContent;
      var start = input.selectionStart;
      var end = input.selectionEnd;
      var text = input.value;
      input.value = text.substring(0, start) + emoji + text.substring(end);
      input.focus();
      var newPos = start + emoji.length;
      input.setSelectionRange(newPos, newPos);
      autoGrow();
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || streaming) return;
    input.value = "";
    autoGrow();
    emojiBar.style.display = "none";
    sendMessage(text);
  });

  input.addEventListener("input", autoGrow);

  // Enter sends, Shift+Enter inserts a newline.
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("aaa-open")) closePanel();
  });

  // Hide the site's own floating call widget now and after layout settles, so
  // it can't reappear at a breakpoint and overlap our button group.
  hideExistingFloating();
  window.addEventListener("load", hideExistingFloating);
  window.addEventListener("resize", hideExistingFloating);
  window.addEventListener("orientationchange", hideExistingFloating);
})();
