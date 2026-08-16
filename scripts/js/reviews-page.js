/*
 * The customer gallery on /reviews: submission form, listing, and the owner's
 * moderation controls.
 *
 * This was a single 39kB inline <script> in public/reviews.html -- nearly half
 * the page's HTML, re-downloaded uncompressed on every visit and blocking the
 * parser while it compiled. As an external deferred file it is minified, cached
 * for a year, and off the first-paint path.
 */

(function () {
  const reviewsForm = document.getElementById('reviews-form');
  const reviewsList = document.getElementById('reviews-list');
  const reviewsEmpty = document.getElementById('reviews-empty');
  const reviewsLoading = document.getElementById('reviews-loading');
  const reviewsMessage = document.getElementById('reviews-message');
  const reviewsSubmit = document.getElementById('reviews-submit');
  const reviewsRefresh = document.getElementById('reviews-refresh');
  const adminAccessBtn = document.getElementById('admin-access-btn');
  const adminAccessLabel = document.getElementById('admin-access-label');

  const updateAdminUI = () => {
      const adminToken = localStorage.getItem('aaaAdminToken');
      if (adminAccessLabel && adminAccessBtn) {
          if (adminToken) {
              adminAccessLabel.textContent = 'Owner Access On';
              adminAccessBtn.className = 'bg-red-600/20 text-red-200 border border-red-600/40 hover:bg-red-600/30 px-4 py-3 rounded-2xl font-semibold transition inline-flex items-center gap-2 text-sm shadow-md';
          } else {
              adminAccessLabel.textContent = 'Owner Access';
              adminAccessBtn.className = 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-3 rounded-2xl font-semibold transition inline-flex items-center gap-2 text-sm shadow-md';
          }
      }
  };

  // Verify a candidate access key against the server before unlocking admin
  // mode. The key is only stored locally if ADMIN_API_TOKEN matches, so an
  // arbitrary passcode can no longer reveal the management controls.
  const verifyAdminKey = async (candidate) => {
      const key = String(candidate || '').trim();
      if (!key) return false;
      try {
          const response = await fetch('/api/admin/verify', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ passcode: key })
          });
          if (!response.ok) {
              const payload = await response.json().catch(() => ({}));
              const message = payload.error || (response.status === 401
                  ? "We don't recognize that owner key. Check it and try again."
                  : "We couldn't verify that owner key right now. Please try again in a moment.");
              showReviewsMessage(message, true);
              return false;
          }
          localStorage.setItem('aaaAdminToken', key);
          updateAdminUI();
          loadReviews();
          showReviewsMessage('Owner access is on.', false);
          return true;
      } catch {
          showReviewsMessage("We couldn't reach the server to check that key. Check your connection and try again.", true);
          return false;
      }
  };

  /*
   * Owner access uses an inline <dialog> (see #admin-access-dialog in
   * reviews.html) instead of window.prompt/confirm. The native dialogs are
   * blocking, dismissable with Esc, and flagged by Lighthouse's Best Practices
   * audit; the inline dialog is keyboard-navigable, screen-reader friendly,
   * and stays in the page's visual style.
   */
  const adminDialog = document.getElementById('admin-access-dialog');
  const adminDialogInput = document.getElementById('admin-access-input');
  const adminDialogError = document.getElementById('admin-access-error');
  const adminDialogConfirm = document.getElementById('admin-access-confirm');
  const adminDialogCancel = document.getElementById('admin-access-cancel');

  const openAdminKeyDialog = () => {
      if (!adminDialog || typeof adminDialog.showModal !== 'function') return false;
      if (adminDialogError) { adminDialogError.textContent = ''; adminDialogError.classList.add('hidden'); }
      if (adminDialogInput) { adminDialogInput.value = ''; adminDialogInput.removeAttribute('aria-invalid'); }
      adminDialog.showModal();
      if (adminDialogInput) setTimeout(() => adminDialogInput.focus(), 30);
      return true;
  };

  const openAdminSignOutDialog = () => {
      if (!adminDialog || typeof adminDialog.showModal !== 'function') return false;
      adminDialog.dataset.mode = 'signout';
      // Swap the dialog into its "turn off access" copy.
      const title = document.getElementById('admin-access-title');
      const body = document.getElementById('admin-access-body');
      if (title) title.textContent = 'Turn off owner access?';
      if (body) body.textContent = 'Owner access will be removed from this device. You can turn it back on any time with your key.';
      if (adminDialogInput) adminDialogInput.classList.add('hidden');
      if (adminDialogConfirm) adminDialogConfirm.textContent = 'Turn Off';
      adminDialog.showModal();
      if (adminDialogConfirm) setTimeout(() => adminDialogConfirm.focus(), 30);
      return true;
  };

  const resetAdminDialogToKeyMode = () => {
      if (!adminDialog) return;
      delete adminDialog.dataset.mode;
      const title = document.getElementById('admin-access-title');
      const body = document.getElementById('admin-access-body');
      if (title) title.textContent = 'Enter your owner access key';
      if (body) body.textContent = 'This unlocks the moderation controls on this device only.';
      if (adminDialogInput) adminDialogInput.classList.remove('hidden');
      if (adminDialogConfirm) adminDialogConfirm.textContent = 'Unlock';
  };

  if (adminDialogConfirm) {
      adminDialogConfirm.addEventListener('click', async () => {
          if (adminDialog && adminDialog.dataset.mode === 'signout') {
              adminDialog.close();
              resetAdminDialogToKeyMode();
              localStorage.removeItem('aaaAdminToken');
              updateAdminUI();
              loadReviews();
              showReviewsMessage('Owner access is off.', false);
              return;
          }
          const key = adminDialogInput ? adminDialogInput.value : '';
          if (!key.trim()) {
              if (adminDialogError) {
                  adminDialogError.textContent = 'Enter your owner access key to continue.';
                  adminDialogError.classList.remove('hidden');
              }
              if (adminDialogInput) adminDialogInput.setAttribute('aria-invalid', 'true');
              if (adminDialogInput) adminDialogInput.focus();
              return;
          }
          if (adminDialogConfirm) { adminDialogConfirm.disabled = true; adminDialogConfirm.textContent = 'Checking…'; }
          const ok = await verifyAdminKey(key);
          if (adminDialogConfirm) { adminDialogConfirm.disabled = false; adminDialogConfirm.textContent = 'Unlock'; }
          if (ok) {
              if (adminDialog && adminDialog.open) adminDialog.close();
              resetAdminDialogToKeyMode();
          } else if (adminDialogInput) {
              adminDialogInput.setAttribute('aria-invalid', 'true');
              adminDialogInput.focus();
          }
      });
  }

  if (adminDialogCancel) {
      adminDialogCancel.addEventListener('click', () => {
          if (adminDialog && adminDialog.open) adminDialog.close();
          resetAdminDialogToKeyMode();
      });
  }

  if (adminDialog) {
      adminDialog.addEventListener('close', resetAdminDialogToKeyMode);
      if (adminDialogInput) {
          adminDialogInput.addEventListener('keydown', (event) => {
              if (event.key === 'Enter') {
                  event.preventDefault();
                  if (adminDialogConfirm) adminDialogConfirm.click();
              }
          });
      }
  }

  try {
      const urlParams = new URLSearchParams(window.location.search);
      const adminKeyFromUrl = urlParams.get('admin') || urlParams.get('adminKey') || urlParams.get('token');
      if (adminKeyFromUrl && adminKeyFromUrl !== 'false' && adminKeyFromUrl !== '0') {
          if (adminKeyFromUrl === 'true' || adminKeyFromUrl === '1') {
              if (!openAdminKeyDialog()) {
                  // Dialog unavailable (older browser): fall back to verifying
                  // nothing -- the prompt() path is gone, so we cannot collect
                  // a key without the dialog. Surface a status message instead.
                  showReviewsMessage('Open this page and tap Owner Access to enter your key.', true);
              }
          } else {
              verifyAdminKey(adminKeyFromUrl);
          }
      }
  } catch {}

  if (adminAccessBtn) {
      adminAccessBtn.addEventListener('click', () => {
          const currentToken = localStorage.getItem('aaaAdminToken');
          if (currentToken) {
              if (!openAdminSignOutDialog()) {
                  // Dialog unavailable: turn off access immediately as the only
                  // non-blocking way to honour the click without confirm().
                  localStorage.removeItem('aaaAdminToken');
                  updateAdminUI();
                  loadReviews();
              }
          } else {
              if (!openAdminKeyDialog()) {
                  showReviewsMessage('Owner access could not be opened. Try a newer browser.', true);
              }
          }
      });
  }
  const reviewsPhoto = document.getElementById('reviews-photo');
  const reviewsPhoto2 = document.getElementById('reviews-photo-2');
  const reviewsPhoto3 = document.getElementById('reviews-photo-3');
  const photoInputs = [reviewsPhoto, reviewsPhoto2, reviewsPhoto3].filter(Boolean);
  const reviewsDropzone = document.getElementById('reviews-dropzone');
  const reviewsFileName = document.getElementById('reviews-file-name');
  const reviewsEditing = document.getElementById('reviews-editing');
  const reviewsCancelEdit = document.getElementById('reviews-cancel-edit');
  const reviewsRatingInput = document.getElementById('reviews-rating');
  const ratingText = document.getElementById('rating-text');
  const starRatingBtns = document.querySelectorAll('.star-rating-btn');
  const reviewsPreview = document.getElementById('reviews-preview');
  const reviewsPreviewWrap = document.getElementById('reviews-preview-wrap');
  const reviewsPreviewsGrid = document.getElementById('reviews-previews');
  // chosenFiles[i] holds the File chosen for slot i (0..2), or null. Slot 0 is
  // the primary photo and the only one required on a new review. The live
  // preview grid and the submit handler both read from this array, so the
  // hidden <input>s are just the pick mechanism -- the array is the source of
  // truth, which keeps drag-and-drop and the remove buttons consistent with
  // whatever the file pickers hold.
  const chosenFiles = [null, null, null];
  // Object URLs are revoked on swap/remove to avoid leaking the preview.
  const chosenObjectUrls = [null, null, null];
  const attrChips = document.querySelectorAll('.attr-chip');
  const attributesInput = document.getElementById('reviews-attributes-input');
  const ownerResponseInput = document.getElementById('reviews-owner-response');
  const serviceFilterBlock = document.getElementById('reviews-service-filter');
  const serviceTabsHost = document.getElementById('reviews-filters');
  const cityTabsHost = document.getElementById('reviews-cities');
  const clearFiltersBtn = document.getElementById('reviews-clear-filters');
  const reviewsFilterEmpty = document.getElementById('reviews-filter-empty');
  const reviewsFilterEmptyCopy = document.getElementById('reviews-filter-empty-copy');
  const mapPinsHost = document.getElementById('map-pins');
  const mapPopup = document.getElementById('map-popup');
  const mapSummary = document.getElementById('map-summary');
  const citiesServedCount = document.querySelector('[data-cities-served-count]');
  const citiesServedRange = document.querySelector('[data-cities-served-range]');
  const lightbox = document.getElementById('reviews-lightbox');
  const lightboxImg = document.getElementById('reviews-lightbox-img');
  const lightboxCaption = document.getElementById('reviews-lightbox-caption');
  const lightboxClose = document.getElementById('reviews-lightbox-close');
  let reviewsEditId = null;
  let allReviews = [];
  let activeFilter = 'all';
  let activeCity = 'all';
  let lastFocusedBeforeLightbox = null;
  const prefersReducedMotion = () =>
      Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const photoRule = window.AAAPhotoUpload;
  // A buffered Netlify function request is capped at 6 MB, and this form sends
  // up to three photos plus the rating and review text in one POST, so the
  // per-photo budget on the wire has to leave room for the other two.
  const UPLOAD_SAFE_BYTES = 1.6 * 1024 * 1024;

  // Photos straight off a phone routinely outweigh what a single function
  // request can carry, so anything over the budget is downscaled and
  // re-encoded by the shared helper. Animated GIFs can't survive a canvas
  // round-trip, so it passes those through as-is or refuses them outright.
  const preparePhotoForUpload = (file) => photoRule.prepare(file, UPLOAD_SAFE_BYTES);
  const ratingLabels = {
      '1': 'Disappointing',
      '2': 'Could be better',
      '3': 'Good service',
      '4': 'Great work!',
      '5': 'Perfect!'
  };

  const updateStarRatingDisplay = (rating) => {
      if (!reviewsRatingInput) return;
      reviewsRatingInput.value = String(rating);
      if (ratingText) {
          ratingText.textContent = ratingLabels[String(rating)] || '';
      }
      starRatingBtns.forEach((btn) => {
          const val = parseInt(btn.dataset.value || '0', 10);
          const icon = btn.querySelector('i');
          if (icon) {
              if (val <= rating) {
                  icon.className = 'fas fa-star';
                  btn.className = 'star-rating-btn text-2xl text-red-300 focus:outline-none';
              } else {
                  icon.className = 'far fa-star';
                  btn.className = 'star-rating-btn text-2xl text-gray-300 hover:text-red-200 focus:outline-none';
              }
              icon.setAttribute('aria-hidden', 'true');
          }
          // The colour change alone conveys the choice visually; radios
          // need aria-checked so it is announced too. A roving tabindex
          // keeps the whole group a single stop in the tab order, which
          // is how a radio group is expected to behave.
          const isSelected = val === rating;
          btn.setAttribute('aria-checked', String(isSelected));
          btn.setAttribute('tabindex', isSelected ? '0' : '-1');
      });
  };

  starRatingBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
          const val = parseInt(btn.dataset.value || '5', 10);
          updateStarRatingDisplay(val);
      });

      // Arrow keys move between ratings, Home/End jump to the ends —
      // the standard radio-group keyboard contract.
      btn.addEventListener('keydown', (event) => {
          const current = parseInt(reviewsRatingInput?.value || '5', 10);
          let next = null;
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = current + 1;
          else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = current - 1;
          else if (event.key === 'Home') next = 1;
          else if (event.key === 'End') next = 5;
          if (next === null) return;

          event.preventDefault();
          next = Math.min(5, Math.max(1, next));
          updateStarRatingDisplay(next);
          const target = Array.from(starRatingBtns).find(
              (b) => parseInt(b.dataset.value || '0', 10) === next
          );
          if (target) target.focus();
      });
  });
  updateStarRatingDisplay(5);

  // --- Attribute highlight chips ---
  const syncAttributesInput = () => {
      if (!attributesInput) return;
      const selected = Array.from(attrChips)
          .filter((chip) => chip.getAttribute('aria-pressed') === 'true')
          .map((chip) => chip.dataset.attr || '');
      attributesInput.value = selected.join(',');
  };

  attrChips.forEach((chip) => {
      chip.addEventListener('click', () => {
          const pressed = chip.getAttribute('aria-pressed') === 'true';
          chip.setAttribute('aria-pressed', pressed ? 'false' : 'true');
          syncAttributesInput();
      });
  });

  const resetAttributeChips = (selected = []) => {
      const set = new Set(selected);
      attrChips.forEach((chip) => {
          chip.setAttribute('aria-pressed', set.has(chip.dataset.attr) ? 'true' : 'false');
      });
      syncAttributesInput();
  };

  // The dropzone label text adapts to how many photos are chosen so the
  // customer can tell at a glance whether they still have room. "1 of 3
  // chosen" rather than the static "Choose up to 3 photos".
  const updatePhotoDropzoneLabel = () => {
      const count = chosenFiles.filter(Boolean).length;
      if (!reviewsFileName) return;
      if (count === 0) {
          reviewsFileName.textContent = 'Choose up to 3 photos or drag them here';
      } else if (count >= 3) {
          reviewsFileName.textContent = '3 photos chosen — drag a thumbnail to replace one';
      } else {
          reviewsFileName.textContent = `${count} of 3 photos chosen — tap to add another`;
      }
  };

  // The primary <input> is never marked `required` in the DOM: it is visually
  // hidden, so a native "required" failure would focus an invisible target
  // with no message. Validation that at least one photo is chosen is done in
  // the submit handler instead, where a friendly message can be shown.
  const syncPhotoRequired = () => {
      if (reviewsPhoto) reviewsPhoto.required = false;
  };

  const renderPhotoPreviews = () => {
      if (!reviewsPreviewsGrid) return;
      const count = chosenFiles.filter(Boolean).length;
      if (count === 0) {
          reviewsPreviewsGrid.classList.add('hidden');
          reviewsPreviewsGrid.innerHTML = '';
          if (reviewsPreviewWrap) reviewsPreviewWrap.classList.add('hidden');
          if (reviewsPreview) reviewsPreview.src = '';
          updatePhotoDropzoneLabel();
          return;
      }

      reviewsPreviewsGrid.classList.remove('hidden');
      reviewsPreviewsGrid.innerHTML = chosenFiles.map((file, index) => {
          if (!file) {
              // An empty slot in the middle is shown as a subtle "add" tile so
              // the 3-column strip reads as a grid rather than collapsing.
              return `<button type="button" class="review-slot-add aspect-square rounded-2xl border-[2px] border-dashed border-gray-200 hover:border-red-400 flex items-center justify-center text-gray-400 hover:text-red-500 transition" data-slot="${index}" aria-label="Add photo ${index + 1}">
                  <i class="fas fa-plus text-xl" aria-hidden="true"></i>
              </button>`;
          }
          const url = chosenObjectUrls[index] || '';
          return `<div class="review-slot relative aspect-square rounded-2xl overflow-hidden border border-gray-200 shadow-sm group">
              <img src="${url}" alt="Preview of photo ${index + 1}" class="w-full h-full object-cover">
              <button type="button" class="review-slot-remove absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 text-white hover:bg-red-600 flex items-center justify-center text-xs transition" data-slot="${index}" aria-label="Remove photo ${index + 1}">
                  <i class="fas fa-xmark" aria-hidden="true"></i>
              </button>
              ${index === 0 ? '<span class="absolute bottom-1.5 left-1.5 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">Main</span>' : ''}
          </div>`;
      }).join('');
      updatePhotoDropzoneLabel();
  };

  // Revoke any object URL held for a slot and clear its array entry. The
  // hidden <input> is reset too so the browser doesn't keep the stale pick.
  const clearPhotoSlot = (index) => {
      if (chosenObjectUrls[index]) {
          URL.revokeObjectURL(chosenObjectUrls[index]);
          chosenObjectUrls[index] = null;
      }
      chosenFiles[index] = null;
      const input = photoInputs[index];
      if (input) input.value = '';
  };

  const clearPhotoPreview = () => {
      chosenFiles.forEach((_, index) => clearPhotoSlot(index));
      renderPhotoPreviews();
      syncPhotoRequired();
  };

  // Assign a File to the next free slot (or a specific slot), creating an
  // object URL for the live preview. Returns the slot index it landed in,
  // or -1 if no slot was free.
  const assignPhotoToSlot = (file, slot) => {
      const target = typeof slot === 'number' && slot >= 0 && slot < 3 ? slot : chosenFiles.findIndex((f) => !f);
      if (target === -1) return -1;
      clearPhotoSlot(target);
      chosenFiles[target] = file;
      chosenObjectUrls[target] = URL.createObjectURL(file);
      return target;
  };

  const escapeHTML = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
  }[char]));

  const stars = (rating) => Array.from({ length: 5 }, (_, index) =>
      `<i class="${index < rating ? 'fas' : 'far'} fa-star" aria-hidden="true"></i>`
  ).join('');

  const truncate = (value, max) => {
      const text = String(value || '').trim();
      if (text.length <= max) return text;
      const head = text.slice(0, max);
      const lastSpace = head.lastIndexOf(' ');
      const cut = lastSpace > max * 0.6 ? head.slice(0, lastSpace) : head;
      return `${cut.replace(/[\s,;:.—-]+$/, '')}…`;
  };

  /*
   * Place words: every city we serve, broken into single words, plus the state
   * and township tokens that trail them. Used only to recognise an opening
   * line that is a location rather than a sentence -- see pullQuoteOf below.
   * Matching is word by word and an opener has to be made of nothing else, so
   * "Troy was great." keeps its verb and is left alone.
   */
  const PLACE_WORDS = new Set([
      'auburn', 'beverly', 'birmingham', 'bloomfield', 'clarkston', 'commerce',
      'farmington', 'franklin', 'highland', 'hills', 'huntington', 'independence',
      'lake', 'novi', 'oak', 'oakland', 'orchard', 'orion', 'oxford', 'pontiac',
      'rochester', 'royal', 'southfield', 'troy', 'village', 'waterford', 'west',
      'white', 'woods', 'county', 'township', 'twp', 'mi', 'mich', 'michigan'
  ]);

  const placeTokens = (value) =>
      String(value || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim()
          .split(' ')
          .filter(Boolean);

  /*
   * True when an opening line says only where the customer lives -- "Waterford,
   * MI.", "West Bloomfield Twp.", "Troy 48083." -- either by repeating the
   * record's own location field or by being built from place words alone. The
   * word cap keeps a real sentence that happens to name a city out of it.
   */
  const isLocationOnly = (opener, location) => {
      const words = placeTokens(opener);
      if (!words.length || words.length > 6) return false;

      const locationWords = placeTokens(location);
      if (locationWords.length && words.join(' ') === locationWords.join(' ')) return true;

      return words.every((word) => PLACE_WORDS.has(word) || /^\d{5}$/.test(word));
  };

  /*
   * Pull-quote.
   *
   * A review is one free-text field -- there is no separate headline to set
   * large -- so the quote is pulled out of the body the way print does it. The
   * customer's verdict is almost always their opening sentence ("Solved my
   * drainage issues completely!") and everything after it reads as the detail
   * behind that verdict. Three cases, in order: a review with more than one
   * sentence splits into quote plus body; a short single-sentence review
   * becomes the quote alone rather than the same words printed twice; a
   * run-on with no sentence break is trimmed at a word boundary for the quote
   * and left whole in the body, which is literally what pulling a quote is.
   *
   * Before any of that, a dateline is stepped over. Customers often head their
   * review with where they live -- "Waterford, MI. Victor rebuilt our deck..."
   * -- and that opener is metadata, not their verdict, so handing it to the
   * quote would put a city name in the one slot that is meant to carry the
   * customer's words. It matters most on the project map, where a pin's popup
   * shows the quote and nothing else: the pin would then advertise the city it
   * is already labelled with instead of the review behind it. The opener is
   * only moved, never dropped -- it stays at the head of the body, and the
   * city keeps its own field on the card, in the popup header, and in the
   * byline beneath it.
   */
  const pullQuoteOf = (text, location) => {
      const full = String(text || '').trim();
      if (!full) return { quote: '', body: '' };

      let offset = 0;
      // Two openers is already more than anyone writes ("Troy, MI. 5 stars.").
      for (let skipped = 0; skipped < 2; skipped += 1) {
          const opener = full.slice(offset).match(/^(.{1,60}?[.!?:;—–-]+)(?:\s|$)/);
          if (!opener || !isLocationOnly(opener[1], location)) break;
          offset += opener[0].length;
      }

      // The opener is kept, not discarded -- it is the customer's text. A
      // dash or colon that only made sense as a lead-in becomes a full stop
      // now that the line stands at the head of the body.
      const dateline = full.slice(0, offset).trim().replace(/[\s—–:;-]+$/, '').replace(/[.!?]*$/, '.');
      const rest = full.slice(offset).trim();
      // A review that is nothing but a location has no verdict to pull; the
      // callers fall back to the body rather than quoting the city.
      if (!rest) return { quote: '', body: full };

      const withDateline = (body) => (offset ? `${dateline} ${body}`.trim() : body);
      // "Waterford, MI - the crew..." reads as a fragment once the lead-in is
      // gone, so the quote is given back its capital.
      const asQuote = (quote) => (offset && quote ? quote.charAt(0).toUpperCase() + quote.slice(1) : quote);

      const sentence = rest.match(/^(.{12,140}?[.!?]+)(?:\s|$)/);
      if (sentence) {
          const quote = sentence[1];
          return { quote: asQuote(quote), body: withDateline(rest.slice(quote.length).trim()) };
      }

      if (rest.length <= 150) return { quote: asQuote(rest), body: withDateline('') };
      return { quote: asQuote(truncate(rest, 100)), body: withDateline(rest) };
  };

  /*
   * The single line of review text a map pin's popup gets. It is the pull
   * quote when there is one, and the review itself when there is not, so the
   * popup always carries the customer's words -- never the city, which the
   * popup names for itself in its header and byline.
   */
  const mapExcerptOf = (item) => {
      const { quote, body } = pullQuoteOf(item.review, item.location);
      return truncate(quote || body || item.review, 110);
  };

  // Inline SVG rather than an icon font for the badges and pins: these carry
  // meaning ("this is verified", "a project happened here"), so they must be
  // drawn even on the first paint, before the deferred icon stylesheet lands.
  const CHECK_CIRCLE_SVG =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="flex-none text-emerald-600" aria-hidden="true"><circle cx="12" cy="12" r="9.2"></circle><path d="m8.2 12.4 2.5 2.5 5-5.4"></path></svg>';
  const HAMMER_SVG =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="flex-none" aria-hidden="true"><path d="M4.5 5h10.2l2.8 2.6-2.8 2.6H4.5Z"></path><path d="M10.4 10.2 13 21"></path></svg>';
  const PIN_CHECK_SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"></path></svg>';

  const showReviewsMessage = (text, isError) => {
      if (!reviewsMessage) return;
      reviewsMessage.textContent = text;
      reviewsMessage.className = `text-sm font-semibold ${isError ? 'text-red-500' : 'text-green-400'}`;
      reviewsMessage.classList.remove('hidden');
  };

  const setReviewsSubmitting = (isSubmitting) => {
      if (!reviewsSubmit) return;
      reviewsSubmit.disabled = isSubmitting;
      reviewsSubmit.classList.toggle('opacity-70', isSubmitting);
      reviewsSubmit.classList.toggle('cursor-not-allowed', isSubmitting);
  };

  const resetReviewsForm = () => {
      if (!reviewsForm) return;
      reviewsEditId = null;
      reviewsForm.reset();
      // Drop any option added for a review whose project type is no longer
      // one of the choices, so it doesn't linger for the next submission.
      reviewsForm.querySelectorAll('option[data-injected]').forEach((option) => option.remove());
      updateStarRatingDisplay(5);
      resetAttributeChips([]);
      clearPhotoPreview();
      if (reviewsPhoto) reviewsPhoto.required = false;
      if (reviewsFileName) reviewsFileName.textContent = 'Choose up to 3 photos or drag them here';
      if (reviewsEditing) reviewsEditing.classList.add('hidden');
      if (reviewsSubmit) reviewsSubmit.innerHTML = 'Post My Review <i class="fas fa-camera-retro" aria-hidden="true"></i>';
  };

  // Assigning a value the <select> has no <option> for silently leaves it
  // empty, and the field is required -- so the browser would then refuse to
  // submit with no explanation of which control was at fault. A review
  // saved under a project type that has since been renamed or removed from
  // the list keeps its own option so it can still be edited.
  const setProjectTypeValue = (value) => {
      const select = reviewsForm?.projectType;
      if (!select) return;
      const wanted = String(value || '');
      select.value = wanted;
      if (wanted && select.value !== wanted) {
          const option = document.createElement('option');
          option.value = wanted;
          option.textContent = wanted;
          option.dataset.injected = 'true';
          select.appendChild(option);
          select.value = wanted;
      }
  };

  const startReviewsEdit = (item) => {
      if (!reviewsForm) return;

      reviewsEditId = item.id;
      reviewsForm.customerName.value = item.customerName || '';
      reviewsForm.location.value = item.location || '';
      setProjectTypeValue(item.projectType || '');
      updateStarRatingDisplay(item.rating || 5);
      resetAttributeChips(Array.isArray(item.attributes) ? item.attributes : []);
      reviewsForm.review.value = item.review || '';
      if (ownerResponseInput) ownerResponseInput.value = item.ownerResponse || '';
      clearPhotoPreview();
      if (reviewsPhoto) reviewsPhoto.required = false;
      if (reviewsFileName) reviewsFileName.textContent = 'Keep current photos or drop in replacements';
      if (reviewsEditing) reviewsEditing.classList.remove('hidden');
      if (reviewsSubmit) reviewsSubmit.innerHTML = 'Save Changes <i class="fas fa-floppy-disk" aria-hidden="true"></i>';
      showReviewsMessage('Update the fields below, then save your changes. Leave the photo slots empty to keep the current photos.', false);
      reviewsForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  /*
   * Delete confirmation uses an inline <dialog> (#delete-confirm-dialog in
   * reviews.html) instead of window.confirm, which Lighthouse's Best Practices
   * audit flags. The dialog is keyboard-navigable and styled to match the page.
   */
  const deleteDialog = document.getElementById('delete-confirm-dialog');
  const deleteDialogConfirm = document.getElementById('delete-confirm-yes');
  const deleteDialogCancel = document.getElementById('delete-confirm-no');
  let pendingDeleteId = null;

  const performDelete = (id) => {
      const adminToken = localStorage.getItem('aaaAdminToken') || '';
      if (!adminToken) {
          showReviewsMessage('Turn on owner access to delete reviews.', true);
          return;
      }
      showReviewsMessage('Removing your review...', false);

      fetch(`/api/reviews/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json', 'x-admin-token': adminToken },
          body: JSON.stringify({ adminToken })
      })
      .then(async response => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || 'Delete failed.');
          if (reviewsEditId === id) resetReviewsForm();
          showReviewsMessage('The review was removed.', false);
          loadReviews();
      })
      .catch(error => {
          const message = error instanceof Error ? error.message : String(error || '');
          showReviewsMessage(message || 'This review could not be removed.', true);
      });
  };

  if (deleteDialogConfirm) {
      deleteDialogConfirm.addEventListener('click', () => {
          const id = pendingDeleteId;
          pendingDeleteId = null;
          if (deleteDialog && deleteDialog.open) deleteDialog.close();
          if (id !== null) performDelete(id);
      });
  }
  if (deleteDialogCancel) {
      deleteDialogCancel.addEventListener('click', () => {
          pendingDeleteId = null;
          if (deleteDialog && deleteDialog.open) deleteDialog.close();
      });
  }

  const deleteReviewsItem = (id) => {
      const adminToken = localStorage.getItem('aaaAdminToken') || '';
      if (!adminToken) {
          showReviewsMessage('Turn on owner access to delete reviews.', true);
          return;
      }
      if (!deleteDialog || typeof deleteDialog.showModal !== 'function') {
          // Dialog unavailable: skip the confirm gate and delete directly,
          // since there is no non-blocking confirm() path to fall back to.
          performDelete(id);
          return;
      }
      pendingDeleteId = id;
      deleteDialog.showModal();
      if (deleteDialogConfirm) setTimeout(() => deleteDialogConfirm.focus(), 30);
  };

  // Esc on the delete dialog should cancel, not delete. The native close event
  // fires for both Esc and the cancel button, so clear the pending id here.
  if (deleteDialog) {
      deleteDialog.addEventListener('close', () => { pendingDeleteId = null; });
  }

  const badgeColors = {
      'Carpentry & Trim': 'bg-red-100 text-red-800 border-red-200',
      'Doors': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'Drywall': 'bg-neutral-100 text-neutral-800 border-neutral-200',
      'Painting': 'bg-pink-100 text-pink-800 border-pink-200',
      'Electrical': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Plumbing': 'bg-sky-100 text-sky-800 border-sky-200',
      'Decks & Fences': 'bg-teal-100 text-teal-800 border-teal-200',
      'Flooring': 'bg-violet-100 text-violet-800 border-violet-200',
      'Maintenance': 'bg-orange-100 text-orange-800 border-orange-200',
      'Other Service': 'bg-blue-100 text-blue-800 border-blue-200'
  };

  /*
   * The service-area cities, with each one's real position inside Oakland
   * County projected once into the 640x560 viewBox the map SVG draws in. The
   * list drives three things at once -- the city filter row's matching, the
   * map pins, and the "12+ cities" claim in the stats bar -- so a city is
   * added here and nowhere else. Order is north to south, which is also the
   * order the pins take in the tab sequence.
   *
   * `core: true` marks the twelve cities that are always drawn, hollow dot and
   * all, because together they describe the shape of the service area. The
   * rest are drawn only once a customer from there has posted, which keeps the
   * map legible while still guaranteeing every reviewer gets a pin: a review
   * from any city listed here lands on the county, not in a silent gap.
   */
  const MAP_VIEWBOX = { width: 640, height: 560 };
  const MAP_CITIES = [
      { name: 'Oxford', x: 408, y: 109, label: 'above' },
      { name: 'Lake Orion', x: 429, y: 152, label: 'right', aliases: ['Orion'] },
      { name: 'Clarkston', x: 278, y: 205, label: 'above', core: true, aliases: ['Independence'] },
      { name: 'Auburn Hills', x: 435, y: 257, label: 'above', core: true },
      { name: 'Waterford', x: 298, y: 282, label: 'below', core: true },
      { name: 'White Lake', x: 185, y: 287, label: 'above', core: true },
      { name: 'Rochester Hills', x: 507, y: 287, label: 'left', core: true, aliases: ['Rochester'] },
      { name: 'Highland', x: 110, y: 300, label: 'below', core: true },
      { name: 'Pontiac', x: 385, y: 305, label: 'below' },
      { name: 'Troy', x: 507, y: 344, label: 'left', core: true },
      { name: 'Orchard Lake', x: 334, y: 352, label: 'above' },
      { name: 'Commerce', x: 228, y: 364, label: 'below', core: true },
      { name: 'Bloomfield', x: 426, y: 366, label: 'left', core: true },
      { name: 'West Bloomfield', x: 309, y: 383, label: 'below', core: true },
      { name: 'Birmingham', x: 453, y: 405, label: 'right', core: true },
      { name: 'Franklin', x: 373, y: 428, label: 'left' },
      { name: 'Beverly Hills', x: 424, y: 437, label: 'below' },
      { name: 'Farmington Hills', x: 320, y: 453, label: 'below', aliases: ['Farmington'] },
      { name: 'Royal Oak', x: 513, y: 458, label: 'right' },
      { name: 'Novi', x: 227, y: 472, label: 'below' },
      { name: 'Huntington Woods', x: 487, y: 483, label: 'right' },
      { name: 'Southfield', x: 446, y: 484, label: 'below', core: true }
  ];

  // Customers type their own city, so matching is by substring -- "Waterford
  // Twp", "Waterford, MI", and "waterford" are all the same place. Aliases
  // carry the places that go by more than one name: Independence Township is
  // Clarkston's mailing address, and most people write "Rochester" for
  // Rochester Hills. Longest needle first is what keeps "West Bloomfield, MI"
  // from being filed under Bloomfield, which shares the tail of its name and
  // has its own pin.
  const CITY_MATCH_ORDER = MAP_CITIES
      .flatMap((city) => [city.name, ...(city.aliases || [])]
          .map((needle) => ({ needle: needle.toLowerCase(), name: city.name })))
      .sort((a, b) => b.needle.length - a.needle.length);

  const cityOf = (location) => {
      const text = String(location || '').toLowerCase();
      return CITY_MATCH_ORDER.find((entry) => text.includes(entry.needle))?.name || '';
  };

  // The two filter rows narrow the grid together, so a review has to clear
  // both. A location we cannot place -- somewhere outside the county, or a
  // typo -- has no pill of its own and so only ever appears under "All
  // Cities".
  //
  // Service pills carry the category exactly as it was stored, because the row
  // is built from the reviews themselves (see syncServiceTabs), so the match is
  // an equality rather than the substring it used to be. That substring was
  // what let a hand-written "Carpentry" pill stand in for "Carpentry & Trim";
  // with the label taken from the data there is nothing left to approximate,
  // and a category that is a prefix of another can no longer drag its
  // neighbour's showcases into view.
  const serviceKey = (name) => String(name || '').trim().toLowerCase();

  const matchesFilter = (item) => {
      const categoryOk = activeFilter === 'all' || serviceKey(item.projectType) === serviceKey(activeFilter);
      const cityOk = activeCity === 'all' || cityOf(item.location) === activeCity;
      return categoryOk && cityOk;
  };

  const attributesHtml = (attributes) => {
      if (!Array.isArray(attributes) || attributes.length === 0) return '';
      const chips = attributes.map((tag) =>
          `<span class="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-100 rounded-full px-2.5 py-1 text-xs font-semibold"><i class="fas fa-check text-[10px]" aria-hidden="true"></i>${escapeHTML(tag)}</span>`
      ).join('');
      return `<div class="mt-4 flex flex-wrap gap-1.5">${chips}</div>`;
  };

  // The owner's reply is the one voice on the page that is not a customer's,
  // so it is badged rather than merely indented: "Craftsman Note" plus
  // Victor's name makes it unmistakable who is speaking.
  const ownerResponseHtml = (item) => {
      if (!item.ownerResponse) return '';
      return `
          <div class="mt-4 bg-blue-950/95 text-slate-100 rounded-2xl p-4 border-l-4 border-red-600">
              <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mb-2">
                  <span class="inline-flex items-center gap-1.5 bg-red-500/15 text-red-200 border border-red-300/40 rounded-full pl-2 pr-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                      ${HAMMER_SVG} Craftsman Note
                  </span>
                  <span class="text-[11px] font-semibold text-slate-400">Victor · Owner, AAA Handyman Services LLC</span>
              </div>
              <p class="text-sm leading-relaxed text-slate-200">${escapeHTML(item.ownerResponse)}</p>
          </div>
      `;
  };

  // Review photos live in Netlify Blobs and are streamed by the
  // /api/reviews/photo/:key function. A card must never assume the record
  // has a usable photo, so anything that isn't a real photo path is
  // treated as "no photo" instead of becoming a dead <img>.
  const PHOTO_ROUTE = '/api/reviews/photo/';

  const photoPathOf = (item) => {
      const url = typeof item?.imageUrl === 'string' ? item.imageUrl.trim() : '';
      return url.startsWith(PHOTO_ROUTE) && url.length > PHOTO_ROUTE.length ? url : '';
  };

  // Returns up to three real photo paths for a review. The API now sends an
  // `imageUrls` array; older responses that only carried `imageUrl` fall back
  // to that single path so the strip keeps working during the rollout. The
  // primary path is always first and matches `photoPathOf`.
  const photoPathsOf = (item) => {
      const urls = Array.isArray(item?.imageUrls) ? item.imageUrls : [];
      const paths = urls
          .map((url) => (typeof url === 'string' ? url.trim() : ''))
          .filter((url) => url.startsWith(PHOTO_ROUTE) && url.length > PHOTO_ROUTE.length);
      if (paths.length) return paths.slice(0, 3);
      const primary = photoPathOf(item);
      return primary ? [primary] : [];
  };

  const transformedPhoto = (path, width, quality) =>
      `/.netlify/images?url=${encodeURIComponent(path)}&w=${width}&fm=avif&q=${quality}`;

  const photoPlaceholderHtml = () => `
              <div class="w-full h-full bg-blue-900 text-blue-200 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <i class="fas fa-camera-retro text-3xl text-red-400" aria-hidden="true"></i>
                  <span class="text-xs font-semibold uppercase tracking-widest">Photo unavailable</span>
              </div>`;

  // The Image CDN transform is an optimisation, not a dependency: if it
  // can't produce a thumbnail, fall back to the original blob, and only
  // then to a placeholder. A visitor should never see a broken icon.
  const attachPhotoFallback = (img) => {
      if (!img) return;

      const useFallback = () => {
          const original = img.dataset.original || '';
          if (original && img.dataset.triedOriginal !== 'true') {
              img.dataset.triedOriginal = 'true';
              img.src = original;
              return;
          }
          const preview = img.closest('.review-preview');
          if (preview) preview.innerHTML = photoPlaceholderHtml();
      };

      img.addEventListener('error', useFallback);
      // innerHTML starts the request immediately, so a already-cached
      // failure can land before this listener is attached.
      if (img.complete && img.naturalWidth === 0) useFallback();
  };

  const buildCard = (item, index) => {
      const card = document.createElement('article');
      card.className = 'review-card bg-white text-gray-900 rounded-3xl overflow-hidden shadow-xl border border-gray-150 flex flex-col';
      card.dataset.category = item.projectType || '';
      card.dataset.city = cityOf(item.location);
      // A map pin scrolls to its review and moves focus there, so each card
      // needs a stable id and a programmatic focus target of its own.
      card.id = `review-${item.id}`;
      card.tabIndex = -1;
      card.style.animationDelay = `${Math.min(index, 8) * 60}ms`;
      const badgeStyle = badgeColors[item.projectType] || 'bg-gray-100 text-gray-800 border-gray-200';
      const canManage = Boolean(localStorage.getItem('aaaAdminToken'));
      const photoPaths = photoPathsOf(item);
      const photoPath = photoPaths[0] || '';
      const thumbUrl = photoPath ? transformedPhoto(photoPath, 800, 80) : '';
      const fullUrl = photoPath ? transformedPhoto(photoPath, 1600, 82) : '';
      const { quote, body } = pullQuoteOf(item.review, item.location);

      const previewHtml = photoPath ? `
              <button type="button" class="review-zoom block w-full h-full focus:outline-none focus-visible:ring-4 focus-visible:ring-red-500/50" data-full="${escapeHTML(fullUrl)}" data-original="${escapeHTML(photoPath)}" data-caption="${escapeHTML(item.projectType)} · ${escapeHTML(item.location)}" data-alt="${escapeHTML(item.imageAlt)}" aria-label="Zoom photo: ${escapeHTML(item.projectType)} in ${escapeHTML(item.location)}">
                  <img class="review-photo w-full h-full object-cover" src="${escapeHTML(thumbUrl)}" data-original="${escapeHTML(photoPath)}" alt="${escapeHTML(item.imageAlt)}" width="800" height="600" loading="lazy" decoding="async">
                  <span class="pointer-events-none absolute bottom-3 right-3 h-9 w-9 rounded-full bg-black/55 text-white flex items-center justify-center text-sm"><i class="fas fa-magnifying-glass-plus" aria-hidden="true"></i></span>
              </button>` : photoPlaceholderHtml();

      // Compact 3-column thumbnail strip for the review's photos. The strip
      // includes the primary photo as its first tile, so a single-photo
      // review shows one thumbnail and a three-photo review fills the row.
      // Each tile is a zoom button carrying its own lightbox target.
      const stripHtml = photoPaths.length > 1
          ? `<div class="review-strip grid grid-cols-3 gap-1 border-t border-gray-100 bg-gray-50">${photoPaths.map((path, i) => {
              const tUrl = transformedPhoto(path, 480, 75);
              const fUrl = transformedPhoto(path, 1600, 82);
              const alt = i === 0 ? item.imageAlt : `${item.projectType} project photo ${i + 1} from ${item.customerName} in ${item.location}`;
              return `<button type="button" class="review-zoom relative block aspect-[4/3] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60" data-full="${escapeHTML(fUrl)}" data-original="${escapeHTML(path)}" data-caption="${escapeHTML(item.projectType)} · ${escapeHTML(item.location)}" data-alt="${escapeHTML(alt)}" aria-label="Zoom photo ${i + 1}: ${escapeHTML(item.projectType)} in ${escapeHTML(item.location)}">
                  <img class="review-photo w-full h-full object-cover" src="${escapeHTML(tUrl)}" data-original="${escapeHTML(path)}" alt="${escapeHTML(alt)}" width="480" height="360" loading="lazy" decoding="async">
              </button>`;
          }).join('')}</div>`
          : '';

      const actionsHtml = canManage ? `
              <div class="mt-5 grid grid-cols-2 gap-3">
                  <button type="button" class="review-edit-btn bg-green-600 text-white hover:bg-green-700 px-3 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md hover:shadow-green-600/30" data-id="${escapeHTML(item.id)}" aria-label="Edit review by ${escapeHTML(item.customerName)}">
                      <i class="fas fa-pen-to-square" aria-hidden="true"></i> Edit
                  </button>
                  <button type="button" class="review-delete-btn bg-red-600 text-white hover:bg-red-700 px-3 py-2.5 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-1.5" data-id="${escapeHTML(item.id)}" aria-label="Delete review by ${escapeHTML(item.customerName)}">
                      <i class="fas fa-trash-can" aria-hidden="true"></i> Delete
                  </button>
              </div>
      ` : '';

      card.innerHTML = `
          <div class="review-preview bg-gray-50 relative overflow-hidden">
              ${previewHtml}
              <div class="absolute top-4 left-4 right-4 flex flex-wrap items-start justify-between gap-2">
                  <span class="${badgeStyle} text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-md border">
                      ${escapeHTML(item.projectType)}
                  </span>
                  <span class="bg-white/95 text-emerald-800 border border-emerald-300 text-[10px] font-bold uppercase tracking-wider pl-2 pr-2.5 py-1.5 rounded-full shadow-md flex items-center gap-1.5 whitespace-nowrap">
                      ${CHECK_CIRCLE_SVG} Verified Local Project
                  </span>
              </div>
          </div>
          ${stripHtml}
          <div class="p-6 flex flex-col flex-1">
              <div class="flex items-center justify-between gap-3 mb-4">
                  <div class="text-red-600 text-lg flex gap-1" role="img" aria-label="${escapeHTML(item.rating)} out of 5 stars">
                      ${stars(Number(item.rating) || 0)}
                  </div>
                  <span class="inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
                      <i class="fas fa-location-dot text-red-500" aria-hidden="true"></i> ${escapeHTML(item.location)}
                  </span>
              </div>
              ${quote ? `<p class="review-pullquote mb-3">“${escapeHTML(quote)}”</p>` : ''}
              ${body ? `<p class="text-gray-700 leading-relaxed text-[15px]">${escapeHTML(body)}</p>` : ''}
              ${attributesHtml(item.attributes)}
              ${ownerResponseHtml(item)}
              <div class="mt-5 pt-4 border-t border-gray-100 flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm uppercase flex-none">
                      ${escapeHTML(item.customerName.charAt(0))}
                  </div>
                  <div>
                      <strong class="text-gray-900 block text-sm">${escapeHTML(item.customerName)}</strong>
                      <span class="mt-1 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full pl-1.5 pr-2.5 py-0.5 text-[11px] font-bold">
                          ${CHECK_CIRCLE_SVG} Verified Customer
                      </span>
                  </div>
              </div>
              ${actionsHtml}
          </div>
      `;

      // Attach the Image CDN fallback chain to every photo on the card --
      // the primary hero image and each tile in the 3-column strip.
      card.querySelectorAll('.review-photo').forEach((img) => attachPhotoFallback(img));

      card.querySelectorAll('.review-zoom').forEach((trigger) => {
          trigger.addEventListener('click', (event) => {
              const t = event.currentTarget;
              openLightbox(t.dataset.full, t.dataset.alt, t.dataset.caption, t.dataset.original);
          });
      });

      if (canManage) {
          card.querySelector('.review-edit-btn')?.addEventListener('click', () => startReviewsEdit(item));
          card.querySelector('.review-delete-btn')?.addEventListener('click', () => deleteReviewsItem(item.id));
      }
      return card;
  };

  // Names the filters currently in force, for the empty state's copy:
  // "plumbing in Troy", "Troy", "plumbing", or nothing at all.
  const activeFilterSummary = () => {
      const parts = [];
      if (activeFilter !== 'all') parts.push(activeFilter.toLowerCase());
      if (activeCity !== 'all') parts.push(activeCity);
      return parts.join(' in ');
  };

  const renderReviews = () => {
      if (!reviewsList || !reviewsEmpty || !reviewsLoading) return;
      reviewsLoading.classList.add('hidden');
      reviewsList.innerHTML = '';

      const hasAny = allReviews.length > 0;
      reviewsEmpty.classList.toggle('hidden', hasAny);

      const filtered = allReviews.filter((item) => matchesFilter(item));
      if (reviewsFilterEmpty) {
          reviewsFilterEmpty.classList.toggle('hidden', !hasAny || filtered.length > 0);
      }
      if (reviewsFilterEmptyCopy) {
          const summary = activeFilterSummary();
          reviewsFilterEmptyCopy.textContent = summary
              ? `No projects for ${summary} yet. Try another service or city, or clear the filters to see every Oakland County project.`
              : 'Try another service or city — or clear the filters to see every Oakland County project.';
      }

      filtered.forEach((item, index) => {
          reviewsList.appendChild(buildCard(item, index));
      });
  };

  // --- Filter rows: service category and city, applied together ---
  // Neither row is captured once: both are built up from the reviews that came
  // back, and every pill they gain has to answer to the same aria-pressed
  // bookkeeping as the ones the page shipped with.
  const serviceTabs = () => (serviceTabsHost ? Array.from(serviceTabsHost.querySelectorAll('.filter-tab')) : []);
  const cityTabs = () => (cityTabsHost ? Array.from(cityTabsHost.querySelectorAll('.city-tab')) : []);

  const applyFilters = ({ filter, city } = {}) => {
      if (typeof filter === 'string') activeFilter = filter;
      if (typeof city === 'string') activeCity = city;
      serviceTabs().forEach((btn) => {
          btn.setAttribute('aria-pressed', String((btn.dataset.filter || 'all') === activeFilter));
      });
      cityTabs().forEach((btn) => {
          btn.setAttribute('aria-pressed', String((btn.dataset.city || 'all') === activeCity));
      });
      renderReviews();
  };

  /*
   * The service row is generated from the gallery rather than hard-coded.
   *
   * It used to be eight pills written into the HTML, which drifted from the
   * submission form in both directions at once: it offered Plumbing and
   * Electrical whether or not anyone had posted such a job, and it had no pill
   * at all for Doors, Flooring, or Other Service, so those showcases could only
   * ever be reached under "All Projects". Deriving the row from the reviews
   * settles both -- a category appears the moment its first showcase is
   * published and disappears again with its last -- and it means a category the
   * owner types by hand while editing a review gets a working pill for free.
   *
   * The icons stay hard-coded, keyed by the exact value the form stores, since
   * they are the one part that cannot come from the data. An unrecognised
   * category falls back to the toolbox rather than losing its pill.
   */
  const SERVICE_ICONS = {
      'Carpentry & Trim': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 5h10.2l2.8 2.6-2.8 2.6H4.5Z"/><path d="M10.4 10.2 13 21"/></svg>',
      'Doors': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M15.2 12h.01"/></svg>',
      'Drywall': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M9 14.7V20"/></svg>',
      'Painting': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="13" height="5.5" rx="1.5"/><path d="M10 9v3.5"/><rect x="7.5" y="12.5" width="5" height="8" rx="2"/></svg>',
      'Electrical': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3.8 13.4h6.4L11 22l9.2-11.4h-6.4L13 2Z"/></svg>',
      'Plumbing': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 8l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 8-8l-3.8 3.8Z"/></svg>',
      'Decks & Fences': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V7.6L7.5 4.5 10 7.6V21M14 21V7.6l2.5-3.1L19 7.6V21"/><path d="M2.5 10.5h19M2.5 15.5h19"/></svg>',
      'Flooring': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 8.5h18M3 13h18M3 17.5h18"/></svg>',
      'Maintenance': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/></svg>'
  };
  const SERVICE_ICON_FALLBACK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5h17v10a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5Z"/><path d="M9 8.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2.5"/><path d="M3.5 13h17"/></svg>';

  // Pills read left to right in the order the submission form lists its
  // options, so the row looks the same from one visit to the next instead of
  // reshuffling with whichever review happened to be posted most recently.
  // Anything the owner typed by hand sorts alphabetically after the known set.
  const SERVICE_ORDER = [
      'Carpentry & Trim', 'Doors', 'Drywall', 'Painting', 'Electrical',
      'Plumbing', 'Decks & Fences', 'Flooring', 'Maintenance', 'Other Service'
  ];

  const publishedServices = () => {
      const seen = new Map();
      allReviews.forEach((item) => {
          const name = String(item.projectType || '').trim();
          if (name && !seen.has(serviceKey(name))) seen.set(serviceKey(name), name);
      });
      const rank = (name) => {
          const index = SERVICE_ORDER.indexOf(name);
          return index === -1 ? SERVICE_ORDER.length : index;
      };
      return Array.from(seen.values())
          .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  };

  const syncServiceTabs = () => {
      if (!serviceTabsHost) return;
      const services = publishedServices();
      const wanted = new Set(services);

      // A pill whose last showcase has been deleted is taken back, so the row
      // never offers a filter that can only come up empty. If it was the one in
      // force, the grid falls back to "All Projects" rather than sitting on a
      // category no longer on screen.
      let orphaned = false;
      serviceTabs().forEach((btn) => {
          if (btn.dataset.dynamic !== 'true' || wanted.has(btn.dataset.filter)) return;
          orphaned = orphaned || activeFilter === btn.dataset.filter;
          btn.remove();
      });

      const known = new Set(serviceTabs().map((btn) => btn.dataset.filter || 'all'));
      services.forEach((name) => {
          if (known.has(name)) return;
          const tab = document.createElement('button');
          tab.type = 'button';
          tab.className = 'filter-tab inline-flex items-center gap-2 bg-white/5 border border-white/20 text-slate-200 hover:bg-white/10 rounded-full px-4 py-2 text-sm font-semibold';
          tab.dataset.filter = name;
          tab.dataset.dynamic = 'true';
          tab.setAttribute('aria-pressed', String(activeFilter === name));
          tab.innerHTML = SERVICE_ICONS[name] || SERVICE_ICON_FALLBACK;
          // The label is appended as text, never as markup: it is customer- or
          // owner-supplied and an ampersand in "Decks & Fences" has to survive
          // as an ampersand.
          tab.appendChild(document.createTextNode(name));
          serviceTabsHost.appendChild(tab);
          known.add(name);
      });

      // Re-appending in rank order puts a newly published category in its
      // proper place rather than on the end. "All Projects" is not dynamic, so
      // it is never moved and stays first.
      services.forEach((name) => {
          const tab = serviceTabs().find((btn) => btn.dataset.filter === name);
          if (tab) serviceTabsHost.appendChild(tab);
      });

      // One category is not a choice, so the row only appears once there are
      // two to pick between.
      serviceFilterBlock?.classList.toggle('hidden', services.length < 2);

      if (orphaned) applyFilters({ filter: 'all' });
  };

  // Gives a pill to any city holding a review that the page ships without one,
  // so a map popup's "See all N projects" always has a filter pill to light up
  // and the visitor can find their way back to "All Cities".
  const syncCityTabs = (byCity) => {
      if (!cityTabsHost) return;
      // A pill this function added earlier is taken back once its last review
      // is gone, so the row never offers a filter that can only come up empty.
      let orphaned = false;
      cityTabs().forEach((btn) => {
          if (btn.dataset.dynamic !== 'true' || (byCity.get(btn.dataset.city) || []).length) return;
          orphaned = orphaned || activeCity === btn.dataset.city;
          btn.remove();
      });

      const known = new Set(cityTabs().map((btn) => btn.dataset.city || 'all'));
      MAP_CITIES.forEach((city) => {
          if (known.has(city.name) || !(byCity.get(city.name) || []).length) return;
          const tab = document.createElement('button');
          tab.type = 'button';
          tab.className = 'city-tab bg-white/5 border border-white/20 text-slate-200 hover:bg-white/10 rounded-full px-3.5 py-1.5 text-[13px] font-semibold';
          tab.dataset.city = city.name;
          tab.dataset.dynamic = 'true';
          tab.setAttribute('aria-pressed', String(activeCity === city.name));
          tab.textContent = city.name;
          cityTabsHost.appendChild(tab);
          known.add(city.name);
      });

      if (orphaned) applyFilters({ city: 'all' });
  };

  // Both rows are delegated so the pills these functions add are clickable
  // without any extra wiring of their own.
  serviceTabsHost?.addEventListener('click', (event) => {
      const tab = event.target instanceof Element ? event.target.closest('.filter-tab') : null;
      if (tab) applyFilters({ filter: tab.dataset.filter || 'all' });
  });

  cityTabsHost?.addEventListener('click', (event) => {
      const tab = event.target instanceof Element ? event.target.closest('.city-tab') : null;
      if (tab) applyFilters({ city: tab.dataset.city || 'all' });
  });

  if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => applyFilters({ filter: 'all', city: 'all' }));
  }

  /* ------------------------------------------------------------------------
   * Oakland County project map
   *
   * The county line, lakes, and highways are a static SVG in the page; the
   * pins are HTML buttons positioned over it from the reviews just loaded, so
   * the map can never advertise a project the grid below does not hold. They
   * are buttons rather than SVG shapes because each needs a focus ring, an
   * accessible name, and a popup it owns -- all free on a <button>.
   * ---------------------------------------------------------------------- */
  const popupState = { city: '', sticky: false };
  let openPin = null;
  let popupCloseTimer = null;

  const closeMapPopup = () => {
      window.clearTimeout(popupCloseTimer);
      if (!mapPopup) return;
      mapPopup.hidden = true;
      popupState.city = '';
      popupState.sticky = false;
      if (openPin) {
          openPin.classList.remove('is-open');
          openPin.setAttribute('aria-expanded', 'false');
          openPin = null;
      }
  };

  // A pointer travelling from the pin to the card it opened passes over the
  // map for a moment, so closing is delayed long enough to survive the gap.
  const scheduleMapPopupClose = () => {
      if (popupState.sticky) return;
      window.clearTimeout(popupCloseTimer);
      popupCloseTimer = window.setTimeout(closeMapPopup, 260);
  };

  const scrollToShowcases = () => {
      if (!reviewsList) return;
      reviewsList.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start'
      });
  };

  const jumpToReview = (id) => {
      closeMapPopup();
      let card = document.getElementById(`review-${id}`);
      if (!card) {
          // The review may be filtered out of the grid right now. Clearing the
          // filters is far less surprising than a link that does nothing.
          applyFilters({ filter: 'all', city: 'all' });
          card = document.getElementById(`review-${id}`);
      }
      if (!card) return;

      card.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'center'
      });
      // preventScroll: the browser's own focus scroll would land instantly and
      // cancel the smooth one above.
      card.focus({ preventScroll: true });
      card.classList.add('is-targeted');
      window.setTimeout(() => card.classList.remove('is-targeted'), 2600);
  };

  const mapPopupHtml = (city, items) => {
      const closeButton = `
          <button type="button" class="map-popup__close absolute top-2 right-2 h-7 w-7 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition" aria-label="Close ${escapeHTML(city.name)} details">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"></path></svg>
          </button>`;
      const caret = '<span class="map-popup__caret" aria-hidden="true"></span>';

      if (!items.length) {
          return `${caret}${closeButton}
              <p class="text-[11px] font-bold uppercase tracking-widest text-red-700 pr-6">${escapeHTML(city.name)}, MI</p>
              <p class="text-sm text-gray-600 leading-relaxed mt-1.5">In our service area — no customer reviews from ${escapeHTML(city.name)} yet.</p>
              <button type="button" class="map-popup__form mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-red-700 hover:text-red-800 transition">Be the first to post one <span aria-hidden="true">→</span></button>`;
      }

      const featured = items[0];
      const more = items.length > 1
          ? `<button type="button" class="map-popup__more mt-2.5 block w-full text-[11px] font-bold uppercase tracking-wider text-blue-900/70 hover:text-red-700 transition">See all ${items.length} ${escapeHTML(city.name)} projects</button>`
          : '';

      // The photo is the proof the review is real, so it leads the card. It is
      // requested at roughly 2x the rendered width for retina, kept to a fixed
      // strip so a tall photo cannot push the card off the map, and reuses the
      // same Image CDN transform and fallback chain as the grid below.
      const photoPath = photoPathOf(featured);
      const photo = photoPath
          ? `<div class="review-preview map-popup__photo mt-2 rounded-xl overflow-hidden bg-blue-900 h-24 sm:h-28">
                  <img src="${escapeHTML(transformedPhoto(photoPath, 520, 72))}" data-original="${escapeHTML(photoPath)}" alt="${escapeHTML(featured.imageAlt || `${featured.projectType} project in ${city.name}`)}" class="review-photo w-full h-full object-cover" loading="lazy" decoding="async">
              </div>`
          : '';

      return `${caret}${closeButton}
          <div class="flex items-baseline justify-between gap-2 pr-6">
              <p class="text-[11px] font-bold uppercase tracking-widest text-red-700">${escapeHTML(city.name)}, MI</p>
          </div>
          ${photo}
          <div class="flex items-center gap-2 mt-2">
              <span class="text-red-600 text-[13px] flex gap-0.5" role="img" aria-label="${escapeHTML(featured.rating)} out of 5 stars">${stars(Number(featured.rating) || 0)}</span>
              <span class="text-[11px] font-bold text-gray-500 truncate">${escapeHTML(featured.projectType)}</span>
          </div>
          <p class="text-sm text-gray-800 font-semibold leading-snug mt-2">“${escapeHTML(mapExcerptOf(featured))}”</p>
          <p class="text-[11px] text-gray-500 font-medium mt-1.5">— ${escapeHTML(featured.customerName)}, ${escapeHTML(featured.location)}</p>
          <button type="button" class="map-popup__jump mt-3 w-full inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition" data-id="${escapeHTML(featured.id)}">Read this review <span aria-hidden="true">→</span></button>
          ${more}`;
  };

  // Anchoring the card by the same fraction of its own width as the pin's
  // distance across the map slides it back inside the frame as the pin nears
  // an edge, and keeps the caret over the pin, without measuring anything
  // horizontally. Vertically it does measure: the card carries a photo now, so
  // whether it fits above the pin depends on the card's real height and the
  // map's, not on a fixed fraction. The card is already visible when this
  // runs, so both are readable.
  const positionMapPopup = (pin) => {
      if (!mapPopup) return;
      const xPct = Number.parseFloat(pin.style.left) || 50;
      const yPct = Number.parseFloat(pin.style.top) || 50;
      const anchor = Math.min(85, Math.max(15, xPct));
      const frameHeight = mapPopup.offsetParent ? mapPopup.offsetParent.clientHeight : 0;
      const cardHeight = mapPopup.offsetHeight;
      let below = yPct < 38;
      if (frameHeight && cardHeight) {
          const roomAbove = (yPct / 100) * frameHeight - 26;
          const roomBelow = frameHeight - (yPct / 100) * frameHeight - 26;
          below = roomAbove < cardHeight && roomBelow > roomAbove;
      }

      mapPopup.style.left = `${xPct}%`;
      mapPopup.style.top = `${yPct}%`;
      mapPopup.style.transform = below
          ? `translate(-${anchor}%, 26px)`
          : `translate(-${anchor}%, calc(-100% - 26px))`;
      mapPopup.classList.toggle('is-below', below);

      const caret = mapPopup.querySelector('.map-popup__caret');
      if (caret) caret.style.left = `${anchor}%`;
  };

  const openMapPopup = (city, items, pin, sticky) => {
      if (!mapPopup) return;
      window.clearTimeout(popupCloseTimer);

      if (openPin && openPin !== pin) {
          openPin.classList.remove('is-open');
          openPin.setAttribute('aria-expanded', 'false');
      }
      if (popupState.city !== city.name) {
          mapPopup.innerHTML = mapPopupHtml(city, items);
          attachPhotoFallback(mapPopup.querySelector('.review-photo'));
          popupState.city = city.name;
      }
      popupState.sticky = popupState.sticky && openPin === pin ? true : Boolean(sticky);
      openPin = pin;
      pin.classList.add('is-open');
      pin.setAttribute('aria-expanded', 'true');
      mapPopup.hidden = false;
      positionMapPopup(pin);

      // Opening deliberately (click or Enter) hands focus to the card's first
      // action. Without that a keyboard visitor would have to tab past every
      // remaining pin to reach the review the pin was pointing at.
      if (sticky) {
          mapPopup.querySelector('.map-popup__jump, .map-popup__form, .map-popup__close')?.focus();
      }
  };

  // The trust tile above the map makes the same claim the pins do, so it is
  // written from the same list rather than kept in the page by hand. Hard-coded,
  // it stayed on twelve while a thirteenth city's pin was already on the map.
  //
  // The subtitle keeps the home base on one end and names whichever served city
  // sits furthest from it, which is Southfield until a review arrives from
  // somewhere further out -- so the phrase is always a span we can show work
  // across.
  const HOME_CITY = 'Waterford';

  const renderCitiesServed = (served) => {
      if (citiesServedCount) {
          citiesServedCount.textContent =
              `${served.length} Oakland County ${served.length === 1 ? 'City' : 'Cities'} Served`;
      }

      const home = MAP_CITIES.find((city) => city.name === HOME_CITY);
      if (!citiesServedRange || !home) return;

      const furthest = served.reduce((far, city) => {
          if (city.name === HOME_CITY) return far;
          const distance = Math.hypot(city.x - home.x, city.y - home.y);
          return !far || distance > far.distance ? { name: city.name, distance } : far;
      }, null);

      citiesServedRange.textContent = furthest ? `${HOME_CITY} to ${furthest.name}` : HOME_CITY;
  };

  const renderMap = () => {
      if (!mapPinsHost) return;
      closeMapPopup();

      const byCity = new Map();
      let unplaced = 0;
      allReviews.forEach((item) => {
          const city = cityOf(item.location);
          if (!city) {
              unplaced += 1;
              return;
          }
          if (!byCity.has(city)) byCity.set(city, []);
          byCity.get(city).push(item);
      });

      // Every city holding a review is drawn, whether or not it is one of the
      // twelve that anchor the map. A reviewer who typed a service-area city
      // we do not anchor -- Royal Oak, Beverly Hills -- gets their pin the
      // moment they post, instead of dropping off the map entirely.
      mapPinsHost.innerHTML = '';
      const served = MAP_CITIES.filter((city) => city.core || (byCity.get(city.name) || []).length);
      served.forEach((city) => {
          const items = byCity.get(city.name) || [];
          const pin = document.createElement('button');
          pin.type = 'button';
          pin.className = `map-pin ${items.length ? 'is-active' : 'is-empty'}`;
          pin.style.left = `${(city.x / MAP_VIEWBOX.width) * 100}%`;
          pin.style.top = `${(city.y / MAP_VIEWBOX.height) * 100}%`;
          pin.dataset.label = city.label;
          pin.setAttribute('aria-expanded', 'false');
          pin.setAttribute('aria-label', items.length
              ? `${city.name}: ${items.length} completed ${items.length === 1 ? 'project' : 'projects'} with a customer review. Show details.`
              : `${city.name}: in our service area, no customer reviews yet.`);
          pin.innerHTML = `
              <span class="map-pin__pulse" aria-hidden="true"></span>
              <span class="map-pin__dot" aria-hidden="true">${items.length ? PIN_CHECK_SVG : ''}</span>
              <span class="map-pin__name" aria-hidden="true">${escapeHTML(city.name)}${items.length > 1 ? `<span class="map-pin__count">${items.length}</span>` : ''}</span>`;

          pin.addEventListener('mouseenter', () => openMapPopup(city, items, pin, false));
          pin.addEventListener('focus', () => openMapPopup(city, items, pin, false));
          pin.addEventListener('click', () => openMapPopup(city, items, pin, true));
          pin.addEventListener('mouseleave', scheduleMapPopupClose);
          pin.addEventListener('blur', (event) => {
              if (mapPopup && mapPopup.contains(event.relatedTarget)) return;
              scheduleMapPopupClose();
          });
          mapPinsHost.appendChild(pin);
      });

      syncCityTabs(byCity);
      renderCitiesServed(served);

      const pinned = Array.from(byCity.values()).reduce((total, list) => total + list.length, 0);
      const cities = byCity.size;
      if (mapSummary) {
          // A review whose location we cannot place still exists in the grid,
          // so the count says so rather than quietly leaving it out.
          const elsewhere = unplaced ? ` · ${unplaced} more not on the map` : '';
          mapSummary.textContent = pinned
              ? `${pinned} pinned ${pinned === 1 ? 'project' : 'projects'} · ${cities} ${cities === 1 ? 'city' : 'cities'}${elsewhere}`
              : `${MAP_CITIES.length} cities in our service area`;
      }
  };

  if (mapPopup) {
      mapPopup.addEventListener('mouseenter', () => window.clearTimeout(popupCloseTimer));
      mapPopup.addEventListener('mouseleave', scheduleMapPopupClose);

      mapPopup.addEventListener('click', (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target) return;

          const jump = target.closest('.map-popup__jump');
          if (jump) {
              jumpToReview(jump.dataset.id);
              return;
          }
          if (target.closest('.map-popup__more')) {
              const city = popupState.city;
              closeMapPopup();
              applyFilters({ filter: 'all', city });
              scrollToShowcases();
              return;
          }
          if (target.closest('.map-popup__form')) {
              closeMapPopup();
              reviewsForm?.scrollIntoView({
                  behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                  block: 'center'
              });
              document.getElementById('reviews-name')?.focus({ preventScroll: true });
              return;
          }
          if (target.closest('.map-popup__close')) {
              const pin = openPin;
              closeMapPopup();
              pin?.focus();
          }
      });

      // Focus leaving the card entirely closes it, unless it went back to the
      // pin that opened it -- which has its own blur handling.
      mapPopup.addEventListener('focusout', (event) => {
          if (mapPopup.contains(event.relatedTarget) || event.relatedTarget === openPin) return;
          closeMapPopup();
      });

      document.addEventListener('keydown', (event) => {
          if (event.key !== 'Escape' || mapPopup.hidden) return;
          const pin = openPin;
          closeMapPopup();
          pin?.focus();
      });

      document.addEventListener('click', (event) => {
          if (mapPopup.hidden) return;
          const target = event.target instanceof Element ? event.target : null;
          if (target && (target.closest('.map-pin') || target.closest('#map-popup'))) return;
          closeMapPopup();
      });

      // The pins are placed in percentages, so a resize needs no re-layout --
      // but the open card's caret was anchored to where the pin used to be.
      window.addEventListener('resize', () => {
          if (!mapPopup.hidden && openPin) positionMapPopup(openPin);
      });
  }

  // --- Lightbox ---
  const openLightbox = (src, alt, caption, original) => {
      if (!lightbox || !lightboxImg) return;
      lastFocusedBeforeLightbox = document.activeElement;
      // Same reasoning as the card thumbnails: if the transformed image
      // fails, show the original blob rather than a broken icon.
      lightboxImg.dataset.original = original || '';
      lightboxImg.dataset.triedOriginal = 'false';
      lightboxImg.src = src || original || '';
      lightboxImg.alt = alt || caption || 'Project photo preview';
      if (lightboxCaption) lightboxCaption.textContent = caption || '';
      lightbox.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      lightboxClose?.focus();
  };

  const closeLightbox = () => {
      if (!lightbox) return;
      lightbox.classList.add('hidden');
      if (lightboxImg) lightboxImg.src = '';
      document.body.style.overflow = '';
      if (lastFocusedBeforeLightbox && typeof lastFocusedBeforeLightbox.focus === 'function') {
          lastFocusedBeforeLightbox.focus();
      }
  };

  if (lightbox) {
      lightboxImg?.addEventListener('error', () => {
          const original = lightboxImg.dataset.original || '';
          if (original && lightboxImg.dataset.triedOriginal !== 'true') {
              lightboxImg.dataset.triedOriginal = 'true';
              lightboxImg.src = original;
          }
      });
      lightboxClose?.addEventListener('click', closeLightbox);
      lightbox.addEventListener('click', (event) => {
          if (event.target === lightbox) closeLightbox();
      });
      document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && !lightbox.classList.contains('hidden')) closeLightbox();
      });

      // The overlay claims the whole viewport, so keyboard focus must stay
      // inside it — otherwise Tab walks invisibly through the page behind.
      lightbox.addEventListener('keydown', (event) => {
          if (event.key !== 'Tab' || lightbox.classList.contains('hidden')) return;
          const focusables = Array.from(
              lightbox.querySelectorAll('a[href], button:not([disabled])')
          ).filter((el) => el.offsetParent !== null);
          if (!focusables.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
          }
      });
  }

  const loadReviews = () => {
      if (!reviewsList || !reviewsLoading || !reviewsEmpty) return;
      reviewsLoading.classList.remove('hidden');
      reviewsEmpty.classList.add('hidden');
      if (reviewsFilterEmpty) reviewsFilterEmpty.classList.add('hidden');

      fetch('/api/reviews')
          .then(response => response.ok ? response.json() : Promise.reject())
          .then((items) => {
              allReviews = Array.isArray(items) ? items : [];
              // The pills are rebuilt before the grid draws, so a filter that
              // no longer has anything behind it is already gone by the time
              // renderReviews decides what to show.
              syncServiceTabs();
              renderReviews();
              renderMap();
          })
          .catch(() => {
              allReviews = [];
              syncServiceTabs();
              renderMap();
              reviewsLoading.classList.add('hidden');
              reviewsEmpty.classList.remove('hidden');
              const emptyText = reviewsEmpty.querySelector('p');
              if (emptyText) emptyText.textContent = "We couldn't load the reviews just now. Please refresh the page to try again.";
          });
  };

  // --- Photo picker wiring ---
  // Each of the three hidden <input>s fills the next free slot when it
  // changes; the live preview grid is the source of truth for what's chosen.
  // A click on the dropzone or an empty tile opens whichever slot is next.
  const nextFreeSlot = () => chosenFiles.findIndex((f) => !f);

  const openNextSlot = () => {
      const slot = nextFreeSlot();
      if (slot === -1) return;
      photoInputs[slot]?.click();
  };

  if (reviewsDropzone) {
      reviewsDropzone.addEventListener('click', (event) => {
          // Don't hijack clicks on the remove buttons or add tiles -- those
          // have their own handlers.
          if (event.target.closest('.review-slot-remove') || event.target.closest('.review-slot-add')) return;
          openNextSlot();
      });
  }

  photoInputs.forEach((input, slot) => {
      if (!input) return;
      input.addEventListener('change', () => {
          const file = input.files?.[0];
          if (!file) return;
          const rejection = photoRule.rejectionFor(file);
          if (rejection) {
              showReviewsMessage(rejection, true);
              input.value = '';
              return;
          }
          assignPhotoToSlot(file, slot);
          renderPhotoPreviews();
          syncPhotoRequired();
      });
  });

  // Remove buttons and empty add tiles inside the live preview grid both
  // delegate here.
  if (reviewsPreviewsGrid) {
      reviewsPreviewsGrid.addEventListener('click', (event) => {
          const removeBtn = event.target.closest('.review-slot-remove');
          if (removeBtn) {
              event.preventDefault();
              event.stopPropagation();
              const slot = Number(removeBtn.dataset.slot);
              if (Number.isInteger(slot)) {
                  clearPhotoSlot(slot);
                  renderPhotoPreviews();
                  syncPhotoRequired();
              }
              return;
          }
          const addTile = event.target.closest('.review-slot-add');
          if (addTile) {
              event.preventDefault();
              event.stopPropagation();
              const slot = Number(addTile.dataset.slot);
              if (Number.isInteger(slot)) photoInputs[slot]?.click();
          }
      });
  }

  if (reviewsDropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
          reviewsDropzone.addEventListener(eventName, (event) => {
              event.preventDefault();
              reviewsDropzone.classList.add('dragging');
          });
      });

      ['dragleave', 'drop'].forEach(eventName => {
          reviewsDropzone.addEventListener(eventName, (event) => {
              event.preventDefault();
              reviewsDropzone.classList.remove('dragging');
          });
      });

      reviewsDropzone.addEventListener('drop', (event) => {
          const files = Array.from(event.dataTransfer?.files || []);
          if (!files.length) return;
          // Drop every dragged image into consecutive free slots. Once the
          // three slots are full, extra files are ignored with a message.
          let added = 0;
          let full = false;
          const rejections = [];
          for (const file of files) {
              const rejection = photoRule.rejectionFor(file);
              if (rejection) {
                  rejections.push(rejection);
                  continue;
              }
              if (nextFreeSlot() === -1) { full = true; break; }
              assignPhotoToSlot(file);
              added += 1;
          }
          if (added) {
              renderPhotoPreviews();
              syncPhotoRequired();
          }
          // Say which files were turned away and why. Reporting only the count
          // cap would blame the slot limit for a file that was the wrong
          // format or over 10 MB.
          if (full) rejections.push('You can upload at most 3 photos.');
          if (rejections.length) {
              showReviewsMessage(rejections.join(' '), true);
          }
      });
  }

  if (reviewsForm) {
      reviewsForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const isEditing = Boolean(reviewsEditId);

          // A new review needs at least one photo; an edit can keep its
          // existing photos by sending none.
          const chosen = chosenFiles.filter(Boolean);
          if (!isEditing && chosen.length === 0) {
              showReviewsMessage('Please add at least one project photo.', true);
              return;
          }

          for (const file of chosen) {
              const rejection = photoRule.rejectionFor(file);
              if (rejection) {
                  showReviewsMessage(rejection, true);
                  return;
              }
          }

          setReviewsSubmitting(true);
          showReviewsMessage(isEditing ? 'Saving your changes...' : 'Uploading your review...', false);

          // Each chosen photo is downscaled/re-encoded in the browser so the
          // whole upload stays under the platform's buffered request limit.
          const prepared = [];
          try {
              for (const file of chosen) {
                  prepared.push(await preparePhotoForUpload(file));
              }
          } catch (error) {
              showReviewsMessage(error instanceof Error ? error.message : "We couldn't read that photo. Please try a different JPEG, PNG, WEBP, or GIF image.", true);
              setReviewsSubmitting(false);
              return;
          }

          const formData = new FormData(reviewsForm);
          // The form's hidden photo inputs may carry stale picks after a
          // drag-and-drop; send the prepared files explicitly by field name
          // so what's on the wire matches the preview exactly.
          formData.delete('photo');
          formData.delete('photo2');
          formData.delete('photo3');
          prepared.forEach((file, i) => {
              formData.append(i === 0 ? 'photo' : `photo${i + 1}`, file, file.name);
          });

          const adminToken = localStorage.getItem('aaaAdminToken') || '';
          if (isEditing && !adminToken) {
              showReviewsMessage('Turn on owner access to edit reviews.', true);
              setReviewsSubmitting(false);
              return;
          }
          const requestHeaders = isEditing ? { 'x-admin-token': adminToken } : undefined;

          fetch(isEditing ? `/api/reviews/${encodeURIComponent(reviewsEditId)}` : '/api/reviews', {
              method: isEditing ? 'PUT' : 'POST',
              headers: requestHeaders,
              body: formData
          })
          .then(async response => {
              // A payload rejected by the platform never reaches our
              // function, so it answers with a non-JSON error body.
              if (response.status === 413) throw new Error('Those photos were too large to upload together. Please remove one, or choose smaller images.');
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(payload.error || 'Upload failed.');
              return payload;
          })
          .then((payload) => {
              resetReviewsForm();
              showReviewsMessage(isEditing ? 'Your review was updated.' : 'Thank you! Your photo and review were added successfully.', false);
              loadReviews();
          })
          .catch(error => {
              const message = error instanceof Error ? error.message : String(error || '');
              showReviewsMessage(message || 'The review could not be saved.', true);
          })
          .finally(() => {
              setReviewsSubmitting(false);
          });
      });
  }

  if (reviewsCancelEdit) {
      reviewsCancelEdit.addEventListener('click', () => {
          resetReviewsForm();
          showReviewsMessage('Editing canceled.', false);
      });
  }

  if (reviewsRefresh) {
      reviewsRefresh.addEventListener('click', loadReviews);
  }

  updateAdminUI();
  loadReviews();
})();
