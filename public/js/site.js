(function () {
  // --- Dark Mode Integration (Decoupled & Robust) ---
  const initDarkMode = () => {
    const menuBtn = document.getElementById('mobile-menu-btn');
    if (!menuBtn) return;

    // Check if toggle button already exists to prevent duplicate insertion
    if (document.getElementById('theme-toggle-btn')) return;

    // Create theme toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'theme-toggle-btn';
    toggleBtn.className = 'border-0 outline-none focus:outline-none focus:ring-0 focus:ring-transparent focus-visible:outline-none focus-visible:ring-0 p-2 text-xl sm:text-2xl mr-2 transition-colors text-blue-900 hover:text-red-600 dark:text-gray-100 dark:hover:text-red-400';
    toggleBtn.setAttribute('aria-label', 'Toggle Dark Mode');
    toggleBtn.setAttribute('title', 'Toggle Dark Mode');

    const toggleIcon = document.createElement('i');
    toggleIcon.id = 'theme-toggle-icon';
    toggleIcon.className = 'fas fa-moon';
    toggleBtn.appendChild(toggleIcon);

    // Insert before mobile-menu-btn
    menuBtn.parentNode.insertBefore(toggleBtn, menuBtn);

    const updateIcon = (isDark) => {
      if (isDark) {
        toggleIcon.className = 'fas fa-sun text-yellow-400';
      } else {
        toggleIcon.className = 'fas fa-moon text-blue-900';
      }
    };

    // Initialize icon state
    updateIcon(document.documentElement.classList.contains('dark'));

    // Handle toggle click
    toggleBtn.addEventListener('click', () => {
      const isDarkNow = document.documentElement.classList.toggle('dark');
      localStorage.theme = isDarkNow ? 'dark' : 'light';
      updateIcon(isDarkNow);
    });
  };

  // Run initial setup for theme toggle immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDarkMode);
  } else {
    initDarkMode();
  }

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
})();
