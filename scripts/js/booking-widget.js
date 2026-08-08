/*
 * Shared "Book Online / Get a Free Quote" modal.
 *
 * /book is still the full booking page -- photo upload, live reviews, the gift
 * certificate, the whole thing. This is the short path: three steps in a dialog
 * that opens over whatever page the visitor is already reading, so someone who
 * has just decided on the Seasonal Prep bundle does not have to leave the page
 * that convinced them.
 *
 * Wiring: give any link or button `data-booking-widget`. Optional
 * `data-booking-service="<exact service name>"` preselects a job category and
 * opens on step 2. Triggers stay real `<a href="/book">` links, so with this
 * script blocked or broken the click still lands on the booking page.
 *
 * The service strings below are byte-identical to the <option> values on
 * /book, because the owner reads both in the same inbox and the API stores
 * whatever it is handed.
 */
(function () {
  'use strict';

  var TRIGGER_SELECTOR = '[data-booking-widget]';
  var MAX_NOTES_LENGTH = 700;

  /* --------------------------------------------------------------------- *
   * Job categories
   *
   * `hours` is the typical time on site, which is what turns a category into
   * an estimated time slot and a labor estimate. Pricing is the published
   * rate: a $100 service call covering travel, diagnosis, and the first hour,
   * then $70/hour. Bundles carry their own fixed price and discount.
   * --------------------------------------------------------------------- */
  var SERVICE_CALL = 100;
  var HOURLY_RATE = 70;

  var CATEGORIES = [
    { service: 'Carpentry & Trim', label: 'Carpentry', icon: 'fa-hammer', hours: 2, blurb: 'Trim, shelving, stairs, deck boards, and finish work.' },
    { service: 'Minor Plumbing', label: 'Minor Plumbing', icon: 'fa-faucet-drip', hours: 1.5, blurb: 'Faucets, shut-off valves, running toilets, and drain clears.' },
    { service: 'Minor Electrical', label: 'Minor Electrical', icon: 'fa-bolt', hours: 1.5, blurb: 'Fixtures, switches, outlets, ceiling fans, and smoke alarms.' },
    { service: 'Drywall Repair', label: 'Drywall Repair', icon: 'fa-trowel', hours: 2, blurb: 'Patching, texture matching, and paint-ready finishing.' },
    { service: 'Doors & Windows', label: 'Doors & Windows', icon: 'fa-door-open', hours: 2, blurb: 'Sticking doors, locks and deadbolts, screens, and weatherstripping.' },
    { service: 'Installation & Mounting', label: 'Mounting & Assembly', icon: 'fa-screwdriver-wrench', hours: 1.5, blurb: 'TVs, blinds, grab bars, shelving, and flat-pack furniture.' },
    { service: 'Painting & Staining', label: 'Painting & Staining', icon: 'fa-paint-roller', hours: 3, blurb: 'Touch-ups, single rooms, trim, and deck or fence staining.' },
    { service: 'Gutters', label: 'Gutters', icon: 'fa-house-chimney', hours: 2, blurb: 'Cleaning, resealing, downspout fixes, and flow checks.' }
  ];

  var BUNDLES = [
    {
      service: 'Seasonal Prep Package',
      label: 'Seasonal Prep',
      icon: 'fa-leaf',
      hours: 4.5,
      price: 293,
      discount: '15%',
      blurb: 'Gutter clean, weatherstripping, window sash checks, and a deck inspection.'
    },
    {
      service: 'Move-In / Move-Out Bundle',
      label: 'Move-In / Move-Out',
      icon: 'fa-boxes-packing',
      hours: 5,
      price: 323,
      discount: '15%',
      blurb: 'TV mounting, wall patching, paint touch-ups, and lock upgrades.'
    },
    {
      service: 'Senior Safety & Accessibility Package',
      label: 'Senior Safety',
      icon: 'fa-shield-heart',
      hours: 4,
      price: 279,
      discount: '10%',
      blurb: 'Grab bars, lever handles, non-slip treads, and handrail checks.'
    }
  ];

  var QUOTE = {
    service: 'General Estimate / Quote',
    label: 'Not sure yet — send an estimate',
    icon: 'fa-clipboard-question',
    quote: true,
    blurb: 'Describe the work and we will price it before anyone books a van.'
  };

  var ALL_SERVICES = CATEGORIES.concat(BUNDLES, [QUOTE]);

  /*
   * Arrival windows. Kept byte-identical to scripts/js/book-page.js and
   * netlify/functions/booking-availability.ts -- a booking row is matched to a
   * window by this exact string, so a stray space would orphan it.
   */
  var ARRIVAL_WINDOWS = {
    weekday: [
      { value: '9:00 AM - 11:00 AM', part: 'Morning' },
      { value: '12:00 PM - 2:00 PM', part: 'Midday' },
      { value: '3:00 PM - 5:00 PM', part: 'Afternoon' }
    ],
    saturday: [
      { value: '10:00 AM - 12:00 PM', part: 'Morning' },
      { value: '12:30 PM - 2:30 PM', part: 'Midday' },
      { value: '3:00 PM - 5:00 PM', part: 'Afternoon' }
    ]
  };

  // Canonical fee wording. Source of truth is /terms (Payment & Materials);
  // /rates and /book carry the same two sentences.
  var MATERIALS_FEE_COPY =
    'Materials and hardware are billed separately at cost plus a 10–15% supply sourcing fee. Supply your own and there is no markup.';
  var NON_CASH_FEE_COPY =
    'Cash, check, Zelle®, Venmo®, and Cash App accepted. A 5% processing fee applies to all non-cash payments.';

  /** Oakland County ZIPs all fall in 48000–48499. */
  var OAKLAND_ZIP = /^48[0-4]\d{2}$/;

  var state = {
    step: 1,
    service: null,
    date: '',
    time: '',
    zip: '',
    zone: null, // resolved { city, zone, route, routeLabel, dayLabel, days }
    availability: null, // Map<isoDate, day>
    areas: null, // { zips: {}, routes: {} }
    submitting: false
  };

  var root = null; // modal element, built on first open
  var els = {};
  var lastFocused = null;

  /* --------------------------------------------------------------------- *
   * Small helpers
   * --------------------------------------------------------------------- */

  function sanitizeText(value, maxLength) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  function money(amount) {
    return '$' + Math.round(amount).toLocaleString('en-US');
  }

  function formatHours(hours) {
    return hours % 1 === 0.5 ? Math.floor(hours) + '½' : String(hours);
  }

  function plural(hours) {
    return formatHours(hours) + ' hour' + (hours === 1 ? '' : 's');
  }

  function laborFor(entry) {
    if (!entry || entry.quote) return null;
    if (entry.price) return entry.price;
    return SERVICE_CALL + HOURLY_RATE * (entry.hours - 1);
  }

  function findService(name) {
    for (var i = 0; i < ALL_SERVICES.length; i += 1) {
      if (ALL_SERVICES[i].service === name) return ALL_SERVICES[i];
    }
    return null;
  }

  /** YYYY-MM-DD for "today" in Detroit, so the min date matches the API's. */
  function detroitToday() {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Detroit',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
    } catch (err) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function addDays(isoDate, offset) {
    var parts = isoDate.split('-').map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + offset, 12)).toISOString().slice(0, 10);
  }

  function weekdayOf(isoDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return -1;
    var parts = isoDate.split('-').map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12)).getUTCDay();
  }

  function formatDay(isoDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
    var parts = isoDate.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }

  /* --------------------------------------------------------------------- *
   * Service area data
   *
   * public/data/service-areas.json is the same file the coverage checker and
   * the city pages read. Fetched once, on first open, so a page that never
   * opens the modal never pays for it.
   * --------------------------------------------------------------------- */

  var areasPromise = null;

  function loadAreas() {
    if (areasPromise) return areasPromise;
    areasPromise = fetch('/data/service-areas.json', { headers: { accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('Service areas unavailable');
        return response.json();
      })
      .then(function (data) {
        var zips = {};
        (data.cities || []).forEach(function (city) {
          (city.zips || []).forEach(function (zip) {
            // First city listed wins: a handful of ZIPs span two of our
            // cities, and they always share a zone and a route, so only the
            // display name is a coin toss.
            if (!Object.prototype.hasOwnProperty.call(zips, zip)) {
              zips[zip] = { city: city.name, zone: city.zone, route: city.route || null };
            }
          });
        });
        state.areas = { zips: zips, routes: data.routes || {}, cities: data.cities || [] };
        return state.areas;
      })
      .catch(function () {
        // Coverage data is a convenience here; the API validates the ZIP for
        // real on submit, so a failed fetch must not block a booking.
        state.areas = null;
        return null;
      });
    return areasPromise;
  }

  function resolveZip(zip) {
    if (!/^\d{5}$/.test(zip)) return null;
    if (!state.areas) {
      return { city: '', zone: '', route: null, routeLabel: '', dayLabel: '', days: [], served: OAKLAND_ZIP.test(zip), known: false };
    }
    var match = Object.prototype.hasOwnProperty.call(state.areas.zips, zip) ? state.areas.zips[zip] : null;
    if (!match) {
      return { city: '', zone: '', route: null, routeLabel: '', dayLabel: '', days: [], served: OAKLAND_ZIP.test(zip), known: false };
    }
    var route = match.route && Object.prototype.hasOwnProperty.call(state.areas.routes, match.route)
      ? state.areas.routes[match.route]
      : null;
    return {
      city: match.city,
      zone: match.zone,
      route: match.route,
      routeLabel: route ? route.label : '',
      dayLabel: route ? route.dayLabel : '',
      days: route ? route.days : [],
      served: true,
      known: true
    };
  }

  /* --------------------------------------------------------------------- *
   * Availability
   * --------------------------------------------------------------------- */

  var availabilityPromise = null;

  function loadAvailability() {
    if (availabilityPromise) return availabilityPromise;
    availabilityPromise = fetch('/api/booking/availability', { headers: { accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('Availability unavailable');
        return response.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.days)) throw new Error('Availability unavailable');
        state.availability = new Map(
          data.days.map(function (day) {
            return [day.date, day];
          })
        );
        return state.availability;
      })
      .catch(function () {
        // Every window is offered rather than none: a booking request the
        // owner has to move beats a customer who could not send one.
        state.availability = null;
        return null;
      });
    return availabilityPromise;
  }

  function dayAvailability(isoDate) {
    return state.availability && isoDate ? state.availability.get(isoDate) || null : null;
  }

  /* --------------------------------------------------------------------- *
   * Markup
   * --------------------------------------------------------------------- */

  var TEMPLATE = [
    '<div class="bw-backdrop" data-bw-close></div>',
    '<div class="bw-shell" role="dialog" aria-modal="true" aria-labelledby="bw-title">',
    '  <div class="bw-panel">',
    '    <header class="bw-header">',
    '      <div class="flex items-start justify-between gap-4">',
    '        <div>',
    '          <p class="text-xs font-bold uppercase tracking-[0.2em] text-red-300">AAA Handyman Services LLC</p>',
    '          <h2 id="bw-title" class="mt-1 text-xl font-extrabold text-white sm:text-2xl">Book Online / Get a Free Quote</h2>',
    '        </div>',
    '        <button type="button" class="bw-close" data-bw-close aria-label="Close booking form">',
    '          <i class="fas fa-xmark" aria-hidden="true"></i>',
    '        </button>',
    '      </div>',
    '      <ol class="bw-steps" data-bw-steps>',
    '        <li class="bw-step" data-bw-step="1"><span class="bw-step__dot">1</span><span class="bw-step__label">Job</span></li>',
    '        <li class="bw-step" data-bw-step="2"><span class="bw-step__dot">2</span><span class="bw-step__label">Time</span></li>',
    '        <li class="bw-step" data-bw-step="3"><span class="bw-step__dot">3</span><span class="bw-step__label">Details</span></li>',
    '      </ol>',
    '    </header>',
    '    <div class="bw-body">',
    '      <p class="sr-only" role="status" aria-live="polite" data-bw-status></p>',
    // Step 1 -------------------------------------------------------------
    '      <section class="bw-pane" data-bw-pane="1">',
    '        <h3 class="bw-pane__title">What do you need done?</h3>',
    '        <p class="bw-pane__hint">Pick the closest match. Each one shows the visit length we normally block out, so you can see the time slot before you choose a day.</p>',
    '        <div class="bw-grid" data-bw-categories></div>',
    '        <h4 class="bw-subhead">Bundled savings <span class="bw-chip bw-chip--save">10–15% off labor</span></h4>',
    '        <div class="bw-grid" data-bw-bundles></div>',
    '        <div data-bw-quote class="mt-3"></div>',
    '      </section>',
    // Step 2 -------------------------------------------------------------
    '      <section class="bw-pane hidden" data-bw-pane="2">',
    '        <h3 class="bw-pane__title">When works for you?</h3>',
    '        <div class="bw-estimate" data-bw-estimate></div>',
    '        <label class="bw-label" for="bw-date">Preferred date</label>',
    '        <input type="date" id="bw-date" class="bw-input" required>',
    '        <p class="bw-note" data-bw-daynote></p>',
    '        <fieldset class="mt-5">',
    '          <legend class="bw-label">Preferred arrival window</legend>',
    '          <div class="bw-windows" data-bw-windows></div>',
    '        </fieldset>',
    '        <p class="bw-note">Two-hour arrival windows, not appointment times. We call or text when we are on the way.</p>',
    '      </section>',
    // Step 3 -------------------------------------------------------------
    '      <section class="bw-pane hidden" data-bw-pane="3">',
    '        <h3 class="bw-pane__title">Where are we headed?</h3>',
    '        <div class="bw-field-grid">',
    '          <div>',
    '            <label class="bw-label" for="bw-name">Full name</label>',
    '            <input type="text" id="bw-name" class="bw-input" autocomplete="name" required maxlength="120">',
    '          </div>',
    '          <div>',
    '            <label class="bw-label" for="bw-phone">Phone</label>',
    '            <input type="tel" id="bw-phone" class="bw-input" autocomplete="tel" required maxlength="25" placeholder="(248) 555-0142">',
    '          </div>',
    '        </div>',
    '        <label class="bw-label" for="bw-email">Email</label>',
    '        <input type="email" id="bw-email" class="bw-input" autocomplete="email" required maxlength="160">',
    '        <label class="bw-label" for="bw-address">Service address</label>',
    '        <input type="text" id="bw-address" class="bw-input" autocomplete="street-address" required maxlength="160" placeholder="123 Elizabeth Lake Rd">',
    '        <div class="bw-field-grid">',
    '          <div>',
    '            <label class="bw-label" for="bw-city">City</label>',
    '            <input type="text" id="bw-city" class="bw-input" autocomplete="address-level2" maxlength="80">',
    '          </div>',
    '          <div>',
    '            <label class="bw-label" for="bw-zip">ZIP code</label>',
    '            <input type="text" id="bw-zip" class="bw-input" autocomplete="postal-code" required inputmode="numeric" maxlength="5" pattern="\\d{5}" placeholder="48328">',
    '          </div>',
    '        </div>',
    '        <p class="bw-zip-note" data-bw-zipnote role="status" aria-live="polite"></p>',
    '        <label class="bw-label" for="bw-notes">What should we know? <span class="font-normal normal-case tracking-normal text-gray-400">(optional)</span></label>',
    '        <textarea id="bw-notes" class="bw-input" rows="3" maxlength="700" placeholder="Two interior doors stick, and the hall light flickers."></textarea>',
    '        <div class="bw-fees" data-bw-fees></div>',
    '      </section>',
    // Success ------------------------------------------------------------
    '      <section class="bw-pane hidden text-center" data-bw-pane="done">',
    '        <span class="bw-done-icon"><i class="fas fa-calendar-check" aria-hidden="true"></i></span>',
    '        <h3 class="mt-4 text-2xl font-extrabold text-white">Request received</h3>',
    '        <p class="mt-2 text-gray-300" data-bw-done-message></p>',
    '        <dl class="bw-summary" data-bw-summary></dl>',
    '        <a href="/rates" class="bw-secondary-link">See how our rates work <i class="fas fa-arrow-right text-xs" aria-hidden="true"></i></a>',
    '      </section>',
    '      <p class="bw-error hidden" data-bw-error role="alert"></p>',
    '    </div>',
    '    <footer class="bw-footer" data-bw-footer>',
    '      <button type="button" class="bw-btn-ghost" data-bw-back><i class="fas fa-arrow-left text-xs" aria-hidden="true"></i> Back</button>',
    '      <div class="flex flex-1 items-center justify-end gap-3">',
    '        <a href="tel:+12483853432" class="bw-call"><i class="fas fa-phone" aria-hidden="true"></i> (248) 385-3432</a>',
    '        <button type="button" class="bw-btn-primary" data-bw-next>Continue <i class="fas fa-arrow-right text-xs" aria-hidden="true"></i></button>',
    '      </div>',
    '    </footer>',
    '  </div>',
    '</div>'
  ].join('');

  function buildTile(entry, group) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'bw-tile';
    button.setAttribute('data-bw-service', entry.service);
    button.setAttribute('aria-pressed', 'false');
    if (group === 'bundle') button.classList.add('bw-tile--bundle');
    if (group === 'quote') button.classList.add('bw-tile--quote');

    var icon = document.createElement('span');
    icon.className = 'bw-tile__icon';
    icon.innerHTML = '<i class="fas ' + (/^fa-[a-z0-9-]+$/.test(entry.icon) ? entry.icon : 'fa-wrench') + '" aria-hidden="true"></i>';
    button.appendChild(icon);

    var body = document.createElement('span');
    body.className = 'bw-tile__body';

    var label = document.createElement('span');
    label.className = 'bw-tile__label';
    label.textContent = entry.label;
    body.appendChild(label);

    var blurb = document.createElement('span');
    blurb.className = 'bw-tile__blurb';
    blurb.textContent = entry.blurb;
    body.appendChild(blurb);

    var meta = document.createElement('span');
    meta.className = 'bw-tile__meta';
    if (entry.quote) {
      meta.textContent = 'Free estimate';
    } else {
      meta.textContent = 'Approx. ' + plural(entry.hours) + ' · from ' + money(laborFor(entry));
      if (entry.discount) {
        var badge = document.createElement('span');
        badge.className = 'bw-chip bw-chip--save ml-2';
        badge.textContent = entry.discount + ' off labor';
        meta.appendChild(badge);
      }
      var laborOnly = document.createElement('span');
      laborOnly.className = 'bw-chip bw-chip--labor ml-2';
      laborOnly.textContent = 'Labor only';
      meta.appendChild(laborOnly);
    }
    body.appendChild(meta);

    button.appendChild(body);
    return button;
  }

  function buildFees() {
    var wrap = document.createElement('div');

    var heading = document.createElement('p');
    heading.className = 'bw-fees__title';
    heading.innerHTML = '<i class="fas fa-receipt text-red-300 mr-2" aria-hidden="true"></i>Before you send this';
    wrap.appendChild(heading);

    var list = document.createElement('ul');
    list.className = 'bw-fees__list';
    [
      'Prices shown are labor only.',
      MATERIALS_FEE_COPY,
      NON_CASH_FEE_COPY,
      'Nothing is charged now. This is a request — we confirm the window by phone or text first.'
    ].forEach(function (line) {
      var item = document.createElement('li');
      item.textContent = line;
      list.appendChild(item);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function build() {
    root = document.createElement('div');
    root.id = 'booking-widget';
    root.className = 'bw-root hidden';
    root.innerHTML = TEMPLATE;
    document.body.appendChild(root);

    els = {
      shell: root.querySelector('.bw-shell'),
      panes: {
        1: root.querySelector('[data-bw-pane="1"]'),
        2: root.querySelector('[data-bw-pane="2"]'),
        3: root.querySelector('[data-bw-pane="3"]'),
        done: root.querySelector('[data-bw-pane="done"]')
      },
      steps: Array.prototype.slice.call(root.querySelectorAll('[data-bw-step]')),
      categories: root.querySelector('[data-bw-categories]'),
      bundles: root.querySelector('[data-bw-bundles]'),
      quote: root.querySelector('[data-bw-quote]'),
      estimate: root.querySelector('[data-bw-estimate]'),
      date: root.querySelector('#bw-date'),
      dayNote: root.querySelector('[data-bw-daynote]'),
      windows: root.querySelector('[data-bw-windows]'),
      name: root.querySelector('#bw-name'),
      phone: root.querySelector('#bw-phone'),
      email: root.querySelector('#bw-email'),
      address: root.querySelector('#bw-address'),
      city: root.querySelector('#bw-city'),
      zip: root.querySelector('#bw-zip'),
      zipNote: root.querySelector('[data-bw-zipnote]'),
      notes: root.querySelector('#bw-notes'),
      fees: root.querySelector('[data-bw-fees]'),
      error: root.querySelector('[data-bw-error]'),
      status: root.querySelector('[data-bw-status]'),
      footer: root.querySelector('[data-bw-footer]'),
      back: root.querySelector('[data-bw-back]'),
      next: root.querySelector('[data-bw-next]'),
      summary: root.querySelector('[data-bw-summary]'),
      doneMessage: root.querySelector('[data-bw-done-message]')
    };

    CATEGORIES.forEach(function (entry) {
      els.categories.appendChild(buildTile(entry, 'category'));
    });
    BUNDLES.forEach(function (entry) {
      els.bundles.appendChild(buildTile(entry, 'bundle'));
    });
    els.quote.appendChild(buildTile(QUOTE, 'quote'));
    els.fees.appendChild(buildFees());

    var today = detroitToday();
    els.date.min = addDays(today, 1);
    els.date.max = addDays(today, 21);

    bindEvents();
  }

  /* --------------------------------------------------------------------- *
   * Rendering
   * --------------------------------------------------------------------- */

  function setError(message) {
    if (!els.error) return;
    if (!message) {
      els.error.classList.add('hidden');
      els.error.textContent = '';
      return;
    }
    els.error.textContent = message;
    els.error.classList.remove('hidden');
  }

  function announce(message) {
    if (els.status) els.status.textContent = message;
  }

  function renderSteps() {
    els.steps.forEach(function (step) {
      var index = Number(step.getAttribute('data-bw-step'));
      step.classList.toggle('is-active', index === state.step);
      step.classList.toggle('is-done', index < state.step);
    });
  }

  function renderTiles() {
    Array.prototype.slice.call(root.querySelectorAll('[data-bw-service]')).forEach(function (tile) {
      var selected = state.service && tile.getAttribute('data-bw-service') === state.service.service;
      tile.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function renderEstimate() {
    if (!state.service) {
      els.estimate.textContent = '';
      els.estimate.classList.add('hidden');
      return;
    }
    els.estimate.classList.remove('hidden');
    els.estimate.replaceChildren();

    var title = document.createElement('p');
    title.className = 'bw-estimate__title';
    title.textContent = state.service.label;
    els.estimate.appendChild(title);

    var detail = document.createElement('p');
    detail.className = 'bw-estimate__detail';
    if (state.service.quote) {
      detail.textContent = 'We will review your notes and send a written estimate before scheduling anything.';
    } else {
      var labor = laborFor(state.service);
      detail.textContent =
        'We block about ' + plural(state.service.hours) + ' on site — roughly ' + money(labor) + ' in labor' +
        (state.service.discount ? ' (already ' + state.service.discount + ' off the hourly rate)' : '') +
        '. Zone B adds $45 for travel.';
    }
    els.estimate.appendChild(detail);

    var tag = document.createElement('p');
    tag.className = 'bw-estimate__tag';
    tag.textContent = 'Labor only — ' + MATERIALS_FEE_COPY;
    els.estimate.appendChild(tag);
  }

  function renderDayNote() {
    var date = state.date;
    els.dayNote.className = 'bw-note';
    if (!date) {
      els.dayNote.textContent = 'Closed Sundays. We book up to three weeks out.';
      return;
    }
    if (weekdayOf(date) === 0) {
      els.dayNote.className = 'bw-note bw-note--warn';
      els.dayNote.textContent = 'We are closed Sundays. Please choose a Monday through Saturday date.';
      return;
    }
    var pieces = [];
    var day = dayAvailability(date);
    if (day) {
      pieces.push(
        day.openCount === 0
          ? 'Every window on ' + formatDay(date) + ' is taken.'
          : day.openCount + ' of ' + day.slots.length + ' windows open on ' + formatDay(date) + '.'
      );
    }
    // The route nudge: booking a city on its own route day means the van is
    // already in the neighbourhood, which is the whole point of the zones.
    if (state.zone && state.zone.days && state.zone.days.length) {
      if (state.zone.days.indexOf(weekdayOf(date)) !== -1) {
        pieces.push('That is an on-route day for ' + (state.zone.city || 'your area') + ' — fastest confirmation.');
      } else {
        pieces.push('We serve ' + (state.zone.city || 'your area') + ' on ' + state.zone.dayLabel + '. Off-route days are still fine, they just confirm a little slower.');
      }
    }
    els.dayNote.textContent = pieces.join(' ') || 'Closed Sundays. We book up to three weeks out.';
  }

  function renderWindows() {
    els.windows.replaceChildren();
    var date = state.date;
    if (!date || weekdayOf(date) === 0) {
      var hint = document.createElement('p');
      hint.className = 'bw-note';
      hint.textContent = 'Choose a date and the open arrival windows appear here.';
      els.windows.appendChild(hint);
      return;
    }

    var day = dayAvailability(date);
    var windows = ARRIVAL_WINDOWS[weekdayOf(date) === 6 ? 'saturday' : 'weekday'];

    windows.forEach(function (window_) {
      var slot = day
        ? (day.slots || []).filter(function (candidate) {
            return candidate.value === window_.value;
          })[0]
        : null;
      // No availability data means every window is offered.
      var available = !slot || slot.available !== false;

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'bw-window';
      button.disabled = !available;
      button.setAttribute('aria-pressed', state.time === window_.value ? 'true' : 'false');
      button.setAttribute('data-bw-window', window_.value);

      var part = document.createElement('span');
      part.className = 'bw-window__part';
      part.textContent = window_.part;
      button.appendChild(part);

      var value = document.createElement('span');
      value.className = 'bw-window__value';
      value.textContent = window_.value;
      button.appendChild(value);

      var status = document.createElement('span');
      status.className = available ? 'bw-window__status' : 'bw-window__status bw-window__status--taken';
      status.textContent = available ? 'Open' : 'Booked';
      button.appendChild(status);

      els.windows.appendChild(button);
    });
  }

  function renderZipNote() {
    var zip = els.zip.value.trim();
    els.zipNote.className = 'bw-zip-note';
    if (zip.length !== 5) {
      els.zipNote.textContent = '';
      return;
    }
    var resolved = resolveZip(zip);
    state.zone = resolved && resolved.served ? resolved : null;

    if (!resolved || !resolved.served) {
      els.zipNote.className = 'bw-zip-note bw-zip-note--bad';
      els.zipNote.textContent =
        zip + ' is outside our Oakland County service area. Call (248) 385-3432 and we will tell you straight away whether we can make the trip.';
      renderDayNote();
      return;
    }

    if (!resolved.known) {
      els.zipNote.className = 'bw-zip-note bw-zip-note--ok';
      els.zipNote.textContent = 'That looks like an Oakland County ZIP — we will confirm the zone when we call.';
      renderDayNote();
      return;
    }

    if (els.city && !els.city.value.trim()) els.city.value = resolved.city;

    els.zipNote.className = 'bw-zip-note bw-zip-note--ok';
    var zoneRate = resolved.zone === 'B' ? '$145 minimum service call (Zone B, 20+ miles)' : '$100 minimum service call (Zone A)';
    els.zipNote.textContent =
      resolved.city + ' — ' + zoneRate +
      (resolved.dayLabel ? '. We run the ' + resolved.routeLabel + ' on ' + resolved.dayLabel + '.' : '.');
    renderDayNote();
  }

  function renderFooter() {
    if (state.step === 'done') {
      els.footer.classList.add('hidden');
      return;
    }
    els.footer.classList.remove('hidden');
    els.back.classList.toggle('invisible', state.step === 1);
    if (state.step === 3) {
      els.next.innerHTML = 'Request My Booking <i class="fas fa-calendar-check text-xs" aria-hidden="true"></i>';
    } else {
      els.next.innerHTML = 'Continue <i class="fas fa-arrow-right text-xs" aria-hidden="true"></i>';
    }
    els.next.disabled = state.submitting;
  }

  function render() {
    Object.keys(els.panes).forEach(function (key) {
      var pane = els.panes[key];
      if (pane) pane.classList.toggle('hidden', String(state.step) !== key);
    });
    renderSteps();
    renderFooter();
  }

  function goTo(step) {
    state.step = step;
    setError();
    render();
    var pane = els.panes[String(step)];
    if (pane) {
      pane.scrollTop = 0;
      var focusTarget = pane.querySelector('input, button:not([disabled]), textarea, a[href]');
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    }
    if (els.shell) els.shell.scrollTop = 0;
    if (step === 2) announce('Step 2 of 3: choose a date and arrival window.');
    if (step === 3) announce('Step 3 of 3: your contact and address details.');
  }

  /* --------------------------------------------------------------------- *
   * Validation and submit
   * --------------------------------------------------------------------- */

  function validateStep(step) {
    if (step === 1) {
      if (!state.service) return 'Choose the type of work first.';
      return '';
    }
    if (step === 2) {
      if (!state.date) return 'Pick the day that suits you.';
      if (weekdayOf(state.date) === 0) return 'We are closed Sundays. Please choose a Monday through Saturday date.';
      if (state.date < els.date.min) return 'Booking requests need at least one day of notice.';
      if (state.date > els.date.max) return 'We book up to three weeks ahead. Call us for anything further out.';
      if (!state.time) return 'Choose an arrival window.';
      return '';
    }
    if (step === 3) {
      if (!els.name.value.trim()) return 'We need a name for the appointment.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(els.email.value.trim())) return 'Please enter a valid email address.';
      if (els.phone.value.replace(/\D/g, '').length < 10) return 'Please enter a 10-digit phone number.';
      if (!els.address.value.trim()) return 'We need the street address so we know where to drive.';
      var zip = els.zip.value.trim();
      if (!/^\d{5}$/.test(zip)) return 'Please enter the 5-digit ZIP code.';
      if (!OAKLAND_ZIP.test(zip)) {
        return zip + ' is outside our Oakland County service area. Call (248) 385-3432 and we will see what we can do.';
      }
      return '';
    }
    return '';
  }

  function renderSummary(payload) {
    els.summary.replaceChildren();
    [
      ['Job', payload.service],
      ['When', formatDay(payload.bookingDate) + ' · ' + payload.bookingTime],
      ['Where', payload.address + (payload.city ? ', ' + payload.city : '') + ' ' + payload.zip]
    ].forEach(function (pair) {
      var term = document.createElement('dt');
      term.className = 'bw-summary__term';
      term.textContent = pair[0];
      var value = document.createElement('dd');
      value.className = 'bw-summary__value';
      value.textContent = pair[1];
      els.summary.appendChild(term);
      els.summary.appendChild(value);
    });
  }

  function mirrorToNetlifyForms(payload) {
    // Same Netlify Forms handler /book posts to, so a booking taken from the
    // modal lands in the owner's inbox and dashboard exactly like the others.
    var form = new URLSearchParams();
    form.append('form-name', 'bookings');
    form.append('name', payload.customerName);
    form.append('email', payload.email);
    form.append('phone', payload.phone);
    form.append('service', payload.service);
    form.append('bookingDate', payload.bookingDate);
    form.append('bookingTime', payload.bookingTime);
    form.append(
      'message',
      [payload.message, 'Address: ' + payload.address + ', ' + (payload.city || '') + ' ' + payload.zip, 'Booked from: ' + payload.source]
        .filter(Boolean)
        .join('\n')
    );
    form.append('seasonal-opt-in', 'off');

    fetch('/book.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    }).catch(function (err) {
      console.error('Netlify Form submission failed:', err);
    });
  }

  function submit() {
    var payload = {
      customerName: sanitizeText(els.name.value, 120),
      email: els.email.value.trim().toLowerCase(),
      phone: sanitizeText(els.phone.value, 25),
      service: state.service.service,
      bookingDate: state.date,
      bookingTime: state.time,
      address: sanitizeText(els.address.value, 160),
      city: sanitizeText(els.city.value, 80),
      zip: els.zip.value.trim(),
      message: sanitizeText(els.notes.value, MAX_NOTES_LENGTH),
      source: window.location.pathname
    };

    state.submitting = true;
    els.next.disabled = true;
    els.next.innerHTML = 'Sending... <i class="fas fa-spinner animate-spin text-xs" aria-hidden="true"></i>';

    fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || 'We could not save that booking.');
          return data;
        });
      })
      .then(function (data) {
        mirrorToNetlifyForms(payload);
        renderSummary(payload);
        els.doneMessage.textContent =
          (data.message || 'We will call to confirm your window.') +
          (data.serviceArea && data.serviceArea.routeLabel
            ? ' You are on the ' + data.serviceArea.routeLabel + '.'
            : '');
        state.step = 'done';
        setError();
        render();
        announce('Booking request sent.');
        // Availability just changed; drop the cache so a second booking in the
        // same session does not offer a window this one just took.
        availabilityPromise = null;
        state.availability = null;
      })
      .catch(function (error) {
        setError(error.message + ' You can also call (248) 385-3432 and we will book it over the phone.');
      })
      .then(function () {
        state.submitting = false;
        renderFooter();
      });
  }

  /* --------------------------------------------------------------------- *
   * Events
   * --------------------------------------------------------------------- */

  function bindEvents() {
    root.addEventListener('click', function (event) {
      if (event.target.closest('[data-bw-close]')) {
        close();
        return;
      }

      var tile = event.target.closest('[data-bw-service]');
      if (tile) {
        state.service = findService(tile.getAttribute('data-bw-service'));
        renderTiles();
        renderEstimate();
        setError();
        goTo(2);
        loadAvailability().then(function () {
          renderWindows();
          renderDayNote();
        });
        return;
      }

      var window_ = event.target.closest('[data-bw-window]');
      if (window_ && !window_.disabled) {
        state.time = window_.getAttribute('data-bw-window');
        renderWindows();
        setError();
        return;
      }

      if (event.target.closest('[data-bw-back]')) {
        goTo(state.step === 3 ? 2 : 1);
        return;
      }

      if (event.target.closest('[data-bw-next]')) {
        var problem = validateStep(state.step);
        if (problem) {
          setError(problem);
          return;
        }
        if (state.step === 3) {
          submit();
        } else {
          goTo(state.step + 1);
        }
      }
    });

    els.date.addEventListener('change', function () {
      state.date = els.date.value;
      state.time = '';
      setError();
      renderWindows();
      renderDayNote();
    });

    els.zip.addEventListener('input', function () {
      els.zip.value = els.zip.value.replace(/\D/g, '').slice(0, 5);
      loadAreas().then(renderZipNote);
    });

    root.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== 'Tab') return;

      // Keep Tab inside the dialog. Without this the focus ring walks off into
      // the page behind the backdrop, which for a screen-reader user reads as
      // the dialog having silently closed.
      var focusable = Array.prototype.slice
        .call(root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])'))
        .filter(function (node) {
          return node.offsetParent !== null;
        });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  /* --------------------------------------------------------------------- *
   * Open / close
   * --------------------------------------------------------------------- */

  function reset() {
    state.step = 1;
    state.time = '';
    state.submitting = false;
    setError();
    if (els.date) els.date.value = state.date || '';
    renderTiles();
    renderEstimate();
    renderWindows();
    renderDayNote();
  }

  function open(options) {
    if (!root) build();
    lastFocused = document.activeElement;

    var preselect = options && options.service ? findService(options.service) : null;
    if (preselect) state.service = preselect;
    reset();

    root.classList.remove('hidden');
    document.documentElement.classList.add('bw-open');

    goTo(preselect ? 2 : 1);

    // Both fetches are fire-and-forget: the UI renders its fallback state
    // immediately and upgrades when the data lands.
    loadAreas();
    loadAvailability().then(function () {
      if (state.step === 2 || state.step === 1) {
        renderWindows();
        renderDayNote();
      }
    });
  }

  function close() {
    if (!root) return;
    root.classList.add('hidden');
    document.documentElement.classList.remove('bw-open');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  /* --------------------------------------------------------------------- *
   * Wiring
   * --------------------------------------------------------------------- */

  function init() {
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest(TRIGGER_SELECTOR);
      if (!trigger) return;
      // Modified clicks on a real link should still open /book in a new tab.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      open({ service: trigger.getAttribute('data-booking-service') || '' });
    });

    // /services#book-online and /rates#book-online open the modal straight
    // away, so a link from another page can land someone in the flow.
    if (window.location.hash === '#book-online' && document.querySelector(TRIGGER_SELECTOR)) {
      open({});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.AAABookingWidget = { open: open, close: close };
})();
