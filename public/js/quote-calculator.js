/*
 * Instant Quote Calculator
 * Renders into #quote-calculator on the rates page. Customers enter a zip code
 * (auto-detecting Zone A or Zone B from /data/service-areas.json) or pick a zone
 * manually, then check off tasks from /data/quote-tasks.json to see a live estimate.
 * No server round-trip and nothing is stored; selections can be carried into the
 * booking form via /book?service=...&notes=...
 */
(function () {
  const root = document.getElementById('quote-calculator');
  if (!root) return;

  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

  const state = {
    zone: 'A',
    zoneAuto: false,   // true once a zip has resolved a zone
    matchCity: null,
    selected: new Set(),
    catalog: null,
    zoneMinimum: { A: 100, B: 145 },
    cities: [],
    zoneLabels: {
      A: 'Zone A (within ~20 miles)',
      B: 'Zone B (extended county / 20+ miles)'
    }
  };

  // Flatten catalog for quick id -> task lookups.
  const taskIndex = {};

  const findCityByZip = (query) => {
    if (!/^\d{3,5}$/.test(query)) return null;
    return state.cities.find((c) => (c.zips || []).some((z) => z.startsWith(query))) || null;
  };

  const shell = () => {
    root.innerHTML =
      '<div class="grid lg:grid-cols-[1.15fr_.85fr] gap-8 items-start">' +
        // ---- Left: inputs ----
        '<div>' +
          '<div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">' +
            '<h3 class="text-lg font-black text-gray-950 flex items-center gap-2"><i class="fas fa-location-dot text-red-600"></i> 1. Your location</h3>' +
            '<p class="text-gray-500 text-sm mt-1">Enter your zip code and we\'ll set your zone automatically, or choose it below.</p>' +
            '<div class="mt-4 flex flex-col sm:flex-row gap-3">' +
              '<input id="quote-zip" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="postal-code" maxlength="5" placeholder="e.g. 48327" ' +
                'aria-label="Zip code" class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-red-600 text-base font-semibold" />' +
              '<div class="grid grid-cols-2 gap-2 sm:w-64" role="group" aria-label="Choose service zone">' +
                '<button type="button" data-zone="A" class="quote-zone-btn px-3 py-3 rounded-xl border-2 font-bold text-sm transition">Zone A<span class="block text-[11px] font-semibold opacity-80">' + money(state.zoneMinimum.A) + ' first hour</span></button>' +
                '<button type="button" data-zone="B" class="quote-zone-btn px-3 py-3 rounded-xl border-2 font-bold text-sm transition">Zone B<span class="block text-[11px] font-semibold opacity-80">' + money(state.zoneMinimum.B) + ' first hour</span></button>' +
              '</div>' +
            '</div>' +
            '<p id="quote-zone-msg" class="mt-3 text-sm font-semibold hidden" role="status" aria-live="polite"></p>' +
          '</div>' +

          '<div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mt-6">' +
            '<div class="flex items-center justify-between gap-3">' +
              '<h3 class="text-lg font-black text-gray-950 flex items-center gap-2"><i class="fas fa-list-check text-red-600"></i> 2. Pick your tasks</h3>' +
              '<button type="button" id="quote-clear" class="text-xs font-bold text-gray-500 hover:text-red-600 underline hidden">Clear all</button>' +
            '</div>' +
            '<div id="quote-tasks" class="mt-4 space-y-7"></div>' +
          '</div>' +
        '</div>' +

        // ---- Right: sticky summary ----
        '<div class="lg:sticky" style="top: var(--sticky-offset, 160px);">' +
          '<div class="bg-blue-950 text-white rounded-3xl p-7 shadow-2xl">' +
            '<div class="text-xs uppercase tracking-widest text-red-400 font-bold">Your instant estimate</div>' +
            '<div class="flex items-end gap-2 mt-2"><span id="quote-total" class="text-5xl font-black tracking-tight">' + money(state.zoneMinimum.A) + '</span></div>' +
            '<p id="quote-total-sub" class="text-slate-300 text-sm mt-2">Starting price for a ' + state.zoneLabels.A + ' visit.</p>' +
            '<ul id="quote-lines" class="mt-5 space-y-2 text-sm border-t border-white/15 pt-4 hidden"></ul>' +
            '<div class="mt-6 space-y-3">' +
              '<a id="quote-book" href="/book?service=General%20Estimate%20%2F%20Quote" class="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3.5 rounded-xl transition shadow-lg">' +
                '<i class="fas fa-calendar-check"></i> Book these tasks</a>' +
              '<a href="tel:+12483853432" class="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-3.5 rounded-xl transition shadow-lg shadow-green-600/30">' +
                '<i class="fas fa-phone"></i> Call (248) 385-3432</a>' +
            '</div>' +
          '</div>' +
          '<p class="text-xs text-gray-500 leading-relaxed mt-4">Estimates use our standard flat-rate menu and are not a binding quote. Booking several tasks in one visit usually costs <strong>less</strong> than the total shown, because you only pay one trip charge. Materials are not included. Your final price is always confirmed free, upfront.</p>' +
        '</div>' +
      '</div>';
  };

  const renderTasks = () => {
    const wrap = root.querySelector('#quote-tasks');
    wrap.innerHTML = state.catalog.map((cat) =>
      '<fieldset>' +
        '<legend class="flex items-center gap-2 text-sm font-black text-gray-950 uppercase tracking-wide mb-3 pb-2 border-b-2 border-red-600/20 w-full">' +
          '<i class="fas ' + cat.icon + ' text-red-600" aria-hidden="true"></i> ' + cat.label +
        '</legend>' +
        '<div class="space-y-2">' +
          cat.tasks.map((t) =>
            '<label class="quote-task flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 hover:border-red-300 cursor-pointer transition" data-id="' + t.id + '">' +
              '<input type="checkbox" class="quote-check h-5 w-5 accent-red-600 shrink-0" value="' + t.id + '" />' +
              '<span class="flex-1 min-w-0">' +
                '<span class="block font-bold text-gray-900 text-sm">' + t.name + '</span>' +
                '<span class="block text-gray-500 text-xs">' + t.desc + '</span>' +
              '</span>' +
              '<span class="quote-price text-right font-extrabold text-gray-900 whitespace-nowrap" data-a="' + t.a + '" data-b="' + t.b + '">' + money(t.a) + '</span>' +
            '</label>'
          ).join('') +
        '</div>' +
      '</fieldset>'
    ).join('');
  };

  const syncZoneButtons = () => {
    root.querySelectorAll('.quote-zone-btn').forEach((btn) => {
      const on = btn.getAttribute('data-zone') === state.zone;
      btn.classList.toggle('bg-red-600', on);
      btn.classList.toggle('text-white', on);
      btn.classList.toggle('border-red-600', on);
      btn.classList.toggle('border-gray-200', !on);
      btn.classList.toggle('text-gray-700', !on);
      btn.setAttribute('aria-pressed', String(on));
    });
  };

  const updatePrices = () => {
    root.querySelectorAll('.quote-price').forEach((el) => {
      const val = Number(el.getAttribute('data-' + state.zone.toLowerCase()));
      el.textContent = money(val);
    });
  };

  const priceFor = (task) => Number(state.zone === 'B' ? task.b : task.a);

  const update = () => {
    updatePrices();
    syncZoneButtons();

    const chosen = [];
    state.selected.forEach((id) => { if (taskIndex[id]) chosen.push(taskIndex[id]); });
    chosen.sort((x, y) => priceFor(y) - priceFor(x));

    const sum = chosen.reduce((acc, t) => acc + priceFor(t), 0);
    const minimum = state.zoneMinimum[state.zone];
    const total = Math.max(sum, minimum);

    const totalEl = root.querySelector('#quote-total');
    const subEl = root.querySelector('#quote-total-sub');
    const linesEl = root.querySelector('#quote-lines');
    const clearBtn = root.querySelector('#quote-clear');

    totalEl.textContent = money(total);

    if (chosen.length === 0) {
      subEl.textContent = 'Starting price for a ' + state.zoneLabels[state.zone] + ' visit.';
      linesEl.classList.add('hidden');
      linesEl.innerHTML = '';
      clearBtn.classList.add('hidden');
    } else {
      subEl.innerHTML = '<strong>' + chosen.length + '</strong> task' + (chosen.length === 1 ? '' : 's') +
        ' selected &middot; ' + state.zoneLabels[state.zone];
      linesEl.classList.remove('hidden');
      linesEl.innerHTML = chosen.map((t) =>
        '<li class="flex items-center justify-between gap-3">' +
          '<span class="text-slate-200">' + t.name + '</span>' +
          '<span class="font-bold whitespace-nowrap">' + money(priceFor(t)) + '</span>' +
        '</li>'
      ).join('') +
      (sum < minimum
        ? '<li class="flex items-center justify-between gap-3 text-slate-400 text-xs pt-1"><span>Zone minimum applied</span><span>' + money(minimum) + '</span></li>'
        : '');
      clearBtn.classList.remove('hidden');
    }

    // Update the booking deep-link with the selected tasks as notes.
    const bookLink = root.querySelector('#quote-book');
    const params = new URLSearchParams();
    params.set('service', 'General Estimate / Quote');
    if (chosen.length) {
      const notes = 'Instant quote request (' + state.zoneLabels[state.zone] + '):\n' +
        chosen.map((t) => '- ' + t.name + ' (' + money(priceFor(t)) + ')').join('\n') +
        '\nEstimated total: ' + money(total);
      params.set('notes', notes);
    }
    if (state.matchCity) params.set('city', state.matchCity);
    bookLink.setAttribute('href', '/book?' + params.toString());
  };

  const setZone = (zone, opts) => {
    if (zone !== 'A' && zone !== 'B') return;
    state.zone = zone;
    if (opts && opts.manual) {
      state.zoneAuto = false;
      state.matchCity = null;
      const msg = root.querySelector('#quote-zone-msg');
      msg.classList.add('hidden');
    }
    update();
  };

  const onZip = (raw) => {
    const query = raw.replace(/\D/g, '');
    const msg = root.querySelector('#quote-zone-msg');
    if (!query) {
      msg.classList.add('hidden');
      msg.textContent = '';
      state.matchCity = null;
      return;
    }
    const city = query.length >= 3 ? findCityByZip(query) : null;
    if (city) {
      state.matchCity = city.name;
      msg.className = 'mt-3 text-sm font-semibold p-3 rounded-xl bg-green-50 text-green-800 border border-green-200';
      msg.innerHTML = '<i class="fas fa-check-circle mr-1"></i> We serve <strong>' + city.name + ', MI</strong> — ' +
        state.zoneLabels[city.zone] + '.';
      setZone(city.zone);
    } else if (query.length >= 5) {
      state.matchCity = null;
      msg.className = 'mt-3 text-sm font-semibold p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200';
      msg.innerHTML = '<i class="fas fa-info-circle mr-1"></i> Zip not listed. We serve all of Oakland County, MI — pick a zone above or ' +
        '<a href="tel:+12483853432" class="underline font-bold">call to confirm</a>.';
    } else {
      msg.classList.add('hidden');
    }
  };

  const wire = () => {
    root.addEventListener('change', (e) => {
      const check = e.target.closest('.quote-check');
      if (!check) return;
      if (check.checked) state.selected.add(check.value);
      else state.selected.delete(check.value);
      update();
    });

    root.addEventListener('click', (e) => {
      const zoneBtn = e.target.closest('.quote-zone-btn');
      if (zoneBtn) { setZone(zoneBtn.getAttribute('data-zone'), { manual: true }); return; }
      const clear = e.target.closest('#quote-clear');
      if (clear) {
        state.selected.clear();
        root.querySelectorAll('.quote-check').forEach((c) => { c.checked = false; });
        update();
      }
    });

    const zip = root.querySelector('#quote-zip');
    let timer = null;
    zip.addEventListener('input', () => {
      clearTimeout(timer);
      const v = zip.value;
      timer = setTimeout(() => onZip(v), 120);
    });
  };

  Promise.all([
    fetch('/data/quote-tasks.json').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch('/data/service-areas.json').then((r) => (r.ok ? r.json() : null)).catch(() => null)
  ])
    .then(([tasks, areas]) => {
      state.catalog = Array.isArray(tasks.categories) ? tasks.categories : [];
      if (tasks.zoneMinimum) state.zoneMinimum = tasks.zoneMinimum;
      state.catalog.forEach((cat) => cat.tasks.forEach((t) => { taskIndex[t.id] = t; }));

      if (areas) {
        state.cities = Array.isArray(areas.cities) ? areas.cities : [];
        if (areas.zones) {
          if (areas.zones.A && areas.zones.A.label) state.zoneLabels.A = areas.zones.A.label;
          if (areas.zones.B && areas.zones.B.label) state.zoneLabels.B = areas.zones.B.label;
        }
      }

      shell();
      renderTasks();
      wire();
      update();
    })
    .catch(() => {
      root.innerHTML = '<div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-6 text-center text-sm font-semibold">' +
        'Our instant calculator isn\'t loading right now. <a href="/book" class="underline font-bold">Book online</a> or call ' +
        '<a href="tel:+12483853432" class="underline font-bold">(248) 385-3432</a> for a fast, free quote.</div>';
    });
})();
