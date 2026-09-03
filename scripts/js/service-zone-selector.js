/*
 * "Select your city" route-day banner.
 *
 * One van covers the whole county, so the schedule is run as three standing
 * routes rather than a free-for-all -- the north and lakes loop on Mondays and
 * Thursdays, the west corridor on Tuesdays and Fridays, the east and south
 * metro on Wednesdays and Saturdays. Telling a customer which day their street
 * is already being driven does two things at once: they pick that day, and the
 * route stays dense.
 *
 * Wiring: drop in a container with `data-zone-selector`. The markup below is
 * generated, so a page only needs the empty element. Cities, zones, and route
 * days all come from public/data/service-areas.json, the same file the booking
 * widget and the city pages read.
 *
 * A remembered choice is kept in localStorage so someone who told us they are
 * in Troy on the Services page does not get asked again on the booking page.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'aaa-service-city';
  var containers = [];
  var data = null;

  function readStoredCity() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || '';
    } catch (err) {
      // Private browsing and blocked storage both throw. The selector still
      // works, it just forgets between pages.
      return '';
    }
  }

  function storeCity(slug) {
    try {
      window.localStorage.setItem(STORAGE_KEY, slug);
    } catch (err) {
      /* Nothing to do: remembering the city is a convenience, not a feature. */
    }
  }

  function routeFor(city) {
    if (!city || !city.route) return null;
    return Object.prototype.hasOwnProperty.call(data.routes, city.route) ? data.routes[city.route] : null;
  }

  function cityBySlug(slug) {
    for (var i = 0; i < data.cities.length; i += 1) {
      if (data.cities[i].slug === slug) return data.cities[i];
    }
    return null;
  }

  /**
   * "Mondays & Thursdays" -> "Monday". The button reads "Book a Monday slot",
   * so it wants one day, singular.
   */
  function firstDayName(route) {
    return route.dayLabel.split(' & ')[0].replace(/s$/, '');
  }

  /** Today's weekday in Detroit, so "today is a route day" is true locally. */
  function detroitWeekday() {
    try {
      var name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', weekday: 'short' }).format(new Date());
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
    } catch (err) {
      return new Date().getDay();
    }
  }

  function buildSelect(container) {
    var wrap = document.createElement('div');
    wrap.className = 'flex flex-col gap-2 sm:flex-row sm:items-center';

    var label = document.createElement('label');
    label.className = 'text-xs font-extrabold uppercase tracking-[0.12em] text-gray-300';
    label.textContent = 'Select your city';
    var selectId = 'zone-select-' + containers.length;
    label.htmlFor = selectId;
    wrap.appendChild(label);

    var select = document.createElement('select');
    select.id = selectId;
    select.className =
      'w-full rounded-lg border border-white/25 bg-blue-950/70 px-3 py-2 text-sm font-semibold text-white focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 sm:w-auto';

    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choose your city…';
    select.appendChild(placeholder);

    // Grouped by route so the three service days read as three groups, which
    // is the point the banner is making.
    Object.keys(data.routes).forEach(function (routeKey) {
      var route = data.routes[routeKey];
      var group = document.createElement('optgroup');
      group.label = route.label + ' — ' + route.dayLabel;
      data.cities
        .filter(function (city) {
          return city.route === routeKey;
        })
        .forEach(function (city) {
          var option = document.createElement('option');
          option.value = city.slug;
          option.textContent = city.name;
          group.appendChild(option);
        });
      if (group.children.length) select.appendChild(group);
    });

    wrap.appendChild(select);
    return { wrap: wrap, select: select };
  }

  function renderDetail(detail, slug) {
    detail.replaceChildren();
    var city = slug ? cityBySlug(slug) : null;

    if (!city) {
      var prompt = document.createElement('p');
      prompt.className = 'text-sm leading-relaxed text-gray-300';
      prompt.textContent =
        data.routeNote
          ? 'We run three standing routes across Oakland County. Pick your city to see the days we are already in your neighborhood.'
          : '';
      detail.appendChild(prompt);
      return;
    }

    var route = routeFor(city);

    var heading = document.createElement('p');
    heading.className = 'flex flex-wrap items-center gap-2 text-base font-extrabold text-white';
    var pin = document.createElement('i');
    pin.className = 'fas fa-location-dot text-red-400';
    pin.setAttribute('aria-hidden', 'true');
    heading.appendChild(pin);
    heading.appendChild(document.createTextNode(city.name));

    var zoneChip = document.createElement('span');
    zoneChip.className =
      city.zone === 'B'
        ? 'rounded-full bg-red-600/20 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-red-200'
        : 'rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-emerald-200';
    var zone = Object.prototype.hasOwnProperty.call(data.zones, city.zone) ? data.zones[city.zone] : null;
    // zones[].rate reads "$100 Minimum Service Call" -- too long for a chip, so
    // the chip keeps the number and drops the sentence.
    zoneChip.textContent = zone ? zone.rate.split(' ')[0] + ' minimum' : 'Zone ' + city.zone;
    heading.appendChild(zoneChip);
    detail.appendChild(heading);

    if (route) {
      var days = document.createElement('p');
      days.className = 'mt-2 text-sm leading-relaxed text-gray-200';
      var strong = document.createElement('strong');
      strong.className = 'text-white';
      strong.textContent = 'Service days: ' + route.dayLabel + '. ';
      days.appendChild(strong);
      days.appendChild(document.createTextNode(route.blurb));
      detail.appendChild(days);

      var today = detroitWeekday();
      var onRouteToday = route.days.indexOf(today) !== -1;
      var status = document.createElement('p');
      status.className = onRouteToday
        ? 'mt-2 text-sm font-bold text-emerald-300'
        : 'mt-2 text-sm text-gray-400';
      status.textContent = onRouteToday
        ? 'We are on the ' + route.label + ' today.'
        : 'Booking an on-route day usually means a same-week confirmation. Off-route days are still available.';
      detail.appendChild(status);
    }

    var actions = document.createElement('p');
    actions.className = 'mt-3 flex flex-wrap gap-3';

    // Bookings run through the Google Calendar embed inside #booking-section
    // now (the old #booking-form is gone), so the button scrolls to it.
    var book = document.createElement('a');
    book.href = '#booking-section';
    book.className =
      'inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-red-700';
    book.textContent = 'Book a ' + (route ? firstDayName(route) : 'visit') + ' slot ';
    var bookIcon = document.createElement('i');
    bookIcon.className = 'fas fa-calendar-day text-xs';
    bookIcon.setAttribute('aria-hidden', 'true');
    book.appendChild(bookIcon);
    actions.appendChild(book);

    var page = document.createElement('a');
    // City pages are published under /handyman/<slug> -- see the _redirects
    // rule. /service-areas is the single index page, not a directory, so a
    // slug appended to it is a 404.
    page.href = '/handyman/' + city.slug;
    page.className = 'inline-flex items-center gap-2 px-1 py-2 text-sm font-bold text-red-300 hover:text-red-200';
    page.textContent = 'Handyman in ' + city.name + ' ';
    var pageIcon = document.createElement('i');
    pageIcon.className = 'fas fa-arrow-right text-xs';
    pageIcon.setAttribute('aria-hidden', 'true');
    page.appendChild(pageIcon);
    actions.appendChild(page);

    detail.appendChild(actions);
  }

  function mount(container) {
    var built = buildSelect(container);
    var detail = document.createElement('div');
    detail.className = 'mt-4 rounded-xl border border-white/15 bg-blue-950/40 p-4';
    detail.setAttribute('role', 'status');
    detail.setAttribute('aria-live', 'polite');

    container.replaceChildren(built.wrap, detail);

    var stored = readStoredCity();
    if (stored && cityBySlug(stored)) built.select.value = stored;
    renderDetail(detail, built.select.value);

    built.select.addEventListener('change', function () {
      storeCity(built.select.value);
      renderDetail(detail, built.select.value);
      // Keep every other banner on the page in step, so the one beside the
      // booking form does not contradict the one in the hero.
      containers.forEach(function (other) {
        if (other.select === built.select) return;
        other.select.value = built.select.value;
        renderDetail(other.detail, built.select.value);
      });
    });

    containers.push({ select: built.select, detail: detail });
  }

  function init() {
    var targets = Array.prototype.slice.call(document.querySelectorAll('[data-zone-selector]'));
    if (!targets.length) return;

    fetch('/data/service-areas.json', { headers: { accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('Service areas unavailable');
        return response.json();
      })
      .then(function (json) {
        if (!json || !Array.isArray(json.cities) || !json.routes) throw new Error('Service areas malformed');
        data = json;
        targets.forEach(mount);
      })
      .catch(function () {
        // Leave whatever static fallback copy the page shipped with in place
        // rather than replacing it with an error nobody can act on.
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
