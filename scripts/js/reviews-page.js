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
              adminAccessLabel.textContent = 'Admin Mode (Active)';
              adminAccessBtn.className = 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 px-4 py-3 rounded-2xl font-semibold transition inline-flex items-center gap-2 text-sm shadow-md';
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
                  ? 'That access key was not recognized.'
                  : 'Admin access could not be verified right now.');
              showReviewsMessage(message, true);
              return false;
          }
          localStorage.setItem('aaaAdminToken', key);
          updateAdminUI();
          loadReviews();
          showReviewsMessage('Admin mode unlocked.', false);
          return true;
      } catch {
          showReviewsMessage('Admin access could not be verified. Please check your connection and try again.', true);
          return false;
      }
  };

  try {
      const urlParams = new URLSearchParams(window.location.search);
      const adminKeyFromUrl = urlParams.get('admin') || urlParams.get('adminKey') || urlParams.get('token');
      if (adminKeyFromUrl && adminKeyFromUrl !== 'false' && adminKeyFromUrl !== '0') {
          if (adminKeyFromUrl === 'true' || adminKeyFromUrl === '1') {
              const key = prompt('Enter Owner / Admin Access Key:');
              if (key) verifyAdminKey(key);
          } else {
              verifyAdminKey(adminKeyFromUrl);
          }
      }
  } catch {}

  if (adminAccessBtn) {
      adminAccessBtn.addEventListener('click', () => {
          const currentToken = localStorage.getItem('aaaAdminToken');
          if (currentToken) {
              if (confirm('You are currently in Admin Mode. Log out of Admin Mode?')) {
                  localStorage.removeItem('aaaAdminToken');
                  updateAdminUI();
                  loadReviews();
              }
          } else {
              const key = prompt('Enter Owner / Admin Access Key:');
              if (key) verifyAdminKey(key);
          }
      });
  }
  const reviewsPhoto = document.getElementById('reviews-photo');
  const reviewsDropzone = document.getElementById('reviews-dropzone');
  const reviewsFileName = document.getElementById('reviews-file-name');
  const reviewsEditing = document.getElementById('reviews-editing');
  const reviewsCancelEdit = document.getElementById('reviews-cancel-edit');
  const reviewsRatingInput = document.getElementById('reviews-rating');
  const ratingText = document.getElementById('rating-text');
  const starRatingBtns = document.querySelectorAll('.star-rating-btn');
  const reviewsPreview = document.getElementById('reviews-preview');
  const reviewsPreviewWrap = document.getElementById('reviews-preview-wrap');
  const attrChips = document.querySelectorAll('.attr-chip');
  const attributesInput = document.getElementById('reviews-attributes-input');
  const ownerResponseInput = document.getElementById('reviews-owner-response');
  const filterButtons = document.querySelectorAll('.filter-tab');
  const reviewsFilterEmpty = document.getElementById('reviews-filter-empty');
  const lightbox = document.getElementById('reviews-lightbox');
  const lightboxImg = document.getElementById('reviews-lightbox-img');
  const lightboxCaption = document.getElementById('reviews-lightbox-caption');
  const lightboxClose = document.getElementById('reviews-lightbox-close');
  let reviewsEditId = null;
  let allReviews = [];
  let activeFilter = 'all';
  let lastFocusedBeforeLightbox = null;
  const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
  // A buffered Netlify function request is capped at 6 MB, so the bytes we
  // actually put on the wire have to stay well under that once multipart
  // overhead and the text fields are added.
  const UPLOAD_SAFE_BYTES = 4 * 1024 * 1024;
  const MAX_IMAGE_DIMENSION = 2000;
  const PHOTO_TOO_BIG_MESSAGE = 'That photo is too large to upload. Please choose a smaller one, or save it as a JPG first.';

  const loadImageFile = (file) => new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
      };
      img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('That image could not be processed. Please try a different photo.'));
      };
      img.src = url;
  });

  const canvasToJpeg = (canvas, quality) =>
      new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

  // Photos straight off a phone routinely outweigh what a single function
  // request can carry, so anything over the safe size is downscaled and
  // re-encoded until it fits. Animated GIFs can't survive a canvas
  // round-trip, so they are only ever passed through as-is.
  const preparePhotoForUpload = async (file) => {
      if (!(file instanceof File) || file.size === 0) return file;
      if (file.size <= UPLOAD_SAFE_BYTES) return file;
      if (file.type === 'image/gif') throw new Error(PHOTO_TOO_BIG_MESSAGE);

      const img = await loadImageFile(file);
      let dimension = MAX_IMAGE_DIMENSION;
      let quality = 0.85;

      // Each pass shrinks harder. A few rounds is plenty to bring any
      // camera photo under the limit without softening a normal one.
      for (let attempt = 0; attempt < 5; attempt += 1) {
          const scale = Math.min(1, dimension / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error(PHOTO_TOO_BIG_MESSAGE);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const blob = await canvasToJpeg(canvas, quality);
          if (!blob) throw new Error(PHOTO_TOO_BIG_MESSAGE);
          if (blob.size <= UPLOAD_SAFE_BYTES) {
              const name = `${(file.name || 'photo').replace(/\.[^.]+$/, '')}.jpg`;
              return new File([blob], name, { type: 'image/jpeg' });
          }

          dimension = Math.round(dimension * 0.75);
          quality = Math.max(0.5, quality - 0.1);
      }

      throw new Error(PHOTO_TOO_BIG_MESSAGE);
  };
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
                  btn.className = 'star-rating-btn text-2xl text-amber-400 focus:outline-none';
              } else {
                  icon.className = 'far fa-star';
                  btn.className = 'star-rating-btn text-2xl text-gray-300 hover:text-amber-300 focus:outline-none';
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

  const clearPhotoPreview = () => {
      if (reviewsPreview) reviewsPreview.src = '';
      if (reviewsPreviewWrap) reviewsPreviewWrap.classList.add('hidden');
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
      if (reviewsPhoto) reviewsPhoto.required = true;
      if (reviewsFileName) reviewsFileName.textContent = 'Choose a photo or drag it here';
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
      if (reviewsFileName) reviewsFileName.textContent = 'Keep current photo or choose a replacement';
      if (reviewsEditing) reviewsEditing.classList.remove('hidden');
      if (reviewsSubmit) reviewsSubmit.innerHTML = 'Save Changes <i class="fas fa-floppy-disk" aria-hidden="true"></i>';
      showReviewsMessage('Update the fields below, then save your changes.', false);
      reviewsForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const deleteReviewsItem = (id) => {
      const adminToken = localStorage.getItem('aaaAdminToken') || '';
      if (!adminToken) {
          showReviewsMessage('Administrator access is required to delete reviews.', true);
          return;
      }
      if (!confirm("Delete this review permanently? This can't be undone.")) return;
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

  const badgeColors = {
      'Carpentry & Trim': 'bg-amber-100 text-amber-800 border-amber-200',
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

  const matchesFilter = (item, filter) =>
      filter === 'all' || String(item.projectType || '').toLowerCase().includes(filter.toLowerCase());

  const attributesHtml = (attributes) => {
      if (!Array.isArray(attributes) || attributes.length === 0) return '';
      const chips = attributes.map((tag) =>
          `<span class="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-100 rounded-full px-2.5 py-1 text-xs font-semibold"><i class="fas fa-check text-[10px]" aria-hidden="true"></i>${escapeHTML(tag)}</span>`
      ).join('');
      return `<div class="mt-4 flex flex-wrap gap-1.5">${chips}</div>`;
  };

  const ownerResponseHtml = (item) => {
      if (!item.ownerResponse) return '';
      return `
          <div class="mt-4 bg-blue-950/95 text-slate-100 rounded-2xl p-4 border-l-4 border-red-600">
              <div class="flex items-center gap-2 mb-1.5">
                  <i class="fas fa-reply text-red-400 text-xs" aria-hidden="true"></i>
                  <span class="text-xs font-bold uppercase tracking-wider text-red-300">AAA Handyman Response</span>
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
      card.style.animationDelay = `${Math.min(index, 8) * 60}ms`;
      const badgeStyle = badgeColors[item.projectType] || 'bg-gray-100 text-gray-800 border-gray-200';
      const canManage = Boolean(localStorage.getItem('aaaAdminToken'));
      const photoPath = photoPathOf(item);
      const thumbUrl = photoPath ? transformedPhoto(photoPath, 800, 80) : '';
      const fullUrl = photoPath ? transformedPhoto(photoPath, 1600, 82) : '';

      const previewHtml = photoPath ? `
              <button type="button" class="review-zoom block w-full h-full focus:outline-none focus-visible:ring-4 focus-visible:ring-red-500/50" data-full="${escapeHTML(fullUrl)}" data-original="${escapeHTML(photoPath)}" data-caption="${escapeHTML(item.projectType)} · ${escapeHTML(item.location)}" data-alt="${escapeHTML(item.imageAlt)}" aria-label="Zoom photo: ${escapeHTML(item.projectType)} in ${escapeHTML(item.location)}">
                  <img class="review-photo w-full h-full object-cover" src="${escapeHTML(thumbUrl)}" data-original="${escapeHTML(photoPath)}" alt="${escapeHTML(item.imageAlt)}" width="800" height="600" loading="lazy" decoding="async">
                  <span class="pointer-events-none absolute bottom-3 right-3 h-9 w-9 rounded-full bg-black/55 text-white flex items-center justify-center text-sm"><i class="fas fa-magnifying-glass-plus" aria-hidden="true"></i></span>
              </button>` : photoPlaceholderHtml();

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
                  <span class="bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full shadow-md flex items-center gap-1 whitespace-nowrap">
                      <i class="fas fa-circle-check" aria-hidden="true"></i> Verified Local Project
                  </span>
              </div>
          </div>
          <div class="p-6 flex flex-col flex-1">
              <div class="flex items-center justify-between gap-3 mb-3">
                  <div class="text-amber-500 text-lg flex gap-1" role="img" aria-label="${escapeHTML(item.rating)} out of 5 stars">
                      ${stars(Number(item.rating) || 0)}
                  </div>
                  <span class="inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
                      <i class="fas fa-location-dot text-red-500" aria-hidden="true"></i> ${escapeHTML(item.location)}
                  </span>
              </div>
              <p class="text-gray-700 leading-relaxed italic text-base">"${escapeHTML(item.review)}"</p>
              ${attributesHtml(item.attributes)}
              ${ownerResponseHtml(item)}
              <div class="mt-5 pt-4 border-t border-gray-100 flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm uppercase">
                      ${escapeHTML(item.customerName.charAt(0))}
                  </div>
                  <div>
                      <strong class="text-gray-900 block text-sm">${escapeHTML(item.customerName)}</strong>
                      <span class="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                          <i class="fas fa-shield-halved" aria-hidden="true"></i> Verified customer
                      </span>
                  </div>
              </div>
              ${actionsHtml}
          </div>
      `;

      attachPhotoFallback(card.querySelector('.review-photo'));

      card.querySelector('.review-zoom')?.addEventListener('click', (event) => {
          const trigger = event.currentTarget;
          openLightbox(trigger.dataset.full, trigger.dataset.alt, trigger.dataset.caption, trigger.dataset.original);
      });

      if (canManage) {
          card.querySelector('.review-edit-btn')?.addEventListener('click', () => startReviewsEdit(item));
          card.querySelector('.review-delete-btn')?.addEventListener('click', () => deleteReviewsItem(item.id));
      }
      return card;
  };

  const renderReviews = () => {
      if (!reviewsList || !reviewsEmpty || !reviewsLoading) return;
      reviewsLoading.classList.add('hidden');
      reviewsList.innerHTML = '';

      const hasAny = allReviews.length > 0;
      reviewsEmpty.classList.toggle('hidden', hasAny);

      const filtered = allReviews.filter((item) => matchesFilter(item, activeFilter));
      if (reviewsFilterEmpty) {
          reviewsFilterEmpty.classList.toggle('hidden', !hasAny || filtered.length > 0);
      }

      filtered.forEach((item, index) => {
          reviewsList.appendChild(buildCard(item, index));
      });
  };

  // --- Filter tabs ---
  filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
          activeFilter = btn.dataset.filter || 'all';
          filterButtons.forEach((other) => {
              other.setAttribute('aria-pressed', other === btn ? 'true' : 'false');
          });
          renderReviews();
      });
  });

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
              renderReviews();
          })
          .catch(() => {
              allReviews = [];
              reviewsLoading.classList.add('hidden');
              reviewsEmpty.classList.remove('hidden');
              const emptyText = reviewsEmpty.querySelector('p');
              if (emptyText) emptyText.textContent = "We couldn't load the reviews just now. Please refresh the page to try again.";
          });
  };

  if (reviewsPhoto && reviewsFileName) {
      reviewsPhoto.addEventListener('change', () => {
          const file = reviewsPhoto.files?.[0];
          reviewsFileName.textContent = file?.name || 'Choose a photo or drag it here';
          if (file && file.type.startsWith('image/') && reviewsPreview && reviewsPreviewWrap) {
              const reader = new FileReader();
              reader.onload = (event) => {
                  reviewsPreview.src = String(event.target?.result || '');
                  reviewsPreviewWrap.classList.remove('hidden');
              };
              reader.readAsDataURL(file);
          } else {
              clearPhotoPreview();
          }
      });
  }

  if (reviewsDropzone && reviewsPhoto) {
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
          const file = event.dataTransfer?.files?.[0];
          if (!file) return;
          const transfer = new DataTransfer();
          transfer.items.add(file);
          reviewsPhoto.files = transfer.files;
          reviewsPhoto.dispatchEvent(new Event('change'));
      });
  }

  if (reviewsForm) {
      reviewsForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const isEditing = Boolean(reviewsEditId);
          const sourceFile = reviewsPhoto?.files?.[0] || null;

          if (sourceFile && sourceFile.size > MAX_SOURCE_BYTES) {
              showReviewsMessage('Photos must be 10 MB or smaller.', true);
              return;
          }

          setReviewsSubmitting(true);
          showReviewsMessage(isEditing ? 'Saving your changes...' : 'Uploading your review...', false);

          let uploadFile = sourceFile;
          try {
              if (sourceFile) uploadFile = await preparePhotoForUpload(sourceFile);
          } catch (error) {
              showReviewsMessage(error instanceof Error ? error.message : "We couldn't read that photo. Please try a different JPEG, PNG, WEBP, or GIF image.", true);
              setReviewsSubmitting(false);
              return;
          }

          const formData = new FormData(reviewsForm);
          if (uploadFile) formData.set('photo', uploadFile, uploadFile.name);

          const adminToken = localStorage.getItem('aaaAdminToken') || '';
          if (isEditing && !adminToken) {
              showReviewsMessage('Administrator access is required to edit reviews.', true);
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
              if (response.status === 413) throw new Error(PHOTO_TOO_BIG_MESSAGE);
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
