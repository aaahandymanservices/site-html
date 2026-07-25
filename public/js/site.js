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
    menuButton.setAttribute('aria-expanded', String(!mobileMenu.classList.contains('hidden')));

    const isOpen = () => !mobileMenu.classList.contains('hidden');

    const setMenuOpen = (open, { restoreFocus = false } = {}) => {
      mobileMenu.classList.toggle('hidden', !open);
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
  }

  // --- Scroll-reveal: cinematic entrances as content scrolls into view ---
  // The initial hidden state lives behind the `.js-reveal` class, which is only
  // added here — so if this never runs (no JS, reduced motion, older browser)
  // every section stays fully visible.
  (function initScrollReveal() {
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
        if (section.classList.contains('hidden')) return;
        if (window.getComputedStyle(section).display === 'none') return;

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

      // Safety net: never leave content hidden, even if the observer misbehaves
      // or the page is restored from the back/forward cache.
      const revealEverything = () => units.forEach(reveal);
      window.setTimeout(revealEverything, 4500);
      window.addEventListener('pageshow', revealEverything);
    } catch (err) {
      root.classList.remove('js-reveal');
    }
  })();

})();
