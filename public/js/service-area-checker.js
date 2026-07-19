(function () {
  const input = document.getElementById('service-area-checker');
  const resultBox = document.getElementById('checker-result');
  if (!input || !resultBox) return;
  resultBox.setAttribute('aria-live', 'polite');
  resultBox.setAttribute('role', 'status');

  let zones = {
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
      const names = [city.name.toLowerCase(), ...(city.aliases || []).map((a) => a.toLowerCase())];
      return names.some((name) => name.includes(query));
    }) || null;
  };

  const render = (query) => {
    if (!query) { hideResult(); return; }

    const match = findMatch(query);
    if (match) {
      const zone = zones[match.zone] || zones.A;
      resultBox.className = 'mt-3 text-sm font-semibold text-center p-3 rounded-xl bg-green-50 text-green-800 border border-green-200';
      resultBox.innerHTML =
        '<i class="fas fa-check-circle text-green-600 mr-1.5"></i> Yes! We serve <strong>' + match.name + ', MI</strong> in <strong>' + zone.label + '</strong> (' + zone.rate + '). ' +
        '<a href="/handyman/' + match.slug + '" class="underline hover:text-green-950 font-bold ml-1.5">See ' + match.name + ' page</a> ' +
        '<span class="text-green-400">&middot;</span> ' +
        '<a href="/contact?service=General+Estimate+%2F+Quote&city=' + encodeURIComponent(match.name) + '" data-service="General Estimate / Quote" class="underline hover:text-green-950 font-bold">Request Service <i class="fas fa-arrow-right text-xs"></i></a>';
      return;
    }

    if (query.length >= 3) {
      resultBox.className = 'mt-3 text-sm font-semibold text-center p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200';
      resultBox.innerHTML =
        '<i class="fas fa-info-circle text-amber-600 mr-1.5"></i> Location not explicitly listed. We serve all of Oakland County, MI! ' +
        '<a href="tel:+12483853432" class="underline hover:text-amber-950 font-bold ml-1.5">Call (248) 385-3432 to confirm</a>';
    } else {
      hideResult();
    }
  };
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
      if (data.zones) {
        zones = data.zones;
      }
      const query = input.value.trim().toLowerCase();
      if (query) render(query);
    })
    .catch(() => undefined);
})();
