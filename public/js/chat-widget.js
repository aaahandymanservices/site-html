(function () {
  "use strict";
  if (window.__aaaChatWidgetLoaded) return;
  window.__aaaChatWidgetLoaded = true;

  var NAVY = "#0d2237";
  var CRIMSON = "#8e1f26";
  var messages = [];
  var streaming = false;
  var activeRequest = null;
  var conversationVersion = 0;
  var style = document.createElement("style");
  style.textContent = [
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
    ".aaa-chat-header .aaa-avatar{width:42px;height:42px;border-radius:9999px;background:" + CRIMSON + ";display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;border:2px solid rgba(255,255,255,.9);box-shadow:0 2px 8px rgba(0,0,0,.22)}",
    ".aaa-chat-header .aaa-avatar img{width:100%;height:100%;display:block;object-fit:cover}",
    ".aaa-chat-header h2{margin:0;font-size:15px;font-weight:700;line-height:1.2}",
    ".aaa-chat-header p{margin:2px 0 0;font-size:12px;opacity:.75;line-height:1.2}",
    ".aaa-chat-header-actions{margin-left:auto;display:flex;align-items:center;gap:8px}",
    ".aaa-chat-control-btn{background:none;border:none;color:#fff;font-size:16px;cursor:pointer;opacity:.8;padding:6px;line-height:1;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:opacity .15s,background-color .15s}",
    ".aaa-chat-control-btn:hover{opacity:1;background-color:rgba(255,255,255,0.15)}",
    ".aaa-chat-control-btn svg,.aaa-chat-emoji-trigger svg{width:20px;height:20px;display:block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    ".aaa-chat-close{font-size:20px}",
    ".aaa-chat-log{flex:1;overflow-y:auto;padding:18px;background:#f3f6f9;display:flex;flex-direction:column;gap:12px}",
    ".aaa-msg-row{display:flex;align-items:flex-end;gap:8px;max-width:88%}",
    ".aaa-msg-row.aaa-user-row{align-self:flex-end;justify-content:flex-end}",
    ".aaa-msg-row.aaa-bot-row{align-self:flex-start}",
    ".aaa-msg-avatar{width:30px;height:30px;border-radius:9999px;object-fit:cover;flex:0 0 30px;border:1px solid #cbd6e2;box-shadow:0 2px 6px rgba(13,34,55,.16)}",
    ".aaa-msg{max-width:100%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}",
    ".aaa-msg.aaa-user{background:" + NAVY + ";color:#fff;border-bottom-right-radius:4px}",
    ".aaa-msg.aaa-bot{background:#fff;color:#0d2237;border:1px solid #e7ecf2;border-bottom-left-radius:4px}",
    ".aaa-msg.aaa-bot a{color:" + CRIMSON + ";text-decoration:underline}",
    ".aaa-typing{display:inline-flex;gap:4px;align-items:center}",
    ".aaa-typing span{width:7px;height:7px;border-radius:9999px;background:#9fb1ca;animation:aaa-blink 1.2s infinite ease-in-out}",
    ".aaa-typing span:nth-child(2){animation-delay:.2s}.aaa-typing span:nth-child(3){animation-delay:.4s}",
    "@keyframes aaa-blink{0%,80%,100%{opacity:.3}40%{opacity:1}}",
    ".aaa-chat-prompts{padding:10px 12px 9px;background:#fff;border-top:1px solid #e7ecf2}",
    ".aaa-chat-prompts-label{margin:0 0 7px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5776a2}",
    ".aaa-chat-prompts-list{display:flex;gap:7px;overflow-x:auto;padding:1px 1px 3px;scrollbar-width:none}",
    ".aaa-chat-prompts-list::-webkit-scrollbar{display:none}",
    ".aaa-chat-prompt{flex:0 0 auto;max-width:230px;border:1px solid #cbd6e2;border-radius:9999px;background:#f8fafc;color:" + NAVY + ";padding:8px 11px;font:700 12px/1.2 'Roboto',system-ui,-apple-system,'Segoe UI',sans-serif;cursor:pointer;white-space:nowrap;transition:transform .15s ease,border-color .15s ease,background .15s ease,color .15s ease}",
    ".aaa-chat-prompt:hover:not(:disabled){transform:translateY(-1px);border-color:" + CRIMSON + ";background:#fff5f5;color:" + CRIMSON + "}",
    ".aaa-chat-prompt:focus-visible{outline:3px solid rgba(166,31,46,.22);outline-offset:1px}",
    ".aaa-chat-prompt:disabled{opacity:.48;cursor:not-allowed}",
    ".aaa-chat-emoji-bar{display:flex;gap:6px;padding:8px 12px;background:#f8fafc;border-top:1px solid #e7ecf2;align-items:center;overflow-x:auto;scrollbar-width:none}",
    ".aaa-chat-emoji-bar[hidden]{display:none}",
    ".aaa-chat-emoji-bar::-webkit-scrollbar{display:none}",
    ".aaa-chat-emoji{flex:0 0 auto;width:34px;height:34px;border:1px solid #d7e0ea;border-radius:10px;background:#fff;font-size:19px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s ease,border-color .15s ease,transform .15s ease}",
    ".aaa-chat-emoji:hover{background:#edf2f7;border-color:#9fb1ca;transform:translateY(-2px) rotate(-3deg)}",
    ".aaa-chat-emoji:focus-visible{outline:3px solid rgba(166,31,46,.25);outline-offset:1px}",
    ".aaa-chat-form{border-top:1px solid #e7ecf2;padding:12px;display:flex;gap:8px;align-items:flex-end;background:#fff}",
    ".aaa-chat-form textarea{flex:1;resize:none;border:1px solid #c3cfde;border-radius:12px;padding:10px 12px;font-family:inherit;font-size:14px;line-height:1.4;max-height:120px;color:#0d2237}",
    ".aaa-chat-form textarea:focus{outline:none;border-color:" + NAVY + ";box-shadow:0 0 0 3px rgba(15,59,121,.15)}",
    ".aaa-chat-emoji-trigger{flex-shrink:0;width:42px;height:42px;border-radius:12px;border:1px solid #c3cfde;background:#fff;color:#5776a2;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s ease,color .15s ease}",
    ".aaa-chat-emoji-trigger:hover,.aaa-chat-emoji-trigger[aria-expanded='true']{background:#f3f6f9;color:" + NAVY + "}",
    ".aaa-chat-send{flex-shrink:0;width:42px;height:42px;border-radius:12px;border:none;background:" + CRIMSON + ";color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s ease}",
    ".aaa-chat-send:hover:not(:disabled){background:#751a1e}",
    ".aaa-chat-send:disabled{opacity:.5;cursor:not-allowed}",
    ".aaa-chat-disclaimer{font-size:10px;color:#5776a2;text-align:center;padding:0 12px 10px;background:#fff;line-height:1.3}",
    ".aaa-chat-bubble{position:fixed;bottom:164px;right:20px;z-index:2147482999;width:280px;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(13,34,55,.25);border:1.5px solid #e7ecf2;padding:12px 14px;box-sizing:border-box;font:14px/1.4 'Roboto',system-ui,-apple-system,sans-serif;color:#0d2237;cursor:pointer;display:none;opacity:0;transform:translateY(10px);transition:opacity .3s ease,transform .3s ease}",
    ".aaa-chat-bubble.aaa-show{display:block;opacity:1;transform:translateY(0)}",
    ".aaa-chat-bubble-arrow{position:absolute;bottom:-8px;right:42px;width:12px;height:12px;background:#fff;border-right:1.5px solid #e7ecf2;border-bottom:1.5px solid #e7ecf2;transform:rotate(45deg)}",
    ".aaa-chat-bubble-close{position:absolute;top:6px;right:8px;background:none;border:none;color:#9fb1ca;font-size:16px;cursor:pointer;line-height:1;padding:4px;transition:color .15s}",
    ".aaa-chat-bubble-close:hover{color:" + CRIMSON + "}",
    "@media(max-width:767px){.aaa-fab{right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));flex-direction:row;gap:10px;align-items:center}.aaa-fab .aaa-fab-btn{min-width:0;width:54px;height:54px;padding:0;border-radius:50%;gap:0;flex:0 0 54px}.aaa-fab .aaa-fab-btn i{font-size:21px;line-height:1}.aaa-fab .aaa-fab-label{display:none!important}.aaa-chat-panel{right:max(12px,env(safe-area-inset-right));bottom:88px;max-width:calc(100vw - 24px);max-height:calc(100vh - 112px)}.aaa-chat-bubble{right:max(12px,env(safe-area-inset-right));bottom:88px;max-width:calc(100vw - 24px)}.aaa-chat-bubble-arrow{right:24px}}",
    "@media(max-width:359px){.aaa-fab .aaa-fab-btn{width:50px;height:50px;flex-basis:50px}.aaa-fab{gap:8px}.aaa-chat-panel,.aaa-chat-bubble{bottom:80px}}"
  ].join("");
  document.head.appendChild(style);
  var group = document.createElement("div");
  group.className = "aaa-fab";

  var launch = document.createElement("button");
  launch.type = "button";
  launch.className = "aaa-fab-btn aaa-chat-launch";
  launch.setAttribute("aria-label", "Open chat with AAA Handyman Services");
  launch.innerHTML = '<i class="fas fa-comments" aria-hidden="true"></i><span class="aaa-fab-label">AI Chat</span>';

  var callBtn = document.createElement("a");
  callBtn.className = "aaa-fab-btn aaa-call";
  callBtn.href = "tel:+12483853432";
  callBtn.title = "Call AAA Handyman Services";
  callBtn.setAttribute("aria-label", "Call AAA Handyman Services at (248) 385-3432");
  callBtn.innerHTML = '<i class="fas fa-phone" aria-hidden="true"></i><span class="aaa-fab-label">Call Now!</span>';

  group.appendChild(launch);
  group.appendChild(callBtn);

  var panel = document.createElement("div");
  panel.className = "aaa-chat-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chat with AAA Handyman Services");
  panel.innerHTML =
    '<div class="aaa-chat-header">' +
      '<div class="aaa-avatar"><img src="/logo-circular.png?v=20260718-1" alt="" aria-hidden="true"></div>' +
      '<div><h2>AAA Handyman Services</h2><p>Ask about our services &amp; areas</p></div>' +
      '<div class="aaa-chat-header-actions">' +
        '<button type="button" class="aaa-chat-control-btn aaa-chat-new" title="Refresh chat" aria-label="Refresh chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/></svg></button>' +
        '<button type="button" class="aaa-chat-control-btn aaa-chat-close" title="Close chat" aria-label="Close chat">&times;</button>' +
      '</div>' +
    '</div>' +
    '<div class="aaa-chat-log" id="aaa-chat-log" role="log" aria-live="polite"></div>' +
    '<div class="aaa-chat-prompts" aria-label="Suggested questions">' +
      '<p class="aaa-chat-prompts-label">Popular questions</p>' +
      '<div class="aaa-chat-prompts-list">' +
        '<button type="button" class="aaa-chat-prompt" data-question="What handyman services do you offer?">What services do you offer?</button>' +
        '<button type="button" class="aaa-chat-prompt" data-question="Do you serve my area?">Do you serve my area?</button>' +
        '<button type="button" class="aaa-chat-prompt" data-question="How can I get a quote for my project?">How do I get a quote?</button>' +
      '</div>' +
    '</div>' +
    '<div class="aaa-chat-emoji-bar" id="aaa-chat-emoji-bar" hidden aria-label="Handyman emojis">' +
      '<button type="button" class="aaa-chat-emoji" data-emoji="🛠️" aria-label="Hammer and wrench">🛠️</button>' +
      '<button type="button" class="aaa-chat-emoji" data-emoji="🔨" aria-label="Hammer">🔨</button>' +
      '<button type="button" class="aaa-chat-emoji" data-emoji="🔧" aria-label="Wrench">🔧</button>' +
      '<button type="button" class="aaa-chat-emoji" data-emoji="🪛" aria-label="Screwdriver">🪛</button>' +
      '<button type="button" class="aaa-chat-emoji" data-emoji="🪚" aria-label="Saw">🪚</button>' +
      '<button type="button" class="aaa-chat-emoji" data-emoji="🧰" aria-label="Toolbox">🧰</button>' +
      '<button type="button" class="aaa-chat-emoji" data-emoji="🪜" aria-label="Ladder">🪜</button>' +
      '<button type="button" class="aaa-chat-emoji" data-emoji="🧱" aria-label="Brick">🧱</button>' +
      '<button type="button" class="aaa-chat-emoji" data-emoji="🏠" aria-label="House">🏠</button>' +
      '<button type="button" class="aaa-chat-emoji" data-emoji="🎨" aria-label="Painting">🎨</button>' +
    '</div>' +
    '<form class="aaa-chat-form" id="aaa-chat-form">' +
      '<button type="button" class="aaa-chat-emoji-trigger" id="aaa-chat-emoji-trigger" title="Add an emoji" aria-label="Add an emoji" aria-expanded="false" aria-controls="aaa-chat-emoji-bar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg></button>' +
      '<textarea id="aaa-chat-input" rows="1" placeholder="Type your question…" aria-label="Your message"></textarea>' +
      '<button type="submit" class="aaa-chat-send" id="aaa-chat-send" aria-label="Send message"><i class="fas fa-paper-plane" aria-hidden="true"></i></button>' +
    '</form>' +
    '<div class="aaa-chat-disclaimer">Automated assistant. For quotes or booking call (248) 385-3432.</div>';

  document.body.appendChild(group);
  document.body.appendChild(panel);
  var bubble = document.createElement("div");
  bubble.className = "aaa-chat-bubble";
  bubble.innerHTML = 
    '<strong>Need repair help?</strong><br>Ask our AI assistant a question! 👋' +
    '<button type="button" class="aaa-chat-bubble-close" title="Dismiss" aria-label="Dismiss">&times;</button>' +
    '<div class="aaa-chat-bubble-arrow"></div>';
  document.body.appendChild(bubble);

  var bubbleTimeout = setTimeout(function () {
    if (!panel.classList.contains("aaa-open")) {
      bubble.classList.add("aaa-show");
    }
  }, 5000);

  var log = panel.querySelector("#aaa-chat-log");
  var form = panel.querySelector("#aaa-chat-form");
  var input = panel.querySelector("#aaa-chat-input");
  var sendBtn = panel.querySelector("#aaa-chat-send");
  var closeBtn = panel.querySelector(".aaa-chat-close");
  var newChatBtn = panel.querySelector(".aaa-chat-new");
  var emojiTrigger = panel.querySelector("#aaa-chat-emoji-trigger");
  var emojiBar = panel.querySelector("#aaa-chat-emoji-bar");
  var promptList = panel.querySelector(".aaa-chat-prompts-list");
  var promptButtons = panel.querySelectorAll(".aaa-chat-prompt");

  var GREETING = "Hi! 👋 I'm the AAA Handyman Services assistant. Ask me about our services, the areas we cover, or how to get a quote.";
  function hideExistingFloating() {
    var els = document.querySelectorAll(".fixed.bottom-5.right-5, [class*='fixed'][class*='bottom-5'][class*='right-5']");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el === group || el === panel || group.contains(el) || panel.contains(el)) continue;
      el.style.setProperty("display", "none", "important");
    }
  }
  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function renderBot(el, text) {
    var html = escapeHTML(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    el.innerHTML = html;
    scrollToBottom();
  }

  function addMessage(role, text) {
    var row = document.createElement("div");
    row.className = "aaa-msg-row " + (role === "user" ? "aaa-user-row" : "aaa-bot-row");

    if (role !== "user") {
      var avatar = document.createElement("img");
      avatar.className = "aaa-msg-avatar";
      avatar.src = "/logo-circular.png?v=20260718-1";
      avatar.alt = "AAA Handyman Services";
      row.appendChild(avatar);
    }

    var el = document.createElement("div");
    el.className = "aaa-msg " + (role === "user" ? "aaa-user" : "aaa-bot");
    el.textContent = text;
    row.appendChild(el);
    log.appendChild(row);
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

  function setEmojiBarOpen(isOpen) {
    emojiBar.hidden = !isOpen;
    emojiTrigger.setAttribute("aria-expanded", String(isOpen));
  }

  function setPromptButtonsDisabled(isDisabled) {
    for (var i = 0; i < promptButtons.length; i++) {
      promptButtons[i].disabled = isDisabled;
    }
  }

  function resetChat() {
    conversationVersion += 1;
    if (activeRequest) activeRequest.abort();
    activeRequest = null;
    streaming = false;
    sendBtn.disabled = false;
    setPromptButtonsDisabled(false);
    messages = [];
    log.innerHTML = "";
    addMessage("assistant", GREETING);
    setEmojiBarOpen(false);
    input.value = "";
    autoGrow();
    input.focus();
  }

  var opened = false;
  function openPanel() {
    panel.classList.add("aaa-open");
    launch.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
    bubble.classList.remove("aaa-show");
    clearTimeout(bubbleTimeout);
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
  async function sendMessage(text) {
    if (streaming) return;
    streaming = true;
    sendBtn.disabled = true;
    setPromptButtonsDisabled(true);
    var requestVersion = conversationVersion;
    activeRequest = new AbortController();

    addMessage("user", text);
    messages.push({ role: "user", content: text });
    var botEl = addMessage("assistant", "");
    botEl.innerHTML = '<span class="aaa-typing"><span></span><span></span><span></span></span>';

    var full = "";
    try {
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages, page: window.location.pathname }),
        signal: activeRequest.signal,
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
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
              if (requestVersion !== conversationVersion) return;
              full += data.text;
              renderBot(botEl, full);
            }
          } catch (e) {
            if (!full) throw e;
          }
        }
      }

      if (requestVersion !== conversationVersion) return;
      if (!full) throw new Error("Empty response");
      messages.push({ role: "assistant", content: full });
    } catch (err) {
      if (err.name === "AbortError" || requestVersion !== conversationVersion) return;
      renderBot(
        botEl,
        "Sorry, I couldn't reach the assistant just now. Please call us at (248) 385-3432 or email contact@aaahandyman.services."
      );
    } finally {
      if (requestVersion === conversationVersion) {
        activeRequest = null;
        streaming = false;
        sendBtn.disabled = false;
        setPromptButtonsDisabled(false);
        input.focus();
      }
    }
  }
  launch.addEventListener("click", togglePanel);
  closeBtn.addEventListener("click", closePanel);

  newChatBtn.addEventListener("click", resetChat);

  emojiTrigger.addEventListener("click", function () {
    setEmojiBarOpen(emojiBar.hidden);
  });

  emojiBar.addEventListener("click", function (e) {
    var emojiButton = e.target.closest(".aaa-chat-emoji");
    if (!emojiButton) return;
    var emoji = emojiButton.getAttribute("data-emoji");
    var start = input.selectionStart;
    var end = input.selectionEnd;
    input.value = input.value.substring(0, start) + emoji + input.value.substring(end);
    autoGrow();
    input.focus();
    var newPosition = start + emoji.length;
    input.setSelectionRange(newPosition, newPosition);
  });

  promptList.addEventListener("click", function (e) {
    var promptButton = e.target.closest(".aaa-chat-prompt");
    if (!promptButton || streaming) return;
    input.value = "";
    autoGrow();
    setEmojiBarOpen(false);
    sendMessage(promptButton.getAttribute("data-question"));
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || streaming) return;
    input.value = "";
    autoGrow();
    setEmojiBarOpen(false);
    sendMessage(text);
  });

  input.addEventListener("input", autoGrow);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("aaa-open")) closePanel();
  });
  bubble.addEventListener("click", function (e) {
    var closeBtnClick = e.target.closest(".aaa-chat-bubble-close");
    if (closeBtnClick) {
      e.stopPropagation();
      bubble.classList.remove("aaa-show");
      clearTimeout(bubbleTimeout);
      return;
    }
    openPanel();
  });
  hideExistingFloating();
  window.addEventListener("load", hideExistingFloating);
  window.addEventListener("resize", hideExistingFloating);
  window.addEventListener("orientationchange", hideExistingFloating);
})();
