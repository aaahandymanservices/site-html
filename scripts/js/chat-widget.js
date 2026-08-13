(function () {
  "use strict";
  if (window.__aaaChatWidgetLoaded) return;
  window.__aaaChatWidgetLoaded = true;

  var NAVY = "#1B2A4A";
  var CRIMSON = "#A61F2E";
  var messages = [];
  var streaming = false;
  var activeRequest = null;
  var conversationVersion = 0;
  var style = document.createElement("style");
  style.textContent = [
    ".aaa-fab{position:fixed;bottom:20px;right:20px;z-index:40;display:flex;flex-direction:column;gap:12px;align-items:flex-end}",
    ".aaa-fab .aaa-fab-btn{min-width:130px;height:56px;padding:0 22px;border-radius:9999px;border:2px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;gap:10px;box-sizing:border-box;font:700 15px/1 'Archivo','Roboto',system-ui,-apple-system,sans-serif;white-space:nowrap;color:#ffffff;cursor:pointer;text-decoration:none;box-shadow:0 12px 28px -5px rgba(15,23,42,0.3);transition:transform .2s cubic-bezier(.16,1,.3,1),background .2s ease,box-shadow .2s ease;will-change:transform}",
    ".aaa-fab .aaa-fab-btn i{font-size:19px;line-height:1;flex-shrink:0}",
    ".aaa-fab .aaa-fab-btn:hover{transform:translateY(-3px) scale(1.04)}",
    ".aaa-fab .aaa-fab-btn:focus-visible{outline:3px solid #9fb1ca;outline-offset:2px}",
    ".aaa-fab .aaa-chat-launch:focus,.aaa-fab .aaa-chat-launch:focus-visible{outline:none !important;box-shadow:0 0 0 4px " + CRIMSON + " !important}",
    ".aaa-chat-launch{background:linear-gradient(135deg, #c62839, #a61f2e 60%, #781925);box-shadow:0 12px 28px -4px rgba(166,31,46,0.45)}",
    ".aaa-chat-launch:hover{background:linear-gradient(135deg, #d32f2f, #a61f2e);box-shadow:0 16px 32px -4px rgba(166,31,46,0.55)}",
    ".aaa-call{background:linear-gradient(135deg, #10b981, #059669);box-shadow:0 12px 28px -4px rgba(16,185,129,0.4)}",
    ".aaa-call:hover{background:linear-gradient(135deg, #059669, #047857);box-shadow:0 16px 32px -4px rgba(16,185,129,0.5)}",
    ".aaa-chat-panel{position:fixed;bottom:92px;right:20px;z-index:2147483000;width:390px;max-width:calc(100vw - 32px);height:590px;max-height:calc(100vh - 120px);background:#ffffff;border:1px solid rgba(203,213,225,0.9);box-shadow:0 25px 50px -12px rgba(15,23,42,0.35),0 0 20px rgba(0,0,0,0.06);border-radius:24px;display:none;flex-direction:column;overflow:hidden;font-family:'Roboto','Archivo',system-ui,-apple-system,sans-serif}",
    ".aaa-chat-panel.aaa-open{display:flex;animation:aaa-pop .22s cubic-bezier(.16,1,.3,1)}",
    "@keyframes aaa-pop{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}",
    ".aaa-chat-header{background:#0f172a;color:#ffffff;padding:16px 18px;display:flex;align-items:center;gap:12px;border-bottom:3px solid " + CRIMSON + ";box-shadow:0 4px 12px rgba(0,0,0,0.15)}",
    ".aaa-chat-header .aaa-avatar{width:44px;height:42px;border-radius:9999px;background:" + CRIMSON + ";display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;border:2px solid rgba(255,255,255,.95);box-shadow:0 2px 10px rgba(0,0,0,.3)}",
    ".aaa-chat-header .aaa-avatar img{width:100%;height:100%;display:block;object-fit:cover}",
    ".aaa-chat-header h2{margin:0;font-family:'Archivo','Roboto',system-ui,-apple-system,sans-serif;font-size:15px;font-weight:800;line-height:1.2;color:#ffffff;letter-spacing:-0.01em}",
    ".aaa-chat-header p{margin:3px 0 0;font-size:12px;color:#cbd5e1;line-height:1.2;display:flex;align-items:center;gap:4px}",
    ".aaa-chat-header p::before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981}",
    ".aaa-chat-header-actions{margin-left:auto;display:flex;align-items:center;gap:6px}",
    ".aaa-chat-control-btn{background:none;border:none;color:#ffffff;font-size:16px;cursor:pointer;opacity:.85;padding:6px;line-height:1;display:flex;align-items:center;justify-content:center;border-radius:10px;transition:opacity .15s,background-color .15s,color .15s}",
    ".aaa-chat-control-btn:hover{opacity:1;background-color:rgba(255,255,255,0.18);color:#ffffff}",
    ".aaa-chat-control-btn:focus:not(:focus-visible),.aaa-chat-control-btn:active{outline:none !important;box-shadow:none !important}",
    ".aaa-chat-control-btn:focus-visible{outline:none !important;box-shadow:0 0 0 2px " + CRIMSON + " !important}",
    ".aaa-chat-close:focus:not(:focus-visible),.aaa-chat-close:active{outline:none !important;box-shadow:none !important}",
    ".aaa-chat-control-btn svg,.aaa-chat-emoji-trigger svg{width:18px;height:18px;display:block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    ".aaa-chat-close{font-size:22px;font-weight:400}",
    ".aaa-chat-log{flex:1;overflow-y:auto;padding:16px 18px;background:#f8fafc;display:flex;flex-direction:column;gap:12px}",
    ".aaa-chat-log::-webkit-scrollbar{width:6px}",
    ".aaa-chat-log::-webkit-scrollbar-track{background:transparent}",
    ".aaa-chat-log::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}",
    ".aaa-chat-log::-webkit-scrollbar-thumb:hover{background:" + CRIMSON + "}",
    ".aaa-msg-row{display:flex;align-items:flex-end;gap:8px;max-width:88%}",
    ".aaa-msg-row.aaa-user-row{align-self:flex-end;justify-content:flex-end}",
    ".aaa-msg-row.aaa-bot-row{align-self:flex-start}",
    ".aaa-msg-avatar{width:28px;height:28px;border-radius:9999px;object-fit:cover;flex:0 0 28px;border:1.5px solid " + CRIMSON + ";box-shadow:0 2px 4px rgba(15,23,42,.1)}",
    ".aaa-msg{max-width:100%;padding:11px 15px;border-radius:18px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}",
    ".aaa-msg.aaa-user{background:linear-gradient(135deg, #c62839, #a61f2e);color:#ffffff;border-bottom-right-radius:4px;box-shadow:0 3px 10px rgba(166,31,46,.25);font-weight:500}",
    ".aaa-msg.aaa-bot{background:#ffffff;color:#0f172a;border:1px solid #e2e8f0;border-bottom-left-radius:4px;box-shadow:0 2px 8px rgba(15,23,42,.06)}",
    ".aaa-msg.aaa-bot a{color:" + CRIMSON + ";font-weight:700;text-decoration:underline}",
    ".aaa-typing{display:inline-flex;gap:4px;align-items:center;padding:4px 2px}",
    ".aaa-typing span{width:7px;height:7px;border-radius:9999px;background:" + CRIMSON + ";animation:aaa-blink 1.2s infinite ease-in-out}",
    ".aaa-typing span:nth-child(2){animation-delay:.2s}.aaa-typing span:nth-child(3){animation-delay:.4s}",
    "@keyframes aaa-blink{0%,80%,100%{opacity:.3}40%{opacity:1}}",
    ".aaa-chat-prompts{padding:10px 14px 8px;background:#ffffff;border-top:1px solid #e2e8f0}",
    ".aaa-chat-prompts-label{margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b}",
    ".aaa-chat-prompts-list{display:flex;gap:6px;overflow-x:auto;padding:2px 1px 4px;scrollbar-width:none}",
    ".aaa-chat-prompts-list::-webkit-scrollbar{display:none}",
    ".aaa-chat-prompt{flex:0 0 auto;max-width:230px;border:1px solid #cbd5e1;border-radius:9999px;background:#f8fafc;color:#0f172a;padding:7px 13px;font:600 12px/1.2 'Roboto',system-ui,-apple-system,sans-serif;cursor:pointer;white-space:nowrap;transition:all .18s ease}",
    ".aaa-chat-prompt:hover:not(:disabled){background:#0f172a;color:#ffffff;border-color:#0f172a;transform:translateY(-1px);box-shadow:0 3px 8px rgba(15,23,42,.2)}",
    ".aaa-chat-prompt:focus-visible{outline:none;box-shadow:0 0 0 2px " + CRIMSON + "}",
    ".aaa-chat-prompt:disabled{opacity:.45;cursor:not-allowed}",
    ".aaa-chat-emoji-bar{display:flex;gap:6px;padding:8px 12px;background:#f1f5f9;border-top:1px solid #e2e8f0;align-items:center;overflow-x:auto;scrollbar-width:none}",
    ".aaa-chat-emoji-bar[hidden]{display:none}",
    ".aaa-chat-emoji-bar::-webkit-scrollbar{display:none}",
    ".aaa-chat-emoji{flex:0 0 auto;width:34px;height:34px;border:1px solid #cbd5e1;border-radius:10px;background:#ffffff;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s ease}",
    ".aaa-chat-emoji:hover{background:#ffffff;border-color:" + CRIMSON + ";transform:translateY(-2px);box-shadow:0 2px 6px rgba(166,31,46,.2)}",
    ".aaa-chat-emoji:focus-visible{outline:none;box-shadow:0 0 0 2px " + CRIMSON + "}",
    ".aaa-chat-form{border-top:1px solid #e2e8f0;padding:12px 14px;display:flex;gap:8px;align-items:flex-end;background:#ffffff}",
    ".aaa-chat-form textarea{flex:1;resize:none;background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:10px 12px;font-family:inherit;font-size:14px;line-height:1.4;max-height:120px;color:#0f172a;transition:border-color .15s ease,box-shadow .15s ease,background-color .15s ease}",
    ".aaa-chat-form textarea::placeholder{color:#94a3b8}",
    ".aaa-chat-form textarea:focus{outline:none;background:#ffffff;border-color:" + CRIMSON + ";box-shadow:0 0 0 3px rgba(166,31,46,0.2)}",
    ".aaa-chat-emoji-trigger{flex-shrink:0;width:42px;height:42px;border-radius:14px;border:2px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s ease}",
    ".aaa-chat-emoji-trigger:hover,.aaa-chat-emoji-trigger[aria-expanded='true']{background:#f1f5f9;color:" + CRIMSON + ";border-color:#cbd5e1}",
    ".aaa-chat-emoji-trigger:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(166,31,46,0.2);border-color:" + CRIMSON + "}",
    ".aaa-chat-send{flex-shrink:0;width:42px;height:42px;border-radius:14px;border:none;background:linear-gradient(135deg, #c62839, #a61f2e);color:#ffffff;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background-color .15s ease,transform .15s ease,box-shadow .15s ease;box-shadow:0 3px 8px rgba(166,31,46,.3)}",
    ".aaa-chat-send:hover:not(:disabled){background:linear-gradient(135deg, #d32f2f, #a61f2e);transform:scale(1.05)}",
    ".aaa-chat-send:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(166,31,46,0.35)}",
    ".aaa-chat-send:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}",
    ".aaa-chat-disclaimer{font-size:10px;color:#64748b;text-align:center;padding:0 12px 10px;background:#ffffff;line-height:1.3}",
    ".aaa-chat-estimator{padding:10px 14px 6px;background:#f8fafc;border-top:1px solid #e2e8f0}",
    ".aaa-chat-estimator-label{margin:0 0 6px;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:" + CRIMSON + ";display:flex;align-items:center;gap:4px}",
    ".aaa-chat-estimator-list{display:flex;gap:6px;overflow-x:auto;padding:2px 1px 4px;scrollbar-width:none}",
    ".aaa-chat-estimator-list::-webkit-scrollbar{display:none}",
    ".aaa-estimator-pill{flex:0 0 auto;border:1px solid #cbd5e1;border-radius:9999px;background:#ffffff;color:#0f172a;padding:6px 12px;font:700 12px/1.2 'Roboto',system-ui,sans-serif;cursor:pointer;white-space:nowrap;transition:all .18s ease;box-shadow:0 1px 3px rgba(0,0,0,0.05)}",
    ".aaa-estimator-pill:hover:not(:disabled){background:" + CRIMSON + ";color:#ffffff;border-color:" + CRIMSON + ";transform:translateY(-1px);box-shadow:0 3px 8px rgba(166,31,46,0.3)}",
    ".aaa-chat-photo-callout{font-size:11px;font-weight:600;color:#047857;background:#ecfdf5;border-top:1px solid #a7f3d0;padding:6px 12px;display:flex;align-items:center;gap:6px;cursor:pointer}",
    ".aaa-chat-photo-callout:hover{background:#d1fae5}",
    ".aaa-chat-photo-trigger{flex-shrink:0;width:42px;height:42px;border-radius:14px;border:2px solid #e2e8f0;background:#f8fafc;color:#059669;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s ease}",
    ".aaa-chat-photo-trigger:hover,.aaa-chat-photo-trigger[aria-expanded='true']{background:#ecfdf5;color:#047857;border-color:#10b981}",
    ".aaa-chat-photo-trigger:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(16,185,129,0.2);border-color:#10b981}",
    ".aaa-chat-photo-preview-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f0fdf4;border-top:1px solid #bbf7d0}",
    ".aaa-chat-photo-preview-bar[hidden]{display:none}",
    ".aaa-chat-photo-thumb{width:36px;height:36px;border-radius:8px;object-fit:cover;border:1px solid #86efac;flex-shrink:0}",
    ".aaa-chat-photo-name{font-size:12px;font-weight:600;color:#166534;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".aaa-chat-photo-remove{background:none;border:none;color:#dc2626;font-size:18px;cursor:pointer;font-weight:bold;padding:2px 6px;line-height:1}",
    ".aaa-msg-photo{max-width:100%;max-height:180px;border-radius:12px;margin-top:6px;display:block;border:1.5px solid rgba(255,255,255,0.6);object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,0.15)}",
    ".aaa-chat-action-bar{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0}",
    ".aaa-action-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:10px;font-size:12px;font-weight:700;text-decoration:none!important;cursor:pointer;transition:all .15s ease;border:none}",
    ".aaa-action-book{background:" + CRIMSON + ";color:#ffffff!important;box-shadow:0 2px 6px rgba(166,31,46,0.3)}",
    ".aaa-action-book:hover{background:#d32f2f;transform:translateY(-1px)}",
    ".aaa-action-call{background:#059669;color:#ffffff!important;box-shadow:0 2px 6px rgba(5,150,105,0.3)}",
    ".aaa-action-call:hover{background:#047857;transform:translateY(-1px)}",
    ".dark .aaa-chat-estimator{background:#0f172a;border-top-color:#1e293b}",
    ".dark .aaa-estimator-pill{background:#1e293b;color:#f8fafc;border-color:#334155}",
    ".dark .aaa-estimator-pill:hover:not(:disabled){background:" + CRIMSON + ";border-color:" + CRIMSON + ";color:#ffffff}",
    ".dark .aaa-chat-photo-callout{background:#064e3b;color:#a7f3d0;border-color:#047857}",
    ".dark .aaa-chat-photo-trigger{background:#1e293b;border-color:#334155;color:#34d399}",
    ".dark .aaa-chat-photo-trigger:hover{background:#064e3b;color:#ffffff;border-color:#10b981}",
    ".dark .aaa-chat-photo-preview-bar{background:#064e3b;border-top-color:#047857}",
    ".dark .aaa-chat-photo-name{color:#a7f3d0}",
    ".dark .aaa-chat-action-bar{border-top-color:#334155}",
    ".dark .aaa-chat-panel{background:#0f172a;border-color:#1e293b;box-shadow:0 20px 50px rgba(0,0,0,0.6)}",
    ".dark .aaa-chat-header{background:#0f172a;border-bottom-color:" + CRIMSON + "}",
    ".dark .aaa-chat-header h2{color:#ffffff}",
    ".dark .aaa-chat-header p{color:#94a3b8}",
    ".dark .aaa-chat-log{background:#020817}",
    ".dark .aaa-msg.aaa-bot{background:#1e293b;color:#f8fafc;border-color:#334155}",
    ".dark .aaa-msg.aaa-bot a{color:#f87171}",
    ".dark .aaa-msg.aaa-user{background:" + CRIMSON + ";color:#ffffff}",
    ".dark .aaa-msg-avatar{border-color:" + CRIMSON + "}",
    ".dark .aaa-typing span{background:" + CRIMSON + "}",
    ".dark .aaa-chat-prompts{background:#0f172a;border-top-color:#1e293b}",
    ".dark .aaa-chat-prompts-label{color:#94a3b8}",
    ".dark .aaa-chat-prompt{background:#1e293b;color:#f8fafc;border-color:#334155}",
    ".dark .aaa-chat-prompt:hover:not(:disabled){background:" + CRIMSON + ";border-color:" + CRIMSON + ";color:#ffffff}",
    ".dark .aaa-chat-emoji-bar{background:#0f172a;border-top-color:#1e293b}",
    ".dark .aaa-chat-emoji{background:#1e293b;border-color:#334155}",
    ".dark .aaa-chat-emoji:hover{background:" + CRIMSON + ";border-color:" + CRIMSON + "}",
    ".dark .aaa-chat-form{background:#0f172a;border-top-color:#1e293b}",
    ".dark .aaa-chat-form textarea{background:#020817;color:#ffffff;border-color:#334155}",
    ".dark .aaa-chat-form textarea:focus{background:#020817;border-color:" + CRIMSON + ";box-shadow:0 0 0 3px rgba(166,31,46,0.35)}",
    ".dark .aaa-chat-emoji-trigger{background:#1e293b;border-color:#334155;color:#cbd5e1}",
    ".dark .aaa-chat-emoji-trigger:hover,.dark .aaa-chat-emoji-trigger[aria-expanded='true']{background:" + CRIMSON + ";color:#ffffff;border-color:" + CRIMSON + "}",
    ".dark .aaa-chat-disclaimer{background:#0f172a;color:#94a3b8}",
    ".dark .aaa-chat-log::-webkit-scrollbar-thumb{background:#334155}",
    ".dark .aaa-chat-log::-webkit-scrollbar-thumb:hover{background:" + CRIMSON + "}",
    "@media(max-width:767px){.aaa-fab{right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));flex-direction:column;gap:12px;align-items:flex-end}.aaa-fab .aaa-fab-btn{min-width:0;width:54px;height:54px;padding:0;border-radius:50%;gap:0;flex:0 0 54px}.aaa-fab .aaa-fab-btn i{font-size:21px;line-height:1}.aaa-fab .aaa-fab-label{display:none!important}.aaa-fab-btn.aaa-chat-launch,.aaa-fab-btn.aaa-call{display:flex!important}.aaa-chat-panel{position:fixed;top:0;left:0;right:0;bottom:0;width:100%!important;max-width:100%!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important;border:none!important;z-index:2147483005}.aaa-chat-header{padding:calc(16px + env(safe-area-inset-top,0px)) 18px 16px!important}.aaa-chat-disclaimer{padding:0 12px calc(10px + env(safe-area-inset-bottom,0px))!important}}",
    "@media(max-width:359px){.aaa-fab .aaa-fab-btn{width:50px;height:50px;flex-basis:50px}.aaa-fab{gap:10px}}"
  ].join("");
  document.head.appendChild(style);
  var group = document.createElement("div");
  group.className = "aaa-fab";

  var launch = document.createElement("button");
  launch.type = "button";
  launch.className = "aaa-fab-btn aaa-chat-launch";
  launch.setAttribute("aria-label", "Open chat with AAA Handyman Services LLC");
  launch.setAttribute("aria-expanded", "false");
  launch.setAttribute("aria-controls", "aaa-chat-panel");
  launch.innerHTML = '<i class="fas fa-comments" aria-hidden="true"></i><span class="aaa-fab-label">AI Chat</span>';

  var callBtn = document.createElement("a");
  callBtn.className = "aaa-fab-btn aaa-call";
  callBtn.href = "tel:+12483853432";
  callBtn.title = "Call AAA Handyman Services LLC";
  callBtn.setAttribute("aria-label", "Call AAA Handyman Services LLC at (248) 385-3432");
  callBtn.innerHTML = '<i class="fas fa-phone" aria-hidden="true"></i><span class="aaa-fab-label">Call Now!</span>';

  group.appendChild(launch);
  group.appendChild(callBtn);

  var panel = document.createElement("div");
  panel.className = "aaa-chat-panel";
  panel.id = "aaa-chat-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chat with AAA Handyman Services LLC");
  panel.innerHTML =
    '<div class="aaa-chat-header">' +
      '<div class="aaa-avatar"><img src="/logo-circular.png?v=20260805-1" alt="" aria-hidden="true"></div>' +
      '<div><h2>AAA Handyman Services LLC</h2><p>Interactive Estimator &amp; AI Chat</p></div>' +
      '<div class="aaa-chat-header-actions">' +
        '<button type="button" class="aaa-chat-control-btn aaa-chat-new" title="Refresh chat" aria-label="Refresh chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/></svg></button>' +
        '<button type="button" class="aaa-chat-control-btn aaa-chat-close" title="Close chat" aria-label="Close chat">&times;</button>' +
      '</div>' +
    '</div>' +
    '<div class="aaa-chat-log" id="aaa-chat-log" role="log" aria-live="polite"></div>' +
    '<div class="aaa-chat-estimator" aria-label="Interactive Estimator Categories">' +
      '<p class="aaa-chat-estimator-label"><i class="fas fa-calculator" aria-hidden="true"></i> Guided Estimator Categories</p>' +
      '<div class="aaa-chat-estimator-list" id="aaa-chat-estimator-list">' +
        '<button type="button" class="aaa-estimator-pill" data-question="How much does TV Wall Mounting cost?">📺 TV Mounting ($170+)</button>' +
        '<button type="button" class="aaa-estimator-pill" data-question="How much does a Faucet Swap cost?">🚰 Faucet Swap ($135+)</button>' +
        '<button type="button" class="aaa-estimator-pill" data-question="How much to install a Ceiling Fan or Light Fixture?">💡 Ceiling Fan ($170+)</button>' +
        '<button type="button" class="aaa-estimator-pill" data-question="How much to replace a Garbage Disposal?">🗑️ Disposal ($170+)</button>' +
        '<button type="button" class="aaa-estimator-pill" data-question="How much to install a Smart Lock or Deadbolt?">🚪 Smart Lock ($135+)</button>' +
        '<button type="button" class="aaa-estimator-pill" data-question="How much for Dryer Vent Cleaning?">🧹 Dryer Vent ($135+)</button>' +
        '<button type="button" class="aaa-estimator-pill" data-question="How much for Gutter Cleaning?">🏠 Gutter Clean ($135+)</button>' +
      '</div>' +
    '</div>' +
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
    '<div class="aaa-chat-photo-preview-bar" id="aaa-chat-photo-preview-bar" hidden>' +
      '<img class="aaa-chat-photo-thumb" id="aaa-chat-photo-thumb" alt="Repair photo preview">' +
      '<span class="aaa-chat-photo-name" id="aaa-chat-photo-name"></span>' +
      '<button type="button" class="aaa-chat-photo-remove" id="aaa-chat-photo-remove" title="Remove photo" aria-label="Remove photo">&times;</button>' +
    '</div>' +
    '<div class="aaa-chat-photo-callout" id="aaa-chat-photo-callout" role="button" tabindex="0" title="Click to upload repair photo"><i class="fas fa-camera" aria-hidden="true"></i> <span><strong>Snap a quick photo!</strong> Upload a repair photo for Victor&rsquo;s feedback.</span></div>' +
    '<form class="aaa-chat-form" id="aaa-chat-form">' +
      '<button type="button" class="aaa-chat-photo-trigger" id="aaa-chat-photo-trigger" title="Attach a repair photo" aria-label="Attach a repair photo"><i class="fas fa-camera" aria-hidden="true"></i></button>' +
      '<input type="file" id="aaa-chat-photo-input" accept="image/jpeg,image/png,image/webp" capture="environment" style="display:none">' +
      '<button type="button" class="aaa-chat-emoji-trigger" id="aaa-chat-emoji-trigger" title="Add an emoji" aria-label="Add an emoji" aria-expanded="false" aria-controls="aaa-chat-emoji-bar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg></button>' +
      '<textarea id="aaa-chat-input" rows="1" placeholder="Type question or pick a category…" aria-label="Your message"></textarea>' +
      '<button type="submit" class="aaa-chat-send" id="aaa-chat-send" aria-label="Send message"><i class="fas fa-paper-plane" aria-hidden="true"></i></button>' +
    '</form>' +
    '<div class="aaa-chat-disclaimer">Automated assistant &amp; estimator. For direct booking or calls: (248) 385-3432.</div>';

  document.body.appendChild(group);
  document.body.appendChild(panel);

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
  var estimatorList = panel.querySelector("#aaa-chat-estimator-list");
  var photoTrigger = panel.querySelector("#aaa-chat-photo-trigger");
  var photoInput = panel.querySelector("#aaa-chat-photo-input");
  var photoCallout = panel.querySelector("#aaa-chat-photo-callout");
  var photoPreviewBar = panel.querySelector("#aaa-chat-photo-preview-bar");
  var photoThumb = panel.querySelector("#aaa-chat-photo-thumb");
  var photoName = panel.querySelector("#aaa-chat-photo-name");
  var photoRemove = panel.querySelector("#aaa-chat-photo-remove");

  var attachedPhoto = null; // { data: base64Data, mimeType: fileType, previewUrl: blobUrl, fileName: name }

  var GREETING = "Hi! 👋 I'm the AAA Handyman Services LLC Virtual Assistant & Interactive Estimator. Select a category above (like TV Mounting or Faucet Swap), upload a quick photo of your repair, or ask me any question!";
  function hideExistingFloating() {
    // Hide static (noscript) floating "Call Now" CTAs baked into the markup.
    var els = document.querySelectorAll(".fixed.bottom-5.right-5, [class*='fixed'][class*='bottom-5'][class*='right-5']");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el === group || el === panel || group.contains(el) || panel.contains(el)) continue;
      el.style.setProperty("display", "none", "important");
    }
    // Remove any other floating action-button group (e.g. the lightweight
    // chat-loader FAB) so only this widget's Call Now + Chat buttons remain.
    // This makes the widget the single source of truth and guarantees the
    // page never shows two CTAs of the same function at once.
    var fabs = document.querySelectorAll(".aaa-fab");
    for (var j = 0; j < fabs.length; j++) {
      if (fabs[j] !== group && fabs[j].parentNode) fabs[j].parentNode.removeChild(fabs[j]);
    }
    var loaderStyle = document.getElementById("aaa-chat-loader-style");
    if (loaderStyle && loaderStyle.parentNode) loaderStyle.parentNode.removeChild(loaderStyle);
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

    if (text.indexOf("Schedule") !== -1 || text.indexOf("book") !== -1 || text.indexOf("Estimate") !== -1 || text.indexOf("call") !== -1 || text.indexOf("(248) 385-3432") !== -1) {
      if (!el.querySelector(".aaa-chat-action-bar")) {
        var actionDiv = document.createElement("div");
        actionDiv.className = "aaa-chat-action-bar";
        actionDiv.innerHTML =
          '<button type="button" class="aaa-action-btn aaa-action-book" onclick="if(window.AAABookingWidget){window.AAABookingWidget.open();}else{window.location.href=\'/book.html\';}"><i class="fas fa-calendar-check" aria-hidden="true"></i> Book / Schedule Call</button>' +
          '<a href="tel:+12483853432" class="aaa-action-btn aaa-action-call"><i class="fas fa-phone" aria-hidden="true"></i> Call (248) 385-3432</a>';
        el.appendChild(actionDiv);
      }
    }
    scrollToBottom();
  }

  function addMessage(role, text, photoUrl) {
    var row = document.createElement("div");
    row.className = "aaa-msg-row " + (role === "user" ? "aaa-user-row" : "aaa-bot-row");

    if (role !== "user") {
      var avatar = document.createElement("img");
      avatar.className = "aaa-msg-avatar";
      avatar.src = "/logo-circular.png?v=20260805-1";
      avatar.alt = "AAA Handyman Services LLC";
      row.appendChild(avatar);
    }

    var el = document.createElement("div");
    el.className = "aaa-msg " + (role === "user" ? "aaa-user" : "aaa-bot");
    if (text) {
      var txtSpan = document.createElement("span");
      txtSpan.textContent = text;
      el.appendChild(txtSpan);
    }
    if (photoUrl) {
      var imgEl = document.createElement("img");
      imgEl.className = "aaa-msg-photo";
      imgEl.src = photoUrl;
      imgEl.alt = "Uploaded repair photo";
      el.appendChild(imgEl);
    }
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
    var estBtns = estimatorList.querySelectorAll(".aaa-estimator-pill");
    for (var j = 0; j < estBtns.length; j++) {
      estBtns[j].disabled = isDisabled;
    }
  }

  function processPhotoFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || !file.type.startsWith("image/")) {
        reject("Invalid image file");
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement("canvas");
          var maxDim = 1200;
          var w = img.width;
          var h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          var mimeType = "image/jpeg";
          var base64 = canvas.toDataURL(mimeType, 0.85);
          resolve({
            data: base64,
            mimeType: mimeType,
            previewUrl: base64,
            fileName: file.name
          });
        };
        img.onerror = function () { reject("Failed to load image"); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject("Failed to read file"); };
      reader.readAsDataURL(file);
    });
  }

  function clearAttachedPhoto() {
    attachedPhoto = null;
    photoInput.value = "";
    photoPreviewBar.hidden = true;
    photoThumb.src = "";
    photoName.textContent = "";
  }

  function resetChat() {
    conversationVersion += 1;
    if (activeRequest) activeRequest.abort();
    activeRequest = null;
    streaming = false;
    sendBtn.disabled = false;
    setPromptButtonsDisabled(false);
    clearAttachedPhoto();
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
    launch.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i><span class="aaa-fab-label">Close</span>';
    // The button toggles, so its name and state have to follow suit —
    // otherwise it keeps announcing "Open chat" while it actually closes.
    launch.setAttribute("aria-label", "Close chat with AAA Handyman Services LLC");
    launch.setAttribute("aria-expanded", "true");
    if (!opened) {
      opened = true;
      addMessage("assistant", GREETING);
    }
    if (window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    }
    setTimeout(function () { input.focus(); }, 50);
  }

  function closePanel() {
    panel.classList.remove("aaa-open");
    launch.innerHTML = '<i class="fas fa-comments" aria-hidden="true"></i><span class="aaa-fab-label">AI Chat</span>';
    launch.setAttribute("aria-label", "Open chat with AAA Handyman Services LLC");
    launch.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    // Focus was inside the panel that just disappeared; hand it back to the
    // launcher rather than letting it fall to the top of the document.
    if (panel.contains(document.activeElement)) launch.focus();
  }

  function togglePanel() {
    panel.classList.contains("aaa-open") ? closePanel() : openPanel();
  }

  // On phones the panel covers the entire viewport, so Tab has to cycle
  // within it; the launcher bookends the cycle so it stays reachable.
  panel.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || !panel.classList.contains("aaa-open")) return;
    var focusables = Array.prototype.filter.call(
      panel.querySelectorAll("a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled])"),
      function (el) { return el.offsetParent !== null || el === document.activeElement; }
    );
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      launch.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      launch.focus();
    }
  });
  async function sendMessage(text, photoObj) {
    if (streaming) return;
    streaming = true;
    sendBtn.disabled = true;
    setPromptButtonsDisabled(true);
    var requestVersion = conversationVersion;
    activeRequest = new AbortController();

    var currentPhoto = photoObj || attachedPhoto;
    clearAttachedPhoto();

    var userText = text || (currentPhoto ? "Here is a photo of my repair area." : "");
    addMessage("user", userText, currentPhoto ? currentPhoto.previewUrl : null);
    messages.push({ role: "user", content: userText });
    var botEl = addMessage("assistant", "");
    botEl.innerHTML = '<span class="aaa-typing"><span></span><span></span><span></span></span>';

    var reqBody = {
      messages: messages,
      page: window.location.pathname
    };
    if (currentPhoto) {
      reqBody.image = {
        data: currentPhoto.data,
        mimeType: currentPhoto.mimeType
      };
    }

    var full = "";
    try {
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
        signal: activeRequest.signal,
      });

      if (!res.ok) throw new Error("Request failed");

      var reader = null;
      if (res.body && typeof res.body.getReader === "function") {
        try {
          reader = res.body.getReader();
        } catch (e) {
          console.warn("getReader failed:", e);
        }
      }

      if (reader) {
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
      } else {
        var rawText = await res.text();
        var frames = rawText.split("\n\n");
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
            }
          } catch (e) {
            if (!full) throw e;
          }
        }
        if (full) {
          if (requestVersion !== conversationVersion) return;
          renderBot(botEl, full);
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

  if (estimatorList) {
    estimatorList.addEventListener("click", function (e) {
      var estBtn = e.target.closest(".aaa-estimator-pill");
      if (!estBtn || streaming) return;
      input.value = "";
      autoGrow();
      setEmojiBarOpen(false);
      sendMessage(estBtn.getAttribute("data-question"));
    });
  }

  if (photoTrigger) {
    photoTrigger.addEventListener("click", function () {
      if (photoInput) photoInput.click();
    });
  }

  if (photoCallout) {
    photoCallout.addEventListener("click", function () {
      if (photoInput) photoInput.click();
    });
    photoCallout.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && photoInput) {
        e.preventDefault();
        photoInput.click();
      }
    });
  }

  if (photoInput) {
    photoInput.addEventListener("change", async function () {
      var file = photoInput.files && photoInput.files[0];
      if (!file) return;
      try {
        var processed = await processPhotoFile(file);
        attachedPhoto = processed;
        photoThumb.src = processed.previewUrl;
        photoName.textContent = processed.fileName || "Repair photo";
        photoPreviewBar.hidden = false;
      } catch (err) {
        console.error("Photo processing error:", err);
      }
    });
  }

  if (photoRemove) {
    photoRemove.addEventListener("click", clearAttachedPhoto);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if ((!text && !attachedPhoto) || streaming) return;
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
  window.__aaaOpenChat = openPanel;
  window.__aaaCloseChat = closePanel;
  hideExistingFloating();
  window.addEventListener("load", hideExistingFloating);
  window.addEventListener("resize", hideExistingFloating);
  window.addEventListener("orientationchange", hideExistingFloating);
})();
