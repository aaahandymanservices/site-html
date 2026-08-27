(function () {
  var phoneInput = document.getElementById("emergency-phone");
  if (phoneInput) {
    phoneInput.addEventListener("input", function (t) {
      var e = t.target.value.replace(/\D/g, "");
      e.length > 10 && (e = e.substring(0, 10));
      var n = e.match(/^(\d{1,3})(\d{0,3})(\d{0,4})$/);
      if (n) {
        var a = "";
        n[1] && (a += "(" + n[1]), n[1].length === 3 && (a += ") "), n[2] && (a += n[2]), n[2].length === 3 && (a += "-"), n[3] && (a += n[3]), t.target.value = a;
      }
    });
  }

  var A = window.AAAPhotoUpload,
    I = 5,
    F = 1 * 1024 * 1024,
    _ = A.formatBytes,
    v = document.getElementById("emergency-photo-input"),
    u = document.getElementById("emergency-photo-dropzone"),
    P = document.getElementById("emergency-photo-empty"),
    k = document.getElementById("emergency-photo-previews"),
    C = document.getElementById("emergency-photo-error"),
    p = document.getElementById("emergency-photo-progress"),
    d = document.getElementById("emergency-photo-progress-bar"),
    l = document.getElementById("emergency-photo-progress-text");
  var f = [];

  var L = function (t) {
    if (C) {
      if (t) {
        C.textContent = t;
        C.classList.remove("hidden");
        v && v.setAttribute("aria-invalid", "true");
      } else {
        C.textContent = "";
        C.classList.add("hidden");
        v && v.removeAttribute("aria-invalid");
      }
    }
  };

  var B = function () {
    if (k) {
      k.innerHTML = "";
      if (f.length === 0) {
        k.classList.add("hidden");
        P && P.classList.remove("hidden");
        return;
      }
      P && P.classList.add("hidden");
      k.classList.remove("hidden");
      f.forEach(function (t, e) {
        var n = document.createElement("li");
        n.className = "relative group rounded-2xl overflow-hidden border border-blue-600 bg-blue-950";
        var a = document.createElement("img");
        a.alt = "Emergency photo " + (e + 1) + ": " + t.name;
        a.className = "aspect-square w-full object-cover";
        a.file = t;
        var previewUrl = A.previewUrl(t);
        if (previewUrl) a.src = previewUrl;
        n.appendChild(a);
        var o = document.createElement("div");
        o.className = "absolute inset-x-0 bottom-0 bg-gradient-to-t from-blue-950/95 to-transparent px-2 py-1.5 pt-3 text-left";
        var m = document.createElement("p");
        m.className = "truncate text-[11px] font-semibold text-white";
        m.textContent = t.name;
        var c = document.createElement("p");
        c.className = "text-[10px] text-blue-200";
        c.textContent = _(t.size);
        o.appendChild(m);
        o.appendChild(c);
        n.appendChild(o);
        var h = document.createElement("button");
        h.type = "button";
        h.className = "absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 text-white hover:bg-red-600 flex items-center justify-center text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400";
        h.setAttribute("aria-label", "Remove photo " + (e + 1));
        h.dataset.photoIndex = String(e);
        h.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
        n.appendChild(h);
        k.appendChild(n);
      });
    }
  };

  var O = function (t) {
    var e = Array.from(t || []);
    if (e.length === 0) return;
    var n = [], a = [];
    for (var m of e) {
      var c = A.rejectionFor(m);
      if (c) { n.push(c); continue; }
      a.push(m);
    }
    var o = I - f.length;
    if (o <= 0) {
      L("You can attach up to " + I + " photos. Remove one to add another.");
      B();
      return;
    }
    a.length > o && (a.splice(o), n.push("Only " + o + " more photo" + (o === 1 ? "" : "s") + " can be attached (max " + I + "). The rest were skipped."));
    f = f.concat(a);
    n.length ? L(n.join(" ")) : L("");
    B();
  };

  if (v && v.addEventListener("change", function (t) { O(t.target.files), t.target.value = ""; }), k && k.addEventListener("click", function (t) {
    var e = t.target.closest("button[data-photo-index]");
    if (!e) return;
    var n = Number.parseInt(e.dataset.photoIndex, 10);
    Number.isInteger(n) && n >= 0 && n < f.length && (f.splice(n, 1), L(""), B());
  }), u) {
    u.addEventListener("click", function (e) { e.target !== v && v && v.click(); });
    u.addEventListener("keydown", function (e) { (e.key === "Enter" || e.key === " ") && (e.preventDefault(), v && v.click()); });
    var t = 0;
    u.addEventListener("dragenter", function (e) { e.preventDefault(), t += 1, u.classList.add("border-red-400", "bg-blue-900/40"); });
    u.addEventListener("dragover", function (e) { e.preventDefault(), e.dataTransfer && (e.dataTransfer.dropEffect = "copy"); });
    u.addEventListener("dragleave", function (e) { e.preventDefault(), t -= 1, t <= 0 && (t = 0, u.classList.remove("border-red-400", "bg-blue-900/40")); });
    u.addEventListener("drop", function (e) {
      e.preventDefault(), t = 0, u.classList.remove("border-red-400", "bg-blue-900/40"), e.dataTransfer && e.dataTransfer.files && O(e.dataTransfer.files);
    });
    ["dragover", "drop"].forEach(function (e) {
      window.addEventListener(e, function (n) { (n.target === u || u && u.contains(n.target)) || n.preventDefault(); });
    });
  }

  var q = function () { f = [], L(""), B(), p && p.classList.add("hidden"), d && (d.style.width = "0%"), l && (l.textContent = ""); };
  var S = document.getElementById("emergency-contact-form");

  if (S) {
    var t = S.querySelector('button[type="submit"]'),
      e = document.getElementById("emergency-form-status"),
      n = { error: "border-red-400 bg-red-950 text-red-100", success: "border-emerald-400 bg-emerald-950 text-emerald-50" },
      a = Object.values(n).join(" ").split(" "),
      o = function (r, s) {
        if (e) {
          e.classList.remove.apply(e.classList, a);
          if (!r) { e.textContent = "", e.classList.add("hidden"); return; }
          e.textContent = r;
          e.classList.add.apply(e.classList, n[s].split(" "));
          e.classList.remove("hidden");
        }
      },
      m = function (r) { return r.replace(/\D/g, ""); },
      c = [
        { id: "emergency-name", label: "Your name", validate: function (r) { return r.length >= 2 ? "" : "Please enter your full name."; } },
        { id: "emergency-phone", label: "Your phone number", validate: function (r) { var s = m(r); return s ? s.length === 10 || s.length === 11 && s[0] === "1" ? "" : "Please enter a 10-digit phone number, e.g. (248) 555-0123." : "Please enter a phone number we can reach you on."; } },
        { id: "emergency-email", label: "Your email address", validate: function (r) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r) ? "" : "Please enter an email address we can reply to, e.g. you@example.com."; } },
        { id: "emergency-address", label: "Your address or city", validate: function (r) { return r.length >= 4 ? "" : "Please share your address or city so we can confirm we serve your area."; } },
        { id: "emergency-message", label: "A brief description of the emergency", validate: function (r) { return r.length >= 10 ? "" : "Please tell us a little about the emergency — at least a sentence."; } }
      ],
      h = function (r, s) {
        var g = document.getElementById(r.id), y = document.getElementById(r.id + "-error");
        g && (s ? (g.setAttribute("aria-invalid", "true"), y && (y.textContent = s, y.classList.remove("hidden"))) : (g.removeAttribute("aria-invalid"), y && (y.textContent = "", y.classList.add("hidden"))));
      },
      $ = function (r) {
        var s = document.getElementById(r.id);
        if (!s) return "";
        var g = r.validate(s.value.trim());
        return h(r, g), g;
      };

    c.forEach(function (r) {
      var s = document.getElementById(r.id);
      if (s) {
        s.addEventListener("blur", function () { $(r); });
        var g = s.tagName === "SELECT" ? "change" : "input";
        s.addEventListener(g, function () { s.getAttribute("aria-invalid") === "true" && $(r); });
      }
    });

    S.addEventListener("submit", async function (r) {
      r.preventDefault();
      if (t && t.disabled) return;
      var s = c.filter(function (i) { return $(i); });
      if (s.length) {
        o(s.length === 1 ? s[0].label + " needs your attention before we can send this." : s.length + " fields need your attention before we can send this.", "error");
        var i = document.getElementById(s[0].id);
        i && (i.focus(), i.scrollIntoView({ block: "center", behavior: "smooth" }));
        return;
      }
      o("");
      t && (t.disabled = !0, t.classList.add("opacity-70", "cursor-not-allowed"));

      var g = f;
      if (f.length) {
        p && l && (p.classList.remove("hidden"), d && (d.style.width = "0%"), l.textContent = "Preparing your photos…");
        try {
          g = [];
          for (var i of f) g.push(await A.prepare(i, F));
        } catch (i) {
          p && p.classList.add("hidden");
          L(i instanceof Error ? i.message : "One of your photos could not be prepared. Please try a different image.");
          t && (t.disabled = !1, t.classList.remove("opacity-70", "cursor-not-allowed"));
          return;
        }
      }

      var y = new FormData(S);
      y.delete("photo1");
      g.forEach(function (i, E) { y.append("photo" + (E + 1), i, i.name); });
      var R = f.length > 0;
      R && p && d && (p.classList.remove("hidden"), d.style.width = "0%", l && (l.textContent = "Sending your photos…"));

      var x = new XMLHttpRequest();
      x.open("POST", "/api/contact-quote");
      R && d && (x.upload.onprogress = function (E) {
        if (!E.lengthComputable) return;
        var w = Math.max(0, Math.min(100, E.loaded / E.total * 100));
        d.style.width = w + "%";
        l && w < 100 && (l.textContent = "Sending your photos… " + Math.round(w) + "%");
      }, x.upload.onload = function () { d && (d.style.width = "100%"), l && (l.textContent = "Finalizing your request…"); });
      x.onload = function () {
        var E = x.status >= 200 && x.status < 300, w = "";
        if (!E) try { w = JSON.parse(x.responseText || "{}").error || ""; } catch { w = ""; }
        E ? (o("Thank you! Your emergency request is on its way. For the fastest response, please also call (248) 385-3432.", "success"), S.reset(), c.forEach(function (z) { h(z, ""); }), q()) : (o(w || "Sorry — your request didn't go through. Please call us right away at (248) 385-3432 and we'll help immediately.", "error"), p && p.classList.add("hidden"), d && (d.style.width = "0%"), l && (l.textContent = ""));
      };
      x.onerror = function () {
        o("Sorry — your request didn't go through. Please call us right away at (248) 385-3432 and we'll help immediately.", "error");
        p && p.classList.add("hidden");
        d && (d.style.width = "0%");
        l && (l.textContent = "");
      };
      x.onloadend = function () { t && (t.disabled = !1, t.classList.remove("opacity-70", "cursor-not-allowed")); };
      x.send(y);
    });
  }
})();