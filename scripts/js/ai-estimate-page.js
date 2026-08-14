/*
 * Behaviour for /ai-estimate: drag-and-drop photo upload, client-side size/
 * type validation, ZIP→zone lookup, the analyze call to /api/ai-estimate, and
 * the second-pass submit that forwards contact details to dispatch.
 *
 * Two phases over the same endpoint:
 *   1. analyze  — photo + optional zip/city, returns the AI estimate.
 *   2. submit   — same photo re-uploaded alongside contact details, flagged
 *                 with mode=submit so the row is marked "submitted" for
 *                 dispatch and the contact fields are persisted.
 *
 * The photo is re-sent on submit because the estimate row and the dispatch
 * review both reference one blob, and the analyze call already proved the
 * upload is valid. Keeping a handle to the chosen File makes that free.
 */
(function () {
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const OAKLAND_ZIP = /^48[0-4]\d{2}$/;

  const dropzone = document.getElementById('ai-dropzone');
  const fileInput = document.getElementById('ai-photo-input');
  const idleEl = document.getElementById('ai-dropzone-idle');
  const previewEl = document.getElementById('ai-dropzone-preview');
  const previewImg = document.getElementById('ai-photo-preview');
  const filenameEl = document.getElementById('ai-photo-filename');
  const removeBtn = document.getElementById('ai-photo-remove');
  const photoError = document.getElementById('ai-photo-error');

  const zipInput = document.getElementById('ai-zip');
  const cityInput = document.getElementById('ai-city');
  const zoneMsg = document.getElementById('ai-zone-msg');

  const form = document.getElementById('ai-estimate-form');
  const analyzeBtn = document.getElementById('ai-analyze-btn');
  const analyzeLabel = document.getElementById('ai-analyze-btn-label');

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

  let chosenFile = null;
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
    if (file.size > MAX_IMAGE_SIZE) return 'The photo must be 5 MB or smaller.';
    if (!IMAGE_TYPES.has(file.type)) return 'Upload a JPG, PNG, or WebP photo.';
    return '';
  };

  const renderPreview = (file) => {
    chosenFile = file;
    previewImg.src = URL.createObjectURL(file);
    previewImg.onload = () => URL.revokeObjectURL(previewImg.src);
    filenameEl.textContent = file.name;
    idleEl.classList.add('hidden');
    previewEl.classList.remove('hidden');
    showPhotoError('');
  };

  const resetPreview = () => {
    chosenFile = null;
    fileInput.value = '';
    previewImg.removeAttribute('src');
    idleEl.classList.remove('hidden');
    previewEl.classList.add('hidden');
  };

  const handleFileChosen = (file) => {
    const err = validateFile(file);
    if (err) {
      showPhotoError(err);
      return;
    }
    renderPreview(file);
  };

  if (dropzone) {
    dropzone.addEventListener('click', (e) => {
      // Don't re-trigger the picker when the "remove" button is clicked.
      if (e.target.closest('#ai-photo-remove')) return;
      fileInput.click();
    });
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
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
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFileChosen(file);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) handleFileChosen(file);
    });
  }
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetPreview();
    });
  }

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

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );

  // --- Analyze phase -------------------------------------------------------
  const setAnalyzing = (busy) => {
    if (analyzeBtn) analyzeBtn.disabled = busy;
    if (busy) {
      analyzeLabel.textContent = 'Analyzing your photo…';
      analyzeBtn.setAttribute('aria-busy', 'true');
    } else {
      analyzeLabel.textContent = 'Get My AI Estimate';
      analyzeBtn.removeAttribute('aria-busy');
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

      const fileErr = validateFile(chosenFile);
      if (fileErr) {
        showPhotoError(fileErr);
        if (!chosenFile) fileInput.click();
        return;
      }
      showPhotoError('');

      setAnalyzing(true);
      resultEl.classList.remove('hidden');
      outOfScopeBanner.classList.add('hidden');
      renderLoadingSkeleton();
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

      try {
        const fd = new FormData();
        fd.append('photo', chosenFile);
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

      if (!chosenFile) {
        showSubmitError('Your photo is missing. Please upload one above and get a new estimate first.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');

      try {
        const fd = new FormData();
        fd.append('photo', chosenFile);
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
})();
