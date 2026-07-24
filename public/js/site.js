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

    const setMenuOpen = (open) => {
      mobileMenu.classList.toggle('hidden', !open);
      menuButton.setAttribute('aria-expanded', String(open));
      if (menuIcon) {
        menuIcon.classList.toggle('fa-bars', !open);
        menuIcon.classList.toggle('fa-times', open);
      }
      window.dispatchEvent(new Event('resize'));
    };

    menuButton.addEventListener('click', () => setMenuOpen(mobileMenu.classList.contains('hidden')));
    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMenuOpen(false));
    });
  }

  // --- Keyboard & Focus Accessibility ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden');
        if (menuIcon) {
          menuIcon.classList.add('fa-bars');
          menuIcon.classList.remove('fa-times');
        }
      }
    }
  });

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
