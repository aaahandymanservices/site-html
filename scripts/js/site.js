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

  // --- Fee tooltips: keep the bubble on screen ---
  // The bubble is centred on its trigger, and a good number of triggers sit at
  // the end of a price row, so on a phone the right side of the bubble lands
  // past the edge of the screen -- where `overflow-x: hidden` on <body> cuts
  // it off instead of letting the visitor scroll to it. Measuring it as it
  // opens and nudging it back by however far it sticks out keeps every word
  // readable while leaving it as close to its trigger as it can be. The
  // stylesheet reads the offset through `--fee-tip-shift` and centres the
  // bubble as before when this never runs.
  const feeTips = document.querySelectorAll('.fee-tip');
  if (feeTips.length) {
    const GUTTER = 8;

    const positionBubble = (tip) => {
      const bubble = tip.querySelector('.fee-tip__bubble');
      if (!bubble) return;

      // Measure from the centred position, not from wherever the last opening
      // left it, or each open would compound the one before it.
      bubble.style.setProperty('--fee-tip-shift', '0px');

      const viewport = document.documentElement.clientWidth;
      const rect = bubble.getBoundingClientRect();
      let shift = 0;

      if (rect.right > viewport - GUTTER) shift = viewport - GUTTER - rect.right;
      // A bubble wider than the screen would otherwise be pushed off the left
      // edge by the correction it just got on the right; the left edge wins.
      if (rect.left + shift < GUTTER) shift = GUTTER - rect.left;

      if (shift) bubble.style.setProperty('--fee-tip-shift', `${Math.round(shift)}px`);
    };

    feeTips.forEach((tip) => {
      // Both openings the stylesheet recognises: hover, and the focus a tap or
      // the keyboard puts on the trigger.
      tip.addEventListener('pointerenter', () => positionBubble(tip));
      tip.addEventListener('focusin', () => positionBubble(tip));
    });
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

      const reveal = (unit) => {
        unit.el.classList.add('reveal-shown');
        unit.children.forEach((child) => child.classList.add('reveal-shown'));
      };

      if (units.length) {
        const observer = new IntersectionObserver((entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const unit = units.find((u) => u.el === entry.target);
            if (unit) reveal(unit);
            obs.unobserve(entry.target);
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

        units.forEach((unit) => observer.observe(unit.el));
      }

      // Observe explicit .reveal-on-scroll elements. This is independent of the
      // <section>-based units above: pages like the city landing pages use
      // `reveal-on-scroll` on a <div> with no <section> siblings, so wiring it
      // only after `units.length` would leave that element stranded at
      // opacity:0 (js-reveal was already added to <html>) with no observer to
      // reveal it and no safety net to fall back on.
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
      // or the page is restored from the back/forward cache. Runs for both the
      // section units and the explicit reveal-on-scroll elements.
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

})();
