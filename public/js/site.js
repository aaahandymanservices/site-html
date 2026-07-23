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

  // --- Mobile Navigation Menu & Accordions ---
  const menuButton = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIcon = document.getElementById('menu-icon');
  if (menuButton && mobileMenu) {
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

    // Accordion: Mobile Services Menu
    const servicesToggle = document.getElementById('mobile-services-toggle');
    const servicesMenu = document.getElementById('mobile-services-menu');
    const servicesArrow = document.getElementById('mobile-services-arrow');
    if (servicesToggle && servicesMenu) {
      servicesToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = servicesMenu.classList.contains('hidden');
        servicesMenu.classList.toggle('hidden', !isOpen);
        if (servicesArrow) {
          servicesArrow.classList.toggle('rotate-180', isOpen);
        }
      });
    }

    // Accordion: Mobile Rates Menu
    const ratesToggle = document.getElementById('mobile-rates-toggle');
    const ratesMenu = document.getElementById('mobile-rates-menu');
    const ratesArrow = document.getElementById('mobile-rates-arrow');
    if (ratesToggle && ratesMenu) {
      ratesToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = ratesMenu.classList.contains('hidden');
        ratesMenu.classList.toggle('hidden', !isOpen);
        if (ratesArrow) {
          ratesArrow.classList.toggle('rotate-180', isOpen);
        }
      });
    }
  }

  // --- Keyboard & Focus Accessibility for Desktop Dropdowns ---
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

})();
