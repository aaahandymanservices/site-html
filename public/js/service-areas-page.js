(function () {
  "use strict";

  var PHONE = "(248) 385-3432";
  var PHONE_HREF = "tel:+12483853432";

  // ---- Zone data (mirrors /data/service-areas.json but inline for instant feedback) ----
  var ZONES = {
    A: { label: "Zone A", rate: "$100", blurb: "Includes travel + 1 hour labor" },
    B: { label: "Zone B", rate: "$145", blurb: "Includes extended travel + 1 hour labor" }
  };

  var CITIES = [
    { name: "Waterford", slug: "waterford", aliases: ["waterford township"], zips: ["48327","48328","48329","48340"], zone: "A" },
    { name: "Pontiac", slug: "pontiac", aliases: [], zips: ["48341","48342","48343"], zone: "A" },
    { name: "West Bloomfield", slug: "west-bloomfield", aliases: ["west bloomfield township"], zips: ["48322","48323","48324"], zone: "A" },
    { name: "Orchard Lake", slug: "orchard-lake", aliases: [], zips: ["48324"], zone: "A" },
    { name: "Bloomfield Hills", slug: "bloomfield-hills", aliases: [], zips: ["48301","48302","48304"], zone: "A" },
    { name: "White Lake", slug: "white-lake", aliases: [], zips: ["48327","48383","48386"], zone: "A" },
    { name: "Commerce Township", slug: "commerce-township", aliases: ["commerce"], zips: ["48327","48328","48382","48390"], zone: "A" },
    { name: "Walled Lake", slug: "walled-lake", aliases: [], zips: ["48390","48391"], zone: "A" },
    { name: "Wixom", slug: "wixom", aliases: [], zips: ["48393"], zone: "A" },
    { name: "Union Lake", slug: "union-lake", aliases: [], zips: ["48387"], zone: "A" },
    { name: "Davisburg", slug: "davisburg", aliases: [], zips: ["48350"], zone: "A" },
    { name: "Clarkston", slug: "clarkston", aliases: ["independence township"], zips: ["48346","48347","48348"], zone: "A" },
    { name: "Auburn Hills", slug: "auburn-hills", aliases: [], zips: ["48326"], zone: "A" },
    { name: "Oakland Township", slug: "oakland-township", aliases: [], zips: ["48306","48363"], zone: "A" },
    { name: "Utica", slug: "utica", aliases: [], zips: ["48317"], zone: "A" },
    { name: "Oxford", slug: "oxford", aliases: [], zips: ["48370","48371"], zone: "A" },
    { name: "Lake Orion", slug: "lake-orion", aliases: ["orion township"], zips: ["48359","48361","48362"], zone: "A" },
    { name: "Rochester", slug: "rochester", aliases: [], zips: ["48307","48308"], zone: "A" },
    { name: "Rochester Hills", slug: "rochester-hills", aliases: ["rochester hills"], zips: ["48306","48307","48308","48309"], zone: "A" },
    { name: "Troy", slug: "troy", aliases: [], zips: ["48007","48083","48084","48085","48098"], zone: "A" },
    { name: "Berkley", slug: "berkley", aliases: [], zips: ["48072"], zone: "A" },
    { name: "Pleasant Ridge", slug: "pleasant-ridge", aliases: [], zips: ["48069"], zone: "A" },
    { name: "Birmingham", slug: "birmingham", aliases: [], zips: ["48009","48012","48025"], zone: "A" },
    { name: "Franklin", slug: "franklin", aliases: [], zips: ["48025"], zone: "A" },
    { name: "Beverly Hills", slug: "beverly-hills", aliases: [], zips: ["48025"], zone: "A" },
    { name: "Clawson", slug: "clawson", aliases: [], zips: ["48017"], zone: "A" },
    { name: "Madison Heights", slug: "madison-heights", aliases: [], zips: ["48071"], zone: "A" },
    { name: "Hazel Park", slug: "hazel-park", aliases: [], zips: ["48030"], zone: "A" },
    { name: "Oak Park", slug: "oak-park", aliases: [], zips: ["48220","48237"], zone: "A" },
    { name: "Ferndale", slug: "ferndale", aliases: [], zips: ["48220"], zone: "A" },
    { name: "Farmington Hills", slug: "farmington-hills", aliases: ["farmington"], zips: ["48331","48334","48335","48336"], zone: "A" },
    { name: "Novi", slug: "novi", aliases: [], zips: ["48374","48375","48376"], zone: "A" },
    { name: "Milford", slug: "milford", aliases: [], zips: ["48380","48381"], zone: "A" },
    { name: "Highland", slug: "highland", aliases: [], zips: ["48356","48357"], zone: "A" },
    { name: "Holly", slug: "holly", aliases: [], zips: ["48442"], zone: "B" },
    { name: "Groveland Township", slug: "groveland-township", aliases: ["groveland"], zips: ["48363"], zone: "B" },
    { name: "Ortonville", slug: "ortonville", aliases: [], zips: ["48462"], zone: "B" },
    { name: "Brandon Township", slug: "brandon-township", aliases: ["brandon"], zips: ["48462"], zone: "B" },
    { name: "Leonard", slug: "leonard", aliases: [], zips: ["48367"], zone: "B" },
    { name: "Addison Township", slug: "addison-township", aliases: ["addison"], zips: ["48367"], zone: "B" },
    { name: "Royal Oak", slug: "royal-oak", aliases: [], zips: ["48067","48068","48073"], zone: "B" },
    { name: "Huntington Woods", slug: "huntington-woods", aliases: [], zips: ["48070"], zone: "B" },
    { name: "Southfield", slug: "southfield", aliases: [], zips: ["48033","48034","48037","48075","48076"], zone: "B" },
    { name: "South Lyon", slug: "south-lyon", aliases: [], zips: ["48178","48179"], zone: "B" },
    { name: "Lyon Township", slug: "lyon-township", aliases: ["lyon"], zips: ["48178","48422"], zone: "B" }
  ];

  // Oakland County ZIP prefix range — any 480xx–484xx that lands in the cities above
  // is "in"; everything else is out of area. We use the city list as the source of
  // truth and only fall back to a county check if the user types a 5-digit ZIP we
  // don't recognize but that sits inside Oakland County.
  var OAKLAND_ZIP_RANGES = [
    [48001, 48099],
    [48301, 48399],
    [48401, 48499]
  ];

  function isOaklandZip(zip) {
    var n = parseInt(zip, 10);
    if (!n || zip.length !== 5) return false;
    return OAKLAND_ZIP_RANGES.some(function (r) { return n >= r[0] && n <= r[1]; });
  }

  function normalize(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function findMatch(query) {
    var q = String(query || "").trim();
    if (!q) return null;
    // ZIP code lookup
    if (/^\d{3,5}$/.test(q)) {
      var zipMatch = CITIES.find(function (c) { return c.zips.some(function (z) { return z.indexOf(q) === 0; }); });
      if (zipMatch) return zipMatch;
      if (q.length === 5 && isOaklandZip(q)) {
        return { zone: "unknown-oakland", name: "your ZIP" };
      }
      return { zone: "out", name: q };
    }
    if (q.length < 2) return null;
    var nq = normalize(q);
    var city = CITIES.find(function (c) {
      var names = [c.name.toLowerCase()].concat(c.aliases.map(function (a) { return a.toLowerCase(); }));
      return names.some(function (nm) { return nm === nq || nm.indexOf(nq) === 0 || nq.indexOf(nm) === 0; });
    });
    if (city) return city;
    return { zone: "out", name: q };
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      var amp = String.fromCharCode(38), lt = String.fromCharCode(60), gt = String.fromCharCode(62), dq = String.fromCharCode(34), sq = String.fromCharCode(39), semi = String.fromCharCode(59), hash = String.fromCharCode(35);
      var q = amp + "quot" + semi;
      var a = amp + "amp" + semi;
      var l = amp + "lt" + semi;
      var g = amp + "gt" + semi;
      var apos = amp + hash + "039" + semi;
      if (ch === amp) return a;
      if (ch === lt) return l;
      if (ch === gt) return g;
      if (ch === dq) return q;
      if (ch === sq) return apos;
      return ch;
    });
  }

  function titleCase(s) {
    return String(s).replace(/\w\S*/g, function (t) { return t.charAt(0).toUpperCase() + t.slice(1); });
  }

  // ---- Lookup widget ----
  function initLookup() {
    var input = document.getElementById("service-area-checker");
    var result = document.getElementById("checker-result");
    if (!input || !result) return;

    var debounce = null;
    function render(q) {
      var match = findMatch(q);
      if (!match) {
        result.hidden = true;
        result.className = "zone-lookup-result hidden";
        result.innerHTML = "";
        return;
      }
      result.hidden = false;
      if (match.zone === "A" || match.zone === "B") {
        var z = ZONES[match.zone];
        var city = match.name;
        var slug = match.slug;
        var cls = match.zone === "A" ? "is-zone-a" : "is-zone-b";
        var icon = match.zone === "A" ? "fa-circle-check" : "fa-circle-info";
        result.className = "zone-lookup-result " + cls;
        var bookHref = slug ? "/book?city=" + encodeURIComponent(city) : "/book";
        result.innerHTML =
          '<div class="zlr-badge"><i class="fas ' + icon + '" aria-hidden="true"></i> You are in ' + esc(z.label) + '!</div>' +
          '<div class="zlr-rate">Minimum service call: ' + esc(z.rate) + ' <span style="font-weight:500">(' + esc(z.blurb) + ')</span></div>' +
          '<div class="zlr-body">Great news — we serve <strong>' + esc(city) + '</strong> directly from our Waterford base.</div>' +
          '<a class="zlr-cta" href="' + esc(bookHref) + '"><i class="fas fa-calendar-check" aria-hidden="true"></i> Book Service in ' + esc(city) +
          '</a> <a class="zlr-call" href="' + PHONE_HREF + '"><i class="fas fa-phone" aria-hidden="true"></i> or call ' + PHONE + '</a>';
      } else if (match.zone === "unknown-oakland") {
        result.className = "zone-lookup-result is-out";
        result.innerHTML =
          '<div class="zlr-badge"><i class="fas fa-circle-check" aria-hidden="true"></i> You are in Oakland County!</div>' +
          '<div class="zlr-body">That ZIP is inside our service area. Give us a call and we will confirm your travel zone and rate.</div>' +
          '<a class="zlr-call" href="' + PHONE_HREF + '"><i class="fas fa-phone" aria-hidden="true"></i> Call ' + PHONE + '</a>';
      } else {
        result.className = "zone-lookup-result is-out";
        result.innerHTML =
          '<div class="zlr-badge"><i class="fas fa-circle-xmark" aria-hidden="true"></i> Outside our service area</div>' +
          '<div class="zlr-body">We serve Oakland County, MI only. Call us and we will do our best to help or refer a trusted local.</div>' +
          '<a class="zlr-call" href="' + PHONE_HREF + '"><i class="fas fa-phone" aria-hidden="true"></i> Call ' + PHONE + '</a>';
      }
    }
    input.addEventListener("input", function () {
      window.clearTimeout(debounce);
      var v = input.value;
      debounce = window.setTimeout(function () { render(v); }, 120);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); window.clearTimeout(debounce); render(input.value); }
    });
  }

  // ---- Interactive zone map ----
  // Oakland County pin coordinates inside a 640x560 viewBox (matches the reviews-page map
  // geometry so the two pages read consistently). Zone A vs B colouring follows the city list.
  var MAP_PINS = [
    { name: "Waterford", x: 298, y: 282, zone: "A" },
    { name: "Troy", x: 507, y: 344, zone: "A" },
    { name: "Rochester Hills", x: 507, y: 287, zone: "A" },
    { name: "Royal Oak", x: 513, y: 458, zone: "B" },
    { name: "Birmingham", x: 453, y: 405, zone: "A" },
    { name: "Clarkston", x: 278, y: 205, zone: "A" },
    { name: "Farmington Hills", x: 320, y: 453, zone: "A" },
    { name: "Southfield", x: 446, y: 484, zone: "B" }
  ];

  function initMap() {
    var map = document.getElementById("zone-map");
    var pinLayer = document.getElementById("zone-map-pins");
    var popup = document.getElementById("zone-map-popup");
    if (!map || !pinLayer || !popup) return;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", "City service details");

    var activePin = null;

    function showPopup(pin) {
      activePin = pin;
      MAP_PINS.forEach(function (p) {
        var el = document.querySelector('#zone-map-pin-' + p.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase());
        if (el) el.classList.toggle("is-active", p === pin);
      });
      var z = ZONES[pin.zone];
      var citySlug = pin.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      popup.innerHTML =
        '<button type="button" class="zmp-close" aria-label="Close">' + esc("×") + '</button>' +
        '<h4>' + esc(pin.name) + ', MI</h4>' +
        '<span class="zmp-zone ' + (pin.zone === "A" ? "is-a" : "is-b") + '">' + esc(z.label) + '</span>' +
        '<div class="zmp-rate">Minimum service call: ' + esc(z.rate) + ' (' + esc(z.blurb) + ')</div>' +
        '<a class="zmp-book" href="/book?city=' + encodeURIComponent(pin.name) + '">' +
        '<i class="fas fa-calendar-check" aria-hidden="true"></i> Book Service in ' + esc(pin.name) + '</a>';
      // Position popup relative to pin (% of map).
      var rect = map.getBoundingClientRect();
      var pinRect = pin.element.getBoundingClientRect();
      var px = (pinRect.left - rect.left + pinRect.width / 2) / rect.width * 100;
      var py = (pinRect.top - rect.top + pinRect.height / 2) / rect.height * 100;
      popup.style.left = px + "%";
      popup.style.top = py + "%";
      popup.hidden = false;
    }

    function closePopup() {
      popup.hidden = true;
      activePin = null;
      document.querySelectorAll(".zone-map__pin.is-active").forEach(function (el) { el.classList.remove("is-active"); });
    }

    MAP_PINS.forEach(function (p) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = "zone-map-pin-" + p.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      btn.className = "zone-map__pin" + (p.zone === "B" ? " is-zone-b" : "");
      btn.style.left = (p.x / 640 * 100) + "%";
      btn.style.top = (p.y / 560 * 100) + "%";
      btn.setAttribute("aria-label", p.name + ", MI — " + ZONES[p.zone].label + ", minimum " + ZONES[p.zone].rate);
      btn.textContent = p.name.charAt(0);
      p.element = btn;
      btn.addEventListener("click", function () { showPopup(p); });
      btn.addEventListener("focus", function () { showPopup(p); });
      pinLayer.appendChild(btn);
    });

    popup.addEventListener("click", function (e) {
      if (e.target.closest(".zmp-close")) closePopup();
    });
    document.addEventListener("click", function (e) {
      if (popup.hidden) return;
      if (!e.target.closest("#zone-map-pins") && !e.target.closest("#zone-map-popup")) closePopup();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !popup.hidden) {
        closePopup();
        if (activePin && activePin.element) activePin.element.focus();
      }
    });
  }

  // ---- Mobile sticky CTA bar ----
  function initStickyBar() {
    var bar = document.getElementById("mobile-cta-bar");
    if (!bar) return;
    document.body.classList.add("has-mobile-cta");
  }

  // ---- Local review filter chips ----
  // The service-areas page has its own small review section (not the full /reviews grid).
  // We tag each card with the reviewer's city's zone + the service type mentioned in the
  // quote, and let visitors filter by All / Zone A / Zone B / Drywall / Deck Repair.
  function initReviewFilters() {
    var chips = document.querySelectorAll(".sa-review-filter");
    if (!chips.length) return;
    var cards = document.querySelectorAll(".sa-review-card");

    // Resolve each card's zone from the reviewer's city string.
    cards.forEach(function (card) {
      var city = (card.dataset.city || "").trim();
      var zone = card.dataset.zone;
      if (!zone) {
        var m = findMatch(city);
        zone = (m && (m.zone === "A" || m.zone === "B")) ? m.zone : "A";
        card.dataset.zone = zone;
      }
    });

    function apply(filter) {
      cards.forEach(function (card) {
        var show = false;
        if (filter === "all") show = true;
        else if (filter === "zone-a") show = card.dataset.zone === "A";
        else if (filter === "zone-b") show = card.dataset.zone === "B";
        else if (filter === "drywall") show = /drywall/i.test(card.dataset.tag || "");
        else if (filter === "deck") show = /deck/i.test(card.dataset.tag || "");
        card.classList.toggle("is-hidden", !show);
      });
      chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c.dataset.filter === filter)); });
    }

    chips.forEach(function (c) {
      c.addEventListener("click", function () { apply(c.dataset.filter); });
    });
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    initLookup();
    initMap();
    initStickyBar();
    initReviewFilters();
  });
})();
