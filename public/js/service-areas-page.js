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
  // Centralized dataset of every Oakland County city we serve, mapped to its
  // pricing zone + GPS coordinates. Waterford is the HQ. The map projects these
  // lat/lng values onto the 640x560 SVG viewBox used by the page's zone art so
  // every city gets a clickable marker instead of only a handful of hubs.
  var SERVICE_AREA_CITIES = [
    // --- ZONE A ($100 Minimum) ---
    { name: "Waterford", zone: "A", lat: 42.6656, lng: -83.4005, hq: true },
    { name: "Pontiac", zone: "A", lat: 42.6389, lng: -83.2910 },
    { name: "West Bloomfield", zone: "A", lat: 42.5642, lng: -83.3591 },
    { name: "Orchard Lake", zone: "A", lat: 42.5831, lng: -83.3577 },
    { name: "Bloomfield Hills", zone: "A", lat: 42.5836, lng: -83.2455 },
    { name: "White Lake", zone: "A", lat: 42.6534, lng: -83.5133 },
    { name: "Commerce", zone: "A", lat: 42.5867, lng: -83.4897 },
    { name: "Walled Lake", zone: "A", lat: 42.5375, lng: -83.4838 },
    { name: "Wixom", zone: "A", lat: 42.5245, lng: -83.5363 },
    { name: "Union Lake", zone: "A", lat: 42.6178, lng: -83.4380 },
    { name: "Davisburg", zone: "A", lat: 42.7534, lng: -83.5349 },
    { name: "Clarkston", zone: "A", lat: 42.7356, lng: -83.4183 },
    { name: "Independence Twp.", zone: "A", lat: 42.7481, lng: -83.4038 },
    { name: "Auburn Hills", zone: "A", lat: 42.6875, lng: -83.2341 },
    { name: "Oakland Twp.", zone: "A", lat: 42.7661, lng: -83.1613 },
    { name: "Utica", zone: "A", lat: 42.6273, lng: -83.0299 },
    { name: "Oxford", zone: "A", lat: 42.8242, lng: -83.2499 },
    { name: "Lake Orion", zone: "A", lat: 42.7842, lng: -83.2399 },
    { name: "Orion Twp.", zone: "A", lat: 42.7711, lng: -83.2560 },
    { name: "Rochester", zone: "A", lat: 42.6806, lng: -83.1338 },
    { name: "Rochester Hills", zone: "A", lat: 42.6584, lng: -83.1499 },
    { name: "Troy", zone: "A", lat: 42.5803, lng: -83.1499 },
    { name: "Berkley", zone: "A", lat: 42.5031, lng: -83.1838 },
    { name: "Pleasant Ridge", zone: "A", lat: 42.4711, lng: -83.1408 },
    { name: "Birmingham", zone: "A", lat: 42.5467, lng: -83.2113 },
    { name: "Franklin", zone: "A", lat: 42.5223, lng: -83.3038 },
    { name: "Beverly Hills", zone: "A", lat: 42.5250, lng: -83.2388 },
    { name: "Clawson", zone: "A", lat: 42.5334, lng: -83.1463 },
    { name: "Madison Heights", zone: "A", lat: 42.4859, lng: -83.1052 },
    { name: "Hazel Park", zone: "A", lat: 42.4631, lng: -83.1022 },
    { name: "Oak Park", zone: "A", lat: 42.4595, lng: -83.1819 },
    { name: "Ferndale", zone: "A", lat: 42.4606, lng: -83.1346 },
    { name: "Farmington Hills", zone: "A", lat: 42.4853, lng: -83.3772 },
    { name: "Novi", zone: "A", lat: 42.4806, lng: -83.4755 },
    { name: "Milford", zone: "A", lat: 42.5861, lng: -83.5999 },
    { name: "Highland", zone: "A", lat: 42.6389, lng: -83.6180 },
    // --- ZONE B ($145 Minimum) ---
    { name: "Holly", zone: "B", lat: 42.7919, lng: -83.6272 },
    { name: "Groveland Twp.", zone: "B", lat: 42.8253, lng: -83.5383 },
    { name: "Ortonville", zone: "B", lat: 42.8531, lng: -83.4430 },
    { name: "Brandon Twp.", zone: "B", lat: 42.8464, lng: -83.4219 },
    { name: "Leonard", zone: "B", lat: 42.8647, lng: -83.1444 },
    { name: "Addison Twp.", zone: "B", lat: 42.8525, lng: -83.1205 },
    { name: "Royal Oak", zone: "B", lat: 42.4895, lng: -83.1446 },
    { name: "Huntington Woods", zone: "B", lat: 42.4764, lng: -83.1633 },
    { name: "Southfield", zone: "B", lat: 42.4734, lng: -83.2219 },
    { name: "South Lyon", zone: "B", lat: 42.4606, lng: -83.6519 },
    { name: "Lyon Twp.", zone: "B", lat: 42.4981, lng: -83.6238 }
  ];

  // Dimensions of the zone-map SVG viewBox.
  var MAP_W = 640, MAP_H = 560;

  // Project lat/lng onto the map viewBox. Coefficients come from a least-squares
  // fit against the original hand-placed pin coordinates so the GPS-based markers
  // line up with the existing zone rings + roads, then clamped into the visible
  // county rectangle so no city bleeds off the canvas.
  function project(lat, lng) {
    var x = 799.05 * lng + 66961.55;
    var y = -1023.6 * lat + 43945.1;
    return {
      x: Math.max(48, Math.min(592, x)),
      y: Math.max(36, Math.min(522, y))
    };
  }

  function pinId(name) {
    return "zone-map-pin-" + name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  }

  function initMap() {
    var map = document.getElementById("zone-map");
    var pinLayer = document.getElementById("zone-map-pins");
    var popup = document.getElementById("zone-map-popup");
    if (!map || !pinLayer || !popup) return;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", "City service details");

    // ---- Portal the popup out of the clipped map subtree ----
    // The map sits inside `.zone-map { overflow: hidden }` which itself sits inside
    // a `rounded-3xl overflow-hidden` wrapper, so any descendant (no matter how
    // high its z-index) is clipped to the map canvas and cut off at the edges.
    // Moving the popup to document.body places it in the root stacking context
    // with no overflow:hidden ancestor, so it can overflow the map freely and
    // sit above page chrome via z-index. Position is then computed in viewport
    // coordinates (position: fixed) from the trigger's getBoundingClientRect().
    document.body.appendChild(popup);

    var activePin = null;
    var activeAnchor = null; // element the popup is currently anchored to (pin/cluster)
    var pinModels = SERVICE_AREA_CITIES.map(function (c) {
      var p = project(c.lat, c.lng);
      return { name: c.name, zone: c.zone, hq: !!c.hq, x: p.x, y: p.y, id: pinId(c.name), element: null };
    });
    var clusterElements = [];

    // Cluster layer holds the count bubbles that replace overlapping pins on
    // small viewports. It sits above the pins so taps always hit a cluster.
    var clusterLayer = document.createElement("div");
    clusterLayer.className = "zone-map__clusters";
    pinLayer.appendChild(clusterLayer);

    function createPinElement(m) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = m.id;
      var cls = "zone-map__pin";
      if (m.zone === "B") cls += " is-zone-b";
      if (m.hq) cls += " is-hq";
      btn.className = cls;
      btn.style.left = (m.x / MAP_W * 100) + "%";
      btn.style.top = (m.y / MAP_H * 100) + "%";
      var z = ZONES[m.zone];
      btn.setAttribute("aria-label", m.name + ", MI — " + z.label + ", minimum " + z.rate);
      if (m.hq) {
        btn.innerHTML = '<i class="fas fa-star" aria-hidden="true"></i><span class="zone-map__hq-label">HQ</span>';
      } else {
        btn.textContent = m.name.charAt(0);
      }
      btn.addEventListener("click", function (e) { e.stopPropagation(); showCityPopup(m); });
      btn.addEventListener("focus", function () { showCityPopup(m); });
      return btn;
    }

    function showCityPopup(m) {
      activePin = m;
      activeAnchor = m.element;
      pinModels.forEach(function (p) { if (p.element) p.element.classList.toggle("is-active", p === m); });
      clusterElements.forEach(function (el) { el.classList.remove("is-active"); });
      var z = ZONES[m.zone];
      var min = m.zone === "A" ? "100" : "145";
      popup.innerHTML =
        '<button type="button" class="zmp-close" aria-label="Close">' + esc("×") + '</button>' +
        '<h4>' + esc(m.name) + ', MI</h4>' +
        '<span class="zmp-zone ' + (m.zone === "A" ? "is-a" : "is-b") + '">' + esc(z.label) + '</span>' +
        '<div class="zmp-rate">Pricing tier: ' + esc(z.label) + " ($" + min + " Minimum Service Call)" + '</div>' +
        '<div class="zmp-blurb">' + esc(z.blurb) + '</div>' +
        '<a class="zmp-book" href="/book?city=' + encodeURIComponent(m.name) + '">' +
        '<i class="fas fa-calendar-check" aria-hidden="true"></i> Book Service in ' + esc(m.name) + '</a>';
      openPopup();
    }

    function showClusterPopup(cluster) {
      activePin = null;
      activeAnchor = cluster.element;
      pinModels.forEach(function (p) { if (p.element) p.classList.remove("is-active"); });
      clusterElements.forEach(function (el) { el.classList.toggle("is-active", el === cluster.element); });
      var items = cluster.models.map(function (m) {
        var z = ZONES[m.zone];
        return '<li class="zmp-cluster-item"><a href="/book?city=' + encodeURIComponent(m.name) + '">' +
          '<span class="zmp-cluster-name">' + esc(m.name) + '</span>' +
          '<span class="zmp-zone-pill ' + (m.zone === "A" ? "is-a" : "is-b") + '">' + esc(z.label) + " · " + esc(z.rate) + '</span>' +
          '</a></li>';
      }).join("");
      popup.innerHTML =
        '<button type="button" class="zmp-close" aria-label="Close">' + esc("×") + '</button>' +
        '<h4>' + cluster.models.length + ' cities in this area</h4>' +
        '<ul class="zmp-cluster-list">' + items + '</ul>';
      openPopup();
    }

    // Reveal the popup for measurement without a visible flash, then position
    // and show it. The [hidden] attribute sets display:none, which makes
    // offsetWidth/offsetHeight return 0 — so we must unhide before measuring
    // or the flip/clamp math runs against a zero-size box and edge pins render
    // with the card hanging off the viewport.
    function openPopup() {
      popup.style.visibility = "hidden";
      popup.hidden = false;
      positionPopup();
      popup.style.visibility = "";
    }

    // Auto-flipping + edge-collision positioning for the portaled (position:fixed)
    // popup. The card is placed above the anchor by default and flips below when
    // there is not enough room (e.g. pins near the top of the map). It is then
    // clamped to the viewport with padding so right/left/bottom edge pins never
    // push the card off-screen, and the arrow is repositioned to keep pointing at
    // the anchor even after horizontal clamping. The top boundary accounts for
    // the sticky site header so the card never hides behind it.
    var POPUP_GAP = 10;     // gap between anchor and card
    var POPUP_PAD = 12;      // viewport edge padding
    var ARROW_MARGIN = 16;   // keep arrow clear of the card's rounded corners

    function positionPopup() {
      if (!activeAnchor) return;
      var a = activeAnchor.getBoundingClientRect();
      var ax = a.left + a.width / 2;   // anchor center X
      var aTop = a.top, aBottom = a.bottom;

      // Top boundary: don't render under the sticky header.
      var topBound = POPUP_PAD;
      var header = document.getElementById("site-header");
      if (header) {
        var hb = header.getBoundingClientRect();
        if (hb.bottom > topBound) topBound = hb.bottom + POPUP_PAD;
      }

      var vw = window.innerWidth, vh = window.innerHeight;
      var pw = popup.offsetWidth, ph = popup.offsetHeight;
      // Fall back to sensible estimates if measurement isn't ready yet.
      if (!pw) pw = 230;
      if (!ph) ph = 170;

      // ---- Vertical placement: prefer above, flip below when needed ----
      var spaceAbove = aTop - topBound;
      var spaceBelow = vh - aBottom - POPUP_PAD;
      var placeAbove = spaceAbove >= ph + POPUP_GAP || spaceAbove >= spaceBelow;
      var top;
      if (placeAbove) {
        top = aTop - ph - POPUP_GAP;
      } else {
        top = aBottom + POPUP_GAP;
      }
      // If it still overflows vertically (very short viewport), clamp to the
      // usable region and let the card sit inside it.
      top = Math.max(topBound, Math.min(vh - ph - POPUP_PAD, top));

      // ---- Horizontal placement: center on anchor, clamp to viewport ----
      var left = ax - pw / 2;
      left = Math.max(POPUP_PAD, Math.min(vw - pw - POPUP_PAD, left));

      popup.style.left = left + "px";
      popup.style.top = top + "px";

      // ---- Arrow: point at the anchor, clamped away from the card corners ----
      var arrowX = ax - left;
      arrowX = Math.max(ARROW_MARGIN, Math.min(pw - ARROW_MARGIN, arrowX));
      popup.style.setProperty("--zmp-arrow-x", arrowX + "px");
      popup.classList.toggle("is-below", !placeAbove);
    }

    function closePopup() {
      popup.hidden = true;
      popup.style.visibility = "";
      activePin = null;
      activeAnchor = null;
      document.querySelectorAll(".zone-map__pin.is-active, .zone-map__cluster.is-active").forEach(function (el) { el.classList.remove("is-active"); });
    }

    // ---- Responsive clustering ----
    // Greedily group pins whose live pixel centers sit within MIN_CLUSTER_PX
    // of each other. Singletons render as the city marker; groups collapse into
    // a count bubble that opens a list of its cities. Re-run on resize so the
    // map stays readable on mobile and spreads out on desktop.
    var MIN_CLUSTER_PX = 26;

    function render() {
      // Ensure every pin element exists and is visible.
      pinModels.forEach(function (m) {
        if (!m.element) { m.element = createPinElement(m); pinLayer.appendChild(m.element); }
        m.element.style.display = "";
      });

      // Clear previous clusters.
      clusterElements.forEach(function (el) { el.remove(); });
      clusterElements = [];
      clusterLayer.innerHTML = "";

      var rect = map.getBoundingClientRect();
      if (!rect.width) return;
      var pts = pinModels.map(function (m) {
        return { model: m, px: (m.x / MAP_W) * rect.width, py: (m.y / MAP_H) * rect.height };
      });

      var assigned = new Array(pts.length).fill(false);
      var clusters = [];
      for (var i = 0; i < pts.length; i++) {
        if (assigned[i]) continue;
        var group = [pts[i]];
        assigned[i] = true;
        for (var j = i + 1; j < pts.length; j++) {
          if (assigned[j]) continue;
          var dx = pts[j].px - pts[i].px;
          var dy = pts[j].py - pts[i].py;
          if (dx * dx + dy * dy <= MIN_CLUSTER_PX * MIN_CLUSTER_PX) {
            group.push(pts[j]);
            assigned[j] = true;
          }
        }
        clusters.push(group);
      }

      clusters.forEach(function (group) {
        if (group.length < 2) return; // singleton stays as a normal pin
        group.forEach(function (g) { g.model.element.style.display = "none"; });
        var cx = 0, cy = 0;
        group.forEach(function (g) { cx += g.model.x; cy += g.model.y; });
        cx /= group.length; cy /= group.length;
        var models = group.map(function (g) { return g.model; });
        var aCount = models.filter(function (m) { return m.zone === "A"; }).length;
        var dominant = aCount >= models.length / 2 ? "A" : "B";
        var el = document.createElement("button");
        el.type = "button";
        el.className = "zone-map__cluster" + (dominant === "B" ? " is-zone-b" : "");
        el.style.left = (cx / MAP_W * 100) + "%";
        el.style.top = (cy / MAP_H * 100) + "%";
        el.setAttribute("aria-label", models.length + " service cities clustered here — open list");
        el.textContent = String(models.length);
        var clusterObj = { models: models, cx: cx, cy: cy, element: el };
        el.addEventListener("click", function (e) { e.stopPropagation(); showClusterPopup(clusterObj); });
        clusterLayer.appendChild(el);
        clusterElements.push(el);
      });
    }

    render();

    // Keep the portaled popup glued to its anchor on scroll/resize. Capture-phase
    // scroll listeners catch scrolling in any ancestor container (not just the
    // window), which is exactly what a position:fixed element needs since it
    // does not move with its origin element automatically.
    var resizeTimer = null;
    function onViewportChange() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        if (popup.hidden) render();
        else positionPopup();
      }, 120);
    }
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", function () { if (!popup.hidden) positionPopup(); }, { capture: true, passive: true });

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
    initReviewFilters();
  });
})();
