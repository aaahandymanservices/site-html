/*
 * Seasonal offer bar, rendered directly under the top nav on every page.
 *
 * The copy turns over four times a year while the pages themselves are static,
 * so the season is resolved twice. Once here, at build time -- that is what a
 * visitor without JavaScript and what a crawler that doesn't run it will read.
 * Then again in the browser by js/site.js, so a deploy that predates the
 * equinox never leaves the site advertising the wrong season. Both readings
 * come from this one table: it travels to the browser as JSON inside the
 * banner rather than being copied into the script, where the two would drift.
 */

import { escapeHtml, jsonForScript } from './html-escape.mjs';

export const SEASONAL_OFFERS = {
  spring: {
    icon: '☀️',
    label: 'Spring Deck & Gutter Prep',
    lead: 'Book your spring deck & gutter prep and',
    save: 'save $50',
    note: 'Oakland County homeowners · limited spring openings',
  },
  summer: {
    icon: '🌤️',
    label: 'Summer Exterior Refresh',
    lead: 'Book your summer exterior refresh and',
    save: 'save $50',
    note: 'Oakland County homeowners · limited summer openings',
  },
  fall: {
    icon: '🍂',
    label: 'Fall Maintenance Special',
    lead: 'Book your seasonal tune-up today and',
    save: 'save $50',
    note: 'Oakland County homeowners · limited fall openings',
  },
  winter: {
    icon: '❄️',
    label: 'Winter Weatherproofing Special',
    lead: 'Book your winter weatherproofing and',
    save: 'save $50',
    note: 'Oakland County homeowners · limited winter openings',
  },
};

/** Meteorological seasons, which is how a Michigan homeowner thinks about the
 *  work: winter runs December through February, not from the solstice. */
export function currentSeason(date = new Date()) {
  const month = date.getMonth();
  if (month <= 1 || month === 11) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'fall';
}

export function getSeasonalBanner() {
  const season = currentSeason();
  const offer = SEASONAL_OFFERS[season];

  // Nothing in the table contains `<` today, but JSON sitting inside a document
  // has to survive the HTML parser whatever the copy is edited to later, and a
  // stray `</script>` in it would end the block early.
  const seasons = jsonForScript(SEASONAL_OFFERS, 0);

  // Dismissal is read back before the first paint rather than in the deferred
  // site.js, so a visitor who closed the bar never sees it flash in and
  // collapse again on every page they open. It re-derives the season key
  // instead of importing one -- the few bytes of duplication buy the whole
  // no-flash behaviour, and site.js re-checks the same key straight after.
  const dismissGuard = "(function(){try{var b=document.getElementById('seasonal-banner');"
    + 'if(!b)return;var d=new Date(),m=d.getMonth(),y=d.getFullYear();'
    + "var s=(m<=1||m===11)?'winter':m<=4?'spring':m<=7?'summer':'fall';"
    + "var k=s+'-'+(m===11?y+1:y);b.dataset.seasonKey=k;"
    + "if(localStorage.getItem('aaa-seasonal-banner')===k)b.hidden=true;}catch(e){}})();";

  return `<aside id="seasonal-banner" class="seasonal-banner" data-season="${season}" aria-label="Seasonal offer">
    <div class="seasonal-banner__inner">
        <p class="seasonal-badge">
            <span class="seasonal-badge__icon" data-banner-icon aria-hidden="true">${offer.icon}</span>
            <span data-banner-label>${escapeHtml(offer.label)}</span>
        </p>
        <p class="seasonal-banner__copy">
            <span class="seasonal-banner__lead"><span data-banner-lead>${escapeHtml(offer.lead)}</span> <strong class="seasonal-banner__save" data-banner-save>${escapeHtml(offer.save)}</strong></span>
            <span class="seasonal-banner__note" data-banner-note>${escapeHtml(offer.note)}</span>
        </p>
        <a class="seasonal-banner__cta" href="/#quote" data-banner-cta>Claim Seasonal Offer<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8h11M9 3.5 13.5 8 9 12.5"></path></svg></a>
    </div>
    <button type="button" class="seasonal-banner__close" data-banner-close aria-label="Dismiss seasonal offer">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"></path></svg>
    </button>
    <script type="application/json" data-banner-seasons>${seasons}</script>
    <script>${dismissGuard}</script>
</aside>`;
}

