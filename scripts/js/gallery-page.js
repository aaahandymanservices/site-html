/*
 * The customer photo gallery on /gallery: a responsive grid of reviewed
 * projects served through the Netlify Image CDN, with a full-screen lightbox.
 *
 * The page's images live in the GALLERY_ITEMS array at the top of
 * public/gallery.html. Swapping the placeholders for real reviewed projects
 * is an edit to that array only -- this script renders whatever it finds.
 *
 * The reviews page deep-links here (/gallery?photo=<reviewId>&index=<n>) so
 * its photo tiles open in this lightbox; see openFromDeepLink below.
 *
 * Source-of-truth file: scripts/js/gallery-page.js. The build (see
 * scripts/build-js.mjs) minifies this into public/js/gallery-page.js, which
 * is what the page actually loads.
 */

(function () {
  'use strict';

  var GALLERY_ITEMS = [
    {
      src: 'https://picsum.photos/id/1084/1600/1200',
      alt: 'Reviewed carpentry project: custom wall shelving installed in a Michigan home',
      caption: 'Custom shelving install — “Wouldn’t hesitate to hire them again.” — Waterford'
    },
    {
      src: 'https://picsum.photos/id/292/1600/1200',
      alt: 'Reviewed exterior project: freshly stained cedar deck at a Michigan home',
      caption: 'Deck staining refresh — “Looks brand new, great communication.” — Troy'
    },
    {
      src: 'https://picsum.photos/id/1043/1600/1200',
      alt: 'Reviewed interior project: bright repainted family room after a handyman visit',
      caption: 'Interior repaint — “Fast, tidy, and done right the first time.” — Rochester Hills'
    }
  ];

  /*
   * The grid's responsive column stops, mirroring the Tailwind classes on
   * #gallery-grid: 1 column below 480px, 2 from 480px, 3 from lg (1024px),
   * and 4 from 2xl (1536px). The first visible image in the current first
   * row keeps fetchpriority=high; every other image loads lazily.
   */
  var GRID_COLUMNS = [
    { minWidth: 1536, count: 4 },
    { minWidth: 1024, count: 3 },
    { minWidth: 480, count: 2 },
    { minWidth: 0, count: 1 }
  ];

  var THUMBNAIL_WIDTHS = [400, 800, 1200];
  var LIGHTBOX_WIDTHS = [800, 1200, 1600];
  var IMG_PARAMS = 'fit=cover&fm=avif&q=80';
  var LARGE_IMG_PARAMS = 'fit=cover&fm=avif&q=82';

  var grid = document.getElementById('gallery-grid');
  if (!grid || GALLERY_ITEMS.length === 0) {
    if (grid) {
      var empty = document.getElementById('gallery-empty');
      if (empty) empty.classList.remove('hidden');
      var count = document.getElementById('gallery-count');
      if (count) count.textContent = 'No photos yet';
    }
    return;
  }

  var esc = function (value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  var imageCDN = function (url, params) {
    return '/.netlify/images?url=' + encodeURIComponent(url) + '&' + params;
  };

  var thumbTransform = function (width) {
    return 'w=' + width + '&h=' + Math.round((width * 3) / 4) + '&' + IMG_PARAMS;
  };

  var firstOfRow = function (index, itemsPerRow) {
    if (itemsPerRow <= 1) return true;
    return index % itemsPerRow === 0;
  };

  var currentColumnCount = function () {
    var width = window.innerWidth || document.documentElement.clientWidth;
    for (var i = 0; i < GRID_COLUMNS.length; i += 1) {
      if (width >= GRID_COLUMNS[i].minWidth) return GRID_COLUMNS[i].count;
    }
    return GRID_COLUMNS[GRID_COLUMNS.length - 1].count;
  };

  /*
   * The one and only eager, high-priority image: the first visible tile in
   * the current first row. It has no loading attribute (defaults to eager).
   * Everything else is loading="lazy". On resize the flags are recomputed so
   * the promise "all images except the first row are lazy" holds at any
   * breakpoint.
   */
  var applyRowPolicy = function (img, index, itemsPerRow) {
    var isFirstRow = firstOfRow(index, itemsPerRow);
    if (isFirstRow) {
      img.removeAttribute('loading');
      if (index === 0) img.setAttribute('fetchpriority', 'high');
      else img.removeAttribute('fetchpriority');
    } else {
      img.setAttribute('loading', 'lazy');
      img.removeAttribute('fetchpriority');
    }
  };

  var buildGallery = function () {
    var fragment = document.createDocumentFragment();
    var itemsPerRow = currentColumnCount();
    GALLERY_ITEMS.forEach(function (item, index) {
      var li = document.createElement('li');
      li.className = 'gallery-card';

      var srcset = THUMBNAIL_WIDTHS.map(function (w) {
        return imageCDN(item.src, thumbTransform(w)) + ' ' + w + 'w';
      }).join(', ');

      li.innerHTML =
        '<button type="button" class="gallery-open block w-full text-left rounded-3xl overflow-hidden border-2 border-white/15 bg-white/5 shadow-lg transition hover:border-red-500/60 focus:outline-none focus:ring-4 focus:ring-red-500/40" ' +
        'data-index="' + index + '" ' +
        'aria-label="Open photo ' + (index + 1) + ' of ' + GALLERY_ITEMS.length + ': ' + esc(item.alt) + '">' +
        '<span class="block relative w-full" style="aspect-ratio:4/3">' +
        '<img ' +
        'src="' + esc(imageCDN(item.src, thumbTransform(800))) + '" ' +
        'srcset="' + esc(srcset) + '" ' +
        'sizes="(min-width: 1536px) 21rem, (min-width: 1024px) 28rem, (min-width: 480px) 46vw, 100vw" ' +
        'alt="' + esc(item.alt) + '" ' +
        'width="800" height="600" ' +
        'decoding="async" ' +
        'style="width:100%;height:100%;object-fit:cover;display:block">' +
        '</span>' +
        '<span class="block px-4 py-3 text-xs font-semibold text-slate-200 bg-white/5 border-t border-white/10">' + esc(item.caption) + '</span>' +
        '</button>';

      var img = li.querySelector('img');
      applyRowPolicy(img, index, itemsPerRow);
      fragment.appendChild(li);
    });
    grid.appendChild(fragment);
  };

  buildGallery();

  var countBadge = document.getElementById('gallery-count');
  if (countBadge) countBadge.textContent = 'Showing all ' + GALLERY_ITEMS.length + ' photos';

  // --- Lightbox ---
  var lastFocusedBeforeLightbox = null;
  var lightbox = document.getElementById('gallery-lightbox');
  var lightboxImg = document.getElementById('gallery-lightbox-img');
  var lightboxCaption = document.getElementById('gallery-lightbox-caption');
  var lightboxClose = document.getElementById('gallery-lightbox-close');
  var lightboxPrev = document.getElementById('gallery-lightbox-prev');
  var lightboxNext = document.getElementById('gallery-lightbox-next');
  var lightboxOpen = false;
  var currentIndex = 0;
  var lastColumnCount = currentColumnCount();

  /*
   * The lightbox renders whichever item set is active. By default that is the
   * page's own GALLERY_ITEMS; a deep link from /reviews replaces it with the
   * linked review's photos (see openFromDeepLink below) so the arrows walk
   * that review's photos, and it is restored when the lightbox closes.
   */
  var lightboxItems = GALLERY_ITEMS;

  var show = function (i) {
    if (!lightbox || !lightboxImg) return;
    var item = lightboxItems[i];
    if (!item) return;
    currentIndex = i;
    var srcset = LIGHTBOX_WIDTHS.map(function (w) {
      return imageCDN(item.src, 'w=' + w + '&h=' + Math.round((w * 3) / 4) + '&' + LARGE_IMG_PARAMS) + ' ' + w + 'w';
    }).join(', ');
    lightboxImg.srcset = srcset;
    lightboxImg.sizes = '(max-width: 1023px) 100vw, 1200px';
    lightboxImg.src = imageCDN(item.src, 'w=1600&h=1200&' + LARGE_IMG_PARAMS);
    lightboxImg.alt = item.alt || 'Gallery photo preview';
    if (lightboxCaption) {
      lightboxCaption.textContent = item.caption || '';
      lightboxCaption.hidden = !item.caption;
    }
  };

  var openLightbox = function (i) {
    if (!lightbox) return;
    lastFocusedBeforeLightbox = document.activeElement;
    show(i);
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    lightboxOpen = true;
    if (lightboxClose) lightboxClose.focus();
  };

  var closeLightbox = function () {
    if (!lightbox) return;
    lightbox.classList.add('hidden');
    if (lightboxImg) {
      lightboxImg.src = '';
      lightboxImg.srcset = '';
    }
    document.body.style.overflow = '';
    lightboxOpen = false;
    lightboxItems = GALLERY_ITEMS;
    if (lastFocusedBeforeLightbox && typeof lastFocusedBeforeLightbox.focus === 'function') {
      lastFocusedBeforeLightbox.focus();
    }
  };

  var step = function (delta) {
    var total = lightboxItems.length;
    show((currentIndex + delta + total) % total);
  };

  grid.addEventListener('click', function (event) {
    var btn = event.target.closest('.gallery-open');
    if (!btn) return;
    openLightbox(Number(btn.dataset.index));
  });

  if (lightbox) {
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxPrev) lightboxPrev.addEventListener('click', function () { step(-1); });
    if (lightboxNext) lightboxNext.addEventListener('click', function () { step(1); });

    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', function (event) {
      if (!lightboxOpen) return;
      if (event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'ArrowRight') step(1);
      else if (event.key === 'Escape') closeLightbox();
    });

    // The overlay claims the whole viewport, so keyboard focus must stay
    // inside it -- otherwise Tab walks invisibly through the page behind.
    lightbox.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab' || lightbox.classList.contains('hidden')) return;
      var focusables = Array.from(
        lightbox.querySelectorAll('a[href], button:not([disabled])')
      ).filter(function (el) { return el.offsetParent !== null; });
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  window.addEventListener('resize', function () {
    var itemsPerRow = currentColumnCount();
    if (itemsPerRow === lastColumnCount) return;
    lastColumnCount = itemsPerRow;
    grid.querySelectorAll('img').forEach(function (img, i) {
      applyRowPolicy(img, i, itemsPerRow);
    });
  });

  /*
   * Deep link from the reviews page: /gallery?photo=<reviewId>&index=<n>.
   *
   * The reviews page's photo tiles point here so a photo always opens in the
   * gallery's lightbox, next to the rest of the showcase. The id is confirmed
   * against a real review record before anything opens -- a deleted review,
   * a stale share link, or a hand-typed URL simply lands on the grid -- so
   * the link can never dead-end or open an unvetted image.
   */
  var openFromDeepLink = function () {
    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (error) {
      return;
    }
    var id = Number.parseInt(params.get('photo') || '', 10);
    if (!Number.isInteger(id) || id <= 0) return;

    fetch('/api/reviews')
      .then(function (response) { return response.ok ? response.json() : Promise.reject(); })
      .then(function (items) {
        var review = Array.isArray(items)
          ? items.find(function (item) { return Number(item && item.id) === id; })
          : null;
        if (!review || !Array.isArray(review.imageUrls) || review.imageUrls.length === 0) return;

        // The reviews page links a specific photo (its strip tiles carry
        // index=1..3), so honour the requested slot and let the lightbox's
        // arrow keys walk the review's remaining photos.
        var requested = Number.parseInt(params.get('index') || '', 10);
        var start = Number.isInteger(requested) && requested >= 0 && requested < review.imageUrls.length
          ? requested
          : 0;

        lightboxItems = review.imageUrls.map(function (url, i) {
          return {
            src: url,
            alt: review.imageAlt || review.projectType + ' project photo from ' + review.customerName,
            caption: (review.projectType || 'Reviewed project') + ' in ' + (review.location || 'Oakland County')
              + ' — reviewed by ' + (review.customerName || 'a verified customer')
              + (review.imageUrls.length > 1 ? ' (photo ' + (i + 1) + ' of ' + review.imageUrls.length + ')' : '')
          };
        });

        if (!lightboxOpen) openLightbox(start);
      })
      .catch(function () { /* no record, no lightbox: the grid stays up */ });
  };

  if (typeof URLSearchParams === 'function' && window.fetch) {
    openFromDeepLink();
  }
})();
