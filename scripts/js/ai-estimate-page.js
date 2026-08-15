/*
 * Behaviour for /ai-estimate: multi-photo drag-and-drop upload with live
 * thumbnail previews, client-side size/type validation, ZIP→zone lookup, the
 * analyze call to /api/ai-estimate, and the second-pass submit that forwards
 * contact details to dispatch.
 *
 * Two phases over the same endpoint:
 *   1. analyze  — primary photo + optional wide/extra angles + optional
 *                 zip/city, returns the AI estimate.
 *   2. submit   — same photos re-uploaded alongside contact details, flagged
 *                 with mode=submit so the row is marked "submitted" for
 *                 dispatch and the contact fields are persisted.
 *
 * The photos are re-sent on submit because the estimate row and the dispatch
 * review both reference the blobs, and the analyze call already proved the
 * upload is valid. Keeping handles to the chosen Files makes that free.
 */
(function () {
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const OAKLAND_ZIP = /^48[0-4]\d{2}$/;
  const MAX_PHOTOS = 3;

  // The three upload slots: 0 is the required close-up, 1 the wide/context
  // shot, 2 the optional extra angle. The labels surface in the thumbnail tag
  // so the customer can tell at a glance which angle goes where.
  const SLOT_META = [
    { tag: 'Close-up', label: 'Close-up', hint: 'The damage itself' },
    { tag: 'Wide shot', label: 'Wide / Context', hint: 'The surrounding area' },
    { tag: 'Extra', label: 'Extra angle', hint: 'Optional — another view' },
  ];

  // Progress messages cycled under the spinner while the analyzer runs. The
  // first is shown immediately; the rest follow every 2 seconds until the
  // request resolves.
  const PROGRESS_MESSAGES = [
    'Analyzing damage dimensions…',
    'Checking repair scope…',
    'Calculating labor & material rates…',
    'Cross-checking Oakland County rates…',
    'Finalizing your preliminary estimate…',
  ];

  const dropzone = document.getElementById('ai-dropzone');
  const fileInputs = [
    document.getElementById('ai-photo-input'),
    document.getElementById('ai-photo-input-2'),
    document.getElementById('ai-photo-input-3'),
  ];
  const idleEl = document.getElementById('ai-dropzone-idle');
  const previewsEl = document.getElementById('ai-dropzone-previews');
  const slotsEl = document.getElementById('ai-photo-slots');
  const countEl = document.getElementById('ai-photo-count');
  const photoError = document.getElementById('ai-photo-error');

  const zipInput = document.getElementById('ai-zip');
  const cityInput = document.getElementById('ai-city');
  const zoneMsg = document.getElementById('ai-zone-msg');

  const form = document.getElementById('ai-estimate-form');
  const analyzeBtn = document.getElementById('ai-analyze-btn');
  const analyzeLabel = document.getElementById('ai-analyze-btn-label');
  const analyzeIcon = document.getElementById('ai-analyze-btn-icon');
  const progressEl = document.getElementById('ai-analyze-progress');
  const statusText = document.getElementById('ai-analyze-status-text');
  const statusA11y = document.getElementById('ai-analyze-status');

  const resultEl = document.getElementById('ai-estimate-result');
  const outOfScopeBanner = document.getElementById('ai-out-of-scope-banner');
  const outOfScopeReason = document.getElementById('ai-out-of-scope-reason');
  const outputEl = document.getElementById('ai-estimate-output');
  const resultHeadline = document.getElementById('ai-result-headline');

  const submitBlock = document.getElementById('ai-submit-block');
  const submitForm = document.getElementById('ai-submit-form');
  const submitBtn = document.getElementById('ai-submit-btn');
  const submitError = document.getElementById('ai-submit-error');
  const submitSuccess = document.getElementById('ai-submit-success');

  // chosenFiles[i] holds the File chosen for slot i, or null. The primary
  // slot (0) is required before the analyze call will fire.
  const chosenFiles = [null, null, null];
  // Object URLs are revoked on swap/remove to avoid leaking the preview.
  const objectUrls = [null, null, null];
  let progressTimer = null;
  let progressIndex = 0;
  let areasPromise = null;

  const showPhotoError = (msg) => {
    if (!photoError) return;
    if (msg) {
      photoError.textContent = msg;
      photoError.classList.remove('hidden');
    } else {
      photoError.textContent = '';
      photoError.classList.add('hidden');
    }
  };

  const validateFile = (file) => {
    if (!file) return 'Please choose a photo to upload.';
    if (file.size === 0) return 'That photo looks empty. Please choose another.';
    if (file.size > MAX_IMAGE_SIZE) return 'Each photo must be 5 MB or smaller.';
    if (!IMAGE_TYPES.has(file.type)) return 'Upload a JPG, PNG, or WebP photo.';
    return '';
  };

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' })[c],
    );

  const renderSlots = () => {
    if (!slotsEl) return;
    slotsEl.innerHTML = '';
    for (let i = 0; i < MAX_PHOTOS; i++) {
      const meta = SLOT_META[i];
      const file = chosenFiles[i];
      const slot = document.createElement('div');
      slot.className = 'ai-photo-slot' + (file ? ' is-filled' : '');
      slot.setAttribute('role', 'listitem');
      slot.dataset.slot = String(i);

      if (file) {
        slot.innerHTML =
          '<span class="ai-photo-slot__tag">' + escapeHtml(meta.tag) + '</span>' +
          '<img src="' + objectUrls[i] + '" alt="Repair photo preview, ' + escapeHtml(meta.label) + '">' +
          '<div class="ai-photo-slot__actions">' +
            '<button type="button" class="ai-photo-slot__btn ai-photo-slot__btn--change" data-action="change" aria-label="Replace ' + escapeHtml(meta.label.toLowerCase()) + ' photo">' +
              '<i class="fas fa-arrows-rotate" aria-hidden="true"></i> Change' +
            '</button>' +
            '<button type="button" class="ai-photo-slot__btn" data-action="remove" aria-label="Remove ' + escapeHtml(meta.label.toLowerCase()) + ' photo">' +
              '<i class="fas fa-xmark" aria-hidden="true"></i> Remove' +
            '</button>' +
          '</div>';
      } else {
        slot.innerHTML =
          '<span class="ai-photo-slot__tag">' + escapeHtml(meta.tag) + '</span>' +
          '<div class="w-9 h-9 bg-red-600/15 rounded-xl flex items-center justify-center text-lg text-red-400 mb-1.5" aria-hidden="true"><i class="fas fa-plus"></i></div>' +
          '<span class="ai-photo-slot__label">' + escapeHtml(meta.label) + '</span>' +
          '<span class="ai-photo-slot__hint">' + escapeHtml(meta.hint) + '</span>';
      }
      slotsEl.appendChild(slot);
    }
  };

  const updatePreviewState = () => {
    const hasAny = chosenFiles.some(Boolean);
    if (idleEl) idleEl.classList.toggle('hidden', hasAny);
    if (previewsEl) previewsEl.classList.toggle('hidden', !hasAny);
    if (countEl) {
      const n = chosenFiles.filter(Boolean).length;
      if (n === 0) {
        countEl.textContent = '';
      } else if (n === 1) {
        countEl.textContent = '1 photo selected · add a wide shot and an extra angle for a better estimate.';
      } else {
        countEl.textContent = n + ' photos selected · tap any filled slot to change or remove it.';
      }
    }
  };

  const setSlotFile = (index, file) => {
    if (objectUrls[index]) URL.revokeObjectURL(objectUrls[index]);
    chosenFiles[index] = file;
    objectUrls[index] = file ? URL.createObjectURL(file) : null;
    renderSlots();
    updatePreviewState();
  };

  const clearSlot = (index) => {
    if (fileInputs[index]) fileInputs[index].value = '';
    setSlotFile(index, null);
  };

  const nextEmptySlot = () => {
    for (let i = 0; i < MAX_PHOTOS; i++) {
      if (!chosenFiles[i]) return i;
    }
    return -1;
  };

  const assignFile = (file, preferSlot) => {
    const err = validateFile(file);
    if (err) {
      showPhotoError(err);
      return false;
    }
    showPhotoError('');

    let slot = preferSlot;
    if (slot == null || chosenFiles[slot]) {
      slot = nextEmptySlot();
    }
    if (slot === -1) {
      showPhotoError('You can upload at most 3 photos. Remove one first.');
      return false;
    }
    setSlotFile(slot, file);
    return true;
  };

  const openPickerForSlot = (index) => {
    if (fileInputs[index]) fileInputs[index].click();
  };

  // Clicking anywhere in the dropzone opens the picker for the first empty
  // slot — unless the click landed on a filled slot's action button, in which
  // case that button's behaviour runs instead.
  if (dropzone) {
    dropzone.addEventListener('click', (e) => {
      const slotEl = e.target.closest('[data-slot]');
      const actionBtn = e.target.closest('[data-action]');

      if (slotEl && actionBtn) {
        const slot = Number(slotEl.dataset.slot);
        const action = actionBtn.dataset.action;
        if (action === 'remove') clearSlot(slot);
        else if (action === 'change') openPickerForSlot(slot);
        return;
      }

      if (slotEl) {
        // Clicking a filled slot's body (not its buttons) is a no-op; only an
        // empty slot should open its picker.
        const slot = Number(slotEl.dataset.slot);
        if (!chosenFiles[slot]) openPickerForSlot(slot);
        return;
      }

      const empty = nextEmptySlot();
      if (empty !== -1) openPickerForSlot(empty);
      else if (chosenFiles[0]) openPickerForSlot(0);
    });

    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const empty = nextEmptySlot();
        if (empty !== -1) openPickerForSlot(empty);
      }
    });

    ['dragenter', 'dragover'].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add('dropzone--dragging');
      }),
    );
    ['dragleave', 'drop'].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dropzone--dragging');
      }),
    );

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (!files || !files.length) return;
      // Drop fills empty slots in order; the first dropped file lands in the
      // primary slot if it is empty.
      for (const f of files) {
        if (nextEmptySlot() === -1) break;
        assignFile(f);
      }
    });
  }

  // Each hidden input is bound to a slot. When a slot's "Change" button opens
  // its own input, the picked file replaces just that slot.
  fileInputs.forEach((input, i) => {
    if (!input) return;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      assignFile(file, i);
      // Reset value so re-selecting the same file still fires change.
      input.value = '';
    });
  });

  // --- ZIP → zone lookup, mirroring the booking widget but trimmed to the
  // two things this page needs: a served/not-served answer and the city name.
  const loadAreas = () => {
    if (areasPromise) return areasPromise;
    areasPromise = fetch('/data/service-areas.json', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .catch(() => null);
    return areasPromise;
  };

  const resolveZip = (zip, data) => {
    if (!/^\d{5}$/.test(zip)) return null;
    if (!data || !data.cities) {
      return { city: '', served: OAKLAND_ZIP.test(zip), known: false };
    }
    for (const city of data.cities) {
      if ((city.zips || []).includes(zip)) {
        return { city: city.name, zone: city.zone, served: true, known: true };
      }
    }
    return { city: '', served: OAKLAND_ZIP.test(zip), known: false };
  };

  let zipTimer = null;
  if (zipInput) {
    zipInput.addEventListener('input', () => {
      clearTimeout(zipTimer);
      const value = zipInput.value.replace(/\D/g, '').slice(0, 5);
      zipInput.value = value;
      zipTimer = setTimeout(() => updateZoneMsg(value), 120);
    });
  }

  const updateZoneMsg = (zip) => {
    if (!zoneMsg) return;
    if (!zip) {
      zoneMsg.classList.add('hidden');
      zoneMsg.textContent = '';
      return;
    }
    loadAreas().then((data) => {
      const match = resolveZip(zip, data);
      if (!match) {
        zoneMsg.classList.add('hidden');
        return;
      }
      if (match.known) {
        zoneMsg.className =
          'mt-3 text-sm font-semibold p-3 rounded-xl bg-emerald-900/50 text-emerald-100 border border-emerald-500/40';
        zoneMsg.innerHTML =
          '<i class="fas fa-check-circle mr-1" aria-hidden="true"></i> We serve <strong>' +
          escapeHtml(match.city) +
          ', MI</strong>.';
        if (cityInput && !cityInput.value) cityInput.value = match.city;
      } else if (match.served) {
        zoneMsg.className =
          'mt-3 text-sm font-semibold p-3 rounded-xl bg-emerald-900/40 text-emerald-100 border border-emerald-500/30';
        zoneMsg.textContent =
          'That ZIP is in Oakland County — we cover it. Call (248) 385-3432 to confirm your travel zone.';
      } else {
        zoneMsg.className =
          'mt-3 text-sm font-semibold p-3 rounded-xl bg-amber-900/50 text-amber-100 border border-amber-500/40';
        zoneMsg.innerHTML =
          '<i class="fas fa-info-circle mr-1" aria-hidden="true"></i> That ZIP is outside our Oakland County service area. <a href="tel:+12483853432" class="underline font-bold">Call to confirm</a>.';
      }
      zoneMsg.classList.remove('hidden');
    });
  };

  // --- Analyze phase -------------------------------------------------------
  const startProgressCycle = () => {
    progressIndex = 0;
    const setStatus = (i) => {
      const msg = PROGRESS_MESSAGES[i] || PROGRESS_MESSAGES[0];
      if (statusText) statusText.textContent = msg;
      if (statusA11y) statusA11y.textContent = msg;
    };
    setStatus(0);
    if (progressEl) progressEl.classList.remove('hidden');
    progressTimer = setInterval(() => {
      progressIndex = (progressIndex + 1) % PROGRESS_MESSAGES.length;
      setStatus(progressIndex);
    }, 2000);
  };

  const stopProgressCycle = () => {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    if (progressEl) progressEl.classList.add('hidden');
    if (statusA11y) statusA11y.textContent = '';
  };

  const setAnalyzing = (busy) => {
    if (analyzeBtn) analyzeBtn.disabled = busy;
    if (busy) {
      if (analyzeLabel) analyzeLabel.textContent = 'Analyzing your photos…';
      if (analyzeIcon) analyzeIcon.innerHTML = '<span class="ai-spinner" aria-hidden="true"></span>';
      analyzeBtn.setAttribute('aria-busy', 'true');
      startProgressCycle();
    } else {
      if (analyzeLabel) analyzeLabel.textContent = 'Get My AI Estimate';
      if (analyzeIcon) analyzeIcon.innerHTML = '<i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>';
      analyzeBtn.removeAttribute('aria-busy');
      stopProgressCycle();
    }
  };

  const renderLoadingSkeleton = () => {
    outputEl.innerHTML =
      '<div class="estimate-loading-skeleton space-y-3">' +
      '<div class="skeleton-line h-5 w-2/3"></div>' +
      '<div class="skeleton-line h-4 w-1/2"></div>' +
      '<div class="skeleton-line h-4 w-full"></div>' +
      '<div class="skeleton-line h-4 w-5/6"></div>' +
      '<div class="skeleton-line h-4 w-3/4"></div>' +
      '<div class="skeleton-line h-5 w-1/3 mt-4"></div>' +
      '<div class="skeleton-line h-4 w-2/3"></div>' +
      '</div>';
  };

  const renderEstimate = (estimate) => {
    const lines = [];
    lines.push(
      '<p class="text-sm text-blue-300"><strong>Detected Issue:</strong> ' +
        escapeHtml(estimate.detectedIssue || 'Not clearly identifiable from the photo.') +
        '</p>',
    );
    lines.push(
      '<p class="text-sm text-blue-300 mt-2"><strong>Service Category:</strong> ' +
        escapeHtml(estimate.serviceCategory || 'General Handyman Repair') +
        '</p>',
    );

    lines.push('<p class="text-sm text-blue-300 mt-4"><strong>Estimated Materials Needed:</strong></p>');
    if (estimate.estimatedMaterials && estimate.estimatedMaterials.length) {
      lines.push('<ul class="mt-1 space-y-1">');
      for (const m of estimate.estimatedMaterials) {
        lines.push('<li class="text-sm text-blue-200 flex items-start gap-2"><span class="text-red-400 mt-0.5">•</span><span>' + escapeHtml(m) + '</span></li>');
      }
      lines.push('</ul>');
    } else {
      lines.push('<p class="text-sm text-blue-200 mt-1">To be confirmed after in-person inspection</p>');
    }

    lines.push(
      '<p class="text-sm text-blue-300 mt-4"><strong>Estimated Labor Duration:</strong> ' +
        escapeHtml(estimate.estimatedLaborDuration || 'To be determined on site') +
        '</p>',
    );

    const priceLine =
      estimate.priceLow != null && estimate.priceHigh != null
        ? '<span class="text-2xl font-black text-white">$' + estimate.priceLow + ' – $' + estimate.priceHigh + '</span>'
        : '<span class="text-base font-bold text-amber-300">Requires In-Person Inspection</span>';
    lines.push(
      '<p class="text-sm text-blue-300 mt-4"><strong>Preliminary Price Estimate:</strong> ' +
        priceLine +
        ' <span class="text-xs text-blue-400">*(Labor + Materials)*</span></p>',
    );

    lines.push('<p class="text-sm text-blue-300 mt-5"><strong>Technician Notes / Complications to Watch For:</strong></p>');
    if (estimate.technicianNotes && estimate.technicianNotes.length) {
      lines.push('<ul class="mt-1 space-y-1">');
      for (const n of estimate.technicianNotes) {
        lines.push('<li class="text-sm text-blue-200 flex items-start gap-2"><span class="text-red-400 mt-0.5">•</span><span>' + escapeHtml(n) + '</span></li>');
      }
      lines.push('</ul>');
    } else {
      lines.push('<p class="text-sm text-blue-200 mt-1">None noted from the photo; confirm scope on site.</p>');
    }

    lines.push(
      '<p class="text-sm text-blue-300 mt-5"><strong>Customer Next Step:</strong></p>',
    );
    lines.push(
      '<p class="text-sm text-blue-200 mt-1">' +
        escapeHtml(
          estimate.customerNextStep ||
            'Click "Submit Quote" below to send this AI assessment to our human dispatch team for final confirmation, or call us at (248) 385-3432.',
        ) +
        '</p>',
    );

    outputEl.innerHTML = lines.join('');
  };

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (analyzeBtn.disabled) return;

      if (!chosenFiles[0]) {
        showPhotoError('Please upload at least one close-up photo to analyze.');
        openPickerForSlot(0);
        return;
      }
      // Re-validate every chosen file in case the page state drifted.
      for (let i = 0; i < MAX_PHOTOS; i++) {
        const f = chosenFiles[i];
        if (!f) continue;
        const err = validateFile(f);
        if (err) {
          showPhotoError(err);
          return;
        }
      }
      showPhotoError('');

      setAnalyzing(true);
      resultEl.classList.remove('hidden');
      outOfScopeBanner.classList.add('hidden');
      renderLoadingSkeleton();
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

      try {
        const fd = new FormData();
        fd.append('photo', chosenFiles[0]);
        if (chosenFiles[1]) fd.append('photo2', chosenFiles[1]);
        if (chosenFiles[2]) fd.append('photo3', chosenFiles[2]);
        fd.append('mode', 'analyze');
        if (zipInput.value.trim()) fd.append('zip', zipInput.value.trim());
        if (cityInput.value.trim()) fd.append('city', cityInput.value.trim());

        const res = await fetch('/api/ai-estimate', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'We couldn’t generate an estimate just now.');
        }

        const estimate = data.estimate;
        resultHeadline.textContent = estimate.serviceCategory
          ? estimate.serviceCategory + ' — Preliminary Estimate'
          : 'Preliminary Estimate';
        renderEstimate(estimate);

        if (estimate.outOfScope) {
          outOfScopeReason.textContent = estimate.outOfScopeReason || '';
          outOfScopeBanner.classList.remove('hidden');
        }

        submitBlock.dataset.photoUrl = data.photoUrl || '';
        submitSuccess.classList.add('hidden');
        submitError.classList.add('hidden');
      } catch (err) {
        outputEl.innerHTML =
          '<div class="rounded-2xl border border-red-400 bg-red-950 px-5 py-4 text-sm text-red-100"><i class="fas fa-circle-exclamation mr-2 text-red-300" aria-hidden="true"></i>' +
          escapeHtml(err.message || 'Something went wrong.') +
          '<div class="mt-3"><a href="tel:+12483853432" class="inline-flex items-center gap-2 font-bold underline text-red-200 hover:text-white"><i class="fas fa-phone" aria-hidden="true"></i> Call (248) 385-3432</a></div></div>';
      } finally {
        setAnalyzing(false);
      }
    });
  }

  // --- Submit phase --------------------------------------------------------
  if (submitForm) {
    submitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitBtn.disabled) return;

      const name = document.getElementById('ai-submit-name').value.trim();
      const phone = document.getElementById('ai-submit-phone').value.trim();
      const email = document.getElementById('ai-submit-email').value.trim();
      const address = document.getElementById('ai-submit-address').value.trim();

      submitError.classList.add('hidden');
      submitSuccess.classList.add('hidden');

      if (!name) {
        showSubmitError('Please enter your name.');
        return;
      }
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 10) {
        showSubmitError('Please enter a 10-digit phone number.');
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        showSubmitError('Please enter a valid email address, or leave it blank.');
        return;
      }

      if (!chosenFiles[0]) {
        showSubmitError('Your primary photo is missing. Please upload one above and get a new estimate first.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');

      try {
        const fd = new FormData();
        fd.append('photo', chosenFiles[0]);
        if (chosenFiles[1]) fd.append('photo2', chosenFiles[1]);
        if (chosenFiles[2]) fd.append('photo3', chosenFiles[2]);
        fd.append('mode', 'submit');
        fd.append('customerName', name);
        fd.append('phone', phone);
        if (email) fd.append('email', email);
        if (address) fd.append('address', address);
        if (zipInput.value.trim()) fd.append('zip', zipInput.value.trim());
        if (cityInput.value.trim()) fd.append('city', cityInput.value.trim());

        const res = await fetch('/api/ai-estimate', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'We couldn’t send your quote.');

        submitSuccess.classList.remove('hidden');
        submitSuccess.innerHTML =
          '<i class="fas fa-circle-check mr-2" aria-hidden="true"></i> Your AI assessment is on its way to our dispatch team. We’ll call or text within one business day to lock in your arrival window. Want to talk now? Call <a href="tel:+12483853432" class="underline font-bold text-emerald-200 hover:text-white">(248) 385-3432</a>.';
        submitForm.reset();
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        submitSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err) {
        showSubmitError(err.message || 'Something went wrong sending your quote.');
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
      }
    });
  }

  const showSubmitError = (msg) => {
    submitError.textContent = msg;
    submitError.classList.remove('hidden');
    submitError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Initial paint of the (empty) slot grid so the three upload targets are
  // visible the moment the page loads.
  renderSlots();
  updatePreviewState();
})();
