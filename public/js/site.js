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

  // --- Mobile Sticky Floating Call & Get Quote Bar ---
  const initMobileFloatingBar = () => {
    if (document.getElementById('mobile-floating-bar')) return;

    const floatBar = document.createElement('div');
    floatBar.id = 'mobile-floating-bar';
    floatBar.className = 'fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-900/95 backdrop-blur-md border-t border-slate-700/80 p-2.5 px-4 shadow-2xl transition-transform duration-300 translate-y-0';
    floatBar.setAttribute('aria-label', 'Quick Contact Bar');

    floatBar.innerHTML = `
      <div class="max-w-md mx-auto flex items-center justify-between gap-3">
        <a href="tel:+12483853432" class="cta-button bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl flex-1 flex items-center justify-center gap-2 text-xs sm:text-sm text-center shadow-md active:scale-95 transition" style="min-height: 48px;">
          <i class="fas fa-phone text-sm" aria-hidden="true"></i>
          <span>Call (248) 385-3432</span>
        </a>
        <a href="/contact" class="cta-button bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-3 rounded-xl flex-1 flex items-center justify-center gap-2 text-xs sm:text-sm text-center shadow-md active:scale-95 transition" style="min-height: 48px;">
          <i class="fas fa-calculator text-sm" aria-hidden="true"></i>
          <span>Get Quote</span>
        </a>
      </div>
    `;

    document.body.appendChild(floatBar);

    const adjustBodyPadding = () => {
      if (window.innerWidth < 768) {
        document.body.style.paddingBottom = '68px';
      } else {
        document.body.style.paddingBottom = '0px';
      }
    };

    adjustBodyPadding();
    window.addEventListener('resize', adjustBodyPadding, { passive: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileFloatingBar);
  } else {
    initMobileFloatingBar();
  }
})();
