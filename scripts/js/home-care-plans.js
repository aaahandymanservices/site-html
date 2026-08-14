/*
 * Quarterly Home Care Plan section on /services.
 *
 * Two jobs:
 *   1. The monthly/annual toggle. Both prices ship in the markup as data
 *      attributes so the cards are correct and indexable before this file
 *      runs -- the toggle only swaps which number is showing.
 *   2. The signup form. "Subscribe Now" reveals one shared form rather than
 *      three, pre-set to the plan that was clicked, and posts it to
 *      /api/home-care-subscription.
 *
 * Nothing is charged here. The row it creates is a callback request, which is
 * why the copy says so twice and the button does not say "Pay".
 */
(function () {
  'use strict';

  var section = document.getElementById('home-care-plans');
  if (!section) return;

  var PLAN_NAMES = {
    essential: 'Essential',
    complete: 'Complete',
    'complete-plus': 'Complete Plus'
  };

  var OAKLAND_ZIP = /^48[0-4]\d{2}$/;

  var cycle = 'monthly';

  var toggles = Array.prototype.slice.call(section.querySelectorAll('[data-plan-cycle]'));
  var prices = Array.prototype.slice.call(section.querySelectorAll('[data-plan-price]'));
  var periods = Array.prototype.slice.call(section.querySelectorAll('[data-plan-period]'));
  var savings = Array.prototype.slice.call(section.querySelectorAll('[data-plan-saving]'));

  var form = section.querySelector('#home-care-form');
  var formWrap = section.querySelector('#home-care-form-wrap');
  var planField = section.querySelector('#home-care-plan');
  var cycleField = section.querySelector('#home-care-cycle');
  var summary = section.querySelector('[data-plan-summary]');
  var error = section.querySelector('[data-plan-error]');
  var success = section.querySelector('[data-plan-success]');
  var submitBtn = section.querySelector('#home-care-submit');
  var zipField = section.querySelector('#home-care-zip');
  var zipNote = section.querySelector('[data-plan-zipnote]');

  /* ------------------------------------------------------------------ *
   * Pricing display
   * ------------------------------------------------------------------ */

  function renderPrices() {
    prices.forEach(function (node) {
      var value = cycle === 'annual' ? node.getAttribute('data-annual') : node.getAttribute('data-monthly');
      node.textContent = '$' + value;
    });
    periods.forEach(function (node) {
      node.textContent = cycle === 'annual' ? '/year' : '/month';
    });
    savings.forEach(function (node) {
      node.classList.toggle('hidden', cycle !== 'annual');
    });
    toggles.forEach(function (button) {
      button.setAttribute('aria-pressed', button.getAttribute('data-plan-cycle') === cycle ? 'true' : 'false');
    });
    if (cycleField) cycleField.value = cycle;
    renderSummary();
  }

  function renderSummary() {
    if (!summary || !planField) return;
    var plan = planField.value;
    if (!Object.prototype.hasOwnProperty.call(PLAN_NAMES, plan)) {
      summary.textContent = '';
      return;
    }
    var card = section.querySelector('[data-plan-card="' + plan + '"] [data-plan-price]');
    var price = card ? card.getAttribute(cycle === 'annual' ? 'data-annual' : 'data-monthly') : '';
    summary.textContent =
      PLAN_NAMES[plan] + ' plan — $' + price + (cycle === 'annual' ? ' billed once a year (two months free)' : ' a month') + '.';
  }

  toggles.forEach(function (button) {
    button.addEventListener('click', function () {
      cycle = button.getAttribute('data-plan-cycle') === 'annual' ? 'annual' : 'monthly';
      renderPrices();
    });
  });

  /* ------------------------------------------------------------------ *
   * Opening the form
   * ------------------------------------------------------------------ */

  Array.prototype.slice.call(section.querySelectorAll('[data-plan-subscribe]')).forEach(function (button) {
    button.addEventListener('click', function () {
      var plan = button.getAttribute('data-plan-subscribe');
      if (!Object.prototype.hasOwnProperty.call(PLAN_NAMES, plan)) return;
      if (planField) planField.value = plan;
      if (formWrap) formWrap.classList.remove('hidden');
      renderSummary();
      if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var firstField = form ? form.querySelector('input:not([type="hidden"])') : null;
      if (firstField) {
        // Wait for the smooth scroll to settle before pulling focus, or the
        // browser jumps the page and the animation reads as a glitch.
        window.setTimeout(function () {
          firstField.focus({ preventScroll: true });
        }, 350);
      }
    });
  });

  if (planField) planField.addEventListener('change', renderSummary);

  /* ------------------------------------------------------------------ *
   * ZIP check
   * ------------------------------------------------------------------ */

  if (zipField) {
    zipField.addEventListener('input', function () {
      zipField.value = zipField.value.replace(/\D/g, '').slice(0, 5);
      if (!zipNote) return;
      var zip = zipField.value;
      if (zip.length !== 5) {
        zipNote.textContent = '';
        zipNote.className = 'mt-1 text-xs text-gray-400';
        return;
      }
      if (OAKLAND_ZIP.test(zip)) {
        zipNote.textContent = 'Inside our Oakland County service area.';
        zipNote.className = 'mt-1 text-xs font-semibold text-emerald-300';
      } else {
        zipNote.textContent = zip + ' is outside Oakland County — call (248) 385-3432 and we will see what we can do.';
        zipNote.className = 'mt-1 text-xs font-semibold text-red-300';
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Submit
   * ------------------------------------------------------------------ */

  function setError(message) {
    if (!error) return;
    error.textContent = message || '';
    error.classList.toggle('hidden', !message);
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      setError('');

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var payload = {
        customerName: form.querySelector('#home-care-name').value.trim(),
        email: form.querySelector('#home-care-email').value.trim().toLowerCase(),
        phone: form.querySelector('#home-care-phone').value.trim(),
        address: form.querySelector('#home-care-address').value.trim(),
        city: form.querySelector('#home-care-city').value.trim(),
        zip: zipField ? zipField.value.trim() : '',
        plan: planField ? planField.value : '',
        billingCycle: cycle,
        notes: form.querySelector('#home-care-notes').value.trim()
      };

      if (!OAKLAND_ZIP.test(payload.zip)) {
        setError('Quarterly plans are Oakland County only. Call (248) 385-3432 if you are just outside it.');
        return;
      }

      var originalLabel = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending... <i class="fas fa-spinner animate-spin text-xs" aria-hidden="true"></i>';

      fetch('/api/home-care-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok) throw new Error(data.error || 'We could not save that request.');
            return data;
          });
        })
        .then(function (data) {
          // Mirror into Netlify Forms so the signup reaches the owner's inbox
          // the same way a booking does, not just the database.
          var mirror = new URLSearchParams();
          mirror.append('form-name', 'home-care-plans');
          mirror.append('name', payload.customerName);
          mirror.append('email', payload.email);
          mirror.append('phone', payload.phone);
          mirror.append('plan', PLAN_NAMES[payload.plan] || payload.plan);
          mirror.append('billingCycle', payload.billingCycle);
          mirror.append('address', payload.address + ', ' + payload.city + ' ' + payload.zip);
          mirror.append('notes', payload.notes);
          fetch('/services.html', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: mirror.toString()
          }).catch(function (err) {
            console.error('Netlify Form submission failed:', err);
          });

          form.classList.add('hidden');
          if (success) {
            success.classList.remove('hidden');
            var line = success.querySelector('[data-plan-success-message]');
            if (line) line.textContent = data.message || 'We will call within one business day to confirm.';
            success.focus();
          }
        })
        .catch(function (err) {
          setError(err.message + ' You can also call (248) 385-3432.');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalLabel;
        });
    });
  }

  /* ------------------------------------------------------------------ *
   * Accordion behaviour for the plan cards.
   *
   * Each plan is a <details>. On desktop (>= 768px) all three are forced
   * open so the side-by-side card layout reads as it always did; on phones
   * only the Featured (Complete) card opens by default and the visitor can
   * expand the others. The desktop lock is reapplied on resize so a card a
   * visitor closed on their phone does not stay closed after rotating or
   * widening the window.
   * ------------------------------------------------------------------ */
  var accordions = Array.prototype.slice.call(section.querySelectorAll('.plan-card--accordion'));
  var DESKTOP_MQ = window.matchMedia('(min-width: 768px)');

  function syncAccordionState() {
    var desktop = DESKTOP_MQ.matches;
    accordions.forEach(function (node) {
      if (desktop) {
        node.open = true;
      }
      // On mobile, leave the open attribute alone so the visitor controls it;
      // the markup ships with only the Complete card open.
    });
  }

  if (accordions.length) {
    syncAccordionState();
    if (typeof DESKTOP_MQ.addEventListener === 'function') {
      DESKTOP_MQ.addEventListener('change', syncAccordionState);
    } else if (typeof DESKTOP_MQ.addListener === 'function') {
      DESKTOP_MQ.addListener(syncAccordionState);
    }
  }

  renderPrices();
})();
