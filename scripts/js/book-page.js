/*
 * Behaviour for the /book request form: the first-service offer pre-tick, phone
 * formatting, validation, and submission.
 *
 * Previously a 29kB inline <script> that blocked the parse of the page it sits
 * on. External and deferred, it is minified, cached for a year, and no longer
 * in front of the first paint.
 */

(function () {
  // Check for offer=first-service URL parameter
  (function() {
      var params = new URLSearchParams(window.location.search);
      var offer = params.get('offer');
      var bookingOfferCheckbox = document.getElementById('booking-loyalty-credit') || document.getElementById('loyalty-credit') || document.getElementById('booking-first-service-certificate');
      if (offer === 'first-service' && bookingOfferCheckbox) {
          bookingOfferCheckbox.checked = true;
      }
  })();

  // Automatic phone number formatter
  const bookingPhone = document.getElementById('booking-phone');
  if (bookingPhone) {
      bookingPhone.addEventListener('input', function (e) {
          let val = e.target.value.replace(/\D/g, '');
          if (val.length > 10) val = val.substring(0, 10);
          const match = val.match(/^(\d{1,3})(\d{0,3})(\d{0,4})$/);
          if (match) {
              let formatted = "";
              if (match[1]) formatted += "(" + match[1];
              if (match[1].length === 3) formatted += ") ";
              if (match[2]) formatted += match[2];
              if (match[2].length === 3) formatted += "-";
              if (match[3]) formatted += match[3];
              e.target.value = formatted;
          }
      });
  }

  /*
   * Service address ZIP.
   *
   * Oakland County ZIPs all fall in 480xx-484xx, so the range check is a cheap
   * first pass that runs with no network at all. The lookup that follows fills
   * in the city and the route days from the same service-areas file the zone
   * banner reads -- it is a courtesy, not a gate, so a failed fetch never stops
   * anyone booking. /api/booking re-checks the ZIP either way.
   */
  const OAKLAND_ZIP = /^48[0-4]\d{2}$/;
  const bookingZip = document.getElementById('booking-zip');
  const bookingCity = document.getElementById('booking-city');
  const bookingZipNote = document.getElementById('booking-zip-note');

  if (bookingZip) {
      let areaData = null;
      let areaPromise = null;

      const loadAreas = () => {
          if (areaPromise) return areaPromise;
          areaPromise = fetch('/data/service-areas.json', { headers: { accept: 'application/json' } })
              .then(response => (response.ok ? response.json() : null))
              .then(json => {
                  areaData = json && Array.isArray(json.cities) ? json : null;
                  return areaData;
              })
              .catch(() => null);
          return areaPromise;
      };

      const cityForZip = zip => {
          if (!areaData) return null;
          // First match wins: a couple of ZIPs straddle two cities and the file
          // lists the one we actually route to first.
          return areaData.cities.find(entry => Array.isArray(entry.zips) && entry.zips.indexOf(zip) !== -1) || null;
      };

      const setZipNote = (text, tone) => {
          if (!bookingZipNote) return;
          bookingZipNote.textContent = text;
          bookingZipNote.className = tone === 'ok'
              ? 'mt-2 text-xs font-semibold text-emerald-400'
              : tone === 'bad'
                  ? 'mt-2 text-xs font-semibold text-red-300'
                  : 'mt-2 text-xs text-gray-400';
      };

      const describeZip = zip => {
          const match = cityForZip(zip);
          if (!match) {
              setZipNote('Inside our Oakland County service area.', 'ok');
              return;
          }
          if (bookingCity && !bookingCity.value.trim()) bookingCity.value = match.name;
          const route = areaData.routes && match.route ? areaData.routes[match.route] : null;
          // zones[].rate already reads "$100 Minimum Service Call".
          const rate = areaData.zones && areaData.zones[match.zone] ? areaData.zones[match.zone].rate : '';
          setZipNote(
              route
                  ? `${match.name} — Zone ${match.zone}${rate ? ', ' + rate : ''}. We are on your street ${route.dayLabel.toLowerCase()}.`
                  : `${match.name} — Zone ${match.zone}${rate ? ', ' + rate : ''}.`,
              'ok'
          );
      };

      bookingZip.addEventListener('input', () => {
          bookingZip.value = bookingZip.value.replace(/\D/g, '').slice(0, 5);
          const zip = bookingZip.value;

          if (zip.length < 5) {
              bookingZip.setCustomValidity('');
              setZipNote('Oakland County only. We fill in the city and your service days for you.', '');
              updateBookingCompletion();
              return;
          }

          if (!OAKLAND_ZIP.test(zip)) {
              bookingZip.setCustomValidity('We service Oakland County, Michigan only.');
              setZipNote(`${zip} is outside Oakland County — call (248) 385-3432 and we will see what we can do.`, 'bad');
              updateBookingCompletion();
              return;
          }

          bookingZip.setCustomValidity('');
          setZipNote('Checking your service days…', '');
          loadAreas().then(() => {
              // Guard against a slow lookup landing after the field moved on.
              if (bookingZip.value !== zip) return;
              describeZip(zip);
          });
          updateBookingCompletion();
      });
  }

  // Setup the guided booking widget and date constraints.
  const bookingForm = document.getElementById('booking-form');
  const submitBtn = document.getElementById('submit-btn');
  const bookingError = document.getElementById('booking-error');
  const bookingDateInput = document.getElementById('booking-date');
  const timeSlotsContainer = document.getElementById('time-slots-container');
  const timeSlotNote = document.getElementById('time-slot-note');
  const availabilityBadge = document.getElementById('booking-availability');
  const hiddenTimeInput = document.getElementById('booking-time');
  const requiredBookingFields = bookingForm ? Array.from(bookingForm.querySelectorAll('[required]:not(#booking-time)')) : [];

  function setBookingError(message = '') {
      if (!bookingError) return;
      bookingError.textContent = message;
      bookingError.classList.toggle('hidden', !message);
  }

  /*
   * "Please fill in the highlighted fields" is only honest when more than one is
   * empty. The browser already knows which field failed, so when it is a single
   * one we name it -- read off its own <label>, minus the required asterisk and
   * the "(optional)" qualifier, so the message and the form always agree.
   */
  function fieldLabel(field) {
      if (!field || !field.id || !bookingForm) return '';
      const label = bookingForm.querySelector('label[for="' + field.id + '"]');
      if (!label) return '';
      return label.textContent.replace(/\(optional\)/i, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function missingFieldsMessage() {
      const empty = requiredBookingFields.filter(field => !field.value.trim() || !field.checkValidity());
      if (empty.length === 1) {
          const name = fieldLabel(empty[0]);
          if (name) return 'Please fill in your ' + name + ' to continue.';
      }
      return 'Please fill in the highlighted fields.';
  }

  function updateBookingCompletion() {
      updateProgress();
      if (!bookingForm || !submitBtn) return;
      const fieldsComplete = requiredBookingFields.every(field => field.value.trim() && field.checkValidity());
      submitBtn.disabled = !(fieldsComplete && hiddenTimeInput.value);
  }

  /*
   * The three-step rail above the form.
   *
   * It reports progress rather than gating it -- every field is on one screen
   * and always reachable -- so each step is simply "are the fields behind it
   * answered", and the first unanswered one is the active step.
   */
  const progressSteps = Array.from(document.querySelectorAll('#booking-progress .booking-progress__step'));
  const progressStatus = document.getElementById('booking-progress-status');

  function setStepState(step, state) {
      if (step.dataset.state === state) return;
      step.dataset.state = state;
      const dot = step.querySelector('.booking-progress__dot');
      if (!dot) return;
      if (state === 'done') {
          const check = document.createElement('i');
          check.className = 'fas fa-check text-[11px]';
          check.setAttribute('aria-hidden', 'true');
          dot.replaceChildren(check);
      } else {
          dot.textContent = step.dataset.step || '';
      }
  }

  function updateProgress() {
      if (!progressSteps.length) return;
      // Looked up per call rather than closed over: this runs from
      // updateBookingCompletion, which fires before the later declarations in
      // this file have been initialised.
      const serviceField = document.getElementById('booking-service');
      const detailFields = ['booking-name', 'booking-email', 'booking-phone', 'booking-address', 'booking-zip'].map(id => document.getElementById(id));

      const done = [
          Boolean(serviceField && serviceField.value),
          Boolean(bookingDateInput && bookingDateInput.value && hiddenTimeInput && hiddenTimeInput.value),
          detailFields.every(field => field && field.value.trim() && field.checkValidity())
      ];

      const activeIndex = done.indexOf(false);
      progressSteps.forEach((step, index) => {
          setStepState(step, done[index] ? 'done' : (index === activeIndex ? 'active' : 'todo'));
      });

      if (progressStatus) {
          const completed = done.filter(Boolean).length;
          progressStatus.textContent = completed === done.length
              ? 'All three steps complete — your booking request is ready to send.'
              : `Step ${completed + 1} of 3.`;
      }
  }

  if (bookingDateInput) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      bookingDateInput.min = `${yyyy}-${mm}-${dd}`;

      bookingDateInput.addEventListener('change', function() {
          const dateVal = this.value;
          setBookingError();
          hiddenTimeInput.value = '';
          if (!dateVal) {
              renderTimeSlots('weekday');
              describeAvailability();
              updateBookingCompletion();
              return;
          }

          const parts = dateVal.split('-');
          const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
          const dayOfWeek = selectedDate.getDay();

          if (dayOfWeek === 0) {
              setBookingError('AAA Handyman Services LLC is closed on Sundays. Please choose a Monday–Saturday date.');              this.value = '';
              renderTimeSlots('weekday');
              describeAvailability();
              updateBookingCompletion();
              return;
          }

          renderTimeSlots(dayOfWeek === 6 ? 'saturday' : 'weekday');
          describeAvailability();
          updateBookingCompletion();
      });
  }

  /*
   * Arrival windows.
   *
   * These labels are the value the form submits and the string stored in the
   * booking's `booking_time` column, and /api/booking/availability matches its
   * rows against them, so the two lists have to stay identical to the ones in
   * netlify/functions/booking-availability.ts.
   */
  const ARRIVAL_WINDOWS = {
      weekday: [
          { value: '9:00 AM - 11:00 AM', start: '9:00 AM', end: '11:00 AM' },
          { value: '12:00 PM - 2:00 PM', start: '12:00 PM', end: '2:00 PM' },
          { value: '3:00 PM - 5:00 PM', start: '3:00 PM', end: '5:00 PM' }
      ],
      saturday: [
          { value: '10:00 AM - 12:00 PM', start: '10:00 AM', end: '12:00 PM' },
          { value: '12:30 PM - 2:30 PM', start: '12:30 PM', end: '2:30 PM' },
          { value: '3:00 PM - 5:00 PM', start: '3:00 PM', end: '5:00 PM' }
      ]
  };

  // Filled from /api/booking/availability. Left null until (and unless) that
  // call answers, and every read below treats null as "offer every window",
  // which is exactly how the form behaved before availability existed.
  let availabilityDays = null;
  let availabilityToday = '';

  const availabilityFor = (date) => (date && availabilityDays ? availabilityDays.get(date) || null : null);

  /* Day of the week for a YYYY-MM-DD string, read as a plain calendar date. */
  const isSaturday = (isoDate) => {
      if (!isoDate) return false;
      const [year, month, day] = isoDate.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay() === 6;
  };

  function selectTimeSlot(button) {
      const buttons = timeSlotsContainer ? Array.from(timeSlotsContainer.querySelectorAll('.time-slot-btn')) : [];
      buttons.forEach(other => {
          other.classList.remove('selected', 'bg-red-600');
          other.classList.add('bg-gray-800');
          other.setAttribute('aria-pressed', 'false');
      });

      button.classList.add('selected', 'bg-red-600');
      button.classList.remove('bg-gray-800');
      button.setAttribute('aria-pressed', 'true');
      hiddenTimeInput.value = button.dataset.value || '';
      setBookingError();
      updateBookingCompletion();
  }

  function buildTimeSlotButton(arrival, day) {
      const slot = day ? day.slots.find(entry => entry.value === arrival.value) : null;
      const booked = Boolean(slot && slot.available === false);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'time-slot-btn px-3 py-3.5 bg-gray-800 border-[2px] border-gray-700 rounded-xl font-semibold text-sm hover:border-gray-500 focus:outline-none text-center';
      button.dataset.value = arrival.value;
      button.setAttribute('aria-pressed', 'false');
      button.appendChild(document.createTextNode(arrival.start));

      const detail = document.createElement('span');
      detail.className = 'block text-[10px] text-gray-400 font-normal';
      detail.textContent = booked ? 'Already booked' : `to ${arrival.end}`;
      button.appendChild(detail);

      if (booked) {
          button.disabled = true;
          button.setAttribute('aria-label', `${arrival.start} to ${arrival.end} — already booked`);
      } else {
          button.addEventListener('click', () => selectTimeSlot(button));
      }

      return button;
  }

  function renderTimeSlots(type) {
      if (!timeSlotsContainer) return;
      const windows = ARRIVAL_WINDOWS[type === 'saturday' ? 'saturday' : 'weekday'];
      const day = availabilityFor(bookingDateInput ? bookingDateInput.value : '');

      timeSlotsContainer.replaceChildren(...windows.map(arrival => buildTimeSlotButton(arrival, day)));

      // Availability arrives after the first paint, so the grid can be redrawn
      // under a visitor who has already picked a window. Put their choice back
      // -- or, if it is the one that just filled up, take it away and say so
      // rather than letting them submit a window we cannot honour.
      const chosen = hiddenTimeInput ? hiddenTimeInput.value : '';
      if (chosen) {
          const match = Array.from(timeSlotsContainer.querySelectorAll('.time-slot-btn'))
              .find(button => button.dataset.value === chosen && !button.disabled);
          if (match) {
              selectTimeSlot(match);
          } else {
              hiddenTimeInput.value = '';
              setBookingError('That arrival window has just been booked. Please choose another.');
          }
      }

      if (timeSlotNote) {
          const bookedCount = day ? day.slots.filter(slot => slot.available === false).length : 0;
          timeSlotNote.textContent = bookedCount
              ? 'Struck-through windows are already reserved for another visit.'
              : '';
          timeSlotNote.classList.toggle('hidden', bookedCount === 0);
      }
  }

  /*
   * The availability badge under the date field.
   *
   * Every number it shows comes from real bookings, so it stays silent rather
   * than guessing: no data means no badge, and the form behaves as it always
   * has.
   */
  const AVAILABILITY_TONES = {
      open: 'mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300',
      tight: 'mt-2 flex items-center gap-2 rounded-lg border border-red-600/30 bg-red-600/10 px-3 py-2 text-xs font-semibold text-red-200',
      full: 'mt-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200'
  };

  function setAvailabilityBadge(tone, iconClass, text) {
      if (!availabilityBadge) return;
      if (!text) {
          availabilityBadge.className = 'hidden';
          availabilityBadge.replaceChildren();
          return;
      }
      const icon = document.createElement('i');
      icon.className = `fas ${iconClass} shrink-0`;
      icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = text;
      availabilityBadge.className = AVAILABILITY_TONES[tone] || AVAILABILITY_TONES.open;
      availabilityBadge.replaceChildren(icon, label);
  }

  const formatBookingDay = (isoDate) => {
      const [year, month, day] = isoDate.split('-').map(Number);
      const formatted = new Date(year, month - 1, day).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
      });
      // The API reports the calendar in Detroit time, which is the calendar the
      // business keeps; flagging tomorrow is worth it for the one day most
      // visitors are looking for.
      if (availabilityToday) {
          const [ty, tm, td] = availabilityToday.split('-').map(Number);
          const tomorrow = new Date(Date.UTC(ty, tm - 1, td + 1, 12)).toISOString().slice(0, 10);
          if (isoDate === tomorrow) return `${formatted} (tomorrow)`;
      }
      return formatted;
  };

  const nextOpenDay = (afterDate = '') =>
      (availabilityDays
          ? Array.from(availabilityDays.values())
              .filter(day => day.openCount > 0 && day.date > afterDate)
              .sort((a, b) => a.date.localeCompare(b.date))[0]
          : null) || null;

  function describeAvailability() {
      if (!availabilityBadge || !availabilityDays) return;

      const selected = bookingDateInput ? bookingDateInput.value : '';

      if (!selected) {
          const next = nextOpenDay();
          if (!next) {
              setAvailabilityBadge('full', 'fa-phone', 'The next three weeks are fully booked. Call (248) 385-3432 and we will find you a slot.');
              return;
          }
          const windows = next.openCount === 1 ? '1 arrival window open' : `${next.openCount} arrival windows open`;
          setAvailabilityBadge('open', 'fa-bolt', `Next opening: ${formatBookingDay(next.date)} — ${windows}`);
          return;
      }

      const day = availabilityDays.get(selected);
      if (!day) {
          // Beyond the three weeks the API reports on. Everything is open that
          // far out, so there is nothing worth claiming.
          setAvailabilityBadge('open', 'fa-calendar-check', '');
          return;
      }

      if (day.openCount === 0) {
          const next = nextOpenDay(selected);
          const suffix = next ? ` Next opening: ${formatBookingDay(next.date)}.` : ' Call (248) 385-3432 and we will find you a slot.';
          setAvailabilityBadge('full', 'fa-calendar-xmark', `${formatBookingDay(selected)} is fully booked.${suffix}`);
          return;
      }

      if (day.openCount === 1) {
          setAvailabilityBadge('tight', 'fa-bolt', `Only 1 arrival window left on ${formatBookingDay(selected)}.`);
          return;
      }

      setAvailabilityBadge('open', 'fa-bolt', `${day.openCount} of ${day.slots.length} arrival windows open on ${formatBookingDay(selected)}.`);
  }

  async function loadAvailability() {
      if (!availabilityBadge && !timeSlotsContainer) return;
      try {
          const response = await fetch('/api/booking/availability', { headers: { accept: 'application/json' } });
          if (!response.ok) return;
          const data = await response.json();
          if (!data || !Array.isArray(data.days)) return;

          availabilityToday = typeof data.today === 'string' ? data.today : '';
          availabilityDays = new Map(data.days.map(day => [day.date, day]));

          // Re-draw whatever the visitor is already looking at, now that the
          // booked windows are known.
          const selected = bookingDateInput ? bookingDateInput.value : '';
          renderTimeSlots(isSaturday(selected) ? 'saturday' : 'weekday');
          describeAvailability();
          updateBookingCompletion();
      } catch (error) {
          // A booking form that offers every window is a working booking form;
          // a broken availability call must never stand between a customer and
          // the submit button.
      }
  }

  renderTimeSlots('weekday');
  loadAvailability();
  requiredBookingFields.forEach(field => {
      field.addEventListener('input', updateBookingCompletion);
      field.addEventListener('change', updateBookingCompletion);
  });
  updateBookingCompletion();

  // Set service parameter from query string if available.
  //
  // Nothing derived from the URL is ever written as markup. Query values are
  // normalised through these helpers first: `sanitizeText` strips control
  // characters (including the NUL/newline tricks used to smuggle markup past
  // a naive filter) and caps the length to the same limit the API enforces,
  // and `safeInternalPath` rejects anything that is not a plain root-relative
  // path so a `javascript:`, `data:`, or cross-origin URL can never reach an
  // href. See the API's own `clean()` for the server-side counterpart.
  const MAX_NOTES_LENGTH = 700;

  const sanitizeText = (value, maxLength) =>
      String(value ?? '')
          .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, maxLength);

  const safeInternalPath = (value, fallback) => {
      const path = String(value ?? '');
      // A single leading slash not followed by another slash or a backslash:
      // "/services#x" passes, "//evil.example" and "/\evil.example" do not.
      return /^\/(?![/\\])[A-Za-z0-9\-._~/?#%&=+,:@!$'()*[\]]*$/.test(path) ? path : fallback;
  };

  const PACKAGE_DESCRIPTIONS = {
      "Maintenance Membership": {
          text: "Scheduled seasonal visits, priority booking, and member pricing all year long for $49/mo.",
          link: "/rates#time-packages"
      },
      "Seasonal Prep Package": {
          text: "Gutter cleaning, weatherstripping, window sash checks, and deck maintenance inspection. Protect your home before seasonal weather shifts!",
          link: "/services#services"
      },
      "Move-In / Move-Out Bundle": {
          text: "TV wall mounting, wall patching, paint touch-ups, and deadbolt/lock upgrades. Perfect for settling in or preparing to sell!",
          link: "/services#services"
      },
      "Senior Safety & Accessibility Package": {
          text: "Bathroom grab bar mounting, lever door handle conversions, non-slip stair treads, and handrail stability checks. Labor only — hardware and materials are billed separately or supplied by you.",
          link: "/services#services"
      },
      "4-Hour Handyman Package": {
          text: "4 Hours of reserved labor to work straight through a punch list of smaller repairs, adjustments, or upgrades. Save $31!",
          link: "/rates#packages"
      },
      "6-Hour Handyman Package": {
          text: "6 Productive hours for a longer punch list with room for repairs, maintenance, and light improvement projects. Save $45!",
          link: "/rates#packages"
      }
  };

  const bookingService = document.getElementById('booking-service');
  const servicePackageInfo = document.getElementById('service-package-info');

  const updatePackageDetails = () => {
      if (!bookingService || !servicePackageInfo) return;
      const val = bookingService.value;
      // Own-property lookup only. A bare `PACKAGE_DESCRIPTIONS[val]` also
      // resolves inherited keys ("constructor", "__proto__", "toString"),
      // which would hand the block below an object it never described.
      const desc = Object.prototype.hasOwnProperty.call(PACKAGE_DESCRIPTIONS, val)
          ? PACKAGE_DESCRIPTIONS[val]
          : null;
      if (desc) {
          servicePackageInfo.replaceChildren();

          const p = document.createElement('p');
          p.className = 'leading-relaxed';

          const infoIcon = document.createElement('i');
          infoIcon.className = 'fas fa-circle-info text-red-500 mr-2';
          infoIcon.setAttribute('aria-hidden', 'true');
          p.appendChild(infoIcon);

          const strong = document.createElement('strong');
          strong.textContent = `${val}:`;
          p.appendChild(strong);

          p.appendChild(document.createTextNode(` ${desc.text} `));

          const link = document.createElement('a');
          link.href = safeInternalPath(desc.link, '/services');
          link.target = '_blank';
          // Without noopener the new tab keeps a handle on this one and can
          // navigate the booking form away to a look-alike page.
          link.rel = 'noopener noreferrer';
          link.className = 'text-red-300 hover:text-red-200 underline font-semibold whitespace-nowrap ml-1';
          link.textContent = "See what's included ";

          const linkIcon = document.createElement('i');
          linkIcon.className = 'fas fa-arrow-up-right-from-square text-xs';
          linkIcon.setAttribute('aria-hidden', 'true');
          link.appendChild(linkIcon);

          p.appendChild(link);
          servicePackageInfo.appendChild(p);
          servicePackageInfo.classList.remove('hidden');
      } else {
          servicePackageInfo.classList.add('hidden');
          servicePackageInfo.replaceChildren();
      }
  };

  /*
   * The live cost estimate under the service picker.
   *
   * Every number here is the published rate: a $100 Zone A service call that
   * covers travel, diagnosis, and the first hour, $70 for each hour after that
   * in 15-minute increments, and a flat $45 more in Zone B (20+ miles). The
   * packages are those same hours less their package discount, shown as a dollar
   * amount so the panel can show the arithmetic rather than a number the
   * customer has to trust.
   */
  const SERVICE_CALL = 100;
  const HOURLY_RATE = 70;
  const ZONE_B_DIFFERENTIAL = 45;

  const standardLabor = (hours) => SERVICE_CALL + HOURLY_RATE * (hours - 1);
  const money = (amount) => `$${Math.round(amount).toLocaleString('en-US')}`;
  const formatHours = (hours) => (hours % 1 === 0.5 ? `${Math.floor(hours)}½` : String(hours));
  const plural = (hours) => `${formatHours(hours)} hour${hours === 1 ? '' : 's'}`;

  // Keys are the exact <option> values, so the panel and the submitted service
  // can never drift apart. Hours and discounts are the ones published on
  // /rates and /services, so the arithmetic shown here matches those pages.
  const SERVICE_ESTIMATES = {
      'Minor Repair & Upkeep (1 Hour)': { hours: 1 },
      'Fixture or Outlet Replacement (1.5 Hours)': { hours: 1.5 },
      'Carpentry & Installation (2 Hours)': { hours: 2 },
      '4-Hour Handyman Package': { hours: 4, price: 279 },
      '6-Hour Handyman Package': { hours: 6, price: 405 },
      'Seasonal Prep Package': { hours: 4.5, price: 311 },
      'Move-In / Move-Out Bundle': { hours: 5, price: 342 },
      'Senior Safety & Accessibility Package': { hours: 4, price: 279 },
      'Maintenance Membership': { membership: true },
      'General Estimate / Quote': { quote: true }
  };

  const bookingEstimate = document.getElementById('booking-estimate');

  const estimateRow = (label, value, emphasis = false) => {
      const row = document.createElement('li');
      row.className = 'flex items-baseline justify-between gap-4';

      const term = document.createElement('span');
      term.className = 'text-gray-400';
      term.textContent = label;

      const amount = document.createElement('span');
      amount.className = emphasis ? 'font-bold text-emerald-300 whitespace-nowrap' : 'font-semibold text-gray-200 whitespace-nowrap';
      amount.textContent = value;

      row.append(term, amount);
      return row;
  };

  /* The headline figure, its caption, and the rows beneath it, per service. */
  const describeEstimate = (service) => {
      const entry = Object.prototype.hasOwnProperty.call(SERVICE_ESTIMATES, service)
          ? SERVICE_ESTIMATES[service]
          : null;

      if (entry && entry.membership) {
          return {
              headline: '$49',
              suffix: '/month',
              caption: 'Membership plan — labor for each visit is quoted at the member rate',
              rows: [
                  ['Scheduled seasonal visits', '2–4 per year'],
                  ['Priority scheduling', 'Included'],
                  ['Seasonal home health checklist', 'Included']
              ]
          };
      }

      if (entry && entry.quote) {
          return {
              headline: 'Free',
              suffix: '',
              caption: 'The estimate itself is free and carries no obligation',
              rows: [
                  ['If you go ahead — first hour, Zone A', money(SERVICE_CALL)],
                  ['Each additional hour', `${money(HOURLY_RATE)} in 15-min increments`],
                  ['Zone B (20+ miles)', `${money(SERVICE_CALL + ZONE_B_DIFFERENTIAL)} first hour`]
              ]
          };
      }

      if (entry && entry.price) {
          const standard = standardLabor(entry.hours);
          const hoursLabel = `${plural(entry.hours)} at standard rates`;
          return {
              headline: money(entry.price),
              suffix: 'Zone A',
              caption: `${plural(entry.hours)} of reserved labor, ${money(standard - entry.price)} below the standard rate`,
              rows: [
                  [hoursLabel, money(standard)],
                  ['Package discount', `−${money(standard - entry.price)}`],
                  ['Zone B (20+ miles)', money(entry.price + ZONE_B_DIFFERENTIAL)]
              ]
          };
      }

      if (entry && entry.hours) {
          const total = standardLabor(entry.hours);
          const extraHours = entry.hours - 1;
          const rows = [['Service call — travel, diagnosis, first hour', money(SERVICE_CALL)]];
          if (extraHours > 0) {
              rows.push([`${plural(extraHours)} more at ${money(HOURLY_RATE)}/hr`, money(HOURLY_RATE * extraHours)]);
          }
          rows.push(['Zone B (20+ miles)', money(total + ZONE_B_DIFFERENTIAL)]);
          return {
              headline: money(total),
              suffix: 'Zone A',
              caption: `Budgeted at ${plural(entry.hours)} on site`,
              rows
          };
      }

      // Everything else is quoted off the standard rate once we know the scope.
      return {
          headline: money(SERVICE_CALL),
          suffix: 'first hour, Zone A',
          caption: 'Priced by time on site — describe the job below for a closer figure',
          rows: [
              ['Service call — travel, diagnosis, first hour', money(SERVICE_CALL)],
              ['Each additional hour', `${money(HOURLY_RATE)} in 15-min increments`],
              ['Zone B (20+ miles)', `${money(SERVICE_CALL + ZONE_B_DIFFERENTIAL)} first hour`]
          ]
      };
  };

  const renderEstimate = () => {
      if (!bookingEstimate) return;
      const service = bookingService ? bookingService.value : '';
      if (!service) {
          bookingEstimate.classList.add('hidden');
          bookingEstimate.replaceChildren();
          return;
      }

      const estimate = describeEstimate(service);

      const heading = document.createElement('p');
      heading.className = 'flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-emerald-300';
      const headingIcon = document.createElement('i');
      headingIcon.className = 'fas fa-calculator';
      headingIcon.setAttribute('aria-hidden', 'true');
      heading.append(headingIcon, document.createTextNode('Estimated cost'));

      const headline = document.createElement('p');
      headline.className = 'mt-2 text-3xl font-black leading-none text-white';
      headline.textContent = estimate.headline;
      if (estimate.suffix) {
          const suffix = document.createElement('span');
          suffix.className = 'ml-2 text-sm font-semibold text-gray-400';
          suffix.textContent = estimate.suffix;
          headline.appendChild(suffix);
      }

      const caption = document.createElement('p');
      caption.className = 'mt-1 text-xs text-gray-400';
      caption.textContent = estimate.caption;

      const rows = document.createElement('ul');
      rows.className = 'mt-3 space-y-1.5 border-t border-emerald-600/20 pt-3 text-xs';
      estimate.rows.forEach(([label, value]) => {
          // The savings line is the one number worth colouring.
          rows.appendChild(estimateRow(label, value, value.startsWith('−')));
      });

      const note = document.createElement('p');
      note.className = 'mt-3 text-[11px] leading-relaxed text-gray-500';
      note.textContent = 'Labor only. Hardware and materials are billed separately with a 20% supply fee, or supply your own at no markup. Nothing is charged today — Victor confirms the final price with you before any work begins. ';

      const rateLink = document.createElement('a');
      rateLink.href = '/rates';
      rateLink.className = 'font-semibold text-emerald-300 underline hover:text-emerald-200';
      rateLink.textContent = 'See full rates';
      note.appendChild(rateLink);

      bookingEstimate.replaceChildren(heading, headline, caption, rows, note);

      const entry = Object.prototype.hasOwnProperty.call(SERVICE_ESTIMATES, service)
          ? SERVICE_ESTIMATES[service]
          : null;
      if (entry && entry.quote) {
          const aiLink = document.createElement('a');
          aiLink.href = '/ai-estimate';
          aiLink.className = 'mt-3 flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-900/40 border border-emerald-500/40 text-xs font-semibold text-emerald-200 hover:text-white hover:bg-emerald-900/60 transition';

          const aiPrompt = document.createElement('span');
          const aiPromptIcon = document.createElement('i');
          aiPromptIcon.className = 'fas fa-wand-magic-sparkles text-emerald-400 mr-1.5';
          aiPromptIcon.setAttribute('aria-hidden', 'true');
          aiPrompt.append(aiPromptIcon, document.createTextNode('Want an instant estimate right now?'));

          const aiAction = document.createElement('span');
          aiAction.className = 'font-bold underline';
          aiAction.textContent = 'Try AI Estimator →';

          aiLink.append(aiPrompt, aiAction);
          bookingEstimate.appendChild(aiLink);
      }

      bookingEstimate.classList.remove('hidden');
  };

  /*
   * Quick-pick tiles.
   *
   * The <select> stays the field that validates and submits; the tiles are a
   * faster way to set it for the six services most people come here for, and
   * their pressed state is always read back off the select so the two cannot
   * disagree.
   */
  const serviceQuickPicks = Array.from(document.querySelectorAll('#service-quick-picks .service-tile'));

  const syncServiceUi = () => {
      const value = bookingService ? bookingService.value : '';
      serviceQuickPicks.forEach(tile => {
          tile.setAttribute('aria-pressed', String(tile.dataset.service === value));
      });
      updatePackageDetails();
      renderEstimate();
      updateBookingCompletion();
  };

  if (bookingService) {
      bookingService.addEventListener('change', syncServiceUi);
  }

  serviceQuickPicks.forEach(tile => {
      tile.addEventListener('click', () => {
          if (!bookingService) return;
          const wanted = tile.dataset.service || '';
          const match = Array.from(bookingService.options).find(option => option.value === wanted);
          if (!match) return;
          bookingService.value = wanted;
          setBookingError();
          syncServiceUi();
      });
  });

  (function prefillServiceFromQuery() {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('service');
      const requestedPkg = params.get('package');
      const requestedNotes = params.get('notes');

      const messageField = document.getElementById('booking-message');
      // `?notes=` lands in a field the customer then submits, so it is
      // reflected back to the owner's inbox and stored with the booking.
      // Sanitising it here keeps a crafted link from seeding the record with
      // control characters or padding past the API's own 700-char limit.
      const safeNotes = sanitizeText(requestedNotes, MAX_NOTES_LENGTH);
      if (safeNotes && messageField && !messageField.value.trim()) {
          messageField.value = safeNotes;
      }

      if (requestedPkg && bookingService) {
          const pkgMap = {
              'seasonal-prep': 'Seasonal Prep Package',
              'move-in-out': 'Move-In / Move-Out Bundle',
              'senior-safety': 'Senior Safety & Accessibility Package',
              '4-hour': '4-Hour Handyman Package',
              '6-hour': '6-Hour Handyman Package',
              'membership': 'Maintenance Membership',
              'maintenance-membership': 'Maintenance Membership'
          };
          const mappedPkg = pkgMap[requestedPkg];
          if (mappedPkg) {
              bookingService.value = mappedPkg;
              syncServiceUi();
              return;
          }
      }

      if (requested && bookingService) {
          const match = Array.from(bookingService.options).find(opt => opt.value === requested);
          if (match) {
              bookingService.value = requested;
          }
      }

      // Also covers the case where the browser restored a previously chosen
      // service on a back-navigation, which fires no change event.
      syncServiceUi();
  })();

  /*
   * The most recent homeowner reviews, above Douglas Mitchell's card.
   *
   * Whatever /api/reviews returns is what shows, newest first and unfiltered by
   * rating -- a strip that quietly dropped anything below five stars would not
   * be social proof. The card written into book.html stays put either way, so
   * the strip still reads as reviews when the call finds nothing.
   */
  const liveReviews = document.getElementById('booking-live-reviews');
  const featuredReview = liveReviews ? liveReviews.querySelector('[data-featured-review]') : null;
  const MAX_LIVE_REVIEWS = 3;
  const MAX_QUOTE_LENGTH = 130;

  const initialsOf = (name) => String(name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');

  const starRow = (rating) => {
      const rounded = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
      const row = document.createElement('span');
      row.className = 'flex items-center gap-0.5 text-[10px] text-yellow-500';
      row.setAttribute('role', 'img');
      row.setAttribute('aria-label', `${rounded} out of 5 stars`);
      for (let index = 0; index < rounded; index += 1) {
          const star = document.createElement('i');
          star.className = 'fas fa-star';
          star.setAttribute('aria-hidden', 'true');
          row.appendChild(star);
      }
      return row;
  };

  const buildReviewCard = (review) => {
      const card = document.createElement('article');
      card.className = 'flex items-start gap-3';

      const avatar = document.createElement('span');
      avatar.className = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600/90 text-xs font-black text-white';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = initialsOf(review.customerName) || '★';

      const body = document.createElement('div');
      body.className = 'min-w-0';

      const header = document.createElement('p');
      header.className = 'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-white';
      const who = document.createElement('span');
      who.textContent = review.location
          ? `${review.customerName} — ${review.location}`
          : String(review.customerName);
      header.append(who, starRow(review.rating));

      const quote = document.createElement('p');
      quote.className = 'mt-0.5 text-xs leading-relaxed text-gray-400';
      const text = String(review.review || '').trim();
      quote.textContent = text.length > MAX_QUOTE_LENGTH
          ? `“${text.slice(0, MAX_QUOTE_LENGTH - 1).trimEnd()}…”`
          : `“${text}”`;

      body.append(header, quote);
      card.append(avatar, body);
      return card;
  };

  async function loadBookingReviews() {
      if (!liveReviews) return;
      try {
          const response = await fetch('/api/reviews', { headers: { accept: 'application/json' } });
          if (!response.ok) return;
          const data = await response.json();
          const recent = (Array.isArray(data) ? data : [])
              .filter(review => review && review.customerName && review.review)
              .slice(0, MAX_LIVE_REVIEWS);
          if (!recent.length) return;

          const cards = recent.map(buildReviewCard);
          if (featuredReview) {
              featuredReview.before(...cards);
          } else {
              liveReviews.append(...cards);
          }
      } catch (error) {
          // Social proof is a bonus; the page already carries a testimonial.
      }
  }

  loadBookingReviews();

  const bookingPhoto = document.getElementById('booking-photo');
  const bookingPhotoDropzone = document.getElementById('booking-photo-dropzone');
  const bookingPhotoEmpty = document.getElementById('booking-photo-empty');
  const bookingPhotoPreviewWrap = document.getElementById('booking-photo-preview-wrap');
  const bookingPhotoPreview = document.getElementById('booking-photo-preview');
  const bookingPhotoName = document.getElementById('booking-photo-name');
  const bookingPhotoRemove = document.getElementById('booking-photo-remove');
  const bookingPhotoError = document.getElementById('booking-photo-error');
  const photoRule = window.AAAPhotoUpload;
  // One photo rides along with the booking's text fields in a single buffered
  // function request, capped at 6 MB, so this is the budget on the wire --
  // separate from the 10 MB the visitor is allowed to pick.
  const MAX_UPLOAD_PHOTO_BYTES = 4.5 * 1024 * 1024;
  /*
   * The photo is optional, and the three ways the browser can fail to downscale
   * one are indistinguishable to whoever picked it -- so they get one message,
   * and it says the thing worth knowing: the booking can still go in without it.
   */
  const PHOTO_UNREADABLE_MESSAGE = "We couldn't read that photo. Please choose a different image, or submit without one.";
  let bookingPhotoPreviewUrl = '';

  const showBookingPhotoError = (message = '') => {
      if (!bookingPhotoError) return;
      bookingPhotoError.textContent = message;
      bookingPhotoError.classList.toggle('hidden', !message);
  };

  const clearBookingPhoto = () => {
      if (bookingPhoto) bookingPhoto.value = '';
      if (bookingPhotoPreviewUrl) URL.revokeObjectURL(bookingPhotoPreviewUrl);
      bookingPhotoPreviewUrl = '';
      bookingPhotoPreview?.removeAttribute('src');
      bookingPhotoPreviewWrap?.classList.add('hidden');
      bookingPhotoPreviewWrap?.classList.remove('flex');
      bookingPhotoEmpty?.classList.remove('hidden');
      showBookingPhotoError();
  };

  const updateBookingPhotoPreview = () => {
      const file = bookingPhoto?.files?.[0];
      if (!file) {
          clearBookingPhoto();
          return;
      }
      const rejection = photoRule.rejectionFor(file);
      if (rejection) {
          clearBookingPhoto();
          showBookingPhotoError(rejection);
          return;
      }
      if (bookingPhotoPreviewUrl) URL.revokeObjectURL(bookingPhotoPreviewUrl);
      // The shared helper labels the blob with one of the four accepted image
      // types and checks the scheme, so what lands on src is a URL this page
      // made rather than a string that came out of the file picker.
      bookingPhotoPreviewUrl = photoRule.previewUrl(file);
      if (bookingPhotoPreview) {
          if (bookingPhotoPreviewUrl) bookingPhotoPreview.src = bookingPhotoPreviewUrl;
          else bookingPhotoPreview.removeAttribute('src');
      }
      bookingPhotoName.textContent = file.name || 'Repair photo';
      bookingPhotoEmpty?.classList.add('hidden');
      bookingPhotoPreviewWrap?.classList.remove('hidden');
      bookingPhotoPreviewWrap?.classList.add('flex');
      showBookingPhotoError();
  };

  const prepareBookingPhoto = (file) =>
      photoRule.prepare(file, MAX_UPLOAD_PHOTO_BYTES).catch((error) => {
          // An oversized GIF names its own fix, so that message goes through
          // as-is. Everything else is one of the interchangeable ways decoding
          // can fail, and gets the wording that mentions submitting without.
          if (error && error.code === 'gif-too-large') throw error;
          throw new Error(PHOTO_UNREADABLE_MESSAGE);
      });

  bookingPhoto?.addEventListener('change', updateBookingPhotoPreview);
  bookingPhotoRemove?.addEventListener('click', (event) => {
      event.preventDefault();
      clearBookingPhoto();
  });

  if (bookingPhotoDropzone && bookingPhoto) {
      ['dragenter', 'dragover'].forEach((eventName) => {
          bookingPhotoDropzone.addEventListener(eventName, (event) => {
              event.preventDefault();
              bookingPhotoDropzone.classList.add('border-red-500', 'bg-gray-900/70');
          });
      });
      ['dragleave', 'drop'].forEach((eventName) => {
          bookingPhotoDropzone.addEventListener(eventName, (event) => {
              event.preventDefault();
              bookingPhotoDropzone.classList.remove('border-red-500', 'bg-gray-900/70');
          });
      });
      bookingPhotoDropzone.addEventListener('drop', (event) => {
          const file = event.dataTransfer?.files?.[0];
          if (!file) return;
          const transfer = new DataTransfer();
          transfer.items.add(file);
          bookingPhoto.files = transfer.files;
          updateBookingPhotoPreview();
      });
  }

  // Form submission via API
  if (bookingForm) {
      bookingForm.addEventListener('submit', async function(e) {
          e.preventDefault();

          // Validation
          const name = document.getElementById('booking-name').value.trim();
          const email = document.getElementById('booking-email').value.trim();
          const phone = document.getElementById('booking-phone').value.trim();
          const address = document.getElementById('booking-address').value.trim();
          const city = document.getElementById('booking-city').value.trim();
          const zip = document.getElementById('booking-zip').value.trim();
          const service = document.getElementById('booking-service').value;
          const bookingDate = document.getElementById('booking-date').value;
          const bookingTime = hiddenTimeInput.value;
          const message = document.getElementById('booking-message').value.trim();
          const optIn = document.getElementById('seasonal-opt-in').checked;
          const certificateBox = document.getElementById('booking-loyalty-credit') || document.getElementById('loyalty-credit') || document.getElementById('booking-first-service-certificate');
          const claimedCertificate = Boolean(certificateBox && certificateBox.checked && !certificateBox.disabled);

          setBookingError();
          if (!bookingForm.checkValidity()) {
              bookingForm.reportValidity();
              setBookingError(missingFieldsMessage());
              updateBookingCompletion();
              return;
          }

          if (!bookingTime) {
              setBookingError('Please select an arrival window.');
              return;
          }

          if (!OAKLAND_ZIP.test(zip)) {
              setBookingError('That ZIP code is outside our Oakland County service area. Call (248) 385-3432 and we will let you know if we can make the trip.');
              return;
          }

          submitBtn.disabled = true;
          const sendingIcon = document.createElement('i');
          sendingIcon.className = 'fas fa-spinner animate-spin';
          sendingIcon.setAttribute('aria-hidden', 'true');
          submitBtn.replaceChildren(document.createTextNode('Sending your request… '), sendingIcon);

          try {
              const sourcePhoto = bookingPhoto?.files?.[0] || null;
              // prepareBookingPhoto either returns a file inside the budget or
              // throws, so there is nothing left to check on the way out.
              const uploadPhoto = sourcePhoto ? await prepareBookingPhoto(sourcePhoto) : null;

              const requestData = new FormData();
              requestData.append('customerName', name);
              requestData.append('email', email);
              requestData.append('phone', phone);
              requestData.append('address', address);
              requestData.append('city', city);
              requestData.append('zip', zip);
              requestData.append('service', service);
              requestData.append('bookingDate', bookingDate);
              requestData.append('bookingTime', bookingTime);
              requestData.append('message', message);
              requestData.append('seasonal-opt-in', optIn ? 'on' : 'off');
              requestData.append('firstServiceGiftCertificate', claimedCertificate ? 'on' : 'off');
              // The on-page checkbox is now named preferred_client_discount, so
              // mirror it under that name too -- the API accepts either spelling
              // and the Netlify Forms notification uses this field name.
              requestData.append('preferred_client_discount', claimedCertificate ? 'yes' : 'off');
              if (uploadPhoto) requestData.append('photo', uploadPhoto, uploadPhoto.name);

              /*
               * The honeypot the widget-free form still carries. This body is
               * assembled field by field rather than from
               * `new FormData(bookingForm)`, so it did not come along on its
               * own, and /api/booking checks it along with the reCAPTCHA
               * token when one is configured. The form no longer renders a
               * reCAPTCHA widget, so no token is forwarded; the mirror post
               * to /book.html below likewise leaves any token out: it is
               * single-use, and the API is the one verifying it.
               */
              const bookingHoneypot = bookingForm.querySelector('[name="bot-field"]');
              if (bookingHoneypot) requestData.append('bot-field', bookingHoneypot.value);

              const response = await fetch('/api/booking', {
                  method: 'POST',
                  body: requestData
              });
              const data = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(data.error || "We couldn't send your booking request.");

              // The API decides whether the certificate was actually applied
              // -- it is one per customer and the booking may be a repeat. Any
              // "redeemed" verdict is mirrored into local storage so the offer
              // stops rendering for this visitor site-wide.
              const giftCertificate = data.giftCertificate || {};
              if (giftCertificate.firstServiceGiftRedeemed && window.AAAGiftCertificate) {
                  window.AAAGiftCertificate.markRedeemed(email, {
                      name: name,
                      source: 'booking_form',
                      redeemedAt: giftCertificate.redeemedAt,
                      serverConfirmed: true
                  });
              }

              // Nice confirmation details update
              document.getElementById('summary-service').innerText = service;
              
              // Format date nicely (e.g. 2026-07-22 to July 22, 2026)
              try {
                  const parts = bookingDate.split('-');
                  const d = new Date(parts[0], parts[1] - 1, parts[2]);
                  const formattedDate = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                  document.getElementById('summary-date').innerText = `${formattedDate} (${bookingTime})`;
              } catch (err) {
                  document.getElementById('summary-date').innerText = `${bookingDate} (${bookingTime})`;
              }

              // Forward booking to Netlify Forms for email alert and dashboard integration
              const netlifyFormData = new URLSearchParams();
              netlifyFormData.append('form-name', 'bookings');
              netlifyFormData.append('name', name);
              netlifyFormData.append('email', email);
              netlifyFormData.append('phone', phone);
              netlifyFormData.append('address', address);
              // The server may have resolved a nicer city name from the ZIP than
              // whatever was typed, so prefer its answer for the owner's copy.
              netlifyFormData.append('city', data.serviceArea?.city || city);
              netlifyFormData.append('zip', zip);
              netlifyFormData.append('service', service);
              netlifyFormData.append('bookingDate', bookingDate);
              netlifyFormData.append('bookingTime', bookingTime);
              netlifyFormData.append('message', message);
              netlifyFormData.append('seasonal-opt-in', optIn ? 'on' : 'off');
              // Tell the owner which bookings actually carry the $50 discount,
              // and flag a repeat claim so it can be explained rather than honoured twice.
              if (giftCertificate.applied) {
                  netlifyFormData.append('preferred_client_discount', 'Applied — $50 Preferred Client follow-up discount');
              } else if (claimedCertificate) {
                  netlifyFormData.append('preferred_client_discount', 'Not applied — already redeemed on an earlier service');
              }
              if (data.booking?.photoUrl) {
                  // Resolve against this origin and forward it only when it
                  // stayed here, so a tampered API response cannot plant an
                  // off-site or javascript: link in the owner's notification.
                  const resolved = new URL(data.booking.photoUrl, window.location.origin);
                  if (resolved.origin === window.location.origin && (resolved.protocol === 'https:' || resolved.protocol === 'http:')) {
                      netlifyFormData.append('photoUrl', resolved.href);
                  }
              }

              /*
               * Fire-and-forget mirror: the booking is already saved by
               * /api/booking, this copy only feeds the owner's inbox and the
               * dashboard. Netlify answers a rejected submission with a 4xx
               * that still resolves, so a network-level .catch() alone never
               * fired and the failure stayed invisible -- check response.ok
               * too. The form no longer requires a reCAPTCHA token (the API
               * verified the honeypot and, when configured, the token
               * server-side), so this post now satisfies everything /book.html
               * asks for.
               */
              (async () => {
                  try {
                      const mirrorResponse = await fetch('/book.html', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                          body: netlifyFormData.toString()
                      });
                      if (!mirrorResponse.ok) {
                          console.error('Netlify Form mirror rejected the booking:', mirrorResponse.status);
                      }
                  } catch (err) {
                      console.error('Netlify Form submission failed:', err);
                  }
              })();

              // Toggle States
              bookingForm.classList.add('hidden');
              document.getElementById('success-state').classList.remove('hidden');
          } catch (error) {
              // The message already says what failed; this adds the way out.
              setBookingError(`${error.message} You can also call (248) 385-3432 and we'll book it over the phone.`);
              submitBtn.disabled = false;
              const bookingIcon = document.createElement('i');
              bookingIcon.className = 'fas fa-calendar-check';
              bookingIcon.setAttribute('aria-hidden', 'true');
              submitBtn.replaceChildren(document.createTextNode('Request My Booking '), bookingIcon);
          }
      });
  }
})();
