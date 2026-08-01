(function () {
  /*
   * Everything below is setup for a widget that sits far below the fold. This
   * file is deferred, which means its body used to execute in the same
   * pre-DOMContentLoaded task as the other deferred bundles on the page --
   * their costs add up into one main-thread task. Nothing here has to happen
   * that early, so the whole of init() is handed to an idle slice and the
   * script body now does nothing but schedule it.
   *
   * Deferring listener registration means a fast typist can reach the field
   * before init() runs, so init() reads input.value on arrival rather than
   * trusting that it saw every event. The DOM keeps the typed text either way,
   * so no keystroke is lost -- there is no listener race to lose.
   */
  const init = () => {
    const input = document.getElementById('service-area-checker');
    const resultBox = document.getElementById('checker-result');
    if (!input || !resultBox) return;
    resultBox.setAttribute('aria-live', 'polite');
    resultBox.setAttribute('role', 'status');

    let zones = {
      A: { label: 'Zone A', rate: '$100 First Hour' },
      B: { label: 'Zone B', rate: '$120 First Hour' }
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
          '<i class="fas fa-check-circle text-green-700 mr-1.5" aria-hidden="true"></i> Yes! We serve <strong>' + match.name + ', MI</strong> in <strong>' + zone.label + '</strong> (' + zone.rate + '). ' +
          '<a href="/handyman/' + match.slug + '" class="underline hover:text-green-950 font-bold ml-1.5">See ' + match.name + ' page</a> ' +
          '<span class="text-green-700" aria-hidden="true">&middot;</span> ' +
          '<a href="/contact?service=General+Estimate+%2F+Quote&city=' + encodeURIComponent(match.name) + '" data-service="General Estimate / Quote" class="underline hover:text-green-950 font-bold">Request Service <i class="fas fa-arrow-right text-xs" aria-hidden="true"></i></a>';
        return;
      }

      if (query.length >= 3) {
        resultBox.className = 'mt-3 text-sm font-semibold text-center p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200';
        resultBox.innerHTML =
          '<i class="fas fa-info-circle text-amber-700 mr-1.5" aria-hidden="true"></i> Location not explicitly listed. We serve all of Oakland County, MI! ' +
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

    /*
     * The city list is a few kilobytes of JSON for a widget that sits far below
     * the fold, and it used to be requested the moment this script ran -- inside
     * the window where the hero image is still painting. It now loads on first
     * contact with the field, with an idle prefetch after load so the common case
     * still has the data in hand before anyone finishes typing. render() re-runs
     * when the data lands, so a keystroke that beats the response is not lost.
     */
    let areasPromise = null;
    const loadAreas = () => {
      if (areasPromise) return areasPromise;
      areasPromise = fetch('/data/service-areas.json')
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
      return areasPromise;
    };

    ['focus', 'pointerdown', 'input'].forEach((event) => {
      input.addEventListener(event, loadAreas, { once: true, passive: true });
    });

    /*
     * Still gated on load rather than fired here: init() can be forced to run
     * before load by the idle timeout below, and the point of this prefetch was
     * always to stay out of the hero image's bandwidth.
     */
    const prefetchWhenIdle = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(loadAreas, { timeout: 4000 });
      } else {
        setTimeout(loadAreas, 1500);
      }
    };
    if (document.readyState === 'complete') prefetchWhenIdle();
    else window.addEventListener('load', prefetchWhenIdle, { once: true });

    // Anything typed before the listeners existed.
    const typed = input.value.trim().toLowerCase();
    if (typed) {
      loadAreas();
      render(typed);
    }
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(init, { timeout: 2000 });
  } else {
    setTimeout(init, 0);
  }
})();
