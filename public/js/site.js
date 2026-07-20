(function () {
  // Theme management logic
  const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') || 'system';
    const isDark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  };

  // Run initialization immediately to avoid flash
  initTheme();

  // Listen for system theme changes in real time
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (localStorage.getItem('theme') === 'system' || !localStorage.getItem('theme')) {
      initTheme();
    }
  });

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

  const menuButton = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIcon = document.getElementById('menu-icon');

  const insertThemeToggle = () => {
    if (!menuButton) return;

    // Create container for relative positioning
    const container = document.createElement('div');
    container.className = 'relative inline-block text-left mr-1 sm:mr-2';

    // Theme configuration
    const themes = {
      light: { icon: 'fa-sun', label: 'Light' },
      dark: { icon: 'fa-moon', label: 'Dark' },
      system: { icon: 'fa-circle-half-stroke', label: 'System' }
    };

    // Main Toggle Button
    const btn = document.createElement('button');
    btn.id = 'theme-menu-btn';
    btn.type = 'button';
    btn.className = 'flex items-center justify-center w-10 h-10 rounded-full text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-600 transition-colors text-xl';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-label', 'Change color theme');
    btn.title = 'Change color theme';

    const updateButtonIcon = () => {
      const activeTheme = localStorage.getItem('theme') || 'system';
      btn.innerHTML = `<i class="fa-solid ${themes[activeTheme].icon}"></i>`;
    };
    updateButtonIcon();

    // Dropdown Menu Card
    const menu = document.createElement('div');
    menu.id = 'theme-menu-list';
    menu.className = 'hidden absolute right-0 mt-2 w-32 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xl z-[100] focus:outline-none py-1.5';
    menu.setAttribute('role', 'menu');

    // Create theme options
    Object.keys(themes).forEach((key) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left';
      option.setAttribute('role', 'menuitem');
      option.innerHTML = `<i class="fa-solid ${themes[key].icon} w-4 text-center"></i> <span>${themes[key].label}</span>`;

      option.addEventListener('click', () => {
        localStorage.setItem('theme', key);
        initTheme();
        updateButtonIcon();
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
      });

      menu.appendChild(option);
    });

    // Toggle dropdown visibility
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !menu.classList.contains('hidden');
      menu.classList.toggle('hidden', isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    // Support keyboard escape key
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    });

    container.appendChild(btn);
    container.appendChild(menu);

    // Insert before the mobile-menu-btn
    menuButton.parentNode.insertBefore(container, menuButton);
  };

  // Run injector
  insertThemeToggle();

  if (!menuButton || !mobileMenu) return;
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
})();
