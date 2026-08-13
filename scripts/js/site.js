(function () {
  // --- Back to Top ---
  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    const updateBackToTop = () => {
      const visible = window.scrollY > 400;
      backToTop.classList.toggle('hidden', !visible);
      backToTop.classList.toggle('flex', visible);
    };

    window.addEventListener('scroll', updateBackToTop, { passive: true });
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    updateBackToTop();
  }

  // --- Mobile Navigation Menu ---
  const menuButton = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIcon = document.getElementById('menu-icon');
  if (menuButton && mobileMenu) {
    if (mobileMenu.id) menuButton.setAttribute('aria-controls', mobileMenu.id);
    const initiallyOpen = !mobileMenu.classList.contains('hidden') && !mobileMenu.hidden;
    mobileMenu.hidden = !initiallyOpen;
    mobileMenu.setAttribute('aria-hidden', String(!initiallyOpen));
    menuButton.setAttribute('aria-expanded', String(initiallyOpen));

    const isOpen = () => !mobileMenu.hidden;

    const setMenuOpen = (open, { restoreFocus = false } = {}) => {
      mobileMenu.hidden = !open;
      mobileMenu.classList.toggle('hidden', !open);
      mobileMenu.setAttribute('aria-hidden', String(!open));
      menuButton.setAttribute('aria-expanded', String(open));
      if (menuIcon) {
        menuIcon.classList.toggle('fa-bars', !open);
        menuIcon.classList.toggle('fa-times', open);
      }
      // Send keyboard users somewhere sensible: into the drawer on open, and
      // back to the button they came from on close, so focus never lands on a
      // hidden element or resets to the top of the document.
      if (open) {
        const first = mobileMenu.querySelector('a, button');
        if (first) first.focus();
      } else if (restoreFocus) {
        menuButton.focus();
      }
      window.dispatchEvent(new Event('resize'));
    };

    menuButton.addEventListener('click', () => setMenuOpen(!isOpen()));
    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMenuOpen(false));
    });

    // The drawer covers the page while open, so Tab must cycle within it
    // instead of walking through the content hidden behind it.
    mobileMenu.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !isOpen()) return;

      const focusables = Array.from(
        mobileMenu.querySelectorAll('a[href], button:not([disabled])')
      ).filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;

      // The toggle button sits outside the drawer but belongs to it, so it
      // bookends the cycle rather than being skipped.
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        menuButton.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        menuButton.focus();
      }
    });

    menuButton.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !isOpen() || !e.shiftKey) return;
      const focusables = Array.from(
        mobileMenu.querySelectorAll('a[href], button:not([disabled])')
      ).filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      e.preventDefault();
      focusables[focusables.length - 1].focus();
    });

    // --- Keyboard & Focus Accessibility ---
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) setMenuOpen(false, { restoreFocus: true });
    });

    // Crossing into the desktop layout hides the drawer through CSS alone, which
    // would leave the toggle reporting aria-expanded="true" behind a close icon,
    // and the drawer already open the next time the window narrows. Keep the
    // two in step. 1024px matches the header media query breakpoint.
    const desktopLayout = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = (event) => {
      if (event.matches && isOpen()) setMenuOpen(false);
    };
    if (desktopLayout.addEventListener) {
      desktopLayout.addEventListener('change', closeOnDesktop);
    } else if (desktopLayout.addListener) {
      desktopLayout.addListener(closeOnDesktop);
    }
  }

  // --- Scroll-reveal: cinematic entrances as content scrolls into view ---
  // The initial hidden state lives behind the `.js-reveal` class, which is only
  // added here — so if this never runs (no JS, reduced motion, older browser)
  // every section stays fully visible.
  function initScrollReveal() {
    const root = document.documentElement;
    const prefersReduced = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !('IntersectionObserver' in window)) return;

    try {
      root.classList.add('js-reveal');

      const units = [];

      document.querySelectorAll('section').forEach((section) => {
        // Skip content that isn't laid out yet (modals, JS-populated blocks);
        // hiding it here could strand it invisible if it never intersects.
        if (section.closest('dialog, [role="dialog"]')) return;
        if (section.classList.contains('hidden') || section.hasAttribute('hidden')) return;

        section.classList.add('reveal-block');

        // Cascade the children of the section's primary grid, ignoring any
        // nested grids so a card's own internal grid doesn't double-animate.
        const grid = Array.from(section.querySelectorAll('.grid')).find(
          (g) => g.children.length >= 2 && !g.parentElement.closest('.grid')
        );
        let children = [];
        if (grid) {
          children = Array.from(grid.children);
          children.forEach((child, i) => {
            child.classList.add('reveal-child');
            child.style.setProperty('--i', String(i % 8));
          });
        }

        units.push({ el: section, children });
      });

      if (!units.length) return;

      const reveal = (unit) => {
        unit.el.classList.add('reveal-shown');
        unit.children.forEach((child) => child.classList.add('reveal-shown'));
      };

      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const unit = units.find((u) => u.el === entry.target);
          if (unit) reveal(unit);
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

      units.forEach((unit) => observer.observe(unit.el));

      // Observe explicit .reveal-on-scroll elements
      const explicitReveals = document.querySelectorAll('.reveal-on-scroll');
      if (explicitReveals.length) {
        const revealObs = new IntersectionObserver((entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              obs.unobserve(entry.target);
            }
          });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
        explicitReveals.forEach((el) => revealObs.observe(el));
      }

      // Safety net: never leave content hidden, even if the observer misbehaves
      // or the page is restored from the back/forward cache.
      const revealEverything = () => {
        units.forEach(reveal);
        explicitReveals.forEach((el) => el.classList.add('is-visible'));
      };
      window.setTimeout(revealEverything, 4500);
      window.addEventListener('pageshow', revealEverything);
    } catch (err) {
      root.classList.remove('js-reveal');
    }
  }

  // --- Interactive Service Category Filter Chips ---
  function initInteractiveServiceChips() {
    const chipButtons = document.querySelectorAll('[data-filter-category], .svc-filter-chip');
    if (!chipButtons.length) return;

    chipButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const category = btn.getAttribute('data-filter-category') || btn.getAttribute('data-category') || 'all';

        // Update active chip states
        chipButtons.forEach((other) => {
          const isTarget = (other.getAttribute('data-filter-category') || other.getAttribute('data-category') || 'all') === category;
          other.setAttribute('aria-pressed', String(isTarget));
          other.classList.toggle('active', isTarget);
        });

        // Target service cards across services page, homepage, or catalog
        const serviceCards = document.querySelectorAll('.service-card, [data-service-category], .generated-service-card');
        const serviceGroups = document.querySelectorAll('.svc-group, [data-svc-group]');

        if (!serviceCards.length && !serviceGroups.length) return;

        // Smoothly filter cards without jumpy layout shifts
        serviceCards.forEach((card) => {
          const cardCat = (card.getAttribute('data-service-category') || card.getAttribute('data-category') || card.innerText || '').toLowerCase();
          const matches = category === 'all' || cardCat.includes(category.toLowerCase());

          if (matches) {
            card.classList.remove('is-filtered-out');
            card.style.display = '';
            requestAnimationFrame(() => {
              card.style.opacity = '1';
              card.style.transform = 'scale(1)';
            });
          } else {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            card.classList.add('is-filtered-out');
          }
        });

        // Filter group accordions if present
        serviceGroups.forEach((group) => {
          if (category === 'all') {
            group.style.display = '';
            group.classList.remove('is-filtered-out');
          } else {
            const groupText = (group.innerText || group.textContent || '').toLowerCase();
            const matches = groupText.includes(category.toLowerCase());
            if (matches) {
              group.style.display = '';
              if (group.tagName === 'DETAILS') group.open = true;
              group.classList.remove('is-filtered-out');
            } else {
              group.style.display = 'none';
              group.classList.add('is-filtered-out');
            }
          }
        });
      });
    });
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      initScrollReveal();
      initInteractiveServiceChips();
    }, { timeout: 2000 });
  } else {
    requestAnimationFrame(() => setTimeout(() => {
      initScrollReveal();
      initInteractiveServiceChips();
    }, 100));
  }

  // --- Seasonal offer bar ---
  // The bar is baked into the page with whatever season the site was last
  // built in, so the first job here is to keep it honest between deploys. The
  // rest is wiring: point the CTA at whichever quote form this page actually
  // has, and remember a dismissal for the rest of the season.
  (function initSeasonalBanner() {
    const banner = document.getElementById('seasonal-banner');
    if (!banner) return;

    const STORAGE_KEY = 'aaa-seasonal-banner';

    const prefersReduced = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Meteorological seasons, matching scripts/unified-nav.mjs — winter runs
    // December through February, which is how a Michigan homeowner thinks
    // about the work.
    const seasonOf = (date) => {
      const month = date.getMonth();
      if (month <= 1 || month === 11) return 'winter';
      if (month <= 4) return 'spring';
      if (month <= 7) return 'summer';
      return 'fall';
    };

    const now = new Date();
    const season = seasonOf(now);
    // December counts into the year the winter ends in, so closing the bar a
    // few weeks before New Year's Day isn't undone by the calendar rolling
    // over halfway through the same season.
    const year = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const seasonKey = `${season}-${year}`;

    // Re-render the copy if the build is from a previous season. The table
    // rides along with the markup so it can't drift from the one the build
    // used; each value is written as text, never as markup.
    if (banner.dataset.season !== season) {
      let offers = null;
      const table = banner.querySelector('[data-banner-seasons]');
      try {
        offers = table ? JSON.parse(table.textContent) : null;
      } catch (err) {
        offers = null;
      }

      const offer = offers && offers[season];
      if (offer) {
        const fill = (attr, value) => {
          const el = banner.querySelector(`[${attr}]`);
          if (el && typeof value === 'string') el.textContent = value;
        };

        fill('data-banner-icon', offer.icon);
        fill('data-banner-label', offer.label);
        fill('data-banner-lead', offer.lead);
        fill('data-banner-save', offer.save);
        fill('data-banner-note', offer.note);
        banner.dataset.season = season;
      }
    }

    // The inline guard in the markup already hid the bar before the first
    // paint if it was dismissed; this repeats the check only to cover a stored
    // value written after that guard ran, on a page kept open across seasons.
    let stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      stored = null;
    }
    if (stored === seasonKey) banner.hidden = true;

    const closeButton = banner.querySelector('[data-banner-close]');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        try {
          localStorage.setItem(STORAGE_KEY, seasonKey);
        } catch (err) {
          // Private browsing refuses the write; the bar still closes for now.
        }

        // Focus is about to be removed from the page, so hand it to the main
        // landmark rather than letting it fall back to <body>.
        const restoreFocus = () => {
          const main = document.getElementById('main-content');
          if (!main) return;
          main.setAttribute('tabindex', '-1');
          main.focus({ preventScroll: true });
        };

        if (prefersReduced) {
          banner.hidden = true;
          restoreFocus();
          return;
        }

        // Collapse rather than snap out, so the page below settles instead of
        // jumping. The rendered height has to be pinned inline first: the
        // stylesheet's `height: 0` can't animate away from `auto`.
        banner.style.height = `${banner.offsetHeight}px`;
        banner.classList.add('is-dismissing');

        const finish = () => {
          window.clearTimeout(timer);
          banner.removeEventListener('transitionend', onTransitionEnd);
          banner.hidden = true;
          banner.classList.remove('is-dismissing');
          banner.style.height = '';
          restoreFocus();
        };

        const onTransitionEnd = (event) => {
          if (event.target === banner && event.propertyName === 'height') finish();
        };

        banner.addEventListener('transitionend', onTransitionEnd);
        const timer = window.setTimeout(finish, 700);

        requestAnimationFrame(() => {
          banner.style.height = '0px';
        });
      });
    }

    // --- CTA: land on this page's quote form, not a copy of it elsewhere ---
    // The markup ships with /#quote so the button works with no JavaScript at
    // all. Where the page has a form of its own — the booking page, the
    // contact page — sending the visitor away from it would cost the
    // conversion, so the link is rewritten to the local one.
    const cta = banner.querySelector('[data-banner-cta]');
    const target = ['#quote', '#booking-section', '#contact']
      .map((selector) => document.querySelector(selector))
      .find((el) => el && el.querySelector('form'));

    if (cta && target && target.id) {
      cta.setAttribute('href', `#${target.id}`);

      cta.addEventListener('click', (event) => {
        // Leave modified clicks to the browser: they mean "open this
        // somewhere else", not "scroll me down the page".
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        event.preventDefault();
        target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });

        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', `#${target.id}`);
        }

        // Put the cursor in the first field the visitor can actually see —
        // the Netlify honeypot is the first input in these forms and is
        // hidden, so it has to be skipped.
        const field = Array.from(
          target.querySelectorAll('input:not([type="hidden"]), select, textarea')
        ).find((el) => !el.disabled && el.offsetParent !== null);

        if (field) {
          window.setTimeout(
            () => field.focus({ preventScroll: true }),
            prefersReduced ? 0 : 520
          );
        }
      });
    }
  })();

})();
