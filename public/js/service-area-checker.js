/*
 * AAA Handyman Services — Instant Service Area Checker
 *
 * Shared by the homepage and /service-areas. Reads the single source of truth at
 * /data/service-areas.json so coverage never drifts between pages. Enhances the
 * existing #service-area-checker input and #checker-result box if present.
 *
 * Matching rules (deliberately conservative to avoid false "yes" results):
 *   - Numeric queries are treated as ZIP prefixes and require at least 3 digits.
 *   - Text queries require at least 2 characters and match a city name or alias
 *     as a substring (e.g. "bloom" -> West Bloomfield).
 */
(function () {
  const input = document.getElementById('service-area-checker');
  const resultBox = document.getElementById('checker-result');
  if (!input || !resultBox) return;

  // Announce results to assistive tech as they change.
  resultBox.setAttribute('aria-live', 'polite');
  resultBox.setAttribute('role', 'status');

  const ZONES = {
    A: { label: 'Zone A', rate: '$100 First Hour' },
    B: { label: 'Zone B', rate: '$145 First Hour' }
  };

  let cities = [];

  const hideResult = () => { resultBox.className = 'hidden'; resultBox.innerHTML = ''; };

  const findMatch = (query) => {
    const isNumeric = /^\d+$/.test(query);
    if (isNumeric) {
      if (query.length < 3) return null;
      return cities.find((city) => city.zips.some((zip) => zip.startsWith(query))) || null;
    }
    if (query.length < 2) return null;
    return cities.find((city) => {
      const names = [city.name.toLowerCase(), ...(city.aliases || [])];
      return names.some((name) => name.includes(query));
    }) || null;
  };

  const render = (query) => {
    if (!query) { hideResult(); return; }

    const match = findMatch(query);
    if (match) {
      const zone = ZONES[match.zone] || ZONES.A;
      resultBox.className = 'mt-3 text-sm font-semibold text-center p-3 rounded-xl bg-green-50 text-green-800 border border-green-200';
      resultBox.innerHTML =
        '<i class="fas fa-check-circle text-green-600 mr-1.5"></i> Yes! We serve <strong>' + match.name + ', MI</strong> in <strong>' + zone.label + '</strong> (' + zone.rate + '). ' +
        '<a href="/handyman/' + match.slug + '" class="underline hover:text-green-950 font-bold ml-1.5">See ' + match.name + ' page</a> ' +
        '<span class="text-green-400">&middot;</span> ' +
        '<a href="/contact?service=General+Estimate+%2F+Quote&city=' + encodeURIComponent(match.name) + '" data-service="General Estimate / Quote" class="underline hover:text-green-950 font-bold">Request Service <i class="fas fa-arrow-right text-xs"></i></a>';
      return;
    }

    const longEnough = /^\d+$/.test(query) ? query.length >= 3 : query.length >= 3;
    if (longEnough) {
      resultBox.className = 'mt-3 text-sm font-semibold text-center p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200';
      resultBox.innerHTML =
        '<i class="fas fa-info-circle text-amber-600 mr-1.5"></i> Location not explicitly listed. We serve all of Oakland County, MI! ' +
        '<a href="tel:+12483853432" class="underline hover:text-amber-950 font-bold ml-1.5">Call (248) 385-3432 to confirm</a>';
    } else {
      hideResult();
    }
  };

  // Debounce so we do not thrash the DOM on every keystroke.
  let timer = null;
  input.addEventListener('input', function () {
    const query = input.value.trim().toLowerCase();
    clearTimeout(timer);
    timer = setTimeout(() => render(query), 120);
  });

  fetch('/data/service-areas.json')
    .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
    .then((data) => {
      cities = Array.isArray(data.cities) ? data.cities : [];
      // Run once in case the visitor typed before the data loaded.
      const query = input.value.trim().toLowerCase();
      if (query) render(query);
    })
    .catch(() => { /* Leave the input functional-but-quiet if data cannot load. */ });
})();