export function getUnifiedNav(activePage = 'none') {
  const isServices = activePage === 'services';
  const isServiceAreas = activePage === 'service-areas';
  const isRates = activePage === 'rates';
  const isGuarantee = activePage === 'guarantee';
  const isReviews = activePage === 'reviews';
  const isCareers = activePage === 'careers';
  const isContact = activePage === 'contact';

  const ariaCurrent = (active) => active ? ' aria-current="page"' : '';

  const linkCls = (active) => active
    ? 'nav-link py-1 text-red-600 font-bold border-b-2 border-red-600 transition'
    : 'nav-link py-1 text-gray-700 hover:text-red-600 border-b-2 border-transparent transition';

  const mobileLinkCls = (active) => active
    ? 'block text-red-600 font-bold py-2.5 px-3 bg-red-50 rounded-xl transition'
    : 'block text-gray-800 font-medium py-2.5 px-3 hover:bg-gray-50 hover:text-red-600 rounded-xl transition';

  return `<a href="#main-content" class="skip-link sr-only focus:not-sr-only">Skip to main content</a>

<header id="site-header" class="site-header sticky top-0 z-[100] bg-white/95 backdrop-blur-md shadow-md border-b-[3px] border-red-600">
    <div class="header-container site-nav__bar max-w-7xl mx-auto flex items-center justify-between">
        <a href="/" class="brand site-nav__brand group flex items-center gap-3 min-w-0">
            <img src="/.netlify/images?url=/icon.jpg&amp;w=96&amp;fm=avif&amp;q=80" srcset="/.netlify/images?url=/icon.jpg&amp;w=48&amp;fm=avif&amp;q=80 1x, /.netlify/images?url=/icon.jpg&amp;w=96&amp;fm=avif&amp;q=80 2x" width="48" height="48" decoding="async" fetchpriority="high" alt="" class="h-9 w-9 sm:h-11 sm:w-11 rounded-full object-cover flex-shrink-0 border-2 border-red-600 shadow-sm transition group-hover:scale-105">
            <div class="brand-text min-w-0">
                <p class="brand-title text-base min-[390px]:text-lg sm:text-xl lg:text-xl xl:text-2xl font-bold tracking-tight text-red-600 leading-tight truncate">AAA Handyman Services LLC</p>
                <p class="brand-tagline text-[10px] sm:text-xs text-gray-500 font-medium">Oakland County, Michigan</p>
            </div>
            <span class="sr-only">home</span>
        </a>

        <!-- Desktop Navigation Container -->
        <div class="site-nav__desktop hidden lg:flex items-center">
            <ul class="nav-links site-nav__links flex items-center gap-5 list-none m-0 p-0 text-sm xl:text-base font-medium">
                <li><a href="/services" class="${linkCls(isServices)}"${ariaCurrent(isServices)}>Services</a></li>
                <li><a href="/service-areas" class="${linkCls(isServiceAreas)}"${ariaCurrent(isServiceAreas)}>Service Areas</a></li>
                <li><a href="/rates" class="${linkCls(isRates)}"${ariaCurrent(isRates)}>Rates</a></li>
                <li><a href="/guarantee" class="${linkCls(isGuarantee)}"${ariaCurrent(isGuarantee)}>Guarantee</a></li>
                <li><a href="/careers" class="${linkCls(isCareers)}"${ariaCurrent(isCareers)}>Careers</a></li>
                <li><a href="/contact" class="${linkCls(isContact)}"${ariaCurrent(isContact)}>Contact</a></li>
            </ul>

            <!-- Social Media Icons -->
            <div class="social-icons site-nav__social flex items-center gap-3 pl-4 border-l border-gray-200 ml-3">
                <a href="https://www.facebook.com/AAAHandymanServicesLLC" target="_blank" rel="noopener noreferrer" aria-label="Follow AAA Handyman Services LLC on Facebook" class="text-[#1877F2] hover:opacity-80 text-xl transition p-1"><i class="fab fa-facebook" aria-hidden="true"></i></a>
                <a href="https://maps.app.goo.gl/uqK9xsJj4UX5tW4W7" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Google" class="text-[#4285F4] hover:opacity-80 text-xl transition p-1"><svg width="1em" height="1em" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 42.41 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1 15.4 1 7.96 4.59 4.34 11.12l7.35 5.7C13.42 13.62 18.27 9.75 24 9.75z"/></svg></a>
                <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Yelp" class="text-[#FF1A1A] hover:opacity-80 text-lg transition p-1"><i class="fa-brands fa-yelp" aria-hidden="true"></i></a>
                <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Nextdoor" class="text-[#00B24F] hover:opacity-80 text-lg transition p-1"><i class="fa-solid fa-house-chimney" aria-hidden="true"></i></a>
            </div>
        </div>

        <!-- Mobile Hamburger Button -->
        <button id="mobile-menu-btn" class="flex lg:hidden hamburger-menu site-nav__toggle items-center justify-center text-gray-700 hover:text-red-600 focus:outline-none p-2 rounded-xl transition border border-gray-200 hover:border-gray-300" aria-label="Menu" aria-expanded="false" aria-controls="mobile-menu">
            <i class="fas fa-bars text-2xl" id="menu-icon" aria-hidden="true"></i>
        </button>
    </div>

    <!-- Mobile Navigation Drawer / Menu -->
    <div id="mobile-menu" class="hidden bg-white/98 backdrop-blur-lg border-t border-gray-200 px-4 py-4 space-y-3 shadow-xl" hidden aria-hidden="true">
        <div class="space-y-1">
            <a href="/services" class="${mobileLinkCls(isServices)}"${ariaCurrent(isServices)}>Services</a>
            <a href="/service-areas" class="${mobileLinkCls(isServiceAreas)}"${ariaCurrent(isServiceAreas)}>Service Areas</a>
            <a href="/rates" class="${mobileLinkCls(isRates)}"${ariaCurrent(isRates)}>Rates</a>
            <a href="/guarantee" class="${mobileLinkCls(isGuarantee)}"${ariaCurrent(isGuarantee)}>Guarantee</a>
            <a href="/reviews" class="${mobileLinkCls(isReviews)}"${ariaCurrent(isReviews)}>Reviews</a>
            <a href="/careers" class="${mobileLinkCls(isCareers)}"${ariaCurrent(isCareers)}>Careers</a>
            <a href="/contact" class="${mobileLinkCls(isContact)}"${ariaCurrent(isContact)}>Contact</a>
        </div>

        <div class="pt-3 border-t border-gray-100 flex flex-col gap-3">
            <a href="tel:+12483853432" class="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition text-center">
                <i class="fas fa-phone" aria-hidden="true"></i> Call (248) 385-3432
            </a>
            <div class="flex items-center justify-center gap-6 text-2xl pt-1">
                <a href="https://www.facebook.com/AAAHandymanServicesLLC" target="_blank" rel="noopener noreferrer" aria-label="Follow AAA Handyman Services LLC on Facebook" class="text-[#1877F2] hover:opacity-80 transition"><i class="fab fa-facebook" aria-hidden="true"></i></a>
                <a href="https://maps.app.goo.gl/uqK9xsJj4UX5tW4W7" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Google" class="text-[#4285F4] hover:opacity-80 transition"><svg width="1em" height="1em" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 42.41 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1 15.4 1 7.96 4.59 4.34 11.12l7.35 5.7C13.42 13.62 18.27 9.75 24 9.75z"/></svg></a>
                <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Yelp" class="text-[#FF1A1A] hover:opacity-80 transition"><i class="fa-brands fa-yelp" aria-hidden="true"></i></a>
                <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Nextdoor" class="text-[#00B24F] hover:opacity-80 transition"><i class="fa-solid fa-house-chimney" aria-hidden="true"></i></a>
            </div>
        </div>
    </div>
</header>

${getSeasonalBanner()}`;
}
